import { describe, expect, it } from "vitest";
import {
  CBSL_LTV_CAPS,
  computeCashToOwn,
  estimateInsuranceAnnual,
  getFinanceClassLabel,
  inferFinanceClass,
  minDownPaymentPctForClass,
} from "@/lib/cashToOwn";

describe("cashToOwn", () => {
  it("computes min cash down from CBSL LTV for registered used", () => {
    const result = computeCashToOwn({
      priceLkr: 10_000_000,
      financeClass: "registered_used",
      insuranceAnnualLkr: 120_000,
      stampDutyPct: 2,
    });

    expect(result).not.toBeNull();
    expect(result!.ltvCap).toBe(0.6);
    expect(result!.maxFinanceLkr).toBe(6_000_000);
    expect(result!.minCashDownLkr).toBe(4_000_000);
    expect(result!.stampDutyLkr).toBe(120_000);
    expect(result!.cashToOwnTodayLkr).toBe(4_000_000 + 120_000 + 10_000);
    expect(result!.monthlyPaymentLkr).toBeGreaterThan(100_000);
  });

  it("uses stricter LTV for unregistered / brand new", () => {
    const unreg = computeCashToOwn({ priceLkr: 10_000_000, financeClass: "unregistered" });
    const neu = computeCashToOwn({ priceLkr: 10_000_000, financeClass: "brand_new" });
    expect(unreg!.ltvCap).toBe(0.5);
    expect(neu!.ltvCap).toBe(0.5);
    expect(unreg!.minCashDownLkr).toBe(5_000_000);
  });

  it("returns null for unrealistic prices", () => {
    expect(computeCashToOwn({ priceLkr: 50_000 })).toBeNull();
    expect(computeCashToOwn({ priceLkr: Number.NaN })).toBeNull();
  });

  it("infers finance class from listing metadata", () => {
    expect(inferFinanceClass({ fuelType: "electric" })).toBe("electric_commercial");
    expect(inferFinanceClass({ condition: "brand_new" })).toBe("unregistered");
    expect(inferFinanceClass({ year: 2026, nowYear: 2026 })).toBe("brand_new");
    expect(inferFinanceClass({ year: 2018, nowYear: 2026 })).toBe("registered_used");
  });

  it("exposes LTV table and min down payment helpers", () => {
    expect(CBSL_LTV_CAPS.registered_used).toBe(0.6);
    expect(minDownPaymentPctForClass("registered_used")).toBe(40);
    expect(getFinanceClassLabel("registered_used")).toMatch(/Registered used/i);
    expect(estimateInsuranceAnnual(10_000_000)).toBeGreaterThanOrEqual(80_000);
  });
});
