import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import stats
from db.models import Base, CarListing


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _listing(
    source_id: str,
    source: str = "ikman",
    price_lkr: int | None = 7_500_000,
    *,
    scraped_at: datetime | None = None,
    is_outlier: bool = False,
    is_duplicate: bool = False,
) -> CarListing:
    ts = scraped_at or datetime(2026, 7, 1, 10, 0, tzinfo=timezone.utc)
    return CarListing(
        source=source,
        source_id=source_id,
        scraped_at=ts,
        first_seen_at=ts,
        last_seen_at=ts,
        make="Toyota",
        model="Vitz",
        year=2018,
        price_lkr=price_lkr,
        deal_score=5.0,
        district="Colombo",
        city="Colombo",
        title=f"Toyota Vitz {source_id}",
        url=f"https://example.com/{source_id}",
        is_outlier=is_outlier,
        is_duplicate=is_duplicate,
    )


def test_source_quality_returns_per_source_rows():
    db = _session()
    db.add_all(
        [
            _listing("ikman-1", source="ikman"),
            _listing("ikman-2", source="ikman"),
            _listing("riyasewana-1", source="riyasewana"),
        ]
    )
    db.commit()

    payload = stats.get_source_quality(db=db)

    sources_by_name = {row["source"]: row for row in payload["sources"]}
    assert "ikman" in sources_by_name
    assert "riyasewana" in sources_by_name
    assert sources_by_name["ikman"]["listing_count"] == 2
    assert sources_by_name["riyasewana"]["listing_count"] == 1


def test_source_quality_ordered_by_listing_count_desc():
    db = _session()
    db.add_all(
        [
            _listing("ikman-1", source="ikman"),
            _listing("ikman-2", source="ikman"),
            _listing("ikman-3", source="ikman"),
            _listing("riyasewana-1", source="riyasewana"),
        ]
    )
    db.commit()

    payload = stats.get_source_quality(db=db)

    assert payload["sources"][0]["source"] == "ikman"
    assert payload["sources"][1]["source"] == "riyasewana"


def test_source_quality_price_fill_rate():
    db = _session()
    db.add_all(
        [
            _listing("priced-1", price_lkr=7_000_000),
            _listing("priced-2", price_lkr=8_000_000),
            _listing("no-price", price_lkr=None),
            _listing("tiny-price", price_lkr=50_000),
        ]
    )
    db.commit()

    payload = stats.get_source_quality(db=db)

    row = payload["sources"][0]
    assert row["listing_count"] == 4
    assert row["price_fill_rate"] == round(2 / 4, 4)


def test_source_quality_outlier_rate():
    db = _session()
    db.add_all(
        [
            _listing("normal-1", is_outlier=False),
            _listing("normal-2", is_outlier=False),
            _listing("outlier-1", is_outlier=True),
        ]
    )
    db.commit()

    payload = stats.get_source_quality(db=db)

    row = payload["sources"][0]
    assert row["listing_count"] == 3
    assert row["outlier_rate"] == round(1 / 3, 4)


def test_source_quality_duplicate_rate():
    db = _session()
    db.add_all(
        [
            _listing("orig-1", is_duplicate=False),
            _listing("orig-2", is_duplicate=False),
            _listing("orig-3", is_duplicate=False),
            _listing("dup-1", is_duplicate=True),
        ]
    )
    db.commit()

    payload = stats.get_source_quality(db=db)

    row = payload["sources"][0]
    assert row["listing_count"] == 4
    assert row["duplicate_rate"] == round(1 / 4, 4)


def test_source_quality_fresh_24h_pct(monkeypatch):
    fixed_now = datetime(2026, 7, 13, 12, 0, tzinfo=timezone.utc)

    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed_now if tz is not None else fixed_now.replace(tzinfo=None)

    monkeypatch.setattr(stats, "datetime", FixedDateTime)

    fresh_ts = fixed_now - timedelta(hours=1)
    stale_ts = fixed_now - timedelta(hours=30)

    db = _session()
    db.add_all(
        [
            _listing("fresh-1", scraped_at=fresh_ts),
            _listing("fresh-2", scraped_at=fresh_ts),
            _listing("stale-1", scraped_at=stale_ts),
            _listing("stale-2", scraped_at=stale_ts),
        ]
    )
    db.commit()

    payload = stats.get_source_quality(db=db)

    row = payload["sources"][0]
    assert row["listing_count"] == 4
    assert row["fresh_24h_pct"] == round(2 / 4, 4)


def test_source_quality_all_zero_rates_for_clean_source():
    db = _session()
    db.add_all(
        [
            _listing("clean-1", price_lkr=7_000_000, is_outlier=False, is_duplicate=False),
            _listing("clean-2", price_lkr=8_000_000, is_outlier=False, is_duplicate=False),
        ]
    )
    db.commit()

    payload = stats.get_source_quality(db=db)

    row = payload["sources"][0]
    assert row["outlier_rate"] == 0.0
    assert row["duplicate_rate"] == 0.0
    assert row["price_fill_rate"] == 1.0


def test_source_quality_generated_at_is_returned():
    db = _session()
    db.add(_listing("any-1"))
    db.commit()

    payload = stats.get_source_quality(db=db)

    assert "generated_at" in payload
    assert payload["generated_at"]
