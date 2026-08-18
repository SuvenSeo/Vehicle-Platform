"""NHTSA safety-research service and endpoints. Upstream is always mocked."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app
from db.models import Base, CarListing
from db.session import get_db


def _json_response(payload: dict, status_code: int = 200) -> MagicMock:
    response = MagicMock()
    response.status_code = status_code
    response.raise_for_status = MagicMock()
    if status_code >= 400:
        response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "error",
            request=MagicMock(),
            response=response,
        )
    response.json.return_value = payload
    return response


def _client_for_urls(mapping: dict[str, dict]) -> MagicMock:
    mock_client = MagicMock()

    def _get(url, params=None, **kwargs):
        key = url
        if params:
            from urllib.parse import urlencode

            key = f"{url}?{urlencode(params)}"
        for fragment, payload in mapping.items():
            if fragment in key:
                return _json_response(payload)
        return _json_response({"Count": 0, "Results": []})

    mock_client.get.side_effect = _get
    mock_client.close = MagicMock()
    return mock_client


RECALLS = {
    "Count": 1,
    "Results": [
        {
            "NHTSACampaignNumber": "20V123000",
            "Component": "AIR BAGS",
            "Summary": "The passenger air bag inflator may explode.",
            "Consequence": "An inflator explosion can cause serious injury.",
            "Remedy": "Dealers will replace the inflator.",
            "ModelYear": "2015",
            "Make": "TOYOTA",
            "Model": "CAMRY",
        }
    ],
}

COMPLAINTS = {
    "Count": 2,
    "Results": [
        {"odiNumber": 1, "crash": False, "fire": False, "components": "ENGINE", "summary": "Stalling"},
        {"odiNumber": 2, "crash": True, "fire": False, "components": "AIR BAGS", "summary": "Airbag light"},
    ],
}

RATINGS_VARIANTS = {
    "Count": 1,
    "Results": [{"VehicleId": 9991, "VehicleDescription": "2015 Toyota Camry 4-DR"}],
}

RATINGS_DETAIL = {
    "Count": 1,
    "Results": [
        {
            "VehicleId": 9991,
            "OverallRating": "5",
            "OverallFrontCrashRating": "5",
            "OverallSideCrashRating": "5",
            "RolloverRating": "4",
            "VehicleDescription": "2015 Toyota Camry 4-DR",
        }
    ],
}


def test_research_returns_attributed_safety_card():
    from app.services.nhtsa_safety import research_vehicle

    client = _client_for_urls(
        {
            "recallsByVehicle": RECALLS,
            "complaintsByVehicle": COMPLAINTS,
            "SafetyRatings/modelyear/2015/make/Toyota/model/Camry": RATINGS_VARIANTS,
            "SafetyRatings/VehicleId/9991": RATINGS_DETAIL,
        }
    )
    payload = research_vehicle(2015, "Toyota", "Camry", client=client)

    assert payload["available"] is True
    assert payload["provider"] == "nhtsa"
    assert payload["market_scope"].startswith("US")
    assert payload["match_confidence"] >= 0.8
    assert payload["data"]["rating"]["overall"] == "5"
    assert payload["data"]["recalls"][0]["campaign"] == "20V123000"
    assert payload["data"]["recalls"][0]["remedy"]
    assert "individual" in payload["limitation"].lower() or "sri lankan" in payload["limitation"].lower()
    assert "this vehicle has an unresolved recall" not in json.dumps(payload).lower()


def test_research_unavailable_when_upstream_fails():
    from app.services.nhtsa_safety import research_vehicle

    mock_client = MagicMock()
    mock_client.get.side_effect = httpx.ConnectError("refused")
    payload = research_vehicle(2015, "Toyota", "Camry", client=mock_client)

    assert payload["available"] is False
    assert payload["data"] is None
    assert payload["unavailable_reason"] == "upstream_error"


def test_research_unavailable_without_year_make_model():
    from app.services.nhtsa_safety import research_vehicle

    payload = research_vehicle(None, "Toyota", "Camry", client=MagicMock())
    assert payload["available"] is False
    assert payload["unavailable_reason"] == "incomplete_identity"


def test_research_no_us_match_is_unavailable_not_guessed():
    from app.services.nhtsa_safety import research_vehicle

    client = _client_for_urls({})
    payload = research_vehicle(2015, "Toyota", "Axio", client=client)
    assert payload["available"] is False
    assert payload["unavailable_reason"] == "no_us_match"
    assert payload["data"] is None


def test_disabled_flag_short_circuits(monkeypatch):
    monkeypatch.setenv("ENRICHMENT_NHTSA_SAFETY", "false")
    from app.services.nhtsa_safety import research_vehicle

    payload = research_vehicle(2015, "Toyota", "Camry", client=MagicMock())
    assert payload["available"] is False
    assert payload["unavailable_reason"] == "disabled"


@pytest.fixture()
def listing_client(monkeypatch):
    monkeypatch.setenv("SKIP_DB_INIT", "true")
    monkeypatch.setattr("app.main.SKIP_DB_INIT", True)
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    now = datetime(2026, 8, 1, tzinfo=timezone.utc)
    listing = CarListing(
        source="ikman",
        source_id="camry-1",
        scraped_at=now,
        first_seen_at=now,
        last_seen_at=now,
        make="Toyota",
        model="Camry",
        year=2015,
        title="Toyota Camry 2015",
        url="https://example.com/camry-1",
        is_outlier=False,
        is_active=True,
        district="Colombo",
        price_lkr=8_000_000,
    )
    db.add(listing)
    db.commit()
    listing_id = listing.id

    def override_get_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client, listing_id
    app.dependency_overrides.clear()
    db.close()


def test_listing_safety_research_endpoint_returns_200(listing_client):
    from app.services import nhtsa_safety

    nhtsa_safety._cache.clear()
    client, listing_id = listing_client
    mock = _client_for_urls(
        {
            "recallsByVehicle": RECALLS,
            "complaintsByVehicle": COMPLAINTS,
            "SafetyRatings/modelyear/2015/make/Toyota/model/Camry": RATINGS_VARIANTS,
            "SafetyRatings/VehicleId/9991": RATINGS_DETAIL,
        }
    )
    with patch("app.services.nhtsa_safety.httpx.Client", return_value=mock):
        response = client.get(f"/api/v1/listings/{listing_id}/safety-research")
    assert response.status_code == 200
    body = response.json()
    assert body["safety"]["available"] is True
    assert body["listing_id"] == listing_id
    assert "reliability" in body


def test_listing_safety_research_stays_200_when_nhtsa_is_down(listing_client):
    from app.services import nhtsa_safety

    nhtsa_safety._cache.clear()
    client, listing_id = listing_client
    mock = MagicMock()
    mock.get.side_effect = httpx.ConnectError("down")
    mock.close = MagicMock()
    with patch("app.services.nhtsa_safety.httpx.Client", return_value=mock):
        response = client.get(f"/api/v1/listings/{listing_id}/safety-research")
    assert response.status_code == 200
    assert response.json()["safety"]["available"] is False


def test_vehicles_safety_research_query_endpoint(listing_client):
    from app.services import nhtsa_safety

    nhtsa_safety._cache.clear()
    client, _listing_id = listing_client
    mock = _client_for_urls({"recallsByVehicle": RECALLS, "complaintsByVehicle": COMPLAINTS})
    with patch("app.services.nhtsa_safety.httpx.Client", return_value=mock):
        response = client.get(
            "/api/v1/vehicles/safety-research",
            params={"year": 2015, "make": "Toyota", "model": "Camry"},
        )
    assert response.status_code == 200
    assert response.json()["safety"]["provider"] == "nhtsa"


def test_listing_detail_still_loads_if_safety_module_explodes(listing_client):
    client, listing_id = listing_client
    response = client.get(f"/api/v1/listings/{listing_id}")
    assert response.status_code == 200
    assert response.json()["make"] == "Toyota"
