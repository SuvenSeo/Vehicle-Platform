"""Optional Web Push (VAPID) notifier for price-drop topics.

Secrets-gated, fail-open: when VAPID keys are missing (or pywebpush is not
installed) every send returns False and callers fall back to in-app.

Configure via:
  VAPID_PUBLIC_KEY   (base64url, sent to the browser)
  VAPID_PRIVATE_KEY  (server only)
  VAPID_SUBJECT      (e.g. mailto:alerts@motormila.example)
"""

from __future__ import annotations

import os
from typing import Optional

import structlog

log = structlog.get_logger()

PUSH_TOPIC_PRICE_DROPS = "price-drops"
PUSH_TOPIC_BACK_IN_STOCK = "back-in-stock"
PUSH_TOPIC_ALERT_MATCH = "alert-match"


def push_notify_configured() -> bool:
    return bool(
        os.getenv("VAPID_PUBLIC_KEY", "").strip()
        and os.getenv("VAPID_PRIVATE_KEY", "").strip()
    )


def vapid_public_key() -> Optional[str]:
    key = os.getenv("VAPID_PUBLIC_KEY", "").strip()
    return key or None


def build_push_payload(*, title: str, body: str, url: str = "/alerts", topic: str = PUSH_TOPIC_ALERT_MATCH) -> dict:
    return {
        "title": title[:120],
        "body": body[:300],
        "url": url,
        "topic": topic,
    }


def send_push_alert(
    *,
    endpoint: str,
    p256dh: Optional[str] = None,
    auth: Optional[str] = None,
    title: str = "Motormila alert",
    body: str = "",
    url: str = "/alerts",
    topic: str = PUSH_TOPIC_ALERT_MATCH,
    timeout_seconds: float = 8.0,
) -> bool:
    """Send one Web Push message. Returns True on accept, False otherwise."""
    if not endpoint or not push_notify_configured():
        return False
    try:
        from pywebpush import WebPusher  # type: ignore
    except Exception:
        log.info("push_skipped_no_pywebpush", reason="pywebpush_not_installed")
        return False
    import json as _json

    private_key = os.getenv("VAPID_PRIVATE_KEY", "").strip()
    subject = os.getenv("VAPID_SUBJECT", "").strip() or "mailto:alerts@motormila.local"
    subscription = {"endpoint": endpoint, "keys": {"p256dh": p256dh or "", "auth": auth or ""}}
    payload = _json.dumps(build_push_payload(title=title, body=body, url=url, topic=topic))
    try:
        pusher = WebPusher(subscription)
        pusher.send(
            data=payload,
            vapid_private_key=private_key,
            vapid_claims={"sub": subject},
            timeout=timeout_seconds,
        )
        log.info("push_sent", topic=topic)
        return True
    except Exception as exc:
        log.warning("push_send_failed", error=str(exc), topic=topic)
        return False
