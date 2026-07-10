import sys
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


def test_health_reports_degraded_when_db_probe_fails(monkeypatch):
    def broken_probe():
        raise RuntimeError("db unreachable")

    monkeypatch.setattr(main, "_probe_db", broken_probe)

    client = TestClient(main.app)
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "degraded"
    assert body["db"] == "down"
