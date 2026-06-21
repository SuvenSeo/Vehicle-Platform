import { pickVehicleImageUrl } from "@/lib/listingImage";

type ListingImageSource = {
  thumbnail_url?: string | null;
  images?: unknown[];
  url?: string | null;
  detail_url?: string | null;
  external_url?: string | null;
};

export function getListingImageUrl(listing: ListingImageSource): string | null {
  const baseUrls = [listing.url, listing.detail_url, listing.external_url];
  return pickVehicleImageUrl(
    [
      listing.thumbnail_url,
      ...(Array.isArray(listing.images) ? listing.images : []),
    ],
    baseUrls,
  );
}

export function getListingDealLabel(rawScore: number): "Good Deal" | "Fair Price" | "Overpriced" {
  if (Number.isFinite(rawScore) && rawScore >= 8) return "Good Deal";
  if (Number.isFinite(rawScore) && rawScore <= -5) return "Overpriced";
  return "Fair Price";
}

export function getListingRecencyLabel(iso: string | null): string {
  if (!iso) return "Today";
  const d = new Date(iso);
  const now = new Date();
  const diffHrs = Math.floor((now.getTime() - d.getTime()) / 3_600_000);
  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-LK", {
    month: "short",
    day: "numeric",
  });
}
