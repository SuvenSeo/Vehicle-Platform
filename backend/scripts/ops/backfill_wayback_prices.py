#!/usr/bin/env python3
"""Backfill historical asking prices from Wayback Machine SERP snapshots.

Examples:
  cd backend && ALLOW_SQLITE_FALLBACK=true \\
    .venv/bin/python scripts/ops/backfill_wayback_prices.py --dry-run --max-snapshots 3

  # Dense max-coverage profile (brands + models + category + riyasewana)
  cd backend && ALLOW_SQLITE_FALLBACK=true \\
    .venv/bin/python scripts/ops/backfill_wayback_prices.py \\
      --profile dense --max-snapshots-per-url 30 --max-snapshots 600 --sleep 1.5
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
    discover_ikman_cdx,
    fetch_wayback_html,
    parse_archive_serp_html,
    serp_urls_for_profile,
    upsert_historical_observations,
)
from db.session import ColdSessionLocal, init_db


def _spread_hits(hits: list, max_snapshots: int) -> list:
    """Year-balanced sample so early HTML captures aren't drowned by recent SPA dumps."""
    if max_snapshots <= 0 or len(hits) <= max_snapshots:
        return hits

    by_year: dict[str, list] = {}
    for hit in hits:
        by_year.setdefault(hit.timestamp[:4], []).append(hit)

    years = sorted(by_year)
    if not years:
        return hits[:max_snapshots]

    selected: list = []
    seen: set[tuple[str, str]] = set()
    while len(selected) < max_snapshots and any(by_year.values()):
        for year in years:
            bucket = by_year.get(year) or []
            if not bucket:
                continue
            hit = bucket.pop(0)
            key = (hit.timestamp, hit.original)
            if key in seen:
                continue
            seen.add(key)
            selected.append(hit)
            if len(selected) >= max_snapshots:
                break
    selected.sort(key=lambda h: h.timestamp)
    return selected


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from", dest="from_ts", default="20170101")
    parser.add_argument("--to", dest="to_ts", default="20261231")
    parser.add_argument(
        "--max-snapshots",
        type=int,
        default=0,
        help="Global cap after per-URL discovery (0 = no extra global cap)",
    )
    parser.add_argument(
        "--max-snapshots-per-url",
        type=int,
        default=30,
        help="Max CDX hits kept per SERP URL (year-chunked monthly collapse)",
    )
    parser.add_argument("--sleep", type=float, default=1.5, help="Seconds between Wayback fetches")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--jsonl", type=Path, default=None, help="Optional path to write observations")
    parser.add_argument(
        "--profile",
        default="dense",
        help="SERP set: dense|brands|extended|models|all (default dense)",
    )
    parser.add_argument(
        "--brands-only",
        action="store_true",
        help="Alias for --profile brands (legacy)",
    )
    parser.add_argument(
        "--include-riyasewana",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Include riyasewana.com SERPs in dense profile (default on)",
    )
    parser.add_argument(
        "--commit-every",
        type=int,
        default=5,
        help="Upsert to DB every N successful snapshot parses (0 = once at end)",
    )
    args = parser.parse_args()

    profile = "brands" if args.brands_only else args.profile
    serp_urls = serp_urls_for_profile(profile, include_riyasewana=args.include_riyasewana)
    per_url = max(int(args.max_snapshots_per_url), 1)

    print(
        f"profile={profile} serp_urls={len(serp_urls)} "
        f"per_url={per_url} max_snapshots={args.max_snapshots} "
        f"from={args.from_ts} to={args.to_ts}"
    )

    hits = discover_ikman_cdx(
        serp_urls=serp_urls,
        from_ts=args.from_ts,
        to_ts=args.to_ts,
        per_url_limit=per_url,
    )
    if args.max_snapshots > 0:
        hits = _spread_hits(hits, args.max_snapshots)

    print(f"cdx_hits={len(hits)}")

    if not args.dry_run:
        init_db()

    db = None if args.dry_run else ColdSessionLocal()
    all_rows: list[dict] = []
    pending: list[dict] = []
    totals = {"inserted": 0, "skipped": 0}
    parsed_snapshots = 0

    try:
        for index, hit in enumerate(hits, start=1):
            try:
                html = fetch_wayback_html(hit)
                rows = parse_archive_serp_html(
                    html,
                    observed_at=hit.observed_at,
                    snapshot_url=hit.raw_url,
                    original_url=hit.original,
                )
                print(
                    f"[{index}/{len(hits)}] {hit.timestamp} "
                    f"listings={len(rows)} url={hit.original}"
                )
                all_rows.extend(rows)
                pending.extend(rows)
                parsed_snapshots += 1
                if (
                    db is not None
                    and args.commit_every > 0
                    and parsed_snapshots % args.commit_every == 0
                    and pending
                ):
                    result = upsert_historical_observations(db, pending)
                    totals["inserted"] += int(result.get("inserted") or 0)
                    totals["skipped"] += int(result.get("skipped") or 0)
                    print(f"  checkpoint upsert={result} totals={totals}")
                    pending = []
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

        if pending:
            result = upsert_historical_observations(db, pending)
            totals["inserted"] += int(result.get("inserted") or 0)
            totals["skipped"] += int(result.get("skipped") or 0)
            print(f"final upsert={result}")
        elif args.commit_every <= 0:
            result = upsert_historical_observations(db, all_rows)
            totals = result
            print(f"upsert={result}")

        print(f"upsert_totals={totals} observations_parsed={len(all_rows)}")
    finally:
        if db is not None:
            db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
