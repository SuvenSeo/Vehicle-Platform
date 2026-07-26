"""Resolve caller plan/role from Bearer or session cookie.

Shared by listings, market, stats, chat, and calculators so free soft-limits
stay consistent across API surfaces.
"""

from __future__ import annotations

from typing import Optional, Tuple

from fastapi import Request
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import resolve_live_session, verify_token


def resolve_request_access(
    request: Optional[Request] = None,
    authorization: Optional[str] = None,
    db: Optional[Session] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """Return ``(plan, role)`` from a live session when possible; else JWT only."""
    auth_value = authorization if isinstance(authorization, str) else None
    bearer = (auth_value or "").removeprefix("Bearer ").strip()
    token = bearer
    if not token and request is not None:
        cookies = getattr(request, "cookies", None) or {}
        token = str(cookies.get("mm_session") or "").strip()
    if not token:
        return None, None
    payload = verify_token(token)
    if not payload:
        return None, None
    if db is not None:
        try:
            live = resolve_live_session(payload, db)
            return (
                str(live.get("plan") or "free").lower(),
                str(live.get("role") or "user").lower(),
            )
        except Exception:
            return None, None
    return (
        str(payload.get("plan") or "free").strip().lower(),
        str(payload.get("role") or "user").strip().lower(),
    )
