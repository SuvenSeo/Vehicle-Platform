"""Import-era classification for Sri Lanka's 2025 vehicle import freeze.

Sri Lanka imposed strict import controls on vehicles.  Listings with a
manufacture/registration year up to and including 2024 belong to the
*pre-freeze* cohort (older stock, typically higher relative supply).
Listings from 2025 onwards belong to the *post-freeze* cohort (newer
stock under tighter supply constraints, usually commanding a premium).

Year is used as the proxy because most listings record the manufacture
year rather than the import date.
"""

from __future__ import annotations

from typing import Literal

ImportEra = Literal["pre_freeze", "post_freeze"]

FREEZE_BOUNDARY_YEAR: int = 2025
"""First manufacture year classified as post-freeze (>= this value)."""


def classify_import_era(year: int | None) -> ImportEra | None:
    """Return the import-era label for *year*, or ``None`` when year is absent.

    >>> classify_import_era(2024)
    'pre_freeze'
    >>> classify_import_era(2025)
    'post_freeze'
    >>> classify_import_era(2030)
    'post_freeze'
    >>> classify_import_era(2000)
    'pre_freeze'
    >>> classify_import_era(None) is None
    True
    """
    if year is None:
        return None
    return "post_freeze" if year >= FREEZE_BOUNDARY_YEAR else "pre_freeze"


def era_label(era: ImportEra) -> str:
    """Human-readable label for an era."""
    return "Pre-freeze (≤2024)" if era == "pre_freeze" else "Post-freeze (≥2025)"
