import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.rate_limit import RateLimiter, _client_key


class DummyRequest:
    def __init__(self, headers: dict[str, str], host: str = "10.0.0.9"):
        self.headers = headers
        self.client = type("Client", (), {"host": host})()


def test_client_key_uses_rightmost_forwarded_hop():
    request = DummyRequest(
        headers={
            "x-forwarded-for": "6.6.6.6, 172.16.0.1, 203.0.113.7",
            "user-agent": "pytest-agent",
        }
    )

    assert _client_key(request) == "203.0.113.7|pytest-agent"


def test_client_key_ignores_client_forged_leftmost_entry():
    # A caller rotating the leftmost XFF value must not rotate limiter keys.
    forged_a = DummyRequest(headers={"x-forwarded-for": "1.1.1.1, 203.0.113.7", "user-agent": "ua"})
    forged_b = DummyRequest(headers={"x-forwarded-for": "2.2.2.2, 203.0.113.7", "user-agent": "ua"})

    assert _client_key(forged_a) == _client_key(forged_b)


def test_client_key_falls_back_to_socket_host_without_header():
    request = DummyRequest(headers={"user-agent": "ua"}, host="192.0.2.4")

    assert _client_key(request) == "192.0.2.4|ua"


def test_rate_limiter_blocks_spoofed_header_rotation():
    limiter = RateLimiter(max_requests=2, window_seconds=60)

    for spoofed in ("9.9.9.1", "9.9.9.2"):
        limiter(
            DummyRequest(headers={"x-forwarded-for": f"{spoofed}, 203.0.113.7", "user-agent": "ua"}),
            now=1000,
        )

    try:
        limiter(
            DummyRequest(headers={"x-forwarded-for": "9.9.9.3, 203.0.113.7", "user-agent": "ua"}),
            now=1001,
        )
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 429
    else:
        raise AssertionError("spoofed XFF rotation should not bypass the limiter")


def test_rate_limiter_supports_custom_key_function():
    limiter = RateLimiter(
        max_requests=2,
        window_seconds=60,
        key_func=lambda request: str(request.headers.get("x-api-key") or "missing"),
    )
    request = DummyRequest(headers={"x-api-key": "k1", "user-agent": "ua"})

    limiter(request, now=1000)
    limiter(request, now=1001)

    try:
        limiter(request, now=1002)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 429
    else:
        raise AssertionError("custom key function should drive limiter buckets")
