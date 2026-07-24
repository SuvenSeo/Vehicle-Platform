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
    ("vehicle_category", "VARCHAR(40)", "VARCHAR(40)"),
    ("content_updated_at", "TIMESTAMPTZ", "DATETIME"),
)

# (table, column, postgres type, sqlite type) — non-car_listings additive columns
_TABLE_COLUMN_PATCHES = (
    ("market_alerts", "notify_phone", "VARCHAR(32)", "VARCHAR(32)"),
    ("dealer_profiles", "verified_at", "TIMESTAMPTZ", "DATETIME"),
    ("dealer_profiles", "plan", "VARCHAR(20) NOT NULL DEFAULT 'dealer'", "VARCHAR(20) NOT NULL DEFAULT 'dealer'"),
    (
        "dealer_profiles",
        "subscription_status",
        "VARCHAR(20) NOT NULL DEFAULT 'none'",
        "VARCHAR(20) NOT NULL DEFAULT 'none'",
    ),
    ("dealer_profiles", "billing_email", "VARCHAR(255)", "VARCHAR(255)"),
    ("dealer_profiles", "current_period_end", "TIMESTAMPTZ", "DATETIME"),
    # platform_users — older prod tables predate invite-auth columns; missing any
    # of these makes ORM SELECTs 500 even when COUNT(id) still works.
    ("platform_users", "subscription_status", "VARCHAR(20) NOT NULL DEFAULT 'none'", "VARCHAR(20) NOT NULL DEFAULT 'none'"),
    ("platform_users", "role", "VARCHAR(20) NOT NULL DEFAULT 'user'", "VARCHAR(20) NOT NULL DEFAULT 'user'"),
    ("platform_users", "is_active", "BOOLEAN NOT NULL DEFAULT TRUE", "BOOLEAN NOT NULL DEFAULT 1"),
    ("platform_users", "token_version", "INTEGER NOT NULL DEFAULT 0", "INTEGER NOT NULL DEFAULT 0"),
    ("platform_users", "invited_by_email", "VARCHAR(255)", "VARCHAR(255)"),
    ("platform_users", "last_login_at", "TIMESTAMPTZ", "DATETIME"),
    ("platform_users", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
    ("platform_users", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
    ("user_invites", "role", "VARCHAR(20) NOT NULL DEFAULT 'user'", "VARCHAR(20) NOT NULL DEFAULT 'user'"),
    ("user_invites", "invited_by_email", "VARCHAR(255)", "VARCHAR(255)"),
    ("user_invites", "accepted_at", "TIMESTAMPTZ", "DATETIME"),
    ("user_invites", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
)

# (index_name, table_name, columns SQL fragment)
# Best-effort only: bounded timeouts + fail-open. Never use CONCURRENTLY here —
# these run inside a transaction with SET LOCAL, and CONCURRENTLY is not used
# elsewhere in this codebase.
_INDEX_PATCHES = (
    ("idx_car_listings_last_seen_at", "car_listings", "last_seen_at"),
    ("idx_car_listings_content_updated_at", "car_listings", "content_updated_at"),
    ("idx_car_listings_image_phash", "car_listings", "image_phash"),
    ("idx_car_listings_vehicle_category", "car_listings", "vehicle_category"),
    # Live listing filters: is_active + is_outlier (+ optional district).
    # Leftmost prefix also covers (is_active, is_outlier) without a second index.
    (
        "idx_car_listings_active_outlier_district",
        "car_listings",
        "is_active, is_outlier, district",
    ),
    (
        "idx_car_listings_live_category_price",
        "car_listings",
        "is_active, is_outlier, vehicle_category, price_lkr",
    ),
    (
        "idx_car_listings_category_first_seen",
        "car_listings",
        "vehicle_category, first_seen_at",
    ),
    ("idx_scrape_runs_started_at", "scrape_runs", "started_at"),
    ("idx_scrape_runs_source_started_at", "scrape_runs", "source, started_at"),
)

_POSTGRES_TRGM_INDEX_PATCHES = (
    (
        "idx_car_listings_make_trgm",
        "car_listings",
        "make",
    ),
    (
        "idx_car_listings_model_trgm",
        "car_listings",
        "model",
    ),
    (
        "idx_car_listings_title_trgm",
        "car_listings",
        "title",
    ),
)


def _column_exists(engine: Engine, table: str, column: str) -> bool:
    inspector = inspect(engine)
    try:
        columns = {col["name"] for col in inspector.get_columns(table)}
    except Exception:
        return False
    return column in columns


def _create_index_sql(index_name: str, table_name: str, columns: str) -> str:
    return f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({columns})"


def _ensure_historical_price_observations_table(
    engine: Engine,
    *,
    dialect: str,
    bounded_ddl,
) -> None:
    """Idempotent CREATE for the archive price table (Postgres + SQLite)."""
    inspector = inspect(engine)
    try:
        if "historical_price_observations" in inspector.get_table_names():
            return
    except Exception as exc:
        log.warning("schema_hist_table_inspect_failed", error=str(exc))

    if dialect == "postgresql":
        ddl = """
        CREATE TABLE IF NOT EXISTS historical_price_observations (
            id SERIAL PRIMARY KEY,
            archive_source VARCHAR(40) NOT NULL,
            source_id VARCHAR(120) NOT NULL,
            observed_at TIMESTAMPTZ NOT NULL,
            url TEXT NOT NULL,
            title TEXT,
            make VARCHAR(50),
            model VARCHAR(100),
            year INTEGER,
            price_lkr NUMERIC(15, 2) NOT NULL,
            mileage INTEGER,
            district VARCHAR(50),
            city VARCHAR(100),
            confidence VARCHAR(20) NOT NULL DEFAULT 'medium',
            raw_meta JSONB,
            ingested_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
        indexes = (
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_hist_price_archive_source_id_observed
            ON historical_price_observations (archive_source, source_id, observed_at)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_hist_price_make_model_observed
            ON historical_price_observations (make, model, observed_at)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_hist_price_observed_at
            ON historical_price_observations (observed_at)
            """,
        )
    else:
        ddl = """
        CREATE TABLE IF NOT EXISTS historical_price_observations (
            id INTEGER PRIMARY KEY,
            archive_source VARCHAR(40) NOT NULL,
            source_id VARCHAR(120) NOT NULL,
            observed_at DATETIME NOT NULL,
            url TEXT NOT NULL,
            title TEXT,
            make VARCHAR(50),
            model VARCHAR(100),
            year INTEGER,
            price_lkr NUMERIC(15, 2) NOT NULL,
            mileage INTEGER,
            district VARCHAR(50),
            city VARCHAR(100),
            confidence VARCHAR(20) NOT NULL DEFAULT 'medium',
            raw_meta JSON,
            ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
        indexes = (
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_hist_price_archive_source_id_observed
            ON historical_price_observations (archive_source, source_id, observed_at)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_hist_price_make_model_observed
            ON historical_price_observations (make, model, observed_at)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_hist_price_observed_at
            ON historical_price_observations (observed_at)
            """,
        )

    try:
        bounded_ddl(ddl)
        for index_sql in indexes:
            try:
                bounded_ddl(index_sql)
            except Exception as exc:
                log.warning("schema_hist_index_failed", error=str(exc))
        log.info("schema_hist_table_ensured")
    except Exception as exc:
        log.warning("schema_hist_table_failed", error=str(exc))


def apply_schema_patches(engine: Engine) -> None:
    """Add missing columns and create new tables without a full Alembic migration."""
    from db.models import Base, PlatformUser, UserInvite

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

    # Auth tables must exist before column patches and before any request can
    # poison a Postgres session by SELECTing a missing relation.
    try:
        Base.metadata.create_all(
            bind=engine,
            tables=[PlatformUser.__table__, UserInvite.__table__],
        )
    except Exception as exc:
        log.warning("schema_auth_tables_failed", error=str(exc))

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

    for table_name, column_name, pg_type, sqlite_type in _TABLE_COLUMN_PATCHES:
        if _column_exists(engine, table_name, column_name):
            continue
        if dialect == "postgresql":
            sql = (
                f"ALTER TABLE {table_name} "
                f"ADD COLUMN IF NOT EXISTS {column_name} {pg_type}"
            )
        else:
            # SQLite cannot ADD COLUMN IF NOT EXISTS on older versions — fail open.
            sql = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {sqlite_type}"
        try:
            _bounded_ddl(sql)
            log.info("schema_patch_applied", table=table_name, column=column_name)
        except Exception as exc:
            if "duplicate column" in str(exc).lower() or "no such table" in str(exc).lower():
                continue
            log.warning(
                "schema_patch_failed",
                table=table_name,
                column=column_name,
                error=str(exc),
            )

    # Ensure tables like scrape_runs / historical_price_observations exist
    # before index patches reference them. Also emit an explicit CREATE for the
    # archive table so a timed-out or partial create_all cannot leave the API
    # querying a missing relation (prod 500s on /market/summary + model-price-history).
    Base.metadata.create_all(bind=engine)
    _ensure_historical_price_observations_table(engine, dialect=dialect, bounded_ddl=_bounded_ddl)

    for index_name, table_name, columns in _INDEX_PATCHES:
        try:
            _bounded_ddl(_create_index_sql(index_name, table_name, columns))
        except Exception as exc:
            # Best-effort optimization: the nightly scrape run retries it in a
            # quieter window; never block API startup on an index build.
            log.warning(
                "schema_index_patch_failed",
                index=index_name,
                error=str(exc),
            )

    if dialect != "postgresql":
        return

    try:
        _bounded_ddl("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    except Exception as exc:
        log.warning(
            "schema_extension_patch_failed",
            extension="pg_trgm",
            error=str(exc),
        )

    for index_name, table_name, column in _POSTGRES_TRGM_INDEX_PATCHES:
        try:
            _bounded_ddl(
                f"CREATE INDEX IF NOT EXISTS {index_name} "
                f"ON {table_name} USING gin ({column} gin_trgm_ops)"
            )
        except Exception as exc:
            log.warning(
                "schema_index_patch_failed",
                index=index_name,
                error=str(exc),
            )
