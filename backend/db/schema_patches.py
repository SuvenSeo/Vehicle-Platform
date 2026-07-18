"""Lightweight schema patches for production DBs created before new columns/tables."""

from __future__ import annotations

import structlog
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

log = structlog.get_logger()

# (column, postgres type/default, sqlite type/default)
_CAR_LISTING_COLUMN_PATCHES = (
    ("thumbnail_url_cached", "TEXT", "TEXT"),
    ("is_active", "BOOLEAN NOT NULL DEFAULT TRUE", "BOOLEAN NOT NULL DEFAULT 1"),
    ("image_phash", "VARCHAR(16)", "VARCHAR(16)"),
)

_CAR_LISTING_INDEX_PATCHES = (
    ("idx_car_listings_last_seen_at", "car_listings", "last_seen_at"),
    ("idx_car_listings_image_phash", "car_listings", "image_phash"),
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

    # Each statement gets its own transaction: on Postgres a failed statement
    # aborts the surrounding transaction, which would otherwise roll back
    # patches already logged as applied.
    #
    # DDL here runs inside API startup, which has a hard timeout — every
    # statement gets bounded lock/statement timeouts on Postgres so a busy
    # table degrades to a logged warning instead of hanging startup (a
    # blocking CREATE INDEX took the HF Space down on 2026-07-16).
    def _bounded_ddl(sql: str) -> None:
        with engine.begin() as conn:
            if dialect == "postgresql":
                conn.execute(text("SET LOCAL lock_timeout = '5s'"))
                conn.execute(text("SET LOCAL statement_timeout = '15s'"))
            conn.execute(text(sql))

    for column_name, pg_type, sqlite_type in _CAR_LISTING_COLUMN_PATCHES:
        if _column_exists(engine, "car_listings", column_name):
            continue
        if dialect == "postgresql":
            sql = (
                f"ALTER TABLE car_listings "
                f"ADD COLUMN IF NOT EXISTS {column_name} {pg_type}"
            )
        else:
            sql = f"ALTER TABLE car_listings ADD COLUMN {column_name} {sqlite_type}"
        try:
            _bounded_ddl(sql)
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

    for index_name, table_name, column_name in _CAR_LISTING_INDEX_PATCHES:
        try:
            _bounded_ddl(
                f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({column_name})"
            )
        except Exception as exc:
            # Best-effort optimization: the nightly scrape run retries it in a
            # quieter window; never block API startup on an index build.
            log.warning(
                "schema_index_patch_failed",
                index=index_name,
                error=str(exc),
            )

    Base.metadata.create_all(bind=engine)
