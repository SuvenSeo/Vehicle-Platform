import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { motion } from "framer-motion";
import { getDistrictPrices, formatPrice } from "@/services/api";
import { DistrictPrice } from "@/types/car";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { SectionHeader } from "@/components/SectionHeader";
import { revealContainer, revealItem, springSoft } from "@/lib/motion";
import "leaflet/dist/leaflet.css";

const MarketMap = lazy(() => import("@/components/MarketMap").then(m => ({ default: m.MarketMap })));

export default function MapPage() {
  const [data, setData] = useState<DistrictPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Keyboard-accessible alternative to the Leaflet markers: the roster can
  // expand to every district the map shows (WCAG 2.1.1).
  const [showAllDistricts, setShowAllDistricts] = useState(false);

  useEffect(() => {
    getDistrictPrices()
      .then((d) => { setData(d); setError(null); })
      .catch(() => setError("Unable to load district pricing."))
      .finally(() => setLoading(false));
  }, []);

  const medianPrice = useMemo(() => {
    const prices = data.map((r) => Number(r.avg_price || 0)).filter((v) => v > 0).sort((a, b) => a - b);
    if (!prices.length) return 0;
    const mid = Math.floor(prices.length / 2);
    return prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];
  }, [data]);

  const roster = useMemo(
    () => [...data].sort((a, b) => Number(b.listing_count || 0) - Number(a.listing_count || 0)).slice(0, showAllDistricts ? data.length : 9),
    [data, showAllDistricts],
  );

  const totalListings = useMemo(() => data.reduce((s, r) => s + Number(r.listing_count || 0), 0), [data]);

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[10%] right-[-10%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-15%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[90px] pointer-events-none" />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <motion.section variants={revealItem} className="relative z-10 border-b border-border">
        <div className="mx-auto max-w-[1320px] px-5 pt-16 pb-12 sm:px-6 sm:pt-20 lg:pt-24 lg:pb-16">
          <p className="inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-primary-bright">
            <span aria-hidden className="h-1 w-1 rounded-full bg-primary" />
            Geo intelligence
          </p>
          <h1 className="display-hero mt-5 text-foreground">District price map.</h1>
          <p className="text-body-lg mt-5 max-w-xl">
            Compare listing density and average prices across {data.length || 25} Sri Lankan districts.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-2.5">
            {[
              { label: "Districts", value: data.length || "—" },
              { label: "Total listed", value: totalListings ? totalListings.toLocaleString() : "—" },
              { label: "Status", value: loading ? "Syncing" : error ? "Error" : "Live" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 shadow-soft">
                {s.label === "Status" && (
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${loading ? "bg-amber-500" : error ? "bg-rose-500" : "bg-emerald-500"}`} />
                )}
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{s.label}</span>
                <span className="text-[12px] font-bold text-foreground num">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── Full-bleed map with floating glass legend ────────────────── */}
      <motion.section variants={revealItem} className="relative z-10">
        <div className="mx-auto max-w-[1560px] px-3 py-10 sm:px-4 lg:py-14">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-soft-lg sm:p-3">
            {loading ? (
              <div className="flex min-h-[460px] items-center justify-center rounded-xl bg-surface">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                  <p className="text-[11px] text-muted-foreground font-semibold">Loading map data</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex min-h-[460px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-surface">
                <AlertTriangle className="h-5 w-5 text-rose-500/70 dark:text-rose-400/70" />
                <p className="text-[13px] text-muted-foreground font-medium">{error}</p>
                <button type="button" onClick={() => window.location.reload()} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-[11px] font-bold text-foreground shadow-soft transition-all hover:border-primary/30 active:scale-[0.97]">
                  <RefreshCw className="h-3 w-3" /> Retry
                </button>
              </div>
            ) : (
              <div className="relative">
                <Suspense fallback={<div className="flex min-h-[460px] items-center justify-center rounded-xl bg-surface"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /></div>}>
                  <div className="overflow-hidden rounded-xl">
                    <MarketMap isLoading={loading} data={data} />
                  </div>
                </Suspense>

                {/* Floating glass legend panel */}
                <div className="surface--glass pointer-events-none absolute bottom-4 left-4 z-[500] flex flex-col gap-2 rounded-xl px-4 py-3 text-[11px] font-medium">
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" /> Lower avg</span>
                    <span className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary" /> Higher avg</span>
                  </div>
                  {medianPrice > 0 && <span className="text-muted-foreground">National median: <span className="num font-bold text-foreground">{formatPrice(medianPrice)}</span></span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* ── District roster ──────────────────────────────────────────── */}
      <motion.section variants={revealItem} className="relative z-10">
        <div className="mx-auto max-w-[1320px] px-5 pb-20 sm:px-6 lg:pb-28">
          <SectionHeader
            title={showAllDistricts ? "All districts" : "Top districts by supply"}
            className="mb-8"
            actions={
              data.length > 9 ? (
                <button
                  type="button"
                  onClick={() => setShowAllDistricts((v) => !v)}
                  aria-expanded={showAllDistricts}
                  className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground shadow-soft transition-colors hover:border-primary/30 hover:text-foreground active:scale-[0.97]"
                >
                  {showAllDistricts ? "Show top 9" : `Show all ${data.length}`}
                </button>
              ) : undefined
            }
          />

          {roster.length ? (
            <motion.div
              variants={revealContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-8%" }}
              className="space-y-3"
            >
              {/* Feature: the highest-supply district, sized up as the visual anchor */}
              {(() => {
                const row = roster[0];
                const avg = Number(row.avg_price || 0);
                const above = medianPrice > 0 && avg > medianPrice;
                const delta = medianPrice > 0 ? ((avg - medianPrice) / medianPrice) * 100 : 0;
                return (
                  <motion.div
                    variants={revealItem}
                    whileHover={{ y: -2 }}
                    transition={springSoft}
                    className="flex flex-col justify-between gap-6 rounded-2xl border border-border bg-card p-6 shadow-soft transition-colors hover:border-primary/30 sm:flex-row sm:items-center sm:p-8"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{row.district}</p>
                      <p className="mt-2 text-[13px] text-muted-foreground num font-medium">{row.listing_count.toLocaleString()} listings · avg {formatPrice(avg)}</p>
                    </div>
                    {medianPrice > 0 && (
                      <span className={`shrink-0 self-start rounded-full border px-3 py-1 text-[12px] font-bold num ${above ? "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                        {above ? "+" : ""}{delta.toFixed(0)}%
                      </span>
                    )}
                  </motion.div>
                );
              })()}

              {/* The remaining districts settle into a calm, lighter grid */}
              {roster.length > 1 && (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {roster.slice(1).map((row) => {
                    const avg = Number(row.avg_price || 0);
                    const above = medianPrice > 0 && avg > medianPrice;
                    const delta = medianPrice > 0 ? ((avg - medianPrice) / medianPrice) * 100 : 0;
                    return (
                      <motion.div
                        key={row.district}
                        variants={revealItem}
                        whileHover={{ y: -2 }}
                        transition={springSoft}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/30"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-bold text-foreground">{row.district}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground num font-medium">{row.listing_count.toLocaleString()} listings · avg {formatPrice(avg)}</p>
                        </div>
                        {medianPrice > 0 && (
                          <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold num ${above ? "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                            {above ? "+" : ""}{delta.toFixed(0)}%
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : !loading && <p className="text-[11px] text-muted-foreground font-medium">No district data mapped yet.</p>}
        </div>
      </motion.section>
    </motion.div>
  );
}
