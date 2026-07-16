"""Materialized cache for heavy aggregate stats endpoints.

``refresh_stats_cache(db)`` precomputes both the ``summary`` and
``district_prices`` payloads and stores them in ``market_stats_cache``.

The read helpers (``get_cached_summary``, ``get_cached_district_prices``)
return ``None`` when the entry is absent or older than ``CACHE_TTL_SECONDS``,
which signals the caller to fall back to live computation.

``store_summary_cache`` / ``store_district_prices_cache`` let the endpoint
persist a result it just computed so the next caller gets a cache hit.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from sqlalchemy import case, func, and_, desc
from sqlalchemy.orm import Session

from app.models.schemas import StatsSummary
from app.utils.districts import (
    SL_DISTRICT_COORDS,
    count_canonical_districts,
    find_district_from_url,
    normalize_district_name,
)
from app.utils.pricing import build_district_median_map, median_from_values
from app.utils.time import utc_now
from db.models import CarListing, MarketStatsCache, PriceAggregate, live_listing_filter

log = structlog.get_logger()

CACHE_TTL_SECONDS = 3600
_MIN_PRICE_LKR = 100_000

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _is_fresh(entry: MarketStatsCache) -> bool:
    """Return True when *entry* was refreshed within the TTL window."""
    refreshed = entry.refreshed_at
    if refreshed is None:
        return False
    if refreshed.tzinfo is None:
        refreshed = refreshed.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - refreshed).total_seconds()
    return age < CACHE_TTL_SECONDS


def _get_entry(db: Session, key: str) -> Optional[MarketStatsCache]:
    return db.query(MarketStatsCache).filter(MarketStatsCache.cache_key == key).first()


def _upsert(db: Session, key: str, payload: dict) -> None:
    now = datetime.now(timezone.utc)
    entry = _get_entry(db, key)
    if entry is None:
        db.add(MarketStatsCache(cache_key=key, payload=payload, refreshed_at=now))
    else:
        entry.payload = payload
        entry.refreshed_at = now
    db.commit()


# ---------------------------------------------------------------------------
# Public read helpers
# ---------------------------------------------------------------------------


def get_cached_summary(db: Session) -> Optional[StatsSummary]:
    """Return a fresh cached ``StatsSummary`` or ``None`` on miss/staleness."""
    entry = _get_entry(db, "summary")
    if entry is None or not _is_fresh(entry):
        return None
    try:
        return StatsSummary.model_validate(entry.payload)
    except Exception as exc:
        log.warning("stats_cache_summary_parse_error", error=str(exc))
        return None


def get_cached_district_prices(db: Session) -> Optional[dict]:
    """Return fresh cached district-prices payload or ``None`` on miss/staleness."""
    entry = _get_entry(db, "district_prices")
    if entry is None or not _is_fresh(entry):
        return None
    payload = entry.payload
    if not isinstance(payload, dict):
        return None
    return payload


# ---------------------------------------------------------------------------
# Public write helpers (used by endpoints after inline computation)
# ---------------------------------------------------------------------------


def store_summary_cache(db: Session, result: StatsSummary) -> None:
    """Persist *result* to the cache; swallows all errors (non-fatal)."""
    try:
        _upsert(db, "summary", result.model_dump(mode="json"))
    except Exception as exc:
        log.warning("stats_cache_store_summary_error", error=str(exc))
        try:
            db.rollback()
        except Exception:
            pass


def store_district_prices_cache(db: Session, result: dict) -> None:
    """Persist district-prices *result* to the cache; swallows all errors."""
    try:
        _upsert(db, "district_prices", result)
    except Exception as exc:
        log.warning("stats_cache_store_district_prices_error", error=str(exc))
        try:
            db.rollback()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Standalone refresh (called from run_sync.py)
# ---------------------------------------------------------------------------


def _compute_summary(db: Session) -> dict:
    """Replicate the summary computation and return a JSON-safe dict."""
    seven_days_ago = utc_now() - timedelta(days=7)

    total = (
        db.query(func.count(CarListing.id))
        .filter(live_listing_filter())
        .scalar()
        or 0
    )
    avg_price = (
        db.query(func.avg(CarListing.price_lkr))
        .filter(live_listing_filter(), CarListing.price_lkr.isnot(None))
        .scalar()
    )
    good_deals = (
        db.query(func.count(CarListing.id))
        .filter(CarListing.deal_score >= 20, live_listing_filter())
        .scalar()
        or 0
    )
    this_week = (
        db.query(func.count(CarListing.id))
        .filter(CarListing.first_seen_at >= seven_days_ago)
        .scalar()
        or 0
    )
    districts = count_canonical_districts(
        db.query(CarListing).filter(CarListing.district.isnot(None))
    )
    source_count = (
        db.query(func.count(func.distinct(CarListing.source)))
        .filter(live_listing_filter(), CarListing.source.isnot(None))
        .scalar()
        or 0
    )
    last_updated = (
        db.query(
            func.max(
                func.coalesce(
                    CarListing.scraped_at,
                    CarListing.last_seen_at,
                    CarListing.first_seen_at,
                )
            )
        )
        .filter(live_listing_filter())
        .scalar()
    )

    price_change_mom = None
    now = utc_now()
    cur_y, cur_m = now.year, now.month
    prev_m, prev_y = (cur_m - 1, cur_y) if cur_m > 1 else (12, cur_y - 1)
    cur_avg = (
        db.query(func.avg(PriceAggregate.avg_price_lkr))
        .filter(
            PriceAggregate.period_year == cur_y,
            PriceAggregate.period_month == cur_m,
        )
        .scalar()
    )
    prev_avg = (
        db.query(func.avg(PriceAggregate.avg_price_lkr))
        .filter(
            PriceAggregate.period_year == prev_y,
            PriceAggregate.period_month == prev_m,
        )
        .scalar()
    )
    if cur_avg and prev_avg and float(prev_avg) > 0:
        price_change_mom = round(
            ((float(cur_avg) - float(prev_avg)) / float(prev_avg)) * 100, 1
        )

    summary = StatsSummary(
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
    return summary.model_dump(mode="json")


def _compute_district_prices(db: Session) -> dict:
    """Replicate the district-prices computation and return the response dict."""
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
            live_listing_filter(),
        )
        .group_by(CarListing.district)
        .order_by(desc("count"))
        .all()
    )

    points: list[dict] = []
    inferred_mode = (
        len(results) <= 1
        and len(results) > 0
        and str(results[0][0] or "").strip().lower() == "sri lanka"
    )

    if inferred_mode:
        rows = (
            db.query(
                CarListing.district,
                CarListing.url,
                CarListing.price_lkr,
                CarListing.make,
                CarListing.model,
            )
            .filter(CarListing.price_lkr.isnot(None), live_listing_filter())
            .all()
        )

        agg: dict[str, dict] = {}
        for district, url, price, make, model in rows:
            normalized = normalize_district_name(district)
            if normalized == "Sri Lanka" or normalized is None:
                normalized = find_district_from_url(url)
            if not normalized:
                continue
            item = agg.setdefault(
                normalized, {"count": 0, "total": 0.0, "model_counts": {}, "prices": []}
            )
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
                    key=lambda kv: kv[1],
                    reverse=True,
                )[0]
            top_make = None
            top_model_label = None
            if top_model_name:
                parts = top_model_name.split(" ", 1)
                top_make = parts[0] if parts else None
                top_model_label = parts[1] if len(parts) > 1 else None

            points.append(
                {
                    "district": district,
                    "lat": coords[0],
                    "lng": coords[1],
                    "count": values["count"],
                    "avg_price_lkr": round(float(avg_price), 2),
                    "median_price_lkr": round(float(district_median), 2),
                    "top_make": top_make,
                    "top_model": top_model_label,
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
            live_listing_filter(),
        )
        .group_by(CarListing.district, CarListing.make, CarListing.model)
        .all()
    )

    top_model_by_district: dict[str, dict] = {}
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
            points.append(
                {
                    "district": normalized,
                    "lat": coords[0],
                    "lng": coords[1],
                    "count": count,
                    "avg_price_lkr": round(float(avg_price), 2),
                    "median_price_lkr": round(float(district_median), 2),
                    "top_make": top["make"] if top else None,
                    "top_model": top["model"] if top else None,
                    "top_model_count": top["count"] if top else None,
                }
            )

    return {"points": points}


def refresh_stats_cache(db: Session) -> None:
    """Precompute and persist both ``summary`` and ``district_prices`` cache entries.

    Designed to be called from the post-scrape pipeline (``run_sync.py``) so
    that the first API hit after a sync finds warm cache instead of running
    expensive aggregates on demand.
    """
    log.info("stats_cache_refresh_started")
    try:
        summary_payload = _compute_summary(db)
        _upsert(db, "summary", summary_payload)
        log.info("stats_cache_summary_stored")
    except Exception as exc:
        log.error("stats_cache_summary_failed", error=str(exc))
        try:
            db.rollback()
        except Exception:
            pass

    try:
        district_payload = _compute_district_prices(db)
        _upsert(db, "district_prices", district_payload)
        log.info("stats_cache_district_prices_stored")
    except Exception as exc:
        log.error("stats_cache_district_prices_failed", error=str(exc))
        try:
            db.rollback()
        except Exception:
            pass

    log.info("stats_cache_refresh_completed")
