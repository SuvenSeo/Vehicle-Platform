"""RevCarData 100-record match-rate pilot. Must never feed MSRP into LKR FMV."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.append(str(Path(__file__).resolve().parents[1]))

from db.models import Base, CarListing


def _session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _add(db, *, source_id, make, model, year, fuel="petrol"):
    now = datetime(2026, 8, 1, tzinfo=timezone.utc)
    row = CarListing(
        source="ikman",
        source_id=source_id,
        scraped_at=now,
        first_seen_at=now,
        last_seen_at=now,
        make=make,
        model=model,
        year=year,
        title=f"{make} {model}",
        url=f"https://example.com/{source_id}",
        is_outlier=False,
        is_active=True,
        district="Colombo",
        fuel_type=fuel,
        price_lkr=5_000_000,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _seed(db):
    for i in range(12):
        _add(db, source_id=f"axio-{i}", make="Toyota", model="Axio", year=2015)
    for i in range(8):
        _add(db, source_id=f"camry-{i}", make="Toyota", model="Camry", year=2015)
    _add(db, source_id="leaf-1", make="Nissan", model="Leaf", year=2018, fuel="electric")
    _add(db, source_id="aqua-1", make="Toyota", model="Aqua", year=2014, fuel="hybrid")
    _add(db, source_id="old-1", make="Honda", model="Civic", year=2006)
    return db


def _client(payload):
    mock = MagicMock()
    response = MagicMock()
    response.raise_for_status = MagicMock()
    response.json.return_value = payload
    mock.get.return_value = response
    mock.close = MagicMock()
    return mock


CAMRY_HIT = {
    "items": [
        {
            "id": 88,
            "year": 2015,
            "make": "Toyota",
            "model": "Camry",
            "engine": "2.5L I4",
            "fuel": "gasoline",
            "body": "sedan",
            "displacement_cc": 2494,
            "pricing": {"base_msrp_usd": 23570},
        }
    ]
}

COROLLA_ONLY = {
    "items": [
        {
            "id": 12,
            "year": 2015,
            "make": "Toyota",
            "model": "Corolla",
            "engine": "1.8L",
            "pricing": {"base_msrp_usd": 18500},
        }
    ]
}


@pytest.fixture(autouse=True)
def _enable(monkeypatch):
    monkeypatch.setenv("ENRICHMENT_REVCARDATA", "true")
    monkeypatch.setenv("REVCARDATA_API_KEY", "test-key")


def test_sample_prefers_popular_and_hard_strata():
    from app.services.revcardata_pilot import select_pilot_sample

    db = _seed(_session())
    sample = select_pilot_sample(db, popular_n=2, hard_n=3)
    keys = {(row.make, row.model) for row in sample}
    assert ("Toyota", "Axio") in keys
    assert ("Toyota", "Camry") in keys
    assert any(row.model in {"Leaf", "Aqua", "Civic"} or (row.year or 9999) <= 2010 for row in sample)
    assert len(sample) == len({row.id for row in sample})


def test_camry_is_a_strict_match_and_msrp_is_not_exported_to_fmv():
    from app.services.revcardata_pilot import match_listing, run_pilot

    db = _session()
    listing = _add(db, source_id="camry-x", make="Toyota", model="Camry", year=2015)
    scored = match_listing(listing, CAMRY_HIT["items"])
    assert scored["outcome"] == "match"
    assert scored["match_confidence"] >= 0.8
    assert "msrp" not in scored or scored.get("msrp_used_for_fmv") is False

    with patch("app.utils.fmv.predict_listing_fmv") as fmv:
        report = run_pilot(db, client=_client(CAMRY_HIT), api_key="test-key", popular_n=1, hard_n=0)
    fmv.assert_not_called()
    assert report["matched"] >= 1
    assert report["msrp_used_for_lkr_fmv"] is False
    assert "base_msrp" not in str(report.get("valuation", "")).lower()


def test_axio_vs_corolla_is_false_or_unmatched_not_a_catalog_hit():
    from app.services.revcardata_pilot import match_listing

    db = _session()
    listing = _add(db, source_id="axio-x", make="Toyota", model="Axio", year=2015)
    scored = match_listing(listing, COROLLA_ONLY["items"])
    assert scored["outcome"] in {"false_match", "unmatched"}
    assert scored["outcome"] != "match"


def test_field_completeness_counts_core_specs_not_msrp():
    from app.services.revcardata_pilot import field_completeness

    stats = field_completeness(
        [
            {
                "engine": "2.5L",
                "fuel": "gasoline",
                "body": "sedan",
                "displacement_cc": 2494,
                "pricing": {"base_msrp_usd": 1},
            },
            {"engine": None, "fuel": "gasoline"},
        ]
    )
    assert 0 < stats["core_fill_rate"] < 1
    assert "msrp" not in stats or "not used" in str(stats.get("msrp_note", "")).lower()


def test_disabled_pilot_is_skipped(monkeypatch):
    monkeypatch.setenv("ENRICHMENT_REVCARDATA", "false")
    from app.services.revcardata_pilot import run_pilot

    report = run_pilot(_session(), client=_client(CAMRY_HIT), api_key="test-key")
    assert report["status"] == "skipped"
    assert report["msrp_used_for_lkr_fmv"] is False


def test_missing_key_is_skipped(monkeypatch):
    monkeypatch.delenv("REVCARDATA_API_KEY", raising=False)
    from app.services.revcardata_pilot import run_pilot

    report = run_pilot(_session(), client=_client(CAMRY_HIT), api_key="")
    assert report["status"] == "skipped"
