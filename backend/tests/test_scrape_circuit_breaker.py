"""Tests for app.utils.scrape_circuit_breaker."""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

import pytest

from app.utils.scrape_circuit_breaker import (
    CIRCUIT_OPEN_SOURCES,
    is_open,
    reset_all_circuits,
    reset_circuit,
    trip_if_needed,
)
from app.utils.listing_lifecycle import mark_inactive_listings
from db.models import Base, CarListing


@pytest.fixture(autouse=True)
def _clear_circuit():
    """Ensure each test starts with a clean circuit state."""
    reset_all_circuits()
    yield
    reset_all_circuits()


# ── trip_if_needed ────────────────────────────────────────────────────────────

def test_trip_on_mass_deactivation_warning():
    warnings = [
        "mass deactivation detected for source 'ikman': listings dropped from 1000 to 100 (90% reduction)"
    ]
    result = trip_if_needed("ikman", warnings)
    assert result is True
    assert is_open("ikman")


def test_trip_on_price_anomaly_warning():
    warnings = [
        "price anomaly detected for source 'riyasewana': average price increase from 1000000 to 3000000 LKR (200% shift)"
    ]
    result = trip_if_needed("riyasewana", warnings)
    assert result is True
    assert is_open("riyasewana")


def test_no_trip_on_clean_warnings():
    result = trip_if_needed("ikman", [])
    assert result is False
    assert not is_open("ikman")


def test_no_trip_on_unrelated_warning():
    result = trip_if_needed("ikman", ["some other warning about something else"])
    assert result is False
    assert not is_open("ikman")


def test_trip_is_idempotent():
    warnings = ["mass deactivation detected for source 'ikman'"]
    trip_if_needed("ikman", warnings)
    result = trip_if_needed("ikman", [])  # already open, no new warnings
    assert result is True
    assert is_open("ikman")


def test_trip_is_case_insensitive_source():
    warnings = ["mass deactivation detected for source 'IKMAN'"]
    trip_if_needed("IKMAN", warnings)
    assert is_open("ikman")
    assert is_open("IKMAN")


def test_reset_circuit_clears_single_source():
    trip_if_needed("ikman", ["mass deactivation detected"])
    trip_if_needed("riyasewana", ["price anomaly detected"])
    reset_circuit("ikman")
    assert not is_open("ikman")
    assert is_open("riyasewana")


def test_reset_all_circuits_clears_all():
    trip_if_needed("ikman", ["mass deactivation detected"])
    trip_if_needed("riyasewana", ["price anomaly detected"])
    reset_all_circuits()
    assert not is_open("ikman")
    assert not is_open("riyasewana")
    assert len(CIRCUIT_OPEN_SOURCES) == 0


def test_trip_does_not_raise_on_bad_input():
    result = trip_if_needed("", [None])  # type: ignore[list-item]
    # Should not raise; may or may not trip depending on NoneType handling
    assert isinstance(result, bool)


def test_multiple_sources_independent():
    trip_if_needed("ikman", ["mass deactivation detected"])
    assert is_open("ikman")
    assert not is_open("riyasewana")
    trip_if_needed("riyasewana", ["price anomaly detected"])
    assert is_open("riyasewana")


# ── listing_lifecycle integration ────────────────────────────────────────────

_NOW = datetime(2026, 7, 21, 10, 0)


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _listing(source: str, source_id: str, *, last_seen_days_ago: float) -> CarListing:
    seen = _NOW - timedelta(days=last_seen_days_ago)
    return CarListing(
        source=source,
        source_id=source_id,
        scraped_at=seen,
        first_seen_at=seen - timedelta(days=3),
        last_seen_at=seen,
        make="Toyota",
        model="Aqua",
        year=2020,
        price_lkr=5_000_000,
        title="Toyota Aqua 2020",
        url=f"https://example.com/{source}/{source_id}",
        is_active=True,
        is_outlier=False,
    )


def test_lifecycle_skips_circuit_open_source():
    db = _session()
    # Fresh listing to pass lifecycle's per-source freshness guard
    db.add(_listing("ikman", "a0", last_seen_days_ago=1))
    db.add(_listing("riyasewana", "b0", last_seen_days_ago=1))
    # Stale listings that *would* be deactivated if circuit is closed
    db.add(_listing("ikman", "a1", last_seen_days_ago=10))
    db.add(_listing("ikman", "a2", last_seen_days_ago=10))
    db.add(_listing("riyasewana", "b1", last_seen_days_ago=10))
    db.commit()

    # Open circuit for ikman only
    trip_if_needed("ikman", ["mass deactivation detected for source 'ikman'"])

    # max_deactivation_fraction=1.0 disables the fraction guard so we isolate
    # circuit-breaker behaviour in this test.
    result = mark_inactive_listings(db, stale_days=7, now=_NOW, max_deactivation_fraction=1.0)

    # ikman should be circuit-guarded — its listings stay active
    assert "ikman" in result["circuit_guarded_sources"]
    assert result["deactivated_by_source"].get("ikman", 0) == 0
    # riyasewana's stale listing should be deactivated (circuit not open)
    assert result["deactivated_by_source"].get("riyasewana", 0) == 1


def test_lifecycle_runs_normally_without_circuit():
    db = _session()
    # Fresh listing to pass lifecycle's per-source freshness guard
    db.add(_listing("ikman", "c0", last_seen_days_ago=1))
    # Stale listings to be deactivated
    db.add(_listing("ikman", "c1", last_seen_days_ago=10))
    db.add(_listing("ikman", "c2", last_seen_days_ago=10))
    db.commit()

    result = mark_inactive_listings(db, stale_days=7, now=_NOW, max_deactivation_fraction=1.0)

    assert result["circuit_guarded_sources"] == []
    assert result["deactivated_by_source"].get("ikman", 0) == 2


def test_circuit_guard_appears_in_return_dict():
    db = _session()
    # Fresh listing passes lifecycle's per-source freshness guard; the circuit
    # check runs before the freshness guard so this test verifies circuit is
    # applied even when the source would otherwise be processable.
    db.add(_listing("carshop", "d0", last_seen_days_ago=1))
    db.add(_listing("carshop", "d1", last_seen_days_ago=15))
    db.commit()

    trip_if_needed("carshop", ["price anomaly detected for source 'carshop'"])
    result = mark_inactive_listings(db, stale_days=7, now=_NOW, max_deactivation_fraction=1.0)

    assert "circuit_guarded_sources" in result
    assert "carshop" in result["circuit_guarded_sources"]
    # carshop's stale listing must not have been deactivated
    assert result["deactivated_by_source"].get("carshop", 0) == 0
