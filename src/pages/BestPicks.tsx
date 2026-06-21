import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Gauge, ListFilter, SearchX, ShieldCheck, Star, TrendingUp } from "lucide-react";
import { getListings, formatPrice } from "@/services/api";
import type { CarListing, FilterState } from "@/types/car";
import { VehicleThumbnail } from "@/components/VehicleThumbnail";
import { pickVehicleImageUrl } from "@/lib/listingImage";
import { isReasonableListingPrice } from "@/lib/formatting";
import { PlatformPageHero } from "@/components/PlatformPageHero";
import { PageCanvas } from "@/components/PageCanvas";

const PICKS_PAGES = 4;
const MIN_DEAL_SCORE = 8;

function dealBand(score: number): "elite" | "strong" | "watch" {
  if (score >= 15) return "elite";
  if (score >= 10) return "strong";
  return "watch";
}

function dealBandLabel(score: number): string {
  const band = dealBand(score);
  if (band === "elite") return "Elite Pick";
  if (band === "strong") return "Strong Pick";
  return "Watch Pick";
}

// Visual treatment per band — semantic green carries "good deal" meaning.
function dealBandStyle(score: number): { chip: string; meter: string; dot: string } {
  const band = dealBand(score);
  if (band === "elite") {
    return {
      chip: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
      meter: "bg-emerald-400",
      dot: "bg-emerald-400",
    };
  }
  if (band === "strong") {
    return {
      chip: "border-emerald-400/20 bg-emerald-500/[0.07] text-emerald-300/90",
      meter: "bg-emerald-400/80",
      dot: "bg-emerald-400/80",
    };
  }
  return {
    chip: "border-amber-400/25 bg-amber-500/10 text-amber-200",
    meter: "bg-amber-400/80",
    dot: "bg-amber-400/80",
  };
}

const SCORE_GATE_RATIONALE = [
  {
    icon: Gauge,
    label: "Deal-score gate",
    title: `Score ${MIN_DEAL_SCORE}+ only`,
    detail: "Minimum deal score.",
  },
  {
    icon: ShieldCheck,
    label: "Price sanity",
    title: "Guarded LKR",
    detail: "Unrealistic prices filtered out.",
  },
  {
    icon: ListFilter,
    label: "Ranking",
    title: "Best deal first",
    detail: "Strongest deal at the top.",
  },
];

export default function BestPicks() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<CarListing[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const baseFilters: FilterState = { sort: "deal_score", page: 1 };
        const requests = Array.from({ length: PICKS_PAGES }, (_, idx) => getListings({ ...baseFilters, page: idx + 1 }));
        const responses = await Promise.all(requests);

        if (cancelled) return;

        const unique = new Map<number, CarListing>();
        responses
          .flatMap((res) => res.listings)
          .filter((item) => Number(item.deal_score || 0) >= MIN_DEAL_SCORE && isReasonableListingPrice(Number(item.price_lkr || 0)))
          .sort((a, b) => Number(b.deal_score || 0) - Number(a.deal_score || 0))
          .forEach((item) => {
            if (!unique.has(item.id)) {
              unique.set(item.id, item);
            }
          });

        setPicks(Array.from(unique.values()));
      } catch {
        if (!cancelled) {
          setError("Unable to load best picks right now. Please try again shortly.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Highest score in the current lane, used to normalise the score meters.
  const topScore = useMemo(() => {
    return picks.reduce((max, item) => Math.max(max, Number(item.deal_score || 0)), 0);
  }, [picks]);

  const eliteCount = useMemo(
    () => picks.filter((item) => dealBand(Number(item.deal_score || 0)) === "elite").length,
    [picks],
  );

  const [featured, ...rest] = picks;

  return (
    <PageCanvas>
      <PlatformPageHero
        eyebrow="Best picks"
        title="Deal-score picks."
        icon={Star}
        metrics={[
          { label: "Qualified picks", value: picks.length.toLocaleString() },
          { label: "Minimum score", value: `${MIN_DEAL_SCORE}+` },
          { label: "Pages scanned", value: PICKS_PAGES.toString() },
        ]}
        actions={
          <Link
            to="/#market"
            className="action-soft h-11 w-full no-underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to inventory
          </Link>
        }
      />

      <main className="layout-shell space-y-10 py-10 md:py-14">
        {/* ---- Rationale console: why these vehicles qualify ------------------ */}
        <section aria-labelledby="picks-rationale-heading" className="console-section p-5 md:p-6">
          <div className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="tech-label text-amber-300/80">How the lane is curated</p>
              <h2 id="picks-rationale-heading" className="headline-display mt-2 text-2xl sm:text-3xl">
                Strict gate, clean ranking.
              </h2>
            </div>
            {!loading && !error && picks.length > 0 && (
              <div className="flex shrink-0 items-center gap-2 self-start md:self-end">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/25 bg-emerald-500/[0.07] px-3 py-1.5 text-label font-mono font-bold uppercase text-emerald-300">
                  <span className="num">{eliteCount}</span> elite
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-label font-mono font-bold uppercase text-zinc-300">
                  <span className="num">{picks.length}</span> ranked
                </span>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {SCORE_GATE_RATIONALE.map((row) => (
              <div key={row.label} className="metric-tile flex items-start gap-3 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background">
                  <row.icon className="h-5 w-5 text-amber-300" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="field-label">{row.label}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{row.title}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Loading state ------------------------------------------------- */}
        {loading ? (
          <section aria-label="Loading best picks" className="space-y-6">
            <div className="data-card h-64 animate-pulse md:h-72" />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="data-card h-72 animate-pulse" />
              ))}
            </div>
          </section>
        ) : error ? (
          /* ---- Error state ------------------------------------------------- */
          <section aria-label="Best picks unavailable" className="page-panel p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10">
                  <SearchX className="h-5 w-5 text-amber-300" aria-hidden="true" />
                </div>
                <div>
                  <p className="field-label text-amber-200/80">Picks unavailable</p>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">{error}</p>
                </div>
              </div>
              <Link to="/#market" className="action-primary h-11 shrink-0 no-underline">
                Open inventory
              </Link>
            </div>
          </section>
        ) : picks.length === 0 ? (
          /* ---- Empty state ------------------------------------------------- */
          <section aria-label="No qualified picks" className="page-panel p-6 md:p-8">
            <div className="grid gap-8 md:grid-cols-[0.95fr_1.05fr] md:items-center">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background">
                  <TrendingUp className="h-6 w-6 text-amber-300" aria-hidden="true" />
                </div>
                <p className="field-label mt-6">No picks yet</p>
                <h2 className="headline-display mt-2 text-2xl sm:text-[28px]">No picks yet</h2>
                <Link to="/#market" className="action-primary mt-6 h-11 no-underline">
                  Open inventory cockpit
                </Link>
              </div>
              <div className="grid gap-3">
                {["Raise deal-score confidence", "Check price sanity", "Watch the next source sync"].map((item) => (
                  <div key={item} className="metric-tile flex items-center gap-3">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" aria-hidden="true" />
                    <span className="text-sm font-semibold text-zinc-200">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          /* ---- Success state: featured top pick + ranked grid -------------- */
          <>
            {featured && (
              <section aria-labelledby="top-pick-heading">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 id="top-pick-heading" className="tech-label text-amber-300/80">
                    Top pick · rank 01
                  </h2>
                  <span className="hidden text-xs text-zinc-600 sm:block">Strongest deal score in the lane</span>
                </div>
                {(() => {
                  const score = Number(featured.deal_score || 0);
                  const style = dealBandStyle(score);
                  const pct = topScore > 0 ? Math.min(100, Math.round((score / topScore) * 100)) : 0;
                  return (
                    <article className="asset-surface grid grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
                      <Link
                        to={`/listing/${featured.id}`}
                        className="block aspect-[16/10] overflow-hidden bg-background no-underline lg:aspect-auto lg:min-h-[320px]"
                        aria-label={`Open ${featured.make} ${featured.model} detail`}
                      >
                        <VehicleThumbnail
                          src={pickVehicleImageUrl(
                            [featured.thumbnail_url, ...(Array.isArray(featured.images) ? featured.images : [])],
                            [featured.url, featured.detail_url, featured.external_url],
                          )}
                          listingId={featured.id}
                          alt={`${featured.make} ${featured.model}`}
                          className="h-full w-full object-cover"
                        />
                      </Link>

                      <div className="flex flex-col justify-between gap-6 p-6 md:p-8">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="tech-label font-bold text-zinc-500">{featured.source}</p>
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 tech-label font-bold ${style.chip}`}
                            >
                              <Star className="h-3 w-3" aria-hidden="true" />
                              {dealBandLabel(score)}
                            </span>
                          </div>

                          <Link to={`/listing/${featured.id}`} className="block no-underline">
                            <h3 className="headline-display text-3xl sm:text-4xl">
                              {featured.make} {featured.model}
                            </h3>
                            <p className="mt-2 text-sm text-zinc-400">
                              {featured.year || "N/A"} · {featured.district || "Sri Lanka"}
                            </p>
                          </Link>

                          <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border pt-4">
                            <p className="num text-3xl font-bold text-white">{formatPrice(Number(featured.price_lkr || 0))}</p>
                            <p className="text-sm font-semibold text-emerald-300">
                              <span className="num">{score.toFixed(0)}</span> deal score
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center justify-between">
                              <span className="field-label">Deal strength</span>
                              <span className="num text-xs text-zinc-500">{pct}%</span>
                            </div>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                              <div className={`h-full rounded-full ${style.meter}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Link to={`/listing/${featured.id}`} className="action-primary h-11 flex-1 no-underline">
                            Open detail
                          </Link>
                          {featured.external_url && (
                            <a
                              href={featured.external_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="action-soft h-11 no-underline"
                            >
                              Source <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })()}
              </section>
            )}

            {rest.length > 0 && (
              <section aria-labelledby="ranked-picks-heading">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 id="ranked-picks-heading" className="tech-label text-zinc-400">
                    Ranked picks
                  </h2>
                  <span className="num text-xs text-zinc-600">{rest.length.toLocaleString()} more</span>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {rest.map((listing, idx) => {
                    const score = Number(listing.deal_score || 0);
                    const style = dealBandStyle(score);
                    const pct = topScore > 0 ? Math.min(100, Math.round((score / topScore) * 100)) : 0;
                    const rank = idx + 2; // featured is rank 1
                    return (
                      <article key={listing.id} className="asset-surface flex flex-col">
                        <Link
                          to={`/listing/${listing.id}`}
                          className="relative block aspect-[16/10] overflow-hidden bg-background no-underline"
                          aria-label={`Open ${listing.make} ${listing.model} detail`}
                        >
                          <VehicleThumbnail
                            src={pickVehicleImageUrl(
                              [listing.thumbnail_url, ...(Array.isArray(listing.images) ? listing.images : [])],
                              [listing.url, listing.detail_url, listing.external_url],
                            )}
                            listingId={listing.id}
                            alt={`${listing.make} ${listing.model}`}
                            className="h-full w-full object-cover"
                          />
                          <span className="num absolute left-3 top-3 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-label font-bold text-white">
                            {String(rank).padStart(2, "0")}
                          </span>
                        </Link>

                        <div className="flex flex-1 flex-col gap-4 p-5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="tech-label font-bold text-zinc-500">{listing.source}</p>
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 tech-label font-bold ${style.chip}`}
                            >
                              <Star className="h-3 w-3" aria-hidden="true" />
                              {dealBandLabel(score)}
                            </span>
                          </div>

                          <Link to={`/listing/${listing.id}`} className="block no-underline">
                            <h3 className="text-xl font-semibold tracking-tight text-white">
                              {listing.make} {listing.model}
                            </h3>
                            <p className="mt-1 text-sm text-zinc-400">
                              {listing.year || "N/A"} · {listing.district || "Sri Lanka"}
                            </p>
                          </Link>

                          <div className="flex items-baseline justify-between gap-3">
                            <p className="num text-2xl font-bold text-white">{formatPrice(Number(listing.price_lkr || 0))}</p>
                            <p className="text-sm font-semibold text-emerald-300">
                              <span className="num">{score.toFixed(0)}</span> score
                            </p>
                          </div>

                          <div className="mt-auto">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                              <div className={`h-full rounded-full ${style.meter}`} style={{ width: `${pct}%` }} />
                            </div>
                            <div className="mt-4 flex items-center gap-3">
                              <Link to={`/listing/${listing.id}`} className="action-soft h-10 flex-1 no-underline">
                                Open detail
                              </Link>
                              {listing.external_url && (
                                <a
                                  href={listing.external_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Open source listing for ${listing.make} ${listing.model}`}
                                  className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-3 text-xs font-bold uppercase tracking-[0.1em] text-zinc-400 transition-colors hover:text-zinc-200"
                                >
                                  Source <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </PageCanvas>
  );
}
