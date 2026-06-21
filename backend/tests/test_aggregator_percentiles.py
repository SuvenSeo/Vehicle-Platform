import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.aggregator import CarPriceAggregator
from db.models import Base, CarListing, PriceAggregate


def _dt() -> datetime:
    return datetime(2026, 4, 1, tzinfo=timezone.utc)


def _listing(source_id: str, price_lkr: int, *, is_outlier: bool = False) -> CarListing:
    now = _dt()
    return CarListing(
        source="ikman",
        source_id=source_id,
        scraped_at=now,
        first_seen_at=now,
        last_seen_at=now,
        make="Toyota",
        model="Vitz",
        year=2018,
        price_lkr=price_lkr,
        district="Colombo",
        city="Colombo",
        is_outlier=is_outlier,
        title=f"Toyota Vitz {source_id}",
        url=f"https://example.com/{source_id}",
    )


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def test_compute_aggregates_uses_listing_level_median_and_percentiles():
    db = _session()
    db.add_all(
        [
            _listing("a", 5_000_000),
            _listing("b", 6_000_000),
            _listing("c", 7_000_000),
            _listing("d", 9_000_000),
            _listing("outlier", 20_000_000, is_outlier=True),
        ]
    )
    db.commit()

    CarPriceAggregator(db).compute_aggregates(2026, 4)

    agg = (
        db.query(PriceAggregate)
        .filter(
            PriceAggregate.make == "Toyota",
            PriceAggregate.model == "Vitz",
            PriceAggregate.year == 2018,
            PriceAggregate.district == "Colombo",
            PriceAggregate.period_year == 2026,
            PriceAggregate.period_month == 4,
        )
        .one()
    )

    assert agg.listing_count == 4
    assert float(agg.avg_price_lkr) == 6_750_000
    assert float(agg.median_price_lkr) == 6_500_000
    assert float(agg.p25_price_lkr) == 5_750_000
    assert float(agg.p75_price_lkr) == 7_500_000


def test_compute_aggregates_upserts_same_period_group():
    db = _session()
    db.add_all([
        _listing("a", 6_000_000),
        _listing("b", 8_000_000),
    ])
    db.commit()

    aggregator = CarPriceAggregator(db)
    aggregator.compute_aggregates(2026, 4)

    db.add(_listing("c", 10_000_000))
    db.commit()

    aggregator.compute_aggregates(2026, 4)

    rows = db.query(PriceAggregate).filter(
        PriceAggregate.make == "Toyota",
        PriceAggregate.model == "Vitz",
        PriceAggregate.year == 2018,
        PriceAggregate.district == "Colombo",
        PriceAggregate.period_year == 2026,
        PriceAggregate.period_month == 4,
    ).all()

    assert len(rows) == 1
    assert rows[0].listing_count == 3
    assert float(rows[0].median_price_lkr) == 8_000_000