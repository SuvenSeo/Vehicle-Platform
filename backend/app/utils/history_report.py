"""Per-vehicle listing-history dossier — the "poor man's Carfax".

Sri Lanka has no damage/odometer registry, so the highest-value fraud
signals come from OUR longitudinal archive: how long an ad has run, how its
price moved, whether the same physical vehicle shows up in other ads, and
whether the odometer went BACKWARDS between sightings.

Identity is heuristic (spec-matched, no registration data), so matches are
labelled by confidence:
- "confirmed": linked by the nightly dedup pass (is_duplicate/duplicate_of)
- "likely":    same normalised make+model, exact year, mileage within 10%
               (price deliberately unconstrained — relistings change price)
"""

from __future__ import annotations

from datetime import datetime

import structlog
from sqlalchemy.orm import Session

from app.utils.deduplication import _norm
from app.utils.time import utc_now
from db.models import CarListing, VehiclePriceHistory

log = structlog.get_logger()

MILEAGE_MATCH_TOLERANCE = 0.10
# Odometer readings jitter between ads; only a drop beyond this is a red flag.
ODOMETER_DROP_THRESHOLD_KM = 5_000
LONG_MARKET_DAYS = 60
MAX_RELATED = 8


def _naive(dt: datetime | None) -> datetime | None:
    if dt is None or dt.tzinfo is None:
        return dt
    return dt.replace(tzinfo=None)


def _related_listings(db: Session, listing: CarListing) -> list[tuple[CarListing, str]]:
    """Return [(listing, confidence)] for ads that look like the same vehicle."""
    related: dict[int, tuple[CarListing, str]] = {}

    # Confirmed cluster from the nightly dedup pass.
    cluster_root = listing.duplicate_of or listing.id
    confirmed = (
        db.query(CarListing)
        .filter(
            CarListing.id != listing.id,
            (CarListing.duplicate_of == cluster_root) | (CarListing.id == cluster_root),
        )
        .all()
    )
    for row in confirmed:
        related[row.id] = (row, "confirmed")

    # Heuristic matches: same make+model+year+district. District is required
    # (and non-null) to control false positives — a 2019 Premio is common, but
    # a 2019 Premio in the SAME district is a plausible same-vehicle relist.
    # Mileage is deliberately NOT a hard filter: a relist changes price, and an
    # odometer rollback changes mileage — filtering on it would hide the fraud
    # signal we most want to surface.
    norm_make, norm_model = _norm(listing.make), _norm(listing.model)
    if norm_make and norm_model and listing.district:
        query = db.query(CarListing).filter(
            CarListing.id != listing.id,
            CarListing.year == listing.year,
            CarListing.district == listing.district,
        )
        for row in query.limit(200).all():
            if row.id in related:
                continue
            if _norm(row.make) == norm_make and _norm(row.model) == norm_model:
                related[row.id] = (row, "likely")

    ordered = sorted(
        related.values(),
        key=lambda pair: (pair[1] != "confirmed", _naive(pair[0].first_seen_at) or utc_now()),
    )
    return ordered[:MAX_RELATED]


def build_history_report(db: Session, listing: CarListing) -> dict:
    now = utc_now()
    first_seen = _naive(listing.first_seen_at)
    last_seen = _naive(listing.last_seen_at)
    days_on_market = max(0, (now - first_seen).days) if first_seen else None

    price_rows = (
        db.query(VehiclePriceHistory)
        .filter(VehiclePriceHistory.vehicle_id == listing.id)
        .order_by(VehiclePriceHistory.scraped_at.asc(), VehiclePriceHistory.id.asc())
        .all()
    )
    prices = [float(r.price_lkr) for r in price_rows]
    cuts = sum(1 for a, b in zip(prices, prices[1:]) if b < a)
    total_change_pct = (
        round((prices[-1] - prices[0]) / prices[0] * 100, 1) if len(prices) >= 2 and prices[0] > 0 else None
    )

    related = _related_listings(db, listing)

    flags: list[dict] = []

    # Odometer rollback: a LATER sighting (this ad or a related one) showing
    # meaningfully LOWER mileage than an earlier one.
    timeline = sorted(
        [listing, *[r for r, _c in related]],
        key=lambda l: _naive(l.first_seen_at) or now,
    )
    prev_mileage: int | None = None
    for row in timeline:
        if row.mileage is None or row.mileage <= 0:
            continue
        if prev_mileage is not None and row.mileage < prev_mileage - ODOMETER_DROP_THRESHOLD_KM:
            flags.append({
                "kind": "odometer_inconsistency",
                "severity": "high",
                "detail": (
                    f"A later ad shows {row.mileage:,} km — {prev_mileage - row.mileage:,} km LESS than an "
                    f"earlier sighting ({prev_mileage:,} km). Odometers only go up; verify the reading in person."
                ),
            })
            break
        prev_mileage = max(prev_mileage or 0, row.mileage)

    sources = {listing.source, *[r.source for r, _c in related]}
    if len(related) > 0 and len(sources) > 1:
        cheapest = min(
            [listing, *[r for r, _c in related]],
            key=lambda l: float(l.price_lkr) if l.price_lkr else float("inf"),
        )
        flags.append({
            "kind": "multi_listed",
            "severity": "info",
            "detail": (
                f"This vehicle appears in {len(related) + 1} ads across {len(sources)} sources. "
                + (f"Lowest ask: {float(cheapest.price_lkr):,.0f} LKR." if cheapest.price_lkr else "")
            ).strip(),
        })

    if days_on_market is not None and days_on_market >= LONG_MARKET_DAYS:
        flags.append({
            "kind": "long_market",
            "severity": "medium",
            "detail": f"Listed for {days_on_market} days — well beyond a typical sale window. Ask why it hasn't moved.",
        })

    if cuts >= 2:
        flags.append({
            "kind": "price_cut_streak",
            "severity": "info",
            "detail": f"Price cut {cuts} times since we started tracking ({total_change_pct}% overall) — seller motivation is trending up.",
        })

    if listing.is_active is False:
        flags.append({
            "kind": "possibly_sold",
            "severity": "medium",
            "detail": "No longer seen at its source — possibly sold or delisted.",
        })

    return {
        "listing_id": listing.id,
        "first_seen_at": listing.first_seen_at,
        "last_seen_at": listing.last_seen_at,
        "days_on_market": days_on_market,
        "is_active": bool(listing.is_active) if listing.is_active is not None else True,
        "price_points": [
            {"price_lkr": float(r.price_lkr), "scraped_at": r.scraped_at} for r in price_rows
        ],
        "price_cuts": cuts,
        "total_change_pct": total_change_pct,
        "related_listings": [
            {
                "id": r.id,
                "source": r.source,
                "title": r.title or f"{r.make} {r.model}",
                "price_lkr": float(r.price_lkr) if r.price_lkr is not None else None,
                "mileage": r.mileage,
                "first_seen_at": r.first_seen_at,
                "is_active": bool(r.is_active) if r.is_active is not None else True,
                "confidence": confidence,
            }
            for r, confidence in related
        ],
        "flags": flags,
        "disclaimer": (
            "Matches are spec-based (make, model, year, mileage) from public ads — "
            "AutoLens has no access to registration records. Verify identity via "
            "chassis number and DMT records before relying on this report."
        ),
    }
