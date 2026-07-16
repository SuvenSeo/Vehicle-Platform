import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink, SearchX, Star, TrendingDown, TrendingUp } from "lucide-react";
import { getListings, getPriceDrops, formatPrice } from "@/services/api";
import type { CarListing, FilterState, PriceDropItem } from "@/types/car";
import { VehicleThumbnail } from "@/components/VehicleThumbnail";
import { pickVehicleImageUrl } from "@/lib/listingImage";
import { isReasonableListingPrice } from "@/lib/formatting";
import { minCashDownForPrice, sortListingsByAffordability } from "@/lib/cashToOwn";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05
    }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 220,
      damping: 24
    }
  }
} as const;

const PICKS_PAGES = 4;
const MIN_DEAL_SCORE = 8;

export type BestPicksSortMode = "deal_score" | "affordability";

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

function sortPicks(listings: CarListing[], mode: BestPicksSortMode): CarListing[] {
  switch (mode) {
    case "affordability":
      return sortListingsByAffordability(listings, "registered_used");
    case "deal_score":
      return [...listings].sort((a, b) => Number(b.deal_score || 0) - Number(a.deal_score || 0));
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export default function BestPicks() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<CarListing[]>([]);
  const [drops, setDrops] = useState<PriceDropItem[]>([]);
  const [dropsLoaded, setDropsLoaded] = useState(false);
  const [sortMode, setSortMode] = useState<BestPicksSortMode>("deal_score");

  useEffect(() => {
    let cancelled = false;
    getPriceDrops(7, 8)
      .then((items) => { if (!cancelled) setDrops(items); })
      .catch(() => { /* feed is additive — page works without it */ })
      .finally(() => { if (!cancelled) setDropsLoaded(true); });
    return () => { cancelled = true; };
  }, []);

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

  const ranked = useMemo(() => sortPicks(picks, sortMode), [picks, sortMode]);
  const topScore = useMemo(() => ranked.reduce((mx, l) => Math.max(mx, Number(l.deal_score || 0)), 0), [ranked]);
  const [featured, ...rest] = ranked;
  const rankCaption =
    sortMode === "affordability"
      ? "ranked by min cash down (CBSL LTV)"
      : "ranked by deal strength";

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[110px] pointer-events-none" />

      <motion.section variants={itemVariants} className="border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-md relative z-10">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Best picks</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-tight leading-[1.05] text-white sm:text-[2.75rem] lg:text-[3rem]">Deal-score picks.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground font-medium">
            {loading ? "Scanning inventory..." : `${ranked.length} vehicles scored ${MIN_DEAL_SCORE}+ from ${PICKS_PAGES} pages, ${rankCaption}.`}
          </p>
          {!loading && !error && picks.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Sort best picks">
              <button
                type="button"
                onClick={() => setSortMode("deal_score")}
                className={`rounded-lg border px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-all ${
                  sortMode === "deal_score"
                    ? "border-primary/30 bg-primary/10 text-primary shadow-[0_2px_8px_rgba(124,58,237,0.12)]"
                    : "border-white/5 bg-white/[0.01] text-muted-foreground hover:bg-white/[0.03] hover:text-white"
                }`}
              >
                Deal score
              </button>
              <button
                type="button"
                onClick={() => setSortMode("affordability")}
                className={`rounded-lg border px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-all ${
                  sortMode === "affordability"
                    ? "border-primary/30 bg-primary/10 text-primary shadow-[0_2px_8px_rgba(124,58,237,0.12)]"
                    : "border-white/5 bg-white/[0.01] text-muted-foreground hover:bg-white/[0.03] hover:text-white"
                }`}
              >
                Affordability
              </button>
            </div>
          )}
        </div>
      </motion.section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 space-y-8 relative z-10">
        {/* Biggest cuts this week — powered by per-listing price history */}
        {dropsLoaded && (
          <motion.section variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 backdrop-blur-md">
            <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
                <TrendingDown className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-[14px] font-bold text-white">Biggest cuts this week</h2>
                <p className="text-[10px] text-muted-foreground font-semibold">Sellers who moved their asking price down — tracked scan-over-scan</p>
              </div>
            </div>
            {drops.length === 0 ? (
              <p className="pt-4 text-[12px] text-muted-foreground font-medium">
                No cuts recorded in the last 7 days yet — price tracking is scan-over-scan, so drops appear here as our daily scans catch sellers moving their asking prices.
              </p>
            ) : (
              <div className="grid gap-2.5 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                {drops.map((drop) => (
                  <Link
                    key={drop.listing.id}
                    to={`/listing/${drop.listing.id}`}
                    className="group rounded-lg border border-white/5 bg-white/[0.01] p-3.5 no-underline transition-all hover:border-emerald-400/20 hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {drop.listing.make} {drop.listing.model}{drop.listing.year ? ` ${drop.listing.year}` : ""}
                      </span>
                      <span className="shrink-0 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 num">
                        −{drop.drop_pct}%
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-[11px] font-semibold text-muted-foreground line-through num">{formatPrice(drop.previous_price_lkr)}</span>
                      <span className="text-[13px] font-bold text-white num">{formatPrice(drop.new_price_lkr)}</span>
                    </div>
                    <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                      {drop.listing.district || drop.listing.source}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </motion.section>
        )}

        {loading ? (
          <div className="space-y-3">
            <div className="h-56 rounded-xl border border-white/5 bg-white/[0.01] animate-pulse" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 rounded-xl border border-white/5 bg-white/[0.01] animate-pulse" />)}
            </div>
          </div>
        ) : error ? (
          <motion.div variants={itemVariants} className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-white/10 py-16 text-center">
            <SearchX className="h-5 w-5 text-muted-foreground" />
            <p className="text-[13px] text-muted-foreground font-medium">{error}</p>
            <Link to="/#market" className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2 text-[11px] font-bold text-white no-underline transition-all hover:bg-white/[0.04]">Open inventory</Link>
          </motion.div>
        ) : ranked.length === 0 ? (
          <motion.div variants={itemVariants} className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-white/10 py-16 text-center">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <p className="text-[13px] text-muted-foreground font-medium">No vehicles meet the deal-score gate right now.</p>
            <Link to="/#market" className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2 text-[11px] font-bold text-white no-underline transition-all hover:bg-white/[0.04]">Browse inventory</Link>
          </motion.div>
        ) : (
          <>
            {/* Featured */}
            {featured && (() => {
              const score = Number(featured.deal_score || 0);
              const pct = topScore > 0 ? Math.min(100, Math.round((score / topScore) * 100)) : 0;
              const cashDown = minCashDownForPrice(Number(featured.price_lkr || 0));
              return (
                <motion.article variants={itemVariants} className="grid overflow-hidden rounded-xl border border-white/5 bg-white/[0.01] backdrop-blur-md lg:grid-cols-[1.1fr_1fr] group transition-all duration-300 hover:border-primary/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] relative">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-30" />
                  <Link to={`/listing/${featured.id}`} className="block aspect-[16/10] overflow-hidden bg-black/30 no-underline lg:aspect-auto lg:min-h-[300px]">
                    <VehicleThumbnail src={pickVehicleImageUrl([featured.thumbnail_url, ...(Array.isArray(featured.images) ? featured.images : [])], [featured.url, featured.detail_url, featured.external_url])} listingId={featured.id} alt={`${featured.make} ${featured.model}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                  </Link>
                  <div className="flex flex-col justify-between gap-5 p-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground/80">{featured.source}</span>
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${dealBandChip(score)}`}>
                          <Star className="mr-1 inline h-3 w-3 text-emerald-400" />{dealBandLabel(score)}
                        </span>
                      </div>
                      <Link to={`/listing/${featured.id}`} className="block no-underline">
                        <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl group-hover:text-primary transition-colors">{featured.make} {featured.model}</h2>
                        <p className="mt-1 text-[12px] text-muted-foreground font-medium">{featured.year || "N/A"} · {featured.district || "LK"}</p>
                      </Link>
                      <div className="flex items-baseline justify-between border-t border-white/5 pt-3">
                        <p className="num text-2xl font-bold text-white">{formatPrice(Number(featured.price_lkr || 0))}</p>
                        {sortMode === "affordability" && cashDown != null ? (
                          <p className="num text-[12px] font-bold text-primary">{formatPrice(cashDown)} down</p>
                        ) : (
                          <p className="num text-[12px] font-bold text-emerald-400">+{score.toFixed(0)} deal</p>
                        )}
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-white/[0.04]">
                        <div className={`h-full rounded-full ${dealMeter(score)}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/listing/${featured.id}`} className="flex h-10 flex-1 items-center justify-center rounded-lg bg-primary text-[10px] font-bold uppercase tracking-[0.08em] text-white no-underline transition-all hover:bg-primary/95 shadow-[0_4px_12px_rgba(124,58,237,0.15)]">Open detail</Link>
                      {featured.external_url && (
                        <a href={featured.external_url} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center gap-1 rounded-lg border border-white/5 bg-white/[0.02] px-3 text-[10px] font-semibold text-muted-foreground no-underline hover:text-white transition-all hover:bg-white/[0.04]">
                          Source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </motion.article>
              );
            })()}

            {/* Grid */}
            {rest.length > 0 && (
              <div className="space-y-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
                    {sortMode === "affordability" ? "Lowest cash down" : "Ranked picks"}
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-bold num">{rest.length} more</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((listing, idx) => {
                    const score = Number(listing.deal_score || 0);
                    const pct = topScore > 0 ? Math.min(100, Math.round((score / topScore) * 100)) : 0;
                    const cashDown = minCashDownForPrice(Number(listing.price_lkr || 0));
                    return (
                      <motion.article key={listing.id} variants={itemVariants} className="group flex flex-col overflow-hidden rounded-xl border border-white/5 bg-white/[0.01] backdrop-blur-md transition-all duration-300 hover:border-primary/20 hover:bg-white/[0.03] hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] relative">
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-30" />
                        <Link to={`/listing/${listing.id}`} className="relative block aspect-[16/10] overflow-hidden bg-black/30 no-underline">
                          <VehicleThumbnail src={pickVehicleImageUrl([listing.thumbnail_url, ...(Array.isArray(listing.images) ? listing.images : [])], [listing.url, listing.detail_url, listing.external_url])} listingId={listing.id} alt={`${listing.make} ${listing.model}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                          <span className="absolute left-2 top-2 rounded-md border border-white/5 bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white num backdrop-blur-sm">{String(idx + 2).padStart(2, "0")}</span>
                        </Link>
                        <div className="flex flex-1 flex-col gap-3 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-muted-foreground/80">{listing.source}</span>
                            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${dealBandChip(score)}`}>{dealBandLabel(score)}</span>
                          </div>
                          <Link to={`/listing/${listing.id}`} className="block no-underline">
                            <h3 className="text-[14px] font-semibold text-white group-hover:text-primary transition-colors truncate">{listing.make} {listing.model}</h3>
                            <p className="mt-0.5 text-[10px] text-muted-foreground font-medium">{listing.year || "N/A"} · {listing.district || "LK"}</p>
                          </Link>
                          <div className="flex items-baseline justify-between">
                            <span className="num text-base font-bold text-white">{formatPrice(Number(listing.price_lkr || 0))}</span>
                            {sortMode === "affordability" && cashDown != null ? (
                              <span className="num text-[10px] font-bold text-primary">{formatPrice(cashDown)} down</span>
                            ) : (
                              <span className="num text-[10px] font-bold text-emerald-400">+{score.toFixed(0)}</span>
                            )}
                          </div>
                          <div className="mt-auto h-1 overflow-hidden rounded-full bg-white/[0.04]">
                            <div className={`h-full rounded-full ${dealMeter(score)}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
