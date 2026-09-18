"""Config self-check surfaces silent auth misconfiguration in /health."""

import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app import main
from app.utils import config_check


def test_no_problems_when_gates_off(monkeypatch):
    monkeypatch.setenv("APP_ACCESS_ENFORCED", "false")
    monkeypatch.setenv("PRO_ACCESS_ENFORCED", "false")
    monkeypatch.delenv("AUTH_TOKEN_SECRET", raising=False)
    assert config_check.config_problems() == []


def test_no_problems_when_gates_on_with_secret(monkeypatch):
    monkeypatch.setenv("APP_ACCESS_ENFORCED", "true")
    monkeypatch.setenv("PRO_ACCESS_ENFORCED", "true")
    monkeypatch.setenv("AUTH_TOKEN_SECRET", "a-real-secret")
    assert config_check.config_problems() == []


def test_flags_gates_on_with_empty_secret(monkeypatch):
    monkeypatch.setenv("APP_ACCESS_ENFORCED", "true")
    monkeypatch.setenv("PRO_ACCESS_ENFORCED", "true")
    monkeypatch.delenv("AUTH_TOKEN_SECRET", raising=False)

    problems = config_check.config_problems()
    assert len(problems) == 1
    assert "AUTH_TOKEN_SECRET" in problems[0]
    assert "APP_ACCESS_ENFORCED" in problems[0]
    assert "PRO_ACCESS_ENFORCED" in problems[0]

    monkeypatch.setenv("AUTH_TOKEN_SECRET", "   ")  # whitespace-only = empty
    assert len(config_check.config_problems()) == 1


def test_health_reports_config_without_changing_status(monkeypatch):
    monkeypatch.setattr(main, "_probe_db", lambda: None)
    monkeypatch.setattr(main, "config_problems", lambda: ["AUTH_TOKEN_SECRET is empty"])

    client = TestClient(main.app)
    response = client.get("/health")

    # Status stays ok: an auth-config problem must not pull the Space out of
    # rotation (traffic still serves public reads), but it must be visible.
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["config"] == ["AUTH_TOKEN_SECRET is empty"]


def test_health_config_clean_by_default(monkeypatch):
    monkeypatch.setattr(main, "_probe_db", lambda: None)
    monkeypatch.setattr(main, "config_problems", lambda: [])

    client = TestClient(main.app)
    body = client.get("/health").json()
    assert body["config"] == []


def test_log_config_warnings_emits_per_problem(monkeypatch):
    logged = []
    monkeypatch.setattr(
        config_check.logger, "critical", lambda *a, **k: logged.append((a, k))
    )
    monkeypatch.setattr(
        config_check, "config_problems", lambda: ["problem one", "problem two"]
    )

    config_check.log_config_warnings()
    assert len(logged) == 2
