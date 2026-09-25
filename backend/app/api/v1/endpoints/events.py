from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.models.schemas import AnalyticsEventCreate, AnalyticsEventRead
from app.services.rate_limit import RateLimiter
from db.models import AnalyticsEvent
from db.session import get_db

router = APIRouter()

# Tight rate limit: 60 events/min per client. Public endpoint used for funnel
# tracking (page views from anonymous users), so no auth required.
_events_rate_limiter = RateLimiter(
    max_requests=60,
    window_seconds=60,
    message="Too many analytics events. Try again shortly.",
)


@router.post("", response_model=AnalyticsEventRead, status_code=201)
def record_event(
    payload: AnalyticsEventCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    _events_rate_limiter(request)
    event = AnalyticsEvent(
        event=payload.event.strip(),
        properties=payload.properties or None,
        session_id=(payload.session_id or "").strip()[:64] or None,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    # Minimal product-signal nudges (saved search / listing view / alert
    # create -> price-drop / back-in-stock in-app nudges). Fail-open.
    try:
        _maybe_emit_nudge(db, event_name=event.event, properties=payload.properties)
    except Exception:
        pass
    return event


_NUDGE_EVENTS = frozenset({"saved_search", "listing_view", "alert_created"})


def _nudge_token(properties: object) -> Optional[str]:
    if not isinstance(properties, dict):
        return None
    for key in ("user_token", "alert_token", "token", "owner_token"):
        value = properties.get(key)
        if isinstance(value, str) and value.strip() and len(value.strip()) <= 64:
            return value.strip()
    return None


def _maybe_emit_nudge(db: Session, *, event_name: str, properties: object):
    """Create a lightweight in-app nudge for key product signals.

    - alert_created / saved_search -> "watch armed" confirmation nudge.
    - listing_view with price_drop/back_in_stock flags -> price-drop nudge.
    Deduped via notification_delivery_log (alert:listing:inapp); always
    fail-open to a plain in-app row when the log table is unavailable.
    """
    name = str(event_name or "").strip()
    if name not in _NUDGE_EVENTS:
        return None
    props = properties if isinstance(properties, dict) else {}
    token = _nudge_token(props)
    if not token:
        return None

    listing_id = props.get("listing_id") if isinstance(props, dict) else None
    try:
        listing_id_int = int(listing_id) if listing_id is not None else 0
    except (TypeError, ValueError):
        listing_id_int = 0

    if name == "listing_view":
        is_drop = bool(props.get("price_drop") or props.get("price_drop_pct"))
        is_back = bool(props.get("back_in_stock") or props.get("is_back"))
        if not (is_drop or is_back):
            return None
        title = "Price drop on a car you viewed" if is_drop else "Back in stock: a car you viewed"
        body = str(props.get("nudge_body") or "Tap to see the latest price.")[:300]
        link = f"/listing/{listing_id_int}" if listing_id_int else "/alerts"
    else:
        label = str(props.get("label") or props.get("make") or "your search").strip()[:80]
        title = f"Watch armed for {label}" if label else "Watch armed"
        body = "We'll ping your channels when new matches land. In-app always delivers."
        link = "/alerts"

    try:
        from app.utils.channel_center import check_and_record_delivery, dedupe_key
        from db.models import UserNotification

        key = dedupe_key(f"nudge-{name}", listing_id_int, "inapp")
        if not check_and_record_delivery(
            db, key=key, alert_id=None, listing_id=listing_id_int or None,
            channel="inapp", status="sent",
        ):
            return None
        notif = UserNotification(
            user_token=token,
            title=title[:200],
            body=body,
            link=link,
            read=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(notif)
        db.commit()
        return notif
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        return None
