import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppPreferencesProvider } from "@/lib/appPreferences";
import { TestRouter } from "@/test/testUtils";

vi.mock("@/services/api", () => ({
  getChargingStations: vi.fn(),
}));

import EVChargers from "@/pages/EVChargers";
import * as api from "@/services/api";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AppPreferencesProvider>
      <QueryClientProvider client={client}>
        <TestRouter initialEntries={["/ev-chargers"]}>
          <EVChargers />
        </TestRouter>
      </QueryClientProvider>
    </AppPreferencesProvider>,
  );
}

describe("EVChargers page", () => {
  beforeEach(() => {
    vi.mocked(api.getChargingStations).mockResolvedValue({
      count: 1,
      radius_km: 25,
      attribution: "Data © Open Charge Map contributors and data providers.",
      stations: [
        {
          ocm_id: 4242,
          name: "Colombo City Centre",
          operator: "Dialog",
          lat: 6.917,
          lng: 79.855,
          address: "R. A. De Mel Mawatha, Colombo",
          connectors: [{ type: "Type 2 (Socket Only)", power_kw: 22 }],
          distance_km: 1.2,
          data_provider: "Open Charge Map Contributors",
          attribution: "Open Charge Map Contributors",
        },
      ],
    });
  });

  it("lists cached stations with provider attribution", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: /chargers/i })).toBeInTheDocument();
    expect(await screen.findByText(/Colombo City Centre/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Open Charge Map/i).length).toBeGreaterThan(0);
  });
});
