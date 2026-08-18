"""ProblemsByVin weekly ingest and reliability lookup."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.append(str(Path(__file__).resolve().parents[1]))

from db.models import Base
from db.schema_patches import apply_schema_patches


SCORECARD = [
    {
        "year": 2015,
        "make": "Toyota",
        "model": "Camry",
        "reliability_score": 3.4,
        "complaints": 120,
        "recalls": 4,
        "investigations": 1,
        "top_component": "AIR BAGS",
        "top_component_complaints": 40,
        "worst_severity": "severe",
        "alleged_deaths": 0,
        "alleged_fires": 2,
        "url": "https://problemsbyvin.com/toyota/camry/2015",
    }
]

FAILURES = [
    {
        "year": 2015,
        "make": "Toyota",
        "model": "Camry",
        "component": "ENGINE",
        "complaints": 22,
        "mileage_median": 87000,
        "mileage_p25": 62000,
        "mileage_p75": 110000,
        "est_repair_usd": 2400,
        "severity": "severe",
        "url": "https://problemsbyvin.com/toyota/camry/2015",
    }
]

TSBS = [
    {
        "year": 2015,
        "make": "Toyota",
        "model": "Camry",
        "tsb_count": 18,
        "top_category": "ENGINE",
        "url": "https://problemsbyvin.com/toyota/camry/2015",
    }
]


def _session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _http_client(payloads: dict[str, object]) -> MagicMock:
    client = MagicMock()

    def _get(url, **kwargs):
        response = MagicMock()
        response.raise_for_status = MagicMock()
        response.content = b""
        for fragment, payload in payloads.items():
            if fragment in url:
                body = json.dumps(payload).encode("utf-8")
                response.content = body
                response.json.return_value = payload
                response.headers = {"content-type": "application/json"}
                return response
        response.json.return_value = []
        response.content = b"[]"
        return response

    client.get.side_effect = _get
    client.close = MagicMock()
    return client


def test_ingest_stores_snapshots_and_checksum():
    from app.services.problemsbyvin import ingest_datasets

    db = _session()
    client = _http_client(
        {
            "vehicle-reliability-scorecard.json": SCORECARD,
            "failure-mileage-distribution.json": FAILURES,
            "tsb-index.json": TSBS,
        }
    )
    result = ingest_datasets(db, client=client)
    assert result["status"] == "success"
    assert result["rows"] >= 1
    assert result["checksum"]
    from db.models import VehicleReliabilitySnapshot

    stored = db.query(VehicleReliabilitySnapshot).all()
    assert stored
    camry = next(row for row in stored if row.vehicle_key == "2015|toyota|camry")
    assert camry.source_version
    assert camry.payload["scorecard"]["reliability_score"] == 3.4
    assert "est_repair_usd" not in json.dumps(camry.payload["known_issues"][0])


def test_lookup_returns_methodology_caveat_and_no_lkr_repair_cost():
    from app.services.problemsbyvin import ingest_datasets, lookup_reliability

    db = _session()
    ingest_datasets(
        db,
        client=_http_client(
            {
                "vehicle-reliability-scorecard.json": SCORECARD,
                "failure-mileage-distribution.json": FAILURES,
                "tsb-index.json": TSBS,
            }
        ),
    )
    payload = lookup_reliability(db, 2015, "Toyota", "Camry")
    assert payload["available"] is True
    assert payload["provider"] == "problemsbyvin"
    assert "heuristic" in payload["limitation"].lower() or "volume" in payload["limitation"].lower()
    assert "not a recall" in json.dumps(payload["data"]["tsb"]).lower() or "not a recall" in payload["limitation"].lower()
    blob = json.dumps(payload).lower()
    assert "repair_cost_lkr" not in blob
    assert "est_repair_usd" not in blob
    assert payload["data"]["scorecard"]["reliability_score"] == 3.4


def test_lookup_unavailable_when_no_snapshot():
    from app.services.problemsbyvin import lookup_reliability

    payload = lookup_reliability(_session(), 2015, "Toyota", "Axio")
    assert payload["available"] is False
    assert payload["unavailable_reason"] in {"no_snapshot", "no_us_match"}


def test_schema_patch_creates_reliability_and_safety_tables():
    engine = create_engine("sqlite:///:memory:")
    apply_schema_patches(engine)
    from sqlalchemy import inspect

    tables = inspect(engine).get_table_names()
    assert "vehicle_safety_snapshots" in tables
    assert "vehicle_reliability_snapshots" in tables
    assert "vehicle_catalog_matches" in tables
