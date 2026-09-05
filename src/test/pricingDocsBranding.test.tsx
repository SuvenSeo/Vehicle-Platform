import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Docs from "@/pages/Docs";
import Pricing from "@/pages/Pricing";
import { AppPreferencesProvider } from "@/lib/appPreferences";
import { AuthProvider } from "@/lib/authContext";

function wrap(ui: ReactElement) {
  return render(
    <AppPreferencesProvider>
      <AuthProvider>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>
      </AuthProvider>
    </AppPreferencesProvider>,
  );
}

describe("Docs and Pricing pages", () => {
  it("renders platform docs with section anchors", () => {
    wrap(<Docs />);
    expect(screen.getByRole("heading", { name: /Platform docs/i })).toBeInTheDocument();
    expect(document.getElementById("official-pulse")).toBeTruthy();
    expect(document.getElementById("dealer-workspace")).toBeTruthy();
  });

  it("renders pricing tiers and ICP personas", () => {
    wrap(<Pricing />);
    expect(screen.getByRole("heading", { name: /Pricing that funds the pipeline/i })).toBeInTheDocument();
    expect(screen.getByText("LKR 999")).toBeInTheDocument();
    expect(screen.getByText("LKR 1,999")).toBeInTheDocument();
    expect(screen.getByText("Dealers")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /start 7-day free trial/i })[0]).toHaveAttribute(
      "href",
      "/sign-up",
    );
    expect(screen.getAllByRole("link", { name: /Message us/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Message us/i })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:"),
    );
  });
});
