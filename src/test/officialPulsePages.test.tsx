import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppPreferencesProvider } from "@/lib/appPreferences";
import OfficialPulse from "@/pages/OfficialPulse";
import OfficialPulseDetail from "@/pages/OfficialPulseDetail";
import OfficialPulseGuide from "@/pages/OfficialPulseGuide";
import type { MarketSignal } from "@/types/car";

vi.mock("@/services/api", () => ({
  getMarketSignals: vi.fn(),
  getMarketSignal: vi.fn(),
}));

import { getMarketSignal, getMarketSignals } from "@/services/api";

const sampleSignals: MarketSignal[] = [
  {
    id: 7,
    source: "customs",
    signal_type: "tender_sales",
    period_year: 2026,
    period_month: 7,
    metric: "vehicle_tender_count",
    category: "official",
    value_numeric: 59,
    unit: "count",
    source_url: "https://www.customs.gov.lk/tender-sales/",
    observed_at: "2026-07-01T00:00:00Z",
  },
];

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <AppPreferencesProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/official-pulse" element={<OfficialPulse />} />
            <Route path="/official-pulse/guide/:key" element={<OfficialPulseGuide />} />
            <Route path="/official-pulse/:id" element={<OfficialPulseDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AppPreferencesProvider>,
  );
}

describe("Official Pulse pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMarketSignals).mockResolvedValue(sampleSignals);
    vi.mocked(getMarketSignal).mockResolvedValue(sampleSignals[0]);
  });

  it("renders the hub with guides and live signals", async () => {
    renderAt("/official-pulse");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Official pulse/i })).toBeInTheDocument();
    });
    expect(screen.getAllByText("Customs tender sales").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Open in-platform/i })).toHaveAttribute(
      "href",
      "/official-pulse/7",
    );
  });

  it("renders signal detail with in-platform explanation", async () => {
    renderAt("/official-pulse/7");

    await waitFor(() => {
      expect(screen.getByText("59")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /^Official pulse$/i })).toHaveAttribute(
      "href",
      "/official-pulse",
    );
    expect(screen.getByRole("heading", { name: "Why it matters" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How we read it" })).toBeInTheDocument();
  });

  it("falls back to guides and retry when a signal cannot be loaded", async () => {
    vi.mocked(getMarketSignal).mockRejectedValue(new Error("not found"));
    renderAt("/official-pulse/999");

    await waitFor(
      () => {
        expect(screen.getByRole("heading", { name: /Signal not found/i })).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Read signal guides/i })).toBeInTheDocument();
  });

  it("renders a source guide page", async () => {
    renderAt("/official-pulse/guide/customs_tenders");

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /Customs tender sales/i })).toBeInTheDocument();
    });
  });
});
