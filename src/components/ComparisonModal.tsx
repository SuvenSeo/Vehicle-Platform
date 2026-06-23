import { memo, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, BadgeCheck, Calendar, Gauge, MapPin, Scale, WalletCards } from "lucide-react";
import { CarListing } from "@/types/car";
import { formatPrice } from "@/services/api";
import { ConditionBadge } from "./ConditionBadge";
import { DealScoreBadge } from "./DealScoreBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getListingImageUrl } from "@/lib/listing-card-meta";
import { VehicleThumbnail } from "@/components/VehicleThumbnail";

interface ComparisonModalProps {
  listings: CarListing[];
  open: boolean;
  onClose: () => void;
}

type ComparisonRow = {
  key: string;
  label: string;
  render: (listing: CarListing) => ReactNode;
  value?: (listing: CarListing) => number | null;
  better?: "higher" | "lower";
};

type ComparisonListing = CarListing & {
  mileage?: number | null;
  mileage_km?: number | null;
  engine_cc?: number | null;
  engine_capacity?: number | null;
};

function toNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatToken(value: string | undefined): string {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function getMileageKm(listing: CarListing): number | null {
  const candidate = listing as ComparisonListing;
  return toNumber(candidate.mileage_km ?? candidate.mileage);
}

function getEngineCc(listing: CarListing): number | null {
  const candidate = listing as ComparisonListing;
  return toNumber(candidate.engine_cc ?? candidate.engine_capacity);
}

function listingAgeLabel(listing: CarListing): string {
  const base = listing.first_seen_at || listing.scraped_at;
  if (!base) return "Unknown";
  const ts = new Date(base).getTime();
  if (!Number.isFinite(ts)) return "Unknown";

  const days = Math.max(1, Math.round((Date.now() - ts) / 86_400_000));
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export const ComparisonModal = memo(function ComparisonModal({ listings, open, onClose }: ComparisonModalProps) {
  const rows = useMemo<ComparisonRow[]>(
    () => [
      {
        key: "price",
        label: "Price",
        render: (listing) => <span className="font-semibold text-primary">{formatPrice(listing.price_lkr)}</span>,
        value: (listing) => toNumber(listing.price_lkr),
        better: "lower",
      },
      {
        key: "deal_score",
        label: "Deal Score",
        render: (listing) => <DealScoreBadge score={listing.deal_score} />,
        value: (listing) => toNumber(listing.deal_score),
        better: "higher",
      },
      {
        key: "year",
        label: "Year",
        render: (listing) => listing.year || "-",
        value: (listing) => toNumber(listing.year),
        better: "higher",
      },
      {
        key: "mileage",
        label: "Mileage",
        render: (listing) => {
          const mileage = getMileageKm(listing);
          return mileage ? `${mileage.toLocaleString()} km` : "-";
        },
        value: getMileageKm,
        better: "lower",
      },
      {
        key: "condition",
        label: "Condition",
        render: (listing) => <ConditionBadge condition={listing.condition} />,
      },
      {
        key: "body",
        label: "Body",
        render: (listing) => formatToken(listing.body_type),
      },
      {
        key: "transmission",
        label: "Transmission",
        render: (listing) => formatToken(listing.transmission),
      },
      {
        key: "fuel",
        label: "Fuel",
        render: (listing) => formatToken(listing.fuel_type),
      },
      {
        key: "engine",
        label: "Engine",
        render: (listing) => {
          const engine = getEngineCc(listing);
          return engine ? `${engine} cc` : "-";
        },
        value: getEngineCc,
        better: "higher",
      },
      {
        key: "district",
        label: "District",
        render: (listing) => listing.district || "-",
      },
      {
        key: "source",
        label: "Source",
        render: (listing) => formatToken(listing.source),
      },
      {
        key: "listed",
        label: "First Seen",
        render: (listing) => listingAgeLabel(listing),
      },
    ],
    [],
  );

  const bestByRow = useMemo(() => {
    const next = new Map<string, number>();

    rows.forEach((row) => {
      if (!row.value || !row.better) return;

      const values = listings.map((listing, index) => ({ index, value: row.value ? row.value(listing) : null }));
      const finite = values.filter((item) => item.value !== null) as Array<{ index: number; value: number }>;
      if (!finite.length) return;

      const best = row.better === "lower"
        ? finite.reduce((acc, item) => (item.value < acc.value ? item : acc))
        : finite.reduce((acc, item) => (item.value > acc.value ? item : acc));

      next.set(row.key, best.index);
    });

    return next;
  }, [listings, rows]);

  const bestDealListing = useMemo(
    () =>
      [...listings]
        .filter((listing) => toNumber(listing.deal_score) !== null)
        .sort((a, b) => Number(b.deal_score || 0) - Number(a.deal_score || 0))[0] ?? null,
    [listings],
  );

  const lowestPriceListing = useMemo(
    () =>
      [...listings]
        .filter((listing) => toNumber(listing.price_lkr) !== null)
        .sort((a, b) => Number(a.price_lkr || 0) - Number(b.price_lkr || 0))[0] ?? null,
    [listings],
  );

  const priceSpreadLabel = useMemo(() => {
    const prices = listings.map((listing) => Number(listing.price_lkr)).filter((price) => Number.isFinite(price) && price > 0);
    if (prices.length < 2) return "Not enough data";
    return formatPrice(Math.max(...prices) - Math.min(...prices));
  }, [listings]);

  if (listings.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] max-w-[1180px] overflow-hidden border-white/10 bg-[#050607] p-0 text-white">
        <div className="max-h-[92vh] overflow-y-auto">
          <DialogHeader className="border-b border-border bg-[#080909] px-5 py-5 text-left md:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 tech-label text-primary">
                  <Scale className="h-3.5 w-3.5" />
                  Decision comparison
                </div>
                <DialogTitle className="text-3xl font-bold tracking-normal text-white md:text-4xl">Compare selected vehicles</DialogTitle>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Price, deal score, age, mileage, source, and location in one ranked view.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-left">
                <div className="rounded-xl border border-border bg-foreground/[0.03] px-3 py-2.5">
                  <p className="tech-label text-muted-foreground">Compared</p>
                  <p className="mt-1 text-lg font-bold text-white num">{listings.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-foreground/[0.03] px-3 py-2.5">
                  <p className="tech-label text-muted-foreground">Price gap</p>
                  <p className="mt-1 truncate text-lg font-bold text-white num">{priceSpreadLabel}</p>
                </div>
                <div className="rounded-xl border border-border bg-foreground/[0.03] px-3 py-2.5">
                  <p className="tech-label text-muted-foreground">Leader</p>
                  <p className="mt-1 truncate text-lg font-bold text-white">{bestDealListing ? `${bestDealListing.make} ${bestDealListing.model}` : "N/A"}</p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 px-5 py-5 md:px-7">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing) => {
                const image = getListingImageUrl(listing);
                const mileage = getMileageKm(listing);
                const isBestDeal = bestDealListing?.id === listing.id;
                const isLowestPrice = lowestPriceListing?.id === listing.id;

                return (
                  <article key={listing.id} className="overflow-hidden rounded-xl border border-border bg-[#0b0d0d]">
                    <div className="relative h-44 bg-black/40">
                      <VehicleThumbnail
                        src={image}
                        listingId={listing.id}
                        alt={`${listing.make} ${listing.model}`}
                        className="h-full w-full object-cover"
                        placeholderClassName="flex h-full w-full items-center justify-center bg-black/40 text-xs uppercase tracking-[0.2em] text-muted-foreground"
                      />
                      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                        {isBestDeal ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 tech-label text-primary">
                            <BadgeCheck className="h-3 w-3" />
                            Best deal
                          </span>
                        ) : null}
                        {isLowestPrice ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 tech-label text-white backdrop-blur">
                            <ArrowDownRight className="h-3 w-3" />
                            Lowest price
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-4 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold tracking-normal text-white">
                          {listing.make} {listing.model}
                        </p>
                        <p className="mt-1 truncate tech-label text-muted-foreground">
                          {listing.year || "Year N/A"} / {formatToken(listing.condition)} / {formatToken(listing.source)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-border bg-black/25 px-3 py-2.5">
                          <p className="tech-label text-muted-foreground">Price</p>
                          <p className="mt-1 text-base font-bold text-primary num">{formatPrice(listing.price_lkr)}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-black/25 px-3 py-2.5">
                          <p className="tech-label text-muted-foreground">Deal score</p>
                          <div className="mt-1">
                            <DealScoreBadge score={listing.deal_score} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-caption font-semibold text-foreground">
                        <span className="inline-flex min-w-0 items-center gap-1.5 truncate rounded-xl border border-border bg-foreground/[0.03] px-2.5 py-2">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {listing.year || "Unknown"}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1.5 truncate rounded-xl border border-border bg-foreground/[0.03] px-2.5 py-2">
                          <Gauge className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {mileage ? `${Math.round(mileage / 1000)}k km` : "Mileage N/A"}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1.5 truncate rounded-xl border border-border bg-foreground/[0.03] px-2.5 py-2">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {listing.district || "District N/A"}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1.5 truncate rounded-xl border border-border bg-foreground/[0.03] px-2.5 py-2">
                          <WalletCards className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {formatToken(listing.fuel_type)}
                        </span>
                      </div>

                      <Link
                        to={`/listing/${listing.id}`}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 tech-label text-primary no-underline transition-colors hover:bg-primary/15"
                      >
                        Open listing
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </section>

            <section className="overflow-hidden rounded-xl border border-border bg-[#0a0b0b]">
              <div className="border-b border-border px-4 py-4">
                <p className="tech-label text-muted-foreground">Comparison matrix</p>
                <h3 className="mt-1 text-xl font-bold tracking-normal text-white">Ranked listing details</h3>
              </div>

              <div className="overflow-x-auto p-3">
                <div className="min-w-[820px] space-y-2">
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `minmax(140px, 180px) repeat(${listings.length}, minmax(190px, 1fr))`,
                    }}
                  >
                    <div className="rounded-xl border border-border bg-black/25 px-3 py-2 tech-label text-muted-foreground">
                      Metric
                    </div>
                    {listings.map((listing) => (
                      <div key={`header-${listing.id}`} className="truncate rounded-xl border border-border bg-foreground/[0.03] px-3 py-2 text-sm font-bold text-white">
                        {listing.make} {listing.model}
                      </div>
                    ))}
                  </div>

                  {rows.map((row) => (
                    <div
                      key={row.key}
                      className="grid gap-2"
                      style={{
                        gridTemplateColumns: `minmax(140px, 180px) repeat(${listings.length}, minmax(190px, 1fr))`,
                      }}
                    >
                      <div className="flex items-center rounded-xl border border-border bg-black/25 px-3 py-2 tech-label text-muted-foreground">
                        {row.label}
                      </div>

                      {listings.map((listing, index) => {
                        const isBest = bestByRow.get(row.key) === index;
                        return (
                          <div
                            key={`${row.key}-${listing.id}`}
                            className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold ${
                              isBest
                                ? "border-primary/35 bg-primary/10 text-primary"
                                : "border-border bg-white/[0.025] text-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0">{row.render(listing)}</span>
                              {isBest ? (
                                <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 tech-label text-primary">
                                  Leader
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

ComparisonModal.displayName = "ComparisonModal";
