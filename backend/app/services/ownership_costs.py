"""Sri Lanka vehicle ownership cost helpers (revenue licence, insurance, transfer).

Schedules are Motormila planning models derived from publicly cited gazettes /
industry floors (Motor Traffic Fees Regulations No. 04 of 2022 for revenue
licence; indicative IRCSL CMT third-party floors; DMT ownership-change fees).
Always confirm eRL / insurer / RMV figures before paying.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

VehicleClass = Literal["motor_car", "dual_purpose", "motorcycle", "three_wheeler"]
FuelPropulsion = Literal["petrol", "diesel", "hybrid", "electric"]
DelayBand = Literal["none", "within_3_months", "within_1_year", "over_1_year"]

# Emission test (VET) indicative DMT tariffs — cars/vans; EVs exempt.
EMISSION_TEST_CAR_LKR = 1550.0
EMISSION_TEST_MOTORCYCLE_LKR = 1500.0
EMISSION_TEST_THREE_WHEELER_LKR = 2000.0

STAMP_DUTY_TP_LKR = 25.0

# Motor Traffic Fees Regulations 2022 — Schedule VI Part I (motor cars by unladen kg).
# Petrol / diesel pairs. Hybrids follow petrol class per reg 10(2)(b).
# Pure EV / alt-fuel: 50% of petrol fee per reg 10(2)(a).
MOTOR_CAR_REVENUE_BANDS: tuple[tuple[float, float, float], ...] = (
    # (max_exclusive_or_inf, petrol, diesel)
    (762.0, 2500.0, 3900.0),
    (1016.0, 2600.0, 5000.0),
    (1270.0, 4000.0, 7500.0),
    (float("inf"), 5000.0, 10000.0),
)

DUAL_PURPOSE_REVENUE: tuple[float, float] = (2500.0, 4500.0)  # <1000kg petrol/diesel baseline
MOTORCYCLE_REVENUE_LKR = 900.0
THREE_WHEELER_REVENUE_LKR = 550.0

# Indicative IRCSL compulsory motor third-party annual base floors (private use).
# Cross-checked against commonly published CMT tariff bands; not a substitute for
# the insurer quotation. Stamp duty added separately.
TP_MOTOR_CAR_BY_CC: tuple[tuple[int, float], ...] = (
    (1000, 2750.0),
    (1500, 3250.0),
    (2000, 4000.0),
    (2500, 5000.0),
    (10_000, 6500.0),
)
TP_MOTORCYCLE_LKR = 850.0
TP_THREE_WHEELER_LKR = 1200.0
TP_DUAL_PURPOSE_LKR = 3500.0

# DMT ownership-change / transfer processing fees (indicative Schedule bands).
TRANSFER_FEE_MOTOR_CAR_LKR = 6500.0
TRANSFER_FEE_MOTORCYCLE_LKR = 1500.0
TRANSFER_FEE_THREE_WHEELER_LKR = 2000.0
TRANSFER_FEE_DUAL_PURPOSE_LKR = 6500.0
# Absolute ownership transfer often also attracts stamp duty on consideration —
# planning default 3% used widely for vehicle deed of transfer estimates.
TRANSFER_STAMP_DUTY_PCT = 0.03

DELAY_MULTIPLIER: dict[DelayBand, float] = {
    "none": 0.0,
    "within_3_months": 0.10,
    "within_1_year": 0.20,
    "over_1_year": 0.30,
}


@dataclass(frozen=True)
class RevenueLicenceResult:
    base_fee_lkr: float
    delay_charge_lkr: float
    emission_test_lkr: float
    total_lkr: float
    schedule_note: str


@dataclass(frozen=True)
class ThirdPartyInsuranceResult:
    base_premium_lkr: float
    stamp_duty_lkr: float
    total_lkr: float
    schedule_note: str


@dataclass(frozen=True)
class TransferFeeResult:
    processing_fee_lkr: float
    stamp_duty_lkr: float
    total_lkr: float
    schedule_note: str


@dataclass(frozen=True)
class ImportEligibilityResult:
    eligible: bool
    status: Literal["likely_allowed", "restricted", "needs_review"]
    reasons: list[str]
    notes: str


def _band_lookup(bands: tuple[tuple[float, float, float], ...], weight_kg: float) -> tuple[float, float]:
    for upper, petrol, diesel in bands:
        if weight_kg < upper:
            return petrol, diesel
    return bands[-1][1], bands[-1][2]


def estimate_unladen_kg_from_cc(engine_cc: int | None) -> float:
    """Rough unladen-weight proxy when only CC is known (city hatch → mid sedan)."""
    if engine_cc is None or engine_cc <= 0:
        return 1100.0
    if engine_cc <= 1000:
        return 850.0
    if engine_cc <= 1500:
        return 1120.0
    if engine_cc <= 2000:
        return 1350.0
    return 1550.0


def calculate_revenue_licence(
    *,
    vehicle_class: VehicleClass = "motor_car",
    fuel_type: FuelPropulsion = "petrol",
    unladen_kg: float | None = None,
    engine_cc: int | None = None,
    delay: DelayBand = "none",
    include_emission_test: bool = True,
) -> RevenueLicenceResult:
    weight = float(unladen_kg) if unladen_kg and unladen_kg > 0 else estimate_unladen_kg_from_cc(engine_cc)

    if vehicle_class == "motorcycle":
        base = MOTORCYCLE_REVENUE_LKR
        emission = EMISSION_TEST_MOTORCYCLE_LKR if include_emission_test else 0.0
        note = "Motorcycle flat revenue licence (Motor Traffic Fees Regulations schedule)."
    elif vehicle_class == "three_wheeler":
        base = THREE_WHEELER_REVENUE_LKR
        emission = EMISSION_TEST_THREE_WHEELER_LKR if include_emission_test else 0.0
        note = "Three-wheeler / motor tricycle van flat revenue licence."
    elif vehicle_class == "dual_purpose":
        petrol_f, diesel_f = DUAL_PURPOSE_REVENUE
        if fuel_type == "diesel":
            base = diesel_f
        elif fuel_type == "electric":
            base = petrol_f * 0.5
        else:
            base = petrol_f
        emission = EMISSION_TEST_CAR_LKR if include_emission_test and fuel_type != "electric" else 0.0
        note = "Dual-purpose <1000 kg GVW baseline band (confirm provincial / eRL figure)."
    else:
        petrol_f, diesel_f = _band_lookup(MOTOR_CAR_REVENUE_BANDS, weight)
        if fuel_type == "diesel":
            base = diesel_f
        elif fuel_type == "electric":
            base = petrol_f * 0.5
        else:
            # petrol + hybrid (hybrid treated as petrol class)
            base = petrol_f
        emission = EMISSION_TEST_CAR_LKR if include_emission_test and fuel_type != "electric" else 0.0
        note = (
            f"Motor car Schedule VI band for ~{int(weight)} kg unladen "
            f"({'petrol-equivalent' if fuel_type != 'diesel' else 'diesel'}). "
            "Provincial eRL may differ — confirm before payment."
        )

    delay_charge = round(base * DELAY_MULTIPLIER[delay], 2)
    total = round(base + delay_charge + emission, 2)
    return RevenueLicenceResult(
        base_fee_lkr=round(base, 2),
        delay_charge_lkr=delay_charge,
        emission_test_lkr=round(emission, 2),
        total_lkr=total,
        schedule_note=note,
    )


def _tp_base_for_car(engine_cc: int | None) -> float:
    cc = engine_cc if engine_cc and engine_cc > 0 else 1500
    for upper, premium in TP_MOTOR_CAR_BY_CC:
        if cc <= upper:
            return premium
    return TP_MOTOR_CAR_BY_CC[-1][1]


def calculate_third_party_insurance(
    *,
    vehicle_class: VehicleClass = "motor_car",
    engine_cc: int | None = 1500,
) -> ThirdPartyInsuranceResult:
    if vehicle_class == "motorcycle":
        base = TP_MOTORCYCLE_LKR
        note = "Indicative motorcycle CMT floor."
    elif vehicle_class == "three_wheeler":
        base = TP_THREE_WHEELER_LKR
        note = "Indicative three-wheeler CMT floor."
    elif vehicle_class == "dual_purpose":
        base = TP_DUAL_PURPOSE_LKR
        note = "Indicative dual-purpose CMT floor."
    else:
        base = _tp_base_for_car(engine_cc)
        note = (
            f"Indicative IRCSL CMT private motor-car floor for ~{engine_cc or 1500} cc. "
            "Insurers may charge more; cannot legally charge less than the tariff floor."
        )
    total = round(base + STAMP_DUTY_TP_LKR, 2)
    return ThirdPartyInsuranceResult(
        base_premium_lkr=round(base, 2),
        stamp_duty_lkr=STAMP_DUTY_TP_LKR,
        total_lkr=total,
        schedule_note=note,
    )


def calculate_transfer_fees(
    *,
    vehicle_class: VehicleClass = "motor_car",
    consideration_lkr: float = 0.0,
    include_stamp_duty: bool = True,
) -> TransferFeeResult:
    if vehicle_class == "motorcycle":
        processing = TRANSFER_FEE_MOTORCYCLE_LKR
    elif vehicle_class == "three_wheeler":
        processing = TRANSFER_FEE_THREE_WHEELER_LKR
    elif vehicle_class == "dual_purpose":
        processing = TRANSFER_FEE_DUAL_PURPOSE_LKR
    else:
        processing = TRANSFER_FEE_MOTOR_CAR_LKR

    stamp = 0.0
    if include_stamp_duty and consideration_lkr > 0:
        stamp = round(consideration_lkr * TRANSFER_STAMP_DUTY_PCT, 2)

    return TransferFeeResult(
        processing_fee_lkr=processing,
        stamp_duty_lkr=stamp,
        total_lkr=round(processing + stamp, 2),
        schedule_note=(
            "DMT ownership-change processing fee (indicative) plus optional "
            f"{int(TRANSFER_STAMP_DUTY_PCT * 100)}% stamp-duty estimate on consideration. "
            "Confirm Divisional Secretariat / RMV counter figures."
        ),
    )


def check_import_eligibility(
    *,
    fuel_type: FuelPropulsion,
    model_year: int | None,
    as_of_year: int = 2026,
) -> ImportEligibilityResult:
    """Heuristic post-ban import eligibility for passenger vehicles.

    Motormila context: passenger import freeze lifted Feb 2025; high compound
    duties remain. Used-import age norms and EV/hybrid preferences still apply
    in practice — this is a planning screen, not Customs clearance advice.
    """
    reasons: list[str] = []
    status: Literal["likely_allowed", "restricted", "needs_review"] = "likely_allowed"

    if as_of_year < 2025:
        return ImportEligibilityResult(
            eligible=False,
            status="restricted",
            reasons=["Passenger vehicle import freeze was still in force before Feb 2025."],
            notes="Import ban era — commercial clearance generally blocked for private cars.",
        )

    reasons.append("Passenger import freeze lifted (Feb 2025); compound CID/excise/VAT still apply.")

    if model_year is not None:
        age = as_of_year - model_year
        if age > 8:
            status = "restricted"
            reasons.append(
                f"Model year {model_year} is ~{age} years old — typically outside practical "
                "used-import windows even after the ban lift."
            )
        elif age > 5 and fuel_type != "electric":
            status = "needs_review"
            reasons.append(
                f"Model year {model_year} is ~{age} years old — used ICE/hybrid imports "
                "often face age caps or extra scrutiny; verify current Customs circulars."
            )
        else:
            reasons.append(f"Model year {model_year} is within a common used-import age window.")

    if fuel_type == "electric":
        reasons.append("Pure EV — often preferred under remittance / special-permit pathways; check permit stock.")
    elif fuel_type == "diesel":
        status = "needs_review" if status == "likely_allowed" else status
        reasons.append("Diesel passenger cars face higher excise and revenue-licence bands — cost and policy risk higher.")

    eligible = status != "restricted"
    notes = (
        "Planning screen only. Final eligibility depends on HS code, gazette duties, "
        "Letters of Credit timing, and any active permit scheme."
    )
    return ImportEligibilityResult(
        eligible=eligible,
        status=status,
        reasons=reasons,
        notes=notes,
    )


def ownership_first_year_bundle(
    *,
    vehicle_class: VehicleClass = "motor_car",
    fuel_type: FuelPropulsion = "petrol",
    engine_cc: int | None = 1500,
    unladen_kg: float | None = None,
    consideration_lkr: float = 0.0,
    include_transfer: bool = False,
) -> dict[str, float | str | dict]:
    licence = calculate_revenue_licence(
        vehicle_class=vehicle_class,
        fuel_type=fuel_type,
        unladen_kg=unladen_kg,
        engine_cc=engine_cc,
    )
    tp = calculate_third_party_insurance(vehicle_class=vehicle_class, engine_cc=engine_cc)
    transfer = (
        calculate_transfer_fees(vehicle_class=vehicle_class, consideration_lkr=consideration_lkr)
        if include_transfer
        else None
    )
    total = licence.total_lkr + tp.total_lkr + (transfer.total_lkr if transfer else 0.0)
    return {
        "revenue_licence": licence.__dict__,
        "third_party_insurance": tp.__dict__,
        "transfer": transfer.__dict__ if transfer else None,
        "first_year_statutory_total_lkr": round(total, 2),
        "notes": (
            "Statutory-leaning first-year cash outlay (licence + emission + TP). "
            "Comprehensive insurance and lease payments are separate."
        ),
    }
