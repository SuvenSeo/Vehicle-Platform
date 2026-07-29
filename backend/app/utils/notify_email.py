"""Optional email notifier for market-alert messages.

Configured when RESEND_API_KEY (preferred) or SENDGRID_API_KEY is set.
Fails open: missing credentials or delivery errors never abort callers.
"""

from __future__ import annotations

import os
from email.utils import parseaddr
from typing import Optional

import httpx
import structlog

log = structlog.get_logger()

RESEND_EMAIL_URL = "https://api.resend.com/emails"
SENDGRID_EMAIL_URL = "https://api.sendgrid.com/v3/mail/send"
EMAIL_TIMEOUT_SECONDS = 10.0


def email_notify_configured() -> bool:
    return bool(
        os.getenv("RESEND_API_KEY", "").strip()
        or os.getenv("SENDGRID_API_KEY", "").strip()
    )


def send_email_alert(
    *,
    to_email: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
) -> bool:
    """Send one alert email. Returns True when a provider accepts the message."""
    if not email_notify_configured():
        return False

    to_email = (to_email or "").strip()
    if not to_email:
        return False

    resend_key = os.getenv("RESEND_API_KEY", "").strip()
    if resend_key:
        return _send_resend_alert(
            api_key=resend_key,
            to_email=to_email,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
        )

    sendgrid_key = os.getenv("SENDGRID_API_KEY", "").strip()
    return _send_sendgrid_alert(
        api_key=sendgrid_key,
        to_email=to_email,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
    )


def _resend_from_addr() -> str:
    return os.getenv("RESEND_FROM", "").strip() or "Motormila <onboarding@resend.dev>"


def _sendgrid_from_addr() -> str:
    return (
        os.getenv("SENDGRID_FROM", "").strip()
        or os.getenv("ALERT_EMAIL_FROM", "").strip()
        or "alerts@motormila.local"
    )


def _send_resend_alert(
    *,
    api_key: str,
    to_email: str,
    subject: str,
    body_text: str,
    body_html: Optional[str],
) -> bool:
    payload = {
        "from": _resend_from_addr(),
        "to": [to_email],
        "subject": subject,
        "text": body_text,
    }
    if body_html:
        payload["html"] = body_html

    try:
        response = httpx.post(
            RESEND_EMAIL_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=EMAIL_TIMEOUT_SECONDS,
        )
        if 200 <= response.status_code < 300:
            log.info(
                "email_alert_sent",
                provider="resend",
                to=to_email,
                status=response.status_code,
            )
            return True
        log.warning(
            "email_alert_failed",
            provider="resend",
            to=to_email,
            status=response.status_code,
            body=response.text[:200],
        )
        return False
    except Exception as exc:
        log.warning(
            "email_alert_error",
            provider="resend",
            to=to_email,
            error=str(exc),
        )
        return False


def _send_sendgrid_alert(
    *,
    api_key: str,
    to_email: str,
    subject: str,
    body_text: str,
    body_html: Optional[str],
) -> bool:
    from_name, from_email = parseaddr(_sendgrid_from_addr())
    from_payload = {"email": from_email or _sendgrid_from_addr()}
    if from_name:
        from_payload["name"] = from_name

    content = [{"type": "text/plain", "value": body_text}]
    if body_html:
        content.append({"type": "text/html", "value": body_html})

    try:
        response = httpx.post(
            SENDGRID_EMAIL_URL,
            json={
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": from_payload,
                "subject": subject,
                "content": content,
            },
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=EMAIL_TIMEOUT_SECONDS,
        )
        if 200 <= response.status_code < 300:
            log.info(
                "email_alert_sent",
                provider="sendgrid",
                to=to_email,
                status=response.status_code,
            )
            return True
        log.warning(
            "email_alert_failed",
            provider="sendgrid",
            to=to_email,
            status=response.status_code,
            body=response.text[:200],
        )
        return False
    except Exception as exc:
        log.warning(
            "email_alert_error",
            provider="sendgrid",
            to=to_email,
            error=str(exc),
        )
        return False
