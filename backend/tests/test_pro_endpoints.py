import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import pro
from db.models import Base, CarListing


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _session_with_query_counter():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    counter = {"count": 0}

    @event.listens_for(engine, "before_cursor_execute")
    def _count(conn, cursor, statement, parameters, context, executemany):
        counter["count"] += 1

    return Session(), counter


def _listing(
    source_id: str,
    *,
    make: str = "Toyota",
    model: str = "Vitz",
    price_lkr: int | None = 7_200_000,
    district: str = "Colombo",
    source: str = "ikman",
    condition: str = "used",
    deal_score: float = 8.4,
    is_outlier: bool = False,
) -> CarListing:
    now = datetime(2026, 5, 20, 9, 0, tzinfo=timezone.utc)
    return CarListing(
        source=source,
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
        condition=condition,
        title=f"{make} {model} {source_id}",
        url=f"https://example.com/{source_id}",
        is_outlier=is_outlier,
    )


def test_pro_vehicle_lanes_exclude_invalid_tiny_and_outlier_prices():
    db = _session()
    db.add_all(
        [
            _listing("valid-vitz", price_lkr=7_200_000),
            _listing("tiny-vitz", price_lkr=42_000, deal_score=21),
            _listing("missing-vitz", price_lkr=None, deal_score=19),
            _listing("outlier-fit", make="Honda", model="Fit", price_lkr=8_500_000, is_outlier=True),
        ]
    )
    db.commit()

    lanes = pro.get_pro_vehicle_lanes(db=db)

    assert len(lanes) == 1
    assert lanes[0].make == "Toyota"
    assert lanes[0].model == "Vitz"
    assert lanes[0].listing_count == 1
    assert lanes[0].min_price_lkr == 7_200_000


def test_pro_district_detail_returns_models_source_mix_and_samples():
    db = _session()
    db.add_all(
        [
            _listing("cmb-vitz-1", price_lkr=7_200_000, district="Colombo", source="ikman"),
            _listing("cmb-vitz-2", price_lkr=7_400_000, district="Colombo", source="riyasewana"),
            _listing("cmb-fit-1", make="Honda", model="Fit", price_lkr=8_800_000, district="Colombo", source="ikman"),
            _listing("gmp-aqua-1", make="Toyota", model="Aqua", price_lkr=8_100_000, district="Gampaha"),
        ]
    )
    db.commit()

    detail = pro.get_pro_district_detail("Colombo", db=db)

    assert detail.kind == "district"
    assert detail.title == "Colombo market profile"
    assert "Toyota Vitz" in detail.summary
    assert {point.label for point in detail.source_mix} == {"Ikman", "Riyasewana"}
    assert len(detail.sample_listings) == 3


def test_pro_arbitrage_gaps_returns_top_pairs_sorted_by_gap():
    db = _session()
    db.add_all(
        [
            _listing("cmb-1", price_lkr=7_200_000, district="Colombo"),
            _listing("cmb-2", price_lkr=7_400_000, district="Colombo"),
            _listing("knd-1", price_lkr=6_200_000, district="Kandy"),
            _listing("knd-2", price_lkr=6_000_000, district="Kandy"),
            _listing("gmp-1", price_lkr=7_800_000, district="Gampaha"),
            _listing("gmp-2", price_lkr=7_900_000, district="Gampaha"),
        ]
    )
    db.commit()

    gaps = pro.get_pro_arbitrage_gaps(make="Toyota", model="Vitz", db=db)

    assert len(gaps) >= 1
    assert gaps[0].gap_pct >= gaps[-1].gap_pct, "gaps must be sorted descending by gap_pct"
    gap_districts = [(g.buy_district, g.sell_district) for g in gaps]
    assert all(
        g.buy_median_lkr <= g.sell_median_lkr for g in gaps
    ), "buy_median must always be <= sell_median"
    assert all(
        g.buy_district != g.sell_district for g in gaps
    ), "buy and sell districts must differ"
    assert ("Kandy", "Gampaha") in gap_districts


def test_pro_arbitrage_gaps_requires_min_two_listings_per_district():
    db = _session()
    db.add_all(
        [
            _listing("cmb-1", price_lkr=7_200_000, district="Colombo"),
            _listing("cmb-2", price_lkr=7_400_000, district="Colombo"),
            _listing("knd-only", price_lkr=5_500_000, district="Kandy"),
        ]
    )
    db.commit()

    gaps = pro.get_pro_arbitrage_gaps(make="Toyota", model="Vitz", db=db)

    assert gaps == [], "single-listing district should be excluded from gap calculation"


def test_pro_arbitrage_gaps_limit_caps_results():
    db = _session()
    districts = ["Colombo", "Kandy", "Gampaha", "Galle", "Kurunegala"]
    for i, district in enumerate(districts):
        base_price = 5_000_000 + i * 500_000
        db.add_all(
            [
                _listing(f"{district}-a", price_lkr=base_price, district=district),
                _listing(f"{district}-b", price_lkr=base_price + 100_000, district=district),
            ]
        )
    db.commit()

    gaps = pro.get_pro_arbitrage_gaps(make="Toyota", model="Vitz", limit=3, db=db)

    assert len(gaps) <= 3


def test_pro_arbitrage_gaps_excludes_outliers_and_low_prices():
    db = _session()
    db.add_all(
        [
            _listing("cmb-valid", price_lkr=7_200_000, district="Colombo"),
            _listing("cmb-valid-2", price_lkr=7_400_000, district="Colombo"),
            _listing("knd-outlier", price_lkr=6_000_000, district="Kandy", is_outlier=True),
            _listing("knd-cheap", price_lkr=50_000, district="Kandy"),
        ]
    )
    db.commit()

    gaps = pro.get_pro_arbitrage_gaps(make="Toyota", model="Vitz", db=db)

    assert gaps == [], "Kandy district dropped — outlier and cheap listing both excluded"


def test_pro_vehicle_lane_detail_respects_vehicle_district_and_condition_filters():
    db = _session()
    db.add_all(
        [
            _listing("target", make="Toyota", model="Vitz", district="Colombo", condition="used"),
            _listing("wrong-district", make="Toyota", model="Vitz", district="Kandy", condition="used"),
            _listing("wrong-condition", make="Toyota", model="Vitz", district="Colombo", condition="reconditioned"),
            _listing("wrong-model", make="Toyota", model="Aqua", district="Colombo", condition="used"),
        ]
    )
    db.commit()

    detail = pro.get_pro_vehicle_lane_detail(
        make="Toyota",
        model="Vitz",
        district="Colombo",
        condition="used",
        db=db,
    )

    assert detail.kind == "vehicle_lane"
    assert detail.summary.startswith("1 priced listings")
    assert len(detail.sample_listings) == 1
    assert detail.sample_listings[0].title == "Toyota Vitz target"


# ---------------------------------------------------------------------------
# Bulk district / vehicle-lane query-count regression tests
#
# get_pro_districts and get_pro_vehicle_lanes previously issued 3-4 extra
# queries per row returned (per-district / per-lane loops calling
# _top_models / _breakdown / _samples / _top_group_label). They now resolve
# top-make, source mix, and sample listings with a handful of bulk
# row_number()-windowed queries, so the query count must stay flat as the
# number of districts/lanes grows.
# ---------------------------------------------------------------------------

_SEEDED_DISTRICTS = ["Colombo", "Gampaha", "Kandy", "Galle", "Kurunegala", "Jaffna"]


def _seed_multi_district_listings(db):
    now = datetime(2026, 5, 20, 9, 0, tzinfo=timezone.utc)
    listings = []
    i = 0
    for district in _SEEDED_DISTRICTS:
        for make, model, price, source, score in [
            ("Toyota", "Vitz", 7_200_000, "ikman", 8.5),
            ("Toyota", "Vitz", 7_400_000, "riyasewana", 7.0),
            ("Honda", "Fit", 8_800_000, "ikman", 6.0),
        ]:
            listings.append(
                _listing(
                    f"{district}-{i}",
                    make=make,
                    model=model,
                    price_lkr=price,
                    district=district,
                    source=source,
                    deal_score=score,
                )
            )
            i += 1
    db.add_all(listings)
    db.commit()


def test_pro_districts_matches_manually_computed_values_across_multiple_districts():
    db = _session()
    _seed_multi_district_listings(db)

    profiles = pro.get_pro_districts(db=db)

    assert {p.district for p in profiles} == set(_SEEDED_DISTRICTS)
    for profile in profiles:
        assert profile.listing_count == 3
        assert profile.top_make == "Toyota"
        assert profile.top_model == "Vitz"
        assert [m.model for m in profile.top_models] == ["Vitz", "Fit"]
        assert {s.label for s in profile.source_mix} == {"Ikman", "Riyasewana"}
        assert len(profile.sample_listings) == 3
        # Median of [7_200_000, 7_400_000, 8_800_000]
        assert profile.median_price_lkr == 7_400_000


def test_pro_districts_query_count_stays_flat_as_district_count_grows():
    db, counter = _session_with_query_counter()
    _seed_multi_district_listings(db)
    counter["count"] = 0

    pro.get_pro_districts(db=db)

    # Bounded regardless of district count: 1 aggregate query + 4 bulk
    # lookups (top-models, source-mix, samples, median fallback on SQLite).
    assert counter["count"] <= 6, f"expected a flat, small query count, got {counter['count']}"


def test_pro_vehicle_lanes_query_count_stays_flat_as_lane_count_grows():
    db, counter = _session_with_query_counter()
    _seed_multi_district_listings(db)
    counter["count"] = 0

    lanes = pro.get_pro_vehicle_lanes(db=db)

    assert len(lanes) == 2  # Toyota Vitz, Honda Fit
    # Bounded regardless of lane count: 1 aggregate query + 3 bulk lookups
    # (top-district, top-source, median fallback on SQLite).
    assert counter["count"] <= 5, f"expected a flat, small query count, got {counter['count']}"
