import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriceUnavailableBadge } from "@/components/PriceUnavailableBadge";

describe("PriceUnavailableBadge", () => {
  it("renders an unavailable label", () => {
    render(<PriceUnavailableBadge label="Price unavailable" />);

    expect(screen.getByText("Price unavailable")).toBeInTheDocument();
    expect(screen.getByText("Price unavailable").parentElement?.className).toContain("border-primary/60");
  });

  it("renders an input call to action when provided", () => {
    render(<PriceUnavailableBadge label="Price unavailable" actionLabel="Input Price" />);

    expect(screen.getByText(/Input Price/i)).toBeInTheDocument();
  });
});