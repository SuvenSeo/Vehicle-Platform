"""Process-local TTL cache in front of the hot stats endpoints.

Why: Neon transfer (egress) is dominated by *repeated identical reads*. The
materialized ``market_stats_cache`` table already prevents full recomputation,
but every API request that misses it still runs the cache-table SELECT plus —
on expiry — the whole aggregate query chain against Postgres. This module
sits inside each FastAPI worker so repeat hits within the TTL cost zero DB
round-trips, and the DB-side materialized cache is only consulted after the
memory TTL expires.

Deliberately process-local (no Redis dependency): HF Spaces runs a single
uvicorn worker, so process-local is effectively global there. Multi-worker
deployments simply get one cache per worker, which is still a Nx reduction
in DB reads. Scrapers/exporters that must always see fresh data run in their
own process, so they are unaffected.

Tuning: ``STATS_MEMORY_CACHE_TTL_SECONDS`` (default 300) applies to all keys.
Listings land 2–3×/day, so five minutes of staleness on stats payloads is
well inside the freshness budget the materialized cache (15 min–24 h TTLs)
already accepts.
"""

from __future__ import annotations

import threading
import time
from typing import Any, Callable

_MISSING = object()

# Module-level singleton store: {(key): (expires_at_monotonic, value)}.
_STORE: dict[str, tuple[float, Any]] = {}
_LOCK = threading.Lock()


class _Missing:
    """Sentinel distinguishing "no entry" from a cached None/False/0 value."""

    __slots__ = ()

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return "<memory-cache-miss>"


MISSING = _Missing()


def get_cached(key: str, ttl_seconds: int | float) -> Any:
    """Return the cached value for *key*, or :data:`MISSING` on miss/expiry."""
    with _LOCK:
        entry = _STORE.get(key)
    if entry is None:
        return MISSING
    expires_at, value = entry
    if time.monotonic() >= expires_at:
        return MISSING
    return value


def set_cached(key: str, value: Any, ttl_seconds: int | float) -> None:
    """Store *value* under *key* for *ttl_seconds* (from now)."""
    with _LOCK:
        _STORE[key] = (time.monotonic() + float(ttl_seconds), value)


def get_or_set(
    key: str,
    ttl_seconds: int | float,
    producer: Callable[[], Any],
) -> tuple[Any, bool]:
    """Return ``(value, from_cache)`` for *key*, computing via *producer* on miss.

    No global lock is held while *producer* runs (it may hit the DB), so two
    concurrent requests at TTL expiry can both compute — a rare, cheap race
    that keeps the implementation lock-ordering-free. The second writer wins.
    """
    hit = get_cached(key, ttl_seconds)
    if hit is not MISSING:
        return hit, True
    value = producer()
    set_cached(key, value, ttl_seconds)
    return value, False
