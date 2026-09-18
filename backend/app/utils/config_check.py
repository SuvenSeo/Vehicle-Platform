"""Production configuration self-check — makes silent misconfiguration loud.

Motormila's auth stack fails closed when misconfigured (an empty
AUTH_TOKEN_SECRET makes every token verify as invalid, so logins 503 and
gated calls 401), but it fails *silently*: nothing in the logs or in
``/health`` said "this deploy cannot authenticate anyone". These helpers
log a CRITICAL line at startup and surface the issue in ``/health``
without flipping its status (HF router traffic and keep-hf-awake must keep
working while an operator fixes the env).

Dev/CI legitimately run with the gates off (APP_ACCESS_ENFORCED=false,
PRO_ACCESS_ENFORCED=false) — that is the documented local mode in AGENTS.md
and is NOT reported as a misconfiguration.
"""

from __future__ import annotations

import os

import structlog

logger = structlog.get_logger()


def _auth_flags() -> tuple[bool, bool]:
    from app.api.v1.endpoints.auth import app_access_enforced, pro_access_enforced

    return app_access_enforced(), pro_access_enforced()


def config_problems() -> list[str]:
    """Return human-readable descriptions of broken runtime configuration.

    Empty list = configuration is coherent. Non-empty = auth/entitlement
    gates are enabled but cannot function as intended.
    """
    problems: list[str] = []

    app_on, pro_on = _auth_flags()
    secret = os.getenv("AUTH_TOKEN_SECRET", "").strip()

    if (app_on or pro_on) and not secret:
        problems.append(
            "AUTH_TOKEN_SECRET is empty while "
            + ("APP_ACCESS_ENFORCED" if app_on else "")
            + (" and " if app_on and pro_on else "")
            + ("PRO_ACCESS_ENFORCED" if pro_on else "")
            + " are on — every session token is invalid (login 503, gated "
            "calls 401). Set AUTH_TOKEN_SECRET on the deployment or disable "
            "the gates for local development."
        )

    return problems


def log_config_warnings() -> None:
    """Log CRITICAL for every detected misconfiguration (startup hook)."""
    for problem in config_problems():
        logger.critical("config_misconfiguration", detail=problem)
