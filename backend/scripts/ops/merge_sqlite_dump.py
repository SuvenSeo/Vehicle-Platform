#!/usr/bin/env python3
"""Merge a Manus-scraped SQLite dump into the local outage pipeline DB.

Manus runs scripts/ops/manus_scrape_dump.sh on its cloud computer and uploads
the compressed SQLite DB as a GitHub Release asset. This script pulls those
rows into the local DB (C:/motormila/motormila.db by default) so the laptop
pipeline's next analysis/export includes them.

Rows are upserted by (source, source_id) through the app's upsert_listing, so
nothing is duplicated and vehicle_price_history rows are recorded correctly.

Usage:
  python scripts/ops/merge_sqlite_dump.py path/to/autolens.db[.gz]
  python scripts/ops/merge_sqlite_dump.py path/to/autolens.db.gz --target C:/motormila/motormila.db --dry-run
"""
from __future__ import annotations

import argparse
import gzip
import os
import shutil
import sys
import tempfile
from pathlib import Path

# Allow running as `python scripts/ops/...` from anywhere: make `backend/`
# importable (parents: [0]=ops, [1]=scripts, [2]=backend).
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from db.models import CarListing  # noqa: E402
from app.utils.listing_upsert import upsert_listing  # noqa: E402

# Derived/flags columns that the local analysis recomputes — never copy these
# from the dump. Timestamps upsert_listing manages are excluded too.
EXCLUDE_COLS = {
    "id",
    "is_duplicate",
    "duplicate_of",
    "is_outlier",
    "deal_score",
    "thumbnail_url_cached",
    "image_phash",
    "vehicle_category",
    "content_updated_at",
    "last_seen_at",
}

CONTENT_COLS = [
    c.name for c in CarListing.__table__.columns if c.name not in EXCLUDE_COLS
]

# SQLite may hand these back as ISO strings; the ORM DateTime columns require
# datetime objects.
DATETIME_COLS = {"scraped_at", "first_seen_at", "last_seen_at", "content_updated_at"}


def coerce_datetimes(row: dict) -> dict:
    from datetime import datetime

    out = dict(row)
    for key in DATETIME_COLS:
        val = out.get(key)
        if isinstance(val, str):
            try:
                out[key] = datetime.fromisoformat(val.replace("Z", "+00:00"))
            except ValueError:
                pass
    return out


def load_dump_path(path: str) -> Path:
    """Return a usable .db path, decompressing .gz dumps into a temp file."""
    p = Path(path)
    if p.suffix == ".gz":
        tmp = Path(tempfile.gettempdir()) / f"manus-dump-{os.getpid()}.db"
        with gzip.open(p, "rb") as fin, open(tmp, "wb") as fout:
            shutil.copyfileobj(fin, fout)
        return tmp
    return p


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("dump", help="path to a Manus .db or .db.gz dump")
    ap.add_argument(
        "--target",
        default=os.environ.get(
            "MOTORMILA_LOCAL_DB", "C:/motormila/motormila.db"
        ),
        help="local outage DB to merge into (default: C:/motormila/motormila.db)",
    )
    ap.add_argument("--dry-run", action="store_true", help="count only, no writes")
    args = ap.parse_args()

    dump_path = load_dump_path(args.dump)
    target_url = args.target if args.target.startswith("sqlite") else f"sqlite:///{args.target}"

    dump_engine = create_engine(f"sqlite:///{dump_path}")
    target_engine = create_engine(target_url)
    TargetSession = sessionmaker(bind=target_engine)

    sel = f"SELECT {', '.join(CONTENT_COLS)} FROM car_listings"
    with dump_engine.connect() as dconn:
        rows = dconn.execute(text(sel)).mappings().all()

    print(f"dump rows: {len(rows)}")

    inserted = 0
    updated = 0
    per_source: dict[str, list[int]] = {}

    if args.dry_run:
        with target_engine.connect() as tconn:
            existing = set(
                tconn.execute(
                    text("SELECT source || '|' || source_id FROM car_listings")
                ).fetchall()
            )
        existing = {r[0] for r in existing}
        for row in rows:
            key = f"{row['source']}|{row['source_id']}"
            per_source.setdefault(row["source"], [0, 0])
            if key in existing:
                per_source[row["source"]][0] += 1
            else:
                per_source[row["source"]][1] += 1
    else:
        db = TargetSession()
        try:
            for i, row in enumerate(rows, 1):
                payload = coerce_datetimes({k: row[k] for k in CONTENT_COLS})
                created = upsert_listing(db, payload["source"], payload)
                if created:
                    inserted += 1
                else:
                    updated += 1
                per_source.setdefault(payload["source"], [0, 0])
                per_source[payload["source"]][1 if created else 0] += 1
                if i % 2000 == 0:
                    db.commit()
                    print(f"  ... {i}/{len(rows)} (new={inserted})")
            db.commit()
        finally:
            db.close()

    print("\nper-source (updated, inserted):")
    for src, (up, ins) in sorted(per_source.items()):
        print(f"  {src:14s} updated={up:6d} inserted={ins:6d}")
    if not args.dry_run:
        print(f"\nTOTAL updated={updated} inserted={inserted}")
    else:
        total_new = sum(v[1] for v in per_source.values())
        print(f"\nDRY-RUN: would insert {total_new} new rows, update the rest.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
