import { afterEach, describe, expect, it, vi } from "vitest";

describe("snapshot-only mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("refuses live API fallback for stats when VITE_SNAPSHOT_ONLY is set", async () => {
    vi.stubEnv("VITE_SNAPSHOT_BASE_URL", "https://cdn.example/latest");
    vi.stubEnv("VITE_SNAPSHOT_ONLY", "true");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    expect(api.SNAPSHOT_ONLY).toBe(true);

    await expect(api.getStats()).rejects.toMatchObject({ status: 503 });
    // Only the CDN snapshot fetch should run — never /stats/summary.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("cdn.example/latest/stats-summary.json");
  });

  it("returns empty listings instead of calling live API in snapshot-only mode", async () => {
    vi.stubEnv("VITE_SNAPSHOT_BASE_URL", "https://cdn.example/latest");
    vi.stubEnv("VITE_SNAPSHOT_ONLY", "true");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const result = await api.getListings({
      page: 1,
      sort: "newest",
      vehicle_category: "cars",
    });

    expect(result).toEqual({ listings: [], total: 0 });
    // Catalog fetch only — no /listings API call.
    expect(fetchMock.mock.calls.every((call) => String(call[0]).includes("cdn.example"))).toBe(true);
  });

  it("loads multi-part listing-catalog manifests from CDN", async () => {
    vi.stubEnv("VITE_SNAPSHOT_BASE_URL", "https://cdn.example/latest");
    vi.stubEnv("VITE_SNAPSHOT_ONLY", "true");

    const listingA = {
      id: 1,
      title: "Toyota Aqua",
      make: "Toyota",
      model: "Aqua",
      year: 2018,
      price_lkr: 5_500_000,
      mileage_km: 42000,
      district: "Colombo",
      source: "ikman",
      url: "https://example.com/1",
    };
    const listingB = {
      id: 2,
      title: "Honda Fit",
      make: "Honda",
      model: "Fit",
      year: 2017,
      price_lkr: 4_800_000,
      mileage_km: 61000,
      district: "Gampaha",
      source: "riyasewana",
      url: "https://example.com/2",
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/listing-catalog.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            parts: ["listing-catalog-part-000.json", "listing-catalog-part-001.json"],
            listing_count: 2,
            generated_at: "2026-07-30T00:00:00.000Z",
          }),
        };
      }
      if (url.endsWith("/listing-catalog-part-000.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [listingA] }),
        };
      }
      if (url.endsWith("/listing-catalog-part-001.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [listingB] }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const result = await api.getListings({
      page: 1,
      sort: "newest",
      vehicle_category: "cars",
    });

    expect(result.total).toBe(2);
    expect(result.listings.map((row) => row.id).sort()).toEqual([1, 2]);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/listing-catalog.json"),
        expect.stringContaining("/listing-catalog-part-000.json"),
        expect.stringContaining("/listing-catalog-part-001.json"),
      ]),
    );
    expect(fetchMock.mock.calls.every((call) => String(call[0]).includes("cdn.example"))).toBe(true);
  });

  it("fails closed when a multi-part catalog chunk is missing", async () => {
    vi.stubEnv("VITE_SNAPSHOT_BASE_URL", "https://cdn.example/latest");
    vi.stubEnv("VITE_SNAPSHOT_ONLY", "true");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/listing-catalog.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            parts: ["listing-catalog-part-000.json", "listing-catalog-part-001.json"],
            listing_count: 2,
          }),
        };
      }
      if (url.endsWith("/listing-catalog-part-000.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 1,
                title: "Toyota Aqua",
                make: "Toyota",
                model: "Aqua",
                year: 2018,
                price_lkr: 5_500_000,
                mileage_km: 42000,
                district: "Colombo",
                source: "ikman",
                url: "https://example.com/1",
              },
            ],
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const result = await api.getListings({
      page: 1,
      sort: "newest",
      vehicle_category: "cars",
    });

    expect(result).toEqual({ listings: [], total: 0 });
  });
});
