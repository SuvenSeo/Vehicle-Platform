"""SQLite failover when Neon transfer quota blocks the live API."""

from __future__ import annotations

import gzip
import sqlite3
from pathlib import Path

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
