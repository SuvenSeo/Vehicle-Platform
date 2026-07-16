"""Parity guard: backend tax constants must match the canonical rates JSON.

src/data/importTaxRates.json is the single source of truth for SL import tax
rates (the frontend derives its constants from it directly). The backend
keeps mirrored constants in calculators.py because the HF Space deploy only
ships backend/. This test fails CI the moment the two drift.

Skipped when the JSON is absent (e.g. on the deployed Space, where only
backend/ exists).
"""

import json
import math
import sys
from pathlib import Path

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import calculators

_RATES_PATH = Path(__file__).resolve().parents[2] / "src" / "data" / "importTaxRates.json"

pytestmark = pytest.mark.skipif(
    not _RATES_PATH.exists(),
    reason="canonical rates JSON not present (backend-only deployment)",
)


def _canonical():
    with _RATES_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def _json_bands_to_py(raw_bands):
    """[[upTo|null, rate], ...] -> [(upTo|inf, rate), ...] matching calculators.py."""
    return [
        (math.inf if up_to is None else float(up_to), float(rate))
        for up_to, rate in raw_bands
    ]


def test_scalar_rates_match():
    rates = _canonical()
    # calculators.py hardcodes these inline in calculate_landed_cost; the
    # canonical values they must equal live in the JSON.
    assert rates["cid_rate"] == 0.20
    assert rates["cid_surcharge_rate"] == 0.50
    assert rates["sscl_rate"] == 0.025
    assert rates["vat_rate"] == 0.18


def test_excise_bands_match():
    rates = _canonical()
    assert _json_bands_to_py(rates["excise_bands_per_cc"]["petrol"]) == [
        (float(limit), float(rate)) for limit, rate in calculators.EXCISE_PETROL
    ]
    assert _json_bands_to_py(rates["excise_bands_per_cc"]["diesel"]) == [
        (float(limit), float(rate)) for limit, rate in calculators.EXCISE_DIESEL
    ]
    assert _json_bands_to_py(rates["excise_bands_per_cc"]["hybrid"]) == [
        (float(limit), float(rate)) for limit, rate in calculators.EXCISE_HYBRID
    ]
    assert _json_bands_to_py(rates["excise_bands_per_kw"]) == [
        (float(limit), float(rate)) for limit, rate in calculators.EXCISE_ELECTRIC
    ]


def test_luxury_tax_matches():
    rates = _canonical()
    for fuel, (threshold, rate_on_excess) in calculators.LUXURY_TAX_THRESHOLDS.items():
        canonical = rates["luxury_tax"][fuel]
        assert canonical["threshold_lkr"] == threshold, fuel
        assert canonical["rate_on_excess"] == rate_on_excess, fuel


def test_endpoint_math_matches_canonical_rates():
    """End-to-end: the landed-cost endpoint's output must be reproducible
    from the canonical JSON alone (petrol, 1800cc, CIF 10M)."""
    rates = _canonical()
    payload = calculators.LandedCostRequest(
        cif_usd=10_000_000 / 300.0,
        exchange_rate=300.0,
        fuel_type="petrol",
        engine_cc=1800,
        apply_surcharge=True,
        apply_sscl=True,
    )
    result = calculators.calculate_landed_cost(payload)

    cif = 10_000_000.0
    cid = cif * rates["cid_rate"]
    surcharge = cid * rates["cid_surcharge_rate"]
    rate_per_cc = next(
        rate for up_to, rate in rates["excise_bands_per_cc"]["petrol"]
        if up_to is None or 1800 <= up_to
    )
    excise = 1800 * rate_per_cc
    sscl = (cif + cid + surcharge + excise) * rates["sscl_rate"]
    vat = (cif + cid + surcharge + excise + sscl) * rates["vat_rate"]
    lux = rates["luxury_tax"]["petrol"]
    luxury = max(0.0, cif - lux["threshold_lkr"]) * lux["rate_on_excess"]

    assert result.cid == pytest.approx(cid)
    assert result.surcharge == pytest.approx(surcharge)
    assert result.excise == pytest.approx(excise)
    assert result.sscl == pytest.approx(sscl)
    assert result.vat == pytest.approx(vat)
    assert result.luxury_tax == pytest.approx(luxury)
    assert result.landed_cost == pytest.approx(cif + cid + surcharge + excise + sscl + vat + luxury)
