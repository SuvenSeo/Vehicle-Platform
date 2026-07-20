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
