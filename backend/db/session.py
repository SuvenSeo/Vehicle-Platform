import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv(".env.local", usecwd=True), override=False)
load_dotenv()

# ============================================================================
# Dual database mode
# HOT_DATABASE_URL  = Supabase — API reads, market analysis
# COLD_DATABASE_URL = NeonDB  — scraper writes
#
# If only one URL is set both engines point to it (single-DB fallback).
# ALLOW_SQLITE_FALLBACK=true lets local dev work without any Postgres URL.
# ============================================================================

def _normalise(url: str) -> str:
    url = url.strip()
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://"):]
    return url

def _validate(url: str, label: str) -> str:
    if url.startswith("http://") or url.startswith("https://"):
        raise ValueError(
            f"[CONFIG ERROR] {label} looks like a web URL, not a PostgreSQL DSN.\n"
            f"  Got: {url[:60]}"
        )
    return url

_hot_raw  = os.getenv("HOT_DATABASE_URL", "").strip()
_cold_raw = os.getenv("COLD_DATABASE_URL") or os.getenv("DATABASE_URL") or ""
_cold_raw = _cold_raw.strip()

HOT_URL  = _normalise(_hot_raw)  if _hot_raw  else ""
COLD_URL = _normalise(_cold_raw) if _cold_raw else ""

allow_sqlite_fallback = os.getenv("ALLOW_SQLITE_FALLBACK", "false").lower() == "true"

if not HOT_URL and not COLD_URL:
    if not allow_sqlite_fallback:
        raise ValueError(
            "No database URL configured. Set HOT_DATABASE_URL and/or COLD_DATABASE_URL."
        )
    HOT_URL = COLD_URL = "sqlite:///./autolens.db"
elif not HOT_URL:
    HOT_URL = COLD_URL   # single-DB: reads also go to Neon
elif not COLD_URL:
    COLD_URL = HOT_URL   # single-DB: writes also go to Supabase

for url, label in [(HOT_URL, "HOT_DATABASE_URL"), (COLD_URL, "COLD_DATABASE_URL")]:
    _validate(url, label)

def _make_engine(url: str):
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    # Bounded connect + statement time for remote Postgres (HF Spaces / poolers).
    # NullPool kept: serverless/Space workers should not hold idle pooled conns.
    return create_engine(
        url,
        poolclass=NullPool,
        pool_pre_ping=True,
        connect_args={
            "connect_timeout": 5,
            "options": "-c statement_timeout=15000",
        },
    )

hot_engine  = _make_engine(HOT_URL)
cold_engine = _make_engine(COLD_URL)

# Use the same engine object when both URLs are identical (avoids double pool)
if HOT_URL == COLD_URL:
    cold_engine = hot_engine

HotSessionLocal  = sessionmaker(autocommit=False, autoflush=False, bind=hot_engine)
ColdSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cold_engine)

# Default session — HOT (Supabase) for the API layer
engine       = hot_engine
SessionLocal = HotSessionLocal


def get_db():
    db = HotSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_hot_db():
    db = HotSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_cold_db():
    db = ColdSessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create missing tables/columns on cold and hot databases."""
    from .schema_patches import apply_schema_patches

    apply_schema_patches(cold_engine)
    if hot_engine is not cold_engine:
        apply_schema_patches(hot_engine)


def is_dual_db_mode() -> bool:
    return HOT_URL != COLD_URL
