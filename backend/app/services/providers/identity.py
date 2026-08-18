"""Canonical vehicle identity used to join listings to enrichment providers."""

from __future__ import annotations

from typing import Any


def _norm(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().split())


def canonical_vehicle_key(
    year: Any,
    make: Any,
    model: Any,
    trim: Any | None = None,
) -> str | None:
    """Return ``year|make|model`` (optionally ``|trim``) or ``None`` if incomplete."""
    try:
        year_int = int(year)
    except (TypeError, ValueError):
        return None
    make_n = _norm(make)
    model_n = _norm(model)
    if year_int < 1900 or year_int > 2100 or not make_n or not model_n:
        return None
    trim_n = _norm(trim) if trim is not None else ""
    if trim_n:
        return f"{year_int}|{make_n}|{model_n}|{trim_n}"
    return f"{year_int}|{make_n}|{model_n}"
