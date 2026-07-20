"""Tests for app.utils.outliers (IQR-based price outlier detection)."""

import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils.outliers import REASON_PREFIX, mark_price_outliers
from db.models import Base, CarListing


_NOW = datetime(2026, 7, 16, 10, 0)


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _listing(source_id: str, price_lkr: float, **overrides) -> CarListing:
    defaults = dict(
        source="ikman",
        source_id=source_id,
        scraped_at=_NOW,
        first_seen_at=_NOW,
        last_seen_at=_NOW,
        make="Toyota",
        model="Prius",
        year=2020,
        price_lkr=price_lkr,
        title="Toyota Prius 2020",
        url=f"https://example.com/ikman/{source_id}",
        is_active=True,
        is_outlier=False,
    )
    defaults.update(overrides)
    return CarListing(**defaults)


def _cohort(db, prices, prefix="c"):
    for i, price in enumerate(prices):
        db.add(_listing(f"{prefix}{i}", price))
    db.commit()


def test_extreme_price_flagged_normal_kept():
    db = _session()
    # Tight cohort around 10M with one absurd 60M listing.
    _cohort(db, [9_500_000, 9_800_000, 10_000_000, 10_100_000, 10_200_000,
                 10_400_000, 10_600_000, 10_800_000, 60_000_000])

    result = mark_price_outliers(db, min_group_size=8)

    assert result["flagged"] == 1
    flagged = db.query(CarListing).filter(CarListing.is_outlier == True).all()  # noqa: E712
    assert len(flagged) == 1
    assert float(flagged[0].price_lkr) == 60_000_000
    assert flagged[0].outlier_reason.startswith(REASON_PREFIX)


def test_small_groups_are_not_flagged():
    db = _session()
    _cohort(db, [9_000_000, 10_000_000, 55_000_000])  # n=3 < min_group_size

    result = mark_price_outliers(db, min_group_size=8)

    assert result["flagged"] == 0
    assert db.query(CarListing).filter(CarListing.is_outlier == True).count() == 0  # noqa: E712


def test_iqr_flag_cleared_when_back_inside_fence():
    db = _session()
    _cohort(db, [9_500_000, 9_800_000, 10_000_000, 10_100_000, 10_200_000,
                 10_400_000, 10_600_000, 10_800_000, 60_000_000])
    mark_price_outliers(db, min_group_size=8)

    # Seller corrects the typo'd price.
    bad = db.query(CarListing).filter(CarListing.is_outlier == True).one()  # noqa: E712
    bad.price_lkr = 10_300_000
    db.commit()

    result = mark_price_outliers(db, min_group_size=8)

    assert result["cleared"] == 1
    db.expire_all()
    assert db.query(CarListing).filter(CarListing.is_outlier == True).count() == 0  # noqa: E712


def test_manual_flags_are_never_touched():
    db = _session()
    _cohort(db, [9_500_000, 9_800_000, 10_000_000, 10_100_000, 10_200_000,
                 10_400_000, 10_600_000, 10_800_000])
    manual = _listing("manual", 10_000_000, is_outlier=True,
                      outlier_reason="manual: suspected scam")
    db.add(manual)
    db.commit()

    mark_price_outliers(db, min_group_size=8)

    db.expire_all()
    kept = db.query(CarListing).filter_by(source_id="manual").one()
    assert kept.is_outlier is True
    assert kept.outlier_reason == "manual: suspected scam"


def test_different_years_form_separate_cohorts():
    """A 2022 Prius priced far above 2008 Priuses must not be flagged —
    grouping is per (make, model, year)."""
    db = _session()
    _cohort(db, [4_000_000 + i * 100_000 for i in range(8)], prefix="old")
    for row in db.query(CarListing).all():
        row.year = 2008
    db.add(_listing("new1", 18_000_000, year=2022))
    db.commit()

    result = mark_price_outliers(db, min_group_size=8)

    assert result["flagged"] == 0
    assert db.query(CarListing).filter(CarListing.is_outlier == True).count() == 0  # noqa: E712


def test_inactive_listings_excluded_from_cohort():
    db = _session()
    _cohort(db, [9_500_000, 9_800_000, 10_000_000, 10_100_000, 10_200_000,
                 10_400_000, 10_600_000, 10_800_000])
    db.add(_listing("gone", 60_000_000, is_active=False))
    db.commit()

    result = mark_price_outliers(db, min_group_size=8)

    # The inactive 60M listing is not evaluated at all.
    assert result["flagged"] == 0
