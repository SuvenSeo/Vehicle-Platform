from __future__ import annotations

from datetime import datetime
import re
from typing import Any, Dict, List, Optional

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from db.models import CarListing, MarketSignal, PriceAggregate, ScrapeRun

KNOWN_DISTRICTS = [
    "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya", "Galle", "Matara", "Hambantota",
    "Jaffna", "Kilinochchi", "Mannar", "Vavuniya", "Batticaloa", "Ampara", "Trincomalee", "Kurunegala",
    "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla", "Monaragala", "Ratnapura", "Kegalle",
]

PLATFORM_CAPABILITIES = {
    "inventory": [
        "Live listings search with make/model/year/district/source filters",
        "Deal-score ranking and best-pick surfacing",
        "Listing detail and similar listing context",
    ],
    "analytics": [
        "District market concentration and average pricing",
        "Monthly trend insights from aggregates",
        "Estimator and comparative pricing guidance",
        "Official and import-cost market signals from DMT, Customs, and import reference sources",
    ],
    "operations": [
        "Pipeline status and scrape run visibility",
        "Source freshness visibility and run outcomes",
        "Live context refreshes on every chat request",
    ],
    "assistant": {
        "base_mode": "Rules + live database context",
        "llm_mode": "Optional server-side model when configured",
        "api_key_required": False,
    },
}


def _compact(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = (
        str(value)
        .strip()
        .lower()
        .replace("-", "")
        .replace("_", "")
        .replace(" ", "")
        .replace(".", "")
    )
    return cleaned or None


def _compact_expr(column):
    return func.lower(
        func.replace(
            func.replace(
                func.replace(
                    func.replace(func.coalesce(column, ""), "-", ""),
                    "_",
                    "",
                ),
                " ",
                "",
            ),
            ".",
            "",
        )
    )


def _canonical_source(value: Optional[str]) -> Optional[str]:
    token = _compact(value)
    if not token:
        return None
    if token.startswith("ikman"):
        return "ikman"
    if token.startswith("riyasewana"):
        return "riyasewana"
    if token in {"autolanka", "autolankacom", "autolankalk", "autolankasite"}:
        return "autolanka"
    if token.startswith("autodirect"):
        return "autodirect"
    if token.startswith("patpat"):
        return "patpat"
    if token.startswith("autostream"):
        return "autostream"
    if token.startswith("carshop"):
        return "carshop"
    if token in {"saleme", "salemelk"}:
        return "saleme"
    if token in {"riyahub", "riyahublk"}:
        return "riyahub"
    if token in {"dimo", "carsatdimo", "dimoautomobiles"}:
        return "dimo"
    return token


def _find_token(message: str, choices: List[Optional[str]]) -> Optional[str]:
    msg = f" {message.lower()} "
    best = None
    for choice in choices:
        c = (choice or "").strip().lower()
        if not c:
            continue
        if f" {c} " in msg and (best is None or len(c) > len(best)):
            best = c
    return best.title() if best else None


def _district_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    lower = str(url).lower()
    for district in sorted(KNOWN_DISTRICTS, key=len, reverse=True):
        slug = district.lower().replace(" ", "-")
        if f"-for-sale-{slug}" in lower:
            return district
    return None


def _extract_year(message: str) -> Optional[int]:
    years = re.findall(r"\b(19\d{2}|20\d{2})\b", message)
    if not years:
        return None
    y = int(years[-1])
    return y if 1980 <= y <= datetime.utcnow().year + 1 else None


def _extract_price_cap(message: str) -> Optional[float]:
    msg = message.lower().replace(",", "")
    m = re.search(r"(under|below|less than|max|upto|up to)\s*rs?\.?\s*(\d+(?:\.\d+)?)\s*(m|mn|million|k|l|lakhs?)?", msg)
    if not m:
        return None
    amount = float(m.group(2))
    unit = (m.group(3) or "").strip()
    if unit in {"m", "mn", "million"}:
        return amount * 1_000_000
    if unit in {"l", "lakh", "lakhs"}:
        return amount * 100_000
    if unit == "k":
        return amount * 1_000
    if amount < 10_000:
        return amount * 1_000_000
    return amount


def detect_intent(message: str) -> str:
    msg = message.lower()
    if any(k in msg for k in ["find", "show", "search", "looking for", "recommend", "suggest"]):
        return "find"
    if any(k in msg for k in ["deal", "underpriced", "best buy", "best deal"]):
        return "deal"
    if any(k in msg for k in ["trend", "up", "down", "month", "history"]):
        return "trend"
    if any(k in msg for k in ["average", "avg", "price", "worth", "valuation", "how much"]):
        return "pricing"
    if any(k in msg for k in ["source", "pipeline", "sync", "fresh", "updated", "status", "scrape"]):
        return "operations"
    return "overview"


def _serialize_listing(row: CarListing) -> Dict[str, Any]:
    title = f"{row.make or ''} {row.model or ''} {f'({row.year})' if row.year else ''}".strip()
    district = row.district
    if not district or str(district).strip().lower() == "sri lanka":
        district = _district_from_url(row.url)

    return {
        "id": row.id,
        "title": title or (row.title or "Listing"),
        "price_lkr": float(row.price_lkr) if row.price_lkr is not None else None,
        "district": district,
        "deal_score": float(row.deal_score) if row.deal_score is not None else None,
        "source": row.source,
        "detail_url": f"/listing/{row.id}",
        "external_url": row.url,
    }


def _sanitize_page_context(value: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    allowed = {}
    for key in ("route", "page", "summary"):
        raw = value.get(key)
        if raw is None:
            continue
        allowed[key] = str(raw)[:500]
    return allowed


def _listing_id_from_page_context(page_context: Dict[str, Any]) -> Optional[int]:
    route = str(page_context.get("route") or "")
    match = re.search(r"/listing/(\d+)", route)
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def build_assistant_context(
    *,
    db: Session,
    message: str,
    page_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    msg_l = message.lower()
    intent = detect_intent(msg_l)
    safe_page_context = _sanitize_page_context(page_context)

    makes = [m[0] for m in db.query(CarListing.make).filter(CarListing.make.isnot(None)).distinct().all()]
    districts = [d[0] for d in db.query(CarListing.district).filter(CarListing.district.isnot(None)).distinct().all()]
    sources = [s[0] for s in db.query(CarListing.source).filter(CarListing.source.isnot(None)).distinct().all()]

    district_choices = list({*(d for d in districts if d), *KNOWN_DISTRICTS})
    make_filter = _find_token(msg_l, makes)
    district_filter = _find_token(msg_l, district_choices)
    year_filter = _extract_year(msg_l)
    price_cap = _extract_price_cap(msg_l)
    source_filter = _canonical_source(_find_token(msg_l, sources) or "")

    model_filter = None
    if make_filter:
        model_choices = [
            m[0]
            for m in db.query(CarListing.model)
            .filter(CarListing.model.isnot(None), func.lower(CarListing.make) == make_filter.lower())
            .distinct()
            .all()
        ]
        model_filter = _find_token(msg_l, model_choices)

    base = db.query(CarListing).filter(
        CarListing.is_outlier == False,
        CarListing.price_lkr.isnot(None),
    )
    if make_filter:
        base = base.filter(func.lower(CarListing.make) == make_filter.lower())
    if model_filter:
        base = base.filter(func.lower(CarListing.model) == model_filter.lower())
    if district_filter:
        district_slug = district_filter.lower().replace(" ", "-")
        base = base.filter(
            (func.lower(CarListing.district) == district_filter.lower())
            | (func.lower(CarListing.url).ilike(f"%-for-sale-{district_slug}%"))
        )
    if source_filter:
        base = base.filter(_compact_expr(CarListing.source) == source_filter)
    if year_filter:
        base = base.filter(CarListing.year == year_filter)
    if price_cap:
        base = base.filter(CarListing.price_lkr <= price_cap)

    total_active = db.query(func.count(CarListing.id)).filter(CarListing.is_outlier == False).scalar() or 0
    priced_active = (
        db.query(func.count(CarListing.id))
        .filter(CarListing.is_outlier == False, CarListing.price_lkr.isnot(None))
        .scalar()
        or 0
    )
    scope_total = base.count()
    avg_price = base.with_entities(func.avg(CarListing.price_lkr)).scalar()
    min_price = base.with_entities(func.min(CarListing.price_lkr)).scalar()
    max_price = base.with_entities(func.max(CarListing.price_lkr)).scalar()

    source_breakdown_rows = (
        base.with_entities(CarListing.source, func.count(CarListing.id).label("count"))
        .group_by(CarListing.source)
        .order_by(desc("count"))
        .limit(6)
        .all()
    )
    source_stats = [{"source": str(row.source or "unknown"), "count": int(row.count or 0)} for row in source_breakdown_rows]

    district_breakdown_rows = (
        base.with_entities(
            CarListing.district,
            func.count(CarListing.id).label("count"),
            func.avg(CarListing.price_lkr).label("avg"),
        )
        .filter(CarListing.district.isnot(None))
        .group_by(CarListing.district)
        .order_by(desc("count"))
        .limit(6)
        .all()
    )
    district_stats = [
        {
            "district": str(row.district),
            "count": int(row.count or 0),
            "avg_price_lkr": float(row.avg) if row.avg is not None else None,
        }
        for row in district_breakdown_rows
    ]

    top_makes = (
        db.query(CarListing.make, func.count(CarListing.id).label("count"))
        .filter(CarListing.is_outlier == False, CarListing.make.isnot(None), CarListing.price_lkr.isnot(None))
        .group_by(CarListing.make)
        .order_by(desc("count"))
        .limit(6)
        .all()
    )

    trend_rows = []
    if make_filter:
        trend_query = (
            db.query(
                PriceAggregate.period_year,
                PriceAggregate.period_month,
                func.avg(PriceAggregate.avg_price_lkr).label("avg"),
                func.avg(PriceAggregate.median_price_lkr).label("median"),
                func.sum(PriceAggregate.listing_count).label("count"),
            )
            .filter(func.lower(PriceAggregate.make) == make_filter.lower())
        )
        if model_filter:
            trend_query = trend_query.filter(func.lower(PriceAggregate.model) == model_filter.lower())
        trend_rows = (
            trend_query.group_by(PriceAggregate.period_year, PriceAggregate.period_month)
            .order_by(desc(PriceAggregate.period_year), desc(PriceAggregate.period_month))
            .limit(6)
            .all()
        )

    run_rows = db.query(ScrapeRun).order_by(ScrapeRun.started_at.desc()).limit(120).all()
    run_status: List[Dict[str, Any]] = []
    seen_sources: set[str] = set()
    for run in run_rows:
        source = str(run.source or "unknown")
        if source in seen_sources:
            continue
        seen_sources.add(source)
        run_status.append(
            {
                "source": source,
                "status": str(run.status or "UNKNOWN"),
                "started_at": run.started_at.isoformat() if run.started_at else None,
                "finished_at": run.finished_at.isoformat() if run.finished_at else None,
                "listings_found": int(run.listings_found or 0),
                "listings_new": int(run.listings_new or 0),
                "error_message": (run.error_message or "")[:220] or None,
            }
        )
        if len(run_status) >= 8:
            break

    signal_rows = db.query(MarketSignal).order_by(MarketSignal.observed_at.desc()).limit(8).all()
    market_signals = [
        {
            "source": str(row.source or "unknown"),
            "signal_type": str(row.signal_type or "unknown"),
            "metric": str(row.metric or ""),
            "value_numeric": float(row.value_numeric) if row.value_numeric is not None else None,
            "unit": str(row.unit) if row.unit else None,
            "observed_at": row.observed_at.isoformat() if row.observed_at else None,
            "source_url": str(row.source_url or ""),
        }
        for row in signal_rows
    ]

    candidate_rows = (
        base.order_by(func.coalesce(CarListing.deal_score, 0).desc(), CarListing.first_seen_at.desc())
        .limit(8)
        .all()
    )
    listing_cards = [_serialize_listing(row) for row in candidate_rows]

    page_listing = None
    similar_listing_cards: list[dict[str, Any]] = []
    listing_id = _listing_id_from_page_context(safe_page_context)
    if listing_id:
        row = db.query(CarListing).filter(CarListing.id == listing_id).first()
        if row is not None:
            page_listing = _serialize_listing(row)
            similar_rows = (
                db.query(CarListing)
                .filter(
                    CarListing.id != listing_id,
                    CarListing.is_outlier == False,
                    CarListing.make == row.make,
                    CarListing.price_lkr.isnot(None),
                )
                .order_by(func.abs(func.coalesce(CarListing.price_lkr, 0) - float(row.price_lkr or 0)))
                .limit(4)
                .all()
            )
            similar_listing_cards = [_serialize_listing(item) for item in similar_rows]

    scope_label = "all vehicles"
    if make_filter and model_filter and district_filter:
        scope_label = f"{make_filter} {model_filter} in {district_filter}"
    elif make_filter and model_filter:
        scope_label = f"{make_filter} {model_filter}"
    elif make_filter and district_filter:
        scope_label = f"{make_filter} in {district_filter}"
    elif make_filter:
        scope_label = make_filter
    elif district_filter:
        scope_label = f"vehicles in {district_filter}"

    trend_points = [
        {
            "year": int(row.period_year),
            "month": int(row.period_month),
            "avg_price_lkr": float(row.avg) if row.avg is not None else None,
            "median_price_lkr": float(row.median) if row.median is not None else None,
            "listing_count": int(row.count or 0),
        }
        for row in reversed(trend_rows)
    ]

    context_cards = [
        {"label": "Active listings", "value": int(total_active), "unit": "listings"},
        {"label": "Priced listings", "value": int(priced_active), "unit": "listings"},
        {"label": "Scope matches", "value": int(scope_total), "unit": "listings"},
        {"label": "Recent source runs", "value": len(run_status), "unit": "sources"},
        {"label": "Market signals", "value": len(market_signals), "unit": "signals"},
    ]
    sources_used = sorted(
        {
            "car_listings",
            "price_aggregates" if trend_points else "",
            "scrape_runs" if run_status else "",
            "market_signals" if market_signals else "",
            "page_listing" if page_listing else "",
        }
        - {""}
    )

    applied_filters = {
        "make": make_filter,
        "model": model_filter,
        "district": district_filter,
        "source": source_filter,
        "year": year_filter,
        "max_price_lkr": price_cap,
    }

    context = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "intent": intent,
        "question": message,
        "platform_capabilities": PLATFORM_CAPABILITIES,
        "scope": {
            "label": scope_label,
            "total_active_listings": int(total_active),
            "priced_active_listings": int(priced_active),
            "scope_total": int(scope_total),
            **applied_filters,
        },
        "current_page": safe_page_context,
        "page_listing": page_listing,
        "similar_listings": similar_listing_cards,
        "pricing": {
            "average_price_lkr": float(avg_price) if avg_price is not None else None,
            "minimum_price_lkr": float(min_price) if min_price is not None else None,
            "maximum_price_lkr": float(max_price) if max_price is not None else None,
        },
        "source_breakdown": source_stats,
        "district_breakdown": district_stats,
        "top_makes": [{"make": m.make, "count": int(m.count)} for m in top_makes],
        "recent_trend_points": trend_points,
        "recent_scrape_runs": run_status,
        "market_signals": market_signals,
        "listing_samples": listing_cards[:6],
    }

    return {
        "context": context,
        "intent": intent,
        "scope_label": scope_label,
        "scope_total": int(scope_total),
        "avg_price": avg_price,
        "min_price": min_price,
        "max_price": max_price,
        "listing_cards": listing_cards,
        "source_stats": source_stats,
        "run_status": run_status,
        "market_signals": market_signals,
        "applied_filters": applied_filters,
        "context_cards": context_cards,
        "sources_used": sources_used,
    }
