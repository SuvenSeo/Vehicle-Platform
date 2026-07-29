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

from db.models import CarListing, MarketAlert, MarketAlertMatch, UserNotification, live_listing_filter
from app.utils.notify_whatsapp import (
    build_alert_match_message,
    send_whatsapp_alert,
    whatsapp_notify_configured,
)

log = structlog.get_logger()


def _count_matching(db: Session, alert: MarketAlert) -> int:
    """Return the number of live listings that satisfy *alert*'s filters."""
    q = db.query(CarListing).filter(live_listing_filter())
    if alert.make:
        q = q.filter(CarListing.make.ilike(alert.make))
    if alert.model:
        q = q.filter(CarListing.model.ilike(alert.model))
    if alert.district:
        q = q.filter(CarListing.district.ilike(alert.district))
    if alert.max_price:
        q = q.filter(CarListing.price_lkr <= alert.max_price)
    return int(q.count())


def _notification_copy(alert: MarketAlert, delta: int) -> tuple[str, str]:
    label_parts = [part for part in [alert.make, alert.model] if part]
    label = " ".join(label_parts) if label_parts else "your saved search"
    where = f" in {alert.district}" if alert.district else ""
    budget = f" under Rs {int(alert.max_price):,}" if alert.max_price is not None else ""
    match_plural = "es" if delta != 1 else ""
    listing_plural = "s" if delta != 1 else ""
    title = f"{delta} new alert match{match_plural}"
    body = f"{label}{where}{budget} has {delta} new matching listing{listing_plural}."
    return title, body


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
    whatsapp_sent = 0
    notify_enabled = whatsapp_notify_configured()

    for alert in alerts:
        try:
            count = _count_matching(db, alert)
            total_matches += count

            existing: MarketAlertMatch | None = (
                db.query(MarketAlertMatch)
                .filter(MarketAlertMatch.alert_id == alert.id)
                .first()
            )
            previous_count = int(existing.match_count) if existing is not None else 0
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

            # Notify only when the match count increases (new inventory).
            if count > previous_count:
                delta = count - previous_count
                title, notification_body = _notification_copy(alert, delta)
                db.add(
                    UserNotification(
                        user_token=alert.user_token,
                        title=title,
                        body=notification_body,
                        href="/alerts",
                    )
                )

            # Keep WhatsApp behavior unchanged: it remains opt-in and config-gated.
            if (
                notify_enabled
                and alert.notify_phone
                and count > previous_count
            ):
                delta = count - previous_count
                body = build_alert_match_message(
                    make=alert.make,
                    model=alert.model,
                    district=alert.district,
                    max_price=float(alert.max_price) if alert.max_price is not None else None,
                    match_count=delta,
                )
                if send_whatsapp_alert(to_phone=str(alert.notify_phone), body=body):
                    whatsapp_sent += 1

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
        "whatsapp_sent": whatsapp_sent,
        "errors": errors,
        "elapsed_seconds": elapsed,
    }
    log.info("alert_match_pass_complete", **summary)
    return summary
