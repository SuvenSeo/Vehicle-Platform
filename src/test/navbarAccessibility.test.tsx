import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Navbar } from "@/components/Navbar";
import { AppPreferencesProvider } from "@/lib/appPreferences";
import { AuthProvider } from "@/lib/authContext";

vi.mock("@/services/api", () => ({
  getPipelineStatus: vi.fn().mockResolvedValue({ overall_status: "ok", jobs: [] }),
}));

describe("Navbar accessibility active-state", () => {
  it("marks the active section link with aria-current on dashboard route", async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <AppPreferencesProvider>
            <MemoryRouter initialEntries={["/"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Navbar />
            </MemoryRouter>
          </AppPreferencesProvider>
        </AuthProvider>,
      );
    });

    const homeLinks = screen.getAllByRole("link", { name: /^home$/i });
    expect(homeLinks.some((link) => link.getAttribute("aria-current") === "page")).toBe(true);
    expect(homeLinks.some((link) => link.getAttribute("data-active") === "true")).toBe(true);
  });

  it("marks trends link as current on trends route", async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <AppPreferencesProvider>
            <MemoryRouter initialEntries={["/trends"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Navbar />
            </MemoryRouter>
          </AppPreferencesProvider>
        </AuthProvider>,
      );
    });

    const trendsLinks = screen.getAllByRole("link", { name: /trends/i });   
    expect(trendsLinks.some((link) => link.getAttribute("aria-current") === "page")).toBe(true);
  });

  it("opens the sign-in portal shell with both entry actions", async () => {    
    await act(async () => {
      render(
        <AuthProvider>
          <AppPreferencesProvider>
            <MemoryRouter initialEntries={["/"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Navbar />
            </MemoryRouter>
          </AppPreferencesProvider>
        </AuthProvider>,
      );
    });

    const signInButton = screen.getAllByRole("button", { name: /sign in/i })[0];
    fireEvent.click(signInButton);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in to pro dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guest access/i })).toBeInTheDocument();
  });
});
