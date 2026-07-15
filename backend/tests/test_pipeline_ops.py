import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import pipeline
from db.models import Base, ScrapeRun


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


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
