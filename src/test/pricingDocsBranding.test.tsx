import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Docs from "@/pages/Docs";
import Pricing from "@/pages/Pricing";
import Branding from "@/pages/Branding";

function wrap(ui: ReactElement) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>,
  );
}

describe("Docs, Pricing, Branding pages", () => {
  it("renders platform docs with section anchors", () => {
    wrap(<Docs />);
    expect(screen.getByRole("heading", { name: /Platform docs/i })).toBeInTheDocument();
    expect(document.getElementById("official-pulse")).toBeTruthy();
    expect(document.getElementById("dealer-workspace")).toBeTruthy();
  });

  it("renders pricing tiers and ICP personas", () => {
    wrap(<Pricing />);
    expect(screen.getByRole("heading", { name: /^Pricing\.$/i })).toBeInTheDocument();
    expect(screen.getByText("LKR 4,990")).toBeInTheDocument();
    expect(screen.getByText("LKR 19,990")).toBeInTheDocument();
    expect(screen.getByText("Dealers")).toBeInTheDocument();
  });

  it("recommends AutoLens LK and lists brand options", () => {
    wrap(<Branding />);
    expect(screen.getByRole("heading", { name: /^Branding\.$/i })).toBeInTheDocument();
    expect(screen.getAllByText("AutoLens LK").length).toBeGreaterThan(0);
    expect(screen.getByText("MilaMark")).toBeInTheDocument();
    expect(screen.getByText("Parity Desk")).toBeInTheDocument();
  });
});
