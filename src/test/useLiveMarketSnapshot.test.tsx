import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLiveMarketSnapshot: vi.fn(),
  getLiveMarketStreamUrl: vi.fn(() => "https://example.test/api/v1/stats/live/stream"),
  // Falsy so the hook takes the EventSource path instead of snapshot polling.
  SNAPSHOT_BASE: null as string | null,
  SNAPSHOT_ONLY: false,
}));

vi.mock("@/services/api", () => ({
  getLiveMarketSnapshot: mocks.getLiveMarketSnapshot,
  getLiveMarketStreamUrl: mocks.getLiveMarketStreamUrl,
  SNAPSHOT_BASE: mocks.SNAPSHOT_BASE,
  SNAPSHOT_ONLY: mocks.SNAPSHOT_ONLY,
}));

import { useLiveMarketSnapshot } from "@/hooks/useLiveMarketSnapshot";

const RECONNECT_BASE_MS = 15_000;
const POLL_INTERVAL_MS = 60_000;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  onerror: ((ev?: unknown) => void) | null = null;
  closed = false;
  private listeners = new Map<string, Set<(ev: unknown) => void>>();

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (ev: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(cb);
  }

  removeEventListener(type: string, cb: (ev: unknown) => void) {
    this.listeners.get(type)?.delete(cb);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, payload: unknown) {
    this.listeners.get(type)?.forEach((cb) => cb(payload));
  }
}

describe("useLiveMarketSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    mocks.getLiveMarketSnapshot.mockReset();
    mocks.getLiveMarketSnapshot.mockResolvedValue({ generated_at: "2026-09-19T00:00:00Z" });
    Object.defineProperty(window, "EventSource", {
      configurable: true,
      writable: true,
      value: FakeEventSource,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the stream instead of polling when EventSource is available", () => {
    const { unmount } = renderHook(() => useLiveMarketSnapshot());

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toContain("/stats/live/stream");
    expect(mocks.getLiveMarketSnapshot).not.toHaveBeenCalled();

    unmount();
  });

  it("keeps polling but retries the stream after a transient error", async () => {
    const { unmount } = renderHook(() => useLiveMarketSnapshot());
    const first = FakeEventSource.instances[0];

    await act(async () => {
      first.onerror?.();
    });

    // Polling fallback engages immediately so data keeps flowing...
    expect(mocks.getLiveMarketSnapshot).toHaveBeenCalledTimes(1);
    expect(first.closed).toBe(true);

    // ...and the stream is retried after the first backoff step.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);
    });
    expect(FakeEventSource.instances).toHaveLength(2);

    unmount();
  });

  it("backs off further on repeated failures", async () => {
    const { unmount } = renderHook(() => useLiveMarketSnapshot());

    await act(async () => {
      FakeEventSource.instances[0].onerror?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);
    });
    expect(FakeEventSource.instances).toHaveLength(2);

    await act(async () => {
      FakeEventSource.instances[1].onerror?.();
    });

    // Second retry is not due yet at the first backoff interval...
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS - 1_000);
    });
    expect(FakeEventSource.instances).toHaveLength(2);

    // ...but lands on the doubled interval (30s from the second failure).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(FakeEventSource.instances).toHaveLength(3);

    unmount();
  });

  it("returns to the live stream and stops polling once a frame arrives", async () => {
    const { unmount } = renderHook(() => useLiveMarketSnapshot());

    await act(async () => {
      FakeEventSource.instances[0].onerror?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);
    });

    await act(async () => {
      FakeEventSource.instances[1].emit("snapshot", {
        data: JSON.stringify({ generated_at: "2026-09-19T00:00:00Z" }),
      });
    });

    const callsAfterRecovery = mocks.getLiveMarketSnapshot.mock.calls.length;

    // The polling fallback must be torn down now that SSE is healthy again.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(mocks.getLiveMarketSnapshot.mock.calls.length).toBe(callsAfterRecovery);

    unmount();
  });

  it("cancels the pending reconnect when the last subscriber unmounts", async () => {
    const { unmount } = renderHook(() => useLiveMarketSnapshot());

    await act(async () => {
      FakeEventSource.instances[0].onerror?.();
    });

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(240_000);
    });
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("ignores malformed frames without dropping the stream", async () => {
    const { unmount } = renderHook(() => useLiveMarketSnapshot());

    await act(async () => {
      FakeEventSource.instances[0].emit("snapshot", { data: "{not json" });
    });

    expect(FakeEventSource.instances[0].closed).toBe(false);
    expect(FakeEventSource.instances).toHaveLength(1);

    unmount();
  });
});