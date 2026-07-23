"""Historical asking-price backfill from web archives (Wayback / similar).

Parses dated marketplace SERP snapshots into structured observations that
belong in ``historical_price_observations`` — never live ``car_listings``.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Optional
from urllib.parse import urljoin, urlparse

import httpx
import structlog
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.scrapers.cleaner import CarCleaner
from app.utils.districts import resolve_canonical_district
from db.models import HistoricalPriceObservation

log = structlog.get_logger()

WAYBACK_CDX = "https://web.archive.org/cdx/search/cdx"
WAYBACK_RAW = "https://web.archive.org/web/{ts}id_/{url}"

DEFAULT_IKMAN_SERP_URLS = (
    "http://ikman.lk/en/ads/sri-lanka/cars",
    "https://ikman.lk/en/ads/sri-lanka/cars",
    "https://ikman.lk/en/ads/sri-lanka/cars/toyota",
    "https://ikman.lk/en/ads/sri-lanka/cars/suzuki",
    "https://ikman.lk/en/ads/sri-lanka/cars/honda",
    "https://ikman.lk/en/ads/sri-lanka/cars/nissan",
)

TOP_BRAND_SERP_URLS = (
    "https://ikman.lk/en/ads/sri-lanka/cars/toyota",
    "http://ikman.lk/en/ads/sri-lanka/cars/toyota",
    "https://ikman.lk/en/ads/sri-lanka/cars/suzuki",
    "http://ikman.lk/en/ads/sri-lanka/cars/suzuki",
    "https://ikman.lk/en/ads/sri-lanka/cars/honda",
    "http://ikman.lk/en/ads/sri-lanka/cars/honda",
    "https://ikman.lk/en/ads/sri-lanka/cars/nissan",
    "http://ikman.lk/en/ads/sri-lanka/cars/nissan",
)

_YEAR_RE = re.compile(r"\b(19[5-9]\d|20[0-2]\d)\b")
_MILEAGE_RE = re.compile(r"([\d,]+)\s*km", re.IGNORECASE)
_PRICE_RE = re.compile(r"Rs\.?\s*([\d,]+)", re.IGNORECASE)
_INITIAL_DATA_RE = re.compile(
    r"window\.initialData\s*=\s*(\{.*?\})\s*;?\s*</script>",
    re.DOTALL,
)


@dataclass(frozen=True)
class CdxHit:
    timestamp: str
    original: str
    statuscode: str = "200"

    @property
    def observed_at(self) -> datetime:
        # CDX timestamps are YYYYMMDDhhmmss UTC
        return datetime.strptime(self.timestamp, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)

    @property
    def raw_url(self) -> str:
        return WAYBACK_RAW.format(ts=self.timestamp, url=self.original)


def parse_wayback_timestamp(value: str) -> datetime:
    """Parse a CDX / Wayback timestamp into an aware UTC datetime."""
    return datetime.strptime(value[:14], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)


def _slug_source_id(href: str) -> str:
    path = urlparse(href).path.rstrip("/")
    slug = path.split("/")[-1] if path else ""
    if slug:
        return slug[:120]
    digest = hashlib.sha1(href.encode("utf-8")).hexdigest()[:16]
    return f"hash-{digest}"


def _extract_year_from_title(title: str) -> Optional[int]:
    matches = _YEAR_RE.findall(title or "")
    if not matches:
        return None
    # Prefer the last year-like token (often YOM at end of title)
    year = int(matches[-1])
    if 1950 <= year <= 2030:
        return year
    return None


def _row_from_parts(
    *,
    cleaner: CarCleaner,
    seen: set[str],
    archive_source: str,
    observed_at: datetime,
    snapshot_url: str,
    title: str,
    href: str,
    price_text: str,
    mileage_text: str = "",
    area: str | None = None,
    extra_meta: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    title = " ".join(str(title or "").split())
    href = str(href or "").strip()
    if not title or not href:
        return None
    absolute = urljoin("https://ikman.lk/", href if href.startswith("/") else f"/en/ad/{href}")
    if "/ad/" not in absolute and not href.startswith("http"):
        absolute = urljoin("https://ikman.lk/en/ad/", href)

    price = cleaner.clean_price(price_text)
    if price is None:
        match = _PRICE_RE.search(price_text or title)
        if match:
            price = cleaner.clean_price(match.group(0))
    if price is None:
        return None

    mileage = None
    mileage_match = _MILEAGE_RE.search(mileage_text or "")
    if mileage_match:
        mileage = cleaner.clean_mileage(mileage_match.group(0))

    district = resolve_canonical_district(area) if area else None
    title_parts = cleaner.clean_title(title)
    make = title_parts.get("make")
    model = title_parts.get("model")
    year = title_parts.get("year") or _extract_year_from_title(title)
    source_id = _slug_source_id(absolute)
    dedupe_key = f"{source_id}|{observed_at.isoformat()}"
    if dedupe_key in seen:
        return None
    seen.add(dedupe_key)

    raw_meta = {
        "snapshot_url": snapshot_url or None,
        "price_text": price_text or None,
        "meta_text": mileage_text or None,
    }
    if extra_meta:
        raw_meta.update(extra_meta)

    return {
        "archive_source": archive_source,
        "source_id": source_id,
        "observed_at": observed_at,
        "url": absolute,
        "title": title[:500],
        "make": make,
        "model": model,
        "year": year,
        "price_lkr": price,
        "mileage": mileage,
        "district": district,
        "city": area,
        "confidence": "medium",
        "raw_meta": raw_meta,
    }


def _parse_initial_data_ads(
    html: str,
    *,
    cleaner: CarCleaner,
    seen: set[str],
    archive_source: str,
    observed_at: datetime,
    snapshot_url: str,
) -> list[dict[str, Any]]:
    match = _INITIAL_DATA_RE.search(html or "")
    if not match:
        return []
    try:
        payload = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []

    ads_root = (
        ((payload.get("serp") or {}).get("ads") or {}).get("data") or {}
    )
    buckets: list[Any] = []
    for key in ("ads", "topAds", "spotlights"):
        value = ads_root.get(key)
        if isinstance(value, list):
            buckets.extend(value)

    rows: list[dict[str, Any]] = []
    for ad in buckets:
        if not isinstance(ad, dict):
            continue
        title = str(ad.get("title") or "")
        slug = str(ad.get("slug") or ad.get("id") or "")
        href = f"/en/ad/{slug}" if slug and not str(slug).startswith("/") else slug
        description = str(ad.get("description") or "")
        # description often looks like "Colombo, Cars"
        area = description.split(",")[0].strip() if description else None
        row = _row_from_parts(
            cleaner=cleaner,
            seen=seen,
            archive_source=archive_source,
            observed_at=observed_at,
            snapshot_url=snapshot_url,
            title=title,
            href=href,
            price_text=str(ad.get("price") or ""),
            mileage_text=str(ad.get("details") or ""),
            area=area,
            extra_meta={"parser": "initialData", "ad_id": ad.get("id")},
        )
        if row:
            rows.append(row)
    return rows


def parse_ikman_serp_html(
    html: str,
    *,
    observed_at: datetime,
    archive_source: str = "wayback_ikman",
    snapshot_url: str = "",
) -> list[dict[str, Any]]:
    """Extract listing cards from classic HTML or modern window.initialData SERPs."""
    cleaner = CarCleaner()
    seen: set[str] = set()

    rows = _parse_initial_data_ads(
        html,
        cleaner=cleaner,
        seen=seen,
        archive_source=archive_source,
        observed_at=observed_at,
        snapshot_url=snapshot_url,
    )
    if rows:
        return rows

    soup = BeautifulSoup(html or "", "lxml")
    for item in soup.select("div.ui-item, li.ui-item, article.ui-item"):
        title_el = item.select_one("a.item-title, a[class*='item-title']")
        if title_el is None:
            continue
        title = " ".join(title_el.stripped_strings)
        href = (title_el.get("href") or "").strip()

        price_text = ""
        info_el = item.select_one(".item-info, p.item-info")
        if info_el is not None:
            price_text = info_el.get_text(" ", strip=True)
        if not price_text:
            strong = item.find("strong")
            if strong is not None:
                price_text = strong.get_text(" ", strip=True)
        if not price_text:
            match = _PRICE_RE.search(item.get_text(" ", strip=True))
            price_text = match.group(0) if match else ""

        meta_text = ""
        meta_el = item.select_one(".item-meta, p.item-meta")
        if meta_el is not None:
            meta_text = meta_el.get_text(" ", strip=True)

        area = None
        area_el = item.select_one(".item-area, span.item-area")
        if area_el is not None:
            area = area_el.get_text(" ", strip=True)

        row = _row_from_parts(
            cleaner=cleaner,
            seen=seen,
            archive_source=archive_source,
            observed_at=observed_at,
            snapshot_url=snapshot_url,
            title=title,
            href=href,
            price_text=price_text,
            mileage_text=meta_text,
            area=area,
            extra_meta={"parser": "classic_html"},
        )
        if row:
            rows.append(row)
    return rows


def fetch_cdx_hits(
    url: str,
    *,
    from_ts: str = "20170101",
    to_ts: str = "20261231",
    limit: int = 200,
    client: httpx.Client | None = None,
) -> list[CdxHit]:
    """Query Wayback CDX for successful captures of a URL."""
    params = {
        "url": url,
        "from": from_ts,
        "to": to_ts,
        "output": "json",
        "fl": "timestamp,original,statuscode",
        "filter": "statuscode:200",
        "collapse": "timestamp:6",  # roughly monthly collapse
        "limit": str(limit),
    }
    owns_client = client is None
    http = client or httpx.Client(timeout=45.0, follow_redirects=True)
    try:
        response = http.get(WAYBACK_CDX, params=params)
        response.raise_for_status()
        payload = response.json()
    finally:
        if owns_client:
            http.close()

    if not isinstance(payload, list) or len(payload) < 2:
        return []

    hits: list[CdxHit] = []
    for row in payload[1:]:
        if not isinstance(row, (list, tuple)) or len(row) < 2:
            continue
        ts, original = str(row[0]), str(row[1])
        status = str(row[2]) if len(row) > 2 else "200"
        if not ts or not original:
            continue
        hits.append(CdxHit(timestamp=ts, original=original, statuscode=status))
    return hits


def fetch_wayback_html(hit: CdxHit, *, client: httpx.Client | None = None) -> str:
    owns_client = client is None
    http = client or httpx.Client(timeout=60.0, follow_redirects=True)
    try:
        response = http.get(hit.raw_url)
        response.raise_for_status()
        return response.text
    finally:
        if owns_client:
            http.close()


def upsert_historical_observations(
    db: Session,
    rows: Iterable[dict[str, Any]],
) -> dict[str, int]:
    """Insert archive observations; skip duplicates on unique key."""
    inserted = 0
    skipped = 0
    for row in rows:
        archive_source = str(row.get("archive_source") or "").strip()
        source_id = str(row.get("source_id") or "").strip()
        observed_at = row.get("observed_at")
        price = row.get("price_lkr")
        url = str(row.get("url") or "").strip()
        if not archive_source or not source_id or observed_at is None or price is None or not url:
            skipped += 1
            continue

        existing = (
            db.query(HistoricalPriceObservation.id)
            .filter(
                HistoricalPriceObservation.archive_source == archive_source,
                HistoricalPriceObservation.source_id == source_id,
                HistoricalPriceObservation.observed_at == observed_at,
            )
            .first()
        )
        if existing:
            skipped += 1
            continue

        db.add(
            HistoricalPriceObservation(
                archive_source=archive_source,
                source_id=source_id[:120],
                observed_at=observed_at,
                url=url,
                title=(str(row.get("title") or "")[:500] or None),
                make=(str(row["make"])[:50] if row.get("make") else None),
                model=(str(row["model"])[:100] if row.get("model") else None),
                year=row.get("year"),
                price_lkr=price,
                mileage=row.get("mileage"),
                district=(str(row["district"])[:50] if row.get("district") else None),
                city=(str(row["city"])[:100] if row.get("city") else None),
                confidence=str(row.get("confidence") or "medium")[:20],
                raw_meta=row.get("raw_meta") if isinstance(row.get("raw_meta"), dict) else {},
            )
        )
        inserted += 1

    if inserted:
        db.commit()
    return {"inserted": inserted, "skipped": skipped}


def discover_ikman_cdx(
    *,
    serp_urls: Iterable[str] = DEFAULT_IKMAN_SERP_URLS,
    from_ts: str = "20170101",
    to_ts: str = "20261231",
    per_url_limit: int = 120,
    client: httpx.Client | None = None,
) -> list[CdxHit]:
    """Collect collapsed CDX hits across common ikman cars SERP URLs."""
    owns_client = client is None
    http = client or httpx.Client(timeout=45.0, follow_redirects=True)
    all_hits: list[CdxHit] = []
    seen: set[tuple[str, str]] = set()
    try:
        for url in serp_urls:
            try:
                hits = fetch_cdx_hits(
                    url,
                    from_ts=from_ts,
                    to_ts=to_ts,
                    limit=per_url_limit,
                    client=http,
                )
            except Exception as exc:
                log.warning("wayback_cdx_failed", url=url, error=str(exc))
                continue
            for hit in hits:
                key = (hit.timestamp, hit.original)
                if key in seen:
                    continue
                seen.add(key)
                all_hits.append(hit)
    finally:
        if owns_client:
            http.close()
    all_hits.sort(key=lambda h: h.timestamp)
    return all_hits
