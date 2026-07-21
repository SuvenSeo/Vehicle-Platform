import { TestRouter } from "@/test/testUtils";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComparisonModal } from "@/components/ComparisonModal";
import type { CarListing } from "@/types/car";

function buildListing(overrides: Partial<CarListing> = {}): CarListing {
  return {
    id: 11,
    source: "ikman",
    source_id: "ik-11",
    make: "Toyota",
    model: "Aqua",
    year: 2018,
    condition: "used",
    mileage_km: 65000,
    transmission: "automatic",
    fuel_type: "hybrid",
    body_type: "hatchback",
    engine_cc: 1500,
    price_lkr: 8900000,
    deal_score: 12,
    market_median_lkr: 9500000,
    district: "Colombo",
    province: "Western",
    is_dealer: false,
    title: "Toyota Aqua 2018",
    detail_url: "https://example.com/listing/11",
    scraped_at: new Date().toISOString(),
    first_seen_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("ComparisonModal", () => {
  it("renders side-by-side headers, verdict chips, and grouped metrics", () => {
    const listings = [
      buildListing({ id: 1, make: "Toyota", model: "Aqua", price_lkr: 8_500_000, deal_score: 14, mileage_km: 40_000 }),
      buildListing({
        id: 2,
        make: "Honda",
        model: "Fit",
        price_lkr: 9_200_000,
        deal_score: 2,
        mileage_km: 72_000,
        market_median_lkr: 9_000_000,
      }),
    ];

    render(
      <TestRouter>
        <ComparisonModal listings={listings} open onClose={vi.fn()} />
      </TestRouter>,
    );

    expect(screen.getByRole("heading", { name: /Compare vehicles/i })).toBeInTheDocument();
    expect(screen.getByText("2 vehicles")).toBeInTheDocument();
    expect(screen.getAllByText("Best deal").length).toBeGreaterThan(0);
    expect(screen.getByText("Lowest ask")).toBeInTheDocument();
    expect(screen.getByText("Lowest km")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("Specs")).toBeInTheDocument();
    expect(screen.getByText("Listing")).toBeInTheDocument();
    expect(screen.getByText("Price signal and deal strength")).toBeInTheDocument();
    expect(screen.getByText("Mechanical and body details")).toBeInTheDocument();
    expect(screen.getByText("Source and market presence")).toBeInTheDocument();
    expect(screen.getAllByText("Toyota Aqua").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Honda Fit").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Open listing/i })).toHaveLength(2);
  });

  it("returns nothing when there are no listings", () => {
    const { container } = render(
      <TestRouter>
        <ComparisonModal listings={[]} open onClose={vi.fn()} />
      </TestRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
