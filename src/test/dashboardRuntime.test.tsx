import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppPreferencesProvider } from "@/lib/appPreferences";

vi.mock("@/components/StatsBar", () => ({
  StatsBar: () => <div>StatsBar</div>,
}));

vi.mock("@/components/FilterSidebar", () => ({
  FilterSidebar: () => <div>FilterSidebar</div>,
}));

vi.mock("@/components/ListingCard", () => ({
  ListingCard: () => <div>ListingCard</div>,
}));

vi.mock("@/components/MarketMap", () => ({
  MarketMap: () => <div>MarketMap</div>,
}));

vi.mock("@/components/MarketPredictor", () => ({
  MarketPredictor: () => <div>MarketPredictor</div>,
}));

vi.mock("@/components/ComparisonModal", () => ({
  ComparisonModal: () => null,
}));

vi.mock("@/components/PipelineStatusBar", () => ({
  PipelineStatusBar: () => <div>PipelineStatusBar</div>,
}));

vi.mock("@/components/VehicleDataFlow", () => ({
  VehicleDataFlow: () => <div>VehicleDataFlow</div>,
}));

vi.mock("@/components/RevealSection", () => ({
  RevealSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/services/api", () => ({
  APIError: class APIError extends Error {
    status = 500;
    detail = "";
  },
  LISTINGS_PAGE_SIZE: 12,
  SNAPSHOT_BASE: "",
  getStats: vi.fn(),
  getListings: vi.fn(),
  getDistrictPrices: vi.fn(),
  getMakes: vi.fn(),
  getModels: vi.fn(),
  getPriceTrends: vi.fn(),
  getPriceTrendSeries: vi.fn(),
  getListingSearchSuggestions: vi.fn(),
  getPipelineStatus: vi.fn(),
  getPipelineRuns: vi.fn(),
  triggerPipelineJob: vi.fn(),
  getLiveMarketSnapshot: vi.fn(),
  getLiveMarketStreamUrl: vi.fn().mockReturnValue("/api/v1/stats/live/stream"),
  getDashboardInsights: vi.fn(),
  getDistrictQuickInsight: vi.fn(),
  estimateCustomVehicle: vi.fn(),
  sendFeedback: vi.fn(),
  getListingThumbnailProxyUrl: vi.fn().mockReturnValue("https://example.com/thumbnail.jpg"),
  formatPrice: (value: number | null) => (value == null ? "N/A" : `Rs. ${value}`),
}));

import Dashboard from "@/pages/Dashboard";
import * as api from "@/services/api";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getStats).mockResolvedValue(null);
  vi.mocked(api.getListings).mockResolvedValue({ listings: [], total: 0 });
  vi.mocked(api.getDistrictPrices).mockResolvedValue([]);
  vi.mocked(api.getMakes).mockResolvedValue([]);
  vi.mocked(api.getModels).mockResolvedValue([]);
  vi.mocked(api.getPriceTrends).mockResolvedValue([]);
  vi.mocked(api.getPriceTrendSeries).mockResolvedValue({ points: [], coverage_scope: "none", coverage_note: null });
  vi.mocked(api.getListingSearchSuggestions).mockResolvedValue([]);
  vi.mocked(api.getPipelineStatus).mockResolvedValue(null);
  vi.mocked(api.getPipelineRuns).mockResolvedValue({ count: 0, runs: [] });
  vi.mocked(api.getLiveMarketSnapshot).mockResolvedValue(null);
  vi.mocked(api.triggerPipelineJob).mockResolvedValue({
    accepted: true,
    job: "sync",
    pid: 1,
    command: "",
    started_at: new Date().toISOString(),
  });
  vi.mocked(api.getDashboardInsights).mockResolvedValue(null);
  vi.mocked(api.getDistrictQuickInsight).mockResolvedValue(null);
  vi.mocked(api.estimateCustomVehicle).mockResolvedValue(null);
});

describe("Dashboard runtime safety", () => {
  it("renders the market trends section without throwing", () => {
    render(
      <AppPreferencesProvider>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </AppPreferencesProvider>,
    );

    expect(screen.getByRole("heading", { name: "Price history" })).toBeInTheDocument();
  });

  it("renders the geo intelligence section for district analysis", () => {
    render(
      <AppPreferencesProvider>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </AppPreferencesProvider>,
    );

    expect(screen.getByText("Market concentration")).toBeInTheDocument();
  });

  it("hides spotlight deal card when dashboard insights only provide zero-priced deals", async () => {
    vi.mocked(api.getDashboardInsights).mockResolvedValue({
      new_listings_24h: 3,
      segment_performance: [],
      trending_models: [],
      hot_deals: [
        {
          id: 100,
          make: "Toyota",
          model: "Vitz",
          year: 2018,
          district: "Colombo",
          source: "ikman",
          price_lkr: 0,
          deal_score: 11,
          thumbnail_url: null,
        },
      ],
    });

    render(
      <AppPreferencesProvider>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </AppPreferencesProvider>,
    );

    await screen.findByRole("heading", { name: "Price history" });
    expect(screen.queryByText(/Toyota\s+Vitz/i)).not.toBeInTheDocument();
  });

  it("loads safely when district is provided in URL query", async () => {
    render(
      <AppPreferencesProvider>
        <MemoryRouter initialEntries={["/?district=Jaffna"]}>
          <Dashboard />
        </MemoryRouter>
      </AppPreferencesProvider>,
    );

    await screen.findByText("Market concentration");

    await waitFor(() => {
      expect(api.getDistrictQuickInsight).toHaveBeenCalledWith("Jaffna");
    });
  });
});
