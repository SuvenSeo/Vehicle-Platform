#!/usr/bin/env python3
"""Densify historical_price_observations from Common Crawl ikman SERP captures.

Example:
  cd backend && ALLOW_SQLITE_FALLBACK=true \\
    .venv/bin/python scripts/ops/backfill_common_crawl_prices.py \\
    --max-records 80 --crawl-limit 8 --sleep 1.0
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

from app.services.common_crawl_archive import (
    DEFAULT_CC_URL_PATTERNS,
    discover_common_crawl_hits,
    fetch_cc_warc_html,
    rows_from_cc_hit,
)
from app.services.historical_archive import upsert_historical_observations
from db.session import ColdSessionLocal, init_db


def _spread(hits: list, limit: int) -> list:
    if limit <= 0 or len(hits) <= limit:
        return hits
    step = len(hits) / limit
    return [hits[int(i * step)] for i in range(limit)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-records", type=int, default=80)
    parser.add_argument("--crawl-limit", type=int, default=8)
    parser.add_argument("--per-query-limit", type=int, default=25)
    parser.add_argument("--sleep", type=float, default=1.0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--jsonl", type=Path, default=None)
    args = parser.parse_args()

    hits = discover_common_crawl_hits(
        url_patterns=DEFAULT_CC_URL_PATTERNS,
        crawl_limit=args.crawl_limit,
        per_query_limit=args.per_query_limit,
    )
    hits = _spread(hits, args.max_records)
    print(f"cc_hits={len(hits)} crawls_queried<={args.crawl_limit}")

    all_rows: list[dict] = []
    for index, hit in enumerate(hits, start=1):
        try:
            html = fetch_cc_warc_html(hit)
            rows = rows_from_cc_hit(hit, html)
            print(
                f"[{index}/{len(hits)}] {hit.timestamp} "
                f"listings={len(rows)} crawl={hit.crawl_id} url={hit.url}"
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
