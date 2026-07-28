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
