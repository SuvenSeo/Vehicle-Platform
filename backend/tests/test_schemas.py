import sys
from pathlib import Path
from datetime import datetime
from decimal import Decimal

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.models.schemas import CarListingRead


class FakeListing:
    source = "ikman"
    source_id = "listing-123"
    url = "https://example.com/listings/123"
    title = "Toyota Aqua 2017"
    make = "Toyota"
    model = "Aqua"
    year = 2017
    price_lkr = Decimal("8250000")
    mileage = 54000
    fuel_type = "hybrid"
    transmission = "automatic"
    engine_capacity = 1500
    condition = "used"
    body_type = "hatchback"
    district = "Colombo"
    city = "Colombo"
    id = 1
    scraped_at = datetime(2026, 4, 17, 10, 30, 0)
    first_seen_at = datetime(2026, 4, 17, 10, 0, 0)
    last_seen_at = datetime(2026, 4, 17, 10, 5, 0)
    deal_score = Decimal("12.5")
    market_median_lkr = Decimal("8600000")
    is_outlier = False
    thumbnail_url = "https://example.com/image.jpg"


class FakeListingNoPrice(FakeListing):
    source_id = "listing-456"
    price_lkr = None


class FakeListingNoYear(FakeListing):
    source_id = "listing-789"
    year = None


def test_car_listing_read_includes_thumbnail_url_from_attributes():
    listing = CarListingRead.model_validate(FakeListing())

    assert listing.model_dump()["thumbnail_url"] == "https://example.com/image.jpg"


def test_car_listing_read_allows_missing_price_value():
    listing = CarListingRead.model_validate(FakeListingNoPrice())

    assert listing.model_dump()["price_lkr"] is None


def test_car_listing_read_allows_missing_year_value():
    listing = CarListingRead.model_validate(FakeListingNoYear())

    assert listing.model_dump()["year"] is None
