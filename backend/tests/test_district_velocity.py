"""Tests for GET /stats/district-velocity endpoint."""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import stats as stats_module
from app.models.schemas import DistrictVelocityResponse
from app.utils import stats_cache
from db.models import Base, CarListing


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


_FIXED_NOW = datetime(2026, 4, 19, 12, 0, tzinfo=timezone.utc)


def _freeze_now(monkeypatch) -> None:
    monkeypatch.setattr(stats_cache, "utc_now", lambda: _FIXED_NOW)
    monkeypatch.setattr(stats_module, "utc_now", lambda: _FIXED_NOW)


def _listing(
    source_id: str,
    *,
    district: str = "Colombo",
    first_seen_at: datetime | None = None,
    is_outlier: bool = False,
) -> CarListing:
    ts = first_seen_at or _FIXED_NOW - timedelta(days=30)
    return CarListing(
        source="ikman",
        source_id=source_id,
        scraped_at=ts,
        first_seen_at=ts,
        last_seen_at=ts,
        make="Toyota",
        model="Vitz",
        year=2018,
        price_lkr=7_000_000,
        deal_score=5.0,
        district=district,
        city=district,
        title=f"Toyota Vitz {source_id}",
        url=f"https://example.com/{source_id}",
        is_outlier=is_outlier,
    )


# ---------------------------------------------------------------------------
# Basic response shape
# ---------------------------------------------------------------------------


def test_district_velocity_returns_valid_schema(monkeypatch):
    _freeze_now(monkeypatch)

    db = _session()
    db.add(_listing("l1", district="Colombo"))
    db.commit()

    result = stats_module.get_district_velocity(db=db)

    assert isinstance(result, DistrictVelocityResponse)
    assert hasattr(result, "points")
    assert hasattr(result, "generated_at")


def test_district_velocity_empty_db_returns_empty_points(monkeypatch):
    _freeze_now(monkeypatch)

    db = _session()

    result = stats_module.get_district_velocity(db=db)

    assert result.points == []


# ---------------------------------------------------------------------------
# listing_count and new_7d_count accuracy
# ---------------------------------------------------------------------------


def test_district_velocity_counts_all_non_outlier_listings(monkeypatch):
    _freeze_now(monkeypatch)

    db = _session()
    # 3 non-outlier Colombo listings (old — outside 7d window)
    for i in range(3):
        db.add(_listing(f"old-{i}", district="Colombo", first_seen_at=_FIXED_NOW - timedelta(days=14)))
    # 1 outlier — must not be counted
    db.add(_listing("outlier-1", district="Colombo", is_outlier=True))
    db.commit()

    result = stats_module.get_district_velocity(db=db)

    colombo = next((p for p in result.points if p.district == "Colombo"), None)
    assert colombo is not None
    assert colombo.listing_count == 3
    assert colombo.new_7d_count == 0


def test_district_velocity_new_7d_counts_recent_listings(monkeypatch):
    _freeze_now(monkeypatch)

    db = _session()
    # 2 old + 3 fresh within last 7 days
    for i in range(2):
        db.add(_listing(f"old-{i}", district="Kandy", first_seen_at=_FIXED_NOW - timedelta(days=10)))
    for i in range(3):
        db.add(_listing(f"new-{i}", district="Kandy", first_seen_at=_FIXED_NOW - timedelta(days=3)))
    db.commit()

    result = stats_module.get_district_velocity(db=db)

    kandy = next((p for p in result.points if p.district == "Kandy"), None)
    assert kandy is not None
    assert kandy.listing_count == 5
    assert kandy.new_7d_count == 3


# ---------------------------------------------------------------------------
# velocity_score computation
# ---------------------------------------------------------------------------


def test_district_velocity_score_is_new_over_total(monkeypatch):
    _freeze_now(monkeypatch)

    db = _session()
    # 4 old + 1 new → velocity = 1/5 = 0.2
    for i in range(4):
        db.add(_listing(f"old-{i}", district="Gampaha", first_seen_at=_FIXED_NOW - timedelta(days=20)))
    db.add(_listing("new-1", district="Gampaha", first_seen_at=_FIXED_NOW - timedelta(days=2)))
    db.commit()

    result = stats_module.get_district_velocity(db=db)

    gampaha = next((p for p in result.points if p.district == "Gampaha"), None)
    assert gampaha is not None
    assert abs(gampaha.velocity_score - 0.2) < 1e-4


def test_district_velocity_score_is_1_when_all_listings_are_new(monkeypatch):
    _freeze_now(monkeypatch)

    db = _session()
    for i in range(5):
        db.add(_listing(f"new-{i}", district="Galle", first_seen_at=_FIXED_NOW - timedelta(days=1)))
    db.commit()

    result = stats_module.get_district_velocity(db=db)

    galle = next((p for p in result.points if p.district == "Galle"), None)
    assert galle is not None
    assert abs(galle.velocity_score - 1.0) < 1e-4


# ---------------------------------------------------------------------------
# Coordinates embedded
# ---------------------------------------------------------------------------


def test_district_velocity_includes_lat_lng(monkeypatch):
    _freeze_now(monkeypatch)

    db = _session()
    db.add(_listing("c1", district="Colombo"))
    db.commit()

    result = stats_module.get_district_velocity(db=db)

    colombo = next((p for p in result.points if p.district == "Colombo"), None)
    assert colombo is not None
    assert isinstance(colombo.lat, float)
    assert isinstance(colombo.lng, float)
    # Colombo coords are approximately (6.9271, 79.8612)
    assert 6.0 < colombo.lat < 8.0
    assert 79.0 < colombo.lng < 81.0


# ---------------------------------------------------------------------------
# Unknown / unmapped districts are excluded
# ---------------------------------------------------------------------------


def test_district_velocity_excludes_unknown_district(monkeypatch):
    _freeze_now(monkeypatch)

    db = _session()
    db.add(_listing("x1", district="UnknownTown"))
    db.add(_listing("x2", district="Colombo"))
    db.commit()

    result = stats_module.get_district_velocity(db=db)

    districts = [p.district for p in result.points]
    assert "UnknownTown" not in districts
    assert "Colombo" in districts


def test_district_velocity_excludes_sri_lanka_generic_district(monkeypatch):
    _freeze_now(monkeypatch)

    db = _session()
    db.add(_listing("sl1", district="Sri Lanka"))
    db.add(_listing("sl2", district="Matara"))
    db.commit()

    result = stats_module.get_district_velocity(db=db)

    districts = [p.district for p in result.points]
    assert "Sri Lanka" not in districts
    assert "Matara" in districts


# ---------------------------------------------------------------------------
# Multiple districts — sorted by listing_count descending
# ---------------------------------------------------------------------------


def test_district_velocity_sorted_by_listing_count_desc(monkeypatch):
    _freeze_now(monkeypatch)

    db = _session()
    for i in range(5):
        db.add(_listing(f"c-{i}", district="Colombo"))
    for i in range(2):
        db.add(_listing(f"k-{i}", district="Kandy"))
    db.commit()

    result = stats_module.get_district_velocity(db=db)

    counts = [p.listing_count for p in result.points]
    assert counts == sorted(counts, reverse=True)


# ---------------------------------------------------------------------------
# Boundary: listing first_seen_at exactly on the 7-day boundary
# ---------------------------------------------------------------------------


def test_district_velocity_boundary_listing_exactly_7d_ago_is_included(monkeypatch):
    # The query uses >= seven_days_ago, so exactly 7d should be counted.
    _freeze_now(monkeypatch)

    db = _session()
    boundary_ts = _FIXED_NOW - timedelta(days=7)
    db.add(_listing("boundary", district="Kurunegala", first_seen_at=boundary_ts))
    db.commit()

    result = stats_module.get_district_velocity(db=db)

    kurunegala = next((p for p in result.points if p.district == "Kurunegala"), None)
    assert kurunegala is not None
    assert kurunegala.new_7d_count == 1
