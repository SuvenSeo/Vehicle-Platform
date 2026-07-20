from __future__ import annotations

from statistics import median
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from app.utils.districts import find_district_from_url, normalize_district_name
from db.models import CarListing, live_listing_filter

MIN_REASONABLE_PRICE_LKR = 100_000


def median_from_values(values: Iterable[float]) -> Optional[float]:
    cleaned = sorted(value for value in values if value is not None and value >= MIN_REASONABLE_PRICE_LKR)
    if not cleaned:
        return None
    return float(median(cleaned))


def build_district_median_map(db: Session) -> dict[str, float]:
    rows = (
        db.query(CarListing.district, CarListing.url, CarListing.price_lkr)
        .filter(
            live_listing_filter(),
            CarListing.price_lkr.isnot(None),
            CarListing.price_lkr >= MIN_REASONABLE_PRICE_LKR,
        )
        .all()
    )

    buckets: dict[str, list[float]] = {}
    for district, url, price in rows:
        normalized = normalize_district_name(district)
        if normalized in (None, "Sri Lanka"):
            normalized = find_district_from_url(url)
        if not normalized:
            continue
        buckets.setdefault(normalized, []).append(float(price))

    medians: dict[str, float] = {}
    for district, prices in buckets.items():
        value = median_from_values(prices)
        if value is not None:
            medians[district] = value
    return medians


def median_price_for_listings(db: Session, clause) -> Optional[float]:
    prices = [
        float(row[0])
        for row in db.query(CarListing.price_lkr)
        .filter(
            clause,
            CarListing.price_lkr.isnot(None),
            CarListing.price_lkr >= MIN_REASONABLE_PRICE_LKR,
        )
        .all()
        if row[0] is not None
    ]
    return median_from_values(prices)
