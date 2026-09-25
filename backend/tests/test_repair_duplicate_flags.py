"""Tests for scripts/ops/repair_duplicate_flags (duplicate-flag repair)."""

import sys
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))
sys.path.append(str(Path(__file__).resolve().parents[1] / "scripts" / "ops"))

from db.models import Base, CarListing
from repair_duplicate_flags import repair

_NOW = datetime(2026, 9, 17, 7, 0)


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _listing(source, source_id, **overrides):
    params = dict(
        source=source,
        source_id=source_id,
        scraped_at=_NOW,
        first_seen_at=_NOW - timedelta(days=3),
        last_seen_at=_NOW,
        make="Toyota",
        model="Prius",
        year=2020,
        price_lkr=10_000_000,
        title="Toyota Prius 2020",
        url=f"https://example.com/{source}/{source_id}",
        is_active=True,
        is_outlier=False,
        is_duplicate=False,
        duplicate_of=None,
    )
    params.update(overrides)
    return CarListing(**params)


def test_dry_run_changes_nothing():
    db = _session()
    db.add(_listing("ikman", "a", is_duplicate=True, duplicate_of=99))
    db.commit()

    result = repair(db, apply=False)

    assert result["flagged"] == 1
    assert result["live_before"] == 0  # flagged row excluded from live filter
    assert result["live_after"] is None
    assert db.query(CarListing).filter_by(source_id="a").one().is_duplicate is True


def test_apply_clears_flags_and_restores_live_count():
    db = _session()
    db.add(_listing("ikman", "a", is_duplicate=True, duplicate_of=99))
    db.add(_listing("riyasewana", "b"))  # already live
    db.add(_listing("ikman", "c", is_outlier=True))  # untouched by repair
    db.commit()

    result = repair(db, apply=True)

    assert result["flagged"] == 1
    assert result["live_before"] == 1
    assert result["live_after"] == 2
    row = db.query(CarListing).filter_by(source_id="a").one()
    assert row.is_duplicate is False
    assert row.duplicate_of is None
    # Outlier flag must survive the repair.
    assert db.query(CarListing).filter_by(source_id="c").one().is_outlier is True


def test_apply_with_no_flags_is_noop():
    db = _session()
    db.add(_listing("ikman", "a"))
    db.commit()

    result = repair(db, apply=True)

    assert result == {"flagged": 0, "live_before": 1, "live_after": None}
