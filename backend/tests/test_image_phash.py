"""Tests for the pHash image-dedup utility."""

import io
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils.image_phash import (
    PHASH_MATCH_THRESHOLD,
    backfill_image_phash,
    compute_phash,
    hamming_distance,
    is_same_photo,
)
from db.models import Base, CarListing


_NOW = datetime(2026, 7, 16, 10, 0)


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _png_bytes(color: tuple[int, int, int]) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), color=color).save(buf, format="PNG")
    return buf.getvalue()


def test_compute_phash_returns_none_for_empty_url():
    assert compute_phash("") is None
    assert compute_phash("   ") is None


def test_compute_phash_returns_none_on_fetch_failure(monkeypatch):
    # Unreachable host: httpx should raise, and compute_phash must swallow it.
    assert compute_phash("http://127.0.0.1:1/nope.jpg", timeout=0.5) is None


def test_hamming_distance_identical_hashes_is_zero():
    h = "abcdef0123456789"
    assert hamming_distance(h, h) == 0


def test_hamming_distance_none_for_missing_hash():
    assert hamming_distance(None, "abcdef0123456789") is None
    assert hamming_distance("abcdef0123456789", None) is None


def test_hamming_distance_none_for_invalid_hash():
    assert hamming_distance("not-a-hash", "abcdef0123456789") is None


def test_is_same_photo_respects_threshold():
    assert is_same_photo("0000000000000000", "0000000000000000")
    # Two hex chars flipped from all-zero is >= threshold bits apart.
    assert not is_same_photo("0000000000000000", "ffffffffffffffff")


def test_is_same_photo_threshold_boundary():
    assert PHASH_MATCH_THRESHOLD == 10


def test_backfill_image_phash_skips_listings_without_thumbnail():
    db = _session()
    listing = CarListing(
        source="ikman", source_id="x", scraped_at=_NOW,
        first_seen_at=_NOW, last_seen_at=_NOW,
        make="Toyota", model="Premio", thumbnail_url=None,
    )
    db.add(listing); db.commit()
    updated = backfill_image_phash(db)
    assert updated == 0
    assert listing.image_phash is None


def test_backfill_image_phash_leaves_hash_null_on_fetch_failure():
    db = _session()
    listing = CarListing(
        source="ikman", source_id="x", scraped_at=_NOW,
        first_seen_at=_NOW, last_seen_at=_NOW,
        make="Toyota", model="Premio", thumbnail_url="http://127.0.0.1:1/nope.jpg",
    )
    db.add(listing); db.commit()
    updated = backfill_image_phash(db)
    assert updated == 0
    assert listing.image_phash is None
