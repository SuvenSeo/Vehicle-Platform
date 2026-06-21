import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider } from "@/lib/authContext";

function installLocalStorage(seed?: Record<string, unknown>) {
  const store = new Map<string, string>();
  if (seed) {
    store.set("autolens.auth_user", JSON.stringify(seed));
  }

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

function renderProtected() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/pro"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/sign-in" element={<div>Sign in page</div>} />
          <Route path="/pro-preview" element={<div>Preview page</div>} />
          <Route
            path="/pro"
            element={(
              <ProtectedRoute>
                <div>Full Pro Dashboard</div>
              </ProtectedRoute>
            )}
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("Pro access gate", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("blocks signed-in free users from the Pro dashboard", () => {
    installLocalStorage({
      email: "free@autolens.lk",
      name: "Free User",
      plan: "free",
      subscriptionStatus: "none",
      avatarInitials: "FU",
    });

    renderProtected();

    expect(screen.getByText(/subscription required/i)).toBeInTheDocument();
    expect(screen.getByText(/pro is locked for free accounts/i)).toBeInTheDocument();
    expect(screen.queryByText(/full pro dashboard/i)).not.toBeInTheDocument();
  });

  it("allows active Pro subscribers into the dashboard", () => {
    installLocalStorage({
      email: "owner@autolens.lk",
      name: "AutoLens Owner",
      plan: "enterprise",
      subscriptionStatus: "active",
      avatarInitials: "AO",
    });

    renderProtected();

    expect(screen.getByText(/full pro dashboard/i)).toBeInTheDocument();
    expect(screen.queryByText(/subscription required/i)).not.toBeInTheDocument();
  });
});
