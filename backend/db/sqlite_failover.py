"""Fail the live API over to the public merged SQLite dump when Neon is down.

Neon Free blocks every connection once the monthly transfer quota is exhausted.
Public browsing is supposed to use Vercel snapshots, but a Git deploy omits
the gitignored listing catalog, so the SPA falls through to `/listings` and
renders a hard error. This module downloads the public merged SQLite dump
(the same file manus-to-live publishes) and rebinds SQLAlchemy onto it so the
Hugging Face API can keep serving until Neon resets.

Self-healing monitor (Sep 2026): the original implementation ran exactly once
at startup, so a Space that was already running when the quota tripped stayed
down until a manual restart — and when Neon recovered on the 1st, the Space
kept serving the stale dump until another restart. The background thread now
re-checks every ``SQLITE_FAILOVER_CHECK_SECONDS`` (default 120s):

  * Neon down, not failed over -> download the dump and rebind. A failed
    download no longer kills the only attempt; the next tick retries.
  * Neon back, failed over     -> rebind to the saved primary DSN
    automatically (no manual Space restart needed at month reset).

Download sources are tried in order: ``MERGED_SQLITE_URLS`` (comma-separated),
then ``MERGED_SQLITE_URL``, then the built-in defaults — the public Vercel
snapshot copy first, the GitHub ``merged-db`` release last (that repo is
private, so anonymous downloads of the release asset 404).
"""

from __future__ import annotations

import gzip
import os
import shutil
import threading
import time
import urllib.request
from pathlib import Path

import structlog
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

from db import session as db_session

logger = structlog.get_logger()

DEFAULT_MERGED_DB_URL = (
    "https://github.com/SuvenSeo/Vehicle-Platform/releases/download/"
    "merged-db/merged-autolens.db.gz"
)
# Public copy deployed next to the snapshot JSON by manus-to-live.yml. Unlike
# the GitHub release (private repo -> anonymous 404) this URL always works
# from the HF Space without credentials.
VERCEL_MERGED_DB_URL = (
    "https://motormila.vercel.app/snapshots/latest/merged-autolens.db.gz"
)
DEFAULT_FAILOVER_PATH = "/tmp/motormila-failover.db"

_lock = threading.Lock()
_activated = False
_primary_url: str | None = None
_consecutive_failures = 0


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


def failover_active() -> bool:
    """True while the API is serving from the downloaded SQLite dump."""
    return _activated


def _check_interval_seconds() -> int:
    raw = os.getenv("SQLITE_FAILOVER_CHECK_SECONDS", "120").strip()
    try:
        return max(15, int(raw))
    except ValueError:
        return 120


def _current_url() -> str:
    return str(getattr(db_session, "HOT_URL", "") or "")


def neon_reachable(timeout_seconds: float = 3.0) -> bool:
    url = _current_url()
    if url.startswith("sqlite"):
        return True
    try:
        with db_session.hot_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:  # noqa: BLE001 — any connect failure means fail over
        logger.warning("neon_probe_failed", error=str(exc), timeout_seconds=timeout_seconds)
        return False


def _probe_url(url: str, timeout_seconds: float = 3.0) -> bool:
    """Probe a raw DSN with a throwaway engine.

    Needed while failed over: ``db_session.hot_engine`` has been rebound to
    SQLite by then, so probing it would test the failover file, not Neon.
    """
    engine = create_engine(
        url,
        poolclass=NullPool,
        connect_args={"connect_timeout": max(1, int(timeout_seconds))},
    )
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:  # noqa: BLE001 — any connect failure means still down
        logger.warning("neon_reprobe_failed", error=str(exc))
        return False
    finally:
        engine.dispose()


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


def _candidate_sources() -> list[str]:
    """Ordered download mirrors for the merged dump, de-duplicated."""
    urls: list[str] = []
    for raw in os.getenv("MERGED_SQLITE_URLS", "").split(","):
        url = raw.strip()
        if url and url not in urls:
            urls.append(url)
    single = os.getenv("MERGED_SQLITE_URL", "").strip()
    if single and single not in urls:
        urls.append(single)
    for default in (VERCEL_MERGED_DB_URL, DEFAULT_MERGED_DB_URL):
        if default not in urls:
            urls.append(default)
    return urls


def _download_with_fallback(dest: Path) -> Path:
    """Try each mirror in order; only give up when every source fails."""
    last_error: Exception | None = None
    for url in _candidate_sources():
        try:
            return download_merged_sqlite(dest, url)
        except Exception as exc:  # noqa: BLE001 — try the next mirror
            last_error = exc
            logger.warning("sqlite_failover_source_failed", url=url, error=str(exc))
    raise RuntimeError(f"all failover DB sources failed; last error: {last_error}")


def _ensure_failover_schema() -> None:
    """Best-effort create_all on the failover file.

    Older merged dumps predate the auth/alert tables; without them every
    gated request 500s during the outage even though AUTH_USERS env auth
    could still work. create_all is a checkfirst no-op when they exist.
    """
    try:
        db_session.init_db()
    except Exception as exc:  # noqa: BLE001 — schema gaps must not undo the failover
        logger.error("sqlite_failover_init_db_failed", error=str(exc))


def _remember_primary_locked() -> None:
    """Capture the Postgres DSN to fail back to once Neon recovers."""
    global _primary_url
    url = _current_url()
    if url and not url.startswith("sqlite"):
        _primary_url = url


def _activate_locked() -> bool:
    """Download (if needed) and rebind onto the merged dump. Caller holds _lock."""
    dest = Path(os.getenv("SQLITE_FAILOVER_PATH", DEFAULT_FAILOVER_PATH))
    if not dest.is_file() or dest.stat().st_size < 1_000:
        _download_with_fallback(dest)
    activate_sqlite_file(dest)
    _ensure_failover_schema()
    return True


def maybe_activate_sqlite_failover() -> bool:
    """Download the merged dump and rebind engines when Neon cannot be probed.

    Returns True when the API is (now) on SQLite. Safe to call repeatedly.
    """
    if not failover_enabled():
        return False
    if _current_url().startswith("sqlite"):
        return True

    with _lock:
        if _activated:
            return True
        _remember_primary_locked()
        if neon_reachable():
            return False
        _activate_locked()
        return True


def _tick_once() -> None:
    """One monitor pass: fail over when Neon is down, fail back when it recovers."""
    if not failover_enabled():
        return
    if _current_url().startswith("sqlite") and not _activated:
        return  # local dev / tests on SQLite — nothing to fail over from

    with _lock:
        if _activated:
            primary = _primary_url
            if primary and _probe_url(primary):
                db_session.reattach_engines(primary)
                global _activated
                _activated = False
                # Never log credentials — host part only.
                logger.info("sqlite_failover_deactivated", primary_host=primary.split("@")[-1])
            return
        _remember_primary_locked()
        if neon_reachable():
            return
        _activate_locked()


def _monitor_loop() -> None:
    global _consecutive_failures
    interval = _check_interval_seconds()
    while True:
        try:
            _tick_once()
            _consecutive_failures = 0
        except Exception as exc:  # noqa: BLE001 — never kill the monitor thread
            _consecutive_failures += 1
            logger.error(
                "sqlite_failover_tick_failed",
                error=str(exc),
                failures=_consecutive_failures,
            )
        time.sleep(interval)


def start_sqlite_failover_background() -> None:
    if not failover_enabled():
        return
    if _current_url().startswith("sqlite"):
        return
    thread = threading.Thread(
        target=_monitor_loop,
        name="sqlite-failover-monitor",
        daemon=True,
    )
    thread.start()
