import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SignIn from "@/pages/SignIn";
import { AuthProvider } from "@/lib/authContext";

describe("SignIn preview access", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
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

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
  });

  it("shows review credentials, the login form, and the locked preview entry", () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/sign-in"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/sign-in" element={<SignIn />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByText(/preview the pro workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/^review credentials$/i)).toBeInTheDocument();
    expect(screen.getByText(/owner@autolens\.lk/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview pro/i })).toBeInTheDocument();
  });

  it("routes to the public preview without creating a Pro session", () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/sign-in"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/pro-preview" element={<div>Pro preview teaser</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /preview pro/i }));

    expect(screen.getByText(/pro preview teaser/i)).toBeInTheDocument();
    expect(localStorage.getItem("autolens.auth_user")).toBeNull();
  });

  it("lets the owner review account sign in with full Pro credentials", async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/sign-in"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/pro" element={<div>Full Pro Workspace</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /AutoLens Owner/i }));
    fireEvent.click(screen.getByRole("button", { name: /^sign in/i }));

    expect(await screen.findByText(/full pro workspace/i)).toBeInTheDocument();
    expect(localStorage.getItem("autolens.auth_user")).toContain("owner@autolens.lk");
    expect(localStorage.getItem("autolens.auth_user")).toContain("enterprise");
  });
});
