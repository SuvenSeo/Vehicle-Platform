import { memo } from "react";
import { CarListing } from "@/types/car";
import { formatPrice } from "@/services/api";
import { Gauge, MapPin, ArrowRight, Heart, Check, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { VehicleThumbnail } from "@/components/VehicleThumbnail";
import { PriceUnavailableBadge } from "@/components/PriceUnavailableBadge";
import { FairPriceIndicator } from "@/components/FairPriceIndicator";
import { isReasonableListingPrice } from "@/lib/formatting";
import { getListingDealLabel, getListingImageUrl, getListingRecencyLabel } from "@/lib/listing-card-meta";

interface ListingCardProps {
  listing: CarListing;
  onCompareToggle?: (listing: CarListing) => void;
  isComparing?: boolean;
  onWatchlistToggle?: (listing: CarListing) => void;
  isWatchlisted?: boolean;
}

function getDealBadgeClasses(label: ReturnType<typeof getListingDealLabel>): string {
  if (label === "Good Deal") {
    return "bg-emerald-500/12 border-emerald-500/30 text-emerald-300";
  }
  if (label === "Overpriced") {
    return "bg-rose-500/12 border-rose-500/30 text-rose-300";
  }
  return "bg-white/[0.035] border-white/10 text-zinc-300";
}

function formatToken(value: string | undefined): string {
  if (!value) return "Unknown";
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMileage(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return "Mileage N/A";
  if ((value as number) >= 1000) {
    const compact = ((value as number) / 1000).toFixed((value as number) >= 100000 ? 0 : 1).replace(/\.0$/, "");
    return `${compact}k km`;
  }
  return `${value} km`;
}

function formatEngineCc(value: number | null | undefined): string {
  if (!Number.isFinite(value) || Number(value) <= 0) return "CC N/A";
  return `${Math.round(Number(value)).toLocaleString()} cc`;
}

function getIntegrityScore(listing: CarListing): number {
  const nowYear = new Date().getFullYear();
  const agePenalty = Math.max(0, nowYear - Number(listing.year || nowYear)) * 1.9;
  const mileagePenalty = Number.isFinite(listing.mileage_km) ? Math.min(26, Number(listing.mileage_km) / 9000) : 14;
  const conditionBoost =
    listing.condition === "brand_new" ? 18
      : listing.condition === "reconditioned" ? 13
      : 7;
  const dealBoost = clamp(Number(listing.deal_score || 0) * 0.55, -6, 8);
  const dealerBoost = listing.is_dealer ? 4 : 0;
  return clamp(Math.round(71 + conditionBoost + dealerBoost + dealBoost - agePenalty - mileagePenalty), 34, 97);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const ListingCard = memo(function ListingCard({
  listing,
  onCompareToggle,
  isComparing,
  onWatchlistToggle,
  isWatchlisted,
}: ListingCardProps) {
  const dealScore = Number(listing.deal_score ?? 0);
  const imageUrl = getListingImageUrl(listing);
  const dealLabel = getListingDealLabel(dealScore);
  const integrityScore = getIntegrityScore(listing);
  const recency = getListingRecencyLabel(listing.first_seen_at || listing.scraped_at);
  const priceValue = Number(listing.price_lkr || 0);
  const hasKnownPrice = isReasonableListingPrice(priceValue);
  const marketDeltaPct =
    hasKnownPrice && Number.isFinite(listing.market_median_lkr) && Number(listing.market_median_lkr) > 0
      ? (((priceValue - Number(listing.market_median_lkr)) / Number(listing.market_median_lkr)) * 100)
      : null;
  const marketPosition = marketDeltaPct === null ? 50 : clamp(50 - marketDeltaPct, 8, 92);
  const listingTitle = `${listing.make} ${listing.model} ${listing.variant || ""}`.trim();

  return (
    <article
      role="article"
      aria-label={`${listingTitle || "Vehicle"} listing card`}
      className="vehicle-card surface surface--interactive group relative isolate h-full"
    >
      <Link
        to={`/listing/${listing.id}`}
        aria-label={`Open ${listingTitle || "vehicle listing"}`}
        className="absolute inset-0 z-10 rounded-xl"
      />
      <div className="pointer-events-none relative z-20 flex h-full flex-col space-y-4 p-4 sm:p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <span className="tech-label flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-zinc-400">
                {formatToken(listing.condition)}
            </span>
            <FairPriceIndicator score={dealScore} condition={listing.condition} />
            {integrityScore > 75 && (
              <span className="tech-label flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-amber-200">
                High confidence
              </span>
            )}
           </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="tech-label rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-zinc-200">
              {integrityScore}/100
            </span>
            {onWatchlistToggle && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onWatchlistToggle(listing);
                }}
                className={`pointer-events-auto relative z-30 flex h-9 w-9 items-center justify-center rounded-lg border transition-[border-color,background-color,color,box-shadow,transform,opacity] ${
                  isWatchlisted
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    : "text-zinc-400 border-white/10 hover:text-amber-200 hover:border-amber-300/25"
                }`}
                aria-label={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
              >
                <Heart className={`w-4 h-4 ${isWatchlisted ? "fill-current" : ""}`} />
              </button>
            )}
            {onCompareToggle && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCompareToggle(listing);
                }}
                className={`pointer-events-auto relative z-30 flex h-9 w-9 items-center justify-center rounded-lg border transition-[border-color,background-color,color,box-shadow,transform,opacity] ${
                  isComparing
                    ? "bg-amber-500 text-black border-amber-500"
                    : "text-zinc-400 border-white/10 hover:text-white hover:border-white/20"
                }`}
                aria-label={isComparing ? "Remove from comparison" : "Add to comparison"}
              >
                {isComparing ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* IMAGE */}
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-white/10 bg-black/30 transition-colors group-hover:border-amber-300/25">
          <VehicleThumbnail
            src={imageUrl}
            listingId={listing.id}
            alt={`${listing.make} ${listing.model}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
           <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/14 to-transparent opacity-85" />
           <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-40" />
           <div className="tech-label absolute left-3 top-3 rounded-md border border-white/15 bg-black/50 px-2.5 py-1 text-zinc-200 backdrop-blur">
              Scraped {recency}
           </div>
           
           <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
              {hasKnownPrice ? (
                <p className="text-[20px] font-bold text-white tracking-tight leading-none num">
                  {formatPrice(priceValue)}
                </p>
              ) : (
                <PriceUnavailableBadge
                  label="Price unavailable"
                  className="bg-black/55 border-amber-300/55 text-amber-100 px-2 py-1 tracking-[0.1em]"
                />
              )}
              <span className={`tech-label num rounded-md border px-2.5 py-1 ${getDealBadgeClasses(dealLabel)}`}>
                {dealScore >= 0 ? "+" : ""}{dealScore.toFixed(0)}
              </span>
           </div>
        </div>

        {/* DETAILS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h3 className="headline-display truncate text-[19px] transition-colors group-hover:text-amber-50">
                {listingTitle}
            </h3>
            <span className="text-[13px] font-bold text-zinc-300 num">{listing.year || "N/A"}</span>
          </div>
          <div className="tech-label grid grid-cols-2 gap-2 text-zinc-300">
            <span className="flex items-center gap-1.5"><Gauge className="h-3 w-3" /> {formatToken(listing.transmission)}</span>
            <span>{formatMileage(listing.mileage_km)}</span>
            <span>{formatToken(listing.fuel_type)}</span>
            <span>{formatEngineCc(listing.engine_cc)}</span>
            <span>{formatToken(listing.body_type)}</span>
            <span className="text-zinc-400">{listing.is_dealer ? "Dealer" : "Private"}</span>
          </div>
          <div className="data-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="tech-label">Market Position</p>
              <p className={`text-label font-bold num ${marketDeltaPct === null ? "text-zinc-500" : marketDeltaPct <= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {marketDeltaPct === null
                  ? "Median pending"
                  : `${Math.abs(marketDeltaPct).toFixed(1)}% ${marketDeltaPct <= 0 ? "below" : "above"} median`}
              </p>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div className={`absolute inset-y-0 left-0 rounded-full ${marketDeltaPct === null ? "bg-zinc-600" : marketDeltaPct <= 0 ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${marketPosition}%` }} />
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-auto flex items-center justify-between border-t border-white/[0.08] pt-4">
            <div>
            <p className="tech-label flex items-center gap-1.5 text-zinc-300">
                  <MapPin className="h-3 w-3" />
                  {listing.district || "District N/A"}
              </p>
            <p className="tech-label text-zinc-500">
                  {listing.source} · {recency}
              </p>
            </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.03] transition-colors group-hover:border-amber-300/25 group-hover:bg-amber-500/10">
            <ArrowRight className="h-3.5 w-3.5 text-zinc-300 transition-transform group-hover:translate-x-0.5" />
            </div>
        </div>
      </div>
    </article>
  );
});

ListingCard.displayName = "ListingCard";


