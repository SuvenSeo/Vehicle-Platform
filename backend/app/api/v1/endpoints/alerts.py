from datetime import datetime, timezone
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import (
    _extract_token,
    resolve_live_session,
    verify_token,
)
from app.models.schemas import (
    AlertMatchListing,
    AlertMatchResponse,
    AlertMatchResult,
    MarketAlertCreate,
    MarketAlertRead,
)
from app.services.rate_limit import RateLimiter
from app.utils.plan_limits import FREE_ALERTS_LIMIT, PRO_ALERTS_LIMIT, is_free_browse_plan
from db.models import CarListing, MarketAlert, live_listing_filter
from db.session import get_db

MATCH_LIMIT_PER_ALERT = 5
# Back-compat alias for older tests/docs.
MAX_ALERTS_PER_TOKEN = PRO_ALERTS_LIMIT

_alerts_rate_limiter = RateLimiter(max_requests=60, window_seconds=60)

router = APIRouter(dependencies=[Depends(_alerts_rate_limiter)])


def _validate_token(token: object) -> str:
    if not isinstance(token, str):
        raise HTTPException(status_code=400, detail="Invalid alert token")
    token = token.strip()
    if not token or len(token) > 64:
        raise HTTPException(status_code=400, detail="Invalid alert token")
    return token


def _account_alert_token(email: str) -> str:
    # Stable, account-scoped token so alerts follow the Motormila user, not a random browser UUID.
    return f"mm:{email.strip().lower()}"


def _optional_str(value: object) -> Optional[str]:
    return value if isinstance(value, str) else None


def _resolve_alert_identity(
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
    return _validate_token(alert_token), None


def _max_alerts_for(live: Optional[dict]) -> int:
    if live is None:
        return PRO_ALERTS_LIMIT
    if is_free_browse_plan(live.get("plan"), role=live.get("role")):
        return FREE_ALERTS_LIMIT
    return PRO_ALERTS_LIMIT


@router.post("", response_model=MarketAlertRead, status_code=201)
def create_alert(
    payload: MarketAlertCreate,
    request: Request,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
    x_alert_token: Optional[str] = Header(default=None, alias="X-Alert-Token"),
):
    token, live = _resolve_alert_identity(request, authorization, x_alert_token, db)
    max_alerts = _max_alerts_for(live)
    active_count = (
        db.query(MarketAlert)
        .filter(MarketAlert.user_token == token, MarketAlert.active.is_(True))
        .count()
    )
    if active_count >= max_alerts:
        raise HTTPException(
            status_code=429,
            detail=f"Maximum {max_alerts} active alerts reached for this account.",
        )

    notify_phone = (payload.notify_phone or "").strip() or None
    # WhatsApp notify is a Pro surface — reject free-plan attempts even if the
    # client bypasses the UI and posts notify_phone directly.
    if notify_phone and live is not None and is_free_browse_plan(live.get("plan"), role=live.get("role")):
        raise HTTPException(
            status_code=403,
            detail="WhatsApp alert notifications require a Pro plan.",
        )

    alert = MarketAlert(
        user_token=token,
        make=(payload.make or "").strip() or None,
        model=(payload.model or "").strip() or None,
        max_price=payload.max_price if payload.max_price and payload.max_price > 0 else None,
        district=(payload.district or "").strip() or None,
        notify_phone=notify_phone,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.get("", response_model=List[MarketAlertRead])
def list_alerts(
    request: Request,
    db: Session = Depends(get_db),
    token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
    x_alert_token: Optional[str] = Header(default=None, alias="X-Alert-Token"),
):
    owner, _live = _resolve_alert_identity(
        request, authorization, _optional_str(x_alert_token) or _optional_str(token), db
    )
    return (
        db.query(MarketAlert)
        .filter(MarketAlert.user_token == owner, MarketAlert.active.is_(True))
        .order_by(MarketAlert.created_at.desc())
        .all()
    )


@router.delete("/{alert_id}", status_code=204)
def delete_alert(
    alert_id: int,
    request: Request,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
    x_alert_token: Optional[str] = Header(default=None, alias="X-Alert-Token"),
):
    owner, _live = _resolve_alert_identity(request, authorization, x_alert_token, db)
    alert = (
        db.query(MarketAlert)
        .filter(MarketAlert.id == alert_id, MarketAlert.user_token == owner)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.active = False
    db.commit()


@router.post("/match", response_model=AlertMatchResponse)
def match_alerts(
    request: Request,
    db: Session = Depends(get_db),
    token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
    x_alert_token: Optional[str] = Header(default=None, alias="X-Alert-Token"),
):
    owner, _live = _resolve_alert_identity(
        request, authorization, _optional_str(x_alert_token) or _optional_str(token), db
    )
    alerts = (
        db.query(MarketAlert)
        .filter(MarketAlert.user_token == owner, MarketAlert.active.is_(True))
        .all()
    )

    results: List[AlertMatchResult] = []
    for alert in alerts:
        q = db.query(CarListing).filter(live_listing_filter())

        if alert.make:
            q = q.filter(CarListing.make.ilike(alert.make))
        if alert.model:
            q = q.filter(CarListing.model.ilike(alert.model))
        if alert.district:
            q = q.filter(CarListing.district.ilike(alert.district))
        if alert.max_price:
            q = q.filter(CarListing.price_lkr <= alert.max_price)

        matching_count = q.count()
        top_listings = (
            q.order_by(CarListing.deal_score.desc())
            .limit(MATCH_LIMIT_PER_ALERT)
            .all()
        )
        results.append(
            AlertMatchResult(
                alert_id=alert.id,
                make=alert.make,
                model=alert.model,
                district=alert.district,
                max_price=float(alert.max_price) if alert.max_price is not None else None,
                matching_count=matching_count,
                listings=[
                    AlertMatchListing(
                        id=row.id,
                        title=row.title,
                        make=row.make,
                        model=row.model,
                        year=row.year,
                        price_lkr=float(row.price_lkr) if row.price_lkr is not None else None,
                        district=row.district,
                        deal_score=float(row.deal_score) if row.deal_score is not None else None,
                        thumbnail_url=row.thumbnail_url,
                    )
                    for row in top_listings
                ],
            )
        )

    return AlertMatchResponse(results=results, checked_at=datetime.now(timezone.utc))
