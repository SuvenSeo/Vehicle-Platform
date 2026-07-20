import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import listings
from db.models import Base, CarListing


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _listing(source_id: str, *, make: str = "Toyota", model: str = "Vitz", price_lkr: int | None) -> CarListing:
    now = datetime(2026, 4, 21, 9, 0, tzinfo=timezone.utc)
    return CarListing(
        source="ikman",
        source_id=source_id,
        scraped_at=now,
        first_seen_at=now,
        last_seen_at=now,
        make=make,
        model=model,
        year=2018,
        price_lkr=price_lkr,
        district="Colombo",
        title=f"{make} {model} {source_id}",
        url=f"https://example.com/{source_id}",
        is_outlier=False,
    )


def test_similar_listings_uses_price_band_for_priced_listing():
    db = _session()
    db.add_all(
        [
            _listing("base", price_lkr=10_000_000),
            _listing("in-band", price_lkr=9_000_000),
            _listing("out-of-band", price_lkr=20_000_000),
        ]
    )
    db.commit()

    base = db.query(CarListing).filter(CarListing.source_id == "base").one()
    similar = listings.get_similar_listings(base.id, db=db)

    assert [row.source_id for row in similar] == ["in-band"]


def test_similar_listings_does_not_crash_for_unpriced_listing():
    db = _session()
    db.add_all(
        [
            _listing("base-unpriced", price_lkr=None),
            _listing("same-model", price_lkr=8_500_000),
            _listing("other-model", model="Aqua", price_lkr=8_500_000),
        ]
    )
    db.commit()

    base = db.query(CarListing).filter(CarListing.source_id == "base-unpriced").one()
    similar = listings.get_similar_listings(base.id, db=db)

    assert [row.source_id for row in similar] == ["same-model"]


def test_similar_listings_handles_zero_price_like_unpriced():
    db = _session()
    db.add_all(
        [
            _listing("base-zero", price_lkr=0),
            _listing("same-model-2", price_lkr=6_000_000),
        ]
    )
    db.commit()

    base = db.query(CarListing).filter(CarListing.source_id == "base-zero").one()
    similar = listings.get_similar_listings(base.id, db=db)

    assert [row.source_id for row in similar] == ["same-model-2"]
