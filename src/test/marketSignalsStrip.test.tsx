import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarketSignalsStrip } from "@/components/MarketSignalsStrip";
import type { MarketSignal } from "@/types/car";

vi.mock("@/services/api", () => ({
  getMarketSignals: vi.fn(),
}));

import { getMarketSignals } from "@/services/api";

const sampleSignals: MarketSignal[] = [
  {
    id: 1,
    source: "dmt",
    signal_type: "registrations",
    period_year: 2026,
    period_month: 4,
    metric: "New registrations",
    category: "Passenger cars",
    value_numeric: 12_450,
    unit: "vehicles",
    source_url: "https://example.com/dmt",
    observed_at: "2026-04-30T00:00:00Z",
  },
];

function renderStrip() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MarketSignalsStrip />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MarketSignalsStrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders signal cards that link into Official Pulse", async () => {
    vi.mocked(getMarketSignals).mockResolvedValue(sampleSignals);
    renderStrip();

    await waitFor(() => {
      expect(screen.getByText("Government & import market signals")).toBeInTheDocument();
    });
    expect(screen.getByText("Passenger cars")).toBeInTheDocument();
    expect(screen.getByText(/12,450 vehicles/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Passenger cars/i })).toHaveAttribute(
      "href",
      "/official-pulse/1",
    );
    expect(screen.getByRole("link", { name: /Open pulse desk/i })).toHaveAttribute(
      "href",
      "/official-pulse",
    );
  });

  it("shows empty state with in-app pulse link when no signals", async () => {
    vi.mocked(getMarketSignals).mockResolvedValue([]);
    renderStrip();

    await waitFor(() => {
      expect(screen.getByText(/Official registration and import-cost signals will appear here/)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /Read what each signal means/i })).toHaveAttribute(
      "href",
      "/official-pulse",
    );
  });
});
