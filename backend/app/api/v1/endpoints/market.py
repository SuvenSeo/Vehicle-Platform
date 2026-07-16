from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.schemas import ImportPriceSnapshotRead, MarketSignalRead
from app.services.rate_limit import RateLimiter
from db.models import ImportPriceSnapshot, MarketSignal
from db.session import get_db

_market_rate_limiter = RateLimiter(max_requests=120, window_seconds=60)

router = APIRouter(dependencies=[Depends(_market_rate_limiter)])


@router.get("/signals", response_model=list[MarketSignalRead])
def get_market_signals(
    source: str | None = None,
    signal_type: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(MarketSignal)
    if source:
        query = query.filter(func.lower(MarketSignal.source) == source.strip().lower())
    if signal_type:
        query = query.filter(func.lower(MarketSignal.signal_type) == signal_type.strip().lower())
    return query.order_by(desc(MarketSignal.observed_at), desc(MarketSignal.id)).limit(limit).all()


@router.get("/import-prices", response_model=list[ImportPriceSnapshotRead])
def get_import_price_snapshots(
    source: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(ImportPriceSnapshot)
    if source:
        query = query.filter(func.lower(ImportPriceSnapshot.source) == source.strip().lower())
    return query.order_by(desc(ImportPriceSnapshot.observed_at), desc(ImportPriceSnapshot.id)).limit(limit).all()


@router.get("/summary", response_model=dict)
def get_market_signal_summary(db: Session = Depends(get_db)):
    signal_rows = (
        db.query(
            MarketSignal.source,
            MarketSignal.signal_type,
            func.count(MarketSignal.id).label("count"),
            func.max(MarketSignal.observed_at).label("latest_observed_at"),
        )
        .group_by(MarketSignal.source, MarketSignal.signal_type)
        .order_by(desc("latest_observed_at"))
        .all()
    )
    import_count = int(db.query(func.count(ImportPriceSnapshot.id)).scalar() or 0)
    latest_import = db.query(func.max(ImportPriceSnapshot.observed_at)).scalar()

    return {
        "signals": [
            {
                "source": str(row.source),
                "signal_type": str(row.signal_type),
                "count": int(row.count or 0),
                "latest_observed_at": row.latest_observed_at.isoformat() if row.latest_observed_at else None,
            }
            for row in signal_rows
        ],
        "import_price_snapshots": {
            "count": import_count,
            "latest_observed_at": latest_import.isoformat() if latest_import else None,
        },
    }
