"""Tests for /stats/make-insight programmatic SEO hub endpoint."""

import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import stats
from db.models import Base, CarListing

_NOW = datetime(2026, 7, 20, 12, 0, tzinfo=timezone.utc)


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def test_make_insight_aggregates_models_and_districts():
    db = _session()
    for model, district, price in (
        ("Aqua", "Colombo", 5_500_000),
        ("Aqua", "Gampaha", 5_200_000),
        ("Prius", "Colombo", 8_000_000),
        ("Vitz", "Kandy", 4_100_000),
    ):
        db.add(
            CarListing(
                source="ikman",
                source_id=f"toyota-{model}-{district}-{price}",
                scraped_at=_NOW,
                first_seen_at=_NOW,
                last_seen_at=_NOW,
                make="Toyota",
                model=model,
                year=2018,
                price_lkr=price,
                district=district,
                is_outlier=False,
                is_active=True,
                is_duplicate=False,
            )
        )
    db.commit()

    data = stats.get_make_insight(make="toyota", db=db)
    assert data["make"] == "Toyota"
    assert data["total"] == 4
    assert data["avg_price_lkr"] is not None
    assert data["top_models"][0]["model"] == "Aqua"
    assert data["top_models"][0]["count"] == 2
    assert any(d["district"] == "Colombo" for d in data["top_districts"])
