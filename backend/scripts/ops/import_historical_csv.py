#!/usr/bin/env python3
"""Import a Kaggle-style / community CSV into historical_price_observations.

Expected columns (case-insensitive aliases):
  Brand/Make, Model, YOM/Year, Price/Price (LKR), Mileage/Millage(KM),
  Town/Location, Date/Listing Date, URL (optional)

Price units:
  --price-unit auto   (default) detect lakhs vs LKR from magnitude
  --price-unit lakhs  Prasad Nirmal SL dataset (43.0 → 4,300,000 LKR)
  --price-unit lkr    already in rupees

Example:
  cd backend && ALLOW_SQLITE_FALLBACK=true \\
    .venv/bin/python scripts/ops/import_historical_csv.py \\
    data/historical/kaggle_sl_car_price_dataset.csv \\
    --archive-source kaggle_sl --price-unit lakhs
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
    parser.add_argument(
        "--price-unit",
        choices=("auto", "lkr", "lakhs"),
        default="auto",
        help="How to interpret the Price column (default: auto)",
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
            price_unit=args.price_unit,
        )
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    print(f"parsed_rows={len(rows)}")
    if rows:
        sample = rows[0]
        print(
            "sample="
            f"{sample['make']} {sample['model']} yom={sample['year']} "
            f"price_lkr={sample['price_lkr']} unit={sample['raw_meta'].get('price_unit')}"
        )
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
