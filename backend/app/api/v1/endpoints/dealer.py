import re
import secrets
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.services.rate_limit import RateLimiter
from app.utils.sql_median import median_price_expr, python_median
from db.models import CarListing, DealerProfile, live_listing_filter
from db.session import get_db

_dealer_rate_limiter = RateLimiter(max_requests=300, window_seconds=60)

router = APIRouter(dependencies=[Depends(_dealer_rate_limiter)])

MIN_REASONABLE_PRICE_LKR = 100_000
MAX_URLS_PER_REQUEST = 50

# (slug-fragment, canonical-make) ordered longest-first so "land-rover" wins over "rover"
_KNOWN_MAKES: list[tuple[str, str]] = [
    ("mercedes-benz", "Mercedes-Benz"),
    ("land-rover", "Land Rover"),
    ("range-rover", "Range Rover"),
    ("mitsubishi", "Mitsubishi"),
    ("volkswagen", "Volkswagen"),
    ("chevrolet", "Chevrolet"),
    ("lamborghini", "Lamborghini"),
    ("daihatsu", "Daihatsu"),
    ("peugeot", "Peugeot"),
    ("hyundai", "Hyundai"),
    ("ferrari", "Ferrari"),
    ("renault", "Renault"),
    ("porsche", "Porsche"),
    ("subaru", "Subaru"),
    ("toyota", "Toyota"),
    ("nissan", "Nissan"),
    ("suzuki", "Suzuki"),
    ("mazda", "Mazda"),
    ("honda", "Honda"),
    ("perodua", "Perodua"),
    ("proton", "Proton"),
    ("isuzu", "Isuzu"),
    ("lexus", "Lexus"),
    ("jeep", "Jeep"),
    ("ford", "Ford"),
    ("audi", "Audi"),
    ("mini", "Mini"),
    ("kia", "Kia"),
    ("bmw", "BMW"),
    ("vw", "Volkswagen"),
    ("benz", "Mercedes-Benz"),
    ("volvo", "Volvo"),
    ("fiat", "Fiat"),
    ("dodge", "Dodge"),
]

_YEAR_RE = re.compile(r'\b(19[5-9]\d|20[0-2]\d)\b')
_STOP_MARKERS = ("-for-sale", "-ad-", "-listing", "-used", "-new")


def _parse_vehicle_from_url(url: str) -> tuple[Optional[str], Optional[str], Optional[int]]:
    """Extract (make, model, year) from a URL using slug-pattern heuristics."""
    parsed = urlparse(url)
    # Combine path and query for wider slug coverage; normalise separators
    slug = (parsed.path + " " + parsed.query).lower().replace("/", "-").replace("_", "-")

    year: Optional[int] = None
    year_match = _YEAR_RE.search(slug)
    if year_match:
        year = int(year_match.group())

    make_canonical: Optional[str] = None
    make_start: int = -1
    make_key_len: int = 0

    for key, canonical in _KNOWN_MAKES:
        # Require word-boundary: preceded by start-of-string, '-', or space
        pattern = r'(?:^|[-\s])' + re.escape(key) + r'(?:[-\s]|$)'
        m = re.search(pattern, slug)
        if m:
            # Determine where the actual key begins (skip the leading boundary char)
            key_start = m.start() + (1 if m.group(0)[:1] in "-\t\n\r\f\v " else 0)
            if make_start == -1 or key_start < make_start:
                make_canonical = canonical
                make_start = key_start
                make_key_len = len(key)

    if make_canonical is None:
        return None, None, year

    # Isolate the segment after the make token
    raw_after = slug[make_start + make_key_len:].lstrip("-: ")

    # Trim at year position
    if year_match:
        year_str = str(year)
        y_pos = raw_after.find(year_str)
        if y_pos > 0:
            raw_after = raw_after[:y_pos]

    # Trim at stop markers
    for marker in _STOP_MARKERS:
        pos = raw_after.find(marker)
        if pos >= 0:
            raw_after = raw_after[:pos]
            break

    # Take first two dash-delimited tokens as the model
    model_parts = [p.strip() for p in raw_after.split("-") if p.strip() and not p.strip().isdigit()]
    model_raw = " ".join(model_parts[:2]).strip()
    model: Optional[str] = model_raw.title() if len(model_raw) >= 2 else None

    return make_canonical, model, year


def _market_benchmark(
    db: Session,
    make: Optional[str],
    model: Optional[str],
    year: Optional[int],
    listing_price: Optional[float],
) -> tuple[Optional[float], Optional[float], int]:
    """Return (market_median_lkr, price_gap_pct, comparable_count)."""
    if not make:
        return None, None, 0

    q = db.query(CarListing).filter(
        live_listing_filter(),  # noqa: E712
        CarListing.price_lkr.isnot(None),
        CarListing.price_lkr >= MIN_REASONABLE_PRICE_LKR,
        CarListing.make.ilike(f"%{make.strip()}%"),
    )
    if model:
        q = q.filter(CarListing.model.ilike(f"%{model.strip()}%"))
    if year:
        q = q.filter(CarListing.year.between(year - 2, year + 2))

    median_expr = median_price_expr(db, CarListing.price_lkr)
    if median_expr is not None:
        comparable_count, median_value = q.with_entities(func.count(CarListing.id), median_expr).one()
        comparable_count = int(comparable_count or 0)
        market_median = round(float(median_value), 2) if median_value is not None else None
    else:
        prices = [float(row[0]) for row in q.with_entities(CarListing.price_lkr).all()]
        comparable_count = len(prices)
        market_median = python_median(prices)

    if not comparable_count or market_median is None:
        return None, None, 0

    price_gap_pct: Optional[float] = None
    if listing_price is not None and market_median > 0:
        price_gap_pct = round((listing_price - market_median) / market_median * 100, 2)

    return market_median, price_gap_pct, comparable_count


class BenchmarkUrlsRequest(BaseModel):
    urls: list[str]

    @field_validator("urls")
    @classmethod
    def validate_urls(cls, v: list[str]) -> list[str]:
        cleaned = [u.strip() for u in v if u.strip()]
        if len(cleaned) > MAX_URLS_PER_REQUEST:
            raise ValueError(f"Maximum {MAX_URLS_PER_REQUEST} URLs per request")
        return cleaned


class UrlBenchmarkResult(BaseModel):
    url: str
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    listing_price: Optional[float] = None
    market_median: Optional[float] = None
    price_gap_pct: Optional[float] = None
    comparable_count: int = 0
    error: Optional[str] = None


@router.post("/benchmark-urls", response_model=list[UrlBenchmarkResult])
def benchmark_urls(
    payload: BenchmarkUrlsRequest,
    db: Session = Depends(get_db),
) -> list[UrlBenchmarkResult]:
    """
    Benchmark a list of listing URLs against the current market.

    For each URL:
    - Attempts an exact DB lookup to resolve make/model/year/price.
    - Falls back to heuristic slug parsing when the listing is not in the DB.
    - Returns market median price and price-gap percentage for comparables.
    """
    results: list[UrlBenchmarkResult] = []

    for url in payload.urls:
        try:
            make: Optional[str] = None
            model: Optional[str] = None
            year: Optional[int] = None
            listing_price: Optional[float] = None

            # Prefer exact DB match for accuracy
            db_row = db.query(CarListing).filter(CarListing.url == url).first()
            if db_row:
                make = str(db_row.make or "").strip() or None
                model = str(db_row.model or "").strip() or None
                year = int(db_row.year) if db_row.year else None
                listing_price = float(db_row.price_lkr) if db_row.price_lkr else None
            else:
                make, model, year = _parse_vehicle_from_url(url)

            market_median, price_gap_pct, comparable_count = _market_benchmark(
                db, make, model, year, listing_price
            )

            error: Optional[str] = None
            if not make:
                error = "Could not identify vehicle from URL"
            elif market_median is None:
                error = "No comparable market data found"

            results.append(UrlBenchmarkResult(
                url=url,
                make=make,
                model=model,
                year=year,
                listing_price=listing_price,
                market_median=market_median,
                price_gap_pct=price_gap_pct,
                comparable_count=comparable_count,
                error=error,
            ))
        except Exception as exc:  # noqa: BLE001
            results.append(UrlBenchmarkResult(
                url=url,
                error=f"Processing error: {str(exc)[:200]}",
            ))

    return results


class DealerClaimRequest(BaseModel):
    display_name: str
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    seller_name_pattern: Optional[str] = None
    claimed_url: Optional[str] = None
    claim_token: Optional[str] = None

    @field_validator("display_name")
    @classmethod
    def _name_ok(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if len(cleaned) < 2:
            raise ValueError("display_name is required")
        return cleaned[:120]


class DealerClaimResponse(BaseModel):
    id: int
    claim_token: str
    display_name: str
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    seller_name_pattern: Optional[str] = None
    claimed_url: Optional[str] = None
    status: str
    matched_listings: int = 0


def _match_claimed_listings(db: Session, profile: DealerProfile) -> int:
    q = db.query(func.count(CarListing.id)).filter(live_listing_filter())
    pattern = (profile.seller_name_pattern or "").strip()
    url = (profile.claimed_url or "").strip()
    if pattern:
        q = q.filter(CarListing.title.ilike(f"%{pattern}%"))
    elif url:
        q = q.filter(CarListing.url == url)
    else:
        return 0
    return int(q.scalar() or 0)


@router.post("/claim", response_model=DealerClaimResponse)
def claim_dealer_profile(
    payload: DealerClaimRequest,
    db: Session = Depends(get_db),
) -> DealerClaimResponse:
    """Create or update a claimed dealer profile (anonymous claim_token)."""
    token = (payload.claim_token or "").strip() or secrets.token_urlsafe(24)
    existing = (
        db.query(DealerProfile).filter(DealerProfile.claim_token == token).first()
        if payload.claim_token
        else None
    )

    if existing:
        existing.display_name = payload.display_name
        existing.contact_phone = (payload.contact_phone or "").strip() or None
        existing.contact_email = (payload.contact_email or "").strip() or None
        existing.seller_name_pattern = (payload.seller_name_pattern or "").strip() or None
        existing.claimed_url = (payload.claimed_url or "").strip() or None
        existing.updated_at = datetime.now(timezone.utc)
        profile = existing
    else:
        profile = DealerProfile(
            claim_token=token,
            display_name=payload.display_name,
            contact_phone=(payload.contact_phone or "").strip() or None,
            contact_email=(payload.contact_email or "").strip() or None,
            seller_name_pattern=(payload.seller_name_pattern or "").strip() or None,
            claimed_url=(payload.claimed_url or "").strip() or None,
            status="pending",
        )
        db.add(profile)

    db.commit()
    db.refresh(profile)
    matched = _match_claimed_listings(db, profile)
    return DealerClaimResponse(
        id=int(profile.id),
        claim_token=str(profile.claim_token),
        display_name=str(profile.display_name),
        contact_phone=profile.contact_phone,
        contact_email=profile.contact_email,
        seller_name_pattern=profile.seller_name_pattern,
        claimed_url=profile.claimed_url,
        status=str(profile.status),
        matched_listings=matched,
    )


@router.get("/me", response_model=DealerClaimResponse)
def get_dealer_profile(
    claim_token: str,
    db: Session = Depends(get_db),
) -> DealerClaimResponse:
    token = (claim_token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="claim_token required")
    profile = db.query(DealerProfile).filter(DealerProfile.claim_token == token).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="Dealer profile not found")
    matched = _match_claimed_listings(db, profile)
    return DealerClaimResponse(
        id=int(profile.id),
        claim_token=str(profile.claim_token),
        display_name=str(profile.display_name),
        contact_phone=profile.contact_phone,
        contact_email=profile.contact_email,
        seller_name_pattern=profile.seller_name_pattern,
        claimed_url=profile.claimed_url,
        status=str(profile.status),
        matched_listings=matched,
    )
