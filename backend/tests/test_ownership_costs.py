"""Pure-function tests for ownership cost schedules."""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.ownership_costs import (
    calculate_revenue_licence,
    calculate_third_party_insurance,
    calculate_transfer_fees,
    check_import_eligibility,
    ownership_first_year_bundle,
)


def test_revenue_licence_motor_car_petrol_mid_band():
    result = calculate_revenue_licence(
        vehicle_class="motor_car",
        fuel_type="petrol",
        unladen_kg=900,
        include_emission_test=True,
    )
    assert result.base_fee_lkr == 2600.0
    assert result.emission_test_lkr == 1550.0
    assert result.delay_charge_lkr == 0.0
    assert result.total_lkr == 4150.0


def test_revenue_licence_ev_is_half_petrol_band():
    petrol = calculate_revenue_licence(
        vehicle_class="motor_car",
        fuel_type="petrol",
        unladen_kg=900,
        include_emission_test=False,
    )
    ev = calculate_revenue_licence(
        vehicle_class="motor_car",
        fuel_type="electric",
        unladen_kg=900,
        include_emission_test=True,
    )
    assert ev.base_fee_lkr == petrol.base_fee_lkr * 0.5
    assert ev.emission_test_lkr == 0.0


def test_revenue_licence_delay_charge():
    result = calculate_revenue_licence(
        vehicle_class="motor_car",
        fuel_type="diesel",
        unladen_kg=1100,
        delay="within_3_months",
        include_emission_test=False,
    )
    assert result.base_fee_lkr == 7500.0
    assert result.delay_charge_lkr == 750.0


def test_third_party_insurance_car_band():
    result = calculate_third_party_insurance(vehicle_class="motor_car", engine_cc=1300)
    assert result.base_premium_lkr == 3250.0
    assert result.stamp_duty_lkr == 25.0
    assert result.total_lkr == 3275.0


def test_transfer_fees_with_stamp_duty():
    result = calculate_transfer_fees(
        vehicle_class="motor_car",
        consideration_lkr=10_000_000,
        include_stamp_duty=True,
    )
    assert result.processing_fee_lkr == 6500.0
    assert result.stamp_duty_lkr == 300_000.0
    assert result.total_lkr == 306_500.0


def test_import_eligibility_post_ban_recent_hybrid():
    result = check_import_eligibility(fuel_type="hybrid", model_year=2023, as_of_year=2026)
    assert result.eligible is True
    assert result.status == "likely_allowed"


def test_import_eligibility_old_ice_restricted():
    result = check_import_eligibility(fuel_type="petrol", model_year=2012, as_of_year=2026)
    assert result.eligible is False
    assert result.status == "restricted"


def test_ownership_bundle_totals():
    bundle = ownership_first_year_bundle(
        vehicle_class="motor_car",
        fuel_type="petrol",
        engine_cc=1300,
        unladen_kg=900,
        include_transfer=False,
    )
    assert bundle["first_year_statutory_total_lkr"] == 4150.0 + 3275.0
