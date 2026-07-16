"""Shared listing upsert with per-listing price-history recording.

Every scraper funnels through :func:`upsert_listing` so a price change is
never silently overwritten: the first sighting and each subsequent change
insert a row into ``vehicle_price_history``. Unchanged prices do not add
rows, keeping the table proportional to real market movement.
"""

from decimal import Decimal, InvalidOperation

import structlog
from sqlalchemy.orm import Session

from app.utils.time import utc_now
from db.models import CarListing, VehiclePriceHistory

log = structlog.get_logger()


def _as_decimal(value) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _record_price_point(db: Session, listing_id: int, price) -> None:
    price_dec = _as_decimal(price)
    if price_dec is None:
        return
    db.add(
        VehiclePriceHistory(
            vehicle_id=listing_id,
            price_lkr=price_dec,
            scraped_at=utc_now(),
        )
    )


def upsert_listing(db: Session, source: str, payload: dict) -> bool:
    """Insert or update a listing keyed on (source, source_id).

    Returns True when a new listing was created, False on update.
    Records a ``vehicle_price_history`` row on first sighting and whenever
    the price changes on re-scrape.
    """
    existing = (
        db.query(CarListing)
        .filter(
            CarListing.source == source,
            CarListing.source_id == payload["source_id"],
        )
        .first()
    )

    if existing:
        old_price = _as_decimal(existing.price_lkr)
        for key, value in payload.items():
            setattr(existing, key, value)
        existing.last_seen_at = utc_now()
        existing.is_active = True  # re-sighted at source: live again

        new_price = _as_decimal(payload.get("price_lkr"))
        if new_price is not None and new_price != old_price:
            _record_price_point(db, existing.id, new_price)
            log.info(
                "price_change_recorded",
                source=source,
                source_id=payload["source_id"],
                old_price=str(old_price) if old_price is not None else None,
                new_price=str(new_price),
            )
        return False

    listing = CarListing(**payload)
    db.add(listing)
    db.flush()  # assign listing.id for the initial history row
    _record_price_point(db, listing.id, payload.get("price_lkr"))
    return True
