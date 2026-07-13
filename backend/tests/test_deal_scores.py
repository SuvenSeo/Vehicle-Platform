"""
Tests for bulk_refresh_deal_scores() in app/utils/deal_scores.py.

All tests use an in-memory SQLite database so they run without any external
database dependency.
"""
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils.deal_scores import _clamp_score, bulk_refresh_deal_scores
from db.models import Base, CarListing, PriceAggregate


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _dt() -> datetime:
    return datetime(2026, 1, 1, tzinfo=timezone.utc)


def _listing(
    source_id: str,
    *,
    make: str = "Toyota",
    model: str = "Vitz",
    year: int = 2020,
    price_lkr: int | None = 5_000_000,
    district: str | None = "Colombo",
    is_outlier: bool = False,
    is_duplicate: bool = False,
) -> CarListing:
    now = _dt()
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
        district=district,
        city=district,
        is_outlier=is_outlier,
        is_duplicate=is_duplicate,
        title=f"{make} {model} {source_id}",
        url=f"https://example.com/{source_id}",
    )


def _aggregate(
    make: str,
    model: str,
    year: int,
    *,
    district: str | None = None,
    median_price_lkr: int,
    period_year: int = 2026,
    period_month: int = 1,
) -> PriceAggregate:
    m = Decimal(str(median_price_lkr))
    return PriceAggregate(
        make=make,
        model=model,
        year=year,
        district=district,
        period_year=period_year,
        period_month=period_month,
        median_price_lkr=m,
        avg_price_lkr=m,
        p25_price_lkr=m,
        p75_price_lkr=m,
        listing_count=5,
    )


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


# ---------------------------------------------------------------------------
# Unit tests for _clamp_score
# ---------------------------------------------------------------------------

def test_clamp_score_caps_at_positive_100():
    assert _clamp_score(150.0) == 100.0
    assert _clamp_score(100.0) == 100.0


def test_clamp_score_caps_at_negative_100():
    assert _clamp_score(-150.0) == -100.0
    assert _clamp_score(-100.0) == -100.0


def test_clamp_score_preserves_in_range_values():
    assert _clamp_score(0.0) == 0.0
    assert _clamp_score(25.55) == 25.6
    assert _clamp_score(-30.0) == -30.0


# ---------------------------------------------------------------------------
# Integration tests using in-memory SQLite
# ---------------------------------------------------------------------------

def test_bulk_refresh_cheaper_than_median_gives_positive_score():
    """Listing priced 20 % below median → deal_score = 20.0."""
    db = _session()
    db.add(_listing("a", price_lkr=4_000_000))  # 4M vs 5M median
    db.add(_aggregate("Toyota", "Vitz", 2020, median_price_lkr=5_000_000))
    db.commit()

    result = bulk_refresh_deal_scores(db)

    assert result["updated"] == 1
    listing = db.query(CarListing).filter_by(source_id="a").one()
    assert float(listing.market_median_lkr) == 5_000_000.0
    assert float(listing.deal_score) == 20.0


def test_bulk_refresh_more_expensive_than_median_gives_negative_score():
    """Listing priced 20 % above median → deal_score = -20.0."""
    db = _session()
    db.add(_listing("a", price_lkr=6_000_000))  # 6M vs 5M median
    db.add(_aggregate("Toyota", "Vitz", 2020, median_price_lkr=5_000_000))
    db.commit()

    result = bulk_refresh_deal_scores(db)

    assert result["updated"] == 1
    listing = db.query(CarListing).filter_by(source_id="a").one()
    assert float(listing.deal_score) == -20.0


def test_bulk_refresh_skips_outlier_listings():
    db = _session()
    db.add(_listing("outlier", price_lkr=3_000_000, is_outlier=True))
    db.add(_aggregate("Toyota", "Vitz", 2020, median_price_lkr=5_000_000))
    db.commit()

    result = bulk_refresh_deal_scores(db)

    assert result["updated"] == 0
    listing = db.query(CarListing).filter_by(source_id="outlier").one()
    assert listing.deal_score is None


def test_bulk_refresh_skips_duplicate_listings():
    db = _session()
    db.add(_listing("dupe", price_lkr=3_000_000, is_duplicate=True))
    db.add(_aggregate("Toyota", "Vitz", 2020, median_price_lkr=5_000_000))
    db.commit()

    result = bulk_refresh_deal_scores(db)

    assert result["updated"] == 0


def test_bulk_refresh_skips_listings_without_price():
    db = _session()
    db.add(_listing("no-price", price_lkr=None))
    db.add(_aggregate("Toyota", "Vitz", 2020, median_price_lkr=5_000_000))
    db.commit()

    result = bulk_refresh_deal_scores(db)

    assert result["updated"] == 0


def test_bulk_refresh_skips_listings_without_matching_aggregate():
    """No aggregate for Honda Fit → skipped, counted in skipped_no_median."""
    db = _session()
    db.add(_listing("honda", make="Honda", model="Fit", year=2019, price_lkr=3_000_000))
    db.add(_aggregate("Toyota", "Vitz", 2020, median_price_lkr=5_000_000))
    db.commit()

    result = bulk_refresh_deal_scores(db)

    assert result["updated"] == 0
    assert result["skipped_no_median"] == 1


def test_bulk_refresh_prefers_district_aggregate_over_national():
    """District-specific median is preferred when available."""
    db = _session()
    db.add(_listing("a", price_lkr=4_500_000, district="Colombo"))
    # District (Colombo) aggregate → median 5 M  → score (1 - 4.5/5)*100 = 10.0
    db.add(_aggregate("Toyota", "Vitz", 2020, district="Colombo", median_price_lkr=5_000_000))
    # National aggregate → would give a different score if used instead
    db.add(_aggregate("Toyota", "Vitz", 2020, district=None, median_price_lkr=8_000_000))
    db.commit()

    result = bulk_refresh_deal_scores(db)

    assert result["updated"] == 1
    listing = db.query(CarListing).filter_by(source_id="a").one()
    assert float(listing.market_median_lkr) == 5_000_000.0
    assert float(listing.deal_score) == 10.0


def test_bulk_refresh_falls_back_to_national_when_no_district_aggregate():
    """National (cross-district) median is used when no district aggregate exists."""
    db = _session()
    db.add(_listing("a", price_lkr=4_000_000, district="Galle"))
    # Only a national (NULL district) aggregate exists
    db.add(_aggregate("Toyota", "Vitz", 2020, district=None, median_price_lkr=5_000_000))
    db.commit()

    result = bulk_refresh_deal_scores(db)

    assert result["updated"] == 1
    listing = db.query(CarListing).filter_by(source_id="a").one()
    assert float(listing.market_median_lkr) == 5_000_000.0
    assert float(listing.deal_score) == 20.0


def test_bulk_refresh_falls_back_to_national_when_listing_has_no_district():
    """Listing with NULL district matches national (cross-district) median."""
    db = _session()
    db.add(_listing("a", price_lkr=4_000_000, district=None))
    db.add(_aggregate("Toyota", "Vitz", 2020, district="Colombo", median_price_lkr=5_000_000))
    db.commit()

    result = bulk_refresh_deal_scores(db)

    # National avg = 5 M (one district aggregate only)
    assert result["updated"] == 1
    listing = db.query(CarListing).filter_by(source_id="a").one()
    assert float(listing.deal_score) == 20.0


def test_bulk_refresh_uses_most_recent_period():
    """Only the most recent period's aggregate is used; older periods are ignored."""
    db = _session()
    db.add(_listing("a", price_lkr=4_000_000))
    db.add(_aggregate("Toyota", "Vitz", 2020, median_price_lkr=8_000_000, period_year=2025, period_month=12))
    db.add(_aggregate("Toyota", "Vitz", 2020, median_price_lkr=5_000_000, period_year=2026, period_month=1))
    db.commit()

    result = bulk_refresh_deal_scores(db)

    listing = db.query(CarListing).filter_by(source_id="a").one()
    # Most recent: 5 M → score = 20
    assert float(listing.market_median_lkr) == 5_000_000.0
    assert float(listing.deal_score) == 20.0


def test_bulk_refresh_processes_multiple_listings_across_batches():
    """All listings are updated across multiple batch/commit cycles."""
    db = _session()
    for i in range(7):
        db.add(_listing(f"lst{i}", price_lkr=4_000_000))
    db.add(_aggregate("Toyota", "Vitz", 2020, median_price_lkr=5_000_000))
    db.commit()

    result = bulk_refresh_deal_scores(db, batch_size=3)

    assert result["updated"] == 7
    assert result["batches"] == 3  # ceil(7 / 3) = 3
    for i in range(7):
        lst = db.query(CarListing).filter_by(source_id=f"lst{i}").one()
        assert float(lst.deal_score) == 20.0


def test_bulk_refresh_clamps_extreme_negative_score():
    """Very expensive listing is clamped to -100."""
    db = _session()
    # (1 - 50 M / 5 M) * 100 = -900 → clamped to -100
    db.add(_listing("expensive", price_lkr=50_000_000))
    db.add(_aggregate("Toyota", "Vitz", 2020, median_price_lkr=5_000_000))
    db.commit()

    result = bulk_refresh_deal_scores(db)

    listing = db.query(CarListing).filter_by(source_id="expensive").one()
    assert float(listing.deal_score) == -100.0


def test_bulk_refresh_returns_correct_summary_dict():
    """Return dict keys and values are correct for a mixed dataset."""
    db = _session()
    db.add(_listing("match", price_lkr=4_000_000))
    db.add(_listing("no-match", make="Honda", model="Fit", year=2018, price_lkr=3_000_000))
    db.add(_aggregate("Toyota", "Vitz", 2020, median_price_lkr=5_000_000))
    db.commit()

    result = bulk_refresh_deal_scores(db)

    assert result == {"updated": 1, "skipped_no_median": 1, "batches": 1}


def test_bulk_refresh_empty_db_returns_zero_counts():
    db = _session()

    result = bulk_refresh_deal_scores(db)

    assert result == {"updated": 0, "skipped_no_median": 0, "batches": 0}


def test_bulk_refresh_national_median_is_average_of_district_medians():
    """
    National median averages across all district aggregates for the latest period.
    Listing with a district that has NO specific aggregate uses this average.
    """
    db = _session()
    db.add(_listing("a", price_lkr=5_500_000, district="Kandy"))
    # Two district aggregates → national avg = (4M + 6M) / 2 = 5M
    db.add(_aggregate("Toyota", "Vitz", 2020, district="Colombo", median_price_lkr=4_000_000))
    db.add(_aggregate("Toyota", "Vitz", 2020, district="Galle", median_price_lkr=6_000_000))
    db.commit()

    result = bulk_refresh_deal_scores(db)

    assert result["updated"] == 1
    listing = db.query(CarListing).filter_by(source_id="a").one()
    # national avg = 5 M; score = (1 - 5.5/5) * 100 = -10.0
    assert float(listing.market_median_lkr) == 5_000_000.0
    assert float(listing.deal_score) == -10.0
