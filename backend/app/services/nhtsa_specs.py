"""Lightweight NHTSA vPIC client for make/model catalog enrichment (free, no key)."""

from __future__ import annotations

import time
from typing import Any

import httpx
import structlog

log = structlog.get_logger()

VPIC_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles"

# Simple in-process TTL cache keyed by lowercased make name.
# Avoids hammering NHTSA on every page load for the same make.
_CACHE_TTL_SECONDS = 300
_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}


def _cache_get(key: str) -> list[dict[str, Any]] | None:
    entry = _cache.get(key)
    if entry is None:
        return None
    ts, data = entry
    if time.monotonic() - ts > _CACHE_TTL_SECONDS:
        del _cache[key]
        return None
    return data


def _cache_set(key: str, data: list[dict[str, Any]]) -> None:
    _cache[key] = (time.monotonic(), data)


def fetch_models_for_make(make: str, *, client: httpx.Client | None = None) -> list[dict[str, Any]]:
    """Return ``[{make, model, make_id, model_id, source}]`` for a manufacturer.

    Results are cached in-process for ``_CACHE_TTL_SECONDS`` seconds.
    """
    cleaned = str(make or "").strip()
    if not cleaned:
        return []

    cache_key = cleaned.lower()
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    owns = client is None
    http = client or httpx.Client(timeout=30.0, follow_redirects=True)
    try:
        response = http.get(
            f"{VPIC_BASE}/GetModelsForMake/{cleaned}",
            params={"format": "json"},
        )
        response.raise_for_status()
        payload = response.json()
    except Exception as exc:
        log.warning("nhtsa_models_failed", make=cleaned, error=str(exc))
        return []
    finally:
        if owns:
            http.close()

    results = payload.get("Results") if isinstance(payload, dict) else None
    if not isinstance(results, list):
        return []

    rows: list[dict[str, Any]] = []
    for item in results:
        if not isinstance(item, dict):
            continue
        model_name = str(item.get("Model_Name") or "").strip()
        make_name = str(item.get("Make_Name") or cleaned).strip()
        if not model_name:
            continue
        rows.append(
            {
                "make": make_name,
                "model": model_name,
                "make_id": item.get("Make_ID"),
                "model_id": item.get("Model_ID"),
                "source": "nhtsa_vpic",
            }
        )

    _cache_set(cache_key, rows)
    return rows


def lookup_specs_hint(make: str, model: str, *, client: httpx.Client | None = None) -> list[dict[str, Any]]:
    """Return NHTSA catalog entries for a make, filtered to those matching *model*.

    Matching is bidirectional substring (case-insensitive).  Falls back to the
    full make list when *model* is blank or nothing matches the filter.
    """
    models = fetch_models_for_make(make, client=client)
    if not model:
        return models
    query = str(model).strip().lower()
    filtered = [m for m in models if query in m["model"].lower() or m["model"].lower() in query]
    return filtered if filtered else models
