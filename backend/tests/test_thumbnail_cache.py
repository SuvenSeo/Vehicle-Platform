"""Tests for the thumbnail CDN cache utility.

Covered behaviours
------------------
* get_cdn_proxy_url: deterministic output, consistent hash prefix, empty/None
  inputs, CDN_BASE_URL env-variable integration.
* backfill_thumbnail_cache: fills missing rows, skips already-cached rows,
  skips rows without a thumbnail_url, respects batch_limit, returns the
  correct updated count, is idempotent when run twice.
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils import thumbnail_cache as tc_module
from app.utils.thumbnail_cache import backfill_thumbnail_cache, get_cdn_proxy_url
from db.models import Base, CarListing


# ---------------------------------------------------------------------------
# Session helper
# ---------------------------------------------------------------------------


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _listing(source_id: str, *, thumbnail_url: str | None = None, thumbnail_url_cached: str | None = None) -> CarListing:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return CarListing(
        source="ikman",
        source_id=source_id,
        scraped_at=now,
        first_seen_at=now,
        last_seen_at=now,
        make="Toyota",
        model="Vitz",
        year=2020,
        price_lkr=5_000_000,
        is_outlier=False,
        url=f"https://example.com/{source_id}",
        title=f"Toyota Vitz {source_id}",
        thumbnail_url=thumbnail_url,
        thumbnail_url_cached=thumbnail_url_cached,
    )


# ---------------------------------------------------------------------------
# get_cdn_proxy_url
# ---------------------------------------------------------------------------


def test_get_cdn_proxy_url_returns_string_for_valid_url():
    result = get_cdn_proxy_url("https://example.com/image.jpg")
    assert isinstance(result, str)
    assert len(result) > 0


def test_get_cdn_proxy_url_is_deterministic():
    url = "https://example.com/car/thumb.jpg"
    assert get_cdn_proxy_url(url) == get_cdn_proxy_url(url)


def test_get_cdn_proxy_url_different_inputs_give_different_outputs():
    a = get_cdn_proxy_url("https://example.com/a.jpg")
    b = get_cdn_proxy_url("https://example.com/b.jpg")
    assert a != b


def test_get_cdn_proxy_url_contains_sha256_hex():
    import hashlib

    original = "https://example.com/thumb.jpg"
    expected_hash = hashlib.sha256(original.encode()).hexdigest()
    result = get_cdn_proxy_url(original)
    assert expected_hash in result


def test_get_cdn_proxy_url_contains_two_char_prefix():
    import hashlib

    original = "https://example.com/thumb.jpg"
    expected_hash = hashlib.sha256(original.encode()).hexdigest()
    prefix = expected_hash[:2]
    result = get_cdn_proxy_url(original)
    assert prefix in result


def test_get_cdn_proxy_url_returns_none_for_empty_string():
    assert get_cdn_proxy_url("") is None


def test_get_cdn_proxy_url_returns_none_for_blank_string():
    assert get_cdn_proxy_url("   ") is None


def test_get_cdn_proxy_url_strips_whitespace_before_hashing():
    a = get_cdn_proxy_url("https://example.com/img.jpg")
    b = get_cdn_proxy_url("  https://example.com/img.jpg  ")
    assert a == b


def test_get_cdn_proxy_url_default_path_starts_with_cdn_prefix(monkeypatch):
    monkeypatch.setattr(tc_module, "CDN_BASE_URL", "")
    result = get_cdn_proxy_url("https://example.com/x.jpg")
    assert result is not None
    assert result.startswith("/cdn/thumbnails/")


def test_get_cdn_proxy_url_uses_cdn_base_url(monkeypatch):
    monkeypatch.setattr(tc_module, "CDN_BASE_URL", "https://cdn.example.com")
    result = get_cdn_proxy_url("https://origin.example.com/thumb.jpg")
    assert result is not None
    assert result.startswith("https://cdn.example.com/cdn/thumbnails/")


def test_get_cdn_proxy_url_trailing_slash_stripped_from_base(monkeypatch):
    monkeypatch.setattr(tc_module, "CDN_BASE_URL", "https://cdn.example.com/")
    result = get_cdn_proxy_url("https://origin.example.com/thumb.jpg")
    assert result is not None
    assert "//cdn/thumbnails" not in result


# ---------------------------------------------------------------------------
# backfill_thumbnail_cache — core logic
# ---------------------------------------------------------------------------


def test_backfill_updates_listing_missing_cached_url():
    db = _session()
    db.add(_listing("car-1", thumbnail_url="https://img.example.com/1.jpg"))
    db.commit()

    updated = backfill_thumbnail_cache(db)

    assert updated == 1
    row = db.query(CarListing).filter_by(source_id="car-1").one()
    assert row.thumbnail_url_cached is not None
    assert len(row.thumbnail_url_cached) > 0


def test_backfill_cached_url_is_derived_from_thumbnail_url():
    import hashlib

    db = _session()
    original_url = "https://img.example.com/car42.jpg"
    db.add(_listing("car-42", thumbnail_url=original_url))
    db.commit()

    backfill_thumbnail_cache(db)

    row = db.query(CarListing).filter_by(source_id="car-42").one()
    expected_hash = hashlib.sha256(original_url.encode()).hexdigest()
    assert expected_hash in row.thumbnail_url_cached


def test_backfill_skips_listings_already_cached():
    db = _session()
    db.add(
        _listing(
            "car-2",
            thumbnail_url="https://img.example.com/2.jpg",
            thumbnail_url_cached="/cdn/thumbnails/aa/aabbcc",
        )
    )
    db.commit()

    updated = backfill_thumbnail_cache(db)

    assert updated == 0
    row = db.query(CarListing).filter_by(source_id="car-2").one()
    assert row.thumbnail_url_cached == "/cdn/thumbnails/aa/aabbcc"


def test_backfill_skips_listings_without_thumbnail_url():
    db = _session()
    db.add(_listing("car-3", thumbnail_url=None))
    db.commit()

    updated = backfill_thumbnail_cache(db)

    assert updated == 0
    row = db.query(CarListing).filter_by(source_id="car-3").one()
    assert row.thumbnail_url_cached is None


def test_backfill_returns_correct_count_for_multiple_listings():
    db = _session()
    for i in range(5):
        db.add(_listing(f"car-{i}", thumbnail_url=f"https://img.example.com/{i}.jpg"))
    db.commit()

    updated = backfill_thumbnail_cache(db)

    assert updated == 5


def test_backfill_only_updates_uncached_rows_in_mixed_set():
    db = _session()
    db.add(_listing("uncached", thumbnail_url="https://img.example.com/new.jpg"))
    db.add(
        _listing(
            "cached",
            thumbnail_url="https://img.example.com/old.jpg",
            thumbnail_url_cached="/cdn/thumbnails/existing",
        )
    )
    db.commit()

    updated = backfill_thumbnail_cache(db)

    assert updated == 1
    assert db.query(CarListing).filter_by(source_id="uncached").one().thumbnail_url_cached is not None
    assert (
        db.query(CarListing).filter_by(source_id="cached").one().thumbnail_url_cached
        == "/cdn/thumbnails/existing"
    )


# ---------------------------------------------------------------------------
# backfill_thumbnail_cache — batch limit
# ---------------------------------------------------------------------------


def test_backfill_respects_batch_limit():
    db = _session()
    for i in range(10):
        db.add(_listing(f"car-{i}", thumbnail_url=f"https://img.example.com/{i}.jpg"))
    db.commit()

    updated = backfill_thumbnail_cache(db, batch_limit=3)

    assert updated == 3
    # 7 remain uncached
    uncached = (
        db.query(CarListing)
        .filter(CarListing.thumbnail_url_cached.is_(None))
        .count()
    )
    assert uncached == 7


def test_backfill_batch_limit_of_zero_updates_nothing():
    db = _session()
    db.add(_listing("car-zero", thumbnail_url="https://img.example.com/z.jpg"))
    db.commit()

    updated = backfill_thumbnail_cache(db, batch_limit=0)

    assert updated == 0


# ---------------------------------------------------------------------------
# Idempotency
# ---------------------------------------------------------------------------


def test_backfill_is_idempotent_on_second_run():
    db = _session()
    db.add(_listing("car-idem", thumbnail_url="https://img.example.com/idem.jpg"))
    db.commit()

    first = backfill_thumbnail_cache(db)
    second = backfill_thumbnail_cache(db)

    assert first == 1
    assert second == 0  # nothing left to fill


def test_backfill_preserves_cached_url_on_second_run():
    db = _session()
    db.add(_listing("car-stable", thumbnail_url="https://img.example.com/stable.jpg"))
    db.commit()

    backfill_thumbnail_cache(db)
    first_cached = db.query(CarListing).filter_by(source_id="car-stable").one().thumbnail_url_cached

    backfill_thumbnail_cache(db)
    second_cached = db.query(CarListing).filter_by(source_id="car-stable").one().thumbnail_url_cached

    assert first_cached == second_cached


# ---------------------------------------------------------------------------
# Empty database
# ---------------------------------------------------------------------------


def test_backfill_on_empty_db_returns_zero():
    db = _session()
    updated = backfill_thumbnail_cache(db)
    assert updated == 0
