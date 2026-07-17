"""Tests for the per-vehicle listing-history report."""

import sys
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils.history_report import build_history_report
from db.models import Base, CarListing, VehiclePriceHistory


_NOW = datetime(2026, 7, 16, 10, 0)


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _listing(sid, *, make="Toyota", model="Premio", year=2019, price=9_000_000,
             mileage=60_000, source="ikman", first_days_ago=10, is_active=True,
             district="Colombo"):
    seen = _NOW - timedelta(days=first_days_ago)
    return CarListing(
        source=source, source_id=sid, scraped_at=_NOW,
        first_seen_at=seen, last_seen_at=_NOW,
        make=make, model=model, year=year, price_lkr=price, mileage=mileage,
        district=district,
        title=f"{make} {model} {year}", url=f"https://ex.com/{source}/{sid}",
        is_active=is_active,
    )


def test_report_basic_shape():
    db = _session()
    car = _listing("a", first_days_ago=5)
    db.add(car); db.commit()
    for p, d in [(9_500_000, 20), (9_200_000, 10), (9_000_000, 2)]:
        db.add(VehiclePriceHistory(vehicle_id=car.id, price_lkr=p, scraped_at=_NOW - timedelta(days=d)))
    db.commit()

    report = build_history_report(db, car)
    assert report["listing_id"] == car.id
    assert report["price_cuts"] == 2
    assert report["total_change_pct"] < 0
    assert len(report["price_points"]) == 3
    assert "disclaimer" in report


def test_long_market_flag():
    db = _session()
    car = _listing("old", first_days_ago=75)
    db.add(car); db.commit()
    report = build_history_report(db, car)
    kinds = {f["kind"] for f in report["flags"]}
    assert "long_market" in kinds
    assert report["days_on_market"] >= 60


def test_multi_listed_flag_and_related():
    db = _session()
    a = _listing("a", source="ikman", price=9_000_000)
    b = _listing("b", source="riyasewana", price=8_600_000)
    db.add_all([a, b]); db.commit()
    report = build_history_report(db, a)
    assert len(report["related_listings"]) == 1
    assert report["related_listings"][0]["confidence"] == "likely"
    kinds = {f["kind"] for f in report["flags"]}
    assert "multi_listed" in kinds


def test_odometer_rollback_flag():
    db = _session()
    # earlier ad at 80k km, later ad (this one) at 60k km — impossible
    old = _listing("old", source="riyasewana", mileage=80_000, first_days_ago=40)
    new = _listing("new", source="ikman", mileage=60_000, first_days_ago=5)
    db.add_all([old, new]); db.commit()
    report = build_history_report(db, new)
    kinds = {f["kind"] for f in report["flags"]}
    assert "odometer_inconsistency" in kinds


def test_no_false_odometer_flag_when_mileage_rises():
    db = _session()
    old = _listing("old", source="riyasewana", mileage=60_000, first_days_ago=40)
    new = _listing("new", source="ikman", mileage=68_000, first_days_ago=5)
    db.add_all([old, new]); db.commit()
    report = build_history_report(db, new)
    kinds = {f["kind"] for f in report["flags"]}
    assert "odometer_inconsistency" not in kinds


def test_possibly_sold_flag():
    db = _session()
    car = _listing("gone", is_active=False)
    db.add(car); db.commit()
    report = build_history_report(db, car)
    kinds = {f["kind"] for f in report["flags"]}
    assert "possibly_sold" in kinds


def test_endpoint():
    from fastapi.testclient import TestClient
    from sqlalchemy.pool import StaticPool
    from app.main import app
    from db.session import get_db

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    car = _listing("x"); db.add(car); db.commit()

    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        r = client.get(f"/api/v1/listings/{car.id}/history-report")
        assert r.status_code == 200
        assert r.json()["listing_id"] == car.id
        assert client.get("/api/v1/listings/999999/history-report").status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
