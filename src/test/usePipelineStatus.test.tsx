import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPipelineStatus: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  getPipelineStatus: mocks.getPipelineStatus,
}));

import { usePipelineStatus } from "@/hooks/usePipelineStatus";

// Mirrors POLL_INTERVAL_MS in the hook. waitFor() also uses setInterval
// internally, so assertions must filter to the hook's own 90s interval.
const POLL_INTERVAL_MS = 90_000;

function statusPayload() {
  return {
    generated_at: "2026-09-19T00:00:00Z",
    overall_status: "ok" as const,
    jobs: [],
  };
}

describe("usePipelineStatus", () => {
  let setIntervalSpy: ReturnType<typeof vi.spyOn>;
  let clearIntervalSpy: ReturnType<typeof vi.spyOn>;

  /** Ids returned by setInterval calls made with the hook's poll delay. */
  function hookIntervalIds(): unknown[] {
    return setIntervalSpy.mock.calls
      .map((call, index) => ({ call, result: setIntervalSpy.mock.results[index] }))
      .filter(({ call }) => call[1] === POLL_INTERVAL_MS)
      .map(({ result }) => result.value);
  }

  /** clearInterval calls that targeted one of the hook's intervals. */
  function hookClearCount(): number {
    const ids = new Set(hookIntervalIds());
    return clearIntervalSpy.mock.calls.filter(([id]) => ids.has(id)).length;
  }

  beforeEach(() => {
    mocks.getPipelineStatus.mockReset();
    mocks.getPipelineStatus.mockResolvedValue(statusPayload());
    setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it("shares exactly one polling interval across concurrent subscribers", async () => {
    const first = renderHook(() => usePipelineStatus());
    const second = renderHook(() => usePipelineStatus());

    await waitFor(() => expect(mocks.getPipelineStatus).toHaveBeenCalled());
    expect(hookIntervalIds()).toHaveLength(1);

    // One subscriber leaving must not tear down the shared interval.
    first.unmount();
    expect(hookClearCount()).toBe(0);

    second.unmount();
    expect(hookClearCount()).toBe(1);
  });

  it("starts a fresh single interval after the last subscriber unmounts", async () => {
    const first = renderHook(() => usePipelineStatus());
    await waitFor(() => expect(hookIntervalIds()).toHaveLength(1));
    first.unmount();
    expect(hookClearCount()).toBe(1);

    // Remounting must not stack a second interval on top of a live one.
    const second = renderHook(() => usePipelineStatus());
    await waitFor(() => expect(hookIntervalIds()).toHaveLength(2));
    expect(hookClearCount()).toBe(1);

    second.unmount();
    expect(hookClearCount()).toBe(2);
  });

  it("clears the interval exactly once even when many subscribers unmount", async () => {
    const hooks = [
      renderHook(() => usePipelineStatus()),
      renderHook(() => usePipelineStatus()),
      renderHook(() => usePipelineStatus()),
    ];

    await waitFor(() => expect(mocks.getPipelineStatus).toHaveBeenCalled());
    expect(hookIntervalIds()).toHaveLength(1);

    hooks.forEach((hook) => hook.unmount());

    expect(hookClearCount()).toBe(1);
  });
});