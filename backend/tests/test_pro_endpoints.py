import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import pro
from db.models import Base, CarListing


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


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
