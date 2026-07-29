"""Optional Telegram notifier for market-alert messages.

Fails open: missing credentials or network errors never abort callers.
Configure via:

  TELEGRAM_BOT_TOKEN
"""

from __future__ import annotations

import os

import httpx
import structlog

log = structlog.get_logger()

TELEGRAM_SEND_MESSAGE_URL = "https://api.telegram.org/bot{token}/sendMessage"
TELEGRAM_MESSAGE_LIMIT = 4096
TELEGRAM_TIMEOUT_SECONDS = 8.0


def telegram_notify_configured() -> bool:
    return bool(os.getenv("TELEGRAM_BOT_TOKEN", "").strip())


def send_telegram_alert(*, chat_id: str, body: str) -> bool:
    """Send one Telegram message. Returns True on HTTP 2xx."""
    if not telegram_notify_configured():
        return False

    chat_id = (chat_id or "").strip()
    if not chat_id:
        return False

    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    url = TELEGRAM_SEND_MESSAGE_URL.format(token=token)
    try:
        response = httpx.post(
            url,
            json={
                "chat_id": chat_id,
                "text": (body or "")[:TELEGRAM_MESSAGE_LIMIT],
                "disable_web_page_preview": True,
            },
            timeout=TELEGRAM_TIMEOUT_SECONDS,
        )
        if 200 <= response.status_code < 300:
            log.info(
                "telegram_alert_sent",
                chat_id=chat_id,
                status=response.status_code,
            )
            return True
        log.warning(
            "telegram_alert_failed",
            chat_id=chat_id,
            status=response.status_code,
            body=response.text[:200],
        )
        return False
    except Exception as exc:
        log.warning("telegram_alert_error", chat_id=chat_id, error=str(exc))
        return False
