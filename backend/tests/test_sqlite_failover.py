"""SQLite failover when Neon transfer quota blocks the live API."""

from __future__ import annotations

import gzip
import sqlite3
from pathlib import Path

import pytest

from sqlalchemy import text

from db import session as db_session
from db import sqlite_failover


def _tiny_sqlite(path: Path) -> Path:
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE IF NOT EXISTS ping (id INTEGER)")
    conn.execute("INSERT INTO ping (id) VALUES (1)")
    conn.commit()
    conn.close()
    return path


def test_reattach_engines_points_sessions_at_sqlite(tmp_path):
    restore_url = db_session.HOT_URL
    db_path = _tiny_sqlite(tmp_path / "failover.db")
    try:
        db_session.reattach_engines(f"sqlite:///{db_path}")
        with db_session.SessionLocal() as db:
            assert db.execute(text("SELECT id FROM ping")).scalar() == 1
        with db_session.HotSessionLocal() as db:
            assert db.execute(text("SELECT 1")).scalar() == 1
    finally:
        db_session.reattach_engines(restore_url)


def test_maybe_activate_downloads_when_neon_is_down(tmp_path, monkeypatch):
    sqlite_failover._activated = False
    restore_url = db_session.HOT_URL
    dest = tmp_path / "merged.db"
    gz_source = tmp_path / "merged-autolens.db.gz"
    db_path = _tiny_sqlite(tmp_path / "source.db")
    with db_path.open("rb") as src, gzip.open(gz_source, "wb") as out:
        out.write(src.read())

    monkeypatch.setenv("SQLITE_FAILOVER_FORCE", "true")
    monkeypatch.setenv("SQLITE_FAILOVER_PATH", str(dest))
    monkeypatch.setenv("MERGED_SQLITE_URL", gz_source.as_uri())
    monkeypatch.setattr(db_session, "HOT_URL", "postgresql://example.neon.tech/neondb")
    monkeypatch.setattr(sqlite_failover, "neon_reachable", lambda: False)

    try:
        assert sqlite_failover.maybe_activate_sqlite_failover() is True
        assert dest.is_file()
        with db_session.SessionLocal() as db:
            assert db.execute(text("SELECT 1")).scalar() == 1
    finally:
        sqlite_failover._activated = False
        db_session.reattach_engines(restore_url)


def test_maybe_activate_skips_when_neon_is_up(monkeypatch):
    sqlite_failover._activated = False
    monkeypatch.setenv("SQLITE_FAILOVER_FORCE", "true")
    monkeypatch.setattr(db_session, "HOT_URL", "postgresql://example.neon.tech/neondb")
    monkeypatch.setattr(sqlite_failover, "neon_reachable", lambda: True)
    monkeypatch.setattr(
        sqlite_failover,
        "download_merged_sqlite",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("must not download")),
    )
    assert sqlite_failover.maybe_activate_sqlite_failover() is False


@pytest.fixture(autouse=True)
def _reset_failover_state():
    sqlite_failover._activated = False
    sqlite_failover._primary_url = None
    yield
    sqlite_failover._activated = False
    sqlite_failover._primary_url = None


def test_tick_fails_back_to_neon_after_recovery(monkeypatch):
    """When the quota resets, the monitor rebinds to the saved primary DSN."""
    sqlite_failover._activated = True
    sqlite_failover._primary_url = "postgresql://example.neon.tech/neondb"
    monkeypatch.setenv("SQLITE_FAILOVER_FORCE", "true")
    monkeypatch.setattr(sqlite_failover, "_probe_url", lambda url, **kwargs: True)
    reattached: list[str] = []
    monkeypatch.setattr(db_session, "reattach_engines", reattached.append)

    sqlite_failover._tick_once()

    assert reattached == ["postgresql://example.neon.tech/neondb"]
    assert sqlite_failover._activated is False


def test_tick_stays_failed_over_while_neon_is_still_down(monkeypatch):
    sqlite_failover._activated = True
    sqlite_failover._primary_url = "postgresql://example.neon.tech/neondb"
    monkeypatch.setenv("SQLITE_FAILOVER_FORCE", "true")
    monkeypatch.setattr(sqlite_failover, "_probe_url", lambda url, **kwargs: False)
    monkeypatch.setattr(
        db_session,
        "reattach_engines",
        lambda url: (_ for _ in ()).throw(AssertionError("must not fail back")),
    )

    sqlite_failover._tick_once()

    assert sqlite_failover._activated is True


def test_tick_retries_download_on_next_pass_after_failure(tmp_path, monkeypatch):
    """A failed download must not consume the only failover attempt."""
    restore_url = db_session.HOT_URL
    monkeypatch.setenv("SQLITE_FAILOVER_FORCE", "true")
    monkeypatch.setenv("SQLITE_FAILOVER_PATH", str(tmp_path / "merged.db"))
    monkeypatch.setattr(db_session, "HOT_URL", "postgresql://example.neon.tech/neondb")
    monkeypatch.setattr(sqlite_failover, "neon_reachable", lambda: False)
    monkeypatch.setattr(
        sqlite_failover,
        "download_merged_sqlite",
        lambda *args, **kwargs: (_ for _ in ()).throw(OSError("mirror down")),
    )
    try:
        with pytest.raises(RuntimeError, match="all failover DB sources failed"):
            sqlite_failover._tick_once()
        # Not activated and no partial state — the next tick retries cleanly.
        assert sqlite_failover._activated is False
        assert not (tmp_path / "merged.db").exists()
    finally:
        db_session.HOT_URL = restore_url


def test_download_with_fallback_tries_mirrors_in_order(tmp_path, monkeypatch):
    monkeypatch.setenv("MERGED_SQLITE_URLS", "https://bad-one.example/x.gz,https://bad-two.example/y.gz")
    monkeypatch.setenv("MERGED_SQLITE_URL", "https://good.example/z.gz")
    attempts: list[str] = []

    def fake_download(dest, url):
        attempts.append(url)
        if "good" not in url:
            raise OSError("nope")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(b"x" * 2000)
        return dest

    monkeypatch.setattr(sqlite_failover, "download_merged_sqlite", fake_download)

    out = sqlite_failover._download_with_fallback(tmp_path / "merged.db")

    assert attempts[:3] == [
        "https://bad-one.example/x.gz",
        "https://bad-two.example/y.gz",
        "https://good.example/z.gz",
    ]
    assert out.stat().st_size >= 1_000


def test_candidate_sources_prefer_vercel_over_private_github_release(monkeypatch):
    monkeypatch.delenv("MERGED_SQLITE_URLS", raising=False)
    monkeypatch.delenv("MERGED_SQLITE_URL", raising=False)
    sources = sqlite_failover._candidate_sources()
    assert sources[0] == sqlite_failover.VERCEL_MERGED_DB_URL
    assert sqlite_failover.DEFAULT_MERGED_DB_URL in sources
