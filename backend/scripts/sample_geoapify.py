#!/usr/bin/env python3
"""Geocode a live sample of listings via Geoapify (does not overwrite raw_location).

Usage (from backend/):
  ALLOW_SQLITE_FALLBACK=true ENRICHMENT_GEOAPIFY=true GEOAPIFY_API_KEY=… \\
    .venv/bin/python scripts/sample_geoapify.py --limit 100
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("ALLOW_SQLITE_FALLBACK", "true")

from db.session import SessionLocal, init_db  # noqa: E402
from app.services.geo_service import sample_geocode  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Geoapify 100-record location sample")
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()
    init_db()
    db = SessionLocal()
    try:
        result = sample_geocode(db, limit=args.limit)
        print(result)
        return 0 if result.get("status") in {"success", "partial", "skipped"} else 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
