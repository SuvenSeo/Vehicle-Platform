from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.models.schemas import (
    AlertMatchListing,
    AlertMatchResponse,
    AlertMatchResult,
    MarketAlertCreate,
    MarketAlertRead,
)
from app.services.rate_limit import RateLimiter
from db.models import CarListing, MarketAlert, live_listing_filter
from db.session import get_db

MAX_ALERTS_PER_TOKEN = 20
MATCH_LIMIT_PER_ALERT = 5

_alerts_rate_limiter = RateLimiter(max_requests=60, window_seconds=60)

router = APIRouter(dependencies=[Depends(_alerts_rate_limiter)])


def _validate_token(token: str) -> str:
    token = token.strip()
    if not token or len(token) > 36:
        raise HTTPException(status_code=400, detail="Invalid alert token")
    return token


@router.post("", response_model=MarketAlertRead, status_code=201)
def create_alert(
    payload: MarketAlertCreate,
    x_alert_token: str = Header(..., alias="X-Alert-Token"),
    db: Session = Depends(get_db),
):
    token = _validate_token(x_alert_token)
    active_count = (
        db.query(MarketAlert)
        .filter(MarketAlert.user_token == token, MarketAlert.active.is_(True))
        .count()
    )
    if active_count >= MAX_ALERTS_PER_TOKEN:
        raise HTTPException(
            status_code=429,
            detail=f"Maximum {MAX_ALERTS_PER_TOKEN} active alerts per token reached.",
        )

    alert = MarketAlert(
        user_token=token,
        make=(payload.make or "").strip() or None,
        model=(payload.model or "").strip() or None,
        max_price=payload.max_price if payload.max_price and payload.max_price > 0 else None,
        district=(payload.district or "").strip() or None,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.get("", response_model=List[MarketAlertRead])
def list_alerts(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    validated = _validate_token(token)
    return (
        db.query(MarketAlert)
        .filter(MarketAlert.user_token == validated, MarketAlert.active.is_(True))
        .order_by(MarketAlert.created_at.desc())
        .all()
    )


@router.delete("/{alert_id}", status_code=204)
def delete_alert(
    alert_id: int,
    x_alert_token: str = Header(..., alias="X-Alert-Token"),
    db: Session = Depends(get_db),
):
    token = _validate_token(x_alert_token)
    alert = (
        db.query(MarketAlert)
        .filter(MarketAlert.id == alert_id, MarketAlert.user_token == token)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.active = False
    db.commit()


@router.post("/match", response_model=AlertMatchResponse)
def match_alerts(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    validated = _validate_token(token)
    alerts = (
        db.query(MarketAlert)
        .filter(MarketAlert.user_token == validated, MarketAlert.active.is_(True))
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
                        id=listing.id,
                        title=listing.title,
                        make=listing.make,
                        model=listing.model,
                        year=listing.year,
                        price_lkr=float(listing.price_lkr) if listing.price_lkr is not None else None,
                        district=listing.district,
                        deal_score=float(listing.deal_score) if listing.deal_score is not None else None,
                        thumbnail_url=listing.thumbnail_url,
                    )
                    for listing in top_listings
                ],
            )
        )

    return AlertMatchResponse(results=results, checked_at=datetime.now(timezone.utc))
