import { describe, expect, it } from "vitest";
import type { CarListing } from "@/types/car";
import { getListingImageUrl } from "@/lib/listing-card-meta";

type ListingImageInput = Pick<CarListing, "thumbnail_url" | "images" | "url" | "external_url">;

describe("getListingImageUrl", () => {
  it("prefers thumbnail_url when available", () => {
    expect(
      getListingImageUrl({
        thumbnail_url: "https://example.com/thumb.jpg",
        images: ["https://example.com/gallery.jpg"],
      } as ListingImageInput),
    ).toBe("https://example.com/thumb.jpg");
  });

  it("falls back to the first image when thumbnail_url is missing", () => {
    expect(
      getListingImageUrl({
        images: ["https://example.com/gallery.jpg", "https://example.com/gallery-2.jpg"],
      } as ListingImageInput),
    ).toBe("https://example.com/gallery.jpg");
  });

  it("returns null when no image exists", () => {
    expect(getListingImageUrl({} as ListingImageInput)).toBeNull();
  });

  it("resolves relative thumbnails against the listing source URL", () => {
    expect(
      getListingImageUrl({
        thumbnail_url: "/images/listing-thumb.jpg",
        url: "https://www.riyasewana.com/buy/toyota-prius-1234",
      } as ListingImageInput),
    ).toBe("https://www.riyasewana.com/images/listing-thumb.jpg");
  });

  it("falls back to relative gallery images using external_url as base", () => {
    expect(
      getListingImageUrl({
        images: ["gallery/cover.webp"],
        external_url: "https://ikman.lk/en/ad/toyota-vitz-for-sale-colombo",
      } as ListingImageInput),
    ).toBe("https://ikman.lk/en/ad/gallery/cover.webp");
  });
});