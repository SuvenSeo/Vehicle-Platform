import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ListingCard } from "@/components/ListingCard";
import type { CarListing } from "@/types/car";

const sampleListing: CarListing = {
  id: 11,
  source: "ikman",
  source_id: "ikman-11",
  make: "Toyota",
  model: "Aqua",
  year: 2017,
  condition: "reconditioned",
  mileage_km: 74000,
  transmission: "automatic",
  fuel_type: "hybrid",
  engine_cc: 1496,
  body_type: "hatchback",
  price_lkr: 7850000,
  deal_score: 12,
  district: "Colombo",
  province: "Western",
  is_dealer: true,
  title: "Toyota Aqua",
  detail_url: "https://example.com/listing/11",
  first_seen_at: new Date().toISOString(),
  scraped_at: new Date().toISOString(),
};

describe("ListingCard footer metadata", () => {
  it("shows real days-on-market instead of a fabricated integrity score", () => {
    render(
      <MemoryRouter>
        <ListingCard listing={sampleListing} />
      </MemoryRouter>,
    );

    // first_seen_at is now, so the card reports it was listed today.
    expect(screen.getByText(/listed today/i)).toBeInTheDocument();
    expect(screen.queryByText(/\/100/i)).not.toBeInTheDocument();
    expect(screen.getByText(/cc/i)).toBeInTheDocument();
  });

  it("reports day counts for older listings", () => {
    const listedTenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    render(
      <MemoryRouter>
        <ListingCard listing={{ ...sampleListing, id: 12, first_seen_at: listedTenDaysAgo, scraped_at: listedTenDaysAgo }} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/listed 10 days/i)).toBeInTheDocument();
  });
});
