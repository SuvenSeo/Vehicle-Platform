# Database module exports
from .session import (
    engine,
    SessionLocal,
    get_db,
    init_db,
    is_dual_db_mode,
    # Backward-compat aliases
    hot_engine,
    cold_engine,
    HotSessionLocal,
    ColdSessionLocal,
    get_hot_db,
    get_cold_db,
)
from .models import Base, RawListing, CarListing, PriceAggregate, Location, ScrapeRun

__all__ = [
    "engine",
    "SessionLocal",
    "get_db",
    "init_db",
    "is_dual_db_mode",
    "hot_engine",
    "cold_engine",
    "HotSessionLocal",
    "ColdSessionLocal",
    "get_hot_db",
    "get_cold_db",
    "Base",
    "RawListing",
    "CarListing",
    "PriceAggregate",
    "Location",
    "ScrapeRun",
]
