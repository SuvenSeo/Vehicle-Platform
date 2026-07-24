#!/usr/bin/env python3
"""Max-coverage Wayback backfill into historical_price_observations.

Profiles:
  brands  — Toyota/Suzuki/Honda/Nissan (legacy --brands-only)
  max     — all major brands + popular models + riyasewana SERPs

Examples:
  cd backend && ALLOW_SQLITE_FALLBACK=true \\
    .venv/bin/python scripts/ops/backfill_wayback_prices.py \\
    --profile max --max-snapshots-per-url 30 --max-snapshots 600 --sleep 1.5
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.historical_archive import (
    DEFAULT_IKMAN_SERP_URLS,
    MAX_IKMAN_SERP_URLS,
    RIYASEWANA_SERP_URLS,
    TOP_BRAND_SERP_URLS,
    discover_ikman_cdx,
    fetch_wayback_html,
    parse_archive_serp_html,
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


def _serp_urls_for_profile(profile: str, brands_only: bool) -> tuple[str, ...]:
    if brands_only or profile == "brands":
        return TOP_BRAND_SERP_URLS
    if profile == "max":
        return tuple(dict.fromkeys([*MAX_IKMAN_SERP_URLS, *RIYASEWANA_SERP_URLS]))
    if profile == "riyasewana":
        return RIYASEWANA_SERP_URLS
    return DEFAULT_IKMAN_SERP_URLS


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from", dest="from_ts", default="20100101")
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
        help="Max year-chunked monthly CDX hits kept per SERP URL",
    )
    parser.add_argument("--sleep", type=float, default=1.5, help="Seconds between Wayback fetches")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--jsonl", type=Path, default=None, help="Optional path to write observations")
    parser.add_argument(
        "--profile",
        choices=("default", "brands", "max", "riyasewana"),
        default="max",
        help="SERP URL set (default: max)",
    )
    parser.add_argument(
        "--brands-only",
        action="store_true",
        help="Alias for --profile brands (kept for older workflows)",
    )
    parser.add_argument(
        "--commit-every",
        type=int,
        default=5,
        help="Upsert to DB every N successful snapshot parses (0 = once at end)",
    )
    args = parser.parse_args()

    serp_urls = _serp_urls_for_profile(args.profile, args.brands_only)
    per_url = max(int(args.max_snapshots_per_url), 1)
    hits = discover_ikman_cdx(
        serp_urls=serp_urls,
        from_ts=args.from_ts,
        to_ts=args.to_ts,
        per_url_limit=per_url,
    )
    if args.max_snapshots > 0:
        hits = _spread_hits(hits, args.max_snapshots)

    print(
        f"cdx_hits={len(hits)} from={args.from_ts} to={args.to_ts} "
        f"profile={args.profile} urls={len(serp_urls)} per_url={per_url} "
        f"max_snapshots={args.max_snapshots}"
    )

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
                    original_url=hit.original,
                    snapshot_url=hit.raw_url,
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
