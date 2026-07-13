import asyncio
import json

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import case, func, desc, and_, or_
from typing import Optional
from datetime import datetime, timedelta, timezone
from app.utils.districts import (
    SL_DISTRICT_COORDS,
    count_canonical_districts,
    find_district_from_url,
    normalize_district_name,
)
from app.utils.pricing import build_district_median_map, median_from_values, median_price_for_listings
from app.utils.time import utc_now
from db.session import SessionLocal, get_db
from db.models import CarListing, PriceAggregate, ScrapeRun
from app.models.schemas import StatsSummary, DistrictPrice
from app.models.schemas import DashboardInsightsResponse, DistrictQuickInsightResponse
from app.services.rate_limit import RateLimiter

_stats_rate_limiter = RateLimiter(max_requests=300, window_seconds=60)

router = APIRouter(dependencies=[Depends(_stats_rate_limiter)])
MIN_REASONABLE_PRICE_LKR = 100_000
LIVE_STREAM_INTERVAL_SECONDS = 10
RECENT_SUCCESS_HOURS = 24

def _to_utc(dt):
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _is_running_scrape(run: ScrapeRun, now: datetime) -> bool:
    started_at = _to_utc(run.started_at)
    return (
        str(run.status or "").upper() == "RUNNING"
        and started_at is not None
        and run.finished_at is None
        and now - started_at <= timedelta(hours=6)
    )


def _is_recent_success(run: ScrapeRun, now: datetime) -> bool:
    finished_at = _to_utc(run.finished_at)
    return (
        str(run.status or "").upper() == "SUCCESS"
        and finished_at is not None
        and now - finished_at <= timedelta(hours=RECENT_SUCCESS_HOURS)
    )


def build_live_market_snapshot(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    priced_clause = and_(
        CarListing.is_outlier == False,
        CarListing.price_lkr.isnot(None),
        CarListing.price_lkr >= MIN_REASONABLE_PRICE_LKR,
    )
    listing_metrics = db.query(
        func.max(func.coalesce(CarListing.scraped_at, CarListing.last_seen_at, CarListing.first_seen_at)).label("latest_listing_at"),
        func.count(CarListing.id).label("total_listings"),
        func.sum(case((priced_clause, 1), else_=0)).label("priced_listings"),
        func.sum(
            case(
                (
                    and_(
                        CarListing.is_outlier == False,
                        or_(CarListing.price_lkr.is_(None), CarListing.price_lkr < MIN_REASONABLE_PRICE_LKR),
                    ),
                    1,
                ),
                else_=0,
            )
        ).label("unavailable_listings"),
        func.avg(case((priced_clause, CarListing.price_lkr), else_=None)).label("avg_price"),
    ).filter(CarListing.is_outlier == False).one()

    latest_listing_at = listing_metrics.latest_listing_at
    total_listings = int(listing_metrics.total_listings or 0)
    priced_listings = int(listing_metrics.priced_listings or 0)
    unavailable_listings = int(listing_metrics.unavailable_listings or 0)
    avg_price = listing_metrics.avg_price

    recent_runs = (
        db.query(ScrapeRun)
        .order_by(desc(ScrapeRun.started_at))
        .limit(100)
        .all()
    )
    latest_by_source: dict[str, ScrapeRun] = {}
    active_sources: set[str] = set()
    for run in recent_runs:
        source = str(run.source or "unknown")
        if source not in latest_by_source:
            latest_by_source[source] = run
        if _is_running_scrape(run, now):
            active_sources.add(source)

    for source, run in latest_by_source.items():
        if _is_recent_success(run, now):
            active_sources.add(source)

    latest_run = recent_runs[0] if recent_runs else None
    return {
        "generated_at": now.isoformat(),
        "total_listings": int(total_listings),
        "priced_listings": int(priced_listings),
        "unavailable_price_listings": int(unavailable_listings),
        "avg_price_lkr": round(float(avg_price), 2) if avg_price is not None else None,
        "latest_listing_at": _to_utc(latest_listing_at).isoformat() if latest_listing_at else None,
        "active_scrape_sources": sorted(active_sources),
        "latest_run": {
            "source": str(latest_run.source or "unknown"),
            "status": str(latest_run.status or "UNKNOWN"),
            "started_at": _to_utc(latest_run.started_at).isoformat() if latest_run and latest_run.started_at else None,
            "finished_at": _to_utc(latest_run.finished_at).isoformat() if latest_run and latest_run.finished_at else None,
            "listings_found": int(latest_run.listings_found or 0) if latest_run else 0,
            "listings_new": int(latest_run.listings_new or 0) if latest_run else 0,
            "error_message": (str(latest_run.error_message or "").strip()[:220] or None) if latest_run else None,
        } if latest_run else None,
        "source_status": [
            {
                "source": source,
                "status": str(run.status or "UNKNOWN"),
                "started_at": _to_utc(run.started_at).isoformat() if run.started_at else None,
                "finished_at": _to_utc(run.finished_at).isoformat() if run.finished_at else None,
                "listings_found": int(run.listings_found or 0),
                "listings_new": int(run.listings_new or 0),
            }
            for source, run in sorted(latest_by_source.items())
        ],
    }

@router.get("/summary", response_model=StatsSummary)
def get_stats_summary(db: Session = Depends(get_db)):
    seven_days_ago = utc_now() - timedelta(days=7)

    total = db.query(func.count(CarListing.id)).filter(CarListing.is_outlier == False).scalar() or 0
    avg_price = db.query(func.avg(CarListing.price_lkr)).filter(
        CarListing.is_outlier == False, CarListing.price_lkr.isnot(None)
    ).scalar()
    good_deals = db.query(func.count(CarListing.id)).filter(
        CarListing.deal_score >= 20, CarListing.is_outlier == False
    ).scalar() or 0
    this_week = db.query(func.count(CarListing.id)).filter(
        CarListing.first_seen_at >= seven_days_ago
    ).scalar() or 0
    districts = count_canonical_districts(
        db.query(CarListing).filter(CarListing.district.isnot(None))
    )
    source_count = db.query(func.count(func.distinct(CarListing.source))).filter(
        CarListing.is_outlier == False,
        CarListing.source.isnot(None),
    ).scalar() or 0
    last_updated = db.query(
        func.max(func.coalesce(CarListing.scraped_at, CarListing.last_seen_at, CarListing.first_seen_at))
    ).filter(
        CarListing.is_outlier == False
    ).scalar()

    # MoM price change from aggregates
    price_change_mom = None
    now = utc_now()
    cur_y, cur_m = now.year, now.month
    prev_m, prev_y = (cur_m - 1, cur_y) if cur_m > 1 else (12, cur_y - 1)
    cur_avg = db.query(func.avg(PriceAggregate.avg_price_lkr)).filter(
        PriceAggregate.period_year == cur_y, PriceAggregate.period_month == cur_m
    ).scalar()
    prev_avg = db.query(func.avg(PriceAggregate.avg_price_lkr)).filter(
        PriceAggregate.period_year == prev_y, PriceAggregate.period_month == prev_m
    ).scalar()
    if cur_avg and prev_avg and float(prev_avg) > 0:
        price_change_mom = round(((float(cur_avg) - float(prev_avg)) / float(prev_avg)) * 100, 1)

    return StatsSummary(
        total_listings=total,
        avg_price_lkr=float(avg_price) if avg_price else None,
        price_change_mom=price_change_mom,
        good_deals_count=good_deals,
        listings_this_week=this_week,
        districts_covered=districts,
        district_count=int(districts),
        source_count=int(source_count),
        last_updated=last_updated,
    )


@router.get("/live", response_model=dict)
def get_live_market_snapshot(db: Session = Depends(get_db)):
    return build_live_market_snapshot(db)


@router.get("/live/stream")
async def stream_live_market_snapshot(request: Request):
    async def events():
        while True:
            if await request.is_disconnected():
                break

            db = SessionLocal()
            try:
                snapshot = build_live_market_snapshot(db)
            finally:
                db.close()

            yield f"event: snapshot\ndata: {json.dumps(snapshot)}\n\n"
            await asyncio.sleep(LIVE_STREAM_INTERVAL_SECONDS)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@router.get("/district-prices")
def get_district_prices(db: Session = Depends(get_db)):
    median_by_district = build_district_median_map(db)
    results = (
        db.query(
            CarListing.district,
            func.count(CarListing.id).label("count"),
            func.avg(CarListing.price_lkr).label("avg_price"),
        )
        .filter(
            CarListing.district.isnot(None),
            CarListing.price_lkr.isnot(None),
            CarListing.is_outlier == False,
        )
        .group_by(CarListing.district)
        .order_by(desc("count"))
        .all()
    )

    points = []
    inferred_mode = (
        len(results) <= 1
        and len(results) > 0
        and str(results[0][0] or "").strip().lower() == "sri lanka"
    )

    if inferred_mode:
        rows = (
            db.query(CarListing.district, CarListing.url, CarListing.price_lkr, CarListing.make, CarListing.model)
            .filter(
                CarListing.price_lkr.isnot(None),
                CarListing.is_outlier == False,
            )
            .all()
        )

        agg = {}
        for district, url, price, make, model in rows:
            normalized = normalize_district_name(district)
            if normalized == "Sri Lanka" or normalized is None:
                normalized = find_district_from_url(url)
            if not normalized:
                continue
            item = agg.setdefault(normalized, {"count": 0, "total": 0.0, "model_counts": {}, "prices": []})
            item["count"] += 1
            item["total"] += float(price)
            item["prices"].append(float(price))
            make_model = f"{str(make or '').strip()} {str(model or '').strip()}".strip()
            if make_model:
                item["model_counts"][make_model] = item["model_counts"].get(make_model, 0) + 1

        for district, values in agg.items():
            coords = SL_DISTRICT_COORDS.get(district)
            if not coords or values["count"] <= 0:
                continue
            avg_price = values["total"] / values["count"]
            district_median = median_from_values(values["prices"]) or avg_price
            top_model_name = None
            top_model_count = None
            if values["model_counts"]:
                top_model_name, top_model_count = sorted(
                    values["model_counts"].items(),
                    key=lambda item: item[1],
                    reverse=True,
                )[0]
            top_make = None
            top_model = None
            if top_model_name:
                parts = top_model_name.split(" ", 1)
                top_make = parts[0] if parts else None
                top_model = parts[1] if len(parts) > 1 else None

            points.append(
                {
                    "district": district,
                    "lat": coords[0],
                    "lng": coords[1],
                    "count": values["count"],
                    "avg_price_lkr": round(float(avg_price), 2),
                    "median_price_lkr": round(float(district_median), 2),
                    "top_make": top_make,
                    "top_model": top_model,
                    "top_model_count": int(top_model_count) if top_model_count else None,
                }
            )
        points.sort(key=lambda p: p["count"], reverse=True)
        return {"points": points}

    model_results = (
        db.query(
            CarListing.district,
            CarListing.make,
            CarListing.model,
            func.count(CarListing.id).label("model_count"),
        )
        .filter(
            CarListing.district.isnot(None),
            CarListing.make.isnot(None),
            CarListing.model.isnot(None),
            CarListing.is_outlier == False,
        )
        .group_by(CarListing.district, CarListing.make, CarListing.model)
        .all()
    )

    top_model_by_district = {}
    for district, make, model, model_count in model_results:
        normalized = normalize_district_name(district)
        if not normalized:
            continue
        current = top_model_by_district.get(normalized)
        count_int = int(model_count or 0)
        if current is None or count_int > current["count"]:
            top_model_by_district[normalized] = {
                "make": str(make),
                "model": str(model),
                "count": count_int,
            }

    for district, count, avg_price in results:
        normalized = normalize_district_name(district)
        if not normalized:
            continue
        coords = SL_DISTRICT_COORDS.get(normalized)
        if coords and avg_price:
            top = top_model_by_district.get(normalized)
            district_median = median_by_district.get(normalized, float(avg_price))
            points.append({
                "district": normalized,
                "lat": coords[0],
                "lng": coords[1],
                "count": count,
                "avg_price_lkr": round(float(avg_price), 2),
                "median_price_lkr": round(float(district_median), 2),
                "top_make": top["make"] if top else None,
                "top_model": top["model"] if top else None,
                "top_model_count": top["count"] if top else None,
            })
    return {"points": points}

def _trend_response(points, scope: str, note: Optional[str] = None) -> dict:
    return {
        "points": points,
        "coverage_scope": scope,
        "coverage_note": note,
    }


def _aggregate_trend_points(
    db: Session,
    start_year: int,
    start_month: int,
    make_lower: Optional[str],
    model_lower: Optional[str],
    district_lower: Optional[str],
) -> list[dict]:
    q = db.query(
        PriceAggregate.period_year,
        PriceAggregate.period_month,
        func.avg(PriceAggregate.avg_price_lkr).label("avg"),
        func.avg(PriceAggregate.median_price_lkr).label("median"),
        func.sum(PriceAggregate.listing_count).label("count"),
    )
    if make_lower:
        q = q.filter(func.lower(PriceAggregate.make) == make_lower)
    if model_lower:
        q = q.filter(func.lower(PriceAggregate.model) == model_lower)
    if district_lower:
        q = q.filter(func.lower(PriceAggregate.district) == district_lower)
    q = q.filter(
        (PriceAggregate.period_year * 100 + PriceAggregate.period_month)
        >= (start_year * 100 + start_month)
    )

    rows = (
        q.group_by(PriceAggregate.period_year, PriceAggregate.period_month)
        .order_by(PriceAggregate.period_year, PriceAggregate.period_month)
        .all()
    )

    return [
        {
            "year": row.period_year,
            "month": row.period_month,
            "avg_price_lkr": round(float(row.avg), 2) if row.avg else None,
            "median_price_lkr": round(float(row.median), 2) if row.median else None,
            "listing_count": int(row.count or 0),
        }
        for row in rows
    ]


def _listing_trend_points(
    db: Session,
    start_date: Optional[datetime],
    start_year: int,
    start_month: int,
    make_lower: Optional[str],
    model_lower: Optional[str],
    condition_lower: Optional[str],
    district_lower: Optional[str],
) -> list[dict]:
    event_ts = func.coalesce(CarListing.first_seen_at, CarListing.scraped_at, CarListing.last_seen_at)
    period_expr = func.strftime("%Y-%m", event_ts)
    dialect = db.bind.dialect.name if db.bind and db.bind.dialect else ""
    if dialect != "sqlite":
        period_expr = func.to_char(event_ts, "YYYY-MM")

    listing_q = db.query(
        period_expr.label("period"),
        func.avg(CarListing.price_lkr).label("avg"),
        func.avg(CarListing.price_lkr).label("median"),
        func.count(CarListing.id).label("count"),
    ).filter(
        CarListing.is_outlier == False,
        CarListing.price_lkr.isnot(None),
        CarListing.price_lkr >= MIN_REASONABLE_PRICE_LKR,
        event_ts.isnot(None),
    )
    if start_date is not None:
        listing_q = listing_q.filter(event_ts >= start_date)
    if make_lower:
        listing_q = listing_q.filter(func.lower(CarListing.make) == make_lower)
    if model_lower:
        listing_q = listing_q.filter(func.lower(CarListing.model) == model_lower)
    if condition_lower:
        listing_q = listing_q.filter(func.lower(CarListing.condition) == condition_lower)
    if district_lower:
        listing_q = listing_q.filter(func.lower(CarListing.district) == district_lower)

    rows = listing_q.group_by(period_expr).order_by(period_expr).all()
    points = []
    for row in rows:
        period = str(row.period or "")
        if not period or len(period) < 7:
            continue

        year = int(period[0:4])
        month = int(period[5:7])
        if start_date is not None and (year * 100 + month) < (start_year * 100 + start_month):
            continue

        points.append(
            {
                "year": year,
                "month": month,
                "avg_price_lkr": round(float(row.avg), 2) if row.avg else None,
                "median_price_lkr": round(float(row.median), 2) if row.median else None,
                "listing_count": int(row.count or 0),
            }
        )
    return points


def _current_snapshot_point(
    db: Session,
    now: datetime,
    make_lower: Optional[str],
    model_lower: Optional[str],
    condition_lower: Optional[str],
    district_lower: Optional[str],
) -> list[dict]:
    q = db.query(
        func.avg(CarListing.price_lkr).label("avg"),
        func.count(CarListing.id).label("count"),
    ).filter(
        CarListing.is_outlier == False,
        CarListing.price_lkr.isnot(None),
        CarListing.price_lkr >= MIN_REASONABLE_PRICE_LKR,
    )
    if make_lower:
        q = q.filter(func.lower(CarListing.make) == make_lower)
    if model_lower:
        q = q.filter(func.lower(CarListing.model) == model_lower)
    if condition_lower:
        q = q.filter(func.lower(CarListing.condition) == condition_lower)
    if district_lower:
        q = q.filter(func.lower(CarListing.district) == district_lower)

    row = q.first()
    if not row or not row.count:
        return []

    avg = round(float(row.avg), 2) if row.avg else None
    return [
        {
            "year": now.year,
            "month": now.month,
            "avg_price_lkr": avg,
            "median_price_lkr": avg,
            "listing_count": int(row.count or 0),
        }
    ]


@router.get("/trends")
def get_price_trends(
    make: Optional[str] = None,
    model: Optional[str] = None,
    condition: Optional[str] = None,
    district: Optional[str] = None,
    months: int = Query(12, ge=3, le=24),
    db: Session = Depends(get_db),
):
    try:
        months_value = int(months)
    except (TypeError, ValueError):
        months_value = 12

    now = utc_now()
    start_year = now.year
    start_month = now.month - months_value
    while start_month <= 0:
        start_month += 12
        start_year -= 1

    start_date = datetime(start_year, start_month, 1)
    make_lower = make.strip().lower() if make else None
    model_lower = model.strip().lower() if model else None
    condition_lower = condition.strip().lower() if condition else None
    district_lower = district.strip().lower() if district else None

    aggregate_points = []
    if condition_lower is None:
        aggregate_points = _aggregate_trend_points(db, start_year, start_month, make_lower, model_lower, district_lower)
        if len(aggregate_points) >= 2:
            return _trend_response(aggregate_points, "exact")

    exact_points = _listing_trend_points(
        db,
        start_date,
        start_year,
        start_month,
        make_lower,
        model_lower,
        condition_lower,
        district_lower,
    )
    if len(exact_points) >= 2:
        return _trend_response(exact_points, "exact")

    if condition_lower:
        condition_relaxed_aggregate = _aggregate_trend_points(
            db, start_year, start_month, make_lower, model_lower, district_lower
        )
        if len(condition_relaxed_aggregate) >= 2:
            return _trend_response(
                condition_relaxed_aggregate,
                "condition_fallback",
                "Condition-specific samples are thin, so this chart shows the same vehicle lane across all conditions.",
            )

        condition_relaxed_listing = _listing_trend_points(
            db, start_date, start_year, start_month, make_lower, model_lower, None, district_lower
        )
        if len(condition_relaxed_listing) >= 2:
            return _trend_response(
                condition_relaxed_listing,
                "condition_fallback",
                "Condition-specific samples are thin, so this chart shows the same vehicle lane across all conditions.",
            )

    if district_lower:
        district_relaxed_aggregate = []
        if condition_lower is None:
            district_relaxed_aggregate = _aggregate_trend_points(db, start_year, start_month, make_lower, model_lower, None)
            if len(district_relaxed_aggregate) >= 2:
                return _trend_response(
                    district_relaxed_aggregate,
                    "district_fallback",
                    "District samples are thin, so this chart shows the Sri Lanka-wide trend for this vehicle lane.",
                )

        district_relaxed_listing = _listing_trend_points(
            db, start_date, start_year, start_month, make_lower, model_lower, condition_lower, None
        )
        if len(district_relaxed_listing) >= 2:
            return _trend_response(
                district_relaxed_listing,
                "district_fallback",
                "District samples are thin, so this chart shows the Sri Lanka-wide trend for this vehicle lane.",
            )

    if district_lower and condition_lower:
        national_aggregate = _aggregate_trend_points(db, start_year, start_month, make_lower, model_lower, None)
        if len(national_aggregate) >= 2:
            return _trend_response(
                national_aggregate,
                "national_fallback",
                "Exact district and condition samples are thin, so this chart shows the broader national lane.",
            )

        national_listing = _listing_trend_points(
            db, start_date, start_year, start_month, make_lower, model_lower, None, None
        )
        if len(national_listing) >= 2:
            return _trend_response(
                national_listing,
                "national_fallback",
                "Exact district and condition samples are thin, so this chart shows the broader national lane.",
            )

    if exact_points:
        return _trend_response(
            exact_points,
            "partial",
            "Only one recent monthly point is available for this selection. Showing the partial signal while more samples accumulate.",
        )
    if aggregate_points:
        return _trend_response(
            aggregate_points,
            "partial",
            "Only one recent monthly point is available for this selection. Showing the partial signal while more samples accumulate.",
        )

    snapshot_points = _current_snapshot_point(db, now, make_lower, model_lower, condition_lower, district_lower)
    if snapshot_points:
        return _trend_response(
            snapshot_points,
            "current_snapshot",
            "Historical trend samples are still building, so this chart shows the current matching market snapshot.",
        )

    if district_lower or condition_lower:
        broader_snapshot = _current_snapshot_point(db, now, make_lower, model_lower, None, None)
        if broader_snapshot:
            return _trend_response(
                broader_snapshot,
                "current_snapshot_fallback",
                "Exact samples are still building, so this chart shows the current broader national market snapshot.",
            )

    return _trend_response([], "none", "Trend samples are still being collected for this vehicle lane.")


@router.get("/insights", response_model=DashboardInsightsResponse)
def get_dashboard_insights(db: Session = Depends(get_db)):
    now = utc_now()
    day_ago = now - timedelta(hours=24)
    current_30d = now - timedelta(days=30)
    previous_30d = now - timedelta(days=60)

    new_listings_24h = (
        db.query(func.count(CarListing.id))
        .filter(
            CarListing.first_seen_at >= day_ago,
            CarListing.is_outlier == False,
        )
        .scalar()
        or 0
    )

    current_segments = (
        db.query(
            CarListing.body_type,
            func.count(CarListing.id).label("count"),
            func.avg(CarListing.price_lkr).label("avg_price"),
        )
        .filter(
            CarListing.body_type.isnot(None),
            CarListing.price_lkr.isnot(None),
            CarListing.scraped_at >= current_30d,
            CarListing.is_outlier == False,
        )
        .group_by(CarListing.body_type)
        .all()
    )

    previous_segments = (
        db.query(
            CarListing.body_type,
            func.avg(CarListing.price_lkr).label("avg_price"),
        )
        .filter(
            CarListing.body_type.isnot(None),
            CarListing.price_lkr.isnot(None),
            CarListing.scraped_at >= previous_30d,
            CarListing.scraped_at < current_30d,
            CarListing.is_outlier == False,
        )
        .group_by(CarListing.body_type)
        .all()
    )

    previous_segment_map = {
        str(row.body_type).lower(): float(row.avg_price)
        for row in previous_segments
        if row.body_type and row.avg_price
    }

    segment_performance = []
    for row in current_segments:
        if not row.body_type:
            continue

        current_avg = float(row.avg_price) if row.avg_price else 0.0
        previous_avg = previous_segment_map.get(str(row.body_type).lower())
        change_pct = None
        if previous_avg and previous_avg > 0:
            change_pct = round(((current_avg - previous_avg) / previous_avg) * 100, 1)

        segment_performance.append(
            {
                "segment": str(row.body_type).lower(),
                "listing_count": int(row.count or 0),
                "avg_price_lkr": round(current_avg, 2),
                "change_pct_30d": change_pct,
            }
        )

    segment_performance.sort(key=lambda item: item["listing_count"], reverse=True)
    segment_performance = segment_performance[:6]

    trending_models = (
        db.query(
            CarListing.make,
            CarListing.model,
            func.count(CarListing.id).label("count"),
            func.avg(CarListing.price_lkr).label("avg_price"),
            func.max(CarListing.thumbnail_url).label("thumbnail_url"),
        )
        .filter(
            CarListing.make.isnot(None),
            CarListing.model.isnot(None),
            CarListing.price_lkr.isnot(None),
            CarListing.scraped_at >= current_30d,
            CarListing.is_outlier == False,
        )
        .group_by(CarListing.make, CarListing.model)
        .order_by(desc("count"))
        .limit(6)
        .all()
    )

    previous_trending_models = (
        db.query(
            CarListing.make,
            CarListing.model,
            func.avg(CarListing.price_lkr).label("avg_price"),
        )
        .filter(
            CarListing.make.isnot(None),
            CarListing.model.isnot(None),
            CarListing.price_lkr.isnot(None),
            CarListing.scraped_at >= previous_30d,
            CarListing.scraped_at < current_30d,
            CarListing.is_outlier == False,
        )
        .group_by(CarListing.make, CarListing.model)
        .all()
    )

    previous_trending_map = {
        (str(row.make).lower(), str(row.model).lower()): float(row.avg_price)
        for row in previous_trending_models
        if row.make and row.model and row.avg_price
    }

    trending_payload = []
    for row in trending_models:
        current_avg = float(row.avg_price) if row.avg_price else 0.0
        previous_avg = previous_trending_map.get(
            (str(row.make).lower(), str(row.model).lower())
        )
        movement_pct = None
        if previous_avg and previous_avg > 0:
            movement_pct = round(((current_avg - previous_avg) / previous_avg) * 100, 1)

        trending_payload.append(
            {
                "make": str(row.make),
                "model": str(row.model),
                "listing_count": int(row.count or 0),
                "avg_price_lkr": round(current_avg, 2),
                "movement_pct": movement_pct,
                "thumbnail_url": str(row.thumbnail_url) if row.thumbnail_url else None,
            }
        )

    hot_deals = (
        db.query(CarListing)
        .filter(
            CarListing.deal_score.isnot(None),
            CarListing.deal_score >= 8,
            CarListing.price_lkr.isnot(None),
            CarListing.price_lkr >= MIN_REASONABLE_PRICE_LKR,
            CarListing.is_outlier == False,
        )
        .order_by(desc(CarListing.deal_score), desc(CarListing.scraped_at))
        .limit(10)
        .all()
    )

    hot_deal_payload = [
        {
            "id": row.id,
            "make": row.make,
            "model": row.model,
            "year": row.year,
            "district": row.district,
            "source": row.source,
            "price_lkr": float(row.price_lkr),
            "deal_score": float(row.deal_score) if row.deal_score is not None else 0.0,
            "thumbnail_url": row.thumbnail_url,
        }
        for row in hot_deals
    ]

    return {
        "new_listings_24h": int(new_listings_24h),
        "segment_performance": segment_performance,
        "trending_models": trending_payload,
        "hot_deals": hot_deal_payload,
    }


@router.get("/district-insight", response_model=DistrictQuickInsightResponse)
def get_district_quick_insight(
    district: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
):
    normalized = normalize_district_name(district) or " ".join(district.strip().split()).title()
    district_slug = normalized.lower().replace(" ", "-")
    district_clause = and_(
        CarListing.is_outlier == False,
        or_(
            func.lower(CarListing.district) == normalized.lower(),
            func.lower(CarListing.url).ilike(f"%-for-sale-{district_slug}%"),
        ),
    )
    now = utc_now()
    current_30d = now - timedelta(days=30)
    previous_30d = now - timedelta(days=60)

    base = db.query(CarListing).filter(district_clause)

    listing_count = base.count()

    avg_price = (
        db.query(func.avg(CarListing.price_lkr))
        .filter(
            district_clause,
            CarListing.price_lkr.isnot(None),
        )
        .scalar()
    )

    current_avg = (
        db.query(func.avg(CarListing.price_lkr))
        .filter(
            district_clause,
            CarListing.price_lkr.isnot(None),
            CarListing.scraped_at >= current_30d,
        )
        .scalar()
    )

    previous_avg = (
        db.query(func.avg(CarListing.price_lkr))
        .filter(
            district_clause,
            CarListing.price_lkr.isnot(None),
            CarListing.scraped_at >= previous_30d,
            CarListing.scraped_at < current_30d,
        )
        .scalar()
    )

    change_pct_30d = None
    if current_avg and previous_avg and float(previous_avg) > 0:
        change_pct_30d = round(((float(current_avg) - float(previous_avg)) / float(previous_avg)) * 100, 1)

    top_models = (
        db.query(
            CarListing.make,
            CarListing.model,
            func.count(CarListing.id).label("count"),
            func.avg(CarListing.price_lkr).label("avg_price"),
        )
        .filter(
            district_clause,
            CarListing.make.isnot(None),
            CarListing.model.isnot(None),
        )
        .group_by(CarListing.make, CarListing.model)
        .order_by(desc("count"))
        .limit(4)
        .all()
    )

    district_median = median_price_for_listings(db, district_clause)

    return {
        "district": normalized,
        "listing_count": int(listing_count),
        "avg_price_lkr": round(float(avg_price), 2) if avg_price else None,
        "median_price_lkr": round(float(district_median), 2) if district_median is not None else None,
        "change_pct_30d": change_pct_30d,
        "top_models": [
            {
                "make": str(row.make),
                "model": str(row.model),
                "listing_count": int(row.count or 0),
                "avg_price_lkr": round(float(row.avg_price), 2) if row.avg_price else 0.0,
            }
            for row in top_models
        ],
    }
