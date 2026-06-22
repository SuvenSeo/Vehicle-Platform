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
  if (label === "Good Deal") return "bg-emerald-500/10 border-emerald-500/20 text-emerald-300";
  if (label === "Overpriced") return "bg-rose-500/10 border-rose-500/20 text-rose-300";
  return "bg-white/[0.03] border-white/[0.08] text-zinc-400";
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
      className="group relative isolate h-full overflow-hidden rounded-xl border border-white/[0.06] bg-[hsl(220,8%,6%)] transition-all duration-300 hover:border-white/[0.1] hover:bg-[hsl(220,8%,7%)]"
    >
      <Link
        to={`/listing/${listing.id}`}
        aria-label={`Open ${listingTitle || "vehicle listing"}`}
        className="absolute inset-0 z-10 rounded-xl"
      />

      <div className="pointer-events-none relative z-20 flex h-full flex-col">
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden bg-black/40">
          <VehicleThumbnail
            src={imageUrl}
            listingId={listing.id}
            alt={`${listing.make} ${listing.model}`}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,8%,6%)] via-black/20 to-transparent" />

          {/* Overlay badges */}
          <div className="absolute left-3 top-3 flex items-center gap-1.5">
            <span className="rounded-md border border-white/[0.1] bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-300 backdrop-blur-sm">
              {formatToken(listing.condition)}
            </span>
            <span className="rounded-md border border-white/[0.1] bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 backdrop-blur-sm">
              {recency}
            </span>
          </div>

          {/* Action buttons */}
          <div className="absolute right-3 top-3 flex items-center gap-1.5">
            {onWatchlistToggle && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onWatchlistToggle(listing); }}
                className={`pointer-events-auto relative z-30 flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-sm transition-all ${
                  isWatchlisted
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/25"
                    : "bg-black/40 text-zinc-400 border-white/[0.1] hover:text-amber-200 hover:border-amber-300/20"
                }`}
                aria-label={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
              >
                <Heart className={`w-3.5 h-3.5 ${isWatchlisted ? "fill-current" : ""}`} />
              </button>
            )}
            {onCompareToggle && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCompareToggle(listing); }}
                className={`pointer-events-auto relative z-30 flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-sm transition-all ${
                  isComparing
                    ? "bg-amber-500 text-black border-amber-500"
                    : "bg-black/40 text-zinc-400 border-white/[0.1] hover:text-white hover:border-white/[0.15]"
                }`}
                aria-label={isComparing ? "Remove from comparison" : "Add to comparison"}
              >
                {isComparing ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              </button>
            )}
          </div>

          {/* Price overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
            {hasKnownPrice ? (
              <p className="text-xl font-bold tracking-tight text-white num leading-none">
                {formatPrice(priceValue)}
              </p>
            ) : (
              <PriceUnavailableBadge
                label="Price unavailable"
                className="bg-black/50 border-amber-300/40 text-amber-100 px-2 py-0.5 text-[10px] tracking-[0.1em]"
              />
            )}
            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] num ${getDealBadgeClasses(dealLabel)}`}>
              {dealScore >= 0 ? "+" : ""}{dealScore.toFixed(0)} deal
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-[16px] font-semibold tracking-tight text-foreground transition-colors group-hover:text-amber-50 truncate">
              {listingTitle}
            </h3>
            <span className="shrink-0 text-[13px] font-bold text-zinc-400 num">{listing.year || "N/A"}</span>
          </div>

          {/* Spec grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-medium text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Gauge className="h-3 w-3 text-zinc-600" />
              {formatToken(listing.transmission)}
            </span>
            <span className="num">{formatMileage(listing.mileage_km)}</span>
            <span>{formatToken(listing.fuel_type)}</span>
            <span className="num">{formatEngineCc(listing.engine_cc)}</span>
          </div>

          {/* Market position bar */}
          <div className="rounded-lg border border-white/[0.05] bg-[hsl(220,8%,5%)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600">Market position</p>
              <p className={`text-[10px] font-bold num ${
                marketDeltaPct === null ? "text-zinc-600" : marketDeltaPct <= 0 ? "text-emerald-400" : "text-rose-400"
              }`}>
                {marketDeltaPct === null
                  ? "Pending"
                  : `${Math.abs(marketDeltaPct).toFixed(1)}% ${marketDeltaPct <= 0 ? "below" : "above"}`}
              </p>
            </div>
            <div className="relative h-1 overflow-hidden rounded-full bg-zinc-800/60">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                  marketDeltaPct === null ? "bg-zinc-700" : marketDeltaPct <= 0 ? "bg-emerald-500/70" : "bg-rose-500/70"
                }`}
                style={{ width: `${marketPosition}%` }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/[0.04]">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 truncate">
                <MapPin className="h-3 w-3 shrink-0 text-zinc-600" />
                {listing.district || "District N/A"}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-600 truncate">
                {listing.source} · Score {integrityScore}/100
              </p>
            </div>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.06] transition-all group-hover:border-amber-400/15 group-hover:bg-amber-500/8">
              <ArrowRight className="h-3 w-3 text-zinc-500 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-amber-300" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});

ListingCard.displayName = "ListingCard";
