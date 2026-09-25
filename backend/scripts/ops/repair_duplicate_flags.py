"""Clear cross-source duplicate flags so every listing counts as live inventory.

Context: the heuristic dedup pass (``app.utils.deduplication`` — match on
make/model/year/price±3%/mileage±5%-or-NULL, no district/seller/photo check)
was flagging >50% of the merged catalog as duplicates, including distinct
cars in different districts. That collapsed the public live-listing count
from ~207k to ~106k while the underlying rows were never deleted.

Until the matcher is tightened, the merge pipeline runs this repair before
every snapshot export and keeps ``RUN_DEDUP=false`` so the flags are not
re-applied. Outlier (``is_outlier``) and lifecycle (``is_active``) flags are
left untouched — they work as designed and only exclude ~14k rows.

Usage (from ``backend/``):
  python scripts/ops/repair_duplicate_flags.py          # dry-run, reports only
  python scripts/ops/repair_duplicate_flags.py --apply  # persist the repair
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import func  # noqa: E402

from db.models import CarListing, live_listing_filter  # noqa: E402
from db.session import ColdSessionLocal  # noqa: E402


def live_count(db) -> int:
    return db.query(func.count(CarListing.id)).filter(live_listing_filter()).scalar() or 0


def repair(db, *, apply: bool) -> dict:
    """Clear ``is_duplicate``/``duplicate_of`` on every flagged row.

    Returns ``{"flagged": n, "live_before": a, "live_after": b}``.
    With ``apply=False`` nothing is persisted (dry-run report only).
    """
    flagged = (
        db.query(func.count(CarListing.id))
        .filter(CarListing.is_duplicate == True)  # noqa: E712
        .scalar()
        or 0
    )
    result = {"flagged": int(flagged), "live_before": live_count(db), "live_after": None}
    if not apply or not flagged:
        db.rollback()
        return result

    db.query(CarListing).filter(
        CarListing.is_duplicate == True  # noqa: E712
    ).update(
        {"is_duplicate": False, "duplicate_of": None},
        synchronize_session=False,
    )
    db.commit()
    result["live_after"] = live_count(db)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Clear is_duplicate flags (dry-run by default).")
    parser.add_argument("--apply", action="store_true", help="Persist the repair. Without it, reports only.")
    args = parser.parse_args()

    db = ColdSessionLocal()
    try:
        result = repair(db, apply=args.apply)
    finally:
        db.close()

    mode = "APPLY" if args.apply else "DRY_RUN"
    print(
        f"{mode}: flagged_duplicates={result['flagged']} "
        f"live_before={result['live_before']} "
        f"live_after={result['live_after'] if result['live_after'] is not None else 'n/a'}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
