import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketIntelligencePanel } from "@/components/MarketIntelligencePanel";
import type { DashboardInsights, LiveMarketSnapshot, StatsOverview } from "@/types/car";

const now = new Date("2026-07-13T18:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const emptyStats: StatsOverview = {
  total_listings: 0,
  avg_price_lkr: 0,
  listings_this_week: 99,
  price_change_mom: null,
  top_makes: [],
  district_count: 0,
  good_deals_count: 0,
  source_count: 0,
  last_updated: null,
};

const syncedEmptySnapshot: LiveMarketSnapshot = {
  generated_at: "2026-07-13T17:55:00Z",
  total_listings: 0,
  priced_listings: 0,
  unavailable_price_listings: 0,
  avg_price_lkr: null,
  latest_listing_at: null,
  active_scrape_sources: [],
  latest_run: null,
  source_status: [],
};

const emptyInsights: DashboardInsights = {
  new_listings_24h: 0,
  segment_performance: [],
  trending_models: [],
  hot_deals: [],
};

function metricValue(label: string): HTMLElement {
  const labelEl = screen.getByText(label);
  const cell = labelEl.closest("div");
  expect(cell).toBeTruthy();
  return cell as HTMLElement;
}

describe("MarketIntelligencePanel honesty", () => {
  it("shows 0 live listings instead of a fake 120,000+ placeholder", () => {
    render(
      <MarketIntelligencePanel
        snapshot={syncedEmptySnapshot}
        stats={emptyStats}
        insights={emptyInsights}
      />,
    );

    expect(screen.queryByText("120,000+")).not.toBeInTheDocument();
    const hero = screen.getByText("Live listings").closest("div")?.parentElement;
    expect(hero).toBeTruthy();
    expect(within(hero as HTMLElement).getByText("0")).toBeInTheDocument();
  });

  it("does not substitute weekly listing count for the New · 24h metric", () => {
    render(
      <MarketIntelligencePanel
        snapshot={syncedEmptySnapshot}
        stats={emptyStats}
        insights={null}
      />,
    );

    const cell = metricValue("New · 24h");
    expect(within(cell).getByText("—")).toBeInTheDocument();
    expect(within(cell).queryByText("99")).not.toBeInTheDocument();
  });

  it("shows a real 24h count when insights provide new_listings_24h", () => {
    render(
      <MarketIntelligencePanel
        snapshot={syncedEmptySnapshot}
        stats={emptyStats}
        insights={{ ...emptyInsights, new_listings_24h: 7 }}
      />,
    );

    const cell = metricValue("New · 24h");
    expect(within(cell).getByText("7")).toBeInTheDocument();
  });

  it("shows empty-feed copy when synced but no scrape rows", () => {
    render(
      <MarketIntelligencePanel
        snapshot={syncedEmptySnapshot}
        stats={emptyStats}
        insights={emptyInsights}
      />,
    );

    expect(screen.getByText("No recent scrape activity")).toBeInTheDocument();
    expect(screen.queryByText("Awaiting live sync")).not.toBeInTheDocument();
  });

  it("shows awaiting live sync only when there is no sync timestamp yet", () => {
    render(
      <MarketIntelligencePanel snapshot={null} stats={emptyStats} insights={null} />,
    );

    expect(screen.getByText("Awaiting live sync")).toBeInTheDocument();
    expect(screen.queryByText("No recent scrape activity")).not.toBeInTheDocument();
  });
});
