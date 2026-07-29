from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.endpoints.alerts import _optional_str, _resolve_alert_identity
from app.models.schemas import UserNotificationRead
from app.services.rate_limit import RateLimiter
from db.models import UserNotification
from db.session import get_db

RECENT_NOTIFICATION_LIMIT = 20

_notifications_rate_limiter = RateLimiter(max_requests=120, window_seconds=60)

router = APIRouter(dependencies=[Depends(_notifications_rate_limiter)])


class NotificationsReadAllResponse(BaseModel):
    updated: int


@router.get("", response_model=List[UserNotificationRead])
def list_notifications(
    request: Request,
    db: Session = Depends(get_db),
    limit: int = Query(default=RECENT_NOTIFICATION_LIMIT, ge=1, le=50),
    token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
    x_alert_token: Optional[str] = Header(default=None, alias="X-Alert-Token"),
):
    recent_limit = limit if isinstance(limit, int) else RECENT_NOTIFICATION_LIMIT
    owner, _live = _resolve_alert_identity(
        request, authorization, _optional_str(x_alert_token) or _optional_str(token), db
    )
    return (
        db.query(UserNotification)
        .filter(UserNotification.user_token == owner)
        .order_by(UserNotification.created_at.desc(), UserNotification.id.desc())
        .limit(recent_limit)
        .all()
    )


@router.post("/{notification_id}/read", response_model=UserNotificationRead)
def mark_notification_read(
    notification_id: int,
    request: Request,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
    x_alert_token: Optional[str] = Header(default=None, alias="X-Alert-Token"),
):
    owner, _live = _resolve_alert_identity(request, authorization, x_alert_token, db)
    notification = (
        db.query(UserNotification)
        .filter(UserNotification.id == notification_id, UserNotification.user_token == owner)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
    return notification


@router.post("/read-all", response_model=NotificationsReadAllResponse)
def mark_all_notifications_read(
    request: Request,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
    x_alert_token: Optional[str] = Header(default=None, alias="X-Alert-Token"),
):
    owner, _live = _resolve_alert_identity(request, authorization, x_alert_token, db)
    now = datetime.now(timezone.utc)
    unread = (
        db.query(UserNotification)
        .filter(UserNotification.user_token == owner, UserNotification.read_at.is_(None))
        .all()
    )
    for notification in unread:
        notification.read_at = now
    if unread:
        db.commit()
    return NotificationsReadAllResponse(updated=len(unread))
