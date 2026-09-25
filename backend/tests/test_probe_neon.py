"""Skip Neon-backed jobs when monthly transfer quota blocks connections."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
OPS = BACKEND / "scripts" / "ops"
sys.path.insert(0, str(OPS))
sys.path.insert(0, str(BACKEND))

import probe_neon as probe  # noqa: E402


class _FakeCursor:
    def execute(self, _sql: str) -> None:
        return None

    def close(self) -> None:
        return None


class _FakeConn:
    def cursor(self) -> _FakeCursor:
        return _FakeCursor()

    def close(self) -> None:
        return None


def test_probe_missing_url_is_unavailable():
    available, reason = probe.probe_available("")
    assert available is False
    assert "missing" in reason


def test_probe_sqlite_url_is_available():
    available, reason = probe.probe_available("sqlite:///tmp/motormila.db")
    assert available is True
    assert "sqlite" in reason.lower()


def test_probe_postgres_success():
    def connect(_dsn: str, connect_timeout: int = 8):
        assert connect_timeout == 8
        return _FakeConn()

    available, reason = probe.probe_available(
        "postgres://user:pass@ep-example.aws.neon.tech/neondb",
        connect=connect,
    )
    assert available is True
    assert "SELECT 1" in reason


def test_probe_postgres_connect_failure():
    def connect(_dsn: str, connect_timeout: int = 8):
        raise RuntimeError("could not connect to server")

    available, reason = probe.probe_available(
        "postgresql://user:pass@ep-example.aws.neon.tech/neondb",
        connect=connect,
    )
    assert available is False
    assert "RuntimeError" in reason


def test_main_writes_github_output(tmp_path, monkeypatch, capsys):
    output = tmp_path / "github_output"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    monkeypatch.delenv("HOT_DATABASE_URL", raising=False)
    monkeypatch.delenv("COLD_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    assert probe.main([]) == 0
    captured = capsys.readouterr()
    assert "available=false" in captured.out
    assert output.read_text(encoding="utf-8") == "available=false\n"


def test_main_uses_hot_database_url(tmp_path, monkeypatch, capsys):
    output = tmp_path / "github_output"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    monkeypatch.setenv("HOT_DATABASE_URL", "sqlite:///backend/motormila.db")

    assert probe.main([]) == 0
    captured = capsys.readouterr()
    assert "available=true" in captured.out
    assert output.read_text(encoding="utf-8") == "available=true\n"


def test_psycopg_dsn_rewrites_postgres_scheme():
    dsn = probe._psycopg_dsn("postgres://user:pass@host/db")
    assert dsn.startswith("postgresql://")
