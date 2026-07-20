import { describe, expect, it } from "vitest";
import { getListingDealLabel, getListingRecencyLabel } from "@/lib/listing-card-meta";

describe("listing card metadata helpers", () => {
  it("maps deal scores to Good Deal, Fair Price, and Overpriced", () => {
    expect(getListingDealLabel(12)).toBe("Good Deal");
    expect(getListingDealLabel(3)).toBe("Fair Price");
    expect(getListingDealLabel(-8)).toBe("Overpriced");
  });

  it("formats recency from first_seen_at when present", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
    expect(getListingRecencyLabel(twoHoursAgo)).toBe("2h ago");
  });

  it("falls back to Today when date is missing", () => {
    expect(getListingRecencyLabel(null)).toBe("Today");
  });
});
