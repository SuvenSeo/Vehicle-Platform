from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Query

from db.models import CarListing

SL_DISTRICT_COORDS = {
    "Colombo": (6.9271, 79.8612),
    "Gampaha": (7.0840, 80.0098),
    "Kalutara": (6.5854, 79.9607),
    "Kandy": (7.2906, 80.6337),
    "Matale": (7.4675, 80.6234),
    "Nuwara Eliya": (6.9497, 80.7891),
    "Galle": (6.0535, 80.2210),
    "Matara": (5.9549, 80.5550),
    "Hambantota": (6.1243, 81.1185),
    "Jaffna": (9.6615, 80.0255),
    "Kilinochchi": (9.3803, 80.3770),
    "Mannar": (8.9810, 79.9044),
    "Vavuniya": (8.7514, 80.4971),
    "Batticaloa": (7.7310, 81.6747),
    "Ampara": (7.2964, 81.6747),
    "Trincomalee": (8.5874, 81.2152),
    "Kurunegala": (7.4863, 80.3647),
    "Puttalam": (8.0362, 79.8283),
    "Anuradhapura": (8.3114, 80.4037),
    "Polonnaruwa": (7.9403, 81.0188),
    "Badulla": (6.9934, 81.0550),
    "Monaragala": (6.8728, 81.3507),
    "Ratnapura": (6.6828, 80.3992),
    "Kegalle": (7.2513, 80.3464),
    "Sri Lanka": (7.8731, 80.7718),
}

DISTRICT_ALIASES = {
    "nuwaraeliya": "Nuwara Eliya",
    "nuwara eliya": "Nuwara Eliya",
    "gampaha district": "Gampaha",
    "colombo district": "Colombo",
    "kegalle district": "Kegalle",
}

CANONICAL_DISTRICTS = frozenset(d for d in SL_DISTRICT_COORDS if d != "Sri Lanka")


def normalize_district_name(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = " ".join(str(value).strip().replace("-", " ").split())
    key = cleaned.lower()
    if key in DISTRICT_ALIASES:
        return DISTRICT_ALIASES[key]
    title = cleaned.title()
    return title if title in SL_DISTRICT_COORDS else None


def find_district_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    lower = str(url).lower()
    candidates = sorted(
        [district for district in SL_DISTRICT_COORDS.keys() if district != "Sri Lanka"],
        key=len,
        reverse=True,
    )
    for district in candidates:
        slug = district.lower().replace(" ", "-")
        if f"-for-sale-{slug}" in lower:
            return district
    return None


def resolve_canonical_district(
    district: Optional[str],
    url: Optional[str] = None,
) -> Optional[str]:
    normalized = normalize_district_name(district)
    if normalized == "Sri Lanka" or normalized is None:
        normalized = find_district_from_url(url) or normalized
    if normalized == "Sri Lanka":
        return None
    return normalized


def count_canonical_districts(query: Query) -> int:
    """Count distinct canonical Sri Lanka districts from a CarListing query.

    Callers should apply ``live_listing_filter()`` (and any other scope) on
    ``query`` first. The URL-inference fallback materializes matching rows;
    an unscoped query can load large inactive sets into memory.
    """
    canonical: set[str] = set()
    non_normalizing: set[str] = set()

    for (district,) in query.with_entities(CarListing.district).distinct().all():
        if not district:
            continue
        normalized = normalize_district_name(district)
        if normalized and normalized != "Sri Lanka":
            canonical.add(normalized)
        elif str(district).strip().lower() != "sri lanka":
            non_normalizing.add(str(district))

    fallback_filters = [CarListing.district.is_(None), func.lower(CarListing.district) == "sri lanka"]
    if non_normalizing:
        fallback_filters.append(CarListing.district.in_(non_normalizing))

    # Relies on caller-scoped query (prefer live_listing_filter) to bound this .all().
    fallback_rows = (
        query.filter(or_(*fallback_filters))
        .with_entities(CarListing.district, CarListing.url)
        .all()
    )
    for district, url in fallback_rows:
        resolved = resolve_canonical_district(district, url)
        if resolved:
            canonical.add(resolved)

    return len(canonical)
