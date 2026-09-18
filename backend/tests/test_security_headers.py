import asyncio
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app import main


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(main, "_probe_db", lambda: None)
    return TestClient(main.app)


class _DownstreamApp:
    """Minimal ASGI app recording whether the middleware forwarded to it."""

    def __init__(self) -> None:
        self.called = False

    async def __call__(self, scope, receive, send) -> None:
        self.called = True
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})


def _run_body_limit_middleware(headers):
    """Drive BodySizeLimitMiddleware directly; return (status_code, forwarded)."""
    inner = _DownstreamApp()
    middleware = main.BodySizeLimitMiddleware(inner)
    sent: list[dict] = []

    async def send(message):
        sent.append(message)

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    scope = {"type": "http", "method": "POST", "path": "/", "headers": headers}
    asyncio.run(middleware(scope, receive, send))

    status = next(
        (m["status"] for m in sent if m["type"] == "http.response.start"), None
    )
    return status, inner.called


class TestSecurityHeaders:
    def test_csp_header_present(self, client):
        response = client.get("/health")
        assert "content-security-policy" in response.headers

    def test_csp_header_value(self, client):
        response = client.get("/health")
        csp = response.headers["content-security-policy"]
        assert "default-src 'none'" in csp
        assert "frame-ancestors 'none'" in csp
        assert "base-uri 'none'" in csp
        assert "form-action 'none'" in csp

    def test_permissions_policy_header_present(self, client):
        response = client.get("/health")
        assert "permissions-policy" in response.headers

    def test_permissions_policy_header_value(self, client):
        response = client.get("/health")
        pp = response.headers["permissions-policy"]
        assert "geolocation=()" in pp
        assert "camera=()" in pp
        assert "microphone=()" in pp
        assert "payment=()" in pp

    def test_hsts_header_present(self, client):
        response = client.get("/health")
        assert response.headers["strict-transport-security"] == "max-age=31536000; includeSubDomains"

    def test_x_request_id_generated_when_absent(self, client):
        response = client.get("/health")
        assert "x-request-id" in response.headers
        rid = response.headers["x-request-id"]
        assert len(rid) == 36  # uuid4 canonical form

    def test_x_request_id_echoes_incoming_header(self, client):
        custom_id = "test-request-abc-123"
        response = client.get("/health", headers={"X-Request-ID": custom_id})
        assert response.headers["x-request-id"] == custom_id

    def test_existing_headers_still_present(self, client):
        response = client.get("/health")
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
        assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
        assert response.headers["x-xss-protection"] == "0"


class TestBodySizeLimit:
    def test_request_within_limit_is_accepted(self, client):
        small_body = b"x" * 1024  # 1 KB
        response = client.post("/api/v1/listings/search", content=small_body)
        # 404 or 422 means we passed the size check (endpoint may not exist, that's fine)
        assert response.status_code != 413

    def test_request_exceeding_limit_is_rejected(self, client):
        big_body = b"x" * (1_048_576 + 1)  # 1 MB + 1 byte
        response = client.post(
            "/health",
            content=big_body,
            headers={"Content-Length": str(len(big_body))},
        )
        assert response.status_code == 413
        assert response.json()["detail"] == "Request body too large"

    def test_chunked_body_without_content_length_is_rejected(self, client):
        """A streamed chunked body omits Content-Length and must not bypass the cap.

        Previously the middleware only inspected the content-length header, so an
        oversized chunked upload passed the check entirely.
        """
        chunks = iter([b"x" * 512, b"y" * 512])
        response = client.post("/health", content=chunks)

        assert response.status_code == 411
        assert response.json()["detail"] == (
            "Content-Length required; chunked request bodies are not accepted"
        )

    def test_explicit_chunked_transfer_encoding_is_rejected_at_asgi_level(self):
        """A chunked request with no declared length must be refused outright.

        Driven at the ASGI level so the assertion targets the middleware's own
        contract rather than httpx's header negotiation.
        """
        status, inner_called = _run_body_limit_middleware([(b"transfer-encoding", b"chunked")])

        assert status == 411
        assert inner_called is False

    def test_declared_over_limit_is_rejected_even_with_chunked_header(self):
        """The declared-length check runs first and independently of transfer-encoding."""
        status, inner_called = _run_body_limit_middleware(
            [(b"transfer-encoding", b"chunked"), (b"content-length", b"2000000")]
        )

        assert status == 413
        assert inner_called is False

    def test_declared_within_limit_passes_through(self):
        """A bounded declared length reaches the app untouched."""
        status, inner_called = _run_body_limit_middleware([(b"content-length", b"512")])

        assert status == 200
        assert inner_called is True

    def test_malformed_content_length_does_not_crash(self, client):
        """A non-numeric Content-Length must not raise inside the middleware."""
        response = client.post(
            "/health",
            content=b"small",
            headers={"Content-Length": "not-a-number"},
        )

        assert response.status_code != 500

    def test_declared_length_at_limit_is_accepted(self, client):
        """Exactly at the cap is allowed (boundary is exclusive of >1 MB)."""
        at_limit = b"x" * 1_048_576
        response = client.post(
            "/health",
            content=at_limit,
            headers={"Content-Length": str(len(at_limit))},
        )

        assert response.status_code != 413
