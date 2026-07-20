import { TestRouter } from "@/test/testUtils";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListingCard } from "@/components/ListingCard";
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
    price_lkr: 8900000,
    deal_score: 3,
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

describe("ListingCard render states and interactions", () => {
  it("uses compact layout classes for denser market cards", () => {
    const listing = buildListing();

    render(
      <TestRouter>
        <ListingCard listing={listing} />
      </TestRouter>,
    );

    const card = screen.getByRole("article", { name: /Toyota Aqua listing card/i });
    const cardLink = screen.getByRole("link", { name: /Open Toyota Aqua/i });

    // Surface now routes through the semantic token (theme-adaptive) rather
    // than the old hardcoded dark-glass fill.
    expect(card.className).toContain("bg-card");
    expect(card.className).toContain("rounded-2xl");
    expect(cardLink).toHaveAttribute("href", "/listing/11");
    expect(card.querySelector("button")).not.toBeInTheDocument();
  });

  it("renders fallback metadata when fields are missing", () => {
    const listing = buildListing({
      year: 0,
      mileage_km: Number.NaN,
      district: "",
      thumbnail_url: undefined,
      images: [],
    });

    render(
      <TestRouter>
        <ListingCard listing={listing} />
      </TestRouter>,
    );

    expect(screen.getByText("District N/A")).toBeInTheDocument();
    expect(screen.getByText("Mileage N/A")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Toyota Aqua" })).toBeInTheDocument();
  });

  it("renders an unavailable price badge when listing price is not positive", () => {
    const listing = buildListing({
      price_lkr: null,
    });

    render(
      <TestRouter>
        <ListingCard listing={listing} />
      </TestRouter>,
    );

    expect(screen.getByText("Price unavailable")).toBeInTheDocument();
  });

  it("shows a truthful market-position signal when below the median", () => {
    const listing = buildListing({
      market_median_lkr: 9_500_000,
      price_lkr: 8_900_000,
      deal_score: 12,
      year: 2024,
      mileage_km: 1200,
      condition: "brand_new",
      is_dealer: true,
    });

    render(
      <TestRouter>
        <ListingCard listing={listing} />
      </TestRouter>,
    );

    expect(screen.getByText(/market position/i)).toBeInTheDocument();
    expect(screen.getByText(/% below/i)).toBeInTheDocument();
  });

  it("keeps compare and watchlist actions compatible", () => {
    const listing = buildListing();
    const onCompareToggle = vi.fn();
    const onWatchlistToggle = vi.fn();

    render(
      <TestRouter>
        <ListingCard
          listing={listing}
          onCompareToggle={onCompareToggle}
          onWatchlistToggle={onWatchlistToggle}
          isComparing={false}
          isWatchlisted={false}
        />
      </TestRouter>,
    );

    fireEvent.click(screen.getByLabelText("Add to watchlist"));
    fireEvent.click(screen.getByLabelText("Add to comparison"));

    expect(onWatchlistToggle).toHaveBeenCalledTimes(1);
    expect(onWatchlistToggle).toHaveBeenCalledWith(listing);
    expect(onCompareToggle).toHaveBeenCalledTimes(1);
    expect(onCompareToggle).toHaveBeenCalledWith(listing);
  });
});
