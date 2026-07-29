import sys
import importlib
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app import main


def test_health_reports_db_ok_when_probe_succeeds(monkeypatch):
    # Hermetic: the real probe would hit whatever DB the local .env points at.
    monkeypatch.setattr(main, "_probe_db", lambda: None)

    client = TestClient(main.app)
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["db"] == "ok"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert response.headers["x-xss-protection"] == "0"
    assert response.headers["strict-transport-security"] == "max-age=31536000; includeSubDomains"
    assert "content-security-policy" in response.headers
    assert "permissions-policy" in response.headers
    assert "x-request-id" in response.headers


def test_health_reports_degraded_when_db_probe_fails(monkeypatch):
    def broken_probe():
        raise RuntimeError("db unreachable")

    monkeypatch.setattr(main, "_probe_db", broken_probe)

    client = TestClient(main.app)
    response = client.get("/health")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    assert body["db"] == "down"


def test_cors_wildcard_disables_credentials(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "*")
    reloaded_main = importlib.reload(main)

    cors_layer = next(layer for layer in reloaded_main.app.user_middleware if layer.cls.__name__ == "CORSMiddleware")
    assert cors_layer.kwargs["allow_origins"] == ["*"]
    assert cors_layer.kwargs["allow_credentials"] is False

    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    importlib.reload(main)
