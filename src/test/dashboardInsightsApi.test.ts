import { afterEach, describe, expect, it, vi } from "vitest";

describe("dashboard insights api helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests and normalizes dashboard insights", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        new_listings_24h: "14",
        segment_performance: [
          {
            segment: "suv",
            listing_count: "42",
            avg_price_lkr: "15800000",
            change_pct_30d: "2.7",
          },
        ],
        trending_models: [
          {
            make: "Toyota",
            model: "Vitz",
            listing_count: "21",
            avg_price_lkr: "7200000",
            movement_pct: "1.3",
            thumbnail_url: "https://example.com/vitz.jpg",
          },
        ],
        hot_deals: [
          {
            id: 7,
            make: "Honda",
            model: "Grace",
            year: 2018,
            district: "Colombo",
            source: "ikman",
            price_lkr: "9400000",
            deal_score: "11.4",
            thumbnail_url: "https://example.com/grace.jpg",
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const data = await (api as Record<string, unknown> & {
      getDashboardInsights: () => Promise<{
        new_listings_24h: number;
        segment_performance: Array<{ segment: string; listing_count: number; avg_price_lkr: number; change_pct_30d: number | null }>;
      }>;
    }).getDashboardInsights();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/stats/insights");
    expect(data.new_listings_24h).toBe(14);
    expect(data.segment_performance[0]).toMatchObject({
      segment: "suv",
      listing_count: 42,
      avg_price_lkr: 15800000,
      change_pct_30d: 2.7,
    });
  });

  it("requests district quick insight with district filter", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        district: "Colombo",
        listing_count: 80,
        avg_price_lkr: 11000000,
        median_price_lkr: 10800000,
        change_pct_30d: -1.2,
        top_models: [
          {
            make: "Toyota",
            model: "Aqua",
            listing_count: 15,
            avg_price_lkr: 8900000,
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const insight = await (api as Record<string, unknown> & {
      getDistrictQuickInsight: (district: string) => Promise<{ district: string; listing_count: number; change_pct_30d: number | null }>;
    }).getDistrictQuickInsight("Colombo");

    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/stats/district-insight");
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("district=Colombo");
    expect(insight).toMatchObject({
      district: "Colombo",
      listing_count: 80,
      change_pct_30d: -1.2,
    });
  });

  it("drops hot deals that do not have a positive numeric price", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        new_listings_24h: 1,
        segment_performance: [],
        trending_models: [],
        hot_deals: [
          {
            id: 10,
            make: "Toyota",
            model: "Vitz",
            year: 2018,
            district: "Colombo",
            source: "ikman",
            price_lkr: 0,
            deal_score: 12,
            thumbnail_url: null,
          },
          {
            id: 11,
            make: "Honda",
            model: "Fit",
            year: 2019,
            district: "Gampaha",
            source: "riyasewana",
            price_lkr: null,
            deal_score: 11,
            thumbnail_url: null,
          },
          {
            id: 12,
            make: "Suzuki",
            model: "Swift",
            year: 2017,
            district: "Kandy",
            source: "autolanka",
            price_lkr: "5200000",
            deal_score: "10.5",
            thumbnail_url: null,
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const data = await (api as Record<string, unknown> & {
      getDashboardInsights: () => Promise<{ hot_deals: Array<{ id: number; price_lkr: number }> }>;
    }).getDashboardInsights();

    expect(data.hot_deals).toEqual([
      expect.objectContaining({ id: 12, price_lkr: 5200000 }),
    ]);
  });
});
