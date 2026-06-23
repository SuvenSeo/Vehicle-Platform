import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, SearchX, Star, TrendingUp } from "lucide-react";
import { getListings, formatPrice } from "@/services/api";
import type { CarListing, FilterState } from "@/types/car";
import { VehicleThumbnail } from "@/components/VehicleThumbnail";
import { pickVehicleImageUrl } from "@/lib/listingImage";
import { isReasonableListingPrice } from "@/lib/formatting";

const PICKS_PAGES = 4;
const MIN_DEAL_SCORE = 8;

function dealBand(score: number): "elite" | "strong" | "watch" {
  if (score >= 15) return "elite";
  if (score >= 10) return "strong";
  return "watch";
}

function dealBandLabel(score: number): string {
  const b = dealBand(score);
  return b === "elite" ? "Elite" : b === "strong" ? "Strong" : "Watch";
}

function dealBandChip(score: number): string {
  const b = dealBand(score);
  if (b === "elite") return "border-emerald-500/20 bg-emerald-500/8 text-emerald-300";
  if (b === "strong") return "border-emerald-500/15 bg-emerald-500/5 text-emerald-300/80";
  return "border-primary/15 bg-primary/5 text-primary/80";
}

function dealMeter(score: number): string {
  return dealBand(score) === "watch" ? "bg-primary/60" : "bg-emerald-500/60";
}

export default function BestPicks() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<CarListing[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const base: FilterState = { sort: "deal_score", page: 1 };
        const responses = await Promise.all(Array.from({ length: PICKS_PAGES }, (_, i) => getListings({ ...base, page: i + 1 })));
        if (cancelled) return;
        const unique = new Map<number, CarListing>();
        responses.flatMap((r) => r.listings)
          .filter((l) => Number(l.deal_score || 0) >= MIN_DEAL_SCORE && isReasonableListingPrice(Number(l.price_lkr || 0)))
          .sort((a, b) => Number(b.deal_score || 0) - Number(a.deal_score || 0))
          .forEach((l) => { if (!unique.has(l.id)) unique.set(l.id, l); });
        setPicks(Array.from(unique.values()));
      } catch { if (!cancelled) setError("Unable to load best picks."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const topScore = useMemo(() => picks.reduce((mx, l) => Math.max(mx, Number(l.deal_score || 0)), 0), [picks]);
  const [featured, ...rest] = picks;

  return (
    <div className="min-h-screen">
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/70">Best picks</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-[-0.035em] leading-[1.02] text-foreground sm:text-[2.75rem] lg:text-[3rem]">Deal-score picks.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            {loading ? "Scanning inventory..." : `${picks.length} vehicles scored ${MIN_DEAL_SCORE}+ from ${PICKS_PAGES} pages, ranked by deal strength.`}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 space-y-8">
        {loading ? (
          <div className="space-y-3">
            <div className="skeleton-shimmer h-56 rounded-xl" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton-shimmer h-64 rounded-xl" />)}
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
            <SearchX className="h-5 w-5 text-muted-foreground" />
            <p className="text-[13px] text-muted-foreground">{error}</p>
            <Link to="/#market" className="rounded-lg border border-border px-4 py-2 text-[11px] font-semibold text-foreground no-underline hover:bg-foreground/[0.03]">Open inventory</Link>
          </div>
        ) : picks.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <p className="text-[13px] text-muted-foreground">No vehicles meet the deal-score gate right now.</p>
            <Link to="/#market" className="rounded-lg border border-border px-4 py-2 text-[11px] font-semibold text-foreground no-underline hover:bg-foreground/[0.03]">Browse inventory</Link>
          </div>
        ) : (
          <>
            {/* Featured */}
            {featured && (() => {
              const score = Number(featured.deal_score || 0);
              const pct = topScore > 0 ? Math.min(100, Math.round((score / topScore) * 100)) : 0;
              return (
                <article className="grid overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[1.1fr_1fr]">
                  <Link to={`/listing/${featured.id}`} className="block aspect-[16/10] overflow-hidden bg-black/30 no-underline lg:aspect-auto lg:min-h-[300px]">
                    <VehicleThumbnail src={pickVehicleImageUrl([featured.thumbnail_url, ...(Array.isArray(featured.images) ? featured.images : [])], [featured.url, featured.detail_url, featured.external_url])} listingId={featured.id} alt={`${featured.make} ${featured.model}`} className="h-full w-full object-cover" />
                  </Link>
                  <div className="flex flex-col justify-between gap-5 p-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-muted-foreground">{featured.source}</span>
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${dealBandChip(score)}`}>
                          <Star className="mr-1 inline h-3 w-3" />{dealBandLabel(score)}
                        </span>
                      </div>
                      <Link to={`/listing/${featured.id}`} className="block no-underline">
                        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{featured.make} {featured.model}</h2>
                        <p className="mt-1 text-[12px] text-muted-foreground">{featured.year || "N/A"} · {featured.district || "LK"}</p>
                      </Link>
                      <div className="flex items-baseline justify-between border-t border-border pt-3">
                        <p className="num text-2xl font-bold text-foreground">{formatPrice(Number(featured.price_lkr || 0))}</p>
                        <p className="num text-[12px] font-bold text-emerald-400">+{score.toFixed(0)} deal</p>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-secondary/50">
                        <div className={`h-full rounded-full ${dealMeter(score)}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/listing/${featured.id}`} className="flex h-10 flex-1 items-center justify-center rounded-lg bg-[var(--gold)] text-[10px] font-bold uppercase tracking-[0.08em] text-white no-underline hover:bg-[var(--gold-bright)]">Open detail</Link>
                      {featured.external_url && (
                        <a href={featured.external_url} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center gap-1 rounded-lg border border-border px-3 text-[10px] font-semibold text-muted-foreground no-underline hover:text-foreground">
                          Source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })()}

            {/* Grid */}
            {rest.length > 0 && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ranked picks</h3>
                  <span className="text-[10px] text-muted-foreground num">{rest.length} more</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((listing, idx) => {
                    const score = Number(listing.deal_score || 0);
                    const pct = topScore > 0 ? Math.min(100, Math.round((score / topScore) * 100)) : 0;
                    return (
                      <article key={listing.id} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-border">
                        <Link to={`/listing/${listing.id}`} className="relative block aspect-[16/10] overflow-hidden bg-black/30 no-underline">
                          <VehicleThumbnail src={pickVehicleImageUrl([listing.thumbnail_url, ...(Array.isArray(listing.images) ? listing.images : [])], [listing.url, listing.detail_url, listing.external_url])} listingId={listing.id} alt={`${listing.make} ${listing.model}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                          <span className="absolute left-2 top-2 rounded-md border border-border bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white num backdrop-blur-sm">{String(idx + 2).padStart(2, "0")}</span>
                        </Link>
                        <div className="flex flex-1 flex-col gap-3 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{listing.source}</span>
                            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${dealBandChip(score)}`}>{dealBandLabel(score)}</span>
                          </div>
                          <Link to={`/listing/${listing.id}`} className="block no-underline">
                            <h3 className="text-[14px] font-semibold text-foreground truncate">{listing.make} {listing.model}</h3>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">{listing.year || "N/A"} · {listing.district || "LK"}</p>
                          </Link>
                          <div className="flex items-baseline justify-between">
                            <span className="num text-base font-bold text-foreground">{formatPrice(Number(listing.price_lkr || 0))}</span>
                            <span className="num text-[10px] font-bold text-emerald-400">+{score.toFixed(0)}</span>
                          </div>
                          <div className="mt-auto h-1 overflow-hidden rounded-full bg-secondary/50">
                            <div className={`h-full rounded-full ${dealMeter(score)}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
