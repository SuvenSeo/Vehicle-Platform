import { afterEach, describe, expect, it, vi } from "vitest";

describe("pipeline operations api helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests and normalizes pipeline run history", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        count: 1,
        runs: [
          {
            id: 10,
            source: "ikman",
            status: "SUCCESS",
            started_at: "2026-04-18T12:00:00Z",
            finished_at: "2026-04-18T12:06:00Z",
            listings_found: "88",
            listings_new: "12",
            error_message: null,
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const payload = await (api as Record<string, unknown> & {
      getPipelineRuns: (limit?: number) => Promise<{ count: number; runs: Array<{ id: number; listings_found: number; listings_new: number }> }>;
    }).getPipelineRuns(5);

    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/pipeline/runs");
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("limit=5");
    expect(payload.count).toBe(1);
    expect(payload.runs[0]).toMatchObject({
      id: 10,
      listings_found: 88,
      listings_new: 12,
    });
  });

  it("posts trigger payload for sync jobs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        accepted: true,
        job: "sync",
        pid: 1234,
        command: "python run_sync.py",
        started_at: "2026-04-18T12:10:00Z",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const api = await import("@/services/api");
    const payload = await (api as Record<string, unknown> & {
      triggerPipelineJob: (job: "sync" | "alt_sync", adminKey?: string) => Promise<{ accepted: boolean; job: string; pid: number }>;
    }).triggerPipelineJob("sync", "secret");

    expect(payload).toMatchObject({ accepted: true, job: "sync", pid: 1234 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ "X-Admin-Key": "secret" }),
    });
    expect(String(fetchMock.mock.calls[0]?.[0] || "")).toContain("/api/v1/pipeline/trigger");
  });
});
