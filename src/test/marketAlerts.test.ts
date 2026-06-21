import { beforeEach, describe, expect, it } from "vitest";
import { loadMarketAlerts, removeMarketAlert, saveMarketAlert, summarizeAlertFilters } from "@/lib/marketAlerts";

function installLocalStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };

  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
}

describe("market alerts", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("summarizes saved alert filters", () => {
    expect(summarizeAlertFilters({ q: "Toyota Axio", district: "Colombo", condition: "used" })).toBe(
      '"Toyota Axio" / Colombo / used',
    );
  });

  it("persists and removes saved market alerts", () => {
    const alerts = saveMarketAlert({ q: "Vitz", sort: "newest", page: 1 }, 7_500_000);

    expect(loadMarketAlerts()).toHaveLength(1);
    expect(alerts[0].target_price_lkr).toBe(7_500_000);

    removeMarketAlert(alerts[0].id);
    expect(loadMarketAlerts()).toEqual([]);
  });
});
