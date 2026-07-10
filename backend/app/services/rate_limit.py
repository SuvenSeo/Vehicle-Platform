import time

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

    def __init__(self, *, max_requests: int, window_seconds: int, message: str = "Too many requests. Try again shortly."):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.message = message
        self._buckets: dict[str, list[float]] = {}

    def __call__(self, request: Request, *, now: float | None = None) -> None:
        current = time.time() if now is None else now
        cutoff = current - self.window_seconds
        key = _client_key(request)

        hits = [item for item in self._buckets.get(key, []) if item >= cutoff]
        if len(hits) >= self.max_requests:
            self._buckets[key] = hits
            raise HTTPException(status_code=429, detail=self.message)

        hits.append(current)
        self._buckets[key] = hits

        stale_keys = [bucket_key for bucket_key, bucket_hits in self._buckets.items() if not any(item >= cutoff for item in bucket_hits)]
        for bucket_key in stale_keys[:100]:
            self._buckets.pop(bucket_key, None)
