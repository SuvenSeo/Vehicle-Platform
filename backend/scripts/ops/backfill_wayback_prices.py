#!/usr/bin/env python3
"""Backfill historical asking prices from Wayback Machine ikman SERP snapshots.

Examples:
  cd backend && ALLOW_SQLITE_FALLBACK=true \\
    .venv/bin/python scripts/ops/backfill_wayback_prices.py --dry-run --max-snapshots 3

  cd backend && ALLOW_SQLITE_FALLBACK=true \\
    .venv/bin/python scripts/ops/backfill_wayback_prices.py --from 20170101 --to 20201231
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

# Allow `python scripts/ops/...` from backend/
BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.historical_archive import (
    DEFAULT_IKMAN_SERP_URLS,
    TOP_BRAND_SERP_URLS,
    discover_ikman_cdx,
    fetch_wayback_html,
    parse_ikman_serp_html,
    upsert_historical_observations,
)
from db.session import ColdSessionLocal, init_db


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from", dest="from_ts", default="20170101")
    parser.add_argument("--to", dest="to_ts", default="20261231")
    parser.add_argument("--max-snapshots", type=int, default=24)
    parser.add_argument("--sleep", type=float, default=1.5, help="Seconds between Wayback fetches")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--jsonl", type=Path, default=None, help="Optional path to write observations")
    parser.add_argument(
        "--brands-only",
        action="store_true",
        help="Only Toyota/Suzuki/Honda/Nissan brand SERPs (recommended for first backfill)",
    )
    args = parser.parse_args()

    serp_urls = TOP_BRAND_SERP_URLS if args.brands_only else DEFAULT_IKMAN_SERP_URLS
    hits = discover_ikman_cdx(
        serp_urls=serp_urls,
        from_ts=args.from_ts,
        to_ts=args.to_ts,
        per_url_limit=max(args.max_snapshots, 20),
    )
    if args.max_snapshots > 0:
        # Spread roughly evenly across the timeline when capping.
        if len(hits) > args.max_snapshots:
            step = len(hits) / args.max_snapshots
            hits = [hits[int(i * step)] for i in range(args.max_snapshots)]

    print(f"cdx_hits={len(hits)} from={args.from_ts} to={args.to_ts}")

    all_rows: list[dict] = []
    for index, hit in enumerate(hits, start=1):
        try:
            html = fetch_wayback_html(hit)
            rows = parse_ikman_serp_html(
                html,
                observed_at=hit.observed_at,
                snapshot_url=hit.raw_url,
            )
            print(
                f"[{index}/{len(hits)}] {hit.timestamp} "
                f"listings={len(rows)} url={hit.original}"
            )
            all_rows.extend(rows)
        except Exception as exc:
            print(f"[{index}/{len(hits)}] FAILED {hit.timestamp}: {exc}")
        if args.sleep > 0 and index < len(hits):
            time.sleep(args.sleep)

    if args.jsonl:
        args.jsonl.parent.mkdir(parents=True, exist_ok=True)
        with args.jsonl.open("w", encoding="utf-8") as handle:
            for row in all_rows:
                payload = dict(row)
                observed = payload.get("observed_at")
                if hasattr(observed, "isoformat"):
                    payload["observed_at"] = observed.isoformat()
                handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
        print(f"wrote_jsonl={args.jsonl} rows={len(all_rows)}")

    if args.dry_run:
        print(f"dry_run_observations={len(all_rows)}")
        return 0

    init_db()
    db = ColdSessionLocal()
    try:
        result = upsert_historical_observations(db, all_rows)
        print(f"upsert={result}")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
