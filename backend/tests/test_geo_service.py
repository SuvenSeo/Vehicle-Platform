"""Geoapify listing geocode layer. Permanent cache; never overwrites raw_location."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.append(str(Path(__file__).resolve().parents[1]))

from db.models import Base, CarListing, ListingGeoEnrichment
from db.schema_patches import apply_schema_patches
from db.session import get_db

GEOAPIFY_HIT = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [79.855, 6.917]},
            "properties": {
                "formatted": "R. A. De Mel Mawatha, Colombo, Sri Lanka",
                "lat": 6.917,
                "lon": 79.855,
                "result_type": "street",
                "rank": {"confidence": 0.92, "confidence_street_level": 0.9},
                "country_code": "lk",
                "city": "Colombo",
                "suburb": "Kollupitiya",
            },
        }
    ],
}

COUNTRY_ONLY = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [80.7718, 7.8731]},
            "properties": {
                "formatted": "Sri Lanka",
                "lat": 7.8731,
                "lon": 80.7718,
                "result_type": "country",
                "rank": {"confidence": 0.3},
                "country_code": "lk",
            },
        }
    ],
}


def _session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _listing(db, *, raw_location="Kollupitiya, Colombo", district="Colombo", city="Colombo"):
    now = datetime(2026, 8, 1, tzinfo=timezone.utc)
    row = CarListing(
        source="ikman",
        source_id=f"geo-{raw_location}",
        scraped_at=now,
        first_seen_at=now,
        last_seen_at=now,
        make="Nissan",
        model="Leaf",
        year=2018,
        title="Nissan Leaf",
        url="https://example.com/leaf",
        is_outlier=False,
        is_active=True,
        district=district,
        city=city,
        raw_location=raw_location,
        price_lkr=6_500_000,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _client(payload, *, status_code=200, error=None):
    mock = MagicMock()
    if error:
        mock.get.side_effect = error
        mock.close = MagicMock()
        return mock
    response = MagicMock()
    response.status_code = status_code
    if status_code >= 400:
        response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "error",
            request=MagicMock(),
            response=response,
        )
    else:
        response.raise_for_status = MagicMock()
    response.json.return_value = payload
    mock.get.return_value = response
    mock.close = MagicMock()
    return mock


@pytest.fixture(autouse=True)
def _enable_geoapify(monkeypatch):
    monkeypatch.setenv("ENRICHMENT_GEOAPIFY", "true")
    monkeypatch.setenv("GEOAPIFY_API_KEY", "test-key")
    from app.services import geo_service

    geo_service.reset_circuit()
    yield
    geo_service.reset_circuit()


def test_schema_patch_creates_listing_geo_enrichment():
    engine = create_engine("sqlite:///:memory:")
    apply_schema_patches(engine)
    assert "listing_geo_enrichment" in inspect(engine).get_table_names()


def test_source_location_key_changes_when_raw_location_changes():
    from app.services.geo_service import source_location_key

    a = source_location_key("Kollupitiya, Colombo", "Colombo", "Colombo")
    b = source_location_key("Kandy city", "Kandy", "Kandy")
    assert a
    assert a != b
    assert a == source_location_key("Kollupitiya, Colombo", "Colombo", "Colombo")


def test_enrich_persists_pin_without_mutating_raw_location():
    from app.services.geo_service import enrich_listing

    db = _session()
    listing = _listing(db)
    original = listing.raw_location
    payload = enrich_listing(db, listing, client=_client(GEOAPIFY_HIT), api_key="test-key")
    db.refresh(listing)
    assert listing.raw_location == original
    assert payload["available"] is True
    assert payload["provider"] == "geoapify"
    assert payload["data"]["lat"] == pytest.approx(6.917, rel=1e-6)
    assert payload["data"]["lng"] == pytest.approx(79.855, rel=1e-6)
    row = db.query(ListingGeoEnrichment).filter(ListingGeoEnrichment.listing_id == listing.id).one()
    assert float(row.lat) == pytest.approx(6.917, rel=1e-6)
    assert "individual" in payload["limitation"].lower() or "gps" in payload["limitation"].lower()


def test_cached_hash_skips_upstream():
    from app.services.geo_service import enrich_listing

    db = _session()
    listing = _listing(db)
    http = _client(GEOAPIFY_HIT)
    first = enrich_listing(db, listing, client=http, api_key="test-key")
    second = enrich_listing(db, listing, client=http, api_key="test-key")
    assert first["available"] is True
    assert second["available"] is True
    assert http.get.call_count == 1


def test_changed_raw_location_regeocodes():
    from app.services.geo_service import enrich_listing

    db = _session()
    listing = _listing(db)
    http = _client(GEOAPIFY_HIT)
    enrich_listing(db, listing, client=http, api_key="test-key")
    listing.raw_location = "Peradeniya, Kandy"
    listing.district = "Kandy"
    listing.city = "Kandy"
    db.commit()
    enrich_listing(db, listing, client=http, api_key="test-key")
    assert http.get.call_count == 2


def test_disabled_flag_does_not_call_upstream(monkeypatch):
    monkeypatch.setenv("ENRICHMENT_GEOAPIFY", "false")
    from app.services.geo_service import enrich_listing

    db = _session()
    listing = _listing(db)
    http = _client(GEOAPIFY_HIT)
    payload = enrich_listing(db, listing, client=http, api_key="test-key")
    assert payload["available"] is False
    assert payload["unavailable_reason"] == "disabled"
    http.get.assert_not_called()


def test_missing_key_is_unavailable(monkeypatch):
    monkeypatch.delenv("GEOAPIFY_API_KEY", raising=False)
    from app.services.geo_service import enrich_listing

    db = _session()
    listing = _listing(db)
    payload = enrich_listing(db, listing, client=_client(GEOAPIFY_HIT), api_key="")
    assert payload["available"] is False
    assert payload["unavailable_reason"] == "missing_key"


def test_country_level_match_is_not_treated_as_a_vehicle_pin():
    from app.services.geo_service import enrich_listing

    db = _session()
    listing = _listing(db)
    payload = enrich_listing(db, listing, client=_client(COUNTRY_ONLY), api_key="test-key")
    assert payload["available"] is False
    assert payload["unavailable_reason"] in {"low_match_confidence", "no_lk_match"}


def test_circuit_opens_after_repeated_failures():
    from app.services.geo_service import CIRCUIT_FAILURE_THRESHOLD, enrich_listing

    db = _session()
    listing = _listing(db)
    failing = _client(None, error=httpx.ConnectError("down"))
    for _ in range(CIRCUIT_FAILURE_THRESHOLD):
        payload = enrich_listing(db, listing, client=failing, api_key="test-key")
        assert payload["available"] is False
    before = failing.get.call_count
    closed = enrich_listing(db, listing, client=failing, api_key="test-key")
    assert closed["unavailable_reason"] == "circuit_open"
    assert failing.get.call_count == before


def test_listing_geo_endpoint_returns_envelope(monkeypatch):
    monkeypatch.setenv("SKIP_DB_INIT", "true")
    monkeypatch.setattr("app.main.SKIP_DB_INIT", True)
    from app.main import app
    from app.services.geo_service import enrich_listing

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    listing = _listing(db)
    enrich_listing(db, listing, client=_client(GEOAPIFY_HIT), api_key="test-key")
    listing_id = listing.id
    db.close()

    def override_get_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get(f"/api/v1/listings/{listing_id}/geo")
        assert response.status_code == 200
        body = response.json()
        assert body["available"] is True
        assert body["data"]["lat"] == pytest.approx(6.917, rel=1e-6)
        listing_after = Session().query(CarListing).filter(CarListing.id == listing_id).one()
        assert listing_after.raw_location == "Kollupitiya, Colombo"
    finally:
        app.dependency_overrides.clear()
