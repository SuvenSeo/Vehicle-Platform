import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppPreferencesProvider } from "@/lib/appPreferences";
import { AuthProvider } from "@/lib/authContext";
import Permits from "@/pages/Permits";

vi.mock("@/services/api", () => ({
  getPermits: vi.fn(),
  formatPrice: (price: number | null) => (price ? `Rs ${price.toLocaleString("en-US")}` : "Price unavailable"),
  API_BASE: "/api/v1",
  resolveFetchCredentials: () => "omit",
}));

import { getPermits } from "@/services/api";

function renderPermits() {
  return render(
    <AppPreferencesProvider>
      <AuthProvider>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Permits />
        </MemoryRouter>
      </AuthProvider>
    </AppPreferencesProvider>,
  );
}

describe("Permits page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders permit market prices from the permits API", async () => {
    vi.mocked(getPermits).mockResolvedValue([
      {
        id: 1,
        permit_name: "Government Doctor Permit",
        permit_type: "duty_free",
        market_price_lkr: 5_500_000,
      },
      {
        id: 2,
        permit_name: "EV Remittance Permit",
        permit_type: "ev",
        market_price_lkr: 2_200_000,
      },
    ]);

    renderPermits();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Permit market tracker/i })).toBeInTheDocument();
    });
    expect(screen.getAllByText("Government Doctor Permit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rs 5,500,000").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Model landed cost/i })).toHaveAttribute(
      "href",
      "/calculator?tab=landed-cost",
    );
  });

  it("shows admin seed guidance when the permits table is empty", async () => {
    localStorage.setItem(
      "autolens.auth_user",
      JSON.stringify({
        email: "admin@example.com",
        name: "Admin",
        plan: "enterprise",
        subscriptionStatus: "active",
        role: "admin",
        avatarInitials: "AD",
      }),
    );
    vi.mocked(getPermits).mockResolvedValue([]);

    renderPermits();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /No permit prices yet/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/permits table is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Admin/i })).toHaveAttribute("href", "/admin");
  });
});
