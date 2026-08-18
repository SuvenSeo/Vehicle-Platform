#!/usr/bin/env python3
"""RevCarData 100-record match-rate pilot (no LKR FMV writes).

Usage (from backend/):
  ALLOW_SQLITE_FALLBACK=true ENRICHMENT_REVCARDATA=true REVCARDATA_API_KEY=… \\
    .venv/bin/python scripts/pilot_revcardata.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("ALLOW_SQLITE_FALLBACK", "true")

from db.session import SessionLocal, init_db  # noqa: E402
from app.services.revcardata_pilot import run_pilot  # noqa: E402


def main() -> int:
    init_db()
    db = SessionLocal()
    try:
        result = run_pilot(db)
        print(result)
        return 0 if result.get("status") in {"success", "skipped"} else 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
