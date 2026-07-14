import { describe, expect, it } from "vitest";
import { computeMileageTrust, TYPICAL_KM_PER_YEAR } from "@/lib/mileageTrust";

describe("computeMileageTrust", () => {
  it("flags suspiciously low km on older cars", () => {
    const result = computeMileageTrust({
      mileageKm: 20_000,
      year: 2016,
      nowYear: 2026,
    });
    expect(result.risk).toBe("high");
    expect(result.label).toMatch(/Low km/i);
    expect(result.ageYears).toBe(10);
  });

  it("scores typical mileage as low risk", () => {
    const result = computeMileageTrust({
      mileageKm: TYPICAL_KM_PER_YEAR * 8,
      year: 2018,
      nowYear: 2026,
    });
    expect(result.risk).toBe("low");
  });

  it("flags high annual usage as medium", () => {
    const result = computeMileageTrust({
      mileageKm: 280_000,
      year: 2018,
      nowYear: 2026,
    });
    expect(result.risk).toBe("medium");
    expect(result.label).toMatch(/High usage/i);
  });

  it("returns unknown when year or mileage missing", () => {
    expect(computeMileageTrust({ mileageKm: 40_000, year: null }).risk).toBe("unknown");
    expect(computeMileageTrust({ mileageKm: null, year: 2019 }).risk).toBe("unknown");
  });
});
