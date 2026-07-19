from datetime import datetime, timezone, timedelta
import os
import secrets
import subprocess
import sys
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func

from app.services.source_aliases import canonical_source_key
from db.models import ScrapeRun
from db.session import get_db

router = APIRouter()

JOB_SCRIPT_MAP = {
    "sync": "run_sync.py",
    "alt_sync": "run_alt_sync.py",
}

SOURCE_ORDER = [
    "ikman",
    "riyasewana",
    "autolanka",
    "autodirect",
    "patpat",
    "autostream",
    "carshop",
    "saleme",
    "riyahub",
    "dimo",
]
# High-volume sources can have ~13h overnight gaps between syncs.
EXPECTED_HOURS = {
    "ikman": 15,
    "riyasewana": 15,
    "autolanka": 12,
    "autodirect": 12,
    "patpat": 12,
    "autostream": 12,
    "carshop": 12,
    "saleme": 12,
    "riyahub": 12,
    "dimo": 12,
}
CORE_SOURCES = frozenset({"ikman", "riyasewana"})
ORPHAN_RUNNING_MINUTES = 90
ORPHAN_RUNNING_ERROR = "Marked failed: orphan RUNNING scrape (exceeded stale threshold)."


class PipelineTriggerRequest(BaseModel):
    job: Literal["sync", "alt_sync"] = Field(..., description="Background pipeline job to run")


def require_admin_key(x_admin_key: str | None = Header(default=None, alias="X-Admin-Key")):
    configured_key = os.getenv("ADMIN_API_KEY", "").strip()
    if not configured_key:
        raise HTTPException(status_code=503, detail="Pipeline trigger is not configured.")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, configured_key):
        raise HTTPException(status_code=401, detail="Invalid admin key.")


REDACTED_ERROR_MESSAGE = "Error details hidden (admin key required)."


def has_valid_admin_key(x_admin_key: str | None = Header(default=None, alias="X-Admin-Key")) -> bool:
    """Non-raising variant of require_admin_key, for endpoints that stay public
    but gate sensitive fields (like raw scraper error text) behind the key."""
    configured_key = os.getenv("ADMIN_API_KEY", "").strip()
    return bool(configured_key) and bool(x_admin_key) and secrets.compare_digest(x_admin_key, configured_key)


def _visible_error_message(raw_error: str | None, *, is_admin: bool) -> str | None:
    message = str(raw_error or "").strip()
    if not message:
        return None
    return message if is_admin else REDACTED_ERROR_MESSAGE


def _to_utc(dt):
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _canonical_source(value: str | None) -> str | None:
    return canonical_source_key(value)


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _build_trigger_command(job: str) -> list[str]:
    script = JOB_SCRIPT_MAP.get(job)
    if script is None:
        raise ValueError(f"Unsupported job '{job}'. Allowed values: {', '.join(sorted(JOB_SCRIPT_MAP))}")
    return [sys.executable, str(_backend_root() / script)]


def _launch_background_job(job: str) -> dict:
    command = _build_trigger_command(job)
    process = subprocess.Popen(
        command,
        cwd=str(_backend_root()),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    return {
        "job": job,
        "pid": int(process.pid),
        "command": " ".join(command),
        "started_at": datetime.now(timezone.utc).isoformat(),
    }


def _is_running(run: ScrapeRun | None, now: datetime) -> bool:
    if run is None:
        return False
    status = str(run.status or "").upper()
    started_at = _to_utc(run.started_at)
    finished_at = _to_utc(run.finished_at)
    if status != "RUNNING":
        return False
    if started_at is None:
        return False
    if finished_at is not None:
        return False
    return now - started_at <= timedelta(hours=6)


def reconcile_orphan_running_runs(
    db: Session,
    *,
    older_than_minutes: int = ORPHAN_RUNNING_MINUTES,
    now: datetime | None = None,
) -> int:
    """Mark stale RUNNING scrape rows (no finished_at) as FAILED.

    Returns the number of rows updated. Safe to call repeatedly.
    """
    current = _to_utc(now) or datetime.now(timezone.utc)
    cutoff = current - timedelta(minutes=max(1, int(older_than_minutes)))
    orphans = (
        db.query(ScrapeRun)
        .filter(
            ScrapeRun.status == "RUNNING",
            ScrapeRun.finished_at.is_(None),
            ScrapeRun.started_at < cutoff,
        )
        .all()
    )
    if not orphans:
        return 0

    for run in orphans:
        run.status = "FAILED"
        run.finished_at = current
        existing = str(run.error_message or "").strip()
        if not existing:
            run.error_message = ORPHAN_RUNNING_ERROR

    db.commit()
    return len(orphans)


def _pick_preferred_run(existing: ScrapeRun | None, candidate: ScrapeRun, *, by_finished: bool) -> ScrapeRun:
    if existing is None:
        return candidate
    if by_finished:
        existing_ts = _to_utc(existing.finished_at)
        candidate_ts = _to_utc(candidate.finished_at)
    else:
        existing_ts = _to_utc(existing.started_at)
        candidate_ts = _to_utc(candidate.started_at)
    if candidate_ts and (existing_ts is None or candidate_ts > existing_ts):
        return candidate
    if candidate_ts == existing_ts and int(candidate.id or 0) > int(existing.id or 0):
        return candidate
    return existing


def _canonical_latest_map(runs: list[ScrapeRun], *, by_finished: bool) -> dict[str, ScrapeRun]:
    grouped: dict[str, ScrapeRun] = {}
    for run in runs:
        source_key = _canonical_source(run.source)
        if not source_key:
            continue
        grouped[source_key] = _pick_preferred_run(grouped.get(source_key), run, by_finished=by_finished)
    return grouped


def _latest_run_per_source(db: Session) -> dict[str, ScrapeRun]:
    """Portable per-source latest run (SQLite + Postgres) via grouped max(started_at)."""
    latest_started = (
        db.query(
            ScrapeRun.source.label("source"),
            func.max(ScrapeRun.started_at).label("max_started"),
        )
        .group_by(ScrapeRun.source)
        .subquery()
    )
    rows = (
        db.query(ScrapeRun)
        .join(
            latest_started,
            and_(
                ScrapeRun.source == latest_started.c.source,
                ScrapeRun.started_at == latest_started.c.max_started,
            ),
        )
        .all()
    )
    return _canonical_latest_map(rows, by_finished=False)


def _latest_success_per_source(db: Session) -> dict[str, ScrapeRun]:
    """Portable per-source latest SUCCESS run via grouped max(finished_at)."""
    latest_finished = (
        db.query(
            ScrapeRun.source.label("source"),
            func.max(ScrapeRun.finished_at).label("max_finished"),
        )
        .filter(
            ScrapeRun.status == "SUCCESS",
            ScrapeRun.finished_at.isnot(None),
        )
        .group_by(ScrapeRun.source)
        .subquery()
    )
    rows = (
        db.query(ScrapeRun)
        .join(
            latest_finished,
            and_(
                ScrapeRun.source == latest_finished.c.source,
                ScrapeRun.finished_at == latest_finished.c.max_finished,
                ScrapeRun.status == "SUCCESS",
            ),
        )
        .all()
    )
    return _canonical_latest_map(rows, by_finished=True)


def _active_runs_per_source(db: Session, now: datetime) -> dict[str, ScrapeRun]:
    rows = (
        db.query(ScrapeRun)
        .filter(
            ScrapeRun.status == "RUNNING",
            ScrapeRun.finished_at.is_(None),
        )
        .order_by(desc(ScrapeRun.started_at), desc(ScrapeRun.id))
        .all()
    )
    active: dict[str, ScrapeRun] = {}
    for run in rows:
        if not _is_running(run, now):
            continue
        source_key = _canonical_source(run.source)
        if not source_key or source_key in active:
            continue
        active[source_key] = run
    return active


def _derive_overall_status(jobs: list[dict]) -> str:
    """Overall health follows core sources only; secondary delays stay in the jobs list."""
    core_jobs = [job for job in jobs if str(job.get("name") or "").removeprefix("scrape_") in CORE_SOURCES]
    if not core_jobs:
        return "delayed"
    if any(job["status"] == "running" for job in core_jobs):
        return "running"
    if any(job["status"] == "delayed" for job in core_jobs):
        return "delayed"
    return "ok"


@router.get("/runs", response_model=dict)
def pipeline_runs(
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    is_admin: bool = Depends(has_valid_admin_key),
):
    recent_runs = (
        db.query(ScrapeRun)
        .order_by(desc(ScrapeRun.started_at))
        .limit(limit)
        .all()
    )

    runs = [
        {
            "id": int(run.id),
            "source": str(run.source or ""),
            "status": str(run.status or ""),
            "started_at": _to_utc(run.started_at).isoformat() if run.started_at else None,
            "finished_at": _to_utc(run.finished_at).isoformat() if run.finished_at else None,
            "listings_found": int(run.listings_found or 0),
            "listings_new": int(run.listings_new or 0),
            "error_message": _visible_error_message(run.error_message, is_admin=is_admin),
        }
        for run in recent_runs
    ]

    return {
        "count": len(runs),
        "runs": runs,
    }


@router.post("/trigger", response_model=dict)
def trigger_pipeline_job(payload: PipelineTriggerRequest, _admin: None = Depends(require_admin_key)):
    try:
        launched = _launch_background_job(payload.job)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to trigger job: {exc}")

    return {
        "accepted": True,
        **launched,
    }


@router.get("/status", response_model=dict)
def pipeline_status(db: Session = Depends(get_db), is_admin: bool = Depends(has_valid_admin_key)):
    now = datetime.now(timezone.utc)
    reconcile_orphan_running_runs(db, now=now)

    last_run_by_source = _latest_run_per_source(db)
    last_success_by_source = _latest_success_per_source(db)
    active_by_source = _active_runs_per_source(db, now)

    source_keys = list(SOURCE_ORDER)
    for key in {*last_run_by_source, *last_success_by_source, *active_by_source}:
        if key not in source_keys:
            source_keys.append(key)

    jobs = []
    for source in source_keys:
        last_run = last_run_by_source.get(source)
        last_success = last_success_by_source.get(source)
        active_run = active_by_source.get(source)

        success_at = _to_utc(last_success.finished_at) if last_success else None
        run_at = _to_utc(last_run.started_at) if last_run else None
        finished_at = _to_utc(last_run.finished_at) if last_run else None
        expected_hours = EXPECTED_HOURS.get(source, 12)
        last_status = str(last_run.status or "").upper() if last_run else None
        last_error = _visible_error_message(last_run.error_message if last_run else None, is_admin=is_admin) or ""

        if active_run is not None:
            status = "running"
        elif success_at and now - success_at <= timedelta(hours=expected_hours * 1.5):
            status = "ok"
        else:
            status = "delayed"

        jobs.append(
            {
                "name": f"scrape_{source}",
                "status": status,
                "last_status": last_status,
                "last_success": success_at.isoformat() if success_at else None,
                "last_run": run_at.isoformat() if run_at else None,
                "last_finished": finished_at.isoformat() if finished_at else None,
                "last_error": last_error or None,
                "expected_hours": expected_hours,
            }
        )

    return {
        "generated_at": now.isoformat(),
        "overall_status": _derive_overall_status(jobs),
        "jobs": jobs,
    }
