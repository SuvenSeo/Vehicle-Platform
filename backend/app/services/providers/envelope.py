"""Shared enrichment payload returned to API callers.

Every third-party research card must carry provider, market scope, fetch time,
match confidence, source URL, and a plain-language limitation. A failed or
low-confidence match is an unavailable section — never a 500 on a listing page.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

DEFAULT_MIN_MATCH_CONFIDENCE = 0.6


def _min_confidence() -> float:
    raw = os.getenv("ENRICHMENT_MIN_MATCH_CONFIDENCE", "").strip()
    if not raw:
        return DEFAULT_MIN_MATCH_CONFIDENCE
    try:
        value = float(raw)
    except ValueError:
        return DEFAULT_MIN_MATCH_CONFIDENCE
    if value < 0 or value > 1:
        return DEFAULT_MIN_MATCH_CONFIDENCE
    return value


def _fetched_at() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def enrichment_unavailable(
    *,
    provider: str,
    market_scope: str,
    reason: str,
    limitation: str,
    license_note: str | None = None,
    source_url: str | None = None,
) -> dict[str, Any]:
    return {
        "available": False,
        "provider": provider,
        "market_scope": market_scope,
        "license_note": license_note,
        "fetched_at": _fetched_at(),
        "match_confidence": None,
        "source_url": source_url,
        "data": None,
        "limitation": limitation,
        "unavailable_reason": reason,
    }


def enrichment_ok(
    *,
    provider: str,
    market_scope: str,
    license_note: str,
    match_confidence: float | None,
    source_url: str | None,
    data: Any,
    limitation: str,
) -> dict[str, Any]:
    threshold = _min_confidence()
    if match_confidence is None or match_confidence < threshold:
        return enrichment_unavailable(
            provider=provider,
            market_scope=market_scope,
            reason="low_match_confidence",
            limitation=limitation,
            license_note=license_note,
            source_url=source_url,
        )
    return {
        "available": True,
        "provider": provider,
        "market_scope": market_scope,
        "license_note": license_note,
        "fetched_at": _fetched_at(),
        "match_confidence": round(float(match_confidence), 4),
        "source_url": source_url,
        "data": data,
        "limitation": limitation,
        "unavailable_reason": None,
    }
