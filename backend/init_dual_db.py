#!/usr/bin/env python3
"""
Initialize AutoLens database schema on NeonDB (or whichever DB is configured).
Run this once to create all tables. Safe to re-run (idempotent).

Usage:
    python init_dual_db.py
"""
import sys


def main():
    print("=" * 50)
    print("AutoLens — Database Schema Init")
    print("=" * 50)

    from db.session import engine, init_db
    from sqlalchemy import text, inspect

    print(f"\nConnecting to: {str(engine.url)[:60]}...")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()")).fetchone()
            print(f"Connected: {result[0][:60]}")
    except Exception as e:
        print(f"Connection failed: {e}")
        sys.exit(1)

    print("\nCreating tables (skipping existing)...")
    init_db()

    tables = sorted(inspect(engine).get_table_names())
    print(f"Tables: {tables}")

    required = {"car_listings", "locations", "price_aggregates", "scrape_runs", "raw_listings"}
    missing = required - set(tables)
    if missing:
        print(f"\nMISSING: {missing}")
        sys.exit(1)

    print("\nAll required tables present.")
    print("=" * 50)


if __name__ == "__main__":
    main()
