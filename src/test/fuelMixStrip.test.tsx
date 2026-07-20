import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FuelMixStrip } from "@/components/FuelMixStrip";
import type { FuelMixData, HybridBandsData } from "@/types/car";

vi.mock("@/services/api", () => ({
  getFuelMix: vi.fn(),
  getHybridBands: vi.fn(),
  formatPrice: (p: number | null) => (p != null ? `Rs. ${(p / 1_000_000).toFixed(1)}M` : "—"),
}));

import { getFuelMix, getHybridBands } from "@/services/api";

const sampleFuelMix: FuelMixData = {
  total: 200,
  buckets: [
    { fuel_type: "petrol",   count: 120, pct: 60.0 },
    { fuel_type: "hybrid",   count: 50,  pct: 25.0 },
    { fuel_type: "electric", count: 20,  pct: 10.0 },
    { fuel_type: "diesel",   count: 8,   pct: 4.0  },
    { fuel_type: "other",    count: 2,   pct: 1.0  },
  ],
  generated_at: "2026-06-01T00:00:00Z",
};

const sampleHybridBands: HybridBandsData = {
  total_hybrids: 50,
  bands: [
    { label: "≤1500cc",     cc_max: 1500, count: 35, median_price_lkr: 6_500_000 },
    { label: "1501–2000cc", cc_max: 2000, count: 12, median_price_lkr: 8_200_000 },
    { label: ">2000cc",     cc_max: null, count: 3,  median_price_lkr: 14_000_000 },
  ],
  generated_at: "2026-06-01T00:00:00Z",
};

function renderStrip() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FuelMixStrip />
    </QueryClientProvider>,
  );
}

describe("FuelMixStrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the section heading", async () => {
    vi.mocked(getFuelMix).mockResolvedValue(sampleFuelMix);
    vi.mocked(getHybridBands).mockResolvedValue(sampleHybridBands);
    renderStrip();

    await waitFor(() => {
      expect(screen.getByText("EV & hybrid share tracker")).toBeInTheDocument();
    });
  });

  it("shows fuel type badges with percentage", async () => {
    vi.mocked(getFuelMix).mockResolvedValue(sampleFuelMix);
    vi.mocked(getHybridBands).mockResolvedValue(sampleHybridBands);
    renderStrip();

    await waitFor(() => {
      expect(screen.getByText("Petrol")).toBeInTheDocument();
      expect(screen.getByText("Hybrid")).toBeInTheDocument();
      expect(screen.getByText("Electric")).toBeInTheDocument();
      expect(screen.getByText("Diesel")).toBeInTheDocument();
    });
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("displays total listing count", async () => {
    vi.mocked(getFuelMix).mockResolvedValue(sampleFuelMix);
    vi.mocked(getHybridBands).mockResolvedValue(sampleHybridBands);
    renderStrip();

    await waitFor(() => {
      expect(screen.getByText(/200 total listings/)).toBeInTheDocument();
    });
  });

  it("renders hybrid band labels and listing counts", async () => {
    vi.mocked(getFuelMix).mockResolvedValue(sampleFuelMix);
    vi.mocked(getHybridBands).mockResolvedValue(sampleHybridBands);
    renderStrip();

    await waitFor(() => {
      expect(screen.getByText("Hybrid engine bands")).toBeInTheDocument();
      expect(screen.getByText("≤1500cc")).toBeInTheDocument();
      expect(screen.getByText("1501–2000cc")).toBeInTheDocument();
      expect(screen.getByText(">2000cc")).toBeInTheDocument();
    });
    expect(screen.getByText(/35 listings/)).toBeInTheDocument();
    expect(screen.getByText(/12 listings/)).toBeInTheDocument();
  });

  it("renders the fuel distribution bar element", async () => {
    vi.mocked(getFuelMix).mockResolvedValue(sampleFuelMix);
    vi.mocked(getHybridBands).mockResolvedValue(sampleHybridBands);
    renderStrip();

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Fuel type distribution bar" })).toBeInTheDocument();
    });
  });

  it("shows empty state when both queries return empty data", async () => {
    vi.mocked(getFuelMix).mockResolvedValue({ total: 0, buckets: [], generated_at: "" });
    vi.mocked(getHybridBands).mockResolvedValue({ total_hybrids: 0, bands: [], generated_at: "" });
    renderStrip();

    await waitFor(() => {
      expect(screen.getByText(/Fuel-type data will appear here/)).toBeInTheDocument();
    });
  });

  it("hides fuel bar when total is zero", async () => {
    vi.mocked(getFuelMix).mockResolvedValue({ total: 0, buckets: [], generated_at: "" });
    vi.mocked(getHybridBands).mockResolvedValue(sampleHybridBands);
    renderStrip();

    await waitFor(() => {
      expect(screen.queryByRole("img", { name: "Fuel type distribution bar" })).not.toBeInTheDocument();
    });
  });

  it("hides hybrid bands section when total_hybrids is zero", async () => {
    vi.mocked(getFuelMix).mockResolvedValue(sampleFuelMix);
    vi.mocked(getHybridBands).mockResolvedValue({ total_hybrids: 0, bands: [], generated_at: "" });
    renderStrip();

    await waitFor(() => {
      expect(screen.getByText("Petrol")).toBeInTheDocument();
    });
    expect(screen.queryByText("Hybrid engine bands")).not.toBeInTheDocument();
  });

  it("hides the strip content when both queries error", async () => {
    vi.mocked(getFuelMix).mockRejectedValue(new Error("network error"));
    vi.mocked(getHybridBands).mockRejectedValue(new Error("network error"));
    const { container } = renderStrip();

    await waitFor(
      () => {
        // Either renders nothing at all (null return) or at minimum hides all data content.
        const hasData =
          screen.queryByText("Petrol") !== null ||
          screen.queryByText("Hybrid engine bands") !== null ||
          screen.queryByText(/total listings/) !== null;
        expect(hasData).toBe(false);
      },
      { timeout: 3000 },
    );
    // If the component returns null, firstChild will be null too.
    // If it renders a loading skeleton that never resolves to data, data labels remain absent.
    expect(container.querySelector("section")?.textContent ?? "").not.toMatch(/Petrol|Hybrid engine bands/);
  });

  it("shows loading skeletons while fetching", () => {
    vi.mocked(getFuelMix).mockReturnValue(new Promise(() => {}));
    vi.mocked(getHybridBands).mockReturnValue(new Promise(() => {}));
    renderStrip();

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
