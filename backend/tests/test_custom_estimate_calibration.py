import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints.listings import (  # noqa: E402
    _adjust_price_for_mileage,
    _calibrated_price_points,
    _filter_high_quality_rows,
)
from app.models.schemas import CustomVehicleEstimateRequest  # noqa: E402


class _Row:
    def __init__(self, model: str, year: int, mileage: int | None, price_lkr: float):
        self.model = model
        self.year = year
        self.mileage = mileage
        self.price_lkr = price_lkr


def test_adjust_price_for_mileage_moves_price_in_expected_direction():
    base_price = 8_000_000.0

    adjusted_for_higher_target_mileage = _adjust_price_for_mileage(
        base_price,
        target_mileage_km=100_000,
        comparable_mileage_km=40_000,
    )
    adjusted_for_lower_target_mileage = _adjust_price_for_mileage(
        base_price,
        target_mileage_km=40_000,
        comparable_mileage_km=100_000,
    )

    assert adjusted_for_higher_target_mileage < base_price
    assert adjusted_for_lower_target_mileage > base_price


def test_filter_high_quality_rows_keeps_close_exact_and_alias_models():
    payload = CustomVehicleEstimateRequest(
        make="Toyota",
        model="Vitz",
        year=2018,
        mileage_km=80_000,
    )
    rows = [
        _Row("Vitz", 2018, 85_000, 7_000_000),
        _Row("Yaris", 2019, 90_000, 7_100_000),
        _Row("Corolla", 2018, 82_000, 7_200_000),
        _Row("Vitz", 2012, 84_000, 6_800_000),
        _Row("Vitz", 2018, 260_000, 6_500_000),
    ]

    filtered = _filter_high_quality_rows(rows, payload, min_count=2)

    assert [row.model for row in filtered] == ["Vitz", "Yaris"]


def test_filter_high_quality_rows_keeps_model_match_even_if_below_min_count():
    payload = CustomVehicleEstimateRequest(
        make="Toyota",
        model="Vitz",
        year=2018,
        mileage_km=80_000,
    )
    rows = [
        _Row("Vitz", 2018, 85_000, 7_000_000),
        _Row("Corolla", 2018, 82_000, 7_200_000),
    ]

    filtered = _filter_high_quality_rows(rows, payload, min_count=2)

    assert [row.model for row in filtered] == ["Vitz"]


def test_filter_high_quality_rows_falls_back_when_no_model_match_exists():
    payload = CustomVehicleEstimateRequest(
        make="Toyota",
        model="Vitz",
        year=2018,
        mileage_km=80_000,
    )
    rows = [
        _Row("Corolla", 2018, 82_000, 7_200_000),
        _Row("Prius", 2018, 90_000, 7_100_000),
    ]

    filtered = _filter_high_quality_rows(rows, payload, min_count=2)

    assert filtered == rows


def test_calibrated_price_points_apply_mileage_adjustment_and_sort():
    payload = CustomVehicleEstimateRequest(
        make="Toyota",
        model="Vitz",
        year=2018,
        mileage_km=100_000,
    )
    rows = [
        _Row("Vitz", 2018, 40_000, 8_000_000),
        _Row("Vitz", 2018, 130_000, 7_000_000),
        _Row("Vitz", 2018, None, 7_500_000),
    ]

    calibrated = _calibrated_price_points(rows, payload)
    raw_sorted = sorted(float(row.price_lkr) for row in rows)

    assert calibrated == sorted(calibrated)
    assert len(calibrated) == 3
    assert calibrated != raw_sorted


def test_calibrated_price_points_without_target_mileage_returns_raw_prices():
    payload = CustomVehicleEstimateRequest(
        make="Toyota",
        model="Vitz",
        year=2018,
    )
    rows = [
        _Row("Vitz", 2018, 40_000, 8_000_000),
        _Row("Vitz", 2018, 130_000, 7_000_000),
        _Row("Vitz", 2018, None, 7_500_000),
    ]

    calibrated = _calibrated_price_points(rows, payload)

    assert calibrated == sorted(float(row.price_lkr) for row in rows)
