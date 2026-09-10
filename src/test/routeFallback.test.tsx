import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RouteFallback } from "@/components/RouteFallback";

describe("RouteFallback", () => {
  it("renders a listing-grid skeleton on home", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <RouteFallback />
      </MemoryRouter>,
    );
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });

  it("renders a page skeleton on non-grid routes", () => {
    render(
      <MemoryRouter initialEntries={["/docs"]}>
        <RouteFallback />
      </MemoryRouter>,
    );
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });
});
