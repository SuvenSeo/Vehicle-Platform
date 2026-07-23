"""Source-specific fixtures and guard tests for messy scraper payloads (B2)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from bs4 import BeautifulSoup

from app.scrapers.cartivate import CartivateScraper
from app.scrapers.cleaner import CarCleaner

FIXTURES = Path(__file__).parent / "fixtures" / "scraper_payloads"


def _load_json(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _soup(html: str):
    return BeautifulSoup(html, "lxml")


@pytest.fixture
def cleaner() -> CarCleaner:
    return CarCleaner()


def test_fixture_ikman_title_case_props_canonicalize(cleaner: CarCleaner):
    payload = _load_json("ikman_messy_props.json")
    normalized = cleaner.normalize_listing_payload(payload)
    assert normalized is not None
    assert normalized["fuel_type"] == "petrol"
    assert normalized["transmission"] == "automatic"
    assert normalized["body_type"] == "hatchback"
    assert normalized["condition"] == "used"


def test_fixture_cartivate_labeled_auto_alias(cleaner: CarCleaner):
    payload = _load_json("cartivate_labeled_card.json")
    normalized = cleaner.normalize_listing_payload(payload)
    assert normalized is not None
    assert normalized["fuel_type"] == "petrol"
    assert normalized["transmission"] == "automatic"


def test_fixture_junk_structured_reinfers_from_details(cleaner: CarCleaner):
    payload = _load_json("junk_structured_with_details.json")
    normalized = cleaner.normalize_listing_payload(payload)
    assert normalized is not None
    assert normalized["fuel_type"] == "hybrid"
    assert normalized["transmission"] == "cvt"
    assert normalized["body_type"] == "suv"
    assert normalized["condition"] == "reconditioned"


def test_fixture_mixed_unicode_and_separators(cleaner: CarCleaner):
    payload = _load_json("mixed_separators.json")
    normalized = cleaner.normalize_listing_payload(payload)
    assert normalized is not None
    assert normalized["fuel_type"] == "diesel"
    assert normalized["transmission"] == "manual"
    assert normalized["condition"] == "used"


def test_fixture_hitad_card_text_enriches_via_cleaner(cleaner: CarCleaner):
    html = (FIXTURES / "hitad_card.html").read_text(encoding="utf-8")
    text = _soup(html).get_text(" ", strip=True)
    normalized = cleaner.normalize_listing_payload(
        {
            "source": "hitad",
            "source_id": "https://www.hitad.lk/details/13150",
            "make": "Suzuki",
            "model": "Swift",
            "year": 2019,
            "price_lkr": "Rs. 7,950,000",
            "url": "https://www.hitad.lk/details/13150",
            "_text_blobs": text,
        }
    )
    assert normalized is not None
    assert normalized["fuel_type"] == "petrol"
    assert normalized["transmission"] == "manual"


def test_cartivate_html_fixture_enriches_fuel_and_transmission():
    html = (FIXTURES / "cartivate_card.html").read_text(encoding="utf-8")
    payload = CartivateScraper(db=None)._build_payload_from_card(
        _soup(html).select_one("div.tfcl-listing-card")
    )
    assert payload is not None
    assert payload["fuel_type"] == "petrol"
    assert payload["transmission"] == "automatic"
