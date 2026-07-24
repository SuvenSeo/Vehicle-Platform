"""Common Crawl densify for ikman SERP pages missed by Wayback.

Uses the CC index API + ranged WARC fetches (never downloads whole WARCs).
Parsed rows land in ``historical_price_observations`` with archive_source
``commoncrawl_ikman``.
"""

from __future__ import annotations

import gzip
import io
import json
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable
from urllib.parse import quote

import httpx
import structlog

from app.services.historical_archive import parse_ikman_serp_html

log = structlog.get_logger()

CC_COLLINFO = "https://index.commoncrawl.org/collinfo.json"
CC_DATA = "https://data.commoncrawl.org/"

# Known-good fully indexed crawls (newest CC indexes often 404 for our URLs).
FALLBACK_CRAWLS = (
    "CC-MAIN-2024-10",
    "CC-MAIN-2024-18",
    "CC-MAIN-2024-22",
    "CC-MAIN-2024-26",
    "CC-MAIN-2024-30",
    "CC-MAIN-2024-33",
    "CC-MAIN-2024-38",
    "CC-MAIN-2024-42",
    "CC-MAIN-2024-46",
    "CC-MAIN-2024-51",
    "CC-MAIN-2023-50",
    "CC-MAIN-2023-40",
    "CC-MAIN-2023-23",
    "CC-MAIN-2022-49",
    "CC-MAIN-2022-27",
    "CC-MAIN-2021-43",
    "CC-MAIN-2020-50",
    "CC-MAIN-2019-51",
    "CC-MAIN-2018-51",
)

DEFAULT_CC_URL_PATTERNS = (
    "ikman.lk/en/ads/sri-lanka/cars",
    "ikman.lk/en/ads/sri-lanka/cars/toyota",
    "ikman.lk/en/ads/sri-lanka/cars/suzuki",
    "ikman.lk/en/ads/sri-lanka/cars/honda",
    "ikman.lk/en/ads/sri-lanka/cars/nissan",
    "ikman.lk/en/ads/sri-lanka/cars/mitsubishi",
)


@dataclass(frozen=True)
class CcHit:
    timestamp: str
    url: str
    filename: str
    offset: int
    length: int
    status: str = "200"
    crawl_id: str = ""

    @property
    def observed_at(self) -> datetime:
        return datetime.strptime(self.timestamp[:14], "%Y%m%d%H%M%S").replace(
            tzinfo=timezone.utc
        )


def list_recent_crawls(limit: int = 12, *, client: httpx.Client | None = None) -> list[dict[str, str]]:
    """Return CDX API endpoints for indexed crawls.

    Prefers a curated fallback list of known-good crawl IDs because the newest
    entries in collinfo.json frequently return 404 for domain queries.
    """
    owns = client is None
    http = client or httpx.Client(timeout=45.0, follow_redirects=True)
    by_id: dict[str, str] = {}
    try:
        try:
            response = http.get(CC_COLLINFO)
            response.raise_for_status()
            payload = response.json()
            if isinstance(payload, list):
                for row in payload:
                    cid = str(row.get("id") or "")
                    api = str(row.get("cdx-api") or "")
                    if cid and api:
                        by_id[cid] = api
        except Exception as exc:
            log.warning("cc_collinfo_failed", error=str(exc))

        crawls: list[dict[str, str]] = []
        for cid in FALLBACK_CRAWLS:
            api = by_id.get(cid) or f"https://index.commoncrawl.org/{cid}-index"
            crawls.append({"id": cid, "cdx_api": api})
            if len(crawls) >= limit:
                break
        return crawls
    finally:
        if owns:
            http.close()


def fetch_cc_index_hits(
    *,
    url_pattern: str,
    cdx_api: str,
    crawl_id: str,
    limit: int = 40,
    client: httpx.Client | None = None,
    retries: int = 2,
) -> list[CcHit]:
    params = {
        "url": url_pattern if "*" in url_pattern else f"{url_pattern}*",
        "output": "json",
        "filter": "status:200",
        "limit": str(limit),
    }
    owns = client is None
    http = client or httpx.Client(timeout=60.0, follow_redirects=True)
    hits: list[CcHit] = []
    try:
        last_status = None
        for attempt in range(1, retries + 1):
            response = http.get(cdx_api, params=params)
            last_status = response.status_code
            if response.status_code == 404:
                # Common Crawl returns 404 JSON when the query has no captures.
                return []
            if response.status_code >= 500 and attempt < retries:
                time.sleep(0.5 * attempt)
                continue
            if response.status_code >= 400:
                log.warning(
                    "cc_index_failed",
                    crawl=crawl_id,
                    status=response.status_code,
                )
                return []
            for line in response.text.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if int(row.get("status") or 0) != 200:
                    continue
                try:
                    hits.append(
                        CcHit(
                            timestamp=str(row["timestamp"]),
                            url=str(row["url"]),
                            filename=str(row["filename"]),
                            offset=int(row["offset"]),
                            length=int(row["length"]),
                            status=str(row.get("status") or "200"),
                            crawl_id=crawl_id,
                        )
                    )
                except (KeyError, TypeError, ValueError):
                    continue
            break
        if last_status and last_status >= 400:
            return []
    finally:
        if owns:
            http.close()
    return hits


def discover_common_crawl_hits(
    *,
    url_patterns: Iterable[str] = DEFAULT_CC_URL_PATTERNS,
    crawl_limit: int = 10,
    per_query_limit: int = 30,
    client: httpx.Client | None = None,
) -> list[CcHit]:
    owns = client is None
    http = client or httpx.Client(timeout=httpx.Timeout(90.0, connect=20.0), follow_redirects=True)
    all_hits: list[CcHit] = []
    seen: set[tuple[str, str]] = set()
    try:
        crawls = list_recent_crawls(limit=crawl_limit, client=http)
        print(f"cc_crawls={[c['id'] for c in crawls]}", flush=True)
        for crawl in crawls:
            for pattern in url_patterns:
                try:
                    hits = fetch_cc_index_hits(
                        url_pattern=pattern,
                        cdx_api=crawl["cdx_api"],
                        crawl_id=crawl["id"],
                        limit=per_query_limit,
                        client=http,
                    )
                except Exception as exc:
                    log.warning(
                        "cc_discover_failed",
                        crawl=crawl["id"],
                        pattern=pattern,
                        error=str(exc),
                    )
                    continue
                for hit in hits:
                    key = (hit.timestamp, hit.url)
                    if key in seen:
                        continue
                    # Keep SERP-like pages, skip deep ad detail pages.
                    path = hit.url.lower()
                    if "/en/ad/" in path:
                        continue
                    if "/en/ads/sri-lanka/cars" not in path:
                        continue
                    seen.add(key)
                    all_hits.append(hit)
    finally:
        if owns:
            http.close()
    all_hits.sort(key=lambda h: h.timestamp)
    return all_hits


_WARC_HTTP_RE = re.compile(rb"\r?\n\r?\n", re.MULTILINE)


def fetch_cc_warc_html(hit: CcHit, *, client: httpx.Client | None = None) -> str:
    """Fetch one WARC record by byte range and return response body HTML."""
    owns = client is None
    http = client or httpx.Client(timeout=90.0, follow_redirects=True)
    start = hit.offset
    end = hit.offset + hit.length - 1
    url = f"{CC_DATA}{hit.filename}"
    try:
        response = http.get(url, headers={"Range": f"bytes={start}-{end}"})
        response.raise_for_status()
        raw = response.content
        try:
            payload = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
        except OSError:
            payload = raw
        # WARC/HTTP headers then body
        parts = _WARC_HTTP_RE.split(payload, maxsplit=2)
        body = parts[-1] if parts else payload
        # If still looks like HTTP response, strip one more header block.
        if body.startswith(b"HTTP/"):
            parts2 = _WARC_HTTP_RE.split(body, maxsplit=1)
            body = parts2[-1] if len(parts2) > 1 else body
        return body.decode("utf-8", errors="ignore")
    finally:
        if owns:
            http.close()


def rows_from_cc_hit(hit: CcHit, html: str) -> list[dict[str, Any]]:
    rows = parse_ikman_serp_html(
        html,
        observed_at=hit.observed_at,
        archive_source="commoncrawl_ikman",
        snapshot_url=f"cc://{hit.crawl_id}/{quote(hit.url, safe='')}",
    )
    for row in rows:
        meta = dict(row.get("raw_meta") or {})
        meta.update(
            {
                "cc_crawl": hit.crawl_id,
                "cc_url": hit.url,
                "cc_filename": hit.filename,
            }
        )
        row["raw_meta"] = meta
        row["confidence"] = "low"
    return rows
