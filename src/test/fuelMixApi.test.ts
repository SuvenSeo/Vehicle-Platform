import { afterEach, describe, expect, it, vi } from "vitest";

describe("fuel mix and hybrid bands API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ── getFuelMix ─────────────────────────────────────────────────────────────

  describe("getFuelMix", () => {
    it("fetches /stats/fuel-mix and normalizes buckets", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total: 100,
          buckets: [
            { fuel_type: "petrol", count: 60, pct: 60.0 },
            { fuel_type: "hybrid", count: 25, pct: 25.0 },
            { fuel_type: "electric", count: 10, pct: 10.0 },
            { fuel_type: "diesel", count: 4, pct: 4.0 },
            { fuel_type: "other", count: 1, pct: 1.0 },
          ],
          generated_at: "2026-06-01T00:00:00Z",
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const api = await import("@/services/api");
      const data = await (
        api as typeof api & { getFuelMix: () => Promise<import("@/types/car").FuelMixData> }
      ).getFuelMix();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/stats/fuel-mix");
      expect(data.total).toBe(100);
      expect(data.buckets).toHaveLength(5);
      expect(data.buckets[0]).toMatchObject({ fuel_type: "petrol", count: 60, pct: 60 });
      expect(data.buckets[1]).toMatchObject({ fuel_type: "hybrid", count: 25, pct: 25 });
      expect(data.buckets[2]).toMatchObject({ fuel_type: "electric", count: 10, pct: 10 });
    });

    it("coerces numeric strings in buckets", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total: "50",
          buckets: [
            { fuel_type: "petrol", count: "50", pct: "100" },
          ],
          generated_at: "2026-06-01T00:00:00Z",
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const api = await import("@/services/api");
      const data = await (
        api as typeof api & { getFuelMix: () => Promise<import("@/types/car").FuelMixData> }
      ).getFuelMix();

      expect(data.total).toBe(50);
      expect(data.buckets[0].count).toBe(50);
      expect(data.buckets[0].pct).toBe(100);
    });

    it("returns empty buckets when server returns empty array", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ total: 0, buckets: [], generated_at: "2026-06-01T00:00:00Z" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const api = await import("@/services/api");
      const data = await (
        api as typeof api & { getFuelMix: () => Promise<import("@/types/car").FuelMixData> }
      ).getFuelMix();

      expect(data.total).toBe(0);
      expect(data.buckets).toHaveLength(0);
    });
  });

  // ── getHybridBands ─────────────────────────────────────────────────────────

  describe("getHybridBands", () => {
    it("fetches /stats/hybrid-bands and normalizes bands", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total_hybrids: 80,
          bands: [
            { label: "≤1500cc", cc_max: 1500, count: 50, median_price_lkr: 6_500_000 },
            { label: "1501–2000cc", cc_max: 2000, count: 25, median_price_lkr: 8_200_000 },
            { label: ">2000cc", cc_max: null, count: 5, median_price_lkr: 14_000_000 },
          ],
          generated_at: "2026-06-01T00:00:00Z",
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const api = await import("@/services/api");
      const data = await (
        api as typeof api & { getHybridBands: () => Promise<import("@/types/car").HybridBandsData> }
      ).getHybridBands();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/stats/hybrid-bands");
      expect(data.total_hybrids).toBe(80);
      expect(data.bands).toHaveLength(3);
      expect(data.bands[0]).toMatchObject({ label: "≤1500cc", cc_max: 1500, count: 50, median_price_lkr: 6_500_000 });
      expect(data.bands[2]).toMatchObject({ label: ">2000cc", cc_max: null, count: 5, median_price_lkr: 14_000_000 });
    });

    it("keeps cc_max as null for unbounded band", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total_hybrids: 10,
          bands: [
            { label: ">2000cc", cc_max: null, count: 10, median_price_lkr: 12_000_000 },
          ],
          generated_at: "2026-06-01T00:00:00Z",
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const api = await import("@/services/api");
      const data = await (
        api as typeof api & { getHybridBands: () => Promise<import("@/types/car").HybridBandsData> }
      ).getHybridBands();

      expect(data.bands[0].cc_max).toBeNull();
    });

    it("preserves null median_price_lkr when band has no priced listings", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total_hybrids: 3,
          bands: [
            { label: "≤1500cc", cc_max: 1500, count: 3, median_price_lkr: null },
          ],
          generated_at: "2026-06-01T00:00:00Z",
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const api = await import("@/services/api");
      const data = await (
        api as typeof api & { getHybridBands: () => Promise<import("@/types/car").HybridBandsData> }
      ).getHybridBands();

      expect(data.bands[0].median_price_lkr).toBeNull();
    });

    it("returns empty bands when server returns empty array", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ total_hybrids: 0, bands: [], generated_at: "2026-06-01T00:00:00Z" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const api = await import("@/services/api");
      const data = await (
        api as typeof api & { getHybridBands: () => Promise<import("@/types/car").HybridBandsData> }
      ).getHybridBands();

      expect(data.total_hybrids).toBe(0);
      expect(data.bands).toHaveLength(0);
    });
  });
});
