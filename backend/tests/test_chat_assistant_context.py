import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import chat
from db.models import Base, CarListing, MarketSignal, ScrapeRun


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


class DummyRequest:
    headers = {"user-agent": "pytest"}
    client = type("Client", (), {"host": "127.0.0.1"})()


def setup_function():
    chat._chat_rate_limiter._buckets.clear()


def _seed(db):
    now = datetime(2026, 5, 21, 10, 0, tzinfo=timezone.utc)
    listing = CarListing(
        source="ikman",
        source_id="ikman-1",
        scraped_at=now,
        first_seen_at=now,
        last_seen_at=now,
        make="Toyota",
        model="Vitz",
        year=2018,
        price_lkr=7_400_000,
        deal_score=12.5,
        district="Colombo",
        city="Colombo",
        title="Toyota Vitz 2018",
        url="https://example.com/ikman-1",
        is_outlier=False,
    )
    db.add_all(
        [
            listing,
            ScrapeRun(
                source="ikman",
                started_at=now,
                finished_at=now,
                status="SUCCESS",
                listings_found=1,
                listings_new=1,
            ),
            MarketSignal(
                source="customs",
                signal_type="tender_sales",
                metric="vehicle_tender_count",
                category="official",
                value_numeric=57,
                unit="count",
                source_url="https://www.customs.gov.lk/tender-sales/",
                observed_at=now,
            ),
        ]
    )
    db.commit()
    return listing


def test_chat_fallback_returns_context_metadata_and_market_signals(monkeypatch):
    db = _session()
    listing = _seed(db)
    monkeypatch.setattr(chat, "GROQ_API_KEY", "")

    payload = chat.ChatRequest(
        message="Show Toyota Vitz deals in Colombo",
        page_context={"route": f"/listing/{listing.id}", "page": "Listing detail", "summary": "Inspecting one listing"},
    )
    response = chat.chat_assistant(payload, DummyRequest(), db=db)

    assert response["provider"] == "rules"
    assert response["ai_powered"] is False
    assert response["listings"]
    assert response["market_signals"][0]["source"] == "customs"
    assert "context_cards" in response
    assert "car_listings" in response["sources_used"]


def test_chat_uses_configured_groq_with_server_context(monkeypatch):
    db = _session()
    _seed(db)
    captured = {}

    def fake_call(messages, *, api_key, model):
        captured["messages"] = messages
        captured["api_key"] = api_key
        captured["model"] = model
        return "AI answer from live context"

    monkeypatch.setattr(chat, "GROQ_API_KEY", "server-key")
    monkeypatch.setattr(chat, "GROQ_MODEL", "server-model")
    monkeypatch.setattr(chat, "_call_groq", fake_call)

    payload = chat.ChatRequest(message="What is the pipeline status?", api_key="client-key", model="client-model")
    response = chat.chat_assistant(payload, DummyRequest(), db=db)

    assert response["provider"] == "groq"
    assert response["ai_powered"] is True
    assert response["response"] == "AI answer from live context"
    assert captured["api_key"] == "server-key"
    assert captured["model"] == "server-model"
    assert "Platform context" in captured["messages"][1]["content"]


def test_chat_payload_caps_reject_oversized_history_and_page_context():
    with pytest.raises(ValueError):
        chat.ChatRequest(
            message="hello",
            history=[chat.ChatMessage(role="user", content="x" * 3001)],
        )

    with pytest.raises(ValueError):
        chat.ChatRequest(
            message="hello",
            page_context={"route": "/listing/1", "summary": "x" * 7000},
        )
