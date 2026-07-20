import { describe, expect, it } from "vitest";
import { formatPriceLkrMillions, formatPriceTickMillions, formatRelativeTime } from "@/lib/formatting";

describe("formatting helpers", () => {
  it("returns N/A when price is not provided", () => {
    expect(formatPriceLkrMillions(null)).toBe("N/A");
  });

  it("formats prices using million notation", () => {
    expect(formatPriceLkrMillions(747000)).toBe("Rs. 0.75M");
    expect(formatPriceLkrMillions(7250000)).toBe("Rs. 7.25M");
  });

  it("formats axis ticks in million units", () => {
    expect(formatPriceTickMillions(7250000)).toBe("7M");
    expect(formatPriceTickMillions(14990000)).toBe("15M");
  });

  it("formats relative timestamps in hour/day buckets", () => {
    const now = new Date("2026-04-18T12:00:00Z");

    expect(formatRelativeTime(null, now)).toBe("never");
    expect(formatRelativeTime("2026-04-18T11:45:00Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-04-18T10:30:00Z", now)).toBe("1h ago");
    expect(formatRelativeTime("2026-04-16T12:00:00Z", now)).toBe("2d ago");
  });
});