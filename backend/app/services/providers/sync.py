"""Persisted ingest / refresh runs for enrichment providers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from db.models import ProviderSyncRun


def start_sync_run(
    db: Session,
    *,
    provider: str,
    details: dict[str, Any] | None = None,
) -> ProviderSyncRun:
    run = ProviderSyncRun(
        provider=provider,
        status="running",
        rows=0,
        failures=0,
        started_at=datetime.now(timezone.utc),
        details=details,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def finish_sync_run(
    db: Session,
    run: ProviderSyncRun,
    *,
    status: str,
    rows: int | None = None,
    failures: int | None = None,
    checksum: str | None = None,
    error_message: str | None = None,
    details: dict[str, Any] | None = None,
) -> ProviderSyncRun:
    allowed = {"success", "failed", "partial"}
    run.status = status if status in allowed else "failed"
    if rows is not None:
        run.rows = rows
    if failures is not None:
        run.failures = failures
    if checksum is not None:
        run.checksum = checksum
    if error_message is not None:
        run.error_message = error_message[:2000]
    if details is not None:
        run.details = details
    run.ended_at = datetime.now(timezone.utc)
    db.add(run)
    db.commit()
    db.refresh(run)
    return run
