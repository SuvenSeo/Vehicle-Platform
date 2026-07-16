import { TestRouter } from "@/test/testUtils";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api", () => ({
  getListings: vi.fn(),
  getPriceDrops: vi.fn().mockResolvedValue([]),
  getListingThumbnailProxyUrl: vi.fn().mockReturnValue("https://example.com/thumb.jpg"),
  formatPrice: (value: number | null) => (value == null ? "N/A" : `Rs. ${(Number(value) / 1_000_000).toFixed(2)}M`),
}));

import BestPicks from "@/pages/BestPicks";
import * as api from "@/services/api";
import type { CarListing } from "@/types/car";

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
  } as CarListing;
}

describe("BestPicks price guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(api.getListings).mockImplementation(async () => ({
      listings: [
        makeListing(1, "Zero", "Price", 0, 13),
        makeListing(2, "Tiny", "Price", 42_000, 16),
        makeListing(3, "Toyota", "Corolla", 8_700_000, 11),
        makeListing(4, "Honda", "Fit", 6_000_000, 10),
        makeListing(5, "BMW", "X5", 18_000_000, 15),
      ],
      total: 5,
    }));
  });

  it("excludes zero and tiny malformed prices from best picks", async () => {
    render(
      <TestRouter>
        <BestPicks />
      </TestRouter>,
    );

    await screen.findByText(/Toyota Corolla/i);

    expect(screen.queryByText(/Zero Price/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tiny Price/i)).not.toBeInTheDocument();
    expect(screen.getByText(/vehicles scored/i)).toBeInTheDocument();
    expect(screen.getByText(/ranked by deal strength/i)).toBeInTheDocument();
  });

  it("re-ranks high deal_score listings by affordability cash down", async () => {
    render(
      <TestRouter>
        <BestPicks />
      </TestRouter>,
    );

    await screen.findByText(/BMW X5/i);
    // Default deal_score mode: highest score featured first.
    expect(screen.getByRole("heading", { name: /BMW X5/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Affordability/i }));

    expect(await screen.findByText(/ranked by min cash down/i)).toBeInTheDocument();
    // Lowest ask among gate survivors (Honda Fit) should feature under affordability.
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings[0]).toHaveTextContent(/Honda Fit/i);
    expect(screen.getByText(/Lowest cash down/i)).toBeInTheDocument();
  });
});
