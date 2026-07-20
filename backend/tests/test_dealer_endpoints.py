import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import dealer
from app.api.v1.endpoints.dealer import _parse_vehicle_from_url, _market_benchmark
from db.models import Base, CarListing
from db.session import get_db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine


def _session(engine=None):
    if engine is None:
        engine = _engine()
    Session = sessionmaker(bind=engine)
    return Session()


def _listing(
    source_id: str,
    *,
    make: str = "Toyota",
    model: str = "Vitz",
    year: int = 2018,
    price_lkr: float | None = 7_200_000,
    district: str = "Colombo",
    source: str = "ikman",
    is_outlier: bool = False,
    url: str | None = None,
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
        year=year,
        price_lkr=price_lkr,
        district=district,
        city=district,
        title=f"{make} {model} {source_id}",
        url=url or f"https://example.com/{source_id}",
        is_outlier=is_outlier,
    )


# ---------------------------------------------------------------------------
# URL parsing unit tests
# ---------------------------------------------------------------------------

class TestParseVehicleFromUrl:
    def test_ikman_style_url(self):
        url = "https://ikman.lk/en/ad/toyota-vitz-2018-for-sale-colombo/123456"
        make, model, year = _parse_vehicle_from_url(url)
        assert make == "Toyota"
        assert model is not None and "Vitz" in model
        assert year == 2018

    def test_riyasewana_style_url(self):
        url = "https://riyasewana.com/listing/honda-civic-2016-190000"
        make, model, year = _parse_vehicle_from_url(url)
        assert make == "Honda"
        assert model is not None and "Civic" in model
        assert year == 2016

    def test_bmw_with_series_number(self):
        url = "https://ikman.lk/en/ad/bmw-320i-2015-for-sale-gampaha/999"
        make, model, year = _parse_vehicle_from_url(url)
        assert make == "BMW"
        assert year == 2015

    def test_nissan_url(self):
        url = "https://autolanka.com/ad/nissan-x-trail-2019-99999"
        make, model, year = _parse_vehicle_from_url(url)
        assert make == "Nissan"
        assert year == 2019

    def test_unknown_make_returns_none(self):
        url = "https://example.com/ad/unknown-brand-xyz-2020"
        make, model, year = _parse_vehicle_from_url(url)
        assert make is None

    def test_mitsubishi_url(self):
        url = "https://ikman.lk/en/ad/mitsubishi-montero-2014-for-sale-kandy/888"
        make, model, year = _parse_vehicle_from_url(url)
        assert make == "Mitsubishi"
        assert year == 2014

    def test_no_year_in_url(self):
        url = "https://ikman.lk/en/ad/suzuki-alto-for-sale/777"
        make, model, year = _parse_vehicle_from_url(url)
        assert make == "Suzuki"
        assert year is None

    def test_hyundai_url(self):
        url = "https://riyasewana.com/listing/hyundai-accent-2020-55555"
        make, model, year = _parse_vehicle_from_url(url)
        assert make == "Hyundai"
        assert year == 2020


# ---------------------------------------------------------------------------
# _market_benchmark unit tests
# ---------------------------------------------------------------------------

class TestMarketBenchmark:
    def test_returns_median_for_known_make_model(self):
        db = _session()
        db.add_all([
            _listing("a", price_lkr=6_000_000),
            _listing("b", price_lkr=7_000_000),
            _listing("c", price_lkr=8_000_000),
        ])
        db.commit()

        market_median, price_gap_pct, comparable_count = _market_benchmark(
            db, "Toyota", "Vitz", 2018, listing_price=7_000_000
        )
        assert market_median == 7_000_000.0
        assert price_gap_pct == pytest.approx(0.0, abs=0.1)
        assert comparable_count == 3

    def test_price_gap_below_market(self):
        db = _session()
        db.add_all([
            _listing("a", price_lkr=10_000_000),
            _listing("b", price_lkr=10_000_000),
        ])
        db.commit()

        _, price_gap_pct, _ = _market_benchmark(
            db, "Toyota", "Vitz", 2018, listing_price=9_000_000
        )
        assert price_gap_pct == pytest.approx(-10.0, abs=0.1)

    def test_no_listing_price_returns_none_gap(self):
        db = _session()
        db.add(_listing("a", price_lkr=7_000_000))
        db.commit()

        _, price_gap_pct, _ = _market_benchmark(db, "Toyota", "Vitz", 2018, listing_price=None)
        assert price_gap_pct is None

    def test_excludes_outliers(self):
        db = _session()
        db.add_all([
            _listing("good", price_lkr=7_000_000),
            _listing("outlier", price_lkr=7_000_000, is_outlier=True),
        ])
        db.commit()

        _, _, comparable_count = _market_benchmark(db, "Toyota", "Vitz", 2018, None)
        assert comparable_count == 1

    def test_excludes_below_minimum_price(self):
        db = _session()
        db.add_all([
            _listing("valid", price_lkr=7_000_000),
            _listing("tiny", price_lkr=50_000),
        ])
        db.commit()

        _, _, comparable_count = _market_benchmark(db, "Toyota", "Vitz", 2018, None)
        assert comparable_count == 1

    def test_unknown_make_returns_zeros(self):
        db = _session()
        market_median, price_gap_pct, comparable_count = _market_benchmark(
            db, None, None, None, None
        )
        assert market_median is None
        assert price_gap_pct is None
        assert comparable_count == 0

    def test_year_window_applied(self):
        db = _session()
        db.add_all([
            _listing("in-range", year=2017, price_lkr=7_000_000),
            _listing("out-range", year=2010, price_lkr=3_000_000),
        ])
        db.commit()

        _, _, comparable_count = _market_benchmark(db, "Toyota", "Vitz", 2018, None)
        assert comparable_count == 1


# ---------------------------------------------------------------------------
# Integration tests via FastAPI TestClient
# ---------------------------------------------------------------------------

def _make_app(db_session):
    """Build a minimal FastAPI app wired to the given in-memory DB session."""
    from fastapi import FastAPI
    from app.api.v1.endpoints.dealer import router

    test_app = FastAPI()
    test_app.include_router(router, prefix="/dealer")

    def override_get_db():
        yield db_session

    from db.session import get_db as _get_db  # noqa: PLC0415
    test_app.dependency_overrides[_get_db] = override_get_db
    return test_app


class TestBenchmarkUrlsEndpoint:
    def _client(self, *listings):
        db = _session()
        db.add_all(list(listings))
        db.commit()
        app = _make_app(db)
        return TestClient(app), db

    def test_empty_urls_returns_empty_list(self):
        client, _ = self._client()
        resp = client.post("/dealer/benchmark-urls", json={"urls": []})
        assert resp.status_code == 200
        assert resp.json() == []

    def test_url_with_db_match_returns_listing_data(self):
        listing = _listing("match-1", url="https://ikman.lk/en/ad/toyota-vitz-2018/123", price_lkr=7_000_000)
        client, _ = self._client(
            listing,
            _listing("comp-1", price_lkr=7_000_000),
            _listing("comp-2", price_lkr=8_000_000),
        )
        resp = client.post(
            "/dealer/benchmark-urls",
            json={"urls": ["https://ikman.lk/en/ad/toyota-vitz-2018/123"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        row = data[0]
        assert row["make"] == "Toyota"
        assert row["listing_price"] == pytest.approx(7_000_000)
        assert row["market_median"] is not None
        assert row["comparable_count"] >= 1

    def test_url_without_db_match_uses_slug_parse(self):
        client, _ = self._client(
            _listing("c1", make="Honda", model="Civic", year=2016, price_lkr=9_000_000),
            _listing("c2", make="Honda", model="Civic", year=2017, price_lkr=10_000_000),
        )
        resp = client.post(
            "/dealer/benchmark-urls",
            json={"urls": ["https://riyasewana.com/listing/honda-civic-2016-9999"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        row = data[0]
        assert row["make"] == "Honda"
        assert row["market_median"] is not None
        assert row["comparable_count"] >= 1

    def test_unrecognised_url_returns_error_field(self):
        client, _ = self._client()
        resp = client.post(
            "/dealer/benchmark-urls",
            json={"urls": ["https://example.com/some-mystery-page"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data[0]["error"] is not None
        assert data[0]["make"] is None

    def test_multiple_urls_batched(self):
        client, _ = self._client(
            _listing("v1", make="Toyota", model="Vitz", price_lkr=7_200_000),
            _listing("h1", make="Honda", model="Fit", price_lkr=6_000_000),
        )
        resp = client.post(
            "/dealer/benchmark-urls",
            json={
                "urls": [
                    "https://ikman.lk/en/ad/toyota-vitz-2018-for-sale/1",
                    "https://ikman.lk/en/ad/honda-fit-2017-for-sale/2",
                ]
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

    def test_exceeding_max_urls_returns_422(self):
        client, _ = self._client()
        urls = [f"https://example.com/{i}" for i in range(51)]
        resp = client.post("/dealer/benchmark-urls", json={"urls": urls})
        assert resp.status_code == 422

    def test_blank_lines_are_stripped(self):
        client, _ = self._client()
        resp = client.post(
            "/dealer/benchmark-urls",
            json={"urls": ["", "  ", ""]},
        )
        assert resp.status_code == 200
        assert resp.json() == []

    def test_exceeding_rate_limit_returns_429(self):
        client, _ = self._client()
        original_max = dealer._dealer_rate_limiter.max_requests
        dealer._dealer_rate_limiter.max_requests = 2
        dealer._dealer_rate_limiter._buckets.clear()
        try:
            for _ in range(2):
                resp = client.post("/dealer/benchmark-urls", json={"urls": []})
                assert resp.status_code == 200
            resp = client.post("/dealer/benchmark-urls", json={"urls": []})
            assert resp.status_code == 429
        finally:
            dealer._dealer_rate_limiter.max_requests = original_max
            dealer._dealer_rate_limiter._buckets.clear()
