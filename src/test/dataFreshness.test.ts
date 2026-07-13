import { describe, expect, it } from "vitest";
import {
  formatCompactAge,
  getListingDataFreshness,
  isListingDataStale,
  LISTING_DATA_STALE_HOURS,
} from "@/lib/dataFreshness";

describe("dataFreshness helpers", () => {
  const now = new Date("2026-07-13T18:00:00Z");

  it("marks listing data stale after six hours", () => {
    const freshAt = "2026-07-13T13:30:00Z";
    const staleAt = "2026-07-13T11:00:00Z";

    expect(isListingDataStale(freshAt, now)).toBe(false);
    expect(isListingDataStale(staleAt, now)).toBe(true);
    expect(LISTING_DATA_STALE_HOURS).toBe(6);
  });

  it("prefers latest_listing_at over stats last_updated", () => {
    const freshness = getListingDataFreshness({
      latestListingAt: "2026-07-13T17:30:00Z",
      lastUpdated: "2026-07-13T10:00:00Z",
      now,
    });

    expect(freshness.primaryAt).toBe("2026-07-13T17:30:00Z");
    expect(freshness.tone).toBe("live");
    expect(freshness.isStale).toBe(false);
    expect(freshness.dataAsOfLabel).toBe("Data as of just now");
  });

  it("falls back to last_updated when latest listing time is missing", () => {
    const freshness = getListingDataFreshness({
      lastUpdated: "2026-07-13T09:00:00Z",
      now,
    });

    expect(freshness.primaryAt).toBe("2026-07-13T09:00:00Z");
    expect(freshness.isStale).toBe(true);
    expect(freshness.staleNotice).toMatch(/9h old/i);
  });

  it("formats compact ages for feed rows", () => {
    expect(formatCompactAge("2026-07-13T17:58:00Z", now)).toBe("2m");
    expect(formatCompactAge("2026-07-13T12:00:00Z", now)).toBe("6h");
    expect(formatCompactAge(null, now)).toBe("—");
  });
});
