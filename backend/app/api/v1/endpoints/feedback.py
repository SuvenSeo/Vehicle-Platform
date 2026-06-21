import time

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.models.schemas import FeedbackCreate, FeedbackRead
from db.models import UserFeedback
from db.session import get_db

router = APIRouter()

ALLOWED_CATEGORIES = {"bug", "idea", "data", "ux", "general"}
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = 5
_RATE_LIMIT_BUCKETS: dict[str, list[float]] = {}


def _feedback_client_key(request: Request) -> str:
    forwarded_for = str(request.headers.get("x-forwarded-for") or "").split(",", 1)[0].strip()
    fly_client_ip = str(request.headers.get("fly-client-ip") or "").strip()
    client_host = getattr(getattr(request, "client", None), "host", None)
    ip = forwarded_for or fly_client_ip or str(client_host or "unknown")
    user_agent = str(request.headers.get("user-agent") or "unknown")[:120]
    return f"{ip}|{user_agent}"


def _enforce_feedback_rate_limit(request: Request, *, now: float | None = None) -> None:
    current = time.time() if now is None else now
    cutoff = current - RATE_LIMIT_WINDOW_SECONDS
    key = _feedback_client_key(request)

    hits = [item for item in _RATE_LIMIT_BUCKETS.get(key, []) if item >= cutoff]
    if len(hits) >= RATE_LIMIT_MAX_REQUESTS:
        _RATE_LIMIT_BUCKETS[key] = hits
        raise HTTPException(status_code=429, detail="Too many feedback submissions. Try again shortly.")

    hits.append(current)
    _RATE_LIMIT_BUCKETS[key] = hits

    stale_keys = [bucket_key for bucket_key, bucket_hits in _RATE_LIMIT_BUCKETS.items() if not any(item >= cutoff for item in bucket_hits)]
    for bucket_key in stale_keys[:100]:
        _RATE_LIMIT_BUCKETS.pop(bucket_key, None)


@router.post("", response_model=FeedbackRead, status_code=201)
def create_feedback(payload: FeedbackCreate, request: Request, db: Session = Depends(get_db)):
    _enforce_feedback_rate_limit(request)
    category = payload.category.strip().lower()
    if category not in ALLOWED_CATEGORIES:
        category = "general"

    feedback = UserFeedback(
        category=category,
        route=(payload.route or "").strip()[:500] or None,
        message=payload.message.strip(),
        email=(payload.email or "").strip()[:255] or None,
        user_agent=(request.headers.get("user-agent") or "").strip()[:500] or None,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback
