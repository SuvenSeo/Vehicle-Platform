import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.append(str(Path(__file__).resolve().parents[1]))

import run_sync
from app.api.v1.endpoints import auth, pipeline
from db.models import Base, ScrapeRun


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _pipeline_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def _get_db_override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(pipeline.router, prefix="/api/v1/pipeline")
    app.dependency_overrides[pipeline.get_db] = _get_db_override
    return TestClient(app)


def test_build_trigger_command_uses_python_executable_and_known_script():
    sync_cmd = pipeline._build_trigger_command("sync")
    alt_cmd = pipeline._build_trigger_command("alt_sync")

    assert sync_cmd[0] == sys.executable
    assert alt_cmd[0] == sys.executable
    assert sync_cmd[-1].endswith("run_sync.py")
    assert alt_cmd[-1].endswith("run_alt_sync.py")


def test_trigger_pipeline_job_returns_launch_metadata(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret")
    monkeypatch.setattr(
        pipeline,
        "_launch_background_job",
        lambda job: {
            "job": job,
            "pid": 999,
            "command": "python run_sync.py",
            "started_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    payload = pipeline.PipelineTriggerRequest(job="sync")
    data = pipeline.trigger_pipeline_job(payload, _admin=None)

    assert data["accepted"] is True
    assert data["job"] == "sync"
    assert data["pid"] == 999


def test_require_admin_key_rejects_missing_or_invalid_key(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret")

    for supplied in (None, "wrong"):
        try:
            pipeline.require_admin_key(supplied)
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 401
        else:
            raise AssertionError("invalid admin key should be rejected")

    assert pipeline.require_admin_key("secret") is None


def test_pipeline_runs_returns_recent_rows_in_desc_order():
    db = _session()
    db.add_all(
        [
            ScrapeRun(
                source="ikman",
                started_at=datetime(2026, 4, 1, 3, 0, tzinfo=timezone.utc),
                finished_at=datetime(2026, 4, 1, 3, 10, tzinfo=timezone.utc),
                status="SUCCESS",
                listings_found=120,
                listings_new=22,
            ),
            ScrapeRun(
                source="autolanka",
                started_at=datetime(2026, 4, 2, 4, 0, tzinfo=timezone.utc),
                finished_at=datetime(2026, 4, 2, 4, 8, tzinfo=timezone.utc),
                status="FAILED",
                listings_found=20,
                listings_new=0,
                error_message="timeout",
            ),
        ]
    )
    db.commit()

    payload = pipeline.pipeline_runs(limit=1, db=db, is_admin=False)

    assert payload["count"] == 1
    assert payload["runs"][0]["source"] == "autolanka"
    assert payload["runs"][0]["status"] == "FAILED"


def test_pipeline_runs_redacts_error_message_for_anonymous_callers():
    db = _session()
    db.add(
        ScrapeRun(
            source="autolanka",
            started_at=datetime(2026, 4, 2, 4, 0, tzinfo=timezone.utc),
            finished_at=datetime(2026, 4, 2, 4, 8, tzinfo=timezone.utc),
            status="FAILED",
            listings_found=20,
            listings_new=0,
            error_message="Connection refused at 10.0.0.5:5432 (internal db host)",
        )
    )
    db.commit()

    anonymous = pipeline.pipeline_runs(limit=1, db=db, is_admin=False)
    admin = pipeline.pipeline_runs(limit=1, db=db, is_admin=True)

    assert anonymous["runs"][0]["error_message"] == pipeline.REDACTED_ERROR_MESSAGE
    assert admin["runs"][0]["error_message"] == "Connection refused at 10.0.0.5:5432 (internal db host)"


def test_pipeline_runs_omits_error_message_field_value_when_no_error():
    db = _session()
    db.add(
        ScrapeRun(
            source="ikman",
            started_at=datetime(2026, 4, 1, 3, 0, tzinfo=timezone.utc),
            finished_at=datetime(2026, 4, 1, 3, 10, tzinfo=timezone.utc),
            status="SUCCESS",
            listings_found=120,
            listings_new=22,
        )
    )
    db.commit()

    payload = pipeline.pipeline_runs(limit=1, db=db, is_admin=False)

    assert payload["runs"][0]["error_message"] is None


def test_has_valid_admin_key_true_only_for_matching_key(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret")

    assert pipeline.has_valid_admin_key("secret") is True
    assert pipeline.has_valid_admin_key("wrong") is False
    assert pipeline.has_valid_admin_key(None) is False


def test_has_valid_admin_key_false_when_unconfigured(monkeypatch):
    monkeypatch.delenv("ADMIN_API_KEY", raising=False)

    assert pipeline.has_valid_admin_key("anything") is False


def test_pipeline_status_redacts_last_error_for_anonymous_callers():
    db = _session()
    db.add(
        ScrapeRun(
            source="ikman",
            started_at=datetime(2026, 4, 2, 4, 0, tzinfo=timezone.utc),
            finished_at=datetime(2026, 4, 2, 4, 8, tzinfo=timezone.utc),
            status="FAILED",
            listings_found=20,
            listings_new=0,
            error_message="Playwright timeout: /home/runner/secrets.txt not found",
        )
    )
    db.commit()

    anonymous = pipeline.pipeline_status(db=db, is_admin=False)
    admin = pipeline.pipeline_status(db=db, is_admin=True)

    anon_job = next(j for j in anonymous["jobs"] if j["name"] == "scrape_ikman")
    admin_job = next(j for j in admin["jobs"] if j["name"] == "scrape_ikman")

    assert anon_job["last_error"] == pipeline.REDACTED_ERROR_MESSAGE
    assert admin_job["last_error"] == "Playwright timeout: /home/runner/secrets.txt not found"


def test_finalize_scrape_run_marks_zero_yield_success_as_degraded():
    db = _session()
    run = ScrapeRun(
        source="ikman",
        started_at=datetime(2026, 4, 1, 3, 0, tzinfo=timezone.utc),
        status="RUNNING",
        listings_found=0,
        listings_new=0,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    run_sync._finalize_scrape_run(
        db,
        run,
        status="SUCCESS",
        listings_found=0,
        listings_new=0,
    )
    db.refresh(run)

    assert run.status == "DEGRADED"


def test_finalize_scrape_run_keeps_failed_status_for_exceptions():
    db = _session()
    run = ScrapeRun(
        source="ikman",
        started_at=datetime(2026, 4, 1, 3, 0, tzinfo=timezone.utc),
        status="RUNNING",
        listings_found=0,
        listings_new=0,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    run_sync._finalize_scrape_run(
        db,
        run,
        status="FAILED",
        listings_found=0,
        listings_new=0,
        error_message="timeout",
    )
    db.refresh(run)

    assert run.status == "FAILED"


def test_pipeline_status_maps_latest_degraded_run_to_delayed():
    db = _session()
    db.add_all(
        [
            ScrapeRun(
                source="ikman",
                started_at=datetime(2026, 4, 1, 2, 0, tzinfo=timezone.utc),
                finished_at=datetime(2026, 4, 1, 2, 10, tzinfo=timezone.utc),
                status="SUCCESS",
                listings_found=100,
                listings_new=5,
            ),
            ScrapeRun(
                source="ikman",
                started_at=datetime(2026, 4, 1, 3, 0, tzinfo=timezone.utc),
                finished_at=datetime(2026, 4, 1, 3, 5, tzinfo=timezone.utc),
                status="DEGRADED",
                listings_found=0,
                listings_new=0,
            ),
        ]
    )
    db.commit()

    payload = pipeline.pipeline_status(db=db, is_admin=False)
    job = next(item for item in payload["jobs"] if item["name"] == "scrape_ikman")

    assert job["last_status"] == "DEGRADED"
    assert job["status"] == "delayed"


def test_pipeline_runs_endpoint_is_rate_limited():
    client = _pipeline_client()
    limiter = pipeline._pipeline_read_rate_limiter
    original_max_requests = limiter.max_requests
    original_window_seconds = limiter.window_seconds
    limiter.reset()
    limiter.max_requests = 1
    limiter.window_seconds = 60

    try:
        first = client.get("/api/v1/pipeline/runs")
        second = client.get("/api/v1/pipeline/runs")
    finally:
        limiter.max_requests = original_max_requests
        limiter.window_seconds = original_window_seconds
        limiter.reset()
        client.close()

    assert first.status_code == 200
    assert second.status_code == 429


def test_pipeline_status_endpoint_is_rate_limited():
    client = _pipeline_client()
    limiter = pipeline._pipeline_read_rate_limiter
    original_max_requests = limiter.max_requests
    original_window_seconds = limiter.window_seconds
    limiter.reset()
    limiter.max_requests = 1
    limiter.window_seconds = 60

    try:
        first = client.get("/api/v1/pipeline/status")
        second = client.get("/api/v1/pipeline/status")
    finally:
        limiter.max_requests = original_max_requests
        limiter.window_seconds = original_window_seconds
        limiter.reset()
        client.close()

    assert first.status_code == 200
    assert second.status_code == 429


# ---------------------------------------------------------------------------
# Pipeline read auth gate tests
# ---------------------------------------------------------------------------

def _pipeline_client_enforced(monkeypatch):
    """Test client with APP_ACCESS_ENFORCED=true and a known ADMIN_API_KEY."""
    monkeypatch.setenv("APP_ACCESS_ENFORCED", "true")
    monkeypatch.setenv("ADMIN_API_KEY", "test-admin-key")
    monkeypatch.setenv("AUTH_TOKEN_SECRET", "test-pipeline-secret")
    monkeypatch.setenv(
        "AUTH_USERS",
        json.dumps([{"email": "pipeuser@example.com", "password": "pw", "plan": "free"}]),
    )

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def _get_db_override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(pipeline.router, prefix="/api/v1/pipeline")
    app.dependency_overrides[pipeline.get_db] = _get_db_override
    return TestClient(app)


def test_pipeline_runs_requires_auth_when_enforced(monkeypatch):
    client = _pipeline_client_enforced(monkeypatch)
    response = client.get("/api/v1/pipeline/runs")
    client.close()
    assert response.status_code == 401


def test_pipeline_runs_allows_admin_key_when_enforced(monkeypatch):
    client = _pipeline_client_enforced(monkeypatch)
    response = client.get("/api/v1/pipeline/runs", headers={"X-Admin-Key": "test-admin-key"})
    client.close()
    assert response.status_code == 200


def test_pipeline_runs_rejects_wrong_admin_key_when_enforced(monkeypatch):
    client = _pipeline_client_enforced(monkeypatch)
    response = client.get("/api/v1/pipeline/runs", headers={"X-Admin-Key": "wrong-key"})
    client.close()
    assert response.status_code == 401


def test_pipeline_runs_allows_authenticated_session_when_enforced(monkeypatch):
    monkeypatch.setenv("APP_ACCESS_ENFORCED", "true")
    monkeypatch.setenv("AUTH_TOKEN_SECRET", "test-pipeline-secret")
    monkeypatch.setenv(
        "AUTH_USERS",
        json.dumps([{"email": "pipeuser@example.com", "password": "pw", "plan": "free"}]),
    )
    token, _ = auth.issue_token("pipeuser@example.com", "free")

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def _get_db_override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(pipeline.router, prefix="/api/v1/pipeline")
    app.dependency_overrides[pipeline.get_db] = _get_db_override

    client = TestClient(app)
    response = client.get(
        "/api/v1/pipeline/runs",
        headers={"Authorization": f"Bearer {token}"},
    )
    client.close()
    assert response.status_code == 200


def test_pipeline_status_requires_auth_when_enforced(monkeypatch):
    client = _pipeline_client_enforced(monkeypatch)
    response = client.get("/api/v1/pipeline/status")
    client.close()
    assert response.status_code == 401


def test_pipeline_status_allows_admin_key_when_enforced(monkeypatch):
    client = _pipeline_client_enforced(monkeypatch)
    response = client.get("/api/v1/pipeline/status", headers={"X-Admin-Key": "test-admin-key"})
    client.close()
    assert response.status_code == 200


def test_pipeline_runs_open_when_not_enforced(monkeypatch):
    # conftest already sets APP_ACCESS_ENFORCED=false; verify existing client works
    client = _pipeline_client()
    response = client.get("/api/v1/pipeline/runs")
    client.close()
    assert response.status_code == 200


def test_pipeline_trigger_still_requires_admin_key(monkeypatch):
    """POST /trigger is unaffected by the read auth gate — admin-key only."""
    monkeypatch.setenv("APP_ACCESS_ENFORCED", "true")
    monkeypatch.setenv("ADMIN_API_KEY", "trigger-key")
    monkeypatch.setenv("AUTH_TOKEN_SECRET", "test-pipeline-secret")
    monkeypatch.setenv(
        "AUTH_USERS",
        json.dumps([{"email": "u@example.com", "password": "pw", "plan": "free"}]),
    )
    token, _ = auth.issue_token("u@example.com", "free")

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    def _get_db_override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(pipeline.router, prefix="/api/v1/pipeline")
    app.dependency_overrides[pipeline.get_db] = _get_db_override

    client = TestClient(app)

    # Session-only → rejected (trigger requires admin key)
    resp_session = client.post(
        "/api/v1/pipeline/trigger",
        json={"job": "sync"},
        headers={"Authorization": f"Bearer {token}"},
    )
    # No admin key at all → 401
    resp_none = client.post("/api/v1/pipeline/trigger", json={"job": "sync"})

    client.close()

    assert resp_session.status_code == 401
    assert resp_none.status_code == 401
