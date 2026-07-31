"""Tests for the web_research service and its integration in the chat endpoint."""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.web_research import research_vehicle_query, _is_vehicle_query, _truncate


# ---------------------------------------------------------------------------
# Unit tests for helper functions
# ---------------------------------------------------------------------------

class TestIsVehicleQuery:
    def test_car_keyword_detected(self):
        assert _is_vehicle_query("best car under 5 million") is True

    def test_make_detected(self):
        assert _is_vehicle_query("Toyota Vitz review") is True

    def test_non_vehicle_query(self):
        assert _is_vehicle_query("what is the weather today") is False

    def test_empty_string(self):
        assert _is_vehicle_query("") is False


class TestTruncate:
    def test_short_string_unchanged(self):
        text = "Hello world"
        assert _truncate(text, max_len=50) == text

    def test_long_string_truncated(self):
        text = "word " * 100
        result = _truncate(text, max_len=50)
        assert len(result) <= 52  # truncated + ellipsis char
        assert result.endswith("…")

    def test_truncation_does_not_split_words(self):
        text = "alpha beta gamma delta epsilon"
        result = _truncate(text, max_len=20)
        assert "…" in result
        # The result before ellipsis should be a word boundary
        assert not result[:-1].endswith(" ")


# ---------------------------------------------------------------------------
# Integration-style tests for research_vehicle_query
# ---------------------------------------------------------------------------

def _make_ddg_response(abstract="", abstract_url="", abstract_source="", related=None, results=None):
    """Build a minimal DuckDuckGo JSON response dict."""
    return {
        "Abstract": abstract,
        "AbstractURL": abstract_url,
        "AbstractSource": abstract_source,
        "RelatedTopics": related or [],
        "Results": results or [],
    }


def test_empty_query_returns_empty():
    assert research_vehicle_query("") == []
    assert research_vehicle_query("   ") == []


def test_very_short_query_returns_empty():
    assert research_vehicle_query("ab") == []


def test_returns_empty_on_http_error(monkeypatch):
    """Network error or non-200 response returns []."""
    import httpx

    mock_client = MagicMock()
    mock_client.__enter__ = lambda s: mock_client
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.side_effect = httpx.ConnectError("connection refused")

    with patch("app.services.web_research.httpx.Client", return_value=mock_client):
        result = research_vehicle_query("Toyota Vitz Sri Lanka price")

    assert result == []


def test_returns_empty_on_json_decode_error(monkeypatch):
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.side_effect = ValueError("bad json")

    mock_client = MagicMock()
    mock_client.__enter__ = lambda s: mock_client
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_response

    with patch("app.services.web_research.httpx.Client", return_value=mock_client):
        result = research_vehicle_query("Toyota Vitz review")

    assert result == []


def test_abstract_returned_as_first_result():
    payload = _make_ddg_response(
        abstract="The Toyota Vitz is a subcompact car sold in Japan.",
        abstract_url="https://en.wikipedia.org/wiki/Toyota_Vitz",
        abstract_source="Wikipedia",
    )
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = payload

    mock_client = MagicMock()
    mock_client.__enter__ = lambda s: mock_client
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_response

    with patch("app.services.web_research.httpx.Client", return_value=mock_client):
        results = research_vehicle_query("Toyota Vitz", limit=3)

    assert len(results) == 1
    assert results[0]["title"] == "Wikipedia"
    assert results[0]["url"] == "https://en.wikipedia.org/wiki/Toyota_Vitz"
    assert "Toyota Vitz" in results[0]["snippet"]
    assert results[0]["source"] == "duckduckgo_abstract"


def test_related_topics_included():
    payload = _make_ddg_response(
        related=[
            {"Text": "Vitz review 2023. Great fuel economy.", "FirstURL": "https://example.com/vitz-review"},
            {"Text": "Vitz vs Aqua comparison.", "FirstURL": "https://example.com/vitz-vs-aqua"},
        ]
    )
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = payload

    mock_client = MagicMock()
    mock_client.__enter__ = lambda s: mock_client
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_response

    with patch("app.services.web_research.httpx.Client", return_value=mock_client):
        results = research_vehicle_query("Toyota Vitz review", limit=3)

    assert len(results) == 2
    assert results[0]["source"] == "duckduckgo_related"
    assert results[0]["url"] == "https://example.com/vitz-review"


def test_limit_respected():
    payload = _make_ddg_response(
        abstract="Abstract text.", abstract_url="https://example.com/1", abstract_source="Src",
        related=[
            {"Text": "Topic 1.", "FirstURL": "https://example.com/2"},
            {"Text": "Topic 2.", "FirstURL": "https://example.com/3"},
            {"Text": "Topic 3.", "FirstURL": "https://example.com/4"},
        ]
    )
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = payload

    mock_client = MagicMock()
    mock_client.__enter__ = lambda s: mock_client
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_response

    with patch("app.services.web_research.httpx.Client", return_value=mock_client):
        results = research_vehicle_query("Toyota Vitz", limit=2)

    assert len(results) == 2


def test_vehicle_query_appends_sri_lanka_suffix():
    """The query sent to DDG should include 'Sri Lanka' for vehicle queries."""
    captured = {}
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = _make_ddg_response()

    mock_client = MagicMock()
    mock_client.__enter__ = lambda s: mock_client
    mock_client.__exit__ = MagicMock(return_value=False)

    def capture_get(url, **kwargs):
        captured["params"] = kwargs.get("params", {})
        return mock_response

    mock_client.get.side_effect = capture_get

    with patch("app.services.web_research.httpx.Client", return_value=mock_client):
        research_vehicle_query("Toyota Vitz price")

    q = captured.get("params", {}).get("q", "")
    assert "Sri Lanka" in q


def test_non_vehicle_query_no_sri_lanka_suffix():
    captured = {}
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = _make_ddg_response()

    mock_client = MagicMock()
    mock_client.__enter__ = lambda s: mock_client
    mock_client.__exit__ = MagicMock(return_value=False)

    def capture_get(url, **kwargs):
        captured["params"] = kwargs.get("params", {})
        return mock_response

    mock_client.get.side_effect = capture_get

    with patch("app.services.web_research.httpx.Client", return_value=mock_client):
        research_vehicle_query("what is the capital of France")

    q = captured.get("params", {}).get("q", "")
    assert "Sri Lanka" not in q


def test_malformed_related_topics_skipped():
    """Topics without Text or FirstURL are silently ignored."""
    payload = _make_ddg_response(
        related=[
            {"Text": "", "FirstURL": "https://example.com/empty"},
            None,
            "not a dict",
            {"Text": "Valid topic.", "FirstURL": "https://example.com/valid"},
        ]
    )
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = payload

    mock_client = MagicMock()
    mock_client.__enter__ = lambda s: mock_client
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_response

    with patch("app.services.web_research.httpx.Client", return_value=mock_client):
        results = research_vehicle_query("car review", limit=5)

    assert len(results) == 1
    assert results[0]["url"] == "https://example.com/valid"


# ---------------------------------------------------------------------------
# Chat endpoint integration tests for web_research injection
# ---------------------------------------------------------------------------

def _make_chat_session():
    from datetime import datetime, timezone
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from db.models import Base, CarListing, ScrapeRun

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    now = datetime(2026, 5, 21, 10, 0, tzinfo=timezone.utc)
    listing = CarListing(
        source="ikman", source_id="web-test-1", scraped_at=now, first_seen_at=now,
        last_seen_at=now, make="Toyota", model="Vitz", year=2018,
        price_lkr=7_400_000, district="Colombo", title="Toyota Vitz 2018",
        url="https://example.com/1", is_outlier=False,
    )
    db.add_all([listing, ScrapeRun(source="ikman", started_at=now, finished_at=now,
                                    status="SUCCESS", listings_found=1, listings_new=1)])
    db.commit()
    return db


class DummyRequest:
    headers = {"user-agent": "pytest"}
    client = type("Client", (), {"host": "127.0.0.1"})()


def setup_function():
    from app.api.v1.endpoints import chat
    from app.services.rate_limit import _InMemoryRateLimiter, _get_backend
    backend = _get_backend()
    if isinstance(backend, _InMemoryRateLimiter):
        backend._buckets.clear()


def test_chat_response_includes_web_sources_key(monkeypatch):
    """web_sources always present in response (may be empty list)."""
    from app.api.v1.endpoints import chat

    monkeypatch.setattr(chat, "GROQ_API_KEY", "")

    with patch("app.api.v1.endpoints.chat.research_vehicle_query", return_value=[]):
        payload = chat.ChatRequest(message="Show Toyota Vitz deals")
        response = chat.chat_assistant(payload, DummyRequest(), db=_make_chat_session())

    assert "web_sources" in response
    assert isinstance(response["web_sources"], list)


def test_chat_web_sources_populated_when_research_returns_data(monkeypatch):
    """web_sources in response matches what research_vehicle_query returned."""
    from app.api.v1.endpoints import chat

    monkeypatch.setattr(chat, "GROQ_API_KEY", "")
    fake_results = [
        {"title": "Toyota Vitz review", "url": "https://example.com/review",
         "snippet": "Great car for Sri Lanka roads.", "source": "duckduckgo_related"},
    ]

    with patch("app.api.v1.endpoints.chat.research_vehicle_query", return_value=fake_results):
        payload = chat.ChatRequest(message="Toyota Vitz review Sri Lanka")
        response = chat.chat_assistant(payload, DummyRequest(), db=_make_chat_session())

    assert response["web_sources"] == fake_results


def test_chat_context_includes_web_research_when_present(monkeypatch):
    """When research returns results, context dict passed to Groq includes web_research."""
    from app.api.v1.endpoints import chat

    monkeypatch.setattr(chat, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr(chat, "GROQ_MODEL", "test-model")

    fake_results = [
        {"title": "Honda Fit review", "url": "https://example.com/fit",
         "snippet": "Popular compact car.", "source": "duckduckgo_related"},
    ]
    captured = {}

    def fake_call(messages, *, api_key, model):
        captured["messages"] = messages
        return "Groq response"

    monkeypatch.setattr(chat, "_call_groq", fake_call)

    with patch("app.api.v1.endpoints.chat.research_vehicle_query", return_value=fake_results):
        payload = chat.ChatRequest(message="Honda Fit best price Sri Lanka")
        chat.chat_assistant(payload, DummyRequest(), db=_make_chat_session())

    assert "messages" in captured
    user_content = captured["messages"][1]["content"]
    assert "Honda Fit review" in user_content
    assert "https://example.com/fit" in user_content
    assert "Web research snippets" in user_content


def test_chat_empty_web_research_does_not_break(monkeypatch):
    """Empty research result does not affect response structure."""
    from app.api.v1.endpoints import chat

    monkeypatch.setattr(chat, "GROQ_API_KEY", "")

    with patch("app.api.v1.endpoints.chat.research_vehicle_query", return_value=[]):
        payload = chat.ChatRequest(message="Market snapshot overview")
        response = chat.chat_assistant(payload, DummyRequest(), db=_make_chat_session())

    assert response["web_sources"] == []
    assert response["provider"] == "rules"


def test_chat_short_message_skips_research(monkeypatch):
    """Messages shorter than 8 chars bypass research_vehicle_query entirely."""
    from app.api.v1.endpoints import chat

    monkeypatch.setattr(chat, "GROQ_API_KEY", "")
    call_count = {"n": 0}

    def counting_research(q, *, limit=3):
        call_count["n"] += 1
        return []

    with patch("app.api.v1.endpoints.chat.research_vehicle_query", side_effect=counting_research):
        payload = chat.ChatRequest(message="hi")
        chat.chat_assistant(payload, DummyRequest(), db=_make_chat_session())

    assert call_count["n"] == 0


def test_chat_research_failure_does_not_break_response(monkeypatch):
    """If research_vehicle_query raises an exception chat still responds."""
    from app.api.v1.endpoints import chat

    monkeypatch.setattr(chat, "GROQ_API_KEY", "")

    def exploding_research(q, *, limit=3):
        raise RuntimeError("unexpected crash")

    with patch("app.api.v1.endpoints.chat.research_vehicle_query", side_effect=exploding_research):
        payload = chat.ChatRequest(message="Toyota Vitz price Colombo")
        # Should not raise; research errors propagate up only if chat doesn't guard them
        # Actually, we rely on research_vehicle_query failing open internally.
        # This test confirms the chat endpoint itself doesn't crash.
        try:
            response = chat.chat_assistant(payload, DummyRequest(), db=_make_chat_session())
            # If it raises, the test fails which is intentional — chat should guard this
        except RuntimeError:
            pytest.fail("chat_assistant propagated research exception — should fail open")


def test_groq_prompt_includes_web_research_note_in_system(monkeypatch):
    """System prompt mentions web snippets when web_research is provided."""
    from app.api.v1.endpoints import chat

    fake_web = [{"title": "T", "url": "https://x.com", "snippet": "S", "source": "duckduckgo_related"}]
    messages = chat._build_groq_prompt(
        "Toyota Prius price",
        {"intent": "pricing"},
        [],
        web_research=fake_web,
    )
    system = messages[0]["content"]
    assert "web research snippets" in system.lower()
    assert "Motormila DB" in system


def test_groq_prompt_no_web_section_when_empty():
    from app.api.v1.endpoints import chat

    messages = chat._build_groq_prompt("Toyota Prius price", {"intent": "pricing"}, [])
    user_content = messages[1]["content"]
    assert "Web research snippets" not in user_content
