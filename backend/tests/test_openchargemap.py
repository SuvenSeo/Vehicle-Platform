"""Open Charge Map Sri Lanka cache and nearby-station search."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.services.openchargemap import ingest_lk_stations, nearby_stations
from db.models import Base, ChargePoint
from db.schema_patches import apply_schema_patches
from db.session import get_db

OCM_SAMPLE = [
    {
        "ID": 4242,
        "AddressInfo": {
            "Title": "Colombo City Centre",
            "AddressLine1": "R. A. De Mel Mawatha",
            "Town": "Colombo",
            "Latitude": 6.917,
            "Longitude": 79.855,
        },
        "OperatorInfo": {"Title": "Dialog"},
        "StatusType": {"IsOperational": True, "Title": "Operational"},
        "Connections": [
            {
                "ConnectionType": {"Title": "Type 2 (Socket Only)"},
                "PowerKW": 22,
                "Level": {"Title": "Level 2"},
            }
        ],
        "DataProvider": {"Title": "Open Charge Map Contributors", "License": "Open Data Commons"},
        "DateLastStatusUpdate": "2026-08-01T00:00:00Z",
    },
    {
        "ID": 4243,
        "AddressInfo": {
            "Title": "Kandy City",
            "Town": "Kandy",
            "Latitude": 7.2906,
            "Longitude": 80.6337,
        },
        "OperatorInfo": {"Title": "Other"},
        "Connections": [{"ConnectionType": {"Title": "CCS"}, "PowerKW": 50}],
        "DataProvider": {"Title": "Open Charge Map Contributors"},
    },
]


def _session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _client(payload):
    mock = MagicMock()
    response = MagicMock()
    response.raise_for_status = MagicMock()
    response.json.return_value = payload
    mock.get.return_value = response
    mock.close = MagicMock()
    return mock


def test_ingest_stores_lk_charge_points_with_attribution():
    db = _session()
    result = ingest_lk_stations(db, client=_client(OCM_SAMPLE), api_key="test-key")
    assert result["status"] == "success"
    assert result["rows"] == 2
    row = db.query(ChargePoint).filter(ChargePoint.ocm_id == 4242).one()
    assert float(row.lat) == pytest.approx(6.917, rel=1e-6)
    assert row.operator == "Dialog"
    assert row.attribution
    assert "open charge map" in row.attribution.lower() or "contributors" in (row.data_provider or "").lower()


def test_nearby_search_returns_colombo_before_kandy():
    db = _session()
    ingest_lk_stations(db, client=_client(OCM_SAMPLE), api_key="test-key")
    rows = nearby_stations(db, lat=6.9271, lng=79.8612, radius_km=20)
    assert rows
    assert rows[0]["ocm_id"] == 4242
    assert rows[0]["distance_km"] < 5
    assert all(item["distance_km"] <= 20 for item in rows)


def test_ingest_without_key_is_skipped():
    result = ingest_lk_stations(_session(), client=_client(OCM_SAMPLE), api_key="")
    assert result["status"] == "skipped"


def test_schema_patch_creates_charge_points():
    engine = create_engine("sqlite:///:memory:")
    apply_schema_patches(engine)
    assert "charge_points" in inspect(engine).get_table_names()


def test_charging_stations_endpoint_reads_local_cache_only(monkeypatch):
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
    ingest_lk_stations(db, client=_client(OCM_SAMPLE), api_key="test-key")
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
            response = client.get(
                "/api/v1/ev/charging-stations",
                params={"lat": 6.9271, "lng": 79.8612, "radius_km": 20},
            )
        assert response.status_code == 200
        body = response.json()
        assert body["count"] >= 1
        assert body["stations"][0]["ocm_id"] == 4242
        assert "open charge map" in body["attribution"].lower()
        assert "stale" in body["limitation"].lower() or "confirm" in body["limitation"].lower()
    finally:
        app.dependency_overrides.clear()
