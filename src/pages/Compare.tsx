import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Scale, Search } from "lucide-react";
import { getListingsBatch } from "@/services/api";
import { CarListing } from "@/types/car";
import { ComparisonModal } from "@/components/ComparisonModal";
import { PageCanvas } from "@/components/PageCanvas";

const MAX_COMPARE_IDS = 4;

export default function Compare() {
  const [searchParams] = useSearchParams();
  const [listings, setListings] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const rawIds = searchParams.get("ids") ?? "";
  const ids = rawIds
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, MAX_COMPARE_IDS);

  const fetchListings = useCallback(async () => {
    if (ids.length === 0) {
      setListings([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getListingsBatch(ids);
      setListings(result);
      if (result.length >= 2) setModalOpen(true);
    } catch {
      setError("Failed to load listings. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [rawIds]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const hasIds = ids.length > 0;
  const hasEnough = listings.length >= 2;

  return (
    <PageCanvas>
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <Link
            to="/"
            className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-bright">
              <Scale className="h-3 w-3" />
              Compare
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Vehicle Comparison
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Side-by-side specs, pricing, and deal scores for up to {MAX_COMPARE_IDS} vehicles.
            </p>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex h-48 items-center justify-center">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-2 border-foreground/[0.08]" />
              <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Empty state — no ids in URL */}
        {!loading && !error && !hasIds && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary-bright">
              <Scale className="h-7 w-7" />
            </div>
            <h2 className="mb-2 font-display text-xl font-semibold text-foreground">
              No vehicles selected
            </h2>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Select vehicles from the Dashboard by clicking the compare toggle on each listing card, then open the full compare view.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-foreground no-underline transition-colors hover:bg-accent"
            >
              <Search className="h-3.5 w-3.5" />
              Browse listings
            </Link>
          </div>
        )}

        {/* Partial — ids provided but couldn't load enough */}
        {!loading && !error && hasIds && !hasEnough && listings.length > 0 && (
          <div className="rounded-2xl border border-border bg-card/60 px-5 py-6">
            <p className="text-sm font-semibold text-foreground">Only {listings.length} listing loaded.</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Need at least 2 vehicles to compare. Some IDs may be invalid or inactive.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-foreground no-underline transition-colors hover:bg-accent"
            >
              <Search className="h-3.5 w-3.5" />
              Select more vehicles
            </Link>
          </div>
        )}

        {/* Ready state — show ComparisonModal inline */}
        {!loading && !error && hasEnough && (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[13px] text-muted-foreground">
                Comparing <span className="font-semibold text-foreground">{listings.length}</span> vehicles
              </p>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-4 text-[12px] font-semibold text-primary-bright transition-colors hover:bg-primary/15"
              >
                <Scale className="h-3.5 w-3.5" />
                Open full compare
              </button>
            </div>

            {/* Vehicle summary tiles */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <Link
                  key={listing.id}
                  to={`/listing/${listing.id}`}
                  className="rounded-2xl border border-border bg-card p-4 no-underline transition-colors hover:border-primary/30 hover:bg-accent/40"
                >
                  <p className="font-display text-[15px] font-semibold text-foreground">
                    {listing.make} {listing.model}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {listing.year ?? "—"}
                    {listing.variant ? ` · ${listing.variant}` : ""}
                  </p>
                  {listing.price_lkr ? (
                    <p className="mt-2 text-[13px] font-semibold tabular-nums text-primary-bright">
                      LKR {Number(listing.price_lkr).toLocaleString()}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>

            <ComparisonModal listings={listings} open={modalOpen} onClose={() => setModalOpen(false)} />
          </>
        )}
      </div>
    </PageCanvas>
  );
}
