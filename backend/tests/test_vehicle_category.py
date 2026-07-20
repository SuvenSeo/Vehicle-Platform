import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils.vehicle_category import (
    cars_only_sql_filter,
    is_car_category,
    looks_like_non_car_text,
    normalize_vehicle_category,
)
from db.models import CarListing


def test_normalize_and_classify_vehicle_categories():
    assert normalize_vehicle_category("Motorbikes") == "motorbikes"
    assert is_car_category("cars") is True
    assert is_car_category("suvs") is True
    assert is_car_category("motorbikes") is False
    assert is_car_category("tractors") is False
    assert is_car_category(None) is True


def test_non_car_title_heuristic():
    assert looks_like_non_car_text("TVS Ntorq 125 2026")
    assert looks_like_non_car_text("Bajaj RE 2016")
    assert not looks_like_non_car_text("Toyota Aqua 2018")


def test_cars_only_sql_filter_builds():
    # Ensure the expression compiles against the model attribute.
    expr = cars_only_sql_filter(CarListing)
    assert expr is not None
