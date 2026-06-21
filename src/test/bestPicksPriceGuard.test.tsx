import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api", () => ({
  getListings: vi.fn(),
  getListingThumbnailProxyUrl: vi.fn().mockReturnValue("https://example.com/thumb.jpg"),
  formatPrice: (value: number | null) => (value == null ? "N/A" : `Rs. ${(Number(value) / 1_000_000).toFixed(2)}M`),
}));

import BestPicks from "@/pages/BestPicks";
import * as api from "@/services/api";

function makeListing(id: number, make: string, model: string, priceLkr: number, dealScore: number) {
  return {
    id,
    make,
    model,
    year: 2018,
    district: "Colombo",
    source: "ikman",
    price_lkr: priceLkr,
    deal_score: dealScore,
    detail_url: `https://example.com/listing/${id}`,
    external_url: `https://example.com/listing/${id}`,
    thumbnail_url: null,
    images: [],
  } as any;
}

describe("BestPicks price guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(api.getListings).mockImplementation(async () => ({
      listings: [
        makeListing(1, "Zero", "Price", 0, 13),
        makeListing(2, "Tiny", "Price", 42_000, 16),
        makeListing(3, "Toyota", "Corolla", 8_700_000, 11),
      ],
      total: 3,
    }));
  });

  it("excludes zero and tiny malformed prices from best picks", async () => {
    render(
      <MemoryRouter>
        <BestPicks />
      </MemoryRouter>,
    );

    await screen.findByText(/Toyota Corolla/i);

    expect(screen.queryByText(/Zero Price/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tiny Price/i)).not.toBeInTheDocument();
    expect(screen.getByText("Qualified picks")).toBeInTheDocument();
    expect(screen.getByText("ranked")).toBeInTheDocument();
  });
});
