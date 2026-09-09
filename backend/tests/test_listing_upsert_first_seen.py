"""Re-scrapes must not rewrite first_seen_at (homepage "newest" order)."""

import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils.listing_upsert import upsert_listing
from db.models import Base, CarListing

_ORIGINAL = datetime(2026, 1, 15, 8, 0, tzinfo=timezone.utc)
_RECRAWL = datetime(2026, 9, 9, 14, 45, tzinfo=timezone.utc)


def _session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _payload(**overrides):
    data = {
        "source": "ikman",
        "source_id": "ad-keep-seen",
        "scraped_at": _ORIGINAL,
        "first_seen_at": _ORIGINAL,
        "make": "Toyota",
        "model": "Aqua",
        "year": 2018,
        "price_lkr": 5_500_000,
        "title": "Toyota Aqua 2018",
        "url": "https://example.com/ikman/ad-keep-seen",
    }
    data.update(overrides)
    return data


def _naive(dt: datetime | None):
    if dt is None:
        return None
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


def test_rescrape_preserves_first_seen_at_even_when_payload_includes_it():
    db = _session()
    upsert_listing(db, "ikman", _payload())
    db.commit()

    upsert_listing(
        db,
        "ikman",
        _payload(
            scraped_at=_RECRAWL,
            first_seen_at=_RECRAWL,
            title="Toyota Aqua 2018 — updated copy",
            price_lkr=5_200_000,
        ),
    )
    db.commit()

    listing = db.query(CarListing).one()
    assert _naive(listing.first_seen_at) == _naive(_ORIGINAL)
    assert listing.title == "Toyota Aqua 2018 — updated copy"
    assert float(listing.price_lkr) == 5_200_000
