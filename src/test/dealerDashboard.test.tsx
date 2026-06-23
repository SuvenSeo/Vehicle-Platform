import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import DealerDashboard from "@/pages/DealerDashboard";

describe("DealerDashboard", () => {
  it("renders key dealer intelligence widgets", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DealerDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /dealer command center/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inventory Turnover" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Price Gaps" })).toBeInTheDocument();
  });
});
