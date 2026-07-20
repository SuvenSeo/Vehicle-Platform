import { describe, expect, it } from "vitest";
import {
  DEALER_OFFER_HIGH_MULTIPLIER,
  DEALER_OFFER_LOW_MULTIPLIER,
  WALKAWAY_MULTIPLIER,
  buildSellerFairAskWhatsAppText,
  computeSellerFairAsk,
  resolveFairAskMedian,
} from "@/lib/sellerFairAsk";

describe("sellerFairAsk multipliers", () => {
  it("uses 0.92 walkaway and 0.85–0.92 dealer band", () => {
    expect(WALKAWAY_MULTIPLIER).toBeCloseTo(0.92);
    expect(DEALER_OFFER_LOW_MULTIPLIER).toBeCloseTo(0.85);
    expect(DEALER_OFFER_HIGH_MULTIPLIER).toBeCloseTo(0.92);
  });
});

describe("resolveFairAskMedian", () => {
  it("prefers district median when positive", () => {
    expect(resolveFairAskMedian(10_000_000, 9_500_000)).toEqual({
      median: 9_500_000,
      usedDistrictMedian: true,
    });
  });

  it("falls back to market median when district missing or invalid", () => {
    expect(resolveFairAskMedian(10_000_000, null)).toEqual({
      median: 10_000_000,
      usedDistrictMedian: false,
    });
    expect(resolveFairAskMedian(10_000_000, 0)).toEqual({
      median: 10_000_000,
      usedDistrictMedian: false,
    });
    expect(resolveFairAskMedian(10_000_000, undefined)).toEqual({
      median: 10_000_000,
      usedDistrictMedian: false,
    });
  });

  it("returns null when no usable median", () => {
    expect(resolveFairAskMedian(0, null)).toBeNull();
    expect(resolveFairAskMedian(NaN, -1)).toBeNull();
  });
});

describe("computeSellerFairAsk", () => {
  const market = 10_000_000;

  it("returns null for invalid inputs", () => {
    expect(computeSellerFairAsk({ marketMedian: 0 })).toBeNull();
    expect(computeSellerFairAsk({ marketMedian: NaN })).toBeNull();
  });

  it("sets suggested ask at median and walkaway at median × 0.92", () => {
    const pack = computeSellerFairAsk({ marketMedian: market });
    expect(pack).not.toBeNull();
    expect(pack!.suggestedAsk).toBe(10_000_000);
    expect(pack!.walkaway).toBe(9_200_000);
    expect(pack!.usedDistrictMedian).toBe(false);
  });

  it("sets dealer offer band at median × 0.85 to median × 0.92", () => {
    const pack = computeSellerFairAsk({ marketMedian: market });
    expect(pack!.dealerOfferBand).toEqual({ low: 8_500_000, high: 9_200_000 });
  });

  it("uses district median when provided", () => {
    const pack = computeSellerFairAsk({
      marketMedian: market,
      districtMedian: 12_000_000,
    });
    expect(pack!.usedDistrictMedian).toBe(true);
    expect(pack!.suggestedAsk).toBe(12_000_000);
    expect(pack!.walkaway).toBe(11_040_000);
    expect(pack!.dealerOfferBand).toEqual({ low: 10_200_000, high: 11_040_000 });
  });

  it("rounds non-integer targets to whole LKR", () => {
    const pack = computeSellerFairAsk({ marketMedian: 10_000_001 });
    expect(pack!.walkaway).toBe(Math.round(10_000_001 * 0.92));
    expect(pack!.dealerOfferBand.low).toBe(Math.round(10_000_001 * 0.85));
  });
});

describe("buildSellerFairAskWhatsAppText", () => {
  it("builds a short English message with vehicle and prices", () => {
    const text = buildSellerFairAskWhatsAppText({
      make: "Toyota",
      model: "Aqua",
      year: 2018,
      suggestedAsk: 10_000_000,
      walkaway: 9_200_000,
      dealerOfferBand: { low: 8_500_000, high: 9_200_000 },
      formatLkr: (v) => `Rs. ${(v / 1_000_000).toFixed(1)}M`,
    });
    expect(text).toContain("Motormila fair-ask for 2018 Toyota Aqua:");
    expect(text).toContain("Suggested ask: Rs. 10.0M");
    expect(text).toContain("Walkaway: Rs. 9.2M");
    expect(text).toContain("Dealer offer band: Rs. 8.5M – Rs. 9.2M");
  });

  it("falls back to generic title without vehicle fields", () => {
    const text = buildSellerFairAskWhatsAppText({
      suggestedAsk: 5_000_000,
      walkaway: 4_600_000,
      dealerOfferBand: { low: 4_250_000, high: 4_600_000 },
      formatLkr: (v) => String(v),
    });
    expect(text.startsWith("Motormila fair-ask for My vehicle:")).toBe(true);
  });
});
