"""Canonical vehicle research endpoints (not listing-specific)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.services.safety_research import combined_research
from db.session import get_db

router = APIRouter()


@router.get("/safety-research")
def get_vehicle_safety_research(
    make: str = Query(..., min_length=1, max_length=100),
    model: str = Query(..., min_length=1, max_length=100),
    year: Optional[int] = Query(default=None, ge=1950, le=2100),
    db: Session = Depends(get_db),
):
    return combined_research(year=year, make=make, model=model, db=db)
