import { describe, expect, it } from "vitest";
import { getListingImageUrl } from "@/lib/listing-card-meta";

describe("getListingImageUrl", () => {
  it("prefers thumbnail_url when available", () => {
    expect(
      getListingImageUrl({
        thumbnail_url: "https://example.com/thumb.jpg",
        images: ["https://example.com/gallery.jpg"],
      } as any),
    ).toBe("https://example.com/thumb.jpg");
  });

  it("falls back to the first image when thumbnail_url is missing", () => {
    expect(
      getListingImageUrl({
        images: ["https://example.com/gallery.jpg", "https://example.com/gallery-2.jpg"],
      } as any),
    ).toBe("https://example.com/gallery.jpg");
  });

  it("returns null when no image exists", () => {
    expect(getListingImageUrl({} as any)).toBeNull();
  });

  it("resolves relative thumbnails against the listing source URL", () => {
    expect(
      getListingImageUrl({
        thumbnail_url: "/images/listing-thumb.jpg",
        url: "https://www.riyasewana.com/buy/toyota-prius-1234",
      } as any),
    ).toBe("https://www.riyasewana.com/images/listing-thumb.jpg");
  });

  it("falls back to relative gallery images using external_url as base", () => {
    expect(
      getListingImageUrl({
        images: ["gallery/cover.webp"],
        external_url: "https://ikman.lk/en/ad/toyota-vitz-for-sale-colombo",
      } as any),
    ).toBe("https://ikman.lk/en/ad/gallery/cover.webp");
  });
});