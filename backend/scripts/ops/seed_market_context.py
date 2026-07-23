#!/usr/bin/env python3
"""Seed curated DMT registration/population + policy regime market_signals."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.market_context_seed import (
    build_dmt_and_policy_signal_rows,
    upsert_market_context_signals,
)
from db.session import ColdSessionLocal, init_db


def main() -> int:
    rows = build_dmt_and_policy_signal_rows()
    print(f"prepared_rows={len(rows)}")
    init_db()
    db = ColdSessionLocal()
    try:
        result = upsert_market_context_signals(db)
        print(f"upsert={result}")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
