"""Regression tests for GET /api/v1/releases/app (Android in-app update checker).

`_releases_api_payload()` previously referenced an undefined `now` when storing
its cache entry, so *every* invocation raised NameError — silently swallowed by
`_github_payload()`'s broad except, which permanently disabled the GitHub-API
fallback for release discovery. These tests pin the cache write and the
endpoint's resolution order (env -> manifest -> GitHub API).
"""

import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app import main
from app.api.v1.endpoints import releases


@pytest.fixture(autouse=True)
def _reset_releases_cache():
    """Isolate the module-level release cache between tests."""
    releases._cache["fetched_at"] = 0.0
    releases._cache["payload"] = None
    yield
    releases._cache["fetched_at"] = 0.0
    releases._cache["payload"] = None


@pytest.fixture
def client() -> TestClient:
    return TestClient(main.app)


class _FakeResponse:
    """Minimal urlopen() stand-in supporting the context-manager protocol."""

    def __init__(self, payload: object) -> None:
        self._body = json.dumps(payload).encode("utf-8")

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *_exc) -> bool:
        return False


def test_releases_api_payload_does_not_raise_when_network_fails(monkeypatch):
    """The cache write must not depend on an undefined name (regression)."""

    def _boom(*_args, **_kwargs):
        raise OSError("network down")

    monkeypatch.setattr(releases.urllib.request, "urlopen", _boom)

    # Must return (not raise) so the caller's except-clause stays a safety net.
    assert releases._releases_api_payload() is None
    assert releases._cache["payload"] is None
    assert releases._cache["fetched_at"] > 0


def test_releases_api_payload_parses_latest_android_release(monkeypatch):
    """A published android-v* release with an APK asset is surfaced."""
    payload = [
        {
            "tag_name": "android-v1.5.2",
            "body": "Fixes and polish.",
            "published_at": "2026-09-18T10:00:00Z",
            "assets": [
                {"name": "motormila-1.5.2.apk", "browser_download_url": "https://example.test/app.apk"},
            ],
        }
    ]
    monkeypatch.setattr(
        releases.urllib.request, "urlopen", lambda *_a, **_k: _FakeResponse(payload)
    )

    result = releases._releases_api_payload()

    assert result is not None
    assert result["version"] == "1.5.2"
    assert result["apk_url"] == "https://example.test/app.apk"
    assert result["source"] == "github"
    assert releases._cache["payload"] == result


def test_releases_api_payload_skips_releases_without_apk(monkeypatch):
    payload = [
        {
            "tag_name": "android-v1.5.2",
            "assets": [{"name": "notes.txt", "browser_download_url": "https://example.test/n.txt"}],
        }
    ]
    monkeypatch.setattr(
        releases.urllib.request, "urlopen", lambda *_a, **_k: _FakeResponse(payload)
    )

    assert releases._releases_api_payload() is None


def test_release_endpoint_prefers_env_payload(monkeypatch, client):
    monkeypatch.setenv("APP_RELEASE_VERSION", "9.9.9")
    monkeypatch.setenv("APP_RELEASE_VERSION_CODE", "42")
    monkeypatch.setenv("APP_RELEASE_APK_URL", "https://example.test/env.apk")
    monkeypatch.setenv("APP_RELEASE_MIN_VERSION_CODE", "7")

    response = client.get("/api/v1/releases/app")

    assert response.status_code == 200
    body = response.json()
    assert body["version"] == "9.9.9"
    assert body["version_code"] == 42
    assert body["source"] == "env"
    assert body["min_supported_version_code"] == 7


def test_release_endpoint_stays_200_with_no_sources(monkeypatch, client):
    monkeypatch.delenv("APP_RELEASE_VERSION", raising=False)
    monkeypatch.setattr(releases, "_manifest_payload", lambda: None)
    monkeypatch.setattr(releases, "_releases_api_payload", lambda: None)

    response = client.get("/api/v1/releases/app")

    assert response.status_code == 200
    body = response.json()
    assert body["version"] is None
    assert body["apk_url"] is None
    assert body["source"] == "none"


def test_release_endpoint_falls_back_to_github_payload(monkeypatch, client):
    monkeypatch.delenv("APP_RELEASE_VERSION", raising=False)
    monkeypatch.setattr(releases, "_manifest_payload", lambda: None)
    monkeypatch.setattr(
        releases,
        "_releases_api_payload",
        lambda: {
            "version": "1.6.0",
            "version_code": None,
            "apk_url": "https://example.test/gh.apk",
            "notes": None,
            "published_at": None,
            "source": "github",
        },
    )

    response = client.get("/api/v1/releases/app")

    assert response.status_code == 200
    body = response.json()
    assert body["version"] == "1.6.0"
    assert body["apk_url"] == "https://example.test/gh.apk"
    assert body["source"] == "github"
    assert body["min_supported_version_code"] == 0