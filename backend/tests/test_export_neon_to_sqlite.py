"""Tests for Neon export probe / skip helpers (post-quota-reset recovery)."""

from __future__ import annotations

import sys
from pathlib import Path

OPS = Path(__file__).resolve().parents[1] / "scripts" / "ops"
sys.path.insert(0, str(OPS))

import export_neon_to_sqlite as ens  # noqa: E402


def test_neon_is_unavailable_on_connection_failures() -> None:
    class OperationalError(Exception):
        pass

    assert ens.neon_is_unavailable(TimeoutError("timed out"))
    assert ens.neon_is_unavailable(ConnectionError("refused"))
    assert ens.neon_is_unavailable(
        OperationalError("SSL connection has been closed unexpectedly")
    )
    assert ens.neon_is_unavailable(
        OperationalError("remaining transfer quota exceeded")
    )


def test_neon_is_unavailable_does_not_swallow_query_bugs() -> None:
    class ProgrammingError(Exception):
        pass

    assert not ens.neon_is_unavailable(ProgrammingError("syntax error"))
    assert not ens.neon_is_unavailable(ValueError("bad dsn"))
