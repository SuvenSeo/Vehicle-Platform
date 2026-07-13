#!/usr/bin/env python3
"""Backfill canonical district names on existing CarListing rows."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils.districts import normalize_district_name, resolve_canonical_district
from db.models import CarListing


def database_url() -> str:
    return (
        os.getenv("COLD_DATABASE_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("HOT_DATABASE_URL")
        or ""
    ).strip()


def backfill_districts(db: Session, *, batch_size: int, dry_run: bool) -> tuple[int, int]:
    updated = 0
    scanned = 0
    last_id = 0

    while True:
        rows = (
            db.query(CarListing)
            .filter(CarListing.id > last_id)
            .order_by(CarListing.id.asc())
            .limit(batch_size)
            .all()
        )
        if not rows:
            break

        for row in rows:
            scanned += 1
            last_id = int(row.id)
            current = row.district
            canonical = resolve_canonical_district(current, row.url)
            if canonical == current:
                continue
            if canonical is None and current and normalize_district_name(current):
                continue
            if not dry_run:
                row.district = canonical
            updated += 1

        if not dry_run:
            db.commit()

    return scanned, updated


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize district names on stored listings.")
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    url = database_url()
    if not url:
        print("Set COLD_DATABASE_URL, DATABASE_URL, or HOT_DATABASE_URL.", file=sys.stderr)
        return 1

    engine = create_engine(url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    try:
        scanned, updated = backfill_districts(db, batch_size=args.batch_size, dry_run=args.dry_run)
    finally:
        db.close()

    mode = "would update" if args.dry_run else "updated"
    print(f"Scanned {scanned:,} listings; {mode} {updated:,} district values.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
