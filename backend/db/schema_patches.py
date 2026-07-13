"""Lightweight schema patches for production DBs created before new columns/tables."""

from __future__ import annotations

import structlog
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

log = structlog.get_logger()

_CAR_LISTING_COLUMN_PATCHES = (
    ("thumbnail_url_cached", "TEXT"),
)


def _column_exists(engine: Engine, table: str, column: str) -> bool:
    inspector = inspect(engine)
    try:
        columns = {col["name"] for col in inspector.get_columns(table)}
    except Exception:
        return False
    return column in columns


def apply_schema_patches(engine: Engine) -> None:
    """Add missing columns and create new tables without a full Alembic migration."""
    from db.models import Base

    dialect = engine.dialect.name

    with engine.begin() as conn:
        for column_name, column_type in _CAR_LISTING_COLUMN_PATCHES:
            if _column_exists(engine, "car_listings", column_name):
                continue
            if dialect == "postgresql":
                sql = (
                    f"ALTER TABLE car_listings "
                    f"ADD COLUMN IF NOT EXISTS {column_name} {column_type}"
                )
            else:
                sql = f"ALTER TABLE car_listings ADD COLUMN {column_name} {column_type}"
            try:
                conn.execute(text(sql))
                log.info("schema_patch_applied", table="car_listings", column=column_name)
            except Exception as exc:
                if "duplicate column" in str(exc).lower():
                    continue
                log.warning(
                    "schema_patch_failed",
                    table="car_listings",
                    column=column_name,
                    error=str(exc),
                )

    Base.metadata.create_all(bind=engine)
