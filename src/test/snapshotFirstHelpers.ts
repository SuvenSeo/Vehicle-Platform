import { vi } from "vitest";

/**
 * `src/services/api.ts` is snapshot-first: public helpers read the bundled/CDN
 * JSON snapshot before falling back to the live `/api/v1` API. Tests that cover
 * the live API path answer every `/snapshots/...` probe with a 404 — the real
 * "snapshot not published yet" case — so the helper falls through to the
 * backend route under test.
 */
export const SNAPSHOT_MISS = {
  ok: false,
  status: 404,
  statusText: "Not Found",
  json: async () => ({}),
  text: async () => "",
};

export function isSnapshotRequest(input: unknown): boolean {
  return String(input).includes("/snapshots/");
}

/** Only the calls that actually reached the live `/api/v1` backend. */
export function liveApiCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/v1/"));
}

/** Fetch stub: 404 for snapshot probes, `payload` for every live API call. */
export function stubLiveApiFetch(payload: unknown) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (isSnapshotRequest(input)) return { ...SNAPSHOT_MISS };
    return { ok: true, json: async () => payload };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
