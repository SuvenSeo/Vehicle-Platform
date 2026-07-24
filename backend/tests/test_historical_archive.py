from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.services.historical_archive import (
    CdxHit,
    parse_ikman_serp_html,
    parse_wayback_timestamp,
    upsert_historical_observations,
)
from db.models import Base, HistoricalPriceObservation

FIXTURE = (
    Path(__file__).parent
    / "fixtures"
    / "historical"
    / "ikman_cars_category_20170107_snippet.html"
)


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def test_parse_wayback_timestamp_is_utc():
    observed = parse_wayback_timestamp("20170107165014")
    assert observed == datetime(2017, 1, 7, 16, 50, 14, tzinfo=timezone.utc)


def test_parse_ikman_serp_html_extracts_priced_listings():
    html = FIXTURE.read_text(encoding="utf-8", errors="ignore")
    observed = datetime(2017, 1, 7, 16, 50, 14, tzinfo=timezone.utc)
    rows = parse_ikman_serp_html(
        html,
        observed_at=observed,
        snapshot_url="https://web.archive.org/web/20170107165014id_/http://ikman.lk/en/ads/sri-lanka/cars",
    )

    assert len(rows) >= 10
    by_title = {row["title"]: row for row in rows}

    allion = by_title.get("Toyota Allion NZT260 G 2014")
    assert allion is not None
    assert allion["price_lkr"] == 4_500_000
    assert allion["year"] == 2014
    assert allion["make"] == "Toyota"
    assert allion["mileage"] == 10_000
    assert allion["district"] == "Colombo"
    assert allion["observed_at"] == observed
    assert allion["archive_source"] == "wayback_ikman"

    vezel = by_title.get("Honda Vezel Z 2014")
    assert vezel is not None
    assert vezel["price_lkr"] == 5_695_000
    assert vezel["make"] == "Honda"


def test_upsert_historical_observations_is_idempotent(db_session):
    html = FIXTURE.read_text(encoding="utf-8", errors="ignore")
    observed = datetime(2017, 1, 7, 16, 50, 14, tzinfo=timezone.utc)
    rows = parse_ikman_serp_html(html, observed_at=observed)

    first = upsert_historical_observations(db_session, rows)
    second = upsert_historical_observations(db_session, rows)

    assert first["inserted"] == len(rows)
    assert second["inserted"] == 0
    assert second["skipped"] == len(rows)
    assert db_session.query(HistoricalPriceObservation).count() == len(rows)


def test_parse_ikman_initial_data_serp():
    html = (
        Path(__file__).parent
        / "fixtures"
        / "historical"
        / "ikman_cars_initialdata_20230504_snippet.html"
    ).read_text(encoding="utf-8")
    observed = datetime(2023, 5, 4, 2, 25, 10, tzinfo=timezone.utc)
    rows = parse_ikman_serp_html(html, observed_at=observed)
    assert len(rows) >= 5
    assert any(row["price_lkr"] and row["price_lkr"] > 1_000_000 for row in rows)
    assert any(row.get("make") == "Toyota" for row in rows)

    hit = CdxHit(
        timestamp="20170107165014",
        original="http://ikman.lk/en/ads/sri-lanka/cars",
    )
    assert "20170107165014id_" in hit.raw_url
    assert hit.observed_at.year == 2017


def test_dense_serp_profile_covers_brands_models_and_riyasewana():
    from app.services.historical_archive import dense_serp_urls, serp_urls_for_profile

    dense = dense_serp_urls(include_riyasewana=True)
    assert any("/toyota/aqua" in u for u in dense)
    assert any("/mitsubishi" in u for u in dense)
    assert any("riyasewana.com" in u for u in dense)
    assert len(dense) >= 40
    assert serp_urls_for_profile("brands") == serp_urls_for_profile("top")
    assert len(serp_urls_for_profile("brands")) == 4


def test_parse_riyasewana_serp_html():
    from app.services.historical_archive import parse_archive_serp_html, parse_riyasewana_serp_html

    html = (
        Path(__file__).parent
        / "fixtures"
        / "historical"
        / "riyasewana_cars_20190320_snippet.html"
    ).read_text(encoding="utf-8")
    observed = datetime(2019, 3, 20, 23, 29, 51, tzinfo=timezone.utc)
    rows = parse_riyasewana_serp_html(html, observed_at=observed)
    assert len(rows) >= 3
    assert all(row["archive_source"] == "wayback_riyasewana" for row in rows)
    assert all(row["price_lkr"] and row["price_lkr"] > 100_000 for row in rows)
    assert any(row.get("make") == "Toyota" for row in rows)

    dispatched = parse_archive_serp_html(
        html,
        observed_at=observed,
        original_url="https://riyasewana.com/search/cars",
    )
    assert len(dispatched) == len(rows)


def test_year_windows_cover_range():
    from app.services.historical_archive import _year_windows

    windows = _year_windows("20170101", "20191231")
    assert windows[0][0].startswith("2017")
    assert windows[-1][0].startswith("2019")
    assert len(windows) == 3
