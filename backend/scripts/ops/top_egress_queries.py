#!/usr/bin/env python3
"""Rank the Postgres statements that pull the most bytes out of Neon.

This is the repo-local equivalent of Neon's "egress optimizer" guidance: it
uses ``pg_stat_statements`` (plus ``pg_stat_user_tables`` and relation sizes)
to surface the queries most likely responsible for data-transfer burn —
large result sets, low call counts, missing LIMITs, full-table scans — so
they can be rewritten SQL-side or cached.

Run on demand (locally or via the dispatch-only GitHub workflow). The
``pg_stat_statements`` extension must exist on the database:

    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

Neon has it preloaded; stats reset on compute restart, so treat a
just-restarted compute as a small sample.

Usage (from backend/):
    HOT_DATABASE_URL=... python scripts/ops/top_egress_queries.py
Options:
    --json            print machine-readable JSON (for workflows)
    --limit N         top N statements (default 15)
Exit codes: 0 = report produced, 3 = could not run (no DB / no extension).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

MAX_QUERY_TEXT_LEN = 160
# A statement whose average result set exceeds this many rows is almost
# certainly streaming a full table per call — the classic egress killer.
FULL_SCAN_ROWS_PER_CALL = 10_000


def _db_url() -> str:
    return (
        os.getenv("HOT_DATABASE_URL", "").strip()
        or os.getenv("COLD_DATABASE_URL", "").strip()
        or os.getenv("DATABASE_URL", "").strip()
    )


def _report(db_url: str, limit: int) -> dict:
    from sqlalchemy import create_engine, text

    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 10, "sslmode": "require"},
    )
    try:
        with engine.connect() as conn:
            has_ext = conn.execute(
                text(
                    "SELECT count(*) FROM pg_extension WHERE extname = 'pg_stat_statements'"
                )
            ).scalar()
            if not has_ext:
                print(
                    "pg_stat_statements is not installed. Run once:\n"
                    "  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
                )
                raise SystemExit(3)

            # Statements ranked by estimated outbound bytes: rows returned per
            # call is the best transfer proxy available server-side. Width is
            # not tracked per statement, so ranking = rows × calls.
            stmts = conn.execute(
                text(
                    """
                    SELECT
                        calls,
                        rows,
                        round(rows::numeric / GREATEST(calls, 1), 1) AS rows_per_call,
                        round(total_exec_time::numeric / 1000, 1) AS total_sec,
                        round(mean_exec_time::numeric, 1) AS mean_ms,
                        left(regexp_replace(query, '\\s+', ' ', 'g'), :text_len) AS query
                    FROM pg_stat_statements
                    WHERE query NOT LIKE '%pg_stat_statements%'
                    ORDER BY rows DESC
                    LIMIT :limit
                    """
                ),
                {"text_len": MAX_QUERY_TEXT_LEN, "limit": limit},
            ).mappings().all()

            offenders = conn.execute(
                text(
                    """
                    SELECT
                        calls,
                        rows,
                        round(rows::numeric / GREATEST(calls, 1), 1) AS rows_per_call,
                        round(mean_exec_time::numeric, 1) AS mean_ms,
                        left(regexp_replace(query, '\\s+', ' ', 'g'), :text_len) AS query
                    FROM pg_stat_statements
                    WHERE query NOT LIKE '%pg_stat_statements%'
                      AND rows / GREATEST(calls, 1) >= :threshold
                    ORDER BY rows::numeric / GREATEST(calls, 1) DESC
                    LIMIT :limit
                    """
                ),
                {
                    "text_len": MAX_QUERY_TEXT_LEN,
                    "limit": limit,
                    "threshold": FULL_SCAN_ROWS_PER_CALL,
                },
            ).mappings().all()

            table_scan_stats = conn.execute(
                text(
                    """
                    SELECT
                        relname,
                        seq_scan,
                        seq_tup_read,
                        n_live_tup,
                        pg_size_pretty(pg_total_relation_size(relid)) AS total_size
                    FROM pg_stat_user_tables
                    ORDER BY seq_tup_read DESC
                    LIMIT 10
                    """
                )
            ).mappings().all()
    finally:
        engine.dispose()

    return {
        "top_by_rows_returned": [dict(r) for r in stmts],
        "full_scan_suspects": [dict(r) for r in offenders],
        "table_scan_stats": [dict(r) for r in table_scan_stats],
    }


def _print_human(report: dict) -> None:
    def row_line(r: dict) -> str:
        return (
            f"  calls={r['calls']:<8} rows={r['rows']:<10} "
            f"rows/call={r['rows_per_call']:<12} mean_ms={r.get('mean_ms')} "
            f"total_s={r.get('total_sec', '-')}\n"
            f"    {r['query']}"
        )

    print("=== Top statements by rows returned (egress proxy: rows × calls) ===")
    for r in report["top_by_rows_returned"]:
        print(row_line(r))

    print("\n=== FULL-SCAN SUSPECTS (avg ≥ %s rows/call — rewrite or LIMIT) ==="
          % FULL_SCAN_ROWS_PER_CALL)
    suspects = report["full_scan_suspects"]
    if not suspects:
        print("  none — no statement averages a huge result set 🎉")
    for r in suspects:
        print(row_line(r))

    print("\n=== Tables with the most sequential-scan rows read ===")
    for r in report["table_scan_stats"]:
        print(
            f"  {r['relname']:<28} seq_scans={r['seq_scan']:<8} "
            f"seq_rows={r['seq_tup_read']:<12} live_rows={r['n_live_tup']:<10} "
            f"size={r['total_size']}"
        )

    print(
        "\nNext steps: for every suspect — (1) project only needed columns, "
        "(2) add LIMIT / pagination, (3) aggregate in SQL (percentile_cont / "
        "UPDATE..FROM) instead of streaming rows to Python, (4) serve "
        "repeat reads from market_stats_cache / the process-local memory cache."
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="print JSON report")
    parser.add_argument("--limit", type=int, default=15)
    args = parser.parse_args()

    db_url = _db_url()
    if not db_url or "postgres" not in db_url.split("://", 1)[0]:
        print("No Postgres URL configured (HOT_DATABASE_URL / DATABASE_URL).")
        return 3

    try:
        report = _report(db_url, args.limit)
    except SystemExit as exc:
        return int(exc.code or 3)
    except Exception as exc:  # noqa: BLE001 - advisory tool, never fail a workflow
        print(f"Report failed: {exc}")
        return 3

    github_summary = os.getenv("GITHUB_STEP_SUMMARY", "").strip()
    if args.json:
        print(json.dumps(report, indent=2, default=str))
    else:
        _print_human(report)

    if github_summary:
        with open(github_summary, "a", encoding="utf-8") as handle:
            handle.write("### Neon egress: top statements by rows returned\n\n")
            handle.write("```sql\n")
            for r in report["full_scan_suspects"]:
                handle.write(
                    f"-- calls={r['calls']} rows={r['rows']} rows/call={r['rows_per_call']}\n"
                    f"{r['query']}\n\n"
                )
            handle.write("```\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
