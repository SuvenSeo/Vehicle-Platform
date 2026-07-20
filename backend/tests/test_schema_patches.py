import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import Column, Integer, MetaData, String, Table, Text, create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import listings
from db.schema_patches import (
    _INDEX_PATCHES,
    _create_index_sql,
    apply_schema_patches,
)


def test_apply_schema_patches_adds_thumbnail_column_to_legacy_table():
    engine = create_engine("sqlite:///:memory:")
    metadata = MetaData()
    Table(
        "car_listings",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("source", String(20), nullable=False),
        Column("title", Text),
    )
    metadata.create_all(bind=engine)

    apply_schema_patches(engine)

    with engine.connect() as conn:
        row = conn.exec_driver_sql("PRAGMA table_info(car_listings)").fetchall()
    column_names = {item[1] for item in row}
    assert "thumbnail_url_cached" in column_names


def test_create_index_sql_uses_if_not_exists_without_concurrently():
    sql = _create_index_sql(
        "idx_car_listings_active_outlier_district",
        "car_listings",
        "is_active, is_outlier, district",
    )
    assert sql == (
        "CREATE INDEX IF NOT EXISTS idx_car_listings_active_outlier_district "
        "ON car_listings (is_active, is_outlier, district)"
    )
    assert "CONCURRENTLY" not in sql
    for index_name, table_name, columns in _INDEX_PATCHES:
        patch_sql = _create_index_sql(index_name, table_name, columns)
        assert "IF NOT EXISTS" in patch_sql
        assert "CONCURRENTLY" not in patch_sql


def test_index_patches_are_idempotent_on_sqlite():
    from db.models import Base

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)

    apply_schema_patches(engine)
    apply_schema_patches(engine)  # second pass must not raise

    with engine.connect() as conn:
        listing_indexes = {
            row[1]
            for row in conn.exec_driver_sql("PRAGMA index_list('car_listings')")
        }
        scrape_indexes = {
            row[1]
            for row in conn.exec_driver_sql("PRAGMA index_list('scrape_runs')")
        }

    assert "idx_car_listings_active_outlier_district" in listing_indexes
    assert "idx_scrape_runs_started_at" in scrape_indexes
    assert "idx_scrape_runs_source_started_at" in scrape_indexes


def test_search_listings_count_uses_id_only_subquery():
    from db.models import Base, CarListing

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    now = datetime(2026, 7, 13, tzinfo=timezone.utc)
    db.add(
        CarListing(
            source="ikman",
            source_id="legacy-1",
            scraped_at=now,
            first_seen_at=now,
            last_seen_at=now,
            title=None,
            url="https://example.com/legacy-1",
            make="Toyota",
            model="Vitz",
            year=2018,
            price_lkr=7_200_000,
            is_outlier=False,
        )
    )
    db.commit()

    payload = listings.search_listings(page=1, size=10, db=db)
    db.close()

    assert payload.total == 1
    assert payload.items[0].title is None
