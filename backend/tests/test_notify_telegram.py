"""Tests for notify_telegram.py — unit tests with mocked HTTP and env."""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils.notify_telegram import send_telegram_alert, telegram_notify_configured


def test_telegram_not_configured_without_token(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    assert telegram_notify_configured() is False


def test_telegram_configured_with_token(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123456789:ABCdef")
    assert telegram_notify_configured() is True


def test_send_telegram_alert_returns_false_when_not_configured(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    result = send_telegram_alert(chat_id="123456", body="hello")
    assert result is False


def test_send_telegram_alert_returns_false_for_empty_chat_id(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123456789:ABCdef")
    result = send_telegram_alert(chat_id="", body="hello")
    assert result is False


def test_send_telegram_alert_returns_true_on_2xx(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123456789:ABCdef")

    mock_resp = MagicMock()
    mock_resp.status_code = 200

    with patch("app.utils.notify_telegram.httpx.post", return_value=mock_resp) as mock_post:
        result = send_telegram_alert(chat_id="123456", body="Test message")

    assert result is True
    mock_post.assert_called_once()
    call_kwargs = mock_post.call_args
    assert "123456789:ABCdef" in call_kwargs.args[0]
    assert call_kwargs.kwargs["json"]["chat_id"] == "123456"
    assert call_kwargs.kwargs["json"]["text"] == "Test message"


def test_send_telegram_alert_returns_false_on_4xx(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123456789:ABCdef")

    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.text = "Bad Request"

    with patch("app.utils.notify_telegram.httpx.post", return_value=mock_resp):
        result = send_telegram_alert(chat_id="123456", body="Test message")

    assert result is False


def test_send_telegram_alert_fails_open_on_network_error(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123456789:ABCdef")

    with patch("app.utils.notify_telegram.httpx.post", side_effect=Exception("network error")):
        result = send_telegram_alert(chat_id="123456", body="Test message")

    assert result is False


def test_send_telegram_alert_truncates_long_body(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123456789:ABCdef")

    mock_resp = MagicMock()
    mock_resp.status_code = 200

    long_body = "x" * 5000

    with patch("app.utils.notify_telegram.httpx.post", return_value=mock_resp) as mock_post:
        send_telegram_alert(chat_id="123456", body=long_body)

    sent_text = mock_post.call_args.kwargs["json"]["text"]
    assert len(sent_text) <= 4096
