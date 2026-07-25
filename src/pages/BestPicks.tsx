import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink, SearchX, Star, TrendingDown, TrendingUp } from "lucide-react";
import { getListings, getPriceDrops, formatPrice } from "@/services/api";
import type { CarListing, FilterState, PriceDropItem } from "@/types/car";
import { VehicleThumbnail } from "@/components/VehicleThumbnail";
import { SectionHeader } from "@/components/SectionHeader";
import { pickVehicleImageUrl } from "@/lib/listingImage";
import { isReasonableListingPrice } from "@/lib/formatting";
import { minCashDownForPrice, sortListingsByAffordability } from "@/lib/cashToOwn";
import { PageBody } from "@/components/PageBody";
import { PageCanvas } from "@/components/PageCanvas";
import { PageHero } from "@/components/PageHero";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { revealContainer, revealItem } from "@/lib/motion";
import { useAuth } from "@/lib/authContext";
import { useAppPreferences } from "@/lib/appPreferences";
import {
  FREE_BEST_PICKS_LIMIT,
  FREE_PRICE_DROPS_LIMIT,
  freePlanCopy,
  hasFullPlatformAccess,
} from "@/lib/planLimits";
import { visuals } from "@/lib/visualAssets";

const PICKS_PAGES = 4;
const MIN_DEAL_SCORE = 8;

export type BestPicksSortMode = "deal_score" | "affordability";

function dealBand(score: number): "elite" | "strong" | "watch" {
  if (score >= 15) return "elite";
  if (score >= 10) return "strong";
  return "watch";
}

function dealBandLabel(score: number, t: (key: string, fallback?: string) => string): string {
  const b = dealBand(score);
  return b === "elite" ? t("picks.bandElite", "Elite") : b === "strong" ? t("picks.bandStrong", "Strong") : t("picks.bandWatch", "Watch");
}

function dealBandChip(score: number): string {
  const b = dealBand(score);
  if (b === "elite") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (b === "strong") return "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-700 dark:text-emerald-300";
  return "border-primary/20 bg-primary/10 text-primary-bright";
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
  const { t } = useAppPreferences();
  const { hasProAccess, isAdmin } = useAuth();
  const fullAccess = hasFullPlatformAccess({ hasProAccess, isAdmin });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<CarListing[]>([]);
  const [drops, setDrops] = useState<PriceDropItem[]>([]);
  const [dropsLoaded, setDropsLoaded] = useState(false);
  const [sortMode, setSortMode] = useState<BestPicksSortMode>("deal_score");

  useEffect(() => {
    let cancelled = false;
    getPriceDrops(7, fullAccess ? 8 : FREE_PRICE_DROPS_LIMIT)
      .then((items) => { if (!cancelled) setDrops(items); })
      .catch(() => { /* feed is additive — page works without it */ })
      .finally(() => { if (!cancelled) setDropsLoaded(true); });
    return () => { cancelled = true; };
  }, [fullAccess]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const pagesToFetch = fullAccess ? PICKS_PAGES : 1;
        const base: FilterState = { sort: "deal_score", page: 1, vehicle_category: "cars" };
        const responses = await Promise.all(Array.from({ length: pagesToFetch }, (_, i) => getListings({ ...base, page: i + 1 })));
        if (cancelled) return;
        const unique = new Map<number, CarListing>();
        responses.flatMap((r) => r.listings)
          .filter((l) => Number(l.deal_score || 0) >= MIN_DEAL_SCORE && isReasonableListingPrice(Number(l.price_lkr || 0)))
          .sort((a, b) => Number(b.deal_score || 0) - Number(a.deal_score || 0))
          .forEach((l) => { if (!unique.has(l.id)) unique.set(l.id, l); });
        setPicks(Array.from(unique.values()));
      } catch { if (!cancelled) setError(t("picks.loadError", "Unable to load best picks.")); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [fullAccess, t]);

  const ranked = useMemo(() => {
    const sorted = sortPicks(picks, sortMode);
    return fullAccess ? sorted : sorted.slice(0, FREE_BEST_PICKS_LIMIT);
  }, [picks, sortMode, fullAccess]);
  const topScore = useMemo(() => ranked.reduce((mx, l) => Math.max(mx, Number(l.deal_score || 0)), 0), [ranked]);
  const [featured, ...rest] = ranked;
  const rankCaption =
    sortMode === "affordability"
      ? "ranked by min cash down (CBSL LTV)"
      : "ranked by deal strength";
  const hiddenPickCount = fullAccess ? 0 : Math.max(0, picks.length - FREE_BEST_PICKS_LIMIT);
  return (
    <PageCanvas>
      <PageHero
        theme="deals"
        eyebrow={t("picks.eyebrow", "Best picks")}
        eyebrowIcon={Star}
        watermarkIcon={Star}
        title={<>{t("picks.title", "Deal-score picks.")}</>}
        description={loading ? t("picks.scanning", "Scanning inventory...") : fullAccess
          ? `${ranked.length} vehicles scored ${MIN_DEAL_SCORE}+ from ${PICKS_PAGES} pages, ${rankCaption}.`
          : `${ranked.length} free teaser picks scored ${MIN_DEAL_SCORE}+ — upgrade for the full board.`}
        mediaSrc={visuals.altCategorySuvWhite}
        mediaPosition="center 40%"
        mediaTone="light"
        highlights={[
          { label: "Min score", value: `${MIN_DEAL_SCORE}+`, hint: "Strict deal-score floor" },
          { label: "Inventory", value: loading ? "…" : String(ranked.length), hint: fullAccess ? "Vehicles in this shortlist" : "Free teaser shortlist" },
          { label: "Sort modes", value: "2", hint: "Deal score or affordability" },
        ]}
      >
        {!loading && !error && picks.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2.5" role="group" aria-label={t("picks.sortAria", "Sort best picks")}>
              <button
                type="button"
                onClick={() => setSortMode("deal_score")}
                aria-pressed={sortMode === "deal_score"}
                className={`rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition-all active:scale-[0.97] ${
                  sortMode === "deal_score"
                    ? "border-primary/40 bg-primary/10 text-primary-bright shadow-soft"
                    : "border-border bg-card text-muted-foreground hover:bg-surface hover:text-foreground"
                }`}
              >
                {t("picks.sortDealScore", "Deal score")}
              </button>
              <button
                type="button"
                onClick={() => setSortMode("affordability")}
                aria-pressed={sortMode === "affordability"}
                className={`rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition-all active:scale-[0.97] ${
                  sortMode === "affordability"
                    ? "border-primary/40 bg-primary/10 text-primary-bright shadow-soft"
                    : "border-border bg-card text-muted-foreground hover:bg-surface hover:text-foreground"
                }`}
              >
                {t("picks.sortAffordability", "Affordability")}
              </button>
            </div>
          )}
      </PageHero>

      <PageBody className="space-y-14 lg:space-y-20">
        {/* Biggest cuts this week — powered by per-listing price history */}
        <motion.section initial="hidden" animate="show" variants={revealItem} className="rounded-2xl border border-border bg-card p-5 shadow-soft backdrop-blur-md sm:p-6">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
                <TrendingDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              </div>
              <div>
                <h2 className="text-[15px] font-bold tracking-tight text-foreground">{t("picks.cutsTitle", "Biggest cuts this week")}</h2>
                <p className="text-[11px] text-muted-foreground font-semibold">{t("picks.cutsSubtitle", "Sellers who moved their asking price down — tracked scan-over-scan")}</p>
              </div>
            </div>
            {!dropsLoaded ? (
              <div className="grid gap-2.5 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-lg border border-border bg-surface animate-pulse" />
                ))}
              </div>
            ) : drops.length === 0 ? (
              <p className="pt-4 text-[13px] text-muted-foreground font-medium">
                {t("picks.cutsEmpty", "No cuts recorded in the last 7 days yet — price tracking is scan-over-scan, so drops appear here as our daily scans catch sellers moving their asking prices.")}
              </p>
            ) : (
              <div className="grid grid-flow-col auto-cols-[78%] gap-2.5 pt-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid-flow-row sm:auto-cols-auto sm:overflow-visible sm:grid-cols-2 lg:grid-cols-4">
                {drops.map((drop) => (
                  <Link
                    key={drop.listing.id}
                    to={`/listing/${drop.listing.id}`}
                    className="group snap-start rounded-xl border border-border bg-surface p-3.5 no-underline transition-all hover:border-emerald-500/30 hover:bg-card hover:shadow-soft"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {drop.listing.make} {drop.listing.model}{drop.listing.year ? ` ${drop.listing.year}` : ""}
                      </span>
                      <span className="shrink-0 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 num">
                        −{drop.drop_pct}%
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-[11px] font-semibold text-muted-foreground line-through num">{formatPrice(drop.previous_price_lkr)}</span>
                      <span className="text-[13px] font-bold text-foreground num">{formatPrice(drop.new_price_lkr)}</span>
                    </div>
                    <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                      {drop.listing.district || drop.listing.source}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </motion.section>

        {loading ? (
          <div className="space-y-3">
            <div className="h-72 rounded-2xl border border-border bg-surface animate-pulse" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 rounded-2xl border border-border bg-surface animate-pulse" />)}
            </div>
          </div>
        ) : error ? (
          <motion.div variants={revealItem} className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
            <SearchX className="h-5 w-5 text-muted-foreground" aria-hidden />
            <p className="text-[13px] text-muted-foreground font-medium">{error}</p>
            <Link to="/#market" className="rounded-full border border-border bg-card px-4 py-2 text-[11px] font-bold text-foreground no-underline transition-all hover:bg-surface active:scale-[0.97]">{t("common.openInventory", "Open inventory")}</Link>
          </motion.div>
        ) : ranked.length === 0 ? (
          <motion.div variants={revealItem} className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
            <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden />
            <p className="text-[13px] text-muted-foreground font-medium">{t("picks.empty", "No vehicles meet the deal-score gate right now.")}</p>
            <Link to="/#market" className="rounded-full border border-border bg-card px-4 py-2 text-[11px] font-bold text-foreground no-underline transition-all hover:bg-surface active:scale-[0.97]">{t("common.browseInventory", "Browse inventory")}</Link>
          </motion.div>
        ) : (
          <>
            {/* Featured — the one hero pick, at 2× weight */}
            {featured && (() => {
              const score = Number(featured.deal_score || 0);
              const pct = topScore > 0 ? Math.min(100, Math.round((score / topScore) * 100)) : 0;
              const cashDown = minCashDownForPrice(Number(featured.price_lkr || 0));
              return (
                <motion.article variants={revealItem} className="group relative grid overflow-hidden rounded-2xl border border-border bg-card shadow-soft backdrop-blur-md transition-all duration-300 hover:border-primary/30 hover:shadow-soft-lg lg:grid-cols-[1.1fr_1fr]">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none" aria-hidden />
                  <Link to={`/listing/${featured.id}`} className="block aspect-[16/10] overflow-hidden bg-muted no-underline lg:aspect-auto lg:min-h-[320px]">
                    <VehicleThumbnail src={pickVehicleImageUrl([featured.thumbnail_url, ...(Array.isArray(featured.images) ? featured.images : [])], [featured.url, featured.detail_url, featured.external_url])} listingId={featured.id} alt={`${featured.make} ${featured.model}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                  </Link>
                  <div className="flex flex-col justify-between gap-6 p-6 sm:p-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{featured.source}</span>
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${dealBandChip(score)}`}>
                          <Star className="mr-1 inline h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden />{dealBandLabel(score, t)}
                        </span>
                      </div>
                      <Link to={`/listing/${featured.id}`} className="block no-underline">
                        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl group-hover:text-primary transition-colors">{featured.make} {featured.model}</h2>
                        <p className="mt-1.5 text-[12px] text-muted-foreground font-medium">{featured.year || t("common.na", "N/A")} · {featured.district || "LK"}</p>
                      </Link>
                      <div className="flex items-baseline justify-between border-t border-border pt-4">
                        <p className="num text-3xl font-bold tracking-tight text-foreground">{formatPrice(Number(featured.price_lkr || 0))}</p>
                        {sortMode === "affordability" && cashDown != null ? (
                          <p className="num text-[12px] font-bold text-primary-bright">{t("picks.down", "{price} down", { price: formatPrice(cashDown) })}</p>
                        ) : (
                          <p className="num text-[12px] font-bold text-emerald-600 dark:text-emerald-400">{t("picks.deal", "+{score} deal", { score: score.toFixed(0) })}</p>
                        )}
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-foreground/[0.08]">
                        <div className={`h-full rounded-full ${dealMeter(score)}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/listing/${featured.id}`} className="flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-[11px] font-bold uppercase tracking-[0.08em] text-primary-foreground no-underline shadow-soft transition-all hover:bg-primary/95 active:scale-[0.97]">{t("picks.openDetail", "Open detail")}</Link>
                      {featured.external_url && (
                        <a href={featured.external_url} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center gap-1 rounded-full border border-border bg-card px-4 text-[11px] font-semibold text-muted-foreground no-underline transition-all hover:text-foreground hover:bg-surface active:scale-[0.97]">
                          {t("common.source", "Source")} <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      )}
                    </div>
                  </div>
                </motion.article>
              );
            })()}

            {/* Ranked grid — calm, uniform tiles after the one hero */}
            {rest.length > 0 && (
              <div>
                <SectionHeader
                  eyebrow={t("picks.shortlist", "The shortlist")}
                  title={sortMode === "affordability" ? t("picks.lowestCashDown", "Lowest cash down") : t("picks.ranked", "Ranked picks")}
                  className="mb-8"
                  actions={<span className="text-[11px] font-bold text-muted-foreground num">{t("picks.more", "{n} more", { n: rest.length })}</span>}
                />
                <motion.div variants={revealContainer} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((listing, idx) => {
                    const score = Number(listing.deal_score || 0);
                    const pct = topScore > 0 ? Math.min(100, Math.round((score / topScore) * 100)) : 0;
                    const cashDown = minCashDownForPrice(Number(listing.price_lkr || 0));
                    return (
                      <motion.article key={listing.id} variants={revealItem} className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-soft-lg">
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none" aria-hidden />
                        <Link to={`/listing/${listing.id}`} className="relative block aspect-[16/10] overflow-hidden bg-muted no-underline">
                          <VehicleThumbnail src={pickVehicleImageUrl([listing.thumbnail_url, ...(Array.isArray(listing.images) ? listing.images : [])], [listing.url, listing.detail_url, listing.external_url])} listingId={listing.id} alt={`${listing.make} ${listing.model}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                          <span className="absolute left-2 top-2 rounded-md border border-white/20 bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white num backdrop-blur-sm">{String(idx + 2).padStart(2, "0")}</span>
                        </Link>
                        <div className="flex flex-1 flex-col gap-3 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{listing.source}</span>
                            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${dealBandChip(score)}`}>{dealBandLabel(score, t)}</span>
                          </div>
                          <Link to={`/listing/${listing.id}`} className="block no-underline">
                            <h3 className="font-display text-[15px] font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors truncate">{listing.make} {listing.model}</h3>
                            <p className="mt-0.5 text-[10px] text-muted-foreground font-medium">{listing.year || t("common.na", "N/A")} · {listing.district || "LK"}</p>
                          </Link>
                          <div className="flex items-baseline justify-between">
                            <span className="num text-base font-bold text-foreground">{formatPrice(Number(listing.price_lkr || 0))}</span>
                            {sortMode === "affordability" && cashDown != null ? (
                              <span className="num text-[10px] font-bold text-primary-bright">{t("picks.down", "{price} down", { price: formatPrice(cashDown) })}</span>
                            ) : (
                              <span className="num text-[10px] font-bold text-emerald-600 dark:text-emerald-400">+{score.toFixed(0)}</span>
                            )}
                          </div>
                          <div className="mt-auto h-1 overflow-hidden rounded-full bg-foreground/[0.08]">
                            <div className={`h-full rounded-full ${dealMeter(score)}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </motion.div>
              </div>
            )}
          </>
        )}

        {!fullAccess && !loading && !error && (hiddenPickCount > 0 || picks.length > 0) && (
          <UpgradePrompt
            title={t("plan.picksTitle", freePlanCopy.picksTitle)}
            body={t("plan.picksBody", freePlanCopy.picksBody)}
          />
        )}
      </PageBody>
    </PageCanvas>
  );
}
