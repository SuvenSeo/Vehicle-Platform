import { describe, expect, it } from "vitest";
import { dedupeListings } from "@/services/api";
import type { CarListing } from "@/types/car";

function listing(overrides: Partial<CarListing> & { id: number }): CarListing {
  return {
    make: "Toyota",
    model: "Aqua",
    year: 2017,
    price_lkr: 8_400_000,
    district: "Colombo",
    source: "ikman",
    ...overrides,
  } as CarListing;
}

describe("dedupeListings", () => {
  it("keeps a single row per id", () => {
    const rows = [
      listing({ id: 1 }),
      listing({ id: 1, price_lkr: 8_000_000 }),
      listing({ id: 2, district: "Kandy" }),
    ];
    const result = dedupeListings(rows);
    expect(result.map((row) => row.id)).toEqual([1, 2]);
    // First occurrence wins so the freshest overlay row is retained.
    expect(result[0].price_lkr).toBe(8_400_000);
  });

  it("collapses the same source URL published under two ids", () => {
    const rows = [
      listing({ id: 10, detail_url: "https://ikman.lk/en/ad/toyota-aqua-2017-colombo" }),
      listing({ id: 11, detail_url: "https://ikman.lk/en/ad/toyota-aqua-2017-colombo?utm=1" }),
      listing({ id: 12, detail_url: "https://ikman.lk/en/ad/toyota-aqua-2017-kandy" }),
    ];
    expect(dedupeListings(rows).map((row) => row.id)).toEqual([10, 12]);
  });

  it("collapses near-identical rows that carry no URL", () => {
    const rows = [
      listing({ id: 20 }),
      listing({ id: 21 }),
      listing({ id: 22, price_lkr: 9_100_000 }),
      listing({ id: 23, source: "riyasewana" }),
    ];
    expect(dedupeListings(rows).map((row) => row.id)).toEqual([20, 22, 23]);
  });

  it("does not merge different cars from the same source", () => {
    const rows = [
      listing({ id: 30 }),
      listing({ id: 31, model: "Vezel", make: "Honda" }),
      listing({ id: 32, district: "Kandy" }),
    ];
    expect(dedupeListings(rows)).toHaveLength(3);
  });

  it("passes short and empty collections straight through", () => {
    const single = [listing({ id: 40 })];
    expect(dedupeListings(single)).toBe(single);
    expect(dedupeListings([])).toEqual([]);
  });
});
