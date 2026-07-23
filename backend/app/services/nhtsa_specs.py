"""Lightweight NHTSA vPIC client for make/model catalog enrichment (free, no key)."""

from __future__ import annotations

from typing import Any

import httpx
import structlog

log = structlog.get_logger()

VPIC_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles"


def fetch_models_for_make(make: str, *, client: httpx.Client | None = None) -> list[dict[str, Any]]:
    """Return ``[{make, model, make_id, model_id}, ...]`` for a manufacturer."""
    cleaned = str(make or "").strip()
    if not cleaned:
        return []

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
    return rows
