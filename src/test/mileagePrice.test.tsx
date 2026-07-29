import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import MileagePrice from "@/pages/MileagePrice";
import * as api from "@/services/api";
import { AppPreferencesProvider } from "@/lib/appPreferences";
import { AuthProvider } from "@/lib/authContext";

vi.mock("@/services/api", () => ({
  getMakes: vi.fn(),
  getModels: vi.fn(),
  getMileagePriceScatter: vi.fn(),
}));

const ROUTER_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

function renderPage() {
  return render(
    <AppPreferencesProvider>
      <AuthProvider>
        <MemoryRouter future={ROUTER_FLAGS}>
          <MileagePrice />
        </MemoryRouter>
      </AuthProvider>
    </AppPreferencesProvider>,
  );
}

describe("MileagePrice page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getMakes).mockResolvedValue([
      { make: "Toyota", count: 12 },
      { make: "Honda", count: 8 },
    ]);
    vi.mocked(api.getModels).mockResolvedValue([{ model: "Aqua", count: 5 }]);
    vi.mocked(api.getMileagePriceScatter).mockResolvedValue({
      points: [
        {
          id: 1,
          make: "Toyota",
          model: "Aqua",
          year: 2019,
          mileage_km: 35_000,
          price_lkr: 8_000_000,
          district: "Colombo",
        },
        {
          id: 2,
          make: "Honda",
          model: "Fit",
          year: 2018,
          mileage_km: 52_000,
          price_lkr: 7_600_000,
          district: "Kandy",
        },
      ],
      sample_size: 2,
      make: null,
      model: null,
    });
  });

  it("renders the scatter analytics page and fetches the capped default sample", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: /mileage vs price/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(api.getMileagePriceScatter).toHaveBeenCalledWith({
        make: undefined,
        model: undefined,
        limit: 750,
      });
    });

    expect(screen.getByRole("combobox", { name: /make/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /model/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /all market mileage vs price scatter with 2 listings/i })).toBeInTheDocument();
    expect(screen.getByText("43,500 km")).toBeInTheDocument();
    expect(screen.getByText("Rs. 7.80M")).toBeInTheDocument();
  });
});
