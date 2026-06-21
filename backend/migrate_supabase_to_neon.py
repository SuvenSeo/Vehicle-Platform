#!/usr/bin/env python3
"""
One-time migration: copy all data from Supabase → NeonDB.

Uses psycopg2 execute_values for fast bulk inserts (~5-10k rows/sec).
Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.

Usage:
    COLD_DATABASE_URL="postgresql://..." python migrate_supabase_to_neon.py
    (DATABASE_URL / Supabase URL is read from .env automatically)
"""
import os
import sys
import time
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv(".env.local", usecwd=True))
load_dotenv()


def _fix(url: str) -> str:
    return url.replace("postgres://", "postgresql://", 1) if url.startswith("postgres://") else url


SUPABASE_URL = _fix((
    os.getenv("SUPABASE_URL") or os.getenv("DATABASE_URL") or os.getenv("HOT_DATABASE_URL") or ""
).strip())

NEON_URL = _fix((
    os.getenv("NEON_URL") or os.getenv("COLD_DATABASE_URL") or ""
).strip())

for url, name in [(SUPABASE_URL, "DATABASE_URL / SUPABASE_URL"), (NEON_URL, "COLD_DATABASE_URL / NEON_URL")]:
    if not url:
        print(f"ERROR: {name} not set.")
        sys.exit(1)

BATCH = 5000


def pg_connect(url: str, label: str):
    # Strip unsupported libpq params for psycopg2 if needed
    conn = psycopg2.connect(url)
    conn.autocommit = False
    with conn.cursor() as cur:
        cur.execute("SELECT version()")
        ver = cur.fetchone()[0]
        print(f"  {label}: {ver[:65]}")
    return conn


def get_cols(conn, table: str) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name=%s ORDER BY ordinal_position",
            (table,)
        )
        return [r[0] for r in cur.fetchall()]


def migrate_table(
    src, dst, table: str,
    conflict_col: str | None,
    skip_id: bool = False,
    null_cols: list[str] | None = None,
):
    null_set = set(null_cols or [])

    with src.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        total = cur.fetchone()[0]
    print(f"\n[{table}] {total:,} rows in Supabase")
    if total == 0:
        print("  Nothing to migrate.")
        return 0

    all_cols  = get_cols(src, table)
    copy_cols = [c for c in all_cols if not (skip_id and c == "id")]
    col_list  = ", ".join(copy_cols)
    null_idx  = {copy_cols.index(c) for c in null_set if c in copy_cols}

    conflict = f"ON CONFLICT ({conflict_col}) DO NOTHING" if conflict_col else "ON CONFLICT DO NOTHING"
    insert_sql = f"INSERT INTO {table} ({col_list}) VALUES %s {conflict}"

    inserted = 0
    offset   = 0
    start    = time.time()

    try:
        while True:
            with src.cursor(name=f"scroll_{table}_{offset}") as scur:
                scur.execute(
                    f"SELECT {col_list} FROM {table} ORDER BY id LIMIT %s OFFSET %s",
                    (BATCH, offset)
                )
                rows = scur.fetchall()

            if not rows:
                break

            # Null out specified columns
            if null_idx:
                rows = [
                    tuple(None if i in null_idx else v for i, v in enumerate(row))
                    for row in rows
                ]

            with dst.cursor() as dcur:
                psycopg2.extras.execute_values(dcur, insert_sql, rows, page_size=BATCH)
            dst.commit()

            inserted += len(rows)
            offset   += BATCH
            pct = (offset / total * 100) if total else 100
            rate = inserted / max(time.time() - start, 1)
            print(f"  {inserted:,}/{total:,} ({pct:.0f}%)  {rate:.0f} rows/s", end="\r")

    except Exception as e:
        dst.rollback()
        raise e

    print(f"\n  Done: {inserted:,} rows  ({time.time()-start:.1f}s)")
    return inserted


def reset_sequence(conn, table: str, id_col: str = "id"):
    with conn.cursor() as cur:
        cur.execute(f"SELECT MAX({id_col}) FROM {table}")
        max_id   = cur.fetchone()[0] or 1
        seq_name = f"{table}_{id_col}_seq"
        cur.execute(f"SELECT setval(%s, %s, true)", (seq_name, max_id))
    conn.commit()
    print(f"  Sequence {seq_name} → {max_id}")


def main():
    print("=" * 55)
    print("AutoLens — Supabase → NeonDB Migration")
    print("=" * 55)
    print("\nConnecting...")
    src = pg_connect(SUPABASE_URL, "Supabase (source)")
    dst = pg_connect(NEON_URL,     "NeonDB  (target)")

    migrate_table(src, dst, "locations",       conflict_col="normalized_key", skip_id=False)
    reset_sequence(dst, "locations")

    migrate_table(src, dst, "car_listings",    conflict_col="source, source_id",
                  skip_id=True, null_cols=["duplicate_of"])
    reset_sequence(dst, "car_listings")

    migrate_table(src, dst, "price_aggregates", conflict_col=None, skip_id=False)
    reset_sequence(dst, "price_aggregates")

    migrate_table(src, dst, "scrape_runs",     conflict_col=None, skip_id=False)
    reset_sequence(dst, "scrape_runs")

    print("\n--- Final counts on NeonDB ---")
    with dst.cursor() as cur:
        for t in ["car_listings", "price_aggregates", "locations", "scrape_runs"]:
            cur.execute(f"SELECT COUNT(*) FROM {t}")
            print(f"  {t}: {cur.fetchone()[0]:,}")

    src.close()
    dst.close()
    print("\nMigration complete.")
    print("=" * 55)


if __name__ == "__main__":
    main()

