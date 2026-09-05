import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStaleness } from "@/hooks/useStaleness";
import { STATS_SWR } from "@/lib/queryPolicy";

let sharedClient: QueryClient | null = null;

function Wrapper({ children }: { children: ReactNode }) {
  if (!sharedClient) {
    sharedClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  }
  return <QueryClientProvider client={sharedClient}>{children}</QueryClientProvider>;
}

const wrapper = Wrapper;

describe("useStaleness", () => {
  it("labels fresh timestamps as just now", () => {
    const now = new Date("2026-07-13T18:00:00Z");
    const { result } = renderHook(
      () => useStaleness("2026-07-13T17:59:30Z", { now }),
      { wrapper },
    );
    expect(result.current.updatedXMinAgo).toBe("updated just now");
    expect(result.current.isStale).toBe(false);
    expect(result.current.ageMs).not.toBeNull();
  });

  it("labels age in minutes and flips isStale past the threshold", () => {
    const now = new Date("2026-07-13T18:00:00Z");
    const { result } = renderHook(
      () =>
        useStaleness("2026-07-13T17:55:00Z", {
          now,
          staleAfterMs: 60_000,
        }),
      { wrapper },
    );
    expect(result.current.updatedXMinAgo).toBe("updated 5m ago");
    expect(result.current.isStale).toBe(true);
  });

  it("handles missing timestamps without going stale", () => {
    const { result } = renderHook(() => useStaleness(null), { wrapper });
    expect(result.current.updatedXMinAgo).toBe("updated —");
    expect(result.current.ageMs).toBeNull();
    expect(result.current.isStale).toBe(false);
  });

  it("refresh delegates to onRefresh when provided (mock-friendly)", async () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => useStaleness(null, { onRefresh }), {
      wrapper,
    });
    await act(async () => {
      await result.current.refresh();
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("cache-bust refresh bumps the cacheBuster token", async () => {
    const { result } = renderHook(
      () => useStaleness(null, { queryKey: ["stats", "summary"] }),
      { wrapper },
    );
    expect(result.current.cacheBuster).toBe(0);
    await act(async () => {
      await result.current.refresh({ cacheBust: true });
    });
    expect(result.current.cacheBuster).toBe(1);
  });
});

describe("STATS_SWR", () => {
  it("mirrors backend per-key TTL ordering with gcTime above staleTime", () => {
    expect(STATS_SWR.summary.staleTime).toBe(15 * 60_000);
    expect(STATS_SWR.velocity.staleTime).toBe(60 * 60_000);
    expect(STATS_SWR.trends.staleTime).toBe(6 * 60 * 60_000);
    expect(STATS_SWR.priceIndex.staleTime).toBe(24 * 60 * 60_000);
    for (const preset of [
      STATS_SWR.summary,
      STATS_SWR.velocity,
      STATS_SWR.trends,
      STATS_SWR.priceIndex,
    ]) {
      expect(preset.gcTime).toBeGreaterThan(preset.staleTime);
    }
    expect(STATS_SWR.shared.refetchOnWindowFocus).toBe(false);
  });
});
