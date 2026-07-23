"""Compose calendar-time and YOM cross-section price history for a make/model."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from db.models import (
    CarListing,
    HistoricalPriceObservation,
    PriceAggregate,
    live_listing_filter,
)

MIN_REASONABLE_PRICE_LKR = 100_000


def _median(values: list[float]) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[mid])
    return float((ordered[mid - 1] + ordered[mid]) / 2.0)


def build_model_price_history(
    db: Session,
    *,
    make: str,
    model: str,
    from_year: int = 2000,
    to_year: int = 2026,
) -> dict[str, Any]:
    make_lower = make.strip().lower()
    model_lower = model.strip().lower()

    aggregate_rows = (
        db.query(
            PriceAggregate.period_year,
            PriceAggregate.period_month,
            func.avg(PriceAggregate.median_price_lkr).label("median_price_lkr"),
            func.sum(PriceAggregate.listing_count).label("listing_count"),
        )
        .filter(
            func.lower(PriceAggregate.make) == make_lower,
            func.lower(PriceAggregate.model) == model_lower,
            PriceAggregate.period_year >= from_year,
            PriceAggregate.period_year <= to_year,
            PriceAggregate.district.is_(None),
        )
        .group_by(PriceAggregate.period_year, PriceAggregate.period_month)
        .order_by(PriceAggregate.period_year, PriceAggregate.period_month)
        .all()
    )

    calendar_from_aggregates = [
        {
            "period": f"{int(row.period_year):04d}-{int(row.period_month):02d}",
            "period_year": int(row.period_year),
            "period_month": int(row.period_month),
            "median_price_lkr": round(float(row.median_price_lkr), 2)
            if row.median_price_lkr is not None
            else None,
            "listing_count": int(row.listing_count or 0),
            "origin": "live_aggregates",
        }
        for row in aggregate_rows
    ]

    archive_rows = (
        db.query(HistoricalPriceObservation)
        .filter(
            func.lower(HistoricalPriceObservation.make) == make_lower,
            func.lower(HistoricalPriceObservation.model) == model_lower,
            HistoricalPriceObservation.price_lkr.isnot(None),
            HistoricalPriceObservation.price_lkr >= MIN_REASONABLE_PRICE_LKR,
            func.extract("year", HistoricalPriceObservation.observed_at) >= from_year,
            func.extract("year", HistoricalPriceObservation.observed_at) <= to_year,
        )
        .all()
    )

    bucket: dict[tuple[int, int], list[float]] = {}
    for row in archive_rows:
        observed: datetime | None = row.observed_at
        if observed is None:
            continue
        key = (int(observed.year), int(observed.month))
        bucket.setdefault(key, []).append(float(row.price_lkr))

    calendar_from_archive = [
        {
            "period": f"{year:04d}-{month:02d}",
            "period_year": year,
            "period_month": month,
            "median_price_lkr": round(med, 2) if (med := _median(prices)) is not None else None,
            "listing_count": len(prices),
            "origin": "archive_observations",
        }
        for (year, month), prices in sorted(bucket.items())
    ]

    live_clause = and_(
        live_listing_filter(),
        func.lower(CarListing.make) == make_lower,
        func.lower(CarListing.model) == model_lower,
        CarListing.price_lkr.isnot(None),
        CarListing.price_lkr >= MIN_REASONABLE_PRICE_LKR,
        CarListing.year.isnot(None),
        CarListing.year >= from_year,
        CarListing.year <= to_year,
    )
    yom_rows = (
        db.query(
            CarListing.year.label("yom"),
            func.count(CarListing.id).label("listing_count"),
            func.avg(CarListing.price_lkr).label("avg_price_lkr"),
        )
        .filter(live_clause)
        .group_by(CarListing.year)
        .order_by(CarListing.year)
        .all()
    )

    # Median per YOM via Python (portable across SQLite/Postgres)
    yom_prices: dict[int, list[float]] = {}
    priced = (
        db.query(CarListing.year, CarListing.price_lkr)
        .filter(live_clause)
        .all()
    )
    for year, price in priced:
        if year is None or price is None:
            continue
        yom_prices.setdefault(int(year), []).append(float(price))

    cross_section_by_yom = [
        {
            "yom": int(row.yom),
            "listing_count": int(row.listing_count or 0),
            "avg_price_lkr": round(float(row.avg_price_lkr), 2)
            if row.avg_price_lkr is not None
            else None,
            "median_price_lkr": round(med, 2)
            if (med := _median(yom_prices.get(int(row.yom), []))) is not None
            else None,
            "note": "Current asking prices for this manufacture year — not calendar history",
        }
        for row in yom_rows
        if row.yom is not None
    ]

    canonical = (
        db.query(CarListing.make, CarListing.model)
        .filter(
            func.lower(CarListing.make) == make_lower,
            func.lower(CarListing.model) == model_lower,
        )
        .first()
    )
    if canonical is None and archive_rows:
        canonical_make = str(archive_rows[0].make)
        canonical_model = str(archive_rows[0].model)
    elif canonical is not None:
        canonical_make = str(canonical.make)
        canonical_model = str(canonical.model)
    else:
        canonical_make = make.strip().title()
        canonical_model = model.strip().title()

    return {
        "make": canonical_make,
        "model": canonical_model,
        "from_year": from_year,
        "to_year": to_year,
        "calendar_series": {
            "live_aggregates": calendar_from_aggregates,
            "archive_observations": calendar_from_archive,
        },
        "cross_section_by_yom": cross_section_by_yom,
        "counts": {
            "aggregate_points": len(calendar_from_aggregates),
            "archive_points": len(calendar_from_archive),
            "archive_listings": len(archive_rows),
            "yom_buckets": len(cross_section_by_yom),
        },
        "interpretation": {
            "calendar_series": (
                "Median asking price over calendar time (what Motormila / archives "
                "observed in each month)."
            ),
            "cross_section_by_yom": (
                "Today's live listings grouped by manufacture year — useful for "
                "comparables, not a substitute for 2000s calendar history."
            ),
        },
    }
