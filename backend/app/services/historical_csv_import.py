"""Parse Kaggle-style / community vehicle CSVs into archive observation rows."""

from __future__ import annotations

import csv
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from app.scrapers.cleaner import CarCleaner
from app.utils.districts import resolve_canonical_district

PriceUnit = Literal["lkr", "lakhs", "auto"]

_ALIASES = {
    "make": ("brand", "make", "manufacturer"),
    "model": ("model",),
    "year": ("yom", "year", "year_of_manufacture", "model_year"),
    "price": ("price", "price_lkr", "price (lkr)", "asking_price"),
    # Kaggle SL dataset uses the common misspelling "Millage(KM)".
    "mileage": (
        "mileage",
        "mileage_km",
        "mileage (km)",
        "millage",
        "millage(km)",
        "millage (km)",
        "odometer",
        "km",
    ),
    "town": ("town", "location", "city", "district"),
    "date": ("date", "listing_date", "posted_on", "scraped_at"),
    "url": ("url", "listing_url", "link", "detailurl"),
    "title": ("title", "adtitle", "name"),
}

_LAKHS_TO_LKR = 100_000


def _norm_header(value: str) -> str:
    return " ".join(str(value or "").strip().lower().replace("_", " ").split())


def _map_headers(fieldnames: list[str] | None) -> dict[str, str]:
    mapping: dict[str, str] = {}
    headers = {_norm_header(h): h for h in (fieldnames or [])}
    for canonical, aliases in _ALIASES.items():
        for alias in aliases:
            key = _norm_header(alias)
            if key in headers:
                mapping[canonical] = headers[key]
                break
    return mapping


def parse_observed_date(raw: str | None, default: datetime) -> datetime:
    text = str(raw or "").strip()
    if not text:
        return default
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text[:19], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return default


def _numeric_price_token(raw: str) -> float | None:
    text = str(raw or "").strip()
    if not text:
        return None
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)", text.replace(",", ""))
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def detect_price_unit(raw_values: list[str]) -> Literal["lkr", "lakhs"]:
    """Heuristic for Prasad-Nirmal-style CSVs priced in lakhs (e.g. 43.0 → 4.3M LKR)."""
    samples: list[float] = []
    for raw in raw_values:
        token = _numeric_price_token(raw)
        if token is None:
            continue
        samples.append(token)
        if len(samples) >= 200:
            break
    if not samples:
        return "lkr"
    median = sorted(samples)[len(samples) // 2]
    maximum = max(samples)
    if maximum < 2_000 and median < 500:
        return "lakhs"
    return "lkr"


def parse_price_lkr(
    cleaner: CarCleaner,
    raw: str,
    *,
    price_unit: Literal["lkr", "lakhs"],
) -> int | None:
    if price_unit == "lakhs":
        token = _numeric_price_token(raw)
        if token is None:
            return None
        value = int(round(token * _LAKHS_TO_LKR))
        return value if cleaner._is_reasonable_price(value) else None
    return cleaner.clean_price(str(raw or ""))


def rows_from_csv(
    path: Path,
    *,
    archive_source: str,
    observed_default: datetime,
    limit: int | None = None,
    price_unit: PriceUnit = "auto",
) -> list[dict[str, Any]]:
    cleaner = CarCleaner()
    rows: list[dict[str, Any]] = []
    with path.open(newline="", encoding="utf-8", errors="ignore") as handle:
        reader = csv.DictReader(handle)
        mapping = _map_headers(list(reader.fieldnames or []))
        if "price" not in mapping:
            raise ValueError(f"CSV missing price column. Found: {reader.fieldnames}")

        raw_rows = list(reader)
        resolved_unit: Literal["lkr", "lakhs"]
        if price_unit == "auto":
            resolved_unit = detect_price_unit(
                [str(raw.get(mapping["price"]) or "") for raw in raw_rows]
            )
        else:
            resolved_unit = price_unit

        for index, raw in enumerate(raw_rows, start=1):
            if limit is not None and index > limit:
                break
            price = parse_price_lkr(
                cleaner,
                str(raw.get(mapping["price"]) or ""),
                price_unit=resolved_unit,
            )
            if price is None:
                continue

            make = str(raw.get(mapping["make"]) or "").strip() if "make" in mapping else ""
            model = str(raw.get(mapping["model"]) or "").strip() if "model" in mapping else ""
            title = (
                str(raw.get(mapping["title"]) or "").strip()
                if "title" in mapping
                else f"{make} {model}".strip()
            )
            if not make and title:
                parsed = cleaner.clean_title(title)
                make = str(parsed.get("make") or "")
                model = model or str(parsed.get("model") or "")
            if not make:
                continue

            year = None
            if "year" in mapping:
                try:
                    year = int(float(str(raw.get(mapping["year"]) or "").strip()))
                except (TypeError, ValueError):
                    year = None
            if year is None and title:
                year = cleaner.clean_title(title).get("year")

            mileage = None
            if "mileage" in mapping:
                mileage_raw = str(raw.get(mapping["mileage"]) or "").strip()
                # Kaggle CSV often stores mileage as floats ("85000.0"); strip
                # decimals before digit extraction so we don't get 850000.
                if re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", mileage_raw.replace(",", "")):
                    try:
                        mileage = int(float(mileage_raw.replace(",", "")))
                    except ValueError:
                        mileage = cleaner.clean_mileage(mileage_raw)
                else:
                    mileage = cleaner.clean_mileage(mileage_raw)

            town = str(raw.get(mapping["town"]) or "").strip() if "town" in mapping else ""
            district = resolve_canonical_district(town) if town else None
            url = str(raw.get(mapping["url"]) or "").strip() if "url" in mapping else ""
            observed = parse_observed_date(
                str(raw.get(mapping["date"]) or "") if "date" in mapping else None,
                observed_default,
            )
            source_id = cleaner.make_source_id(url or f"{make}-{model}-{year}-{price}-{index}")

            rows.append(
                {
                    "archive_source": archive_source,
                    "source_id": source_id,
                    "observed_at": observed,
                    "url": url or f"csv://{archive_source}/{source_id}",
                    "title": title or f"{make} {model}".strip(),
                    "make": make.title(),
                    "model": (model or "Other").title(),
                    "year": year,
                    "price_lkr": price,
                    "mileage": mileage,
                    "district": district,
                    "city": town or None,
                    "confidence": "low",
                    "raw_meta": {
                        "import": "csv",
                        "row": index,
                        "price_unit": resolved_unit,
                    },
                }
            )
    return rows
