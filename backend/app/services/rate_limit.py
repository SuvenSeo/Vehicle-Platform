import time
from collections.abc import Callable

from fastapi import HTTPException, Request


def _client_key(request: Request) -> str:
    # Use the RIGHTMOST X-Forwarded-For hop: it is appended by the nearest
    # trusted proxy, while leftmost entries are client-supplied and would let a
    # caller rotate limiter keys with a forged header on every request.
    forwarded_for = str(request.headers.get("x-forwarded-for") or "")
    last_hop = forwarded_for.rsplit(",", 1)[-1].strip()
    client_host = getattr(getattr(request, "client", None), "host", None)
    ip = last_hop or str(client_host or "unknown")
    user_agent = str(request.headers.get("user-agent") or "unknown")[:120]
    return f"{ip}|{user_agent}"


class RateLimiter:
    """In-memory sliding-window rate limiter, keyed by client IP + user agent.

    Per-process only — does not share state across workers or survive restarts.
    Fine for basic abuse/cost protection on a single-instance deployment.
    """

    def __init__(
        self,
        *,
        max_requests: int,
        window_seconds: int,
        message: str = "Too many requests. Try again shortly.",
        key_func: Callable[[Request], str] | None = None,
    ):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.message = message
        self._key_func = key_func or _client_key
        self._buckets: dict[str, list[float]] = {}

    def __call__(self, request: Request, *, now: float | None = None) -> None:
        current = time.time() if now is None else now
        cutoff = current - self.window_seconds
        key = self._key_func(request)

        hits = [item for item in self._buckets.get(key, []) if item >= cutoff]
        if len(hits) >= self.max_requests:
            self._buckets[key] = hits
            retry_after = max(1, int(hits[0] + self.window_seconds - current))
            raise HTTPException(
                status_code=429,
                detail=self.message,
                headers={
                    "Retry-After": str(retry_after),
                    "RateLimit-Limit": str(self.max_requests),
                    "RateLimit-Remaining": "0",
                    "RateLimit-Reset": str(int(hits[0] + self.window_seconds)),
                },
            )

        hits.append(current)
        self._buckets[key] = hits

        # Store metadata in request.state so the response middleware can forward headers.
        # Uses getattr so test doubles without .state are handled gracefully.
        state = getattr(request, "state", None)
        if state is not None:
            remaining = self.max_requests - len(hits)
            reset_at = int(hits[0] + self.window_seconds)
            state.ratelimit_headers = {
                "RateLimit-Limit": str(self.max_requests),
                "RateLimit-Remaining": str(remaining),
                "RateLimit-Reset": str(reset_at),
            }

        stale_keys = [bucket_key for bucket_key, bucket_hits in self._buckets.items() if not any(item >= cutoff for item in bucket_hits)]
        for bucket_key in stale_keys[:100]:
            self._buckets.pop(bucket_key, None)
