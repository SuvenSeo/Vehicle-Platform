import sys
from pathlib import Path

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.scrapers.cleaner import CarCleaner


def _base_payload(source: str = "autodirect", source_id: str = "listing-1") -> dict:
    return {
        "source": source,
        "source_id": source_id,
        "make": "Toyota",
        "model": "Yaris",
        "year": 2019,
        "price_lkr": "Rs. 8,800,000",
        "url": f"https://example.com/{source_id}",
    }


def test_clean_price_parses_million_notation():
    cleaner = CarCleaner()

    assert cleaner.clean_price("Rs 8.7 Million") == 8_700_000
    assert cleaner.clean_price("LKR 4.35 mn") == 4_350_000


def test_clean_price_ignores_installment_when_indicative_price_exists():
    cleaner = CarCleaner()
    raw = (
        "Indicative price: Rs 8.7 Million "
        "Installment Rs 58,000 / Monthly "
        "Down payment: Rs 4.35 Million"
    )

    assert cleaner.clean_price(raw) == 8_700_000


def test_clean_price_rejects_installment_only_or_noise_values():
    cleaner = CarCleaner()

    assert cleaner.clean_price("Installment Rs 150,000 per month") is None
    assert cleaner.clean_price("Down payment: Rs 2.5 Million") is None
    assert cleaner.clean_price("Contact for price / negotiable") is None


def test_normalize_listing_payload_parses_string_price():
    cleaner = CarCleaner()
    payload = _base_payload(source="autodirect", source_id="listing-1")

    normalized = cleaner.normalize_listing_payload(payload)

    assert normalized is not None
    assert normalized["price_lkr"] == 8_800_000


def test_normalize_listing_payload_rejects_unreasonable_price():
    cleaner = CarCleaner()
    payload = _base_payload(source="autodirect", source_id="listing-2")
    payload["price_lkr"] = "Rs. 20,000"

    assert cleaner.normalize_listing_payload(payload) is None


def test_normalize_listing_payload_can_preserve_explicit_unavailable_price_rows():
    cleaner = CarCleaner()
    payload = _base_payload(source="riyahub", source_id="negotiable")
    payload["price_lkr"] = "Price : Negotiable"
    payload["_allow_missing_price"] = True

    normalized = cleaner.normalize_listing_payload(payload)

    assert normalized is not None
    assert normalized["price_lkr"] is None
    assert "_allow_missing_price" not in normalized


@pytest.mark.parametrize(
    ("source", "blob_payload", "expected"),
    [
        (
            "ikman",
            {
                "details": "Fuel Type: Petrol | Transmission: Manual | Body Type: Hatchback | Condition: Used"
            },
            {"fuel_type": "petrol", "transmission": "manual", "body_type": "hatchback", "condition": "used"},
        ),
        (
            "riyasewana",
            {"specs": "Hybrid • CVT • SUV • Reconditioned"},
            {"fuel_type": "hybrid", "transmission": "automatic", "body_type": "suv", "condition": "reconditioned"},
        ),
        (
            "auto-lanka",
            {"_text_blobs": ["Diesel", "Tiptronic", "Double Cab", "Second Owner"]},
            {"fuel_type": "diesel", "transmission": "automatic", "body_type": "pickup", "condition": "used"},
        ),
        (
            "patpat",
            {"raw_meta": {"fuel": "Electric", "gearbox": "Automatic", "body": "Hatchback", "status": "Brand New"}},
            {"fuel_type": "electric", "transmission": "automatic", "body_type": "hatchback", "condition": "new"},
        ),
        (
            "autodirect",
            {"meta": "Fuel: LPG | Manual | Sedan | Pre-owned"},
            {"fuel_type": "lpg", "transmission": "manual", "body_type": "sedan", "condition": "used"},
        ),
    ],
)
def test_normalize_listing_payload_extracts_technical_fields_from_mixed_text_blobs(
    source: str, blob_payload: dict, expected: dict
):
    cleaner = CarCleaner()
    payload = _base_payload(source=source, source_id=f"{source}-listing")
    payload.update(blob_payload)

    normalized = cleaner.normalize_listing_payload(payload)

    assert normalized is not None
    assert normalized["fuel_type"] == expected["fuel_type"]
    assert normalized["transmission"] == expected["transmission"]
    assert normalized["body_type"] == expected["body_type"]
    assert normalized["condition"] == expected["condition"]


def test_normalize_listing_payload_does_not_override_existing_structured_technical_fields():
    cleaner = CarCleaner()
    payload = _base_payload(source="autodirect", source_id="listing-structured")
    payload.update(
        {
            "fuel_type": "diesel",
            "transmission": "manual",
            "body_type": "sedan",
            "condition": "used",
            "specs": "Hybrid | Automatic | SUV | Brand New",
        }
    )

    normalized = cleaner.normalize_listing_payload(payload)

    assert normalized is not None
    assert normalized["fuel_type"] == "diesel"
    assert normalized["transmission"] == "manual"
    assert normalized["body_type"] == "sedan"
    assert normalized["condition"] == "used"


@pytest.mark.parametrize(
    "updates",
    [
        {"source": ""},
        {"source_id": "", "url": ""},
        {"make": ""},
        {"price_lkr": "Installment Rs 150,000 monthly"},
    ],
)
def test_normalize_listing_payload_rejects_invalid_critical_fields(updates: dict):
    cleaner = CarCleaner()
    payload = _base_payload(source="ikman", source_id="listing-critical")
    payload.update(updates)

    assert cleaner.normalize_listing_payload(payload) is None
