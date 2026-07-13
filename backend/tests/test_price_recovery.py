"""Tests for the price recovery integration.

Covers:
  - find_missing_price_listings: filters by NULL price, recency, and duplicate flag
  - recover_missing_prices: dry-run returns report dict without DB writes
  - recover_missing_prices: mark_retry touches timestamps and writes manifest
  - recover_missing_prices: skips listings marked as duplicates
  - recover_missing_prices: respects the days look-back window
  - recover_missing_prices: empty db returns noop dict
  - run_sync hook: RUN_PRICE_RECOVERY=true calls recover_missing_prices
  - run_sync hook: RUN_PRICE_RECOVERY=false (default) skips recovery
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from db.models import Base, CarListing
from scripts.recover_missing_prices import (
    find_missing_price_listings,
    recover_missing_prices,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _utc(*, days_ago: int = 0) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days_ago)


def _listing(
    source_id: str,
    *,
    price_lkr: int | None = None,
    last_seen_days_ago: int = 0,
    is_duplicate: bool = False,
    source: str = "ikman",
) -> CarListing:
    now = _utc(days_ago=last_seen_days_ago)
    return CarListing(
        source=source,
        source_id=source_id,
        scraped_at=now,
        first_seen_at=now,
        last_seen_at=now,
        make="Toyota",
        model="Vitz",
        year=2019,
        price_lkr=price_lkr,
        title=f"Toyota Vitz {source_id}",
        url=f"https://example.com/{source_id}",
        is_outlier=False,
        is_duplicate=is_duplicate,
    )


# ---------------------------------------------------------------------------
# find_missing_price_listings
# ---------------------------------------------------------------------------


def test_find_missing_prices_returns_unpriced_recent_listings():
    db = _session()
    db.add(_listing("no-price", price_lkr=None, last_seen_days_ago=1))
    db.add(_listing("priced", price_lkr=5_000_000, last_seen_days_ago=1))
    db.commit()

    results = find_missing_price_listings(db, days=7)

    assert len(results) == 1
    assert results[0].source_id == "no-price"


def test_find_missing_prices_excludes_stale_listings():
    db = _session()
    db.add(_listing("old", price_lkr=None, last_seen_days_ago=10))
    db.add(_listing("recent", price_lkr=None, last_seen_days_ago=3))
    db.commit()

    results = find_missing_price_listings(db, days=7)

    source_ids = [r.source_id for r in results]
    assert "recent" in source_ids
    assert "old" not in source_ids


def test_find_missing_prices_excludes_duplicates():
    db = _session()
    db.add(_listing("dupe", price_lkr=None, last_seen_days_ago=1, is_duplicate=True))
    db.add(_listing("real", price_lkr=None, last_seen_days_ago=1, is_duplicate=False))
    db.commit()

    results = find_missing_price_listings(db, days=7)

    source_ids = [r.source_id for r in results]
    assert "real" in source_ids
    assert "dupe" not in source_ids


def test_find_missing_prices_empty_db_returns_empty_list():
    db = _session()
    results = find_missing_price_listings(db, days=7)
    assert results == []


# ---------------------------------------------------------------------------
# recover_missing_prices — dry-run (default)
# ---------------------------------------------------------------------------


def test_recover_dry_run_returns_correct_dict():
    db = _session()
    db.add(_listing("a", price_lkr=None))
    db.add(_listing("b", price_lkr=None))
    db.commit()

    result = recover_missing_prices(db, dry_run=True)

    assert result["action"] == "dry_run"
    assert result["count"] == 2
    assert isinstance(result["by_source"], dict)


def test_recover_dry_run_does_not_modify_timestamps():
    db = _session()
    original_time = _utc(days_ago=2)
    listing = _listing("a", price_lkr=None, last_seen_days_ago=2)
    db.add(listing)
    db.commit()

    original_last_seen = db.query(CarListing).filter_by(source_id="a").one().last_seen_at
    recover_missing_prices(db, dry_run=True)
    after_last_seen = db.query(CarListing).filter_by(source_id="a").one().last_seen_at

    assert original_last_seen == after_last_seen


def test_recover_empty_db_returns_noop():
    db = _session()
    result = recover_missing_prices(db, dry_run=True)
    assert result == {"count": 0, "by_source": {}, "action": "noop"}


# ---------------------------------------------------------------------------
# recover_missing_prices — mark_retry (write mode)
# ---------------------------------------------------------------------------


def test_recover_mark_retry_touches_timestamps(tmp_path):
    db = _session()
    db.add(_listing("a", price_lkr=None, last_seen_days_ago=3))
    db.commit()

    before = db.query(CarListing).filter_by(source_id="a").one().last_seen_at
    manifest_path = str(tmp_path / "retry.json")

    result = recover_missing_prices(
        db,
        dry_run=False,
        mark_retry=True,
        output_path=manifest_path,
    )

    after = db.query(CarListing).filter_by(source_id="a").one().last_seen_at
    assert result["action"] == "retry_manifest"
    assert result["touched"] == 1
    assert after > before


def test_recover_mark_retry_writes_manifest_json(tmp_path):
    import json

    db = _session()
    db.add(_listing("x", price_lkr=None, source="riyasewana"))
    db.commit()

    manifest_path = str(tmp_path / "manifest.json")
    recover_missing_prices(db, dry_run=False, mark_retry=True, output_path=manifest_path)

    with open(manifest_path) as f:
        manifest = json.load(f)

    assert manifest["total"] == 1
    assert manifest["listings"][0]["source_id"] == "x"
    assert "generated_at" in manifest


def test_recover_report_only_returns_count_without_writes():
    db = _session()
    db.add(_listing("y", price_lkr=None))
    db.commit()

    original_ts = db.query(CarListing).filter_by(source_id="y").one().last_seen_at
    result = recover_missing_prices(db, dry_run=False, mark_retry=False)

    assert result["action"] == "report_only"
    assert result["count"] == 1
    after_ts = db.query(CarListing).filter_by(source_id="y").one().last_seen_at
    assert after_ts == original_ts


def test_recover_by_source_groups_correctly():
    db = _session()
    db.add(_listing("i1", price_lkr=None, source="ikman"))
    db.add(_listing("i2", price_lkr=None, source="ikman"))
    db.add(_listing("r1", price_lkr=None, source="riyasewana"))
    db.commit()

    result = recover_missing_prices(db, dry_run=True)

    assert result["by_source"]["ikman"] == 2
    assert result["by_source"]["riyasewana"] == 1


def test_recover_skips_duplicate_listings():
    db = _session()
    db.add(_listing("dupe", price_lkr=None, is_duplicate=True))
    db.add(_listing("real", price_lkr=None, is_duplicate=False))
    db.commit()

    result = recover_missing_prices(db, dry_run=True)

    assert result["count"] == 1


# ---------------------------------------------------------------------------
# run_sync hook — RUN_PRICE_RECOVERY env var
# ---------------------------------------------------------------------------


def test_run_sync_calls_recovery_when_enabled(monkeypatch):
    """recover_missing_prices is invoked exactly once when RUN_PRICE_RECOVERY=true."""
    import run_sync

    monkeypatch.setenv("RUN_SCRAPERS", "false")
    monkeypatch.setenv("RUN_MARKET_ANALYSIS", "false")
    monkeypatch.setenv("RUN_DEDUP", "false")
    monkeypatch.setenv("RUN_STATS_CACHE_REFRESH", "false")
    monkeypatch.setenv("RUN_PRICE_RECOVERY", "true")

    mock_db = MagicMock()
    calls = []

    def fake_recover(db, *, days=7, dry_run=True, mark_retry=False, output_path=None):
        calls.append({"dry_run": dry_run, "mark_retry": mark_retry})
        return {"count": 5, "by_source": {"ikman": 5}, "action": "retry_manifest", "touched": 5}

    monkeypatch.setattr(run_sync, "init_db", lambda: None)
    monkeypatch.setattr(run_sync, "SessionLocal", lambda: mock_db)
    monkeypatch.setattr(run_sync, "recover_missing_prices", fake_recover)

    asyncio.run(run_sync.main())

    assert len(calls) == 1
    assert calls[0]["dry_run"] is False
    assert calls[0]["mark_retry"] is True


def test_run_sync_skips_recovery_when_disabled(monkeypatch):
    """recover_missing_prices is never called when RUN_PRICE_RECOVERY is false."""
    import run_sync

    monkeypatch.setenv("RUN_SCRAPERS", "false")
    monkeypatch.setenv("RUN_MARKET_ANALYSIS", "false")
    monkeypatch.setenv("RUN_DEDUP", "false")
    monkeypatch.setenv("RUN_STATS_CACHE_REFRESH", "false")
    monkeypatch.setenv("RUN_PRICE_RECOVERY", "false")

    mock_db = MagicMock()
    calls = []

    def fake_recover(db, **kwargs):
        calls.append(kwargs)
        return {"count": 0, "by_source": {}, "action": "noop"}

    monkeypatch.setattr(run_sync, "init_db", lambda: None)
    monkeypatch.setattr(run_sync, "SessionLocal", lambda: mock_db)
    monkeypatch.setattr(run_sync, "recover_missing_prices", fake_recover)

    asyncio.run(run_sync.main())

    assert calls == []


def test_run_sync_recovery_disabled_by_default(monkeypatch):
    """RUN_PRICE_RECOVERY defaults to false when the env var is absent."""
    import run_sync

    monkeypatch.setenv("RUN_SCRAPERS", "false")
    monkeypatch.setenv("RUN_MARKET_ANALYSIS", "false")
    monkeypatch.setenv("RUN_DEDUP", "false")
    monkeypatch.setenv("RUN_STATS_CACHE_REFRESH", "false")
    monkeypatch.delenv("RUN_PRICE_RECOVERY", raising=False)

    mock_db = MagicMock()
    calls = []

    def fake_recover(db, **kwargs):
        calls.append(kwargs)
        return {"count": 0, "by_source": {}, "action": "noop"}

    monkeypatch.setattr(run_sync, "init_db", lambda: None)
    monkeypatch.setattr(run_sync, "SessionLocal", lambda: mock_db)
    monkeypatch.setattr(run_sync, "recover_missing_prices", fake_recover)

    asyncio.run(run_sync.main())

    assert calls == []


def test_run_sync_recovery_tolerates_exception(monkeypatch):
    """A failure in price recovery is logged but does not abort the sync run."""
    import run_sync

    monkeypatch.setenv("RUN_SCRAPERS", "false")
    monkeypatch.setenv("RUN_MARKET_ANALYSIS", "false")
    monkeypatch.setenv("RUN_DEDUP", "false")
    monkeypatch.setenv("RUN_STATS_CACHE_REFRESH", "false")
    monkeypatch.setenv("RUN_PRICE_RECOVERY", "true")

    mock_db = MagicMock()

    def boom(db, **kwargs):
        raise RuntimeError("injected price recovery failure")

    monkeypatch.setattr(run_sync, "init_db", lambda: None)
    monkeypatch.setattr(run_sync, "SessionLocal", lambda: mock_db)
    monkeypatch.setattr(run_sync, "recover_missing_prices", boom)

    # Must not raise — failure is caught and logged inside run_sync
    asyncio.run(run_sync.main())
