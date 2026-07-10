import hashlib
import json
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import auth


class DummyRequest:
    headers = {"user-agent": "pytest"}
    client = type("Client", (), {"host": "127.0.0.1"})()


def _configure(monkeypatch, *, plan: str = "enterprise"):
    monkeypatch.setenv("AUTH_TOKEN_SECRET", "test-secret")
    monkeypatch.setenv(
        "AUTH_USERS",
        json.dumps(
            [
                {
                    "email": "owner@example.com",
                    "password_sha256": hashlib.sha256(b"correct-horse").hexdigest(),
                    "name": "Owner Person",
                    "plan": plan,
                    "subscription_status": "active",
                }
            ]
        ),
    )


def setup_function():
    auth._login_rate_limiter._buckets.clear()


def test_login_rejected_when_not_configured(monkeypatch):
    monkeypatch.delenv("AUTH_TOKEN_SECRET", raising=False)
    monkeypatch.delenv("AUTH_USERS", raising=False)

    with pytest.raises(HTTPException) as excinfo:
        auth.login(auth.LoginRequest(email="a@b.com", password="x"), DummyRequest())

    assert excinfo.value.status_code == 503


def test_login_success_returns_signed_token_and_user(monkeypatch):
    _configure(monkeypatch)

    result = auth.login(auth.LoginRequest(email="OWNER@example.com", password="correct-horse"), DummyRequest())

    assert result["user"]["email"] == "owner@example.com"
    assert result["user"]["plan"] == "enterprise"
    assert result["user"]["avatarInitials"] == "OP"

    payload = auth.verify_token(result["token"])
    assert payload is not None
    assert payload["email"] == "owner@example.com"


def test_login_rejects_wrong_password(monkeypatch):
    _configure(monkeypatch)

    with pytest.raises(HTTPException) as excinfo:
        auth.login(auth.LoginRequest(email="owner@example.com", password="wrong"), DummyRequest())

    assert excinfo.value.status_code == 401


def test_verify_token_rejects_tampered_and_expired_tokens(monkeypatch):
    _configure(monkeypatch)

    token, _ = auth.issue_token("owner@example.com", "enterprise", now=1_000_000)
    assert auth.verify_token(token, now=1_000_100) is not None
    assert auth.verify_token(token + "0", now=1_000_100) is None
    assert auth.verify_token(token, now=1_000_000 + auth._token_ttl_seconds() + 1) is None


def test_pro_gate_open_by_default(monkeypatch):
    monkeypatch.delenv("PRO_ACCESS_ENFORCED", raising=False)

    # No token, gate not enforced: must be a no-op.
    assert auth.require_pro_access(authorization=None) is None


def test_pro_gate_enforced_requires_pro_plan(monkeypatch):
    _configure(monkeypatch, plan="enterprise")
    monkeypatch.setenv("PRO_ACCESS_ENFORCED", "true")

    with pytest.raises(HTTPException) as no_token:
        auth.require_pro_access(authorization=None)
    assert no_token.value.status_code == 401

    good_token, _ = auth.issue_token("owner@example.com", "enterprise")
    assert auth.require_pro_access(authorization=f"Bearer {good_token}") is None

    free_token, _ = auth.issue_token("someone@example.com", "free")
    with pytest.raises(HTTPException) as wrong_plan:
        auth.require_pro_access(authorization=f"Bearer {free_token}")
    assert wrong_plan.value.status_code == 403
