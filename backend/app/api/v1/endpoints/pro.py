from datetime import datetime, timedelta
from app.utils.districts import count_canonical_districts
from app.utils.time import utc_now
from statistics import median
from typing import Annotated, Iterable, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from app.models.schemas import (
    DistrictTopModel,
    ProArbitrageGap,
    ProBreakdownPoint,
    ProDetailPayload,
    ProDistrictProfile,
    ProListingSample,
    ProMarketSnapshot,
    ProMetric,
    ProTrendPoint,
    ProVehicleLane,
)
from db.models import CarListing, PriceAggregate
from db.session import get_db

router = APIRouter()

MIN_REASONABLE_PRICE_LKR = 100_000
SOURCE_LABELS = {
    "ikman": "Ikman",
    "riyasewana": "Riyasewana",
    "autolanka": "AutoLanka",
    "autodirect": "AutoDirect",
    "patpat": "Patpat",
    "autostream": "AutoStream",
    "carshop": "Carshop",
    "saleme": "SaleMe",
    "riyahub": "Riyahub",
    "dimo": "Cars at DIMO",
}


def _num(value) -> Optional[float]:
    if value is None:
        return None
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return None


def _median(values: Iterable[object]) -> Optional[float]:
    numbers = [_num(value) for value in values]
    clean = [value for value in numbers if value is not None and value >= MIN_REASONABLE_PRICE_LKR]
    if not clean:
        return None
    return round(float(median(clean)), 2)


def _supports_percentile(db: Session) -> bool:
    dialect = db.bind.dialect.name if db.bind and db.bind.dialect else ""
    return dialect in {"postgresql", "postgres"}


def _median_price_expr(db: Session):
    if not _supports_percentile(db):
        return None
    return func.percentile_cont(0.5).within_group(CarListing.price_lkr).label("median_price")


def _median_price_for_query(db: Session, query) -> Optional[float]:
    median_expr = _median_price_expr(db)
    if median_expr is not None:
        return _num(query.with_entities(median_expr).scalar())
    return _median(row[0] for row in query.with_entities(CarListing.price_lkr).all())


def _scope_metrics(db: Session, query, *, include_deal_score: bool = False) -> dict[str, Optional[float] | int]:
    fields = [
        func.count(CarListing.id).label("count"),
        func.avg(CarListing.price_lkr).label("avg_price"),
        func.min(CarListing.price_lkr).label("min_price"),
        func.max(CarListing.price_lkr).label("max_price"),
    ]
    if include_deal_score:
        fields.append(func.avg(CarListing.deal_score).label("avg_deal_score"))
    median_expr = _median_price_expr(db)
    if median_expr is not None:
        fields.append(median_expr)

    row = query.with_entities(*fields).one()
    return {
        "count": int(row.count or 0),
        "avg_price_lkr": _num(row.avg_price),
        "median_price_lkr": _num(getattr(row, "median_price", None)) if median_expr is not None else _median_price_for_query(db, query),
        "min_price_lkr": _num(row.min_price),
        "max_price_lkr": _num(row.max_price),
        "avg_deal_score": _num(getattr(row, "avg_deal_score", None)) if include_deal_score else None,
    }


def _price_query(db: Session):
    return db.query(CarListing).filter(
        CarListing.is_outlier == False,
        CarListing.price_lkr.isnot(None),
        CarListing.price_lkr >= MIN_REASONABLE_PRICE_LKR,
    )


def _apply_listing_scope(
    query,
    *,
    make: Optional[str] = None,
    model: Optional[str] = None,
    district: Optional[str] = None,
    condition: Optional[str] = None,
):
    if make:
        query = query.filter(CarListing.make.ilike(f"%{make.strip()}%"))
    if model:
        query = query.filter(CarListing.model.ilike(f"%{model.strip()}%"))
    if district:
        normalized = " ".join(district.strip().lower().replace("-", " ").split())
        district_slug = normalized.replace(" ", "-")
        district_expr = func.lower(func.replace(CarListing.district, "-", " "))
        raw_location_expr = func.lower(func.replace(CarListing.raw_location, "-", " "))
        query = query.filter(
            or_(
                district_expr.ilike(f"%{normalized}%"),
                raw_location_expr.ilike(f"%{normalized}%"),
                func.lower(CarListing.url).ilike(f"%-for-sale-{district_slug}%"),
            )
        )
    if condition:
        query = query.filter(func.lower(CarListing.condition) == condition.strip().lower())
    return query


def _listing_sample(row: CarListing) -> ProListingSample:
    return ProListingSample(
        id=int(row.id),
        title=str(row.title or f"{row.make} {row.model}").strip(),
        make=str(row.make or ""),
        model=str(row.model or ""),
        year=int(row.year) if row.year is not None else None,
        price_lkr=_num(row.price_lkr),
        district=str(row.district) if row.district else None,
        source=str(row.source or "unknown"),
        deal_score=_num(row.deal_score),
        thumbnail_url=str(row.thumbnail_url) if row.thumbnail_url else None,
        detail_url=str(row.url) if row.url else None,
        external_url=str(row.url) if row.url else None,
        first_seen_at=row.first_seen_at,
        last_seen_at=row.last_seen_at,
    )


def _share(count: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round((count / total) * 100, 1)


def _source_label(value: str) -> str:
    key = str(value or "").strip().lower()
    return SOURCE_LABELS.get(key, key.replace("-", " ").title() or "Unknown")


def _breakdown(db: Session, field, *, total: int, limit: int = 8, **scope) -> list[ProBreakdownPoint]:
    rows = (
        _apply_listing_scope(_price_query(db), **scope)
        .with_entities(
            field.label("label"),
            func.count(CarListing.id).label("count"),
            func.avg(CarListing.price_lkr).label("avg_price"),
            func.max(func.coalesce(CarListing.last_seen_at, CarListing.scraped_at, CarListing.first_seen_at)).label("latest"),
        )
        .filter(field.isnot(None))
        .group_by(field)
        .order_by(desc("count"))
        .limit(limit)
        .all()
    )

    return [
        ProBreakdownPoint(
            label=_source_label(row.label) if field is CarListing.source else str(row.label),
            count=int(row.count or 0),
            share_pct=_share(int(row.count or 0), total),
            avg_price_lkr=_num(row.avg_price),
            latest_seen_at=row.latest,
        )
        for row in rows
        if row.label
    ]


def _top_group_label(db: Session, field, **scope) -> Optional[str]:
    row = (
        _apply_listing_scope(_price_query(db), **scope)
        .with_entities(field.label("label"), func.count(CarListing.id).label("count"))
        .filter(field.isnot(None))
        .group_by(field)
        .order_by(desc("count"))
        .first()
    )
    if not row or not row.label:
        return None
    return _source_label(row.label) if field is CarListing.source else str(row.label)


def _trend_points(db: Session, *, make: Optional[str] = None, model: Optional[str] = None, district: Optional[str] = None) -> list[ProTrendPoint]:
    query = db.query(
        PriceAggregate.period_year,
        PriceAggregate.period_month,
        func.avg(PriceAggregate.avg_price_lkr).label("avg_price"),
        func.avg(PriceAggregate.median_price_lkr).label("median_price"),
        func.sum(PriceAggregate.listing_count).label("listing_count"),
    )
    if make:
        query = query.filter(func.lower(PriceAggregate.make) == make.strip().lower())
    if model:
        query = query.filter(func.lower(PriceAggregate.model) == model.strip().lower())
    if district:
        query = query.filter(func.lower(PriceAggregate.district) == district.strip().lower())

    rows = (
        query.group_by(PriceAggregate.period_year, PriceAggregate.period_month)
        .order_by(PriceAggregate.period_year, PriceAggregate.period_month)
        .limit(24)
        .all()
    )

    if rows:
        return [
            ProTrendPoint(
                month=f"{int(row.period_year):04d}-{int(row.period_month):02d}",
                avg_price_lkr=_num(row.avg_price),
                median_price_lkr=_num(row.median_price),
                listing_count=int(row.listing_count or 0),
            )
            for row in rows
        ]

    event_ts = func.coalesce(CarListing.first_seen_at, CarListing.scraped_at)
    period_expr = func.strftime("%Y-%m", event_ts)
    if db.bind and db.bind.dialect and db.bind.dialect.name != "sqlite":
        period_expr = func.to_char(event_ts, "YYYY-MM")

    fallback = _apply_listing_scope(_price_query(db), make=make, model=model, district=district)
    rows = (
        fallback.with_entities(
            period_expr.label("period"),
            func.avg(CarListing.price_lkr).label("avg_price"),
            func.count(CarListing.id).label("listing_count"),
        )
        .filter(event_ts.isnot(None))
        .group_by(period_expr)
        .order_by(period_expr)
        .limit(24)
        .all()
    )
    return [
        ProTrendPoint(
            month=str(row.period),
            avg_price_lkr=_num(row.avg_price),
            median_price_lkr=_num(row.avg_price),
            listing_count=int(row.listing_count or 0),
        )
        for row in rows
        if row.period
    ]


def _top_models(db: Session, *, district: Optional[str] = None, limit: int = 5) -> list[DistrictTopModel]:
    rows = (
        _apply_listing_scope(_price_query(db), district=district)
        .with_entities(
            CarListing.make,
            CarListing.model,
            func.count(CarListing.id).label("count"),
            func.avg(CarListing.price_lkr).label("avg_price"),
        )
        .filter(CarListing.make.isnot(None), CarListing.model.isnot(None))
        .group_by(CarListing.make, CarListing.model)
        .order_by(desc("count"))
        .limit(limit)
        .all()
    )
    return [
        DistrictTopModel(
            make=str(row.make),
            model=str(row.model),
            listing_count=int(row.count or 0),
            avg_price_lkr=_num(row.avg_price) or 0.0,
        )
        for row in rows
    ]


def _samples(db: Session, *, limit: int = 8, **scope) -> list[ProListingSample]:
    rows = (
        _apply_listing_scope(_price_query(db), **scope)
        .order_by(desc(CarListing.deal_score), desc(CarListing.first_seen_at))
        .limit(limit)
        .all()
    )
    return [_listing_sample(row) for row in rows]


@router.get("/market-snapshot", response_model=ProMarketSnapshot)
def get_pro_market_snapshot(db: Session = Depends(get_db)):
    now = utc_now()
    seven_days_ago = now - timedelta(days=7)
    priced = _price_query(db)
    metrics = _scope_metrics(db, priced)
    total = int(metrics["count"])
    source_count = (
        priced.with_entities(func.count(func.distinct(CarListing.source))).scalar()
        or 0
    )

    return ProMarketSnapshot(
        generated_at=now,
        total_listings=total,
        avg_price_lkr=metrics["avg_price_lkr"],
        median_price_lkr=metrics["median_price_lkr"],
        min_price_lkr=metrics["min_price_lkr"],
        max_price_lkr=metrics["max_price_lkr"],
        new_listings_7d=int(priced.filter(CarListing.first_seen_at >= seven_days_ago).count()),
        districts_covered=count_canonical_districts(priced),
        source_count=int(source_count),
        hot_deal_count=int(priced.filter(CarListing.deal_score >= 8).count()),
        last_updated=priced.with_entities(func.max(func.coalesce(CarListing.last_seen_at, CarListing.scraped_at, CarListing.first_seen_at))).scalar(),
        source_coverage=_breakdown(db, CarListing.source, total=total),
        top_opportunities=_samples(db, limit=8),
    )


@router.get("/vehicle-lanes", response_model=list[ProVehicleLane])
def get_pro_vehicle_lanes(
    make: Optional[str] = None,
    model: Optional[str] = None,
    district: Optional[str] = None,
    condition: Optional[str] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 40,
    db: Session = Depends(get_db),
):
    scoped = _apply_listing_scope(_price_query(db), make=make, model=model, district=district, condition=condition)
    median_expr = _median_price_expr(db)
    fields = [
        CarListing.make,
        CarListing.model,
        func.count(CarListing.id).label("count"),
        func.avg(CarListing.price_lkr).label("avg_price"),
        func.min(CarListing.price_lkr).label("min_price"),
        func.max(CarListing.price_lkr).label("max_price"),
        func.avg(CarListing.deal_score).label("avg_deal_score"),
        func.count(func.distinct(CarListing.district)).label("district_count"),
        func.count(func.distinct(CarListing.source)).label("source_count"),
        func.max(func.coalesce(CarListing.last_seen_at, CarListing.scraped_at, CarListing.first_seen_at)).label("latest"),
    ]
    if median_expr is not None:
        fields.append(median_expr)

    rows = (
        scoped.with_entities(*fields)
        .filter(CarListing.make.isnot(None), CarListing.model.isnot(None))
        .group_by(CarListing.make, CarListing.model)
        .order_by(desc("count"))
        .limit(limit)
        .all()
    )

    lanes: list[ProVehicleLane] = []
    for row in rows:
        lane_scope = {
            "make": str(row.make),
            "model": str(row.model),
            "district": district,
            "condition": condition,
        }
        lane_query = _apply_listing_scope(_price_query(db), **lane_scope)
        median_price = (
            _num(getattr(row, "median_price", None))
            if median_expr is not None
            else _median_price_for_query(db, lane_query)
        )
        lanes.append(
            ProVehicleLane(
                make=str(row.make),
                model=str(row.model),
                listing_count=int(row.count or 0),
                avg_price_lkr=_num(row.avg_price),
                median_price_lkr=median_price,
                min_price_lkr=_num(row.min_price),
                max_price_lkr=_num(row.max_price),
                avg_deal_score=_num(row.avg_deal_score),
                district_count=int(row.district_count or 0),
                source_count=int(row.source_count or 0),
                top_district=_top_group_label(db, CarListing.district, **lane_scope),
                top_source=_top_group_label(db, CarListing.source, **lane_scope),
                latest_seen_at=row.latest,
            )
        )

    return lanes


@router.get("/districts", response_model=list[ProDistrictProfile])
def get_pro_districts(
    limit: Annotated[int, Query(ge=1, le=60)] = 30,
    db: Session = Depends(get_db),
):
    median_expr = _median_price_expr(db)
    fields = [
        CarListing.district,
        func.count(CarListing.id).label("count"),
        func.avg(CarListing.price_lkr).label("avg_price"),
        func.min(CarListing.price_lkr).label("min_price"),
        func.max(CarListing.price_lkr).label("max_price"),
        func.count(func.distinct(CarListing.source)).label("source_count"),
        func.max(func.coalesce(CarListing.last_seen_at, CarListing.scraped_at, CarListing.first_seen_at)).label("latest"),
    ]
    if median_expr is not None:
        fields.append(median_expr)

    rows = (
        _price_query(db)
        .with_entities(*fields)
        .filter(CarListing.district.isnot(None))
        .group_by(CarListing.district)
        .order_by(desc("count"))
        .limit(limit)
        .all()
    )

    profiles: list[ProDistrictProfile] = []
    for row in rows:
        district_name = str(row.district)
        district_query = _apply_listing_scope(_price_query(db), district=district_name)
        median_price = (
            _num(getattr(row, "median_price", None))
            if median_expr is not None
            else _median_price_for_query(db, district_query)
        )
        top_models = _top_models(db, district=district_name, limit=5)
        top_model = top_models[0] if top_models else None
        profiles.append(
            ProDistrictProfile(
                district=district_name,
                listing_count=int(row.count or 0),
                avg_price_lkr=_num(row.avg_price),
                median_price_lkr=median_price,
                min_price_lkr=_num(row.min_price),
                max_price_lkr=_num(row.max_price),
                source_count=int(row.source_count or 0),
                top_make=top_model.make if top_model else None,
                top_model=top_model.model if top_model else None,
                latest_seen_at=row.latest,
                top_models=top_models,
                source_mix=_breakdown(db, CarListing.source, total=int(row.count or 0), district=district_name),
                sample_listings=_samples(db, district=district_name, limit=5),
            )
        )
    return profiles


@router.get("/vehicle-lane-detail", response_model=ProDetailPayload)
def get_pro_vehicle_lane_detail(
    make: str = Query(..., min_length=1),
    model: str = Query(..., min_length=1),
    district: Optional[str] = None,
    condition: Optional[str] = None,
    db: Session = Depends(get_db),
):
    scoped = _apply_listing_scope(_price_query(db), make=make, model=model, district=district, condition=condition)
    metrics = _scope_metrics(db, scoped, include_deal_score=True)
    total = int(metrics["count"])
    avg_price = metrics["avg_price_lkr"]
    median_price = metrics["median_price_lkr"]
    avg_score = metrics["avg_deal_score"]

    district_label = f" in {district}" if district else ""
    return ProDetailPayload(
        kind="vehicle_lane",
        title=f"{make} {model}{district_label}",
        summary=f"{total} priced listings tracked for this lane across AutoLens sources.",
        generated_at=utc_now(),
        metrics=[
            ProMetric(label="Listings", value=f"{total:,}", detail="Priced, non-outlier inventory"),
            ProMetric(label="Average price", value=f"Rs. {avg_price:,.0f}" if avg_price else "N/A"),
            ProMetric(label="Median price", value=f"Rs. {median_price:,.0f}" if median_price else "N/A"),
            ProMetric(label="Avg deal score", value=f"{avg_score:.1f}" if avg_score is not None else "N/A"),
        ],
        source_mix=_breakdown(db, CarListing.source, total=total, make=make, model=model, district=district, condition=condition),
        district_mix=_breakdown(db, CarListing.district, total=total, make=make, model=model, condition=condition),
        trend_points=_trend_points(db, make=make, model=model, district=district),
        sample_listings=_samples(db, make=make, model=model, district=district, condition=condition, limit=10),
    )


_MIN_DISTRICT_LISTINGS = 2


@router.get("/arbitrage-gaps", response_model=list[ProArbitrageGap])
def get_pro_arbitrage_gaps(
    make: str = Query(..., min_length=1),
    model: str = Query(..., min_length=1),
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    db: Session = Depends(get_db),
) -> list[ProArbitrageGap]:
    rows = (
        _apply_listing_scope(_price_query(db), make=make, model=model)
        .with_entities(CarListing.district, CarListing.price_lkr)
        .filter(CarListing.district.isnot(None))
        .all()
    )

    buckets: dict[str, list[float]] = {}
    for district, price in rows:
        if district and price is not None:
            buckets.setdefault(str(district), []).append(float(price))

    district_stats: dict[str, tuple[float, int]] = {}
    for district, prices in buckets.items():
        if len(prices) >= _MIN_DISTRICT_LISTINGS:
            med = _median(prices)
            if med is not None:
                district_stats[district] = (med, len(prices))

    sorted_districts = sorted(district_stats.keys())
    gaps: list[ProArbitrageGap] = []
    for i, d_a in enumerate(sorted_districts):
        for d_b in sorted_districts[i + 1:]:
            med_a, count_a = district_stats[d_a]
            med_b, count_b = district_stats[d_b]
            if med_a == med_b:
                continue
            if med_a < med_b:
                buy_d, sell_d = d_a, d_b
                buy_med, sell_med = med_a, med_b
                buy_count, sell_count = count_a, count_b
            else:
                buy_d, sell_d = d_b, d_a
                buy_med, sell_med = med_b, med_a
                buy_count, sell_count = count_b, count_a
            gap_pct = round((sell_med - buy_med) / buy_med * 100, 2)
            gaps.append(
                ProArbitrageGap(
                    buy_district=buy_d,
                    sell_district=sell_d,
                    buy_median_lkr=buy_med,
                    sell_median_lkr=sell_med,
                    gap_pct=gap_pct,
                    buy_listing_count=buy_count,
                    sell_listing_count=sell_count,
                )
            )

    gaps.sort(key=lambda g: g.gap_pct, reverse=True)
    return gaps[:limit]


@router.get("/district-detail", response_model=ProDetailPayload)
def get_pro_district_detail(
    district: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
):
    scoped = _apply_listing_scope(_price_query(db), district=district)
    metrics = _scope_metrics(db, scoped)
    total = int(metrics["count"])
    avg_price = metrics["avg_price_lkr"]
    median_price = metrics["median_price_lkr"]
    top = _top_models(db, district=district, limit=1)
    top_label = f"{top[0].make} {top[0].model}" if top else "No dominant model yet"

    return ProDetailPayload(
        kind="district",
        title=f"{district} market profile",
        summary=f"{top_label} leads the local sample across {total} priced listings.",
        generated_at=utc_now(),
        metrics=[
            ProMetric(label="Listings", value=f"{total:,}", detail="Priced, non-outlier inventory"),
            ProMetric(label="Average price", value=f"Rs. {avg_price:,.0f}" if avg_price else "N/A"),
            ProMetric(label="Median price", value=f"Rs. {median_price:,.0f}" if median_price else "N/A"),
            ProMetric(label="Top model", value=top_label),
        ],
        source_mix=_breakdown(db, CarListing.source, total=total, district=district),
        district_mix=[],
        trend_points=_trend_points(db, district=district),
        sample_listings=_samples(db, district=district, limit=10),
    )
