"""Listing catalog export must sort by discovery time, not re-scrape time."""

import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

import export_public_snapshots as export
from db.models import Base, CarListing


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _listing(source_id: str, *, first_seen_at: datetime, scraped_at: datetime) -> CarListing:
    return CarListing(
        source="ikman",
        source_id=source_id,
        scraped_at=scraped_at,
        first_seen_at=first_seen_at,
        last_seen_at=scraped_at,
        make="Toyota",
        model="Aqua",
        year=2018,
        price_lkr=5_500_000,
        title=source_id,
        url=f"https://example.com/{source_id}",
        is_outlier=False,
        is_active=True,
    )


def test_build_listing_catalog_orders_by_first_seen_not_rescrape():
    db = _session()
    old_dealer = _listing(
        "dealer-stock",
        first_seen_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
        scraped_at=datetime(2026, 9, 9, 14, 45, tzinfo=timezone.utc),
    )
    new_ad = _listing(
        "fresh-ikman",
        first_seen_at=datetime(2026, 9, 9, 12, 0, tzinfo=timezone.utc),
        scraped_at=datetime(2026, 9, 9, 12, 1, tzinfo=timezone.utc),
    )
    db.add_all([old_dealer, new_ad])
    db.commit()

    catalog = export.build_listing_catalog(db)
    assert [row["source_id"] for row in catalog] == ["fresh-ikman", "dealer-stock"]
