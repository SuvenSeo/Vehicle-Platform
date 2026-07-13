"""Post-scrape alert match pass.

Iterates every active MarketAlert and counts matching CarListings.  Results
are logged via structlog and persisted in the MarketAlertMatch table (one row
per alert, upserted on each pass).

Usage::

    from app.utils.alert_matcher import run_alert_match_pass
    summary = run_alert_match_pass(db)
    # {"alerts_checked": 12, "total_matches": 47, "elapsed_seconds": 0.21}
"""

import time
from datetime import datetime, timezone

import structlog
from sqlalchemy.orm import Session

from db.models import CarListing, MarketAlert, MarketAlertMatch

log = structlog.get_logger()


def _count_matching(db: Session, alert: MarketAlert) -> int:
    """Return the number of live listings that satisfy *alert*'s filters."""
    q = db.query(CarListing).filter(CarListing.is_outlier.is_(False))
    if alert.make:
        q = q.filter(CarListing.make.ilike(alert.make))
    if alert.model:
        q = q.filter(CarListing.model.ilike(alert.model))
    if alert.district:
        q = q.filter(CarListing.district.ilike(alert.district))
    if alert.max_price:
        q = q.filter(CarListing.price_lkr <= alert.max_price)
    return int(q.count())


def run_alert_match_pass(db: Session) -> dict:
    """Check all active MarketAlerts and upsert MarketAlertMatch rows.

    For each active alert:
    - Count how many non-outlier CarListings match its filters.
    - Insert or update the corresponding MarketAlertMatch row.
    - Log the result at DEBUG level.

    A single commit is issued at the end of the pass; individual alert errors
    are caught and logged as warnings so one bad alert never aborts the rest.

    Returns a summary dict with keys:

    * ``alerts_checked``  – number of active alerts processed
    * ``total_matches``   – sum of ``match_count`` across all processed alerts
    * ``elapsed_seconds`` – wall-clock duration for the pass
    """
    t0 = time.monotonic()

    alerts: list[MarketAlert] = (
        db.query(MarketAlert)
        .filter(MarketAlert.active.is_(True))
        .all()
    )

    now = datetime.now(timezone.utc)
    total_matches = 0
    errors = 0

    for alert in alerts:
        try:
            count = _count_matching(db, alert)
            total_matches += count

            existing: MarketAlertMatch | None = (
                db.query(MarketAlertMatch)
                .filter(MarketAlertMatch.alert_id == alert.id)
                .first()
            )
            if existing is None:
                db.add(
                    MarketAlertMatch(
                        alert_id=alert.id,
                        match_count=count,
                        last_matched_at=now,
                    )
                )
            else:
                existing.match_count = count
                existing.last_matched_at = now

            log.debug(
                "alert_match",
                alert_id=alert.id,
                make=alert.make,
                model=alert.model,
                district=alert.district,
                match_count=count,
            )
        except Exception as exc:
            errors += 1
            log.warning("alert_match_error", alert_id=alert.id, error=str(exc))

    db.commit()

    elapsed = round(time.monotonic() - t0, 3)
    summary = {
        "alerts_checked": len(alerts),
        "total_matches": total_matches,
        "errors": errors,
        "elapsed_seconds": elapsed,
    }
    log.info("alert_match_pass_complete", **summary)
    return summary
