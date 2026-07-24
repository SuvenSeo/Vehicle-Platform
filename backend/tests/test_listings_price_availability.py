import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import listings
from db.models import Base, CarListing


def _anon_request():
    return SimpleNamespace(cookies={})


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _listing(source_id: str, *, price_lkr: int | None, deal_score: float = 5.0) -> CarListing:
    now = datetime(2026, 4, 21, 9, 0, tzinfo=timezone.utc)
    return CarListing(
        source="ikman",
        source_id=source_id,
        scraped_at=now,
        first_seen_at=now,
        last_seen_at=now,
        make="Toyota",
        model="Vitz",
        year=2018,
        price_lkr=price_lkr,
        deal_score=deal_score,
        district="Colombo",
        city="Colombo",
        title=f"Toyota Vitz {source_id}",
        url=f"https://example.com/{source_id}",
        is_outlier=False,
    )


def test_search_listings_excludes_invalid_or_tiny_prices_by_default():
    db = _session()
    db.add_all(
        [
            _listing("valid-priced", price_lkr=7_200_000, deal_score=10.4),
            _listing("tiny-priced", price_lkr=42_000, deal_score=16.6),
            _listing("zero-priced", price_lkr=0, deal_score=14.1),
            _listing("missing-priced", price_lkr=None, deal_score=8.9),
        ]
    )
    db.commit()

    payload = listings.search_listings(
        request=_anon_request(), sort="deal_score", page=1, size=12, db=db
    )

    assert payload.total == 1
    assert [item.source_id for item in payload.items] == ["valid-priced"]


def test_search_listings_can_explicitly_return_price_unavailable_inventory():
    db = _session()
    db.add_all(
        [
            _listing("valid-priced", price_lkr=7_200_000, deal_score=10.4),
            _listing("tiny-priced", price_lkr=42_000, deal_score=16.6),
            _listing("zero-priced", price_lkr=0, deal_score=14.1),
            _listing("missing-priced", price_lkr=None, deal_score=8.9),
        ]
    )
    db.commit()

    payload = listings.search_listings(
        request=_anon_request(),
        sort="newest",
        price_availability="unavailable",
        page=1,
        size=12,
        db=db,
    )

    assert payload.total == 2
    assert {item.source_id for item in payload.items} == {"zero-priced", "missing-priced"}
