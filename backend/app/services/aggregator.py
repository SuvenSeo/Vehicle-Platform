import structlog
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
from db.models import CarListing, PriceAggregate, live_listing_filter
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
                live_listing_filter()
            )
            .all()
        )

        grouped_prices: dict[tuple[str, str, int, Optional[str]], list[float]] = defaultdict(list)
        for make, model, year, district, price_lkr in listing_rows:
            if price_lkr is None:
                continue
            grouped_prices[(make, model, year, district)].append(float(price_lkr))

        # Compute stats in Python (one read round-trip above), then persist with
        # a single DELETE + bulk INSERT instead of one SELECT+UPDATE per group
        # (previously ~12k network round-trips to the DB per run).
        aggregates: list[dict] = []
        for (make, model, year, district), prices in grouped_prices.items():
            if not prices:
                continue

            prices.sort()
            count = len(prices)
            avg_price = sum(prices) / count
            median_price = _percentile(prices, 0.5)
            p25_price = _percentile(prices, 0.25)
            p75_price = _percentile(prices, 0.75)

            aggregates.append(
                {
                    "make": make,
                    "model": model,
                    "year": year,
                    "district": district,
                    "period_year": period_year,
                    "period_month": period_month,
                    "avg_price_lkr": Decimal(str(round(avg_price, 2))),
                    "median_price_lkr": Decimal(str(round(median_price, 2))),
                    "p25_price_lkr": Decimal(str(round(p25_price, 2))),
                    "p75_price_lkr": Decimal(str(round(p75_price, 2))),
                    "listing_count": count,
                }
            )

        # Replace the whole period in one statement pair.
        self.db.execute(
            PriceAggregate.__table__.delete().where(
                PriceAggregate.period_year == period_year,
                PriceAggregate.period_month == period_month,
            )
        )
        if aggregates:
            self.db.bulk_insert_mappings(PriceAggregate, aggregates)

        self.db.commit()
        logger.info("aggregates_computed", count=len(aggregates))
