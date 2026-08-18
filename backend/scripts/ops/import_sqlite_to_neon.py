#!/usr/bin/env python3
"""Import a SQLite dump (Manus merged-db or neon-export) into Neon/Postgres.

Two different recoveries, do not mix them up:

1. **Get 180k+ listings back on the live site** after Neon blocked connections
   for exceeding the free transfer quota. The rows were never deleted — they
   are still in Neon. After the monthly quota resets (1st of the month), run
   `export_neon_to_sqlite.py` (Neon Export workflow). `manus-to-live.yml`
   merges that `neon-export-*` release into the public snapshot catalog.

2. **This script** is the other direction: push unique rows from the outage
   SQLite merged-db (Manus/laptop-era scrapes that Neon never saw) into Neon
   once it is accepting writes again. Keyed on `(source, source_id)`.

Usage:
  HOT_DATABASE_URL=postgresql://... python scripts/ops/import_sqlite_to_neon.py merged-autolens.db.gz
  python scripts/ops/import_sqlite_to_neon.py dump.db.gz --dsn postgresql://... --dry-run
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import merge_sqlite_dump as msd  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv if argv is None else ["import_sqlite_to_neon.py", *argv])
    dsn = (
        os.environ.get("HOT_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or os.environ.get("COLD_DATABASE_URL")
        or ""
    )
    skip_next = False
    positional: list[str] = []
    passthrough: list[str] = []
    for i, arg in enumerate(argv[1:], start=1):
        if skip_next:
            skip_next = False
            continue
        if arg in ("--dsn", "--target"):
            if i + 1 >= len(argv):
                print(f"ERROR: {arg} requires a value", file=sys.stderr)
                return 2
            dsn = argv[i + 1]
            skip_next = True
            continue
        if arg.startswith("--dsn=") or arg.startswith("--target="):
            dsn = arg.split("=", 1)[1]
            continue
        if arg.startswith("-"):
            passthrough.append(arg)
            continue
        positional.append(arg)

    if not positional:
        print("ERROR: pass a .db or .db.gz dump path", file=sys.stderr)
        return 2
    if not dsn:
        print(
            "ERROR: no Postgres DSN. Pass --dsn or set HOT_DATABASE_URL.",
            file=sys.stderr,
        )
        return 2

    sys.argv = ["merge_sqlite_dump.py", positional[0], "--target", dsn, *passthrough]
    return msd.main()


if __name__ == "__main__":
    raise SystemExit(main())
