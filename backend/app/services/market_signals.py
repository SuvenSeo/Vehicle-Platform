from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import re
from typing import Any
from urllib.parse import urljoin

import httpx
import structlog
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from db.models import MarketSignal

log = structlog.get_logger()


@dataclass(frozen=True)
class MarketSignalSource:
    key: str
    source: str
    signal_type: str
    category: str
    url: str
    metric: str
    link_terms: tuple[str, ...] = ()


MARKET_SIGNAL_SOURCES = (
    MarketSignalSource(
        key="dmt_registrations",
        source="dmt",
        signal_type="registrations",
        category="official",
        url="https://dmt.gov.lk/index.php?Itemid=132&id=16&lang=en&option=com_content&view=article",
        metric="document_count",
        link_terms=("registration", "registrations"),
    ),
    MarketSignalSource(
        key="dmt_transfers",
        source="dmt",
        signal_type="transfers",
        category="official",
        url="https://dmt.gov.lk/index.php?Itemid=132&id=16&lang=en&option=com_content&view=article",
        metric="document_count",
        link_terms=("transfer", "transfers"),
    ),
    MarketSignalSource(
        key="customs_tenders",
        source="customs",
        signal_type="tender_sales",
        category="official",
        url="https://www.customs.gov.lk/tender-sales/",
        metric="vehicle_tender_count",
        link_terms=("vehicle_tender", "vehicle tender"),
    ),
    MarketSignalSource(
        key="import_parity",
        source="import_parity",
        signal_type="landed_cost",
        category="import_cost",
        url="https://cardreams.lk/about",
        metric="reference_page_available",
    ),
)


def _clean_text(value: Any, max_len: int | None = None) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if max_len is not None:
        return text[:max_len]
    return text


def build_market_signal_records(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for row in rows:
        source = _clean_text(row.get("source"), 40)
        signal_type = _clean_text(row.get("signal_type"), 60)
        metric = _clean_text(row.get("metric"), 80)
        source_url = _clean_text(row.get("source_url"))
        if not source or not signal_type or not metric or not source_url:
            continue

        raw_value = row.get("value_numeric")
        try:
            value_numeric = None if raw_value is None else float(raw_value)
        except (TypeError, ValueError):
            value_numeric = None

        records.append(
            {
                "source": source,
                "signal_type": signal_type,
                "metric": metric,
                "value_numeric": value_numeric,
                "unit": _clean_text(row.get("unit"), 30) or None,
                "category": _clean_text(row.get("category"), 80) or None,
                "source_url": source_url,
                "raw_meta": row.get("raw_meta") if isinstance(row.get("raw_meta"), dict) else {},
            }
        )
    return records


class MarketSignalImporter:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _extract_matching_links(html: str, base_url: str, terms: tuple[str, ...]) -> list[dict[str, str]]:
        if not terms:
            return []

        soup = BeautifulSoup(html or "", "lxml")
        matched: list[dict[str, str]] = []
        seen: set[str] = set()

        for link in soup.select("a[href]"):
            href = str(link.get("href") or "").strip()
            if not href:
                continue
            label = _clean_text(link.get_text(" ", strip=True))
            haystack = f"{label} {href}".lower().replace("-", "_")
            if not any(term.lower().replace("-", "_") in haystack for term in terms):
                continue
            resolved = urljoin(base_url, href)
            if resolved in seen:
                continue
            seen.add(resolved)
            matched.append({"title": label or resolved.rsplit("/", 1)[-1], "url": resolved})

        return matched

    @staticmethod
    def _extract_page_title(html: str) -> str:
        soup = BeautifulSoup(html or "", "lxml")
        title = soup.select_one("title")
        if title:
            return _clean_text(title.get_text(" ", strip=True), 200)
        heading = soup.select_one("h1")
        return _clean_text(heading.get_text(" ", strip=True), 200) if heading else ""

    def _fetch_records_for_source(self, client: httpx.Client, source: MarketSignalSource) -> list[dict[str, Any]]:
        response = client.get(source.url, timeout=30)
        response.raise_for_status()
        links = self._extract_matching_links(response.text, source.url, source.link_terms)
        page_title = self._extract_page_title(response.text)

        if source.metric == "reference_page_available":
            value = 1
        else:
            value = len(links)

        latest_link = links[0] if links else None
        return build_market_signal_records(
            [
                {
                    "source": source.source,
                    "signal_type": source.signal_type,
                    "metric": source.metric,
                    "value_numeric": value,
                    "unit": "count" if source.metric.endswith("_count") else "boolean",
                    "category": source.category,
                    "source_url": source.url,
                    "raw_meta": {
                        "source_key": source.key,
                        "page_title": page_title,
                        "http_status": response.status_code,
                        "latest_link": latest_link,
                        "matched_links": links[:10],
                    },
                }
            ]
        )

    def _upsert_signal(self, record: dict[str, Any], observed_at: datetime):
        existing = (
            self.db.query(MarketSignal)
            .filter(
                MarketSignal.source == record["source"],
                MarketSignal.signal_type == record["signal_type"],
                MarketSignal.metric == record["metric"],
                MarketSignal.category == record.get("category"),
                MarketSignal.source_url == record["source_url"],
                MarketSignal.period_year == observed_at.year,
                MarketSignal.period_month == observed_at.month,
            )
            .first()
        )

        values = {
            "value_numeric": record.get("value_numeric"),
            "unit": record.get("unit"),
            "raw_meta": record.get("raw_meta") or {},
            "observed_at": observed_at,
        }
        if existing:
            for key, value in values.items():
                setattr(existing, key, value)
            return False

        self.db.add(
            MarketSignal(
                source=record["source"],
                signal_type=record["signal_type"],
                metric=record["metric"],
                category=record.get("category"),
                source_url=record["source_url"],
                period_year=observed_at.year,
                period_month=observed_at.month,
                **values,
            )
        )
        return True

    def sync(self) -> dict[str, int]:
        observed_at = datetime.utcnow()
        inserted = 0
        updated = 0
        failed = 0

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        }
        with httpx.Client(headers=headers, follow_redirects=True, timeout=30) as client:
            for source in MARKET_SIGNAL_SOURCES:
                try:
                    for record in self._fetch_records_for_source(client, source):
                        created = self._upsert_signal(record, observed_at)
                        if created:
                            inserted += 1
                        else:
                            updated += 1
                    self.db.commit()
                except Exception as exc:
                    self.db.rollback()
                    failed += 1
                    log.warning("market_signal_source_failed", source=source.key, error=str(exc))

        return {"inserted": inserted, "updated": updated, "failed": failed}
