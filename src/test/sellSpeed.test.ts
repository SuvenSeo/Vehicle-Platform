import { describe, expect, it } from "vitest";
import { computeSellSpeed } from "@/lib/sellSpeed";

const NOW = Date.parse("2026-07-14T12:00:00.000Z");

describe("computeSellSpeed", () => {
  it("scores high for strong deal, fresh listing, below median", () => {
    const result = computeSellSpeed({
      deal_score: 12,
      first_seen_at: "2026-07-13T12:00:00.000Z",
      price_lkr: 9_000_000,
      market_median_lkr: 10_000_000,
      nowMs: NOW,
    });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.band).toBe("fast");
    expect(result.belowMedian).toBe(true);
    expect(result.daysOnMarket).toBe(1);
  });

  it("scores lower when overpriced and stale", () => {
    const result = computeSellSpeed({
      deal_score: -12,
      first_seen_at: "2026-05-01T12:00:00.000Z",
      price_lkr: 12_000_000,
      market_median_lkr: 10_000_000,
      nowMs: NOW,
    });
    expect(result.score).toBeLessThan(40);
    expect(result.band).toBe("slow");
    expect(result.belowMedian).toBe(false);
    expect(result.daysOnMarket).toBeGreaterThan(40);
  });

  it("treats higher deal_score as faster", () => {
    const weak = computeSellSpeed({
      deal_score: -5,
      first_seen_at: "2026-07-10T12:00:00.000Z",
      price_lkr: 10_500_000,
      market_median_lkr: 10_000_000,
      nowMs: NOW,
    });
    const strong = computeSellSpeed({
      deal_score: 15,
      first_seen_at: "2026-07-10T12:00:00.000Z",
      price_lkr: 8_500_000,
      market_median_lkr: 10_000_000,
      nowMs: NOW,
    });
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.dealContribution).toBeGreaterThan(weak.dealContribution);
  });

  it("treats fresher first_seen_at as faster", () => {
    const stale = computeSellSpeed({
      deal_score: 5,
      first_seen_at: "2026-05-01T12:00:00.000Z",
      price_lkr: 9_500_000,
      market_median_lkr: 10_000_000,
      nowMs: NOW,
    });
    const fresh = computeSellSpeed({
      deal_score: 5,
      first_seen_at: "2026-07-14T06:00:00.000Z",
      price_lkr: 9_500_000,
      market_median_lkr: 10_000_000,
      nowMs: NOW,
    });
    expect(fresh.score).toBeGreaterThan(stale.score);
    expect(fresh.freshnessContribution).toBeGreaterThan(stale.freshnessContribution);
    expect(fresh.daysOnMarket).toBe(0);
  });

  it("boosts score when price is below median", () => {
    const above = computeSellSpeed({
      deal_score: 0,
      first_seen_at: "2026-07-10T12:00:00.000Z",
      price_lkr: 11_000_000,
      market_median_lkr: 10_000_000,
      nowMs: NOW,
    });
    const below = computeSellSpeed({
      deal_score: 0,
      first_seen_at: "2026-07-10T12:00:00.000Z",
      price_lkr: 9_000_000,
      market_median_lkr: 10_000_000,
      nowMs: NOW,
    });
    expect(below.score).toBeGreaterThan(above.score);
    expect(below.medianContribution).toBe(20);
    expect(above.medianContribution).toBe(0);
  });

  it("clamps score to 0–100", () => {
    const result = computeSellSpeed({
      deal_score: 40,
      first_seen_at: "2026-07-14T12:00:00.000Z",
      price_lkr: 1,
      market_median_lkr: 10_000_000,
      nowMs: NOW,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("falls back on deal_score when median price missing", () => {
    const result = computeSellSpeed({
      deal_score: 8,
      first_seen_at: "2026-07-12T12:00:00.000Z",
      nowMs: NOW,
    });
    expect(result.belowMedian).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(40);
  });
});
