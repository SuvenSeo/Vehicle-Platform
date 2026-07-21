import { describe, expect, it } from "vitest";
import { QUERY_STALE } from "@/lib/queryPolicy";

describe("QUERY_STALE", () => {
  it("keeps listings fresher than market aggregates", () => {
    expect(QUERY_STALE.listings).toBeLessThan(QUERY_STALE.stats);
    expect(QUERY_STALE.stats).toBeLessThanOrEqual(QUERY_STALE.hub);
    expect(QUERY_STALE.hub).toBeLessThan(QUERY_STALE.market);
  });
});
