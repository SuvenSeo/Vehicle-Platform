import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWatchlistIds, saveWatchlistIds, toggleWatchlistId } from "@/lib/watchlist";

let storage = new Map<string, string>();

beforeEach(() => {
  storage = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("watchlist storage", () => {
  it("stores and restores ids", () => {
    saveWatchlistIds([12, 3]);
    expect(loadWatchlistIds()).toEqual([12, 3]);
  });

  it("toggles ids on and off", () => {
    expect(toggleWatchlistId([], 5).ids).toEqual([5]);
    expect(toggleWatchlistId([5], 5).ids).toEqual([]);
  });

  it("caps max watchlist size when limit is hit", () => {
    const state = toggleWatchlistId([1, 2, 3], 4, 3);
    expect(state.ids).toEqual([1, 2, 3]);
    expect(state.blocked).toBe(true);
  });
});
