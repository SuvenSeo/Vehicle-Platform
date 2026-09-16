"""Fail the live API over to the public merged SQLite dump when Neon is down.

Neon Free blocks every connection once the monthly transfer quota is exhausted.
Public browsing is supposed to use Vercel snapshots, but a Git deploy omits
the gitignored listing catalog, so the SPA falls through to `/listings` and
renders a hard error. This module downloads the `merged-db` GitHub release
(the same SQLite file manus-to-live publishes) and rebinds SQLAlchemy onto it
so the Hugging Face API can keep serving listings until Neon resets.
"""

from __future__ import annotations

import gzip
import os
import shutil
import threading
import urllib.request
from pathlib import Path

import structlog
from sqlalchemy import text

from db import session as db_session

logger = structlog.get_logger()

DEFAULT_MERGED_DB_URL = (
    "https://github.com/SuvenSeo/Vehicle-Platform/releases/download/"
    "merged-db/merged-autolens.db.gz"
)
DEFAULT_FAILOVER_PATH = "/tmp/motormila-failover.db"

_lock = threading.Lock()
_activated = False


def failover_enabled() -> bool:
    raw = os.getenv("SQLITE_FAILOVER", "true").strip().lower()
    if raw in {"0", "false", "no", "off"}:
        return False
    # Unit tests already run on SQLite; never hit the network unless forced.
    if os.getenv("PYTEST_CURRENT_TEST") and os.getenv("SQLITE_FAILOVER_FORCE", "").strip().lower() not in {
        "1",
        "true",
        "yes",
        "on",
    }:
        return False
    return True


def neon_reachable(timeout_seconds: float = 3.0) -> bool:
    url = str(getattr(db_session, "HOT_URL", "") or "")
    if url.startswith("sqlite"):
        return True
    try:
        with db_session.hot_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:  # noqa: BLE001 — any connect failure means fail over
        logger.warning("neon_probe_failed", error=str(exc), timeout_seconds=timeout_seconds)
        return False


def download_merged_sqlite(dest: Path, source_url: str) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    gz_path = dest.with_suffix(dest.suffix + ".gz")
    tmp_gz = gz_path.with_name(gz_path.name + ".partial")
    tmp_db = dest.with_name(dest.name + ".partial")
    logger.info("sqlite_failover_download_start", url=source_url, dest=str(dest))
    try:
        with urllib.request.urlopen(source_url, timeout=120) as resp, tmp_gz.open("wb") as out:
            shutil.copyfileobj(resp, out, length=1024 * 1024)
        with gzip.open(tmp_gz, "rb") as src, tmp_db.open("wb") as out:
            shutil.copyfileobj(src, out, length=1024 * 1024)
        tmp_db.replace(dest)
    finally:
        tmp_gz.unlink(missing_ok=True)
        tmp_db.unlink(missing_ok=True)
    if dest.stat().st_size < 1_000:
        raise RuntimeError(f"Merged SQLite download was empty: {dest}")
    logger.info("sqlite_failover_download_done", bytes=dest.stat().st_size, dest=str(dest))
    return dest


def activate_sqlite_file(db_path: Path) -> None:
    db_session.reattach_engines(f"sqlite:///{db_path.resolve()}")
    global _activated
    _activated = True
    logger.info("sqlite_failover_activated", path=str(db_path.resolve()))


def maybe_activate_sqlite_failover() -> bool:
    """Download the merged dump and rebind engines when Neon cannot be probed.

    Returns True when the API is (now) on SQLite. Safe to call repeatedly.
    """
    if not failover_enabled():
        return False
    if str(getattr(db_session, "HOT_URL", "") or "").startswith("sqlite"):
        return True

    with _lock:
        if _activated:
            return True
        if neon_reachable():
            return False

        source_url = (
            os.getenv("MERGED_SQLITE_URL", "").strip() or DEFAULT_MERGED_DB_URL
        )
        dest = Path(os.getenv("SQLITE_FAILOVER_PATH", DEFAULT_FAILOVER_PATH))
        if not dest.is_file() or dest.stat().st_size < 1_000:
            download_merged_sqlite(dest, source_url)
        activate_sqlite_file(dest)
        return True


def start_sqlite_failover_background() -> None:
    if not failover_enabled():
        return
    if str(getattr(db_session, "HOT_URL", "") or "").startswith("sqlite"):
        return
    thread = threading.Thread(
        target=_run_failover_safe,
        name="sqlite-failover",
        daemon=True,
    )
    thread.start()


def _run_failover_safe() -> None:
    try:
        maybe_activate_sqlite_failover()
    except Exception as exc:  # noqa: BLE001 — never crash the API process
        logger.error("sqlite_failover_failed", error=str(exc))
