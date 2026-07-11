import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import listings
from db.models import Base, CarListing


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _listing(source_id: str, *, days_ago: int, is_outlier: bool = False, is_duplicate: bool = False) -> CarListing:
    seen = datetime(2026, 7, 10, 9, 0, tzinfo=timezone.utc) - timedelta(days=days_ago)
    return CarListing(
        source="ikman",
        source_id=source_id,
        scraped_at=seen,
        first_seen_at=seen,
        last_seen_at=seen,
        make="Toyota",
        model="Vitz",
        year=2018,
        price_lkr=7_000_000,
        title=f"Toyota Vitz {source_id}",
        url=f"https://example.com/{source_id}",
        is_outlier=is_outlier,
        is_duplicate=is_duplicate,
    )


def test_sitemap_ids_returns_recent_clean_listings_first():
    db = _session()
    db.add_all(
        [
            _listing("old", days_ago=30),
            _listing("new", days_ago=1),
            _listing("outlier", days_ago=0, is_outlier=True),
            _listing("dupe", days_ago=0, is_duplicate=True),
        ]
    )
    db.commit()

    rows = listings.get_sitemap_listing_ids(limit=10, db=db)

    urls = {row["id"] for row in rows}
    by_source_id = {
        str(r.source_id): int(r.id)
        for r in db.query(CarListing).all()
    }
    assert by_source_id["new"] in urls
    assert by_source_id["old"] in urls
    assert by_source_id["outlier"] not in urls
    assert by_source_id["dupe"] not in urls
    # Most recently seen first.
    assert rows[0]["id"] == by_source_id["new"]
    assert all(row["last_seen_at"] for row in rows)


def test_sitemap_ids_respects_limit():
    db = _session()
    db.add_all([_listing(f"item-{i}", days_ago=i) for i in range(5)])
    db.commit()

    rows = listings.get_sitemap_listing_ids(limit=2, db=db)

    assert len(rows) == 2
