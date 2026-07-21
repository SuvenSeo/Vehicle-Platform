import { memo } from "react";
import { CarListing } from "@/types/car";
import { formatPrice } from "@/services/api";
import { Gauge, MapPin, ArrowRight, Heart, Check, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { VehicleThumbnail } from "@/components/VehicleThumbnail";
import { PriceUnavailableBadge } from "@/components/PriceUnavailableBadge";
import { isReasonableListingPrice } from "@/lib/formatting";
import {
  getListingDaysOnMarketLabel,
  getListingDealLabel,
  getListingImageUrl,
} from "@/lib/listing-card-meta";
import { HybridCliffBadge } from "@/components/HybridCliffBadge";
import { MileageTrustChip } from "@/components/MileageTrustChip";
import { summarizeFmv } from "@/lib/fmv";

interface ListingCardProps {
  listing: CarListing;
  onCompareToggle?: (listing: CarListing) => void;
  isComparing?: boolean;
  onWatchlistToggle?: (listing: CarListing) => void;
  isWatchlisted?: boolean;
}

function getDealBadgeClasses(label: ReturnType<typeof getListingDealLabel>): string {
  // Near-opaque fills: these render over arbitrary photos, so translucent
  // tints cannot guarantee the 4.5:1 the 10px text needs (WCAG 1.4.3).
  if (label === "Good Deal") return "bg-zinc-950/85 border-emerald-500/40 text-emerald-300";
  if (label === "Overpriced") return "bg-zinc-950/85 border-rose-500/40 text-rose-300";
  return "bg-zinc-950/85 border-white/20 text-zinc-200";
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
  // null deal_score = rating suppressed server-side (thin cohort, old vehicle,
  // extreme price) — show no badge rather than a fake-neutral one.
  const hasDealScore = listing.deal_score !== null && listing.deal_score !== undefined;
  const dealScore = Number(listing.deal_score ?? 0);
  const imageUrl = getListingImageUrl(listing);
  const dealLabel = getListingDealLabel(dealScore);
  const daysOnMarketLabel = getListingDaysOnMarketLabel(listing.first_seen_at || listing.scraped_at);
  const priceValue = Number(listing.price_lkr || 0);
  const hasKnownPrice = isReasonableListingPrice(priceValue);
  const marketDeltaPct =
    hasKnownPrice && Number.isFinite(listing.market_median_lkr) && Number(listing.market_median_lkr) > 0
      ? (((priceValue - Number(listing.market_median_lkr)) / Number(listing.market_median_lkr)) * 100)
      : null;
  const fmv = hasKnownPrice
    ? summarizeFmv(priceValue, Number(listing.market_median_lkr || 0))
    : null;
  const marketPosition = marketDeltaPct === null ? 50 : clamp(50 - marketDeltaPct, 8, 92);
  const listingTitle = `${listing.make} ${listing.model} ${listing.variant || ""}`.trim();

  return (
    <article
      role="article"
      aria-label={`${listingTitle || "Vehicle"} listing card`}
      className="group relative isolate h-full overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-500 ease-apple hover:-translate-y-1 hover:border-primary/30 hover:shadow-soft-lg"
    >
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none" />
      <Link
        to={`/listing/${listing.id}`}
        aria-label={`Open ${listingTitle || "vehicle listing"}`}
        className="absolute inset-0 z-10 rounded-2xl"
      />

      <div className="pointer-events-none relative z-20 flex h-full flex-col">
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          <VehicleThumbnail
            src={imageUrl}
            listingId={listing.id}
            alt={`${listing.make} ${listing.model}`}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

          {/* Overlay badges */}
          <div className="absolute left-3 top-3 flex items-center gap-1.5">
            <span className="rounded-full border border-white/20 bg-black/60 px-2.5 py-0.5 text-[10px] font-semibold tracking-tight text-white backdrop-blur-md">
              {formatToken(listing.condition)}
            </span>
          </div>

          {/* Action buttons */}
          <div className="absolute right-3 top-3 flex items-center gap-1.5">
            {onWatchlistToggle && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onWatchlistToggle(listing); }}
                className={`pointer-events-auto relative z-30 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md transition-all ${
                  isWatchlisted
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-black/60 text-white/90 border-white/20 hover:text-white hover:bg-black/75"
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
                className={`pointer-events-auto relative z-30 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md transition-all ${
                  isComparing
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-black/60 text-white/90 border-white/20 hover:text-white hover:bg-black/75"
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
                className="bg-black/75 border-primary/40 text-primary-bright px-2 py-0.5 text-[10px] tracking-[0.1em]"
              />
            )}
            {hasDealScore && (
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] num ${getDealBadgeClasses(dealLabel)}`}>
                {dealScore >= 0 ? "+" : ""}{dealScore.toFixed(0)} deal
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-[16px] font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary truncate">
              {listingTitle}
            </h3>
            <span className="shrink-0 text-[13px] font-semibold text-muted-foreground num">{listing.year || "N/A"}</span>
          </div>

          {/* Spec grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Gauge className="h-3 w-3 text-muted-foreground/70" />
              {formatToken(listing.transmission)}
            </span>
            <span className="num">{formatMileage(listing.mileage_km)}</span>
            <span>{formatToken(listing.fuel_type)}</span>
            <span className="num">{formatEngineCc(listing.engine_cc)}</span>
          </div>
          <HybridCliffBadge
            fuelType={listing.fuel_type}
            engineCc={listing.engine_cc}
            compact
            className="self-start"
          />
          <MileageTrustChip
            mileageKm={listing.mileage_km}
            year={listing.year}
            className="self-start !px-1.5 !py-0.5 !text-[9px]"
          />

          {/* Market position bar */}
          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Fair market value
              </p>
              <p className={`text-[11px] font-semibold num ${
                fmv == null
                  ? "text-muted-foreground"
                  : fmv.band === "below"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : fmv.band === "above"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-foreground"
              }`}>
                {fmv == null ? "Pending" : fmv.label}
              </p>
            </div>
            {fmv != null && (
              <p className="mb-2 text-[10px] font-medium text-muted-foreground num">
                FMV {formatPrice(fmv.fmv_lkr)}
              </p>
            )}
            <div className="relative h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                  fmv == null
                    ? "bg-muted-foreground/50"
                    : fmv.band === "below"
                      ? "bg-emerald-500"
                      : fmv.band === "above"
                        ? "bg-rose-500"
                        : "bg-primary"
                }`}
                style={{ width: `${marketPosition}%` }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-auto flex items-center justify-between pt-3 border-t border-border">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-foreground/80 truncate">
                <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                {listing.district || "District N/A"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                {listing.source}
                {daysOnMarketLabel ? ` · ${daysOnMarketLabel}` : ""}
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border transition-all group-hover:border-primary/30 group-hover:bg-primary/10">
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});

ListingCard.displayName = "ListingCard";
