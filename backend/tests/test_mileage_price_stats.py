import sys
from datetime import datetime, timezone
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


_NOW = datetime(2026, 7, 29, 10, 0, tzinfo=timezone.utc)


def _listing(
    source_id: str,
    *,
    make: str = "Toyota",
    model: str = "Aqua",
    year: int | None = 2018,
    mileage: int | None = 45_000,
    price_lkr: int | None = 7_500_000,
    is_outlier: bool = False,
    is_active: bool = True,
) -> CarListing:
    return CarListing(
        source="ikman",
        source_id=source_id,
        scraped_at=_NOW,
        first_seen_at=_NOW,
        last_seen_at=_NOW,
        make=make,
        model=model,
        year=year,
        price_lkr=price_lkr,
        mileage=mileage,
        deal_score=5.0,
        district="Colombo",
        city="Colombo",
        title=f"{make} {model} {source_id}",
        url=f"https://example.com/{source_id}",
        is_outlier=is_outlier,
        is_active=is_active,
    )


def test_mileage_price_scatter_filters_live_priced_mileage_rows():
    db = _session()
    db.add_all(
        [
            _listing("valid-1", year=2019, mileage=35_000, price_lkr=8_000_000),
            _listing("valid-2", year=2020, mileage=52_000, price_lkr=7_800_000),
            _listing("missing-mileage", mileage=None, price_lkr=7_200_000),
            _listing("missing-price", mileage=42_000, price_lkr=None),
            _listing("tiny-price", mileage=42_000, price_lkr=64_000),
            _listing("outlier", mileage=42_000, price_lkr=7_200_000, is_outlier=True),
            _listing("inactive", mileage=42_000, price_lkr=7_200_000, is_active=False),
            _listing("other-make", make="Honda", model="Fit", year=2019, mileage=28_000, price_lkr=8_600_000),
        ]
    )
    db.commit()

    result = stats.get_mileage_price_scatter(
        make=" toyota ",
        model="AQUA",
        year_min=2019,
        year_max=2020,
        limit=10,
        db=db,
    )

    assert result["sample_size"] == 2
    assert result["make"] == "toyota"
    assert result["model"] == "AQUA"
    assert {point["id"] for point in result["points"]} == {1, 2}
    by_id = {point["id"]: point for point in result["points"]}
    assert by_id[1]["mileage_km"] == 35_000
    assert by_id[1]["price_lkr"] == 8_000_000


def test_mileage_price_scatter_caps_limit():
    db = _session()
    db.add_all([_listing(f"valid-{idx}", mileage=10_000 + idx) for idx in range(3)])
    db.commit()

    result = stats.get_mileage_price_scatter(limit=2, db=db)

    assert result["sample_size"] == 2
    assert len(result["points"]) == 2
