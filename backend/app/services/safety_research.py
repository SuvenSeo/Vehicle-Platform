"""Combined safety + reliability research envelope for listings and hubs."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.services.nhtsa_safety import research_vehicle
from app.services.problemsbyvin import lookup_reliability
from app.services.providers.identity import canonical_vehicle_key


def combined_research(
    *,
    year: Any,
    make: Any,
    model: Any,
    db: Session | None = None,
    listing_id: int | None = None,
    client: Any | None = None,
) -> dict[str, Any]:
    try:
        safety = research_vehicle(year, make, model, client=client, db=db)
    except Exception:
        from app.services.nhtsa_safety import _unavailable

        safety = _unavailable("upstream_error")
    try:
        reliability = lookup_reliability(db, year, make, model)
    except Exception:
        from app.services.problemsbyvin import _unavailable as _rel_unavailable

        reliability = _rel_unavailable("no_snapshot")
    return {
        "listing_id": listing_id,
        "year": int(year) if str(year).isdigit() else year,
        "make": make,
        "model": model,
        "vehicle_key": canonical_vehicle_key(year, make, model),
        "safety": safety,
        "reliability": reliability,
    }
