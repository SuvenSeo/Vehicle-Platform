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
});
