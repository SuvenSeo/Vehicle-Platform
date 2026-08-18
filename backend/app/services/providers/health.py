"""Admin-facing enrichment provider health. Never includes secret values."""

from __future__ import annotations

import os
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.services.providers.flags import is_enabled
from db.models import ProviderSyncRun

_PROVIDERS: tuple[dict[str, str], ...] = (
    {
        "id": "nhtsa_safety",
        "label": "NHTSA safety research",
        "credential_env": "",
    },
    {
        "id": "problemsbyvin",
        "label": "ProblemsByVin weekly datasets",
        "credential_env": "",
    },
    {
        "id": "open_charge_map",
        "label": "Open Charge Map (LK cache)",
        "credential_env": "OPENCHARGEMAP_API_KEY",
    },
    {
        "id": "geoapify",
        "label": "Geoapify location layer",
        "credential_env": "GEOAPIFY_API_KEY",
    },
    {
        "id": "revcardata",
        "label": "RevCarData spec pilot",
        "credential_env": "REVCARDATA_API_KEY",
    },
)


def _configured(env_name: str) -> bool:
    if not env_name:
        return True
    return bool(os.getenv(env_name, "").strip())


def _serialize_run(run: ProviderSyncRun | None) -> dict[str, Any] | None:
    if run is None:
        return None
    return {
        "id": run.id,
        "status": run.status,
        "rows": run.rows,
        "failures": run.failures,
        "checksum": run.checksum,
        "startedAt": run.started_at.isoformat() if run.started_at else None,
        "endedAt": run.ended_at.isoformat() if run.ended_at else None,
        "error": "set" if run.error_message else None,
    }


def provider_health(db: Session) -> list[dict[str, Any]]:
    latest: dict[str, ProviderSyncRun] = {}
    try:
        rows = (
            db.query(ProviderSyncRun)
            .order_by(desc(ProviderSyncRun.started_at), desc(ProviderSyncRun.id))
            .all()
        )
        for row in rows:
            if row.provider not in latest:
                latest[row.provider] = row
    except Exception:
        latest = {}

    snapshot: list[dict[str, Any]] = []
    for spec in _PROVIDERS:
        provider_id = spec["id"]
        snapshot.append(
            {
                "id": provider_id,
                "label": spec["label"],
                "enabled": is_enabled(provider_id),
                "configured": _configured(spec["credential_env"]),
                "lastRun": _serialize_run(latest.get(provider_id)),
            }
        )
    return snapshot
