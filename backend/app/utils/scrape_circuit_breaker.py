"""Scrape circuit breaker — soft protection against anomalous scrape outcomes.

After ``validate_post_scrape`` returns warnings, callers invoke
``trip_if_needed`` to optionally open a per-source circuit.  Opening a
circuit does **not** abort the current scrape run but prevents downstream
destructive operations (chiefly mass lifecycle deactivation) from executing
against that source for the duration of the process.

In-process flag
---------------
``CIRCUIT_OPEN_SOURCES`` is a module-level ``set[str]`` that other utils
(e.g. ``listing_lifecycle``) can consult before operating on a source.
``run_sync`` checks it before calling ``mark_inactive_listings`` and skips
sources whose circuit is open.  The set resets on each new process/worker
start, so a transient circuit never persists across runs.

Warning keywords
----------------
The breaker scans for these case-insensitive substrings in warning strings
returned by ``validate_post_scrape``:

* ``"mass deactivation"`` — triggered by a >50 % listing-count drop.
* ``"price anomaly"`` — triggered by a >50 % average-price shift.

Both trip the circuit; the caller can narrow this with the ``trip_on``
parameter if desired.

Usage in run_sync::

    from app.utils.scrape_circuit_breaker import trip_if_needed, CIRCUIT_OPEN_SOURCES

    warnings = validate_post_scrape(db, source, checkpoint)
    trip_if_needed(source, warnings)
    ...
    # later, before mark_inactive_listings:
    if source not in CIRCUIT_OPEN_SOURCES:
        mark_inactive_listings(db, ...)
"""

from __future__ import annotations

import structlog

log = structlog.get_logger()

# In-process set of source keys whose circuit is open.
# Consulted by run_sync and optionally by listing_lifecycle callers.
CIRCUIT_OPEN_SOURCES: set[str] = set()

_TRIP_KEYWORDS = ("mass deactivation", "price anomaly")


def trip_if_needed(
    source: str,
    warnings: list[str],
    *,
    trip_on: tuple[str, ...] = _TRIP_KEYWORDS,
) -> bool:
    """Inspect *warnings* and open the circuit for *source* when a critical keyword is found.

    Returns ``True`` if the circuit was tripped (now or previously), ``False`` otherwise.
    Never raises — circuit logic must not interrupt the caller's error handling.
    """
    try:
        source_key = source.strip().lower()
        if source_key in CIRCUIT_OPEN_SOURCES:
            return True

        triggered_by: list[str] = []
        for w in warnings:
            w_lower = w.lower()
            for keyword in trip_on:
                if keyword in w_lower:
                    triggered_by.append(keyword)
                    break

        if not triggered_by:
            return False

        CIRCUIT_OPEN_SOURCES.add(source_key)
        log.critical(
            "scrape_circuit_breaker_tripped",
            source=source,
            triggered_by=triggered_by,
            warning_count=len(warnings),
            circuit_open_sources=sorted(CIRCUIT_OPEN_SOURCES),
        )
        return True
    except Exception as exc:
        log.error("scrape_circuit_breaker_error", source=source, error=str(exc))
        return False


def reset_circuit(source: str) -> None:
    """Manually close the circuit for *source* (useful in tests or manual recovery)."""
    CIRCUIT_OPEN_SOURCES.discard(source.strip().lower())


def reset_all_circuits() -> None:
    """Close all open circuits (useful in tests)."""
    CIRCUIT_OPEN_SOURCES.clear()


def is_open(source: str) -> bool:
    """Return ``True`` if the circuit for *source* is currently open."""
    return source.strip().lower() in CIRCUIT_OPEN_SOURCES
