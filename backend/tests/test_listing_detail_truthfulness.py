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


def _listing(
    source_id: str,
    *,
    title: str,
    make: str = "Toyota",
    model: str = "Hilux",
    year: int = 2016,
    price_lkr: int = 9_500_000,
    mileage: int | None = None,
    condition: str | None = None,
    transmission: str | None = None,
    fuel_type: str | None = None,
    body_type: str | None = None,
) -> CarListing:
    now = datetime(2026, 4, 21, 10, 0, tzinfo=timezone.utc)
    return CarListing(
        source="ikman",
        source_id=source_id,
        scraped_at=now,
        first_seen_at=now,
        last_seen_at=now,
        make=make,
        model=model,
        year=year,
        price_lkr=price_lkr,
        mileage=mileage,
        condition=condition,
        transmission=transmission,
        fuel_type=fuel_type,
        body_type=body_type,
        district="Colombo",
        city="Colombo",
        title=title,
        url=f"https://example.com/{source_id}",
        is_outlier=False,
    )


def test_search_listings_keeps_missing_specs_unknown_when_source_fields_absent():
    db = _session()
    listing = _listing(
        "unknown-specs",
        title="Toyota Hilux diesel manual pickup used 189,000 km",
        mileage=None,
        condition=None,
        transmission=None,
        fuel_type=None,
        body_type=None,
    )
    db.add(listing)
    db.commit()

    payload = listings.search_listings(request=_anon_request(), sort="newest", page=1, size=12, db=db)

    assert payload.total == 1
    row = payload.items[0]
    assert row.mileage is None
    assert row.condition is None
    assert row.transmission is None
    assert row.fuel_type is None
    assert row.body_type is None


def test_get_listing_does_not_fill_specs_from_peer_defaults():
    db = _session()
    target = _listing(
        "target",
        title="Toyota Hilux clean listing",
        year=2005,
        mileage=None,
        condition=None,
        transmission=None,
        fuel_type=None,
        body_type=None,
    )
    peer = _listing(
        "peer",
        title="Toyota Hilux used automatic diesel pickup 210,000 km",
        year=2006,
        mileage=210_000,
        condition="used",
        transmission="automatic",
        fuel_type="diesel",
        body_type="pickup",
    )

    db.add_all([target, peer])
    db.commit()

    payload = listings.get_listing(target.id, db=db)

    assert payload.id == target.id
    assert payload.mileage is None
    assert payload.condition is None
    assert payload.transmission is None
    assert payload.fuel_type is None
    assert payload.body_type is None


def test_get_similar_listings_keeps_missing_specs_unknown():
    db = _session()
    seed = _listing("seed", title="Toyota Hilux source listing", price_lkr=10_000_000)
    similar_missing = _listing(
        "similar-missing",
        title="Toyota Hilux diesel manual pickup used 175,000 km",
        price_lkr=9_800_000,
        mileage=None,
        condition=None,
        transmission=None,
        fuel_type=None,
        body_type=None,
    )

    db.add_all([seed, similar_missing])
    db.commit()

    rows = listings.get_similar_listings(seed.id, db=db)
    assert rows

    unknown_row = next(row for row in rows if row.id == similar_missing.id)
    assert unknown_row.mileage is None
    assert unknown_row.condition is None
    assert unknown_row.transmission is None
    assert unknown_row.fuel_type is None
    assert unknown_row.body_type is None


def test_external_fetch_guard_rejects_private_and_non_http_urls():
    assert listings._is_safe_external_fetch_url("http://127.0.0.1:8000/internal") is False
    assert listings._is_safe_external_fetch_url("http://10.0.0.4/metadata") is False
    assert listings._is_safe_external_fetch_url("file:///etc/passwd") is False
    assert listings._is_safe_external_fetch_url("https://8.8.8.8/image.jpg") is True
