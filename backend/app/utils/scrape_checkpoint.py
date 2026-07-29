"""Scrape checkpoint utilities for post-scrape data quality validation.

Usage in a per-source scrape loop::

    from app.utils.scrape_checkpoint import create_scrape_checkpoint, validate_post_scrape

    checkpoint = create_scrape_checkpoint(db, source="ikman")
    await scraper.scrape(max_pages=max_pages)
    warnings = validate_post_scrape(db, source="ikman", checkpoint=checkpoint)
    for w in warnings:
        log.warning("scrape_quality_warning", source="ikman", detail=w)

Warnings are advisory only — callers decide whether to abort or continue.
"""

from __future__ import annotations

from typing import Any

import structlog
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models import CarListing

log = structlog.get_logger()

MASS_DEACTIVATION_THRESHOLD = 0.50
PRICE_ANOMALY_THRESHOLD = 0.50


def create_scrape_checkpoint(db: Session, source: str) -> dict[str, Any]:
    """Snapshot active listing stats for *source* before a scrape run.

    Returns a dict with:
      - ``total_listings``: count of active, non-outlier listings
      - ``avg_price``: average price_lkr (None when no priced listings exist)
      - ``min_price``: minimum price_lkr (None when no priced listings exist)
      - ``max_price``: maximum price_lkr (None when no priced listings exist)
      - ``source``: the source key passed in
    """
    source_lower = source.strip().lower()
    row = (
        db.query(
            func.count(CarListing.id).label("total"),
            func.avg(CarListing.price_lkr).label("avg_price"),
            func.min(CarListing.price_lkr).label("min_price"),
            func.max(CarListing.price_lkr).label("max_price"),
        )
        .filter(
            func.lower(CarListing.source) == source_lower,
            CarListing.is_active == True,  # noqa: E712
            CarListing.is_outlier == False,  # noqa: E712
        )
        .one()
    )

    checkpoint: dict[str, Any] = {
        "source": source,
        "total_listings": int(row.total or 0),
        "avg_price": float(row.avg_price) if row.avg_price is not None else None,
        "min_price": float(row.min_price) if row.min_price is not None else None,
        "max_price": float(row.max_price) if row.max_price is not None else None,
    }
    log.info("scrape_checkpoint_created", **checkpoint)
    return checkpoint


def validate_post_scrape(
    db: Session,
    source: str,
    checkpoint: dict[str, Any],
) -> list[str]:
    """Compare current active listing stats against a pre-scrape checkpoint.

    Returns a list of human-readable warning strings. An empty list means
    everything looks healthy. Callers should log the warnings and decide
    whether to abort or continue; this function never raises.

    Checks performed:
    - **Mass deactivation**: active listing count dropped by more than 50 %.
    - **Price anomaly**: average price shifted by more than 50 % in either
      direction (a sudden wholesale replace with mis-priced rows, or a source
      returning garbage prices, shows up here).
    """
    warnings: list[str] = []

    try:
        after = create_scrape_checkpoint(db, source)
    except Exception as exc:
        log.warning("scrape_checkpoint_post_query_failed", source=source, error=str(exc))
        return [f"post-scrape checkpoint query failed: {exc}"]

    before_total = checkpoint.get("total_listings", 0)
    after_total = after["total_listings"]

    if before_total > 0:
        drop_fraction = (before_total - after_total) / before_total
        if drop_fraction > MASS_DEACTIVATION_THRESHOLD:
            msg = (
                f"mass deactivation detected for source '{source}': "
                f"listings dropped from {before_total} to {after_total} "
                f"({drop_fraction:.0%} reduction, threshold {MASS_DEACTIVATION_THRESHOLD:.0%})"
            )
            warnings.append(msg)
            log.warning(
                "scrape_mass_deactivation",
                source=source,
                before=before_total,
                after=after_total,
                drop_fraction=round(drop_fraction, 4),
            )

    before_avg = checkpoint.get("avg_price")
    after_avg = after["avg_price"]

    if before_avg is not None and before_avg > 0 and after_avg is not None:
        price_shift = abs(after_avg - before_avg) / before_avg
        if price_shift > PRICE_ANOMALY_THRESHOLD:
            direction = "increase" if after_avg > before_avg else "decrease"
            msg = (
                f"price anomaly detected for source '{source}': "
                f"average price {direction} from {before_avg:,.0f} to {after_avg:,.0f} LKR "
                f"({price_shift:.0%} shift, threshold {PRICE_ANOMALY_THRESHOLD:.0%})"
            )
            warnings.append(msg)
            log.warning(
                "scrape_price_anomaly",
                source=source,
                before_avg=round(before_avg, 2),
                after_avg=round(after_avg, 2),
                shift_fraction=round(price_shift, 4),
                direction=direction,
            )

    if not warnings:
        log.info(
            "scrape_checkpoint_validated_ok",
            source=source,
            before_total=before_total,
            after_total=after_total,
        )

    return warnings
