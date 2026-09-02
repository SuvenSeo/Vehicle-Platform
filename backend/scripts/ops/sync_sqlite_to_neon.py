#!/usr/bin/env python3
"""Sync new listings from motormila.db into Neon PostgreSQL with robust retries."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from datetime import datetime

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")

from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

from db.models import CarListing

CHUNK = 500

BOOL_COLS = {"is_outlier", "is_duplicate", "is_active"}
DATETIME_COLS = {"scraped_at", "first_seen_at", "last_seen_at", "content_updated_at"}

def coerce_for_postgres(row: dict) -> dict:
    d = dict(row)
    d["duplicate_of"] = None
    for col in BOOL_COLS:
        if col in d and d[col] is not None:
            d[col] = bool(d[col])
    for col in DATETIME_COLS:
        val = d.get(col)
        if isinstance(val, str):
            try:
                d[col] = datetime.fromisoformat(val.replace("Z", "+00:00"))
            except ValueError:
                pass
    return d

def get_pg_engine(pg_url):
    return create_engine(
        pg_url,
        poolclass=NullPool,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 20, "keepalives": 1, "keepalives_idle": 30, "keepalives_interval": 10},
    )

def main():
    pg_url = os.getenv("DATABASE_URL") or os.getenv("HOT_DATABASE_URL") or ""
    if not pg_url or "sqlite" in pg_url:
        print("DATABASE_URL must be a PostgreSQL URL")
        return 1

    sqlite_path = BACKEND_DIR / "motormila.db"
    if not sqlite_path.exists():
        print("motormila.db not found")
        return 1

    sq_engine = create_engine(f"sqlite:///{sqlite_path}")
    pg_engine = get_pg_engine(pg_url)

    print("Fetching existing Neon (source, source_id) keys...")
    with pg_engine.connect() as conn:
        existing_keys = set(
            conn.execute(text("SELECT source, source_id FROM car_listings")).fetchall()
        )
    print(f"Neon currently has {len(existing_keys)} listings.")

    cols = [c.name for c in CarListing.__table__.columns if c.name != "id"]
    col_list = ", ".join(cols)
    placeholders = ", ".join(f":{c}" for c in cols)

    with sq_engine.connect() as sconn:
        all_sqlite = sconn.execute(text(f"SELECT source, source_id, {col_list} FROM car_listings")).mappings().all()

    new_rows = [coerce_for_postgres(r) for r in all_sqlite if (r["source"], r["source_id"]) not in existing_keys]
    print(f"Found {len(new_rows)} new listings to insert into Neon DB.")

    if new_rows:
        inserted = 0
        for i in range(0, len(new_rows), CHUNK):
            batch = new_rows[i:i + CHUNK]
            retries = 3
            while retries > 0:
                try:
                    with pg_engine.begin() as pconn:
                        pconn.execute(
                            text(f"INSERT INTO car_listings ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"),
                            batch,
                        )
                    inserted += len(batch)
                    if inserted % 2500 == 0 or inserted == len(new_rows):
                        print(f"  inserted into Neon: {inserted}/{len(new_rows)} ({inserted/len(new_rows)*100:.1f}%)")
                    break
                except Exception as e:
                    retries -= 1
                    print(f"  Batch retry ({retries} left) due to: {e}")
                    time.sleep(2)
                    pg_engine.dispose()
                    pg_engine = get_pg_engine(pg_url)
                    if retries == 0:
                        raise

    with pg_engine.connect() as conn:
        neon_total = conn.execute(text("SELECT COUNT(*) FROM car_listings")).scalar()
    print(f"\nSUCCESS: Neon DB total car_listings is now: {neon_total}")


if __name__ == "__main__":
    main()
