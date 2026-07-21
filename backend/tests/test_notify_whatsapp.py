import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils.notify_whatsapp import (
    build_alert_match_message,
    normalize_whatsapp_to,
    whatsapp_notify_configured,
)


def test_normalize_local_sri_lanka_mobile():
    assert normalize_whatsapp_to("0771234567") == "whatsapp:+94771234567"
    assert normalize_whatsapp_to("+94771234567") == "whatsapp:+94771234567"


def test_whatsapp_disabled_without_credentials(monkeypatch):
    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
    monkeypatch.delenv("TWILIO_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("TWILIO_WHATSAPP_FROM", raising=False)
    assert whatsapp_notify_configured() is False


def test_build_alert_match_message_includes_count_and_link():
    body = build_alert_match_message(
        make="Toyota",
        model="Aqua",
        district="Colombo",
        max_price=4_500_000,
        match_count=3,
    )
    assert "3 new matches" in body
    assert "Toyota Aqua" in body
    assert "Colombo" in body
    assert "/alerts" in body
