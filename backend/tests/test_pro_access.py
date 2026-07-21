"""Tests for PRO_ACCESS_ENFORCED env-var gating on /api/v1/pro/* endpoints.

Covers:
- pro_access_enforced() is ON by default (secure by default); only explicit
  falsey values disable it
- require_pro_access() is a no-op when enforcement is explicitly disabled
- require_pro_access() raises 401 when enforcement is on and no token is supplied
- require_pro_access() raises 403 when enforcement is on and the token belongs to a free plan
- require_pro_access() passes silently when enforcement is on and the token is a valid Pro token
"""

import os
import sys
import time
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints.auth import (
    issue_token,
    pro_access_enforced,
    require_pro_access,
)


class _DummyRequest:
    headers = {"user-agent": "pytest"}
    client = type("Client", (), {"host": "127.0.0.1"})()
    cookies: dict = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_token(plan: str, *, secret: str = "test-secret") -> str:
    os.environ["AUTH_TOKEN_SECRET"] = secret
    token, _ = issue_token("user@example.com", plan, now=time.time())
    return token


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_pro_access_enforced_by_default(monkeypatch):
    """PRO_ACCESS_ENFORCED defaults to ON; unset → True (secure by default)."""
    monkeypatch.delenv("PRO_ACCESS_ENFORCED", raising=False)
    assert pro_access_enforced() is True


def test_pro_access_enforced_when_env_is_true(monkeypatch):
    """PRO_ACCESS_ENFORCED accepts all common truthy strings."""
    for value in ("true", "1", "yes", "on", "TRUE", "Yes"):
        monkeypatch.setenv("PRO_ACCESS_ENFORCED", value)
        assert pro_access_enforced() is True, f"Expected True for {value!r}"


def test_pro_access_disabled_only_with_explicit_falsey_values(monkeypatch):
    """Only explicit falsey strings turn enforcement off (local dev opt-out)."""
    for value in ("false", "0", "no", "off", "FALSE", "Off"):
        monkeypatch.setenv("PRO_ACCESS_ENFORCED", value)
        assert pro_access_enforced() is False, f"Expected False for {value!r}"


def test_require_pro_access_is_noop_when_explicitly_disabled(monkeypatch):
    """When enforcement is explicitly off, require_pro_access() returns None."""
    monkeypatch.setenv("PRO_ACCESS_ENFORCED", "false")
    monkeypatch.setenv("AUTH_TOKEN_SECRET", "test-secret")
    # No authorization header supplied — should not raise.
    result = require_pro_access(request=_DummyRequest(), authorization=None)
    assert result is None


def test_require_pro_access_rejects_missing_token_when_enforced(monkeypatch):
    """When enforcement is on, a missing token → HTTP 401."""
    monkeypatch.setenv("PRO_ACCESS_ENFORCED", "true")
    monkeypatch.setenv("AUTH_TOKEN_SECRET", "test-secret")

    with pytest.raises(HTTPException) as exc_info:
        require_pro_access(request=_DummyRequest(), authorization=None)

    assert exc_info.value.status_code == 401


def test_require_pro_access_rejects_free_plan_token_when_enforced(monkeypatch):
    """A valid token for a free-plan user → HTTP 403 (subscription required)."""
    monkeypatch.setenv("PRO_ACCESS_ENFORCED", "true")
    monkeypatch.setenv("AUTH_TOKEN_SECRET", "test-secret")

    free_token = _make_token("free")

    with pytest.raises(HTTPException) as exc_info:
        require_pro_access(request=_DummyRequest(), authorization=f"Bearer {free_token}")

    assert exc_info.value.status_code == 403


def test_require_pro_access_allows_valid_pro_token_when_enforced(monkeypatch):
    """A valid Pro token passes through silently when enforcement is on."""
    monkeypatch.setenv("PRO_ACCESS_ENFORCED", "true")
    monkeypatch.setenv("AUTH_TOKEN_SECRET", "test-secret")

    pro_token = _make_token("pro")

    result = require_pro_access(request=_DummyRequest(), authorization=f"Bearer {pro_token}")
    assert result is None
