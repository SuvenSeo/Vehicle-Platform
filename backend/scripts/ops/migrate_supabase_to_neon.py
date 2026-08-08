#!/usr/bin/env python3
"""Migrate vehicle-platform data from Supabase into Neon.

Two source modes:
  --direct            SUPABASE_DSN env (reset postgres password) — fast path
  (default)           SUPABASE_PAT + SUPABASE_REF (Management API SQL endpoint)

Destination: NEON_DSN env.

Tables:
  car_listings            upsert ON CONFLICT (source, source_id), keeps the
                          row with the newer scraped_at; duplicate_of and
                          location_id are nulled (ids are re-assigned).
  historical_price_observations, price_aggregates, market_signals,
  market_stats_cache, platform_users, user_invites, scrape_runs
                          additive ON CONFLICT (id) DO NOTHING.
  vehicle_price_history   skipped (FK to car_listings.id, cannot remap).

Usage:
    SUPABASE_DSN=<dsn> NEON_DSN=<dsn> \\
        python migrate_supabase_to_neon.py --direct [--only car_listings]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from decimal import Decimal
from urllib import error as url_error
from urllib import request as url_request

import psycopg2
from psycopg2.extras import Json

CAR_LISTING_COLS = [
    "raw_id", "source", "source_id", "scraped_at", "first_seen_at",
    "last_seen_at", "title", "url", "make", "model", "year", "price_lkr",
    "mileage", "fuel_type", "transmission", "engine_capacity", "condition",
    "body_type", "raw_location", "district", "city", "location_id",
    "thumbnail_url", "deal_score", "market_median_lkr", "is_outlier",
    "outlier_reason", "is_duplicate", "duplicate_of", "thumbnail_url_cached",
    "is_active", "image_phash", "vehicle_category", "content_updated_at",
]
SECONDARY_TABLES = [
    "historical_price_observations", "price_aggregates", "market_signals",
    "market_stats_cache", "platform_users", "user_invites", "scrape_runs",
]
BATCH = 5000
_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


# --------------------------------------------------------------------------
# Supabase Management API fallback (used only when no direct DSN is given)
# --------------------------------------------------------------------------
def sq(pat: str, ref: str, query: str, tries: int = 6) -> list[dict] | dict:
    req = url_request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={
            "Authorization": f"Bearer {pat}",
            "Content-Type": "application/json",
            "User-Agent": _BROWSER_UA,
        },
        method="POST",
    )
    for i in range(tries):
        try:
            with url_request.urlopen(req, timeout=90) as resp:
                return json.load(resp)
        except url_error.HTTPError as e:
            body = e.read().decode()[:200]
            if e.code in (403, 429) and i < tries - 1:
                time.sleep(15 * (i + 1))
                continue
            return {"__err": f"HTTP {e.code}: {body}"}
        except Exception:  # noqa: BLE001
            if i < tries - 1:
                time.sleep(12)
                continue
            raise
    return {"__err": "exhausted retries"}


# --------------------------------------------------------------------------
# Value conversion
# --------------------------------------------------------------------------
def parse_dt(v) -> datetime | None:
    if v is None or isinstance(v, datetime):
        return v
    s = str(v).strip()
    m = re.search(r"([+-]\d{2})(\d{2})?$", s)
    if m and not m.group(2):
        s = s[: m.start()] + m.group(1) + ":00"
    return datetime.fromisoformat(s)


def convert_value(col: str, v):
    if v is None:
        return None
    if col in ("price_lkr", "deal_score", "market_median_lkr"):
        return Decimal(str(v))
    if col.endswith("_at"):
        return parse_dt(v)
    if col in ("year", "mileage", "engine_capacity"):
        return int(v) if v != "" else None
    if col in ("duplicate_of", "location_id"):
        return None  # ids are re-assigned on Neon
    return v


# --------------------------------------------------------------------------
# Batch INSERT helpers (multi-VALUES, one round trip per batch)
# --------------------------------------------------------------------------
def _batch_insert(conn, table: str, cols: list[str], rows: list[list], conflict_sql: str) -> int:
    if not rows:
        return 0
    cols_sql = ", ".join(cols)
    ph = ", ".join(["%s"] * len(cols))
    values = []
    args = []
    for r in rows:
        values.append(f"({ph})")
        args.extend(Json(v) if isinstance(v, (dict, list)) else v for v in r)
    sql = f"INSERT INTO {table} ({cols_sql}) VALUES {', '.join(values)} {conflict_sql}"
    with conn.cursor() as cur:
        cur.execute(sql, args)
        return max(cur.rowcount, 0)


def _server_cursor(conn, query: str):
    cur = conn.cursor(name="migrate_stream")
    cur.itersize = BATCH
    cur.execute(query)
    return cur


def _table_columns(conn, table: str) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name=%s AND table_schema=current_schema() "
            "ORDER BY ordinal_position",
            (table,),
        )
        return [r[0] for r in cur.fetchall()]


def _table_count(conn, table: str) -> int | None:
    try:
        with conn.cursor() as cur:
            cur.execute(f'SELECT count(*) FROM "{table}"')
            return cur.fetchone()[0]
    except Exception:
        return None


# --------------------------------------------------------------------------
# car_listings upsert
# --------------------------------------------------------------------------
def migrate_car_listings(src, dst) -> dict:
    cols = [c for c in CAR_LISTING_COLS if c in _table_columns(dst, "car_listings")]
    set_cols = ", ".join(
        f"{c}=EXCLUDED.{c}" for c in cols if c not in ("source", "source_id")
    )
    conflict = (
        "ON CONFLICT (source, source_id) DO UPDATE SET "
        f"{set_cols} WHERE EXCLUDED.scraped_at > car_listings.scraped_at"
    )
    cur = _server_cursor(
        src,
        "SELECT " + ", ".join(cols) + " FROM car_listings ORDER BY id",
    )
    stats = {"rows": 0, "written": 0}
    batch: list[list] = []
    while True:
        rows = cur.fetchmany(BATCH)
        if not rows:
            break
        stats["rows"] += len(rows)
        batch = [[convert_value(c, v) for c, v in zip(cols, r)] for r in rows]
        stats["written"] += _batch_insert(dst, "car_listings", cols, batch, conflict)
        if stats["rows"] % (BATCH * 5) < BATCH:
            print(f"  car_listings: {stats['rows']} rows processed", flush=True)
    cur.close()
    return stats


# --------------------------------------------------------------------------
# Additive copy for secondary tables
# --------------------------------------------------------------------------
def migrate_additive(src, dst, table: str) -> dict:
    src_cols = _table_columns(src, table)
    dst_cols = _table_columns(dst, table)
    if not src_cols or not dst_cols:
        print(f"  {table}: missing on one side (src={bool(src_cols)} dst={bool(dst_cols)}) — skip")
        return {"rows": 0, "written": 0, "skipped": True}
    cols = [c for c in src_cols if c in dst_cols]
    if "id" not in cols:
        print(f"  {table}: no id column — skip")
        return {"rows": 0, "written": 0, "skipped": True}
    conflict = "ON CONFLICT (id) DO NOTHING"
    cur = _server_cursor(
        src, "SELECT " + ", ".join(cols) + f' FROM "{table}" ORDER BY id'
    )
    stats = {"rows": 0, "written": 0, "skipped": False}
    while True:
        rows = cur.fetchmany(BATCH)
        if not rows:
            break
        stats["rows"] += len(rows)
        batch = [[convert_value(c, v) for c, v in zip(cols, r)] for r in rows]
        stats["written"] += _batch_insert(dst, table, cols, batch, conflict)
        if stats["rows"] % (BATCH * 5) < BATCH:
            print(f"  {table}: {stats['rows']} rows processed", flush=True)
    cur.close()
    return stats


# --------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--direct", action="store_true", help="use SUPABASE_DSN (fast path)")
    ap.add_argument("--only", default=None)
    args = ap.parse_args()

    neon_dsn = os.environ.get("NEON_DSN", "").strip()
    if not neon_dsn:
        print("Set NEON_DSN")
        sys.exit(1)
    dst = psycopg2.connect(neon_dsn, connect_timeout=30)
    dst.autocommit = True  # each batch commits independently (resumable)

    if args.direct:
        supa_dsn = os.environ.get("SUPABASE_DSN", "").strip()
        if not supa_dsn:
            print("--direct requires SUPABASE_DSN")
            sys.exit(1)
        src = psycopg2.connect(supa_dsn, connect_timeout=30)
    else:
        pat = os.environ.get("SUPABASE_PAT", "").strip()
        ref = os.environ.get("SUPABASE_REF", "").strip()
        if not pat or not ref:
            print("Set SUPABASE_PAT + SUPABASE_REF (API mode) or use --direct")
            sys.exit(1)
        raise SystemExit("API mode removed — use --direct with SUPABASE_DSN")

    try:
        if args.only == "car_listings":
            targets = ["car_listings"]
        elif args.only:
            targets = [args.only]
        else:
            targets = ["car_listings"] + SECONDARY_TABLES
        for t in targets:
            print(f"==> {t}", flush=True)
            if t == "car_listings":
                st = migrate_car_listings(src, dst)
            else:
                st = migrate_additive(src, dst, t)
            print(f"==> {t}: {st}", flush=True)
    finally:
        src.close()
        dst.close()


if __name__ == "__main__":
    main()
