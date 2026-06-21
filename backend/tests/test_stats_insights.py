import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import stats
from db.models import Base, CarListing, PriceAggregate, ScrapeRun


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _listing(
    source_id: str,
    price_lkr: int | None,
    deal_score: float,
    *,
    make: str = "Toyota",
    model: str = "Vitz",
    district: str = "Colombo",
) -> CarListing:
    now = datetime(2026, 4, 19, 10, 0, tzinfo=timezone.utc)
    return CarListing(
        source="ikman",
        source_id=source_id,
        scraped_at=now,
        first_seen_at=now,
        last_seen_at=now,
        make=make,
        model=model,
        year=2018,
        price_lkr=price_lkr,
        deal_score=deal_score,
        district=district,
        city=district,
        title=f"{make} {model} {source_id}",
        url=f"https://example.com/{source_id}",
        is_outlier=False,
    )


def test_dashboard_insights_hot_deals_exclude_non_positive_and_tiny_prices():
    db = _session()
    db.add_all(
        [
            _listing("zero-price", 0, 14.5),
            _listing("valid-price", 7_800_000, 10.2),
            _listing("tiny-price", 64_000, 18.3),
        ]
    )
    db.commit()

    payload = stats.get_dashboard_insights(db=db)

    assert [item["id"] for item in payload["hot_deals"]] == [2]
    assert all(item["price_lkr"] >= 100_000 for item in payload["hot_deals"])


def test_stats_summary_exposes_freshness_and_source_coverage():
    db = _session()
    db.add_all(
        [
            _listing("ikman-1", 7_100_000, 5.0),
            CarListing(
                source="riyasewana",
                source_id="riyasewana-1",
                scraped_at=datetime(2026, 4, 19, 12, 30, tzinfo=timezone.utc),
                first_seen_at=datetime(2026, 4, 19, 12, 30, tzinfo=timezone.utc),
                last_seen_at=datetime(2026, 4, 19, 12, 30, tzinfo=timezone.utc),
                make="Honda",
                model="Fit",
                year=2019,
                price_lkr=8_200_000,
                deal_score=6.1,
                district="Gampaha",
                city="Gampaha",
                title="Honda Fit riyasewana-1",
                url="https://example.com/riyasewana-1",
                is_outlier=False,
            ),
        ]
    )
    db.commit()

    summary = stats.get_stats_summary(db=db)

    assert summary.source_count == 2
    assert summary.last_updated is not None


def test_live_market_snapshot_excludes_unavailable_prices_from_average():
    db = _session()
    db.add_all(
        [
            _listing("priced-1", 7_000_000, 5.0),
            _listing("priced-2", 9_000_000, 5.0),
            _listing("missing-price", None, 5.0),
            ScrapeRun(
                source="riyahub",
                started_at=datetime(2026, 4, 19, 13, 0, tzinfo=timezone.utc),
                finished_at=None,
                status="RUNNING",
                listings_found=10,
                listings_new=2,
            ),
        ]
    )
    db.commit()

    payload = stats.build_live_market_snapshot(db)

    assert payload["total_listings"] == 3
    assert payload["priced_listings"] == 2
    assert payload["unavailable_price_listings"] == 1
    assert payload["avg_price_lkr"] == 8_000_000
    assert payload["latest_run"]["source"] == "riyahub"


def test_live_market_stream_serializes_snapshot(monkeypatch):
    class DummyRequest:
        async def is_disconnected(self):
            return False

    class DummyDb:
        def close(self):
            pass

    monkeypatch.setattr(stats, "SessionLocal", lambda: DummyDb())
    monkeypatch.setattr(
        stats,
        "build_live_market_snapshot",
        lambda _db: {
            "generated_at": "2026-05-21T00:00:00+00:00",
            "total_listings": 3,
            "priced_listings": 2,
            "avg_price_lkr": 8_000_000,
        },
    )

    async def run_check():
        response = await stats.stream_live_market_snapshot(DummyRequest())
        frame = await anext(response.body_iterator)
        return response, frame

    response, frame = asyncio.run(run_check())

    assert response.media_type == "text/event-stream"
    assert "event: snapshot" in frame
    assert '"total_listings": 3' in frame


def test_district_prices_include_top_model_metadata():
    db = _session()
    db.add_all(
        [
            _listing("cmb-vitz-1", 6_900_000, 5.0, make="Toyota", model="Vitz", district="Colombo"),
            _listing("cmb-vitz-2", 7_100_000, 4.0, make="Toyota", model="Vitz", district="Colombo"),
            _listing("cmb-fit-1", 7_600_000, 6.0, make="Honda", model="Fit", district="Colombo"),
            _listing("gampaha-aqua-1", 8_100_000, 7.0, make="Toyota", model="Aqua", district="Gampaha"),
        ]
    )
    db.commit()

    payload = stats.get_district_prices(db=db)
    by_district = {item["district"]: item for item in payload["points"]}

    assert by_district["Colombo"]["top_make"] == "Toyota"
    assert by_district["Colombo"]["top_model"] == "Vitz"
    assert by_district["Colombo"]["top_model_count"] == 2


def test_price_trends_fall_back_to_national_lane_when_district_samples_are_thin():
    db = _session()
    db.add_all(
        [
            PriceAggregate(
                make="Toyota",
                model="Vitz",
                period_year=2026,
                period_month=3,
                avg_price_lkr=7_000_000,
                median_price_lkr=6_900_000,
                listing_count=12,
            ),
            PriceAggregate(
                make="Toyota",
                model="Vitz",
                period_year=2026,
                period_month=4,
                avg_price_lkr=7_200_000,
                median_price_lkr=7_100_000,
                listing_count=14,
            ),
        ]
    )
    db.commit()

    payload = stats.get_price_trends(make="Toyota", model="Vitz", district="Kandy", db=db)

    assert payload["coverage_scope"] == "district_fallback"
    assert "Sri Lanka-wide" in payload["coverage_note"]
    assert [point["month"] for point in payload["points"]] == [3, 4]
