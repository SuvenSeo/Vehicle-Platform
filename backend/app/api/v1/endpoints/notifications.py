"""In-app notification endpoints.

Notifications are created by the alert matcher when new matches are found.
Each notification belongs to a user token (same identity as market alerts).
"""

from datetime import datetime, timezone
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import (
    _extract_token,
    resolve_live_session,
    verify_token,
)
from app.services.rate_limit import RateLimiter
from db.models import UserNotification
from db.session import get_db

_notif_rate_limiter = RateLimiter(max_requests=120, window_seconds=60)

router = APIRouter(dependencies=[Depends(_notif_rate_limiter)])

NOTIFICATION_LIST_LIMIT = 50


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_token: str
    title: str
    body: Optional[str]
    link: Optional[str]
    read: bool
    created_at: datetime


def _optional_str(value: object) -> Optional[str]:
    return value if isinstance(value, str) else None


def _account_alert_token(email: str) -> str:
    return f"mm:{email.strip().lower()}"


def _resolve_notification_identity(
    request: Optional[Request],
    authorization: Optional[str],
    x_alert_token: Optional[str],
    db: Session,
) -> Tuple[str, Optional[dict]]:
    """Prefer authenticated Motormila session; fall back to legacy X-Alert-Token."""
    token = _extract_token(_optional_str(authorization), request)
    payload = verify_token(token) if token else None
    if payload is not None:
        live = resolve_live_session(payload, db)
        return _account_alert_token(live["email"]), live

    alert_token = _optional_str(x_alert_token)
    if not alert_token:
        raise HTTPException(status_code=400, detail="Alert token or signed-in session required.")
    token_str = alert_token.strip()
    if not token_str or len(token_str) > 64:
        raise HTTPException(status_code=400, detail="Invalid alert token")
    return token_str, None


@router.get("", response_model=List[NotificationRead])
def list_notifications(
    request: Request,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
    x_alert_token: Optional[str] = Header(default=None, alias="X-Alert-Token"),
):
    owner, _live = _resolve_notification_identity(request, authorization, x_alert_token, db)
    return (
        db.query(UserNotification)
        .filter(UserNotification.user_token == owner)
        .order_by(UserNotification.created_at.desc())
        .limit(NOTIFICATION_LIST_LIMIT)
        .all()
    )


@router.post("/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(
    notification_id: int,
    request: Request,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
    x_alert_token: Optional[str] = Header(default=None, alias="X-Alert-Token"),
):
    owner, _live = _resolve_notification_identity(request, authorization, x_alert_token, db)
    notif = (
        db.query(UserNotification)
        .filter(UserNotification.id == notification_id, UserNotification.user_token == owner)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.post("/read-all", response_model=dict)
def mark_all_read(
    request: Request,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
    x_alert_token: Optional[str] = Header(default=None, alias="X-Alert-Token"),
):
    owner, _live = _resolve_notification_identity(request, authorization, x_alert_token, db)
    updated = (
        db.query(UserNotification)
        .filter(UserNotification.user_token == owner, UserNotification.read.is_(False))
        .update({"read": True})
    )
    db.commit()
    return {"marked_read": updated}


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
    from app.utils.notify_whatsapp import build_alert_match_message

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
