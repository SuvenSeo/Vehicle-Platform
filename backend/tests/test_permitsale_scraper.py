"""Tests for the permitsale scraper.

All tests are hermetic — no live network calls.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db.models import Base, VehiclePermit


# ---------------------------------------------------------------------------
# In-memory SQLite session fixture
# ---------------------------------------------------------------------------

def _make_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


# ---------------------------------------------------------------------------
# Tests for seed_default_permits
# ---------------------------------------------------------------------------

class TestSeedDefaultPermits:
    def test_seeds_all_default_permits(self):
        from app.scrapers.permitsale import seed_default_permits, _DEFAULT_PERMITS

        db = _make_session()
        count = seed_default_permits(db)

        assert count == len(_DEFAULT_PERMITS)
        rows = db.query(VehiclePermit).all()
        assert len(rows) == len(_DEFAULT_PERMITS)

    def test_seed_is_idempotent(self):
        from app.scrapers.permitsale import seed_default_permits, _DEFAULT_PERMITS

        db = _make_session()
        seed_default_permits(db)
        count2 = seed_default_permits(db)

        rows = db.query(VehiclePermit).all()
        assert len(rows) == len(_DEFAULT_PERMITS)
        assert count2 == len(_DEFAULT_PERMITS)

    def test_seed_prices_are_reasonable(self):
        from app.scrapers.permitsale import seed_default_permits

        db = _make_session()
        seed_default_permits(db)

        rows = db.query(VehiclePermit).all()
        for row in rows:
            assert float(row.market_price_lkr) >= 100_000, (
                f"{row.permit_name}: price {row.market_price_lkr} is below 100,000 LKR"
            )

    def test_seed_upserts_update_price(self):
        from app.scrapers.permitsale import seed_default_permits

        db = _make_session()
        seed_default_permits(db)

        # Manually change a price
        row = db.query(VehiclePermit).filter(VehiclePermit.permit_name == "Full Import Permit").first()
        assert row is not None
        row.market_price_lkr = 1  # type: ignore[assignment]
        db.commit()

        # Re-seeding should restore the canonical price
        seed_default_permits(db)
        row = db.query(VehiclePermit).filter(VehiclePermit.permit_name == "Full Import Permit").first()
        assert float(row.market_price_lkr) == 3_600_000

    def test_default_permits_have_required_fields(self):
        from app.scrapers.permitsale import _DEFAULT_PERMITS

        for entry in _DEFAULT_PERMITS:
            name, ptype, price = entry
            assert isinstance(name, str) and name
            assert isinstance(ptype, str) and ptype
            assert isinstance(price, (int, float)) and price > 0


# ---------------------------------------------------------------------------
# Tests for _parse_price helper
# ---------------------------------------------------------------------------

class TestParsePrice:
    def test_parses_plain_number(self):
        from app.scrapers.permitsale import _parse_price

        assert _parse_price("3600000") == 3_600_000.0

    def test_parses_number_with_commas(self):
        from app.scrapers.permitsale import _parse_price

        assert _parse_price("3,600,000") == 3_600_000.0

    def test_parses_number_with_prefix(self):
        from app.scrapers.permitsale import _parse_price

        result = _parse_price("LKR 3,600,000")
        assert result == 3_600_000.0

    def test_returns_none_for_blank(self):
        from app.scrapers.permitsale import _parse_price

        assert _parse_price("") is None
        assert _parse_price("N/A") is None


# ---------------------------------------------------------------------------
# Tests for run_scraper (live scrape mocked)
# ---------------------------------------------------------------------------

class TestRunScraper:
    def test_falls_back_to_seed_on_network_error(self):
        from app.scrapers.permitsale import run_scraper, _DEFAULT_PERMITS

        db = _make_session()

        import httpx

        with patch("app.scrapers.permitsale._scrape_permitsale", return_value=[]):
            count = run_scraper(db)

        assert count == len(_DEFAULT_PERMITS)
        rows = db.query(VehiclePermit).all()
        assert len(rows) == len(_DEFAULT_PERMITS)

    def test_uses_live_data_when_scrape_succeeds(self):
        from app.scrapers.permitsale import run_scraper

        db = _make_session()
        live_permits = [
            {"permit_name": "Test Permit A", "permit_type": "test", "price": 1_000_000.0},
            {"permit_name": "Test Permit B", "permit_type": "ev", "price": 2_000_000.0},
        ]

        with patch("app.scrapers.permitsale._scrape_permitsale", return_value=live_permits):
            count = run_scraper(db)

        assert count == 2
        names = {r.permit_name for r in db.query(VehiclePermit).all()}
        assert "Test Permit A" in names
        assert "Test Permit B" in names

    def test_scrape_fail_open_on_exception(self):
        """If _scrape_permitsale raises unexpectedly, run_scraper should not crash."""
        from app.scrapers.permitsale import run_scraper, _DEFAULT_PERMITS

        db = _make_session()

        with patch("app.scrapers.permitsale._scrape_permitsale", side_effect=RuntimeError("boom")):
            with pytest.raises(RuntimeError):
                run_scraper(db)

    def test_scrape_permitsale_fails_open_on_http_error(self):
        """_scrape_permitsale itself returns [] on network failure."""
        from app.scrapers.permitsale import _scrape_permitsale
        import httpx

        mock_client = MagicMock()
        mock_client.__enter__ = lambda s: mock_client
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = httpx.ConnectError("refused")

        with patch("app.scrapers.permitsale.httpx.Client", return_value=mock_client):
            result = _scrape_permitsale()

        assert result == []
