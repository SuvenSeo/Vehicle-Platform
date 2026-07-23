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


def _listing(source_id: str, make: str, model: str, title: str) -> CarListing:
    now = datetime(2026, 4, 20, 10, 0, tzinfo=timezone.utc)
    return CarListing(
        source="ikman",
        source_id=source_id,
        scraped_at=now,
        first_seen_at=now,
        last_seen_at=now,
        make=make,
        model=model,
        year=2019,
        price_lkr=9_800_000,
        district="Colombo",
        city="Colombo",
        title=title,
        url=f"https://example.com/{source_id}",
        is_outlier=False,
    )


def test_search_suggestions_prioritize_make_model_matches():
    db = _session()
    db.add_all(
        [
            _listing("honda-vezel-1", "Honda", "Vezel", "Honda Vezel RU3"),
            _listing("toyota-vitz-1", "Toyota", "Vitz", "Toyota Vitz 2018"),
            _listing("honda-civic-1", "Honda", "Civic", "Honda Civic Turbo"),
        ]
    )
    db.commit()

    suggestions = listings.search_listing_suggestions(q="vez", limit=5, db=db)

    assert len(suggestions) == 1
    assert suggestions[0]["make"] == "Honda"
    assert suggestions[0]["model"] == "Vezel"


def test_search_suggestions_include_title_matches_and_limit_results():
    db = _session()
    db.add_all(
        [
            _listing("honda-vezel-1", "Honda", "Vezel", "Honda Vezel RU3"),
            _listing("honda-vezel-2", "Honda", "Vezel", "Honda Vezel RS"),
            _listing("honda-vezel-3", "Honda", "Vezel", "Honda Vezel Hybrid"),
            _listing("honda-vezel-4", "Honda", "Vezel", "Honda Vezel Touring"),
        ]
    )
    db.commit()

    suggestions = listings.search_listing_suggestions(q="honda", limit=2, db=db)

    assert len(suggestions) == 2
    assert all(item["make"] == "Honda" for item in suggestions)


def test_search_listings_filters_by_keyword_tokens():
    db = _session()
    db.add_all(
        [
            _listing("toyota-axio-1", "Toyota", "Axio", "Toyota Axio G Grade 2018"),
            _listing("toyota-vitz-1", "Toyota", "Vitz", "Toyota Vitz 2018"),
            _listing("honda-vezel-1", "Honda", "Vezel", "Honda Vezel 2018"),
        ]
    )
    db.commit()

    payload = listings.search_listings(
        request=_anon_request(), keyword="Toyota Axio", sort="newest", page=1, size=10, db=db
    )

    assert payload.total == 1
    assert payload.items[0].make == "Toyota"
    assert payload.items[0].model == "Axio"
