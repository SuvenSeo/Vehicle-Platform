import sys
from datetime import datetime, timedelta, timezone
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


def _freeze_now(monkeypatch, frozen: datetime):
    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            if tz is None:
                return frozen.replace(tzinfo=None) if frozen.tzinfo else frozen
            return frozen.astimezone(tz)

    monkeypatch.setattr(pipeline, "datetime", FrozenDateTime)


def _add_run(
    db,
    *,
    source: str,
    status: str,
    started_at: datetime,
    finished_at: datetime | None = None,
    error_message: str | None = None,
):
    run = ScrapeRun(
        source=source,
        started_at=started_at,
        finished_at=finished_at,
        status=status,
        listings_found=10,
        listings_new=1,
        error_message=error_message,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def test_expected_hours_widen_high_volume_sources():
    assert pipeline.EXPECTED_HOURS["ikman"] >= 14
    assert pipeline.EXPECTED_HOURS["riyasewana"] >= 14
    assert pipeline.EXPECTED_HOURS["ikman"] <= 16
    assert pipeline.EXPECTED_HOURS["riyasewana"] <= 16
    assert pipeline.EXPECTED_HOURS["autolanka"] == 12


def test_pipeline_status_treats_13h_core_gap_as_ok(monkeypatch):
    db = _session()
    now = datetime(2026, 7, 19, 14, 0, tzinfo=timezone.utc)
    success_at = now - timedelta(hours=13)
    _freeze_now(monkeypatch, now)

    _add_run(
        db,
        source="ikman",
        status="SUCCESS",
        started_at=success_at - timedelta(minutes=20),
        finished_at=success_at,
    )
    _add_run(
        db,
        source="riyasewana",
        status="SUCCESS",
        started_at=success_at - timedelta(minutes=15),
        finished_at=success_at,
    )

    payload = pipeline.pipeline_status(db=db, is_admin=False)

    ikman = next(job for job in payload["jobs"] if job["name"] == "scrape_ikman")
    riyasewana = next(job for job in payload["jobs"] if job["name"] == "scrape_riyasewana")

    assert ikman["status"] == "ok"
    assert riyasewana["status"] == "ok"
    assert ikman["expected_hours"] >= 14
    assert payload["overall_status"] == "ok"


def test_overall_status_ignores_secondary_source_delayed(monkeypatch):
    db = _session()
    now = datetime(2026, 7, 19, 14, 0, tzinfo=timezone.utc)
    recent = now - timedelta(hours=2)
    old = now - timedelta(hours=48)
    _freeze_now(monkeypatch, now)

    _add_run(
        db,
        source="ikman",
        status="SUCCESS",
        started_at=recent - timedelta(minutes=10),
        finished_at=recent,
    )
    _add_run(
        db,
        source="riyasewana",
        status="SUCCESS",
        started_at=recent - timedelta(minutes=8),
        finished_at=recent,
    )
    _add_run(
        db,
        source="patpat",
        status="SUCCESS",
        started_at=old - timedelta(minutes=5),
        finished_at=old,
    )

    payload = pipeline.pipeline_status(db=db, is_admin=False)

    patpat = next(job for job in payload["jobs"] if job["name"] == "scrape_patpat")
    assert patpat["status"] == "delayed"
    assert payload["overall_status"] == "ok"


def test_overall_status_delayed_when_core_source_stale(monkeypatch):
    db = _session()
    now = datetime(2026, 7, 19, 14, 0, tzinfo=timezone.utc)
    recent = now - timedelta(hours=2)
    stale = now - timedelta(hours=40)
    _freeze_now(monkeypatch, now)

    _add_run(
        db,
        source="ikman",
        status="SUCCESS",
        started_at=stale - timedelta(minutes=10),
        finished_at=stale,
    )
    _add_run(
        db,
        source="riyasewana",
        status="SUCCESS",
        started_at=recent - timedelta(minutes=8),
        finished_at=recent,
    )

    payload = pipeline.pipeline_status(db=db, is_admin=False)

    assert payload["overall_status"] == "delayed"
    ikman = next(job for job in payload["jobs"] if job["name"] == "scrape_ikman")
    assert ikman["status"] == "delayed"


def test_overall_status_running_when_core_source_running(monkeypatch):
    db = _session()
    now = datetime(2026, 7, 19, 14, 0, tzinfo=timezone.utc)
    recent = now - timedelta(hours=1)
    _freeze_now(monkeypatch, now)

    _add_run(
        db,
        source="ikman",
        status="RUNNING",
        started_at=now - timedelta(minutes=5),
        finished_at=None,
    )
    _add_run(
        db,
        source="riyasewana",
        status="SUCCESS",
        started_at=recent - timedelta(minutes=8),
        finished_at=recent,
    )

    payload = pipeline.pipeline_status(db=db, is_admin=False)

    assert payload["overall_status"] == "running"


def test_reconcile_orphan_running_runs_marks_stale_rows_failed():
    db = _session()
    now = datetime(2026, 7, 19, 14, 0, tzinfo=timezone.utc)
    stale = now - timedelta(minutes=pipeline.ORPHAN_RUNNING_MINUTES + 5)
    fresh = now - timedelta(minutes=10)

    orphan = _add_run(db, source="ikman", status="RUNNING", started_at=stale, finished_at=None)
    active = _add_run(db, source="riyasewana", status="RUNNING", started_at=fresh, finished_at=None)

    updated = pipeline.reconcile_orphan_running_runs(db, now=now)

    db.refresh(orphan)
    db.refresh(active)

    assert updated == 1
    assert orphan.status == "FAILED"
    assert orphan.finished_at is not None
    assert orphan.error_message == pipeline.ORPHAN_RUNNING_ERROR
    assert active.status == "RUNNING"
    assert active.finished_at is None


def test_pipeline_status_reconciles_orphan_running_before_reporting(monkeypatch):
    db = _session()
    now = datetime(2026, 7, 19, 14, 0, tzinfo=timezone.utc)
    stale = now - timedelta(minutes=pipeline.ORPHAN_RUNNING_MINUTES + 30)
    recent_success = now - timedelta(hours=2)
    _freeze_now(monkeypatch, now)

    orphan = _add_run(db, source="ikman", status="RUNNING", started_at=stale, finished_at=None)
    _add_run(
        db,
        source="ikman",
        status="SUCCESS",
        started_at=recent_success - timedelta(minutes=10),
        finished_at=recent_success,
    )
    _add_run(
        db,
        source="riyasewana",
        status="SUCCESS",
        started_at=recent_success - timedelta(minutes=8),
        finished_at=recent_success,
    )

    payload = pipeline.pipeline_status(db=db, is_admin=False)

    db.refresh(orphan)
    assert orphan.status == "FAILED"
    assert orphan.finished_at is not None

    ikman = next(job for job in payload["jobs"] if job["name"] == "scrape_ikman")
    assert ikman["status"] == "ok"
    assert payload["overall_status"] == "ok"


def test_latest_run_queries_do_not_scan_full_history_window():
    """Status helpers return one row per source even when many historical rows exist."""
    db = _session()
    now = datetime(2026, 7, 19, 14, 0, tzinfo=timezone.utc)

    for hour in range(50):
        finished = now - timedelta(hours=hour)
        _add_run(
            db,
            source="ikman",
            status="SUCCESS",
            started_at=finished - timedelta(minutes=5),
            finished_at=finished,
        )

    latest = pipeline._latest_run_per_source(db)
    successes = pipeline._latest_success_per_source(db)

    assert set(latest) == {"ikman"}
    assert set(successes) == {"ikman"}
    assert _to_close(latest["ikman"].started_at, now - timedelta(minutes=5))
    assert _to_close(successes["ikman"].finished_at, now)


def _to_close(actual, expected) -> bool:
    actual_utc = actual if actual.tzinfo else actual.replace(tzinfo=timezone.utc)
    expected_utc = expected if expected.tzinfo else expected.replace(tzinfo=timezone.utc)
    return abs((actual_utc - expected_utc).total_seconds()) < 1
