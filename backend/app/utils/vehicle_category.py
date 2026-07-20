"""Vehicle category helpers for multi-vehicle scrapes vs cars-only UI."""

from __future__ import annotations

import re
from typing import Optional

from sqlalchemy import and_, not_, or_
from sqlalchemy.sql import ColumnElement

# Homepage / cars browse — passenger-car inventory only (matches pre-multi-vehicle ikman).
CAR_CATEGORIES = frozenset(
    {
        "cars",
        "car",
        "suvs",
        "suv",
        "jeeps",
        "wagons",
        "pickups",
        "pickup",
        "crew-cabs",
        "crew-cab",
        "sports",
    }
)

NON_CAR_CATEGORIES = frozenset(
    {
        "motorbikes",
        "motorcycles",
        "bike",
        "bikes",
        "three-wheelers",
        "three-wheels",
        "threewheeler",
        "vans",
        "van",
        "buses",
        "bus",
        "lorries",
        "lorries-trucks",
        "trucks",
        "truck",
        "tipper",
        "heavy-duty",
        "heavy-duties",
        "heavy",
        "tractors",
        "tractor",
        "bicycles",
        "bicycle",
        "push-cycles",
        "boats",
        "boats-water-transport",
        "others",
    }
)

# Browse UI groups → stored vehicle_category tokens (and close aliases).
BROWSE_CATEGORY_ALIASES: dict[str, frozenset[str]] = {
    "cars": CAR_CATEGORIES,
    "motorbikes": frozenset({"motorbikes", "motorcycles", "bike", "bikes"}),
    "three-wheelers": frozenset({"three-wheelers", "three-wheels", "threewheeler"}),
    "vans": frozenset({"vans", "van"}),
    "buses": frozenset({"buses", "bus"}),
    "lorries": frozenset({"lorries", "lorries-trucks", "trucks", "truck", "tipper"}),
    "heavy-duty": frozenset({"heavy-duty", "heavy-duties", "heavy"}),
    "tractors": frozenset({"tractors", "tractor"}),
    "bicycles": frozenset({"bicycles", "bicycle", "push-cycles"}),
    "boats": frozenset({"boats", "boats-water-transport"}),
    "others": frozenset({"others"}),
}

_NON_CAR_TITLE_RE = re.compile(
    r"(?i)\b("
    r"motorbike|motorcycle|scooter|"
    r"three[\s-]?wheel(?:er)?s?|"
    r"tractor|bicycle|push[\s-]?cycle|"
    r"heavy[\s-]?duty|tipper|"
    r"boat|jet[\s-]?ski|water\s*transport|"
    r"ntorq|activa|pcx\b|dio\b|"
    r"bajaj\s+re\b|tvs\s+king|piaggio\s+ape|"
    r"lorry|\bbus\b"
    r")\b"
)


def normalize_vehicle_category(value: object) -> Optional[str]:
    if value is None:
        return None
    token = str(value).strip().lower().replace("_", "-")
    token = re.sub(r"\s+", "-", token)
    token = re.sub(r"[^a-z0-9\-]+", "", token)
    return token or None


def is_car_category(value: object) -> bool:
    token = normalize_vehicle_category(value)
    if token is None:
        return True
    if token in NON_CAR_CATEGORIES:
        return False
    return token in CAR_CATEGORIES


def looks_like_non_car_text(*parts: object) -> bool:
    text = " ".join(str(part or "") for part in parts).strip()
    if not text:
        return False
    return bool(_NON_CAR_TITLE_RE.search(text))


def resolve_browse_category(value: object) -> Optional[str]:
    """Map a UI / query category token onto a browse group key."""
    token = normalize_vehicle_category(value)
    if not token:
        return None
    if token in BROWSE_CATEGORY_ALIASES:
        return token
    for browse_key, aliases in BROWSE_CATEGORY_ALIASES.items():
        if token in aliases:
            return browse_key
    return token


def cars_only_sql_filter(listing_model) -> ColumnElement[bool]:
    """Keep passenger cars + legacy untagged rows that do not look like non-cars."""
    category = listing_model.vehicle_category
    title = listing_model.title
    make = listing_model.make
    model = listing_model.model

    tagged_car = category.in_(sorted(CAR_CATEGORIES))

    non_car_title = or_(
        title.ilike("%motorbike%"),
        title.ilike("%motorcycle%"),
        title.ilike("%scooter%"),
        title.ilike("%three wheel%"),
        title.ilike("%three-wheel%"),
        title.ilike("%tractor%"),
        title.ilike("%bicycle%"),
        title.ilike("%lorry%"),
        title.ilike("%heavy duty%"),
        title.ilike("%heavy-duty%"),
        title.ilike("%ntorq%"),
        title.ilike("%bajaj re%"),
        title.ilike("%tvs king%"),
        title.ilike("%piaggio ape%"),
        make.ilike("tvs"),
        and_(make.ilike("bajaj"), model.ilike("%re%")),
    )

    untagged_car_like = and_(category.is_(None), not_(non_car_title))
    return or_(tagged_car, untagged_car_like)


def category_sql_filter(listing_model, browse_category: object) -> Optional[ColumnElement[bool]]:
    """SQL filter for a browse UI category. Returns None when no filter should apply."""
    browse_key = resolve_browse_category(browse_category)
    if not browse_key:
        return None
    if browse_key in {"cars", "car"}:
        return cars_only_sql_filter(listing_model)

    aliases = BROWSE_CATEGORY_ALIASES.get(browse_key)
    if aliases:
        return listing_model.vehicle_category.in_(sorted(aliases))

    token = normalize_vehicle_category(browse_category)
    if token:
        return listing_model.vehicle_category == token
    return None
