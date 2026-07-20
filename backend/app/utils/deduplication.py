"""Cross-source duplicate detection helpers for CarListing records.

Matching criteria for a duplicate pair:
- Normalised make and model are equal (strip punctuation, case-insensitive)
- Year matches exactly (both None counts as equal)
- price_lkr within 3% of each other (both None counts as a match)
- mileage within 5% of each other, OR either side has mileage IS NULL
- Listings must belong to different sources
"""

from __future__ import annotations

import re
from typing import Optional

import structlog
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from db.models import CarListing

log = structlog.get_logger()

_STRIP_NON_ALNUM = re.compile(r"[^a-z0-9]")

PRICE_TOLERANCE = 0.03  # 3 %
MILEAGE_TOLERANCE = 0.05  # 5 %


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _norm(value: Optional[str]) -> str:
    """Lowercase and strip non-alphanumeric characters for fuzzy comparison."""
    if not value:
        return ""
    return _STRIP_NON_ALNUM.sub("", value.lower())


def _price_band(price) -> Optional[tuple[float, float]]:
    """Return (low, high) inclusive price band at PRICE_TOLERANCE, or None."""
    if price is None:
        return None
    p = float(price)
    if p <= 0:
        return None
    return p * (1 - PRICE_TOLERANCE), p * (1 + PRICE_TOLERANCE)


def _mileage_band(mileage: Optional[int]) -> Optional[tuple[int, int]]:
    """Return (low, high) inclusive mileage band at MILEAGE_TOLERANCE, or None."""
    if mileage is None:
        return None
    m = int(mileage)
    if m < 0:
        return None
    return int(m * (1 - MILEAGE_TOLERANCE)), int(m * (1 + MILEAGE_TOLERANCE))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def find_duplicate_candidates(
    db: Session,
    listing: CarListing,
    limit: int = 5,
) -> list[CarListing]:
    """Return up to *limit* listings from a *different* source that look like
    duplicates of *listing*.

    The DB query applies year / price / mileage range filters to narrow the
    candidate set; a final in-Python pass checks normalised make and model
    because the DB cannot easily strip punctuation in a portable way.
    """
    norm_make = _norm(listing.make)
    norm_model = _norm(listing.model)

    if not norm_make or not norm_model:
        return []

    price_band = _price_band(listing.price_lkr)
    mileage_band = _mileage_band(listing.mileage)

    filters = [
        CarListing.id != listing.id,
        CarListing.source != listing.source,
        CarListing.is_duplicate == False,  # noqa: E712
    ]

    # Year — exact match (NULL == NULL treated as match)
    if listing.year is not None:
        filters.append(CarListing.year == listing.year)
    else:
        filters.append(CarListing.year.is_(None))

    # Price — within band, or both NULL
    if price_band is not None:
        low_p, high_p = price_band
        filters.append(CarListing.price_lkr.between(low_p, high_p))
    else:
        filters.append(CarListing.price_lkr.is_(None))

    # Mileage — within band OR candidate mileage is NULL; skip filter when
    # listing mileage itself is NULL (any mileage is acceptable)
    if mileage_band is not None:
        low_m, high_m = mileage_band
        filters.append(
            or_(
                CarListing.mileage.is_(None),
                CarListing.mileage.between(low_m, high_m),
            )
        )

    # Over-fetch so the in-Python normalisation pass can still return *limit*.
    rows: list[CarListing] = (
        db.query(CarListing)
        .filter(and_(*filters))
        .limit(limit * 20)
        .all()
    )

    results = [
        r for r in rows if _norm(r.make) == norm_make and _norm(r.model) == norm_model
    ]
    return results[:limit]


def mark_duplicates_batch(db: Session, batch_size: int = 1000) -> int:
    """Scan all non-duplicate listings in ascending id order and flag the
    lower-id record as ``is_duplicate=True`` when a cross-source duplicate pair
    is detected.

    Convention: the *higher*-id record is the canonical listing; the *lower*-id
    record (the one inserted later with a higher id is actually the newer
    scrape) is marked as the duplicate, because we want to keep the earliest
    ingested record as the source of truth.

    Returns the number of listings newly marked as duplicates.
    """
    total_marked = 0
    last_id = 0

    while True:
        batch: list[CarListing] = (
            db.query(CarListing)
            .filter(
                CarListing.id > last_id,
                CarListing.is_duplicate == False,  # noqa: E712
            )
            .order_by(CarListing.id.asc())
            .limit(batch_size)
            .all()
        )
        if not batch:
            break

        for listing in batch:
            last_id = int(listing.id)

            candidates = find_duplicate_candidates(db, listing, limit=1)
            if not candidates:
                continue

            canonical = candidates[0]

            # Determine which record is lower-id (the "duplicate" to flag).
            if int(listing.id) < int(canonical.id):
                lower, higher = listing, canonical
            else:
                lower, higher = canonical, listing

            # Guard against re-flagging within the same batch (autoflush=False).
            if lower.is_duplicate:
                continue

            lower.is_duplicate = True
            lower.duplicate_of = int(higher.id)
            total_marked += 1

            log.info(
                "duplicate_flagged",
                duplicate_id=int(lower.id),
                canonical_id=int(higher.id),
                source_duplicate=lower.source,
                source_canonical=higher.source,
                make=lower.make,
                model=lower.model,
                year=lower.year,
            )

        db.commit()

    log.info("dedup_batch_complete", total_marked=total_marked)
    return total_marked
