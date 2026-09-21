/** Parity tests: the offline engine must match backend/calculators.py math. */
import { describe, expect, it } from "vitest";
import {
  calculateLandedCostOffline,
  calculateOwnershipBundleOffline,
  checkImportEligibilityOffline,
} from "./offlineCalculators";

describe("calculateLandedCostOffline", () => {
  it("matches the backend for a 1500cc hybrid at 12k USD", () => {
    const res = calculateLandedCostOffline({
      cif_usd: 12000,
      exchange_rate: 300,
      fuel_type: "hybrid",
      engine_cc: 1500,
      apply_surcharge: true,
      apply_sscl: true,
    });
    expect(res.cif_lkr).toBe(3600000);
    expect(res.cid).toBe(720000);
    expect(res.surcharge).toBe(360000);
    expect(res.excise).toBe(5775000);
    expect(res.sscl).toBe(261375);
    expect(res.vat).toBe(1928947.5);
    expect(res.luxury_tax).toBe(0);
    expect(res.total_tax).toBe(9045322.5);
    expect(res.landed_cost).toBe(12645322.5);
    expect(res.surcharge_applied).toBe(true);
  });

  it("drops the surcharge and its downstream VAT/SSCL when disabled", () => {
    const res = calculateLandedCostOffline({
      cif_usd: 12000,
      exchange_rate: 300,
      fuel_type: "hybrid",
      engine_cc: 1500,
      apply_surcharge: false,
      apply_sscl: true,
    });
    expect(res.surcharge).toBe(0);
    expect(res.total_tax).toBe(8609902.5);
    expect(res.landed_cost).toBe(12209902.5);
  });

  it("requires motor_kw for electrics like the API (422)", () => {
    expect(() =>
      calculateLandedCostOffline({
        cif_usd: 10000,
        exchange_rate: 300,
        fuel_type: "electric",
        apply_surcharge: true,
        apply_sscl: true,
      }),
    ).toThrow();
  });
});

describe("calculateOwnershipBundleOffline", () => {
  it("matches the backend for a petrol motor car at 1500cc", () => {
    const res = calculateOwnershipBundleOffline({
      vehicle_class: "motor_car",
      fuel_type: "petrol",
      engine_cc: 1500,
    });
    expect(res.revenue_licence.base_fee_lkr).toBe(4000);
    expect(res.revenue_licence.emission_test_lkr).toBe(1550);
    expect(res.revenue_licence.total_lkr).toBe(5550);
    expect(res.third_party_insurance.total_lkr).toBe(3275);
    expect(res.transfer).toBeNull();
    expect(res.first_year_statutory_total_lkr).toBe(8825);
  });
});

describe("checkImportEligibilityOffline", () => {
  it("restricts an 11-year-old diesel like the backend", () => {
    const res = checkImportEligibilityOffline({
      fuel_type: "diesel",
      model_year: 2015,
      asOfYear: 2026,
    });
    expect(res.eligible).toBe(false);
    expect(res.status).toBe("restricted");
  });

  it("allows a recent EV", () => {
    const res = checkImportEligibilityOffline({
      fuel_type: "electric",
      model_year: 2022,
      asOfYear: 2026,
    });
    expect(res.eligible).toBe(true);
    expect(res.status).toBe("likely_allowed");
  });
});
