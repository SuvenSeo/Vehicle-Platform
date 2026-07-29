"""Lightweight NHTSA vPIC client for make/model catalog enrichment (free, no key)."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx
import structlog

log = structlog.get_logger()

VPIC_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles"


def _clean_text(value: object) -> str:
    return " ".join(str(value or "").strip().split())


def _model_key(value: object) -> str:
    return "".join(ch for ch in _clean_text(value).lower() if ch.isalnum())


def _decode_model_row(item: dict[str, Any], fallback_make: str) -> dict[str, Any] | None:
    model_name = _clean_text(item.get("Model_Name"))
    make_name = _clean_text(item.get("Make_Name")) or fallback_make
    if not model_name:
        return None

    row: dict[str, Any] = {
        "make": make_name,
        "model": model_name,
        "make_id": item.get("Make_ID"),
        "model_id": item.get("Model_ID"),
        "source": "nhtsa_vpic",
    }
    vehicle_type = _clean_text(item.get("VehicleTypeName"))
    if vehicle_type:
        row["vehicle_type"] = vehicle_type
    return row


def _fetch_vpic_results(
    path: str,
    *,
    params: dict[str, object] | None = None,
    client: httpx.Client | None = None,
    log_event: str,
    log_context: dict[str, object],
) -> list[dict[str, Any]]:
    owns = client is None
    http = client or httpx.Client(timeout=30.0, follow_redirects=True)
    try:
        response = http.get(
            f"{VPIC_BASE}/{path}",
            params={"format": "json", **(params or {})},
        )
        response.raise_for_status()
        payload = response.json()
    except Exception as exc:
        log.warning(log_event, **log_context, error=str(exc))
        return []
    finally:
        if owns:
            http.close()

    results = payload.get("Results") if isinstance(payload, dict) else None
    if not isinstance(results, list):
        return []
    return [item for item in results if isinstance(item, dict)]


def get_make_model_catalog(
    make: str,
    *,
    year: int | None = None,
    client: httpx.Client | None = None,
) -> list[dict[str, Any]]:
    """Return normalized vPIC model rows for a make, optionally scoped to a model year."""
    cleaned_make = _clean_text(make)
    if not cleaned_make:
        return []

    make_path = quote(cleaned_make, safe="")
    if year is not None:
        rows = _fetch_vpic_results(
            f"GetModelsForMakeYear/make/{make_path}/modelyear/{int(year)}",
            client=client,
            log_event="nhtsa_models_for_make_year_failed",
            log_context={"make": cleaned_make, "year": int(year)},
        )
    else:
        rows = _fetch_vpic_results(
            f"GetModelsForMake/{make_path}",
            client=client,
            log_event="nhtsa_models_failed",
            log_context={"make": cleaned_make},
        )

    catalog: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for item in rows:
        row = _decode_model_row(item, cleaned_make)
        if row is None:
            continue
        key = (_model_key(row["make"]), _model_key(row["model"]))
        if key in seen:
            continue
        seen.add(key)
        catalog.append(row)
    return catalog


def fetch_models_for_make(make: str, *, client: httpx.Client | None = None) -> list[dict[str, Any]]:
    """Return ``[{make, model, make_id, model_id}, ...]`` for a manufacturer."""
    return get_make_model_catalog(make, client=client)


def fetch_vehicle_variables_for_make_model(
    make: str,
    model: str,
    year: int | None = None,
    *,
    client: httpx.Client | None = None,
) -> list[dict[str, Any]]:
    """Return vPIC catalog rows matching a listing's make/model/year when available."""
    cleaned_make = _clean_text(make)
    cleaned_model = _clean_text(model)
    if not cleaned_make or not cleaned_model:
        return []

    catalog = get_make_model_catalog(cleaned_make, year=year, client=client)
    if not catalog:
        return []

    wanted = _model_key(cleaned_model)
    exact = [row for row in catalog if _model_key(row.get("model")) == wanted]
    if exact:
        return exact

    return [
        row
        for row in catalog
        if wanted and (wanted in _model_key(row.get("model")) or _model_key(row.get("model")) in wanted)
    ]
