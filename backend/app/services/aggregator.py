import structlog
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
from db.models import CarListing, PriceAggregate
from decimal import Decimal

logger = structlog.get_logger()


def _percentile(sorted_values: list[float], ratio: float) -> float:
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return float(sorted_values[0])

    position = (len(sorted_values) - 1) * ratio
    lower = int(position)
    upper = min(lower + 1, len(sorted_values) - 1)
    if lower == upper:
        return float(sorted_values[lower])

    lower_value = float(sorted_values[lower])
    upper_value = float(sorted_values[upper])
    weight = position - lower
    return lower_value + (upper_value - lower_value) * weight

class CarPriceAggregator:
    def __init__(self, db: Session):
        self.db = db

    def compute_aggregates(self, period_year: int, period_month: int):
        """
        Calculates medians and averages for the given month and stores them in price_aggregates.
        """
        logger.info("computing_aggregates", year=period_year, month=period_month)

        listing_rows = (
            self.db.query(
                CarListing.make,
                CarListing.model,
                CarListing.year,
                CarListing.district,
                CarListing.price_lkr,
            )
            .filter(
                CarListing.price_lkr.isnot(None),
                CarListing.is_outlier == False
            )
            .all()
        )

        grouped_prices: dict[tuple[str, str, int, Optional[str]], list[float]] = defaultdict(list)
        for make, model, year, district, price_lkr in listing_rows:
            if price_lkr is None:
                continue
            grouped_prices[(make, model, year, district)].append(float(price_lkr))

        for (make, model, year, district), prices in grouped_prices.items():
            if not prices:
                continue

            prices.sort()
            count = len(prices)
            avg_price = sum(prices) / count
            median_price = _percentile(prices, 0.5)
            p25_price = _percentile(prices, 0.25)
            p75_price = _percentile(prices, 0.75)

            agg = self.db.query(PriceAggregate).filter(
                PriceAggregate.make == make,
                PriceAggregate.model == model,
                PriceAggregate.year == year,
                PriceAggregate.district == district,
                PriceAggregate.period_year == period_year,
                PriceAggregate.period_month == period_month
            ).first()
            
            if not agg:
                agg = PriceAggregate(
                    make=make,
                    model=model,
                    year=year,
                    district=district,
                    period_year=period_year,
                    period_month=period_month
                )
                self.db.add(agg)

            agg.avg_price_lkr = Decimal(str(round(avg_price, 2)))
            agg.median_price_lkr = Decimal(str(round(median_price, 2)))
            agg.p25_price_lkr = Decimal(str(round(p25_price, 2)))
            agg.p75_price_lkr = Decimal(str(round(p75_price, 2)))
            agg.listing_count = count
            agg.computed_at = func.now()

        self.db.commit()
        logger.info("aggregates_computed", count=len(grouped_prices))

    def update_deal_scores(self):
        """
        Updates the deal_score for all active listings based on the latest aggregates.
        """
        logger.info("updating_deal_scores")
        
        # Get the latest aggregates for each make/model/year
        # We'll prioritize district-specific aggregates, then fall back to national
        
        # 1. Map aggregates for quick lookup
        recent_aggregates = self.db.query(PriceAggregate).order_by(
            PriceAggregate.period_year.desc(), 
            PriceAggregate.period_month.desc()
        ).limit(5000).all() # Large enough for common models
        
        # district level map: (make, model, year, district) -> median
        d_map = {(a.make, a.model, a.year, a.district): float(a.median_price_lkr) for a in recent_aggregates if a.district}
        # national level map: (make, model, year) -> median (average of districts)
        n_map = {}
        for a in recent_aggregates:
            key = (a.make, a.model, a.year)
            if key not in n_map:
                n_map[key] = []
            n_map[key].append(float(a.median_price_lkr))
        n_map = {k: sum(v)/len(v) for k, v in n_map.items()}

        # 2. Update listings
        listings = self.db.query(CarListing).filter(
            CarListing.price_lkr.isnot(None),
            CarListing.is_outlier == False
        ).all()
        
        updated_count = 0
        for listing in listings:
            key_d = (listing.make, listing.model, listing.year, listing.district)
            key_n = (listing.make, listing.model, listing.year)
            
            median = d_map.get(key_d) or n_map.get(key_n)
            
            if median and median > 0:
                listing.market_median_lkr = Decimal(str(median))
                # Score: Positive if cheaper than median, Negative if more expensive
                # Normalized to -100 to 100
                raw_score = (1.0 - (float(listing.price_lkr) / median)) * 100.0
                listing.deal_score = Decimal(str(max(-100.0, min(100.0, round(raw_score, 1)))))
                updated_count += 1
                
        self.db.commit()
        logger.info("deal_scores_updated", count=updated_count)
