"""EV ownership utilities backed by locally cached enrichment data."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.services.openchargemap import ATTRIBUTION, COLOMBO, nearby_stations
from db.session import get_db

router = APIRouter()


@router.get("/charging-stations")
def get_charging_stations(
    lat: float = Query(default=COLOMBO[0], ge=-90, le=90),
    lng: float = Query(default=COLOMBO[1], ge=-180, le=180),
    radius_km: float = Query(default=25, ge=1, le=250),
    db: Session = Depends(get_db),
):
    stations = nearby_stations(db, lat=lat, lng=lng, radius_km=radius_km)
    return {
        "count": len(stations),
        "lat": lat,
        "lng": lng,
        "radius_km": radius_km,
        "attribution": ATTRIBUTION,
        "limitation": "Cached Sri Lanka Open Charge Map points. Status may be stale; confirm before you travel.",
        "stations": stations,
    }
