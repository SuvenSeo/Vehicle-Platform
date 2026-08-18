#!/usr/bin/env python3
"""Ingest ProblemsByVin weekly datasets into vehicle_reliability_snapshots.

Usage (from backend/):
  ALLOW_SQLITE_FALLBACK=true .venv/bin/python scripts/ingest_problemsbyvin.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("ALLOW_SQLITE_FALLBACK", "true")

from db.session import SessionLocal, init_db  # noqa: E402
from app.services.problemsbyvin import ingest_datasets  # noqa: E402


def main() -> int:
    init_db()
    db = SessionLocal()
    try:
        result = ingest_datasets(db)
        print(result)
        return 0 if result.get("status") == "success" else 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
