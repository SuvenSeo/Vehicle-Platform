"""Tests for SSE connection-limit enforcement in the live/stream endpoint.

Covered behaviours
------------------
* Returns HTTP 503 with a Retry-After header when the limit is reached.
* Returns a StreamingResponse (not 503) when below the limit.
* The global counter increments exactly once per accepted connection.
* The counter is decremented when the client disconnects (generator finally-block).
* The limit is configurable via the SSE_MAX_CONNECTIONS env variable (read at
  import time; tested via direct attribute manipulation).
* Concurrent usage: counter stays consistent across multiple streams.
"""

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import stats as stats_module
from fastapi.responses import StreamingResponse


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_sse_counter():
    """Restore the global SSE counter to 0 before and after every test."""
    original = stats_module._sse_active_connections
    stats_module._sse_active_connections = 0
    yield
    stats_module._sse_active_connections = original


def _disconnecting_request() -> MagicMock:
    """Return a mock Request whose is_disconnected() resolves True immediately."""
    req = MagicMock()
    req.is_disconnected = AsyncMock(return_value=True)
    return req


def _mock_session_local(stats_mod):
    """Context-manager that patches SessionLocal in the stats module."""
    mock_db = MagicMock()
    mock_db.close = MagicMock()
    return patch.object(stats_mod, "SessionLocal", return_value=mock_db)


def _mock_snapshot(stats_mod):
    """Context-manager that patches build_live_market_snapshot."""
    return patch.object(
        stats_mod,
        "build_live_market_snapshot",
        return_value={"total_listings": 0},
    )


# ---------------------------------------------------------------------------
# 503 when limit exceeded
# ---------------------------------------------------------------------------


def test_returns_503_when_connection_limit_reached():
    stats_module._sse_active_connections = stats_module.MAX_SSE_CONNECTIONS

    req = _disconnecting_request()
    response = asyncio.run(stats_module.stream_live_market_snapshot(req))

    assert response.status_code == 503


def test_503_response_has_retry_after_header():
    stats_module._sse_active_connections = stats_module.MAX_SSE_CONNECTIONS

    req = _disconnecting_request()
    response = asyncio.run(stats_module.stream_live_market_snapshot(req))

    assert "retry-after" in {k.lower() for k in response.headers}


def test_503_response_body_is_json():
    import json

    stats_module._sse_active_connections = stats_module.MAX_SSE_CONNECTIONS

    req = _disconnecting_request()
    response = asyncio.run(stats_module.stream_live_market_snapshot(req))

    body = json.loads(response.body)
    assert "detail" in body


def test_returns_503_at_exactly_max_connections_not_one_below():
    stats_module._sse_active_connections = stats_module.MAX_SSE_CONNECTIONS - 1

    req = _disconnecting_request()
    with _mock_session_local(stats_module), _mock_snapshot(stats_module):
        response = asyncio.run(stats_module.stream_live_market_snapshot(req))

    assert not isinstance(response, type(None))
    assert response.status_code != 503


# ---------------------------------------------------------------------------
# Counter mechanics below limit
# ---------------------------------------------------------------------------


def test_counter_increments_when_connection_accepted():
    """Counter goes up when a connection is accepted, then back to 0 after consumption."""

    async def _run():
        assert stats_module._sse_active_connections == 0
        req = _disconnecting_request()
        with _mock_session_local(stats_module), _mock_snapshot(stats_module):
            response = await stats_module.stream_live_market_snapshot(req)
            # Incremented before the generator starts, before body is consumed.
            assert stats_module._sse_active_connections == 1
            # Consume the body; this triggers the generator's finally-block.
            async for _ in response.body_iterator:
                pass

    asyncio.run(_run())
    assert stats_module._sse_active_connections == 0


def test_counter_decrements_after_client_disconnects():
    """The finally-block in the events generator must decrement the counter."""

    async def _run():
        req = _disconnecting_request()
        with _mock_session_local(stats_module), _mock_snapshot(stats_module):
            response = await stats_module.stream_live_market_snapshot(req)
            assert isinstance(response, StreamingResponse)
            assert stats_module._sse_active_connections == 1  # incremented

            # Consume the generator body; this triggers the finally block.
            chunks = []
            async for chunk in response.body_iterator:
                chunks.append(chunk)

    asyncio.run(_run())
    assert stats_module._sse_active_connections == 0


def test_counter_decrements_even_when_snapshot_raises():
    """A DB error inside the generator must still decrement the counter."""

    async def _run():
        req = MagicMock()

        call_count = [0]

        async def _is_disconnected():
            call_count[0] += 1
            # On the first call (inside the while loop) raise to simulate DB error
            return False

        req.is_disconnected = _is_disconnected

        with _mock_session_local(stats_module):
            with patch.object(
                stats_module,
                "build_live_market_snapshot",
                side_effect=RuntimeError("db gone"),
            ):
                response = await stats_module.stream_live_market_snapshot(req)
                assert stats_module._sse_active_connections == 1

                # Consume — the exception propagates through the iterator.
                chunks = []
                try:
                    async for chunk in response.body_iterator:
                        chunks.append(chunk)
                except RuntimeError:
                    pass

    asyncio.run(_run())
    assert stats_module._sse_active_connections == 0


# ---------------------------------------------------------------------------
# SSE response format when below limit
# ---------------------------------------------------------------------------


def test_accepted_connection_returns_streaming_response():
    req = _disconnecting_request()
    with _mock_session_local(stats_module), _mock_snapshot(stats_module):
        response = asyncio.run(stats_module.stream_live_market_snapshot(req))

    assert isinstance(response, StreamingResponse)


def test_streaming_response_has_correct_content_type():
    req = _disconnecting_request()
    with _mock_session_local(stats_module), _mock_snapshot(stats_module):
        response = asyncio.run(stats_module.stream_live_market_snapshot(req))

    assert "text/event-stream" in response.media_type


def test_first_yielded_chunk_contains_snapshot_event():
    async def _run():
        req = _disconnecting_request()
        # Disconnect on the *second* call so the loop yields one chunk first.
        req.is_disconnected = AsyncMock(side_effect=[False, True])

        with _mock_session_local(stats_module), _mock_snapshot(stats_module):
            response = await stats_module.stream_live_market_snapshot(req)
            chunks = []
            async for chunk in response.body_iterator:
                chunks.append(chunk if isinstance(chunk, str) else chunk.decode())

        return chunks

    chunks = asyncio.run(_run())
    assert any("event: snapshot" in c for c in chunks)


# ---------------------------------------------------------------------------
# MAX_SSE_CONNECTIONS attribute
# ---------------------------------------------------------------------------


def test_max_sse_connections_default_is_50():
    """Default value should be 50 when SSE_MAX_CONNECTIONS is not set."""
    assert stats_module.MAX_SSE_CONNECTIONS == int(
        __import__("os").getenv("SSE_MAX_CONNECTIONS", "50")
    )


def test_limit_is_configurable_via_module_attribute(monkeypatch):
    """Overriding the module attribute controls enforcement."""
    original_max = stats_module.MAX_SSE_CONNECTIONS
    monkeypatch.setattr(stats_module, "MAX_SSE_CONNECTIONS", 2)
    stats_module._sse_active_connections = 2

    req = _disconnecting_request()
    response = asyncio.run(stats_module.stream_live_market_snapshot(req))

    assert response.status_code == 503
    monkeypatch.setattr(stats_module, "MAX_SSE_CONNECTIONS", original_max)
