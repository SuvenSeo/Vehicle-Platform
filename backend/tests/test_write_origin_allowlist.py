"""Regression tests for the write-origin allowlist (CSRF gate on unsafe methods).

Bug: `_cors_allowed_origins()` returned the CORS_ORIGINS env value *instead of*
the built-in first-party list. A Space secret that listed only the API host
therefore revoked the frontend's own origin, and every authenticated write
(POST /alerts, PATCH alert channels, POST /listings/custom-estimate) failed with
"Writes require a trusted Origin." — the site blocking itself.

These tests pin the allowlist behaviour directly, without booting the whole app
(app.main needs Python 3.12; CI runs 3.12).
"""
import sys
from pathlib import Path

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints.auth import (
    FIRST_PARTY_ORIGINS,
    _cors_allowed_origins,
    _normalize_origin,
    _request_origin,
)

APP_ORIGIN = "https://motormila.vercel.app"


class _Req:
    def __init__(self, headers, method="POST"):
        self.headers = headers
        self.method = method


def test_app_origin_trusted_when_cors_origins_unset(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    assert APP_ORIGIN in _cors_allowed_origins()


def test_cors_origins_extends_and_never_shrinks(monkeypatch):
    """A CORS_ORIGINS value must not be able to revoke the app's own origin."""
    monkeypatch.setenv("CORS_ORIGINS", "https://seo292-vehicle-platform-backend.hf.space")
    allowed = _cors_allowed_origins()
    assert "https://seo292-vehicle-platform-backend.hf.space" in allowed  # extended
    assert APP_ORIGIN in allowed  # but first-party trust survives
    assert FIRST_PARTY_ORIGINS.issubset(allowed)


def test_cors_origins_adds_custom_deploys(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://motormila-abc123-team.vercel.app")
    allowed = _cors_allowed_origins()
    assert "https://motormila-abc123-team.vercel.app" in allowed
    assert APP_ORIGIN in allowed


def test_wildcard_never_widens_the_write_gate(monkeypatch):
    """A wildcard CORS config is a valid operator escape hatch for the response
    headers, but it must NOT become a blanket CSRF pass for cookie-borne writes —
    that would defeat the origin check entirely. The write gate keeps first-party
    trust and drops the wildcard."""
    monkeypatch.setenv("CORS_ORIGINS", "*")
    allowed = _cors_allowed_origins()
    assert "*" not in allowed
    assert APP_ORIGIN in allowed
    assert allowed == set(FIRST_PARTY_ORIGINS)


def test_request_origin_normalizes_trailing_slash_and_case(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    allowed = _cors_allowed_origins()
    for raw in [APP_ORIGIN + "/", APP_ORIGIN.upper()]:
        assert _request_origin(_Req({"origin": raw})) in allowed


def test_request_origin_falls_back_to_referer():
    assert _request_origin(_Req({"referer": "https://motormila.vercel.app/alerts?x=1"})) == APP_ORIGIN


def test_request_origin_none_when_absent():
    assert _request_origin(_Req({})) is None


def test_cross_origin_still_rejected(monkeypatch):
    """Hardening must not turn the gate into a no-op."""
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    assert _request_origin(_Req({"origin": "https://evil.example.com"})) not in _cors_allowed_origins()


def test_normalize_origin_rejects_junk():
    assert _normalize_origin("not a url") is None
    assert _normalize_origin("") is None
    assert _normalize_origin(None) is None
