import { afterEach, describe, expect, it, vi } from "vitest";

describe("getImportEraSplit API helper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function makeEraMakeRow(make: string, preCount: number, preMedian: number | null, postCount: number, postMedian: number | null) {
    return {
      make,
      pre_freeze: {
        era: "pre_freeze",
        label: "Pre-freeze (≤2024)",
        count: preCount,
        median_price_lkr: preMedian,
      },
      post_freeze: {
        era: "post_freeze",
        label: "Post-freeze (≥2025)",
        count: postCount,
        median_price_lkr: postMedian,
      },
    };
  }

  it("fetches /stats/import-era-split and returns normalized data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        makes: [
          makeEraMakeRow("Toyota", 120, 5_500_000, 30, 8_200_000),
          makeEraMakeRow("Honda", 80, 4_800_000, 20, 7_100_000),
        ],
        freeze_boundary_year: 2025,
        generated_at: "2026-07-13T10:00:00Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const data = await (
      api as typeof api & { getImportEraSplit: () => Promise<import("@/types/car").ImportEraSplitData> }
    ).getImportEraSplit();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/stats/import-era-split");
    expect(data.makes).toHaveLength(2);
    expect(data.freeze_boundary_year).toBe(2025);
    expect(data.makes[0].make).toBe("Toyota");
    expect(data.makes[0].pre_freeze.count).toBe(120);
    expect(data.makes[0].pre_freeze.median_price_lkr).toBe(5_500_000);
    expect(data.makes[0].post_freeze.count).toBe(30);
    expect(data.makes[0].post_freeze.median_price_lkr).toBe(8_200_000);
  });

  it("passes top_n as query parameter when supplied", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        makes: [],
        freeze_boundary_year: 2025,
        generated_at: "2026-07-13T10:00:00Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    await (
      api as typeof api & { getImportEraSplit: (topN?: number) => Promise<import("@/types/car").ImportEraSplitData> }
    ).getImportEraSplit(5);

    const url = String(fetchMock.mock.calls[0]?.[0] || "");
    expect(url).toContain("top_n=5");
  });

  it("returns empty makes array when server returns empty list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        makes: [],
        freeze_boundary_year: 2025,
        generated_at: "2026-07-13T10:00:00Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const data = await (
      api as typeof api & { getImportEraSplit: () => Promise<import("@/types/car").ImportEraSplitData> }
    ).getImportEraSplit();

    expect(data.makes).toHaveLength(0);
  });

  it("preserves null median_price_lkr for eras with no priced listings", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        makes: [makeEraMakeRow("Suzuki", 50, 3_000_000, 0, null)],
        freeze_boundary_year: 2025,
        generated_at: "2026-07-13T10:00:00Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const data = await (
      api as typeof api & { getImportEraSplit: () => Promise<import("@/types/car").ImportEraSplitData> }
    ).getImportEraSplit();

    expect(data.makes[0].post_freeze.median_price_lkr).toBeNull();
    expect(data.makes[0].post_freeze.count).toBe(0);
  });

  it("normalizes unknown era value to pre_freeze", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        makes: [
          {
            make: "Nissan",
            pre_freeze: { era: "bogus_era", label: "Bad", count: 10, median_price_lkr: 4_000_000 },
            post_freeze: { era: "post_freeze", label: "Post-freeze (≥2025)", count: 5, median_price_lkr: 6_000_000 },
          },
        ],
        freeze_boundary_year: 2025,
        generated_at: "2026-07-13T10:00:00Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const data = await (
      api as typeof api & { getImportEraSplit: () => Promise<import("@/types/car").ImportEraSplitData> }
    ).getImportEraSplit();

    expect(data.makes[0].pre_freeze.era).toBe("pre_freeze");
  });

  it("uses default freeze_boundary_year of 2025 when server omits it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        makes: [],
        generated_at: "2026-07-13T10:00:00Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const data = await (
      api as typeof api & { getImportEraSplit: () => Promise<import("@/types/car").ImportEraSplitData> }
    ).getImportEraSplit();

    expect(data.freeze_boundary_year).toBe(2025);
  });

  it("filters out makes with empty make string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        makes: [
          makeEraMakeRow("", 10, 4_000_000, 5, 5_000_000),
          makeEraMakeRow("Toyota", 20, 5_000_000, 8, 7_000_000),
        ],
        freeze_boundary_year: 2025,
        generated_at: "2026-07-13T10:00:00Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const data = await (
      api as typeof api & { getImportEraSplit: () => Promise<import("@/types/car").ImportEraSplitData> }
    ).getImportEraSplit();

    expect(data.makes).toHaveLength(1);
    expect(data.makes[0].make).toBe("Toyota");
  });

  it("includes label fields in era entries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        makes: [makeEraMakeRow("Mazda", 40, 4_200_000, 12, 6_800_000)],
        freeze_boundary_year: 2025,
        generated_at: "2026-07-13T10:00:00Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const data = await (
      api as typeof api & { getImportEraSplit: () => Promise<import("@/types/car").ImportEraSplitData> }
    ).getImportEraSplit();

    expect(typeof data.makes[0].pre_freeze.label).toBe("string");
    expect(typeof data.makes[0].post_freeze.label).toBe("string");
    expect(data.makes[0].pre_freeze.label.length).toBeGreaterThan(0);
  });
});
