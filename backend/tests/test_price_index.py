"""Tests for the mix-adjusted price index."""

import sys
from decimal import Decimal
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils.price_index import build_price_index
from db.models import Base, PriceAggregate


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _agg(make, model, year, py, pm, median, count=10):
    m = Decimal(str(median))
    return PriceAggregate(
        make=make, model=model, year=year, period_year=py, period_month=pm,
        median_price_lkr=m, avg_price_lkr=m, p25_price_lkr=m, p75_price_lkr=m,
        listing_count=count,
    )


def _six_cohorts(py, pm, factor):
    """Six distinct cohorts, all prices scaled by `factor`."""
    base = [("Toyota", "Premio", 2019, 9_000_000), ("Toyota", "Aqua", 2018, 6_000_000),
            ("Honda", "Vezel", 2017, 8_000_000), ("Honda", "Fit", 2016, 4_000_000),
            ("Suzuki", "WagonR", 2018, 3_500_000), ("Nissan", "Leaf", 2019, 7_000_000)]
    return [_agg(mk, md, yr, py, pm, px * factor) for mk, md, yr, px in base]


def test_base_period_is_100():
    db = _session()
    for a in _six_cohorts(2026, 1, 1.0):
        db.add(a)
    db.commit()
    idx = build_price_index(db)
    assert idx["base_period"] == "2026-01"
    assert idx["points"][0]["index_value"] == 100.0


def test_uniform_10pct_rise_moves_index_to_110():
    db = _session()
    for a in _six_cohorts(2026, 1, 1.0):
        db.add(a)
    for a in _six_cohorts(2026, 2, 1.10):
        db.add(a)
    db.commit()
    idx = build_price_index(db)
    assert len(idx["points"]) == 2
    assert idx["points"][1]["index_value"] == 110.0
    assert idx["points"][1]["mom_change_pct"] == 10.0


def test_mix_adjustment_ignores_new_expensive_cohort():
    """Adding a brand-new expensive cohort in period 2 must NOT move the index —
    only like-for-like cohorts present in the base count."""
    db = _session()
    for a in _six_cohorts(2026, 1, 1.0):
        db.add(a)
    # period 2: same six cohorts flat, plus a new Prado at 25M
    for a in _six_cohorts(2026, 2, 1.0):
        db.add(a)
    db.add(_agg("Toyota", "Prado", 2020, 2026, 2, 25_000_000, count=50))
    db.commit()
    idx = build_price_index(db)
    assert idx["points"][1]["index_value"] == 100.0  # unmoved despite the pricey newcomer


def test_thin_period_skipped():
    db = _session()
    for a in _six_cohorts(2026, 1, 1.0):
        db.add(a)
    # period 2 has only 2 like-for-like cohorts -> below MIN_PERIOD_COHORTS
    db.add(_agg("Toyota", "Premio", 2019, 2026, 2, 9_000_000))
    db.add(_agg("Toyota", "Aqua", 2018, 2026, 2, 6_000_000))
    db.commit()
    idx = build_price_index(db)
    assert [p["period"] for p in idx["points"]] == ["2026-01"]


def test_segments_present():
    db = _session()
    for pm, f in [(1, 1.0), (2, 1.05)]:
        for a in _six_cohorts(2026, pm, f):
            db.add(a)
    db.commit()
    idx = build_price_index(db)
    # segments keyed by make; each self-based
    assert isinstance(idx["segments"], dict)


def test_empty_db():
    db = _session()
    idx = build_price_index(db)
    assert idx["points"] == []
    assert idx["base_period"] is None
