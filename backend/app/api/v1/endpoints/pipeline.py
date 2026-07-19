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
from sqlalchemy import desc

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
EXPECTED_HOURS = {
    "ikman": 8,
    "riyasewana": 8,
    "autolanka": 12,
    "autodirect": 12,
    "patpat": 12,
    "autostream": 12,
    "carshop": 12,
    "saleme": 12,
    "riyahub": 12,
    "dimo": 12,
}


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
    recent_runs = (
        db.query(ScrapeRun)
        .order_by(desc(ScrapeRun.started_at))
        .limit(2000)
        .all()
    )

    grouped: dict[str, list[ScrapeRun]] = {}
    for run in recent_runs:
        source_key = _canonical_source(run.source)
        if not source_key:
            continue
        grouped.setdefault(source_key, []).append(run)

    source_keys = list(SOURCE_ORDER)
    for key in grouped.keys():
        if key not in source_keys:
            source_keys.append(key)

    jobs = []
    for source in source_keys:
        runs = grouped.get(source, [])
        last_run = runs[0] if runs else None
        last_success = next(
            (
                run
                for run in runs
                if str(run.status or "").upper() == "SUCCESS" and run.finished_at is not None
            ),
            None,
        )
        active_run = next((run for run in runs if _is_running(run, now)), None)

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

    if any(job["status"] == "running" for job in jobs):
        overall = "running"
    elif any(job["status"] == "delayed" for job in jobs):
        overall = "delayed"
    else:
        overall = "ok"

    return {
        "generated_at": now.isoformat(),
        "overall_status": overall,
        "jobs": jobs,
    }
