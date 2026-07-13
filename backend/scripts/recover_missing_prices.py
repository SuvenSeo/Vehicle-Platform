#!/usr/bin/env python3
"""Report (and optionally mark for retry) CarListing rows where price_lkr IS NULL.

Only listings whose last_seen_at falls within the look-back window (default 7 days)
are considered, to avoid acting on stale data.

Usage examples
--------------
Dry-run report (default):
    python scripts/recover_missing_prices.py

Report with a custom look-back window:
    python scripts/recover_missing_prices.py --days 14

Write a JSON retry manifest and flag listings in the DB:
    python scripts/recover_missing_prices.py --mark-retry --output /tmp/retry.json

Environment
-----------
COLD_DATABASE_URL / DATABASE_URL / HOT_DATABASE_URL
    Standard DSN used by other scripts in this directory.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from db.models import CarListing


# ---------------------------------------------------------------------------
# Database helpers (mirrors backfill_districts.py conventions)
# ---------------------------------------------------------------------------


def _database_url() -> str:
    return (
        os.getenv("COLD_DATABASE_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("HOT_DATABASE_URL")
        or ""
    ).strip()


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------


def find_missing_price_listings(
    db: Session,
    *,
    days: int = 7,
) -> list[CarListing]:
    """Return all non-duplicate listings with price_lkr IS NULL seen within *days*."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return (
        db.query(CarListing)
        .filter(
            CarListing.price_lkr.is_(None),
            CarListing.last_seen_at >= cutoff,
            CarListing.is_duplicate == False,  # noqa: E712
        )
        .order_by(CarListing.source.asc(), CarListing.last_seen_at.desc())
        .all()
    )


def _summarise_by_source(listings: list[CarListing]) -> dict[str, int]:
    summary: dict[str, int] = {}
    for listing in listings:
        summary[listing.source] = summary.get(listing.source, 0) + 1
    return dict(sorted(summary.items(), key=lambda kv: -kv[1]))


def _listing_to_dict(listing: CarListing) -> dict:
    return {
        "id": listing.id,
        "source": listing.source,
        "source_id": listing.source_id,
        "url": listing.url,
        "make": listing.make,
        "model": listing.model,
        "year": listing.year,
        "last_seen_at": listing.last_seen_at.isoformat() if listing.last_seen_at else None,
    }


def recover_missing_prices(
    db: Session,
    *,
    days: int = 7,
    dry_run: bool = True,
    mark_retry: bool = False,
    output_path: Optional[str] = None,
) -> dict:
    """Find listings with missing prices and optionally schedule them for retry.

    Parameters
    ----------
    db:
        Active SQLAlchemy session.
    days:
        Look-back window in days (uses last_seen_at).
    dry_run:
        When True, no database writes are made.
    mark_retry:
        When True (and not dry_run), sets ``is_outlier=False`` as a touch to
        signal the listing should be re-evaluated, and writes the retry manifest
        to *output_path*.  In production you would replace this with whatever
        retry mechanism is appropriate (e.g. re-inserting source_id into a
        scrape queue).
    output_path:
        File path for the JSON retry manifest; only written when mark_retry is
        True.  Defaults to ``/tmp/missing_price_retry_<timestamp>.json``.

    Returns
    -------
    dict with keys: ``count``, ``by_source``, ``action``, and optionally
    ``output_path``.
    """
    listings = find_missing_price_listings(db, days=days)
    count = len(listings)
    by_source = _summarise_by_source(listings)

    print(
        f"Found {count:,} listing(s) with price_lkr IS NULL "
        f"seen in last {days} day(s)."
    )
    for source, n in by_source.items():
        print(f"  {source}: {n:,}")

    if count == 0:
        print("Nothing to do.")
        return {"count": 0, "by_source": {}, "action": "noop"}

    if dry_run:
        print("[DRY RUN] No changes written to the database.")
        print("Re-run with --no-dry-run (and optionally --mark-retry) to act.")
        return {"count": count, "by_source": by_source, "action": "dry_run"}

    if not mark_retry:
        print("Nothing written (pass --mark-retry to create a retry manifest).")
        return {"count": count, "by_source": by_source, "action": "report_only"}

    # Build the retry manifest.
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "days_window": days,
        "total": count,
        "by_source": by_source,
        "listings": [_listing_to_dict(lst) for lst in listings],
    }

    resolved_output = output_path or (
        f"/tmp/missing_price_retry_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    )
    Path(resolved_output).write_text(json.dumps(manifest, indent=2))
    print(f"Retry manifest written to: {resolved_output}")

    # Touch the listings so downstream jobs can detect them as needing attention.
    # We update last_seen_at to now so any re-scrape logic that filters by
    # recency will pick them up on the next pass.
    touched = 0
    now = datetime.now(timezone.utc)
    for listing in listings:
        listing.last_seen_at = now
        touched += 1

    db.commit()
    print(f"Touched last_seen_at for {touched:,} listing(s) to flag for re-scrape.")

    return {
        "count": count,
        "by_source": by_source,
        "action": "retry_manifest",
        "touched": touched,
        "output_path": resolved_output,
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Report (and optionally re-queue) listings with missing prices.",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="Look-back window in days (default: 7).",
    )
    parser.add_argument(
        "--no-dry-run",
        dest="dry_run",
        action="store_false",
        default=True,
        help="Allow database writes (default is dry-run / report-only).",
    )
    parser.add_argument(
        "--mark-retry",
        action="store_true",
        default=False,
        help="Write a JSON retry manifest and touch listing timestamps.",
    )
    parser.add_argument(
        "--output",
        metavar="PATH",
        default=None,
        help="Path for the retry manifest JSON (only used with --mark-retry).",
    )
    args = parser.parse_args()

    url = _database_url()
    if not url:
        print(
            "ERROR: Set COLD_DATABASE_URL, DATABASE_URL, or HOT_DATABASE_URL.",
            file=sys.stderr,
        )
        return 1

    engine = create_engine(url)
    DBSession = sessionmaker(bind=engine)
    db = DBSession()
    try:
        result = recover_missing_prices(
            db,
            days=args.days,
            dry_run=args.dry_run,
            mark_retry=args.mark_retry,
            output_path=args.output,
        )
    finally:
        db.close()

    print(f"\nResult: action={result['action']}, count={result['count']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
