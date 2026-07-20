import { describe, expect, it } from "vitest";
import {
  GOOD_DEAL_MULTIPLIER,
  OVERPRICED_MULTIPLIER,
  bandFromDealScore,
  computeDealLadder,
  dealScoreFromPrice,
} from "@/lib/dealLadder";

describe("dealLadder thresholds", () => {
  it("maps Good Deal / Fair / Overpriced like FairPriceIndicator", () => {
    expect(bandFromDealScore(8)).toBe("good_deal");
    expect(bandFromDealScore(12)).toBe("good_deal");
    expect(bandFromDealScore(7.9)).toBe("fair");
    expect(bandFromDealScore(0)).toBe("fair");
    expect(bandFromDealScore(-4.9)).toBe("fair");
    expect(bandFromDealScore(-5)).toBe("overpriced");
    expect(bandFromDealScore(-20)).toBe("overpriced");
  });

  it("uses 0.92 / 1.05 multipliers for score ± thresholds", () => {
    expect(GOOD_DEAL_MULTIPLIER).toBeCloseTo(0.92);
    expect(OVERPRICED_MULTIPLIER).toBeCloseTo(1.05);
  });

  it("mirrors deal_scores.py percentage-below-median formula", () => {
    const median = 10_000_000;
    expect(dealScoreFromPrice(9_200_000, median)).toBe(8);
    expect(dealScoreFromPrice(10_500_000, median)).toBe(-5);
    expect(dealScoreFromPrice(8_000_000, median)).toBe(20);
  });
});

describe("computeDealLadder", () => {
  const median = 10_000_000;

  it("returns null for invalid inputs", () => {
    expect(computeDealLadder({ askingPrice: 0, marketMedianLkr: median })).toBeNull();
    expect(computeDealLadder({ askingPrice: 5_000_000, marketMedianLkr: 0 })).toBeNull();
    expect(computeDealLadder({ askingPrice: NaN, marketMedianLkr: median })).toBeNull();
  });

  it("prices Great/Good Deal target at median × 0.92", () => {
    const ladder = computeDealLadder({ askingPrice: 9_800_000, marketMedianLkr: median });
    expect(ladder).not.toBeNull();
    expect(ladder!.goodDealPrice).toBe(9_200_000);
    expect(ladder!.overpricedThreshold).toBe(10_500_000);
  });

  it("classifies asking above median × 1.05 as overpriced and cuts to Good Deal", () => {
    const ladder = computeDealLadder({ askingPrice: 11_000_000, marketMedianLkr: median });
    expect(ladder!.band).toBe("overpriced");
    expect(ladder!.bandLabel).toBe("Overpriced");
    expect(ladder!.cutToGoodDeal).toBe(1_800_000);
    expect(ladder!.cutToFair).toBeGreaterThan(0);
    expect(ladder!.headline).toContain("Good Deal");
  });

  it("classifies mid-band prices as Fair with cut to Good Deal", () => {
    const ladder = computeDealLadder({ askingPrice: 10_000_000, marketMedianLkr: median });
    expect(ladder!.band).toBe("fair");
    expect(ladder!.cutToGoodDeal).toBe(800_000);
    expect(ladder!.cutToFair).toBe(0);
    expect(ladder!.headline).toMatch(/Cut .* to hit Good Deal/);
  });

  it("reports zero cut when already a Good Deal", () => {
    const ladder = computeDealLadder({ askingPrice: 9_000_000, marketMedianLkr: median });
    expect(ladder!.band).toBe("good_deal");
    expect(ladder!.cutToGoodDeal).toBe(0);
    expect(ladder!.headline).toBe("Already a Good Deal");
  });

  it("marks the active rung on the ladder", () => {
    const ladder = computeDealLadder({ askingPrice: 10_000_000, marketMedianLkr: median });
    const active = ladder!.rungs.filter((r) => r.active);
    expect(active).toHaveLength(1);
    expect(active[0].band).toBe("fair");
  });
});
