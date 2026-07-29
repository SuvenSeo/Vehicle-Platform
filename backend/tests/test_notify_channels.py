import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils.notify_email import email_notify_configured, send_email_alert
from app.utils.notify_telegram import send_telegram_alert, telegram_notify_configured


EMAIL_ENV_VARS = [
    "RESEND_API_KEY",
    "RESEND_FROM",
    "SENDGRID_API_KEY",
    "SENDGRID_FROM",
    "ALERT_EMAIL_FROM",
]


class MockResponse:
    def __init__(self, status_code: int = 200, text: str = "ok"):
        self.status_code = status_code
        self.text = text


def clear_email_env(monkeypatch):
    for name in EMAIL_ENV_VARS:
        monkeypatch.delenv(name, raising=False)


def test_telegram_disabled_without_token(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    assert telegram_notify_configured() is False


def test_telegram_send_returns_false_when_not_configured(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)

    def fail_post(*args, **kwargs):
        raise AssertionError("httpx.post should not be called")

    monkeypatch.setattr("app.utils.notify_telegram.httpx.post", fail_post)
    assert send_telegram_alert(chat_id="12345", body="New listing") is False


def test_telegram_send_success_with_mocked_httpx(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "telegram-token")
    calls = []

    def fake_post(url, json, timeout):
        calls.append({"url": url, "json": json, "timeout": timeout})
        return MockResponse(200)

    monkeypatch.setattr("app.utils.notify_telegram.httpx.post", fake_post)

    assert send_telegram_alert(chat_id="12345", body="New listing") is True
    assert calls == [
        {
            "url": "https://api.telegram.org/bottelegram-token/sendMessage",
            "json": {
                "chat_id": "12345",
                "text": "New listing",
                "disable_web_page_preview": True,
            },
            "timeout": 8.0,
        }
    ]


def test_email_disabled_without_provider_key(monkeypatch):
    clear_email_env(monkeypatch)
    assert email_notify_configured() is False


def test_email_send_returns_false_when_not_configured(monkeypatch):
    clear_email_env(monkeypatch)

    def fail_post(*args, **kwargs):
        raise AssertionError("httpx.post should not be called")

    monkeypatch.setattr("app.utils.notify_email.httpx.post", fail_post)
    assert (
        send_email_alert(
            to_email="buyer@example.com",
            subject="Alert",
            body_text="New listing",
        )
        is False
    )


def test_email_send_uses_resend_first_with_mocked_httpx(monkeypatch):
    clear_email_env(monkeypatch)
    monkeypatch.setenv("RESEND_API_KEY", "resend-key")
    monkeypatch.setenv("SENDGRID_API_KEY", "sendgrid-key")
    monkeypatch.setenv("RESEND_FROM", "Motormila <alerts@motormila.test>")
    calls = []

    def fake_post(url, json, headers, timeout):
        calls.append(
            {"url": url, "json": json, "headers": headers, "timeout": timeout}
        )
        return MockResponse(200)

    monkeypatch.setattr("app.utils.notify_email.httpx.post", fake_post)

    assert (
        send_email_alert(
            to_email="buyer@example.com",
            subject="Toyota Aqua alert",
            body_text="New listing",
            body_html="<p>New listing</p>",
        )
        is True
    )
    assert calls == [
        {
            "url": "https://api.resend.com/emails",
            "json": {
                "from": "Motormila <alerts@motormila.test>",
                "to": ["buyer@example.com"],
                "subject": "Toyota Aqua alert",
                "text": "New listing",
                "html": "<p>New listing</p>",
            },
            "headers": {
                "Authorization": "Bearer resend-key",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            "timeout": 10.0,
        }
    ]


def test_email_send_falls_back_to_sendgrid_with_mocked_httpx(monkeypatch):
    clear_email_env(monkeypatch)
    monkeypatch.setenv("SENDGRID_API_KEY", "sendgrid-key")
    monkeypatch.setenv("SENDGRID_FROM", "Motormila Alerts <alerts@motormila.test>")
    calls = []

    def fake_post(url, json, headers, timeout):
        calls.append(
            {"url": url, "json": json, "headers": headers, "timeout": timeout}
        )
        return MockResponse(202)

    monkeypatch.setattr("app.utils.notify_email.httpx.post", fake_post)

    assert (
        send_email_alert(
            to_email="buyer@example.com",
            subject="Toyota Aqua alert",
            body_text="New listing",
            body_html="<p>New listing</p>",
        )
        is True
    )
    assert calls == [
        {
            "url": "https://api.sendgrid.com/v3/mail/send",
            "json": {
                "personalizations": [{"to": [{"email": "buyer@example.com"}]}],
                "from": {
                    "email": "alerts@motormila.test",
                    "name": "Motormila Alerts",
                },
                "subject": "Toyota Aqua alert",
                "content": [
                    {"type": "text/plain", "value": "New listing"},
                    {"type": "text/html", "value": "<p>New listing</p>"},
                ],
            },
            "headers": {
                "Authorization": "Bearer sendgrid-key",
                "Content-Type": "application/json",
            },
            "timeout": 10.0,
        }
    ]
