import { afterEach, describe, expect, it, vi } from "vitest";

describe("api module", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exports sendChatMessage", async () => {
    const api = await import("@/services/api");

    expect(typeof (api as Record<string, unknown>).sendChatMessage).toBe("function");
  });

  it("formats prices in millions", async () => {
    const api = await import("@/services/api");
    const formatPrice = (api as Record<string, any>).formatPrice as (value: number | null) => string;

    expect(formatPrice(null)).toBe("N/A");
    expect(formatPrice(925000)).toBe("Rs. 0.93M");
    expect(formatPrice(2500000)).toBe("Rs. 2.50M");
  });

  it("posts chat payloads to the backend api", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: "ok" }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const result = await (api as Record<string, any>).sendChatMessage("hello", [
      { role: "user", content: "previous message" },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/v1/chat");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body)).toEqual({
      message: "hello",
      history: [{ role: "user", content: "previous message" }],
    });
    expect(result).toEqual({ response: "ok", listings: [] });
  });

  it("exports listing detail helpers", async () => {
    const api = await import("@/services/api");

    expect(typeof (api as Record<string, unknown>).getListing).toBe("function");
    expect(typeof (api as Record<string, unknown>).getSimilarListings).toBe("function");
  });

  it("requests listing detail and similar listings from the backend api", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 42 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 7 }],
      });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const detail = await (api as Record<string, any>).getListing("42");
    const similar = await (api as Record<string, any>).getSimilarListings("42");

    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/v1/listings/42");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/api/v1/listings/42/similar");
    expect(detail).toMatchObject({ id: 42 });
    expect(similar[0]).toMatchObject({ id: 7 });
  });

  it("does not infer listing specs from title or description text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 77,
        source: "ikman",
        source_id: "ik-77",
        url: "https://ikman.lk/en/ad/example-77",
        detail_url: "https://ikman.lk/en/ad/example-77",
        external_url: "https://ikman.lk/en/ad/example-77",
        title: "Toyota Hilux diesel manual pickup used 189,000 km 2500cc",
        description: "Excellent condition diesel manual pickup",
        make: "Toyota",
        model: "Hilux",
        year: 2016,
        price_lkr: 10200000,
        deal_score: 3.1,
        market_median_lkr: 10300000,
        mileage: null,
        condition: null,
        transmission: null,
        fuel_type: null,
        body_type: null,
        engine_capacity: null,
        scraped_at: "2026-04-21T10:30:00Z",
        first_seen_at: "2026-04-21T10:30:00Z",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const detail = await (api as Record<string, any>).getListing("77");

    expect(detail.mileage_km).toBeNull();
    expect(detail.engine_cc).toBeUndefined();
    expect(detail.condition).toBeUndefined();
    expect(detail.transmission).toBeUndefined();
    expect(detail.fuel_type).toBeUndefined();
    expect(detail.body_type).toBeUndefined();
  });

  it("sends source filter when requesting listings", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    await (api as Record<string, any>).getListings({
      sort: "newest",
      page: 1,
      source: "ikman",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = String(fetchMock.mock.calls[0]?.[0] || "");
    expect(requestedUrl).toContain("/api/v1/listings");
    expect(requestedUrl).toContain("source=ikman");
  });

  it("normalizes thumbnail from image fields when thumbnail_url is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 100,
            year: 2020,
            mileage: 30000,
            price_lkr: "7500000",
            deal_score: "9.2",
            market_median_lkr: "8000000",
            images: ["https://example.com/primary.jpg"],
          },
        ],
        total: 1,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const result = await (api as Record<string, any>).getListings({
      sort: "newest",
      page: 1,
    });

    expect(result.listings[0]?.thumbnail_url).toBe("https://example.com/primary.jpg");
  });

  it("posts custom vehicle estimate payload to backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vehicle_label: "Toyota Aqua (2018)",
        estimated_low_lkr: 6200000,
        estimated_median_lkr: 6900000,
        estimated_high_lkr: 7600000,
        comparable_count: 12,
        confidence: "high",
        verdict: "Within market range",
        verdict_label: "Fair price",
        delta_pct: 1.8,
        methodology: "test",
        comparables: [],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const result = await (api as Record<string, any>).estimateCustomVehicle({
      make: "Toyota",
      model: "Aqua",
      year: 2018,
      mileage_km: 54000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/listings/custom-estimate");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || "{}"))).toMatchObject({
      make: "Toyota",
      model: "Aqua",
      year: 2018,
      mileage_km: 54000,
    });
    expect(result.estimated_median_lkr).toBe(6900000);
  });

  it("falls back to deriving sources from listings when sources endpoint fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        text: async () => JSON.stringify({ detail: [{ msg: "Input should be integer" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { source: "Ikman" },
            { source: "ikman" },
            { source: "auto-lanka" },
          ],
          total: 3,
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const result = await (api as Record<string, any>).getListingSources();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/listings/sources");
    expect(String(fetchMock.mock.calls[1]?.[0] || "")).toContain("/api/v1/listings");
    expect(result).toEqual([
      { source: "ikman", label: "Ikman", count: 2 },
      { source: "autolanka", label: "AutoLanka", count: 1 },
    ]);
  });

  it("keeps freshness metadata truthful in stats responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total_listings: 120,
        avg_price_lkr: 7800000,
        listings_this_week: 11,
        price_change_mom: -2.1,
        good_deals_count: 9,
        district_count: 6,
        source_count: 4,
        last_updated: null,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const stats = await (api as Record<string, any>).getStats();

    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/stats/summary");
    expect(stats.source_count).toBe(4);
    expect(stats.last_updated).toBeNull();
  });

  it("normalizes live market snapshot responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generated_at: "2026-05-21T10:00:00Z",
        total_listings: "120",
        priced_listings: "110",
        unavailable_price_listings: "10",
        avg_price_lkr: "7800000",
        latest_listing_at: "2026-05-21T09:59:00Z",
        active_scrape_sources: ["riyahub"],
        latest_run: {
          source: "riyahub",
          status: "RUNNING",
          listings_found: "20",
          listings_new: "3",
        },
        source_status: [],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const snapshot = await (api as Record<string, any>).getLiveMarketSnapshot();

    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/stats/live");
    expect(snapshot).toMatchObject({
      total_listings: 120,
      priced_listings: 110,
      unavailable_price_listings: 10,
      avg_price_lkr: 7800000,
      active_scrape_sources: ["riyahub"],
    });
  });

  it("maps district top-model metadata from district price aggregates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        points: [
          {
            district: "Colombo",
            avg_price_lkr: 11750000,
            count: 3041,
            lat: 6.9271,
            lng: 79.8612,
            top_make: "Toyota",
            top_model: "Vitz",
            top_model_count: 186,
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const districts = await (api as Record<string, any>).getDistrictPrices();

    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/stats/district-prices");
    expect(districts[0]).toMatchObject({
      district: "Colombo",
      listing_count: 3041,
      top_make: "Toyota",
      top_model: "Vitz",
      top_model_count: 186,
    });
  });

  it("fetches listing search suggestions for live typeahead", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          id: 501,
          make: "Honda",
          model: "Vezel",
          year: 2018,
          district: "Colombo",
          price_lkr: 12800000,
          source: "ikman",
        },
      ]),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const suggestions = await (api as Record<string, any>).getListingSearchSuggestions("vez", 5);

    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/listings/search-suggestions");
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("q=vez");
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("limit=5");
    expect(suggestions[0]).toMatchObject({
      id: 501,
      make: "Honda",
      model: "Vezel",
      year: 2018,
      district: "Colombo",
      price_lkr: 12800000,
      source: "ikman",
    });
  });

  it("requests listings with keyword search filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    await (api as Record<string, any>).getListings({ q: "Toyota Axio", sort: "newest", page: 1 });

    const url = String(fetchMock.mock.calls[0]?.[0] || "");
    expect(url).toContain("/api/v1/listings");
    expect(url).toContain("q=Toyota+Axio");
  });

  it("returns trend coverage metadata with trend points", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        coverage_scope: "district_fallback",
        coverage_note: "District samples are thin.",
        points: [
          {
            year: 2026,
            month: 4,
            median_price_lkr: 7200000,
            avg_price_lkr: 7300000,
            listing_count: 18,
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const series = await (api as Record<string, any>).getPriceTrendSeries("Toyota", "Vitz", undefined, "Kandy");

    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/stats/trends");
    expect(series.coverage_scope).toBe("district_fallback");
    expect(series.coverage_note).toBe("District samples are thin.");
    expect(series.points[0]).toMatchObject({
      month: "2026-04",
      median_price: 7200000,
      sample_count: 18,
    });
  });

  it("posts user feedback and returns a receipt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 12,
        category: "bug",
        route: "/trends",
        status: "new",
        created_at: "2026-05-21T10:00:00Z",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const receipt = await (api as Record<string, any>).sendFeedback({
      category: "bug",
      route: "/trends",
      message: "Trend fallback button needs checking",
    });

    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/feedback");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body)).toMatchObject({
      category: "bug",
      route: "/trends",
    });
    expect(receipt).toMatchObject({ id: 12, category: "bug", status: "new" });
  });

  it("falls back to custom estimate when strict estimate lacks comparables", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => JSON.stringify({ detail: "Not enough data to estimate price for this vehicle." }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          vehicle_label: "Toyota Aqua (2018)",
          estimated_low_lkr: 6200000,
          estimated_median_lkr: 6900000,
          estimated_high_lkr: 7600000,
          comparable_count: 9,
          confidence: "medium",
          verdict: "Within market range",
          verdict_label: "Fair price",
          delta_pct: null,
          methodology: "fallback custom-estimate strategy",
          comparables: [],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const result = await (api as Record<string, any>).estimatePrice({
      make: "Toyota",
      model: "Aqua",
      year: 2018,
      condition: "reconditioned",
      mileage_km: 55000,
      transmission: "automatic",
      fuel_type: "hybrid",
      district: "Colombo",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/listings/estimate");
    expect(String(fetchMock.mock.calls[1]?.[0] || "")).toContain("/api/v1/listings/custom-estimate");
    expect(result).toMatchObject({
      low: 6200000,
      median: 6900000,
      high: 7600000,
      comparable_count: 9,
      confidence: "medium",
      methodology: "fallback custom-estimate strategy",
    });
  });

  it("fetches seller trust profile details from listing source endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "ikman",
        source_url: "https://ikman.lk/en/ad/example",
        seller_name: "Sell Fast | LSJ Computer Centre",
        seller_type: "dealer",
        member_since: "2019",
        listing_count: 142,
        review_count: 18,
        rating: 4.2,
        phone_numbers: ["0768481559"],
        whatsapp_numbers: ["94768481559"],
        verified_badges: ["Verified Dealer"],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const profile = await (api as Record<string, any>).getSellerTrustProfile(123);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/listings/123/seller-profile");
    expect(profile).toMatchObject({
      source: "ikman",
      seller_name: "Sell Fast | LSJ Computer Centre",
      seller_type: "dealer",
      member_since: "2019",
      listing_count: 142,
      review_count: 18,
      rating: 4.2,
    });
  });
});
