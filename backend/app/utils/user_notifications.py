"""Helpers for creating in-app user notifications from alert matches."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.utils.notify_whatsapp import build_alert_match_message
from db.models import UserNotification


def record_alert_match_notification(
    db: Session,
    *,
    user_token: str,
    make: Optional[str],
    model: Optional[str],
    district: Optional[str],
    max_price: Optional[float],
    new_match_count: int,
) -> Optional[UserNotification]:
    """Create a UserNotification row for a new alert match.

    Called from alert_matcher after each pass where match count increases.
    Returns the created notification or None if creation fails.
    """
    try:
        parts = []
        if make:
            parts.append(make)
        if model:
            parts.append(model)
        vehicle_label = " ".join(parts) if parts else "your search"

        title = f"{new_match_count} new match{'es' if new_match_count != 1 else ''} for {vehicle_label}"
        body = build_alert_match_message(
            make=make,
            model=model,
            district=district,
            max_price=max_price,
            match_count=new_match_count,
        )

        notif = UserNotification(
            user_token=user_token,
            title=title,
            body=body,
            link="/alerts",
            read=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(notif)
        return notif
    except Exception:
        return None
