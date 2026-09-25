"""Process-local TTL cache in front of the hot stats endpoints.

Why: Neon transfer (egress) is dominated by *repeated identical transfers*.
The materialized ``market_stats_cache`` table already prevents recomputation,
but every API request that hits it still re-transfers the payload from
Postgres and re-parses/re-validates it in Python. This module caches the
parsed payload inside each FastAPI worker so repeat hits within the TTL cost
zero payload bytes; the DB-side entry stays the single freshness authority.

Correctness contract (pinned by tests): memory entries are keyed by the
*anchor* of the underlying ``market_stats_cache`` entry (its ``refreshed_at``
timestamp). Any DB-side invalidation — TTL expiry + recompute, row deletion
(the documented ops lever: DELETE FROM market_stats_cache), exporter refresh
— changes the anchor, so the stale memory payload is bypassed automatically.
While the DB entry is unchanged and fresh, repeat requests cost zero payload
bytes. Freshness is therefore never worse than the pre-existing materialized
cache behavior (15 min–24 h TTLs).

Anchors are read with a scalar SELECT (``refreshed_at`` only, not the payload
column), so an anchor probe is ~tens of bytes — three orders of magnitude
cheaper than re-transferring a payload.

Deliberately process-local (no Redis dependency): HF Spaces runs a single
uvicorn worker, so process-local is effectively global there. Multi-worker
deployments simply get one cache per worker, which is still a Nx reduction
in payload transfer. Scrapers/exporters run in separate processes and are
unaffected.

Tuning: ``STATS_MEMORY_CACHE_TTL_SECONDS`` (default 300) bounds how long a
payload may live in memory beyond its DB anchor being valid. If the DB entry
is deleted outright, the anchor read returns ``None`` — a ``None`` anchor
still differs from any stored anchor, so deletion invalidates too.
"""

from __future__ import annotations

import threading
import time
from typing import Any, Callable, Optional

_MISSING = object()

# Module-level singleton store: {(anchor): (expires_at_monotonic, value)}.
# Anchored entries are also written under the sentinel key
# _LIVE_ANCHOR_PREFIX + logical-key so get_cached can find them after the
# anchor changed (unused by reads; kept for debugging/diagnostics only).
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


def clear() -> None:
    """Empty the store entirely (tests, admin cache flush)."""
    with _LOCK:
        _STORE.clear()


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
