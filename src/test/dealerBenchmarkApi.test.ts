import { afterEach, describe, expect, it, vi } from "vitest";
import type { UrlBenchmarkResult } from "@/services/api";

const SAMPLE_RESULT: UrlBenchmarkResult = {
  url: "https://ikman.lk/en/ad/toyota-vitz-2018/123",
  make: "Toyota",
  model: "Vitz",
  year: 2018,
  listing_price: 7_200_000,
  market_median: 7_500_000,
  price_gap_pct: -4.0,
  comparable_count: 12,
  error: null,
};

describe("benchmarkDealerUrls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts to /dealer/benchmark-urls with the given URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [SAMPLE_RESULT],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { benchmarkDealerUrls } = await import("@/services/api");
    const urls = ["https://ikman.lk/en/ad/toyota-vitz-2018/123"];
    const results = await benchmarkDealerUrls(urls);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/v1/dealer/benchmark-urls");
    expect(calledOptions.method).toBe("POST");

    const body = JSON.parse(calledOptions.body as string) as { urls: string[] };
    expect(body.urls).toEqual(urls);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      make: "Toyota",
      model: "Vitz",
      year: 2018,
      market_median: 7_500_000,
      price_gap_pct: -4.0,
    });
  });

  it("returns an empty array when the server responds with []", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { benchmarkDealerUrls } = await import("@/services/api");
    const results = await benchmarkDealerUrls([]);
    expect(results).toEqual([]);
  });

  it("returns an empty array when the response is not an array", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: "bad" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { benchmarkDealerUrls } = await import("@/services/api");
    const results = await benchmarkDealerUrls(["https://example.com"]);
    expect(results).toEqual([]);
  });

  it("throws when the server returns a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      text: async () => JSON.stringify({ detail: "Maximum 50 URLs per request" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { benchmarkDealerUrls } = await import("@/services/api");
    await expect(benchmarkDealerUrls(["https://x.com"])).rejects.toThrow();
  });

  it("passes all urls in the request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { ...SAMPLE_RESULT, url: "https://a.com" },
        { ...SAMPLE_RESULT, url: "https://b.com", make: "Honda" },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { benchmarkDealerUrls } = await import("@/services/api");
    const results = await benchmarkDealerUrls(["https://a.com", "https://b.com"]);

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string) as { urls: string[] };
    expect(body.urls).toEqual(["https://a.com", "https://b.com"]);
    expect(results).toHaveLength(2);
    expect(results[1].make).toBe("Honda");
  });

  it("exports the UrlBenchmarkResult type correctly", async () => {
    const result: UrlBenchmarkResult = {
      url: "https://example.com",
      make: null,
      model: null,
      year: null,
      listing_price: null,
      market_median: null,
      price_gap_pct: null,
      comparable_count: 0,
      error: "Could not identify vehicle from URL",
    };
    expect(result.error).toContain("identify");
    expect(result.comparable_count).toBe(0);
  });
});
