import { describe, expect, it } from "vitest";
import {
  computeImportTaxes,
  getExciseRatePerCc,
  getHybridCliffBadge,
  getHybridExciseCliffInsight,
  HYBRID_EXCISE_CLIFF_CC,
  isAtHybridExciseCliff,
} from "@/lib/importTaxModel";

function line(result: ReturnType<typeof computeImportTaxes>, key: string) {
  const found = result.lines.find((item) => item.key === key);
  if (!found) throw new Error(`missing tax line: ${key}`);
  return found;
}

describe("computeImportTaxes", () => {
  it("charges petrol excise per cm³ using the band rate for the full capacity", () => {
    const result = computeImportTaxes({ cifLkr: 4_000_000, fuelType: "petrol", engineCc: 1200 });

    // 1200cc falls in the 1001–1300 band (Rs 3,850/cc) applied to all 1200cc.
    expect(line(result, "excise").amount).toBe(1200 * 3_850);
  });

  it("uses a higher band rate for larger engines", () => {
    const small = computeImportTaxes({ cifLkr: 4_000_000, fuelType: "petrol", engineCc: 990 });
    const large = computeImportTaxes({ cifLkr: 4_000_000, fuelType: "petrol", engineCc: 2600 });

    expect(line(small, "excise").amount).toBe(990 * 2_450);
    expect(line(large, "excise").amount).toBe(2600 * 8_900);
  });

  it("adds luxury tax only on the CIF portion above the fuel threshold", () => {
    const below = computeImportTaxes({ cifLkr: 4_999_999, fuelType: "petrol", engineCc: 1500 });
    const above = computeImportTaxes({ cifLkr: 7_000_000, fuelType: "petrol", engineCc: 1500 });

    expect(below.lines.some((item) => item.key === "luxury")).toBe(false);
    expect(line(above, "luxury").amount).toBe((7_000_000 - 5_000_000) * 1.0);
  });

  it("computes electric excise per kW and applies the EV luxury threshold", () => {
    const result = computeImportTaxes({ cifLkr: 8_000_000, fuelType: "electric", motorKw: 150 });

    expect(line(result, "excise").amount).toBe(150 * 43_000);
    expect(line(result, "luxury").amount).toBeCloseTo((8_000_000 - 6_000_000) * 0.6);
  });

  it("excludes luxury tax from the VAT base", () => {
    const result = computeImportTaxes({ cifLkr: 10_000_000, fuelType: "petrol", engineCc: 2000 });

    const cid = 10_000_000 * 0.2;
    const surcharge = cid * 0.5;
    const excise = 2000 * 6_400;
    const expectedVat = (10_000_000 + cid + surcharge + excise) * 0.18;

    expect(line(result, "vat").amount).toBeCloseTo(expectedVat);
  });

  it("total on-road equals CIF plus every tax line", () => {
    const result = computeImportTaxes({ cifLkr: 6_000_000, fuelType: "hybrid", engineCc: 1800 });
    const sum = result.lines.reduce((acc, item) => acc + item.amount, 0);

    expect(result.totalTax).toBeCloseTo(sum);
    expect(result.totalOnRoad).toBeCloseTo(6_000_000 + sum);
  });
});

describe("getExciseRatePerCc", () => {
  it("returns the ≤1500 hybrid band rate at exactly 1500 cc", () => {
    expect(getExciseRatePerCc("hybrid", 1500)).toBe(3_850);
    expect(getExciseRatePerCc("hybrid", 1501)).toBe(4_700);
  });
});

describe("getHybridExciseCliffInsight", () => {
  it("derives the 1500 cc cliff step-up and hybrid-vs-petrol saving from band rates", () => {
    const insight = getHybridExciseCliffInsight();

    expect(insight.cliffCc).toBe(HYBRID_EXCISE_CLIFF_CC);
    expect(insight.rateAtOrBelowCliff).toBe(3_850);
    expect(insight.rateAboveCliff).toBe(4_700);
    expect(insight.petrolRateAtCliff).toBe(4_450);
    expect(insight.exciseAtCliff).toBe(1500 * 3_850);
    expect(insight.exciseOneCcAbove).toBe(1501 * 4_700);
    expect(insight.exciseStepUp).toBe(1501 * 4_700 - 1500 * 3_850);
    expect(insight.exciseSavingVsPetrolAtCliff).toBe(1500 * (4_450 - 3_850));
  });
});

describe("isAtHybridExciseCliff", () => {
  it("flags capacities near the 1500 cc boundary", () => {
    expect(isAtHybridExciseCliff(1500)).toBe(true);
    expect(isAtHybridExciseCliff(1450)).toBe(true);
    expect(isAtHybridExciseCliff(1550)).toBe(true);
    expect(isAtHybridExciseCliff(1600)).toBe(false);
  });
});

describe("getHybridCliffBadge", () => {
  it("returns null for non-hybrid fuels or missing cc", () => {
    expect(getHybridCliffBadge("petrol", 1500)).toBeNull();
    expect(getHybridCliffBadge("hybrid", null)).toBeNull();
  });

  it("labels tax-safe, near-cliff, and above-cliff hybrids", () => {
    expect(getHybridCliffBadge("hybrid", 1200)?.kind).toBe("tax_safe");
    expect(getHybridCliffBadge("plugin_hybrid", 1490)?.kind).toBe("at_cliff");
    expect(getHybridCliffBadge("hybrid", 1790)?.kind).toBe("above_cliff");
    expect(getHybridCliffBadge("hybrid", 1790)?.label).toMatch(/1790/);
  });
});
