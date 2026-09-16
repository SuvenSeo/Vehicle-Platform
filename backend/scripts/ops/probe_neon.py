#!/usr/bin/env python3
"""Probe whether Neon still accepts connections.

Neon Free blocks every connection once monthly transfer quota is exhausted.
Neon-backed GitHub Actions jobs must skip in that state instead of failing
and instead of retrying against a dead database.

This script always exits 0. Callers read `available=true|false` from stdout
and from $GITHUB_OUTPUT.

Usage:
  HOT_DATABASE_URL=postgresql://... python scripts/ops/probe_neon.py
"""

from __future__ import annotations

import os
import sys
from collections.abc import Callable
from urllib.parse import urlparse, urlunparse

ConnectFn = Callable[..., object]


def _write_github_output(available: bool) -> None:
    path = os.environ.get("GITHUB_OUTPUT", "").strip()
    if not path:
        return
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(f"available={'true' if available else 'false'}\n")


def _database_url() -> str:
    return (
        os.getenv("HOT_DATABASE_URL", "").strip()
        or os.getenv("COLD_DATABASE_URL", "").strip()
        or os.getenv("DATABASE_URL", "").strip()
    )


def _psycopg_dsn(url: str) -> str:
    parsed = urlparse(url)
    scheme = "postgresql" if parsed.scheme.startswith("postgres") else parsed.scheme
    return urlunparse(parsed._replace(scheme=scheme))


def probe_available(
    url: str,
    *,
    connect: ConnectFn | None = None,
    connect_timeout: int = 8,
) -> tuple[bool, str]:
    """Return (available, reason) without raising."""
    if not url:
        return False, "database URL missing"
    if url.startswith("sqlite"):
        return True, "sqlite DSN — not Neon"

    try:
        import psycopg2
    except ImportError:
        return False, "psycopg2 is not installed"

    connect_fn: ConnectFn = connect or psycopg2.connect
    dsn = _psycopg_dsn(url)
    try:
        conn = connect_fn(dsn, connect_timeout=connect_timeout)
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.close()
        finally:
            conn.close()
    except Exception as exc:  # noqa: BLE001 — any connect failure means skip
        return False, f"{type(exc).__name__}: {exc}"
    return True, "SELECT 1 succeeded"


def main(argv: list[str] | None = None) -> int:
    del argv  # CLI takes env only; kept for testability of the entrypoint.
    url = _database_url()
    available, reason = probe_available(url)
    print(f"available={'true' if available else 'false'}")
    print(reason)
    if not available:
        print("Skipping Neon-backed jobs. Manus → merged SQLite still updates the live catalog.")
    _write_github_output(available)
    return 0


if __name__ == "__main__":
    sys.exit(main())
