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
    return event
