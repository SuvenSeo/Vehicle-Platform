#!/usr/bin/env python3
"""Import a Kaggle-style / community CSV into historical_price_observations.

Expected columns (case-insensitive aliases):
  Brand/Make, Model, YOM/Year, Price/Price (LKR), Mileage, Town/Location,
  Date/Listing Date, URL (optional)

Example:
  cd backend && ALLOW_SQLITE_FALLBACK=true \\
    .venv/bin/python scripts/ops/import_historical_csv.py path/to/dataset.csv \\
    --archive-source kaggle_sl --observed-default 2025-01-15
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.historical_archive import upsert_historical_observations
from app.services.historical_csv_import import rows_from_csv
from db.session import ColdSessionLocal, init_db


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--archive-source", default="kaggle_sl")
    parser.add_argument(
        "--observed-default",
        default="2025-01-15",
        help="ISO date used when CSV row has no date",
    )
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.csv_path.is_file():
        raise SystemExit(f"File not found: {args.csv_path}")

    default_dt = datetime.strptime(args.observed_default, "%Y-%m-%d").replace(
        tzinfo=timezone.utc
    )
    try:
        rows = rows_from_csv(
            args.csv_path,
            archive_source=args.archive_source,
            observed_default=default_dt,
            limit=args.limit,
        )
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    print(f"parsed_rows={len(rows)}")
    if args.dry_run:
        return 0

    init_db()
    db = ColdSessionLocal()
    try:
        result = upsert_historical_observations(db, rows)
        print(f"upsert={result}")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
