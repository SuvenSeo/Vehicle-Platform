"""Build public Motormila snapshot JSON files from the configured database.

This is intentionally read-only. It lets the public site read Cloudflare R2
JSON snapshots instead of hitting Postgres for every visitor.
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import and_, desc, func  # noqa: E402
from sqlalchemy.orm import load_only  # noqa: E402

from app.api.v1.endpoints import listings as listings_endpoint  # noqa: E402
from app.api.v1.endpoints import pipeline as pipeline_endpoint  # noqa: E402
from app.api.v1.endpoints import stats as stats_endpoint  # noqa: E402
from app.utils.districts import count_canonical_districts  # noqa: E402
from db.models import CarListing, live_listing_filter  # noqa: E402
from db.session import SessionLocal  # noqa: E402

logger = logging.getLogger(__name__)

MIN_REASONABLE_PRICE_LKR = 100_000
DEFAULT_OUTPUT_DIR = BASE_DIR / "snapshots" / "latest"


def jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    if isinstance(value, Path):
        return str(value)
    if hasattr(value, "model_dump"):
        return jsonable(value.model_dump())
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    return value


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(jsonable(payload), handle, separators=(",", ":"), sort_keys=True)
        handle.write("\n")


def to_utc_iso(dt: datetime | None) -> str | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def number_or_none(value: Any) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isfinite(number):
        return number
    return None


def listing_to_dict(row: CarListing) -> dict[str, Any]:
    return {
        "id": int(row.id),
        "source": row.source,
        "source_id": row.source_id,
        "url": row.url,
        "detail_url": row.url,
        "external_url": row.url,
        "title": row.title or "",
        "make": row.make or "",
        "model": row.model or "",
        "year": int(row.year) if row.year is not None else None,
        "price_lkr": number_or_none(row.price_lkr),
        "mileage": int(row.mileage) if row.mileage is not None else None,
        "mileage_km": int(row.mileage) if row.mileage is not None else None,
        "fuel_type": row.fuel_type,
        "transmission": row.transmission,
        "engine_capacity": int(row.engine_capacity) if row.engine_capacity is not None else None,
        "engine_cc": int(row.engine_capacity) if row.engine_capacity is not None else None,
        "condition": row.condition,
        "body_type": row.body_type,
        "district": row.district,
        "city": row.city,
        "thumbnail_url": row.thumbnail_url,
        "scraped_at": to_utc_iso(row.scraped_at),
        "first_seen_at": to_utc_iso(row.first_seen_at),
        "last_seen_at": to_utc_iso(row.last_seen_at),
        "deal_score": number_or_none(row.deal_score),
        "market_median_lkr": number_or_none(row.market_median_lkr),
        "is_outlier": bool(row.is_outlier),
    }


def build_stats_summary(db) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    priced_clause = and_(
        live_listing_filter(),
        CarListing.price_lkr.isnot(None),
        CarListing.price_lkr >= MIN_REASONABLE_PRICE_LKR,
    )

    total = db.query(func.count(CarListing.id)).filter(live_listing_filter()).scalar() or 0
    avg_price = db.query(func.avg(CarListing.price_lkr)).filter(priced_clause).scalar()
    good_deals = (
        db.query(func.count(CarListing.id))
        .filter(CarListing.deal_score >= 20, live_listing_filter())
        .scalar()
        or 0
    )
    this_week = (
        db.query(func.count(CarListing.id))
        .filter(CarListing.first_seen_at >= seven_days_ago, live_listing_filter())
        .scalar()
        or 0
    )
    districts = count_canonical_districts(
        db.query(CarListing).filter(CarListing.district.isnot(None), live_listing_filter())
    )
    source_count = (
        db.query(func.count(func.distinct(CarListing.source)))
        .filter(CarListing.source.isnot(None), live_listing_filter())
        .scalar()
        or 0
    )
    last_updated = (
        db.query(func.max(func.coalesce(CarListing.scraped_at, CarListing.last_seen_at, CarListing.first_seen_at)))
        .filter(live_listing_filter())
        .scalar()
    )

    top_makes = (
        db.query(CarListing.make, func.count(CarListing.id).label("count"))
        .filter(CarListing.make.isnot(None), live_listing_filter())
        .group_by(CarListing.make)
        .order_by(desc("count"))
        .limit(8)
        .all()
    )

    return {
        "total_listings": int(total),
        "avg_price_lkr": round(float(avg_price), 2) if avg_price is not None else None,
        "price_change_mom": None,
        "good_deals_count": int(good_deals),
        "listings_this_week": int(this_week),
        "districts_covered": int(districts),
        "district_count": int(districts),
        "source_count": int(source_count),
        "last_updated": to_utc_iso(last_updated),
        "top_makes": [{"make": str(row.make), "count": int(row.count or 0)} for row in top_makes],
    }


def build_pipeline_status(db) -> dict[str, Any]:
    """Public snapshot payload — same logic as GET /pipeline/status (anonymous)."""
    try:
        return pipeline_endpoint.pipeline_status(db=db, is_admin=False)
    except Exception:
        logger.exception("Failed to build pipeline-status snapshot; using empty fallback")
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "overall_status": "ok",
            "jobs": [],
        }


def build_listing_catalog(db, limit: int | None = None) -> list[dict[str, Any]]:
    query = (
        db.query(CarListing)
        .options(
            load_only(
                CarListing.id,
                CarListing.source,
                CarListing.source_id,
                CarListing.url,
                CarListing.title,
                CarListing.make,
                CarListing.model,
                CarListing.year,
                CarListing.price_lkr,
                CarListing.mileage,
                CarListing.fuel_type,
                CarListing.transmission,
                CarListing.engine_capacity,
                CarListing.condition,
                CarListing.body_type,
                CarListing.district,
                CarListing.city,
                CarListing.thumbnail_url,
                CarListing.scraped_at,
                CarListing.first_seen_at,
                CarListing.last_seen_at,
                CarListing.deal_score,
                CarListing.market_median_lkr,
                CarListing.is_outlier,
            )
        )
        .filter(live_listing_filter())
        .order_by(desc(CarListing.first_seen_at), desc(CarListing.id))
    )
    if limit is not None and limit > 0:
        query = query.limit(limit)
    return [listing_to_dict(row) for row in query.yield_per(1000)]


def build_models_by_make(catalog: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    by_make: dict[str, dict[str, int]] = {}
    for item in catalog:
        make = str(item.get("make") or "").strip()
        model = str(item.get("model") or "").strip()
        if not make or not model:
            continue
        bucket = by_make.setdefault(make, {})
        bucket[model] = bucket.get(model, 0) + 1
    return {
        make: [
            {"model": model, "count": count}
            for model, count in sorted(models.items(), key=lambda row: row[1], reverse=True)
        ]
        for make, models in sorted(by_make.items())
    }


def build_snapshot(output_dir: Path, catalog_limit: int | None = None, *, skip_catalog: bool = False) -> dict[str, Any]:
    db = SessionLocal()
    generated_at = datetime.now(timezone.utc)
    try:
        # Full-catalog reads transfer the whole car_listings table (egress).
        # Daily/stats-only runs pass skip_catalog=True so only the small JSON
        # files are rebuilt; listing-catalog.json keeps its last full export
        # (weekly or manual), which the frontend still reads from R2/CDN.
        if skip_catalog:
            catalog = []
            priced_count = 0
        else:
            catalog = build_listing_catalog(db, limit=catalog_limit)
            priced_count = sum(
                1
                for item in catalog
                if item.get("price_lkr") is not None and float(item.get("price_lkr") or 0) >= MIN_REASONABLE_PRICE_LKR
            )

        # listing-models.json is derived from the full catalog, so it must be
        # skipped together with the catalog — writing an empty {} would clobber
        # the last good file on R2 and break make→model drilldowns.
        skip_derived = skip_catalog

        files = {
            "manifest.json": {
                "generated_at": generated_at.isoformat(),
                "schema_version": 1,
                "listing_count": len(catalog),
                "priced_listing_count": priced_count,
                "files": [
                    "stats-summary.json",
                    "live-market.json",
                    "pipeline-status.json",
                    "district-prices.json",
                    "dashboard-insights.json",
                    "listing-sources.json",
                    "listing-makes.json",
                ]
                + ([] if skip_derived else ["listing-models.json", "listing-catalog.json"]),
            },
            "stats-summary.json": build_stats_summary(db),
            "live-market.json": stats_endpoint.build_live_market_snapshot(db),
            "pipeline-status.json": build_pipeline_status(db),
            "district-prices.json": stats_endpoint.get_district_prices(db=db),
            "dashboard-insights.json": stats_endpoint.get_dashboard_insights(db=db),
            "listing-sources.json": listings_endpoint.get_sources(db=db),
            "listing-makes.json": listings_endpoint.get_makes(db=db),
            "listing-models.json": build_models_by_make(catalog),
            "listing-catalog.json": {
                "generated_at": generated_at.isoformat(),
                "total": len(catalog),
                "items": catalog,
            },
        }

        if skip_derived:
            files.pop("listing-models.json")
            files.pop("listing-catalog.json")

        for filename, payload in files.items():
            write_json(output_dir / filename, payload)
        return files["manifest.json"]
    finally:
        db.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export public JSON snapshots for Motormila.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory to write snapshot files into. Defaults to backend/snapshots/latest.",
    )
    parser.add_argument(
        "--catalog-limit",
        type=int,
        default=0,
        help="Optional max listings for listing-catalog.json. 0 means export all listings.",
    )
    parser.add_argument(
        "--skip-catalog",
        action="store_true",
        help="Stats-only export: skip the full listing-catalog read (saves Neon egress). "
        "Use for daily refreshes; run a full export weekly or manually.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    limit = args.catalog_limit if args.catalog_limit and args.catalog_limit > 0 else None
    manifest = build_snapshot(args.output, catalog_limit=limit, skip_catalog=args.skip_catalog)
    print(
        "Snapshot ready:",
        args.output,
        f"listings={manifest['listing_count']}",
        f"priced={manifest['priced_listing_count']}",
        "catalog=skipped" if args.skip_catalog else "catalog=full",
    )


if __name__ == "__main__":
    main()
