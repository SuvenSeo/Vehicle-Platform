import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/lib/authContext";
import { AppPreferencesProvider } from "@/lib/appPreferences";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { freeListingsVisibleTotal, FREE_LISTINGS_PAGE_SIZE, hasFullPlatformAccess } from "@/lib/planLimits";

function installLocalStorage(seed?: Record<string, unknown>) {
  const store = new Map<string, string>();
  if (seed) store.set("autolens.auth_user", JSON.stringify(seed));
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
}

describe("Free plan limits", () => {
  beforeEach(() => installLocalStorage());

  it("caps free listing visibility at one page", () => {
    expect(freeListingsVisibleTotal(500)).toBe(FREE_LISTINGS_PAGE_SIZE);
    expect(freeListingsVisibleTotal(3)).toBe(3);
    expect(hasFullPlatformAccess({ hasProAccess: false, isAdmin: false })).toBe(false);
    expect(hasFullPlatformAccess({ hasProAccess: true })).toBe(true);
    expect(hasFullPlatformAccess({ hasProAccess: false, isAdmin: true })).toBe(true);
  });

  it("renders upgrade prompt copy for free ceilings", () => {
    installLocalStorage({
      email: "free@example.com",
      name: "Free User",
      plan: "free",
      subscriptionStatus: "none",
      role: "user",
      avatarInitials: "FU",
    });

    render(
      <AppPreferencesProvider>
        <AuthProvider>
          <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <UpgradePrompt title="Free browse limit reached" body="Upgrade for the full feed." />
          </MemoryRouter>
        </AuthProvider>
      </AppPreferencesProvider>,
    );

    expect(screen.getByText(/free browse limit reached/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade to pro/i })).toHaveAttribute("href", "/pricing");
  });
});
