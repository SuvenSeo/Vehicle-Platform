"""Tests for the riyasewana scraper's Wayback-archive fallback."""

import asyncio
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.scrapers import riyasewana as riyasewana_module
from app.scrapers.riyasewana import RiyasewanaBlockedError, RiyasewanaScraper
from app.services.historical_archive import _normalize_riyasewana_href
from db.models import Base, CarListing

RIYA_FIXTURE = (
    Path(__file__).parent / "fixtures" / "historical" / "riyasewana_cars_20190320_snippet.html"
)


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def scraper(db_session):
    return RiyasewanaScraper(db=db_session)


class _FakeHit:
    def __init__(self, raw_url: str):
        self.raw_url = raw_url


async def _raise_blocked(*args, **kwargs):
    raise RiyasewanaBlockedError("riyasewana.com served a Cloudflare block page")


def test_archive_fallback_disabled_re_raises(monkeypatch, scraper):
    # Pin playwright mode so the block originates from the browser path.
    monkeypatch.setattr(riyasewana_module, "_DEFAULT_SCRAPE_MODE", "playwright")
    monkeypatch.setattr(riyasewana_module, "_archive_fallback_enabled", lambda: False)
    monkeypatch.setattr(scraper, "_scrape_live", _raise_blocked)

    with pytest.raises(RiyasewanaBlockedError):
        asyncio.run(scraper.scrape(max_pages=2))


def test_archive_fallback_routes_when_enabled(monkeypatch, scraper):
    # Pin playwright mode so the block originates from the browser path.
    monkeypatch.setattr(riyasewana_module, "_DEFAULT_SCRAPE_MODE", "playwright")
    monkeypatch.setattr(riyasewana_module, "_archive_fallback_enabled", lambda: True)
    monkeypatch.setattr(scraper, "_scrape_live", _raise_blocked)

    calls = {}

    def fake_fallback(max_pages: int = 5):
        calls["max_pages"] = max_pages
        return {
            "snapshot": "https://web.archive.org/web/0id_/http://riyasewana.com/search/cars",
            "inserted": 2,
        }

    monkeypatch.setattr(scraper, "_run_archive_fallback", fake_fallback)

    result = asyncio.run(scraper.scrape(max_pages=3))

    assert calls["max_pages"] == 3
    assert result["inserted"] == 2
    assert result["snapshot"].startswith("https://web.archive.org/")


def test_archive_fallback_zero_insert_re_raises(monkeypatch, scraper):
    monkeypatch.setattr(riyasewana_module, "_DEFAULT_SCRAPE_MODE", "playwright")
    monkeypatch.setattr(riyasewana_module, "_archive_fallback_enabled", lambda: True)
    monkeypatch.setattr(scraper, "_scrape_live", _raise_blocked)
    monkeypatch.setattr(
        scraper,
        "_run_archive_fallback",
        lambda max_pages=5: {"snapshot": "https://web.archive.org/x", "inserted": 0},
    )

    with pytest.raises(RiyasewanaBlockedError, match="archive fallback inserted 0"):
        asyncio.run(scraper.scrape(max_pages=3))


def test_archive_fallback_upserts_tagged_rows(db_session, scraper, monkeypatch):
    hit = _FakeHit(
        "https://web.archive.org/web/20190320232951id_/http://riyasewana.com/search/cars"
    )
    monkeypatch.setattr(riyasewana_module, "fetch_cdx_hits", lambda *a, **k: [hit])
    monkeypatch.setattr(
        riyasewana_module,
        "fetch_wayback_html",
        lambda *a, **k: RIYA_FIXTURE.read_text(encoding="utf-8"),
    )

    result = scraper._run_archive_fallback(max_pages=2)

    assert result["snapshot"] == hit.raw_url
    assert result["inserted"] >= 1

    rows = db_session.query(CarListing).filter(CarListing.source == "riyasewana").all()
    assert rows
    corolla = next((r for r in rows if "corolla" in r.title.lower()), None)
    assert corolla is not None
    assert corolla.price_lkr == 1_950_000
    assert corolla.url.startswith("https://riyasewana.com/buy/")
    assert corolla.source_id == "/buy/toyota-corolla-110-sale-kegalle-1143257"


def test_archive_fallback_uses_live_card_parser_for_modern_html(db_session, scraper, monkeypatch):
    modern_html = (
        Path(__file__).parent / "fixtures" / "riyasewana_serp_http_snippet.html"
    ).read_text(encoding="utf-8")
    hit = _FakeHit(
        "https://web.archive.org/web/20260719185246id_/https://riyasewana.com/search/cars"
    )
    monkeypatch.setattr(riyasewana_module, "fetch_cdx_hits", lambda *a, **k: [hit])
    monkeypatch.setattr(riyasewana_module, "fetch_wayback_html", lambda *a, **k: modern_html)

    result = scraper._run_archive_fallback(max_pages=2)

    assert result["inserted"] >= 1
    rows = db_session.query(CarListing).filter(CarListing.source == "riyasewana").all()
    assert rows
    yaris = next((r for r in rows if "yaris" in r.title.lower()), None)
    assert yaris is not None
    assert yaris.price_lkr == 10_650_000


def test_normalize_riyasewana_href():
    wayback = (
        "https://web.archive.org/web/20190320232951id_/"
        "http://riyasewana.com/buy/toyota-corolla-110-sale-kegalle-1143257"
    )
    assert (
        _normalize_riyasewana_href(wayback)
        == "http://riyasewana.com/buy/toyota-corolla-110-sale-kegalle-1143257"
    )

    relative = "/buy/suzuki-alto-original-sport-2010"
    assert (
        _normalize_riyasewana_href(relative)
        == "https://riyasewana.com/buy/suzuki-alto-original-sport-2010"
    )

    absolute = "https://riyasewana.com/buy/perodua-viva-elite-2013"
    assert _normalize_riyasewana_href(absolute) == absolute
