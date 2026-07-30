"""Tests for notify_email.py — unit tests with mocked HTTP/SMTP and env."""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils.notify_email import email_notify_configured, send_alert_email


def test_email_not_configured_without_credentials(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.delenv("SMTP_HOST", raising=False)
    assert email_notify_configured() is False


def test_email_configured_with_resend_key(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.delenv("SMTP_HOST", raising=False)
    assert email_notify_configured() is True


def test_email_configured_with_smtp_host(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    assert email_notify_configured() is True


def test_send_alert_email_returns_false_when_not_configured(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.delenv("SMTP_HOST", raising=False)
    result = send_alert_email(to_email="user@example.com", subject="Test", text="body")
    assert result is False


def test_send_alert_email_returns_false_for_empty_address(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    result = send_alert_email(to_email="", subject="Test", text="body")
    assert result is False


def test_send_alert_email_resend_returns_true_on_2xx(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.delenv("SMTP_HOST", raising=False)

    mock_resp = MagicMock()
    mock_resp.status = 200

    with patch("app.utils.notify_email.urllib.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__ = lambda s: mock_resp
        mock_urlopen.return_value.__exit__ = MagicMock(return_value=False)
        result = send_alert_email(
            to_email="user@example.com",
            subject="Alert",
            text="3 new matches",
        )

    assert result is True


def test_send_alert_email_resend_returns_false_on_network_error(monkeypatch):
    import urllib.error
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.delenv("SMTP_HOST", raising=False)

    with patch(
        "app.utils.notify_email.urllib.request.urlopen",
        side_effect=urllib.error.URLError("timeout"),
    ):
        result = send_alert_email(
            to_email="user@example.com",
            subject="Alert",
            text="3 new matches",
        )

    assert result is False


def test_send_alert_email_smtp_returns_true_on_success(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USERNAME", "user")
    monkeypatch.setenv("SMTP_PASSWORD", "pass")

    mock_server = MagicMock()
    mock_context = MagicMock()

    with patch("app.utils.notify_email.smtplib.SMTP") as mock_smtp, \
         patch("app.utils.notify_email.ssl.create_default_context", return_value=mock_context):
        mock_smtp.return_value.__enter__ = lambda s: mock_server
        mock_smtp.return_value.__exit__ = MagicMock(return_value=False)
        result = send_alert_email(
            to_email="user@example.com",
            subject="Alert",
            text="3 new matches",
        )

    assert result is True


def test_send_alert_email_smtp_fails_open_on_error(monkeypatch):
    import smtplib
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")

    with patch("app.utils.notify_email.smtplib.SMTP", side_effect=smtplib.SMTPException("connect failed")):
        result = send_alert_email(
            to_email="user@example.com",
            subject="Alert",
            text="body",
        )

    assert result is False
