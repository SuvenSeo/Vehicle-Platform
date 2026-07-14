import { describe, expect, it } from "vitest";
import {
  CBSL_LTV_CAPS,
  VEHICLE_FINANCE_CLASSES,
  computeCashToOwn,
  estimateInsuranceAnnual,
  getFinanceClassLabel,
  inferFinanceClass,
  minCashDownForPrice,
  minDownPaymentPctForClass,
  sortListingsByAffordability,
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
    expect(VEHICLE_FINANCE_CLASSES).toContain("registered_used");
  });

  it("returns min cash down for a price under registered_used default", () => {
    expect(minCashDownForPrice(10_000_000)).toBe(4_000_000);
    expect(minCashDownForPrice(50_000)).toBeNull();
  });

  it("sorts listings by ascending min cash down with deal_score tie-break", () => {
    const ranked = sortListingsByAffordability([
      { id: 1, price_lkr: 12_000_000, deal_score: 9 },
      { id: 2, price_lkr: 8_000_000, deal_score: 11 },
      { id: 3, price_lkr: 8_000_000, deal_score: 14 },
      { id: 4, price_lkr: 50_000, deal_score: 20 },
    ]);

    expect(ranked.map((l) => l.id)).toEqual([3, 2, 1, 4]);
    expect(minCashDownForPrice(ranked[0].price_lkr!)).toBeLessThan(
      minCashDownForPrice(ranked[2].price_lkr!)!,
    );
  });
});
