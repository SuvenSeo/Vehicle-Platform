#!/usr/bin/env python3
"""Fast sync remaining listings from motormila.db into Neon using unpooled COPY."""
from __future__ import annotations

import csv
import io
import os
import sys
import psycopg2
from pathlib import Path
from datetime import datetime

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")

from sqlalchemy import create_engine, text

def main():
    pg_url = os.getenv("DATABASE_URL") or ""
    unpooled_url = pg_url.replace("-pooler", "")

    sqlite_path = BACKEND_DIR / "motormila.db"
    sq_engine = create_engine(f"sqlite:///{sqlite_path}")

    print("Connecting to Neon direct endpoint...")
    conn = psycopg2.connect(unpooled_url, connect_timeout=15)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        cur.execute("SELECT source, source_id FROM car_listings")
        existing_keys = set(cur.fetchall())
        print(f"Neon currently has {len(existing_keys)} listings.")

        cols = [
            "raw_id", "source", "source_id", "scraped_at", "first_seen_at", "last_seen_at",
            "content_updated_at", "title", "url", "make", "model", "year", "price_lkr",
            "mileage", "fuel_type", "transmission", "engine_capacity", "condition",
            "body_type", "vehicle_category", "raw_location", "district", "city",
            "location_id", "thumbnail_url", "thumbnail_url_cached", "image_phash",
            "deal_score", "market_median_lkr", "is_outlier", "outlier_reason",
            "is_duplicate", "duplicate_of", "is_active"
        ]
        col_list = ", ".join(cols)

        with sq_engine.connect() as sconn:
            all_sqlite = sconn.execute(text(f"SELECT source, source_id, {col_list} FROM car_listings")).mappings().all()

        new_rows = [r for r in all_sqlite if (r["source"], r["source_id"]) not in existing_keys]
        print(f"Found {len(new_rows)} new listings to insert into Neon DB.")

        if not new_rows:
            print("Everything already synced!")
            return

        # Create temporary staging table
        cur.execute("CREATE TEMP TABLE stage_car_listings (LIKE car_listings INCLUDING DEFAULTS) ON COMMIT DROP")

        # Prepare CSV buffer
        buf = io.StringIO()
        writer = csv.writer(buf, delimiter="\t", quoting=csv.QUOTE_MINIMAL)

        for r in new_rows:
            d = dict(r)
            d["duplicate_of"] = ""  # leave empty for FK safety
            row_data = []
            for c in cols:
                val = d.get(c)
                if val is None or val == "":
                    row_data.append(r"\N")
                elif c in ("is_outlier", "is_duplicate", "is_active"):
                    row_data.append("t" if val else "f")
                else:
                    # Clean newlines/tabs in text
                    s = str(val).replace("\t", " ").replace("\r", "").replace("\n", " ")
                    row_data.append(s)
            buf.write("\t".join(row_data) + "\n")

        buf.seek(0)
        print(f"Streaming {len(new_rows)} rows via COPY to staging table...")
        cur.copy_expert(f"COPY stage_car_listings ({col_list}) FROM STDIN WITH (FORMAT text, NULL '\\N')", buf)

        print("Merging from staging into car_listings...")
        cur.execute(f"""
            INSERT INTO car_listings ({col_list})
            SELECT {col_list} FROM stage_car_listings
            ON CONFLICT (source, source_id) DO UPDATE SET
                price_lkr = EXCLUDED.price_lkr,
                last_seen_at = EXCLUDED.last_seen_at,
                is_active = EXCLUDED.is_active
        """)

        conn.commit()

        cur.execute("SELECT COUNT(*) FROM car_listings")
        new_total = cur.fetchone()[0]
        print(f"\nSUCCESS! Neon DB now has {new_total} listings!")

    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
