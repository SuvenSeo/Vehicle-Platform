"""Cache-invalidation behaviour for market_stats_cache (additive, B2-E).

Documents the AGENTS.md gotcha: aggregate endpoints
(``/stats/summary``, ``/stats/district-prices``, ``/stats/district-velocity``)
serve the cached payload while it is fresh even after the underlying
``car_listings`` rows change. Only after the per-key TTL expires
(summary 15 min, district keys 1 h) does the endpoint recompute live.

These tests pin that stale-while-fresh behaviour so a future
invalidation change fails loudly instead of silently shifting numbers.
"""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import stats as stats_module  # noqa: E402
from app.utils.stats_cache import (  # noqa: E402
    get_cached_district_prices,
    get_cached_district_velocity,
    get_cached_summary,
)
from db.models import Base, CarListing, MarketStatsCache  # noqa: E402


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _listing(source_id: str, price_lkr: int, district: str = "Colombo") -> CarListing:
    now = datetime(2026, 4, 19, 10, 0, tzinfo=timezone.utc)
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
        deal_score=5.0,
        district=district,
        city=district,
        title=f"Toyota Vitz {source_id}",
        url=f"https://example.com/{source_id}",
        is_outlier=False,
    )


def _expire_key(db, cache_key: str) -> None:
    """Backdate a cache entry past every per-key TTL to force recompute."""
    entry = db.query(MarketStatsCache).filter_by(cache_key=cache_key).first()
    assert entry is not None, f"expected warm cache for {cache_key}"
    entry.refreshed_at = datetime.now(timezone.utc) - timedelta(days=2)
    db.commit()


def _colombo_count(points) -> int | None:
    for point in points:
        district = point["district"] if isinstance(point, dict) else point.district
        if district == "Colombo":
            return point["count"] if isinstance(point, dict) else point.listing_count
    return None


def test_summary_serves_stale_cached_total_after_listing_insert():
    db = _session()
    db.add(_listing("inv-1", 7_000_000))
    db.commit()

    assert stats_module.get_stats_summary(db=db).total_listings == 1

    # Listing edit while the cache entry is fresh: endpoint keeps old payload.
    db.add(_listing("inv-2", 8_000_000))
    db.commit()
    assert stats_module.get_stats_summary(db=db).total_listings == 1
    assert get_cached_summary(db, allow_stale=False) is not None

    # After TTL expiry the endpoint recomputes and sees the new row.
    _expire_key(db, "summary")
    assert get_cached_summary(db, allow_stale=False) is None
    assert stats_module.get_stats_summary(db=db).total_listings == 2


def test_district_prices_serves_stale_points_after_listing_insert():
    db = _session()
    db.add(_listing("inv-d1", 7_000_000))
    db.commit()

    first = stats_module.get_district_prices(db=db)
    assert _colombo_count(first["points"]) == 1

    db.add(_listing("inv-d2", 8_000_000))
    db.commit()
    second = stats_module.get_district_prices(db=db)
    assert _colombo_count(second["points"]) == 1
    assert get_cached_district_prices(db, allow_stale=False) is not None

    _expire_key(db, "district_prices")
    assert get_cached_district_prices(db, allow_stale=False) is None
    third = stats_module.get_district_prices(db=db)
    assert _colombo_count(third["points"]) == 2


def test_district_velocity_serves_stale_points_after_listing_insert():
    db = _session()
    db.add(_listing("inv-v1", 7_000_000))
    db.commit()

    first = stats_module.get_district_velocity(db=db)
    assert _colombo_count(first.points) == 1

    db.add(_listing("inv-v2", 8_000_000))
    db.commit()
    second = stats_module.get_district_velocity(db=db)
    assert _colombo_count(second.points) == 1
    assert get_cached_district_velocity(db, allow_stale=False) is not None

    _expire_key(db, "district_velocity")
    assert get_cached_district_velocity(db, allow_stale=False) is None
    third = stats_module.get_district_velocity(db=db)
    assert _colombo_count(third.points) == 2


def test_per_key_ttl_boundary_summary_15min_vs_district_1h():
    """Pins the TTL policy table: summary expires after 15 min, district keys after 1 h."""
    db = _session()
    db.add(_listing("inv-t1", 7_000_000))
    db.commit()

    stats_module.get_stats_summary(db=db)
    stats_module.get_district_prices(db=db)
    stats_module.get_district_velocity(db=db)

    twenty_min_ago = datetime.now(timezone.utc) - timedelta(minutes=20)
    for key in ("summary", "district_prices", "district_velocity"):
        entry = db.query(MarketStatsCache).filter_by(cache_key=key).first()
        assert entry is not None
        entry.refreshed_at = twenty_min_ago
    db.commit()

    # Summary (15 min TTL) is stale; district keys (1 h TTL) are still fresh.
    assert get_cached_summary(db, allow_stale=False) is None
    assert get_cached_district_prices(db, allow_stale=False) is not None
    assert get_cached_district_velocity(db, allow_stale=False) is not None
