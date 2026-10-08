import { afterEach, describe, expect, it, vi } from "vitest";
import { SNAPSHOT_MISS, isSnapshotRequest, liveApiCalls, stubLiveApiFetch } from "@/test/snapshotFirstHelpers";

describe("getDistrictVelocity API helper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("fetches /stats/district-velocity and normalizes the response", async () => {
    const mockPayload = {
      points: [
        {
          district: "Colombo",
          lat: 6.9271,
          lng: 79.8612,
          listing_count: 120,
          new_7d_count: 18,
          velocity_score: 0.15,
        },
        {
          district: "Kandy",
          lat: 7.2906,
          lng: 80.6337,
          listing_count: 55,
          new_7d_count: 11,
          velocity_score: 0.2,
        },
      ],
      generated_at: "2026-04-19T12:00:00Z",
    };

    const fetchMock = stubLiveApiFetch(mockPayload);

    const api = await import("@/services/api");
    const data = await (
      api as Record<string, unknown> & {
        getDistrictVelocity: () => Promise<{
          points: Array<{
            district: string;
            lat: number;
            lng: number;
            listing_count: number;
            new_7d_count: number;
            velocity_score: number;
          }>;
          generated_at: string;
        }>;
      }
    ).getDistrictVelocity();

    const requests = liveApiCalls(fetchMock);
    expect(requests).toHaveLength(1);
    expect(String(requests[0]?.[0] ?? "")).toContain("/api/v1/stats/district-velocity");

    expect(data.points).toHaveLength(2);
    expect(data.points[0]).toMatchObject({
      district: "Colombo",
      lat: 6.9271,
      lng: 79.8612,
      listing_count: 120,
      new_7d_count: 18,
      velocity_score: 0.15,
    });
    expect(data.points[1]).toMatchObject({
      district: "Kandy",
      listing_count: 55,
      velocity_score: 0.2,
    });
    expect(data.generated_at).toBe("2026-04-19T12:00:00Z");
  });

  it("returns empty points array when API returns no points field", async () => {
    stubLiveApiFetch({ generated_at: "2026-04-19T12:00:00Z" });

    const api = await import("@/services/api");
    const data = await (
      api as Record<string, unknown> & {
        getDistrictVelocity: () => Promise<{ points: unknown[] }>;
      }
    ).getDistrictVelocity();

    expect(data.points).toEqual([]);
  });

  it("coerces string-typed numeric fields to numbers", async () => {
    stubLiveApiFetch({
      points: [
        {
          district: "Gampaha",
          lat: "7.0840",
          lng: "80.0098",
          listing_count: "40",
          new_7d_count: "8",
          velocity_score: "0.2",
        },
      ],
      generated_at: "2026-04-19T12:00:00Z",
    });

    const api = await import("@/services/api");
    const data = await (
      api as Record<string, unknown> & {
        getDistrictVelocity: () => Promise<{
          points: Array<{ district: string; listing_count: number; velocity_score: number }>;
        }>;
      }
    ).getDistrictVelocity();

    const gampaha = data.points[0];
    expect(typeof gampaha.listing_count).toBe("number");
    expect(typeof gampaha.velocity_score).toBe("number");
    expect(gampaha.listing_count).toBe(40);
    expect(gampaha.velocity_score).toBeCloseTo(0.2);
  });

  it("returns empty points array when points field is not an array", async () => {
    stubLiveApiFetch({ points: null, generated_at: "2026-04-19T12:00:00Z" });

    const api = await import("@/services/api");
    const data = await (
      api as Record<string, unknown> & {
        getDistrictVelocity: () => Promise<{ points: unknown[] }>;
      }
    ).getDistrictVelocity();

    expect(Array.isArray(data.points)).toBe(true);
    expect(data.points).toHaveLength(0);
  });

  it("retries district-velocity once after a transient 500", async () => {
    vi.useFakeTimers();
    const mockPayload = {
      points: [
        {
          district: "Colombo",
          lat: 6.9271,
          lng: 79.8612,
          listing_count: 10,
          new_7d_count: 2,
          velocity_score: 0.2,
        },
      ],
      generated_at: "2026-04-19T12:00:00Z",
    };

    // Snapshot probes are 404s; the first *live* attempt fails with a 500 and
    // the retry succeeds.
    let liveAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (isSnapshotRequest(input)) return { ...SNAPSHOT_MISS };
      liveAttempts += 1;
      if (liveAttempts === 1) {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: async () => "error on our side",
        };
      }
      return { ok: true, json: async () => mockPayload };
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const pending = (
      api as Record<string, unknown> & {
        getDistrictVelocity: () => Promise<{ points: unknown[] }>;
      }
    ).getDistrictVelocity();

    await vi.advanceTimersByTimeAsync(1500);
    const data = await pending;

    expect(liveApiCalls(fetchMock)).toHaveLength(2);
    expect(data.points).toHaveLength(1);
    vi.useRealTimers();
  });
});
