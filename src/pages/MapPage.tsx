import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { motion } from "framer-motion";
import { getDistrictPrices, formatPrice } from "@/services/api";
import { DistrictPrice } from "@/types/car";
import { AlertTriangle, RefreshCw } from "lucide-react";
import "leaflet/dist/leaflet.css";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
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
      variants={containerVariants}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[10%] right-[-10%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-15%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[90px] pointer-events-none" />

      {/* Header */}
      <motion.section variants={itemVariants} className="border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-md relative z-10">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-bright">Geo intelligence</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-tight leading-[1.05] text-white sm:text-[2.75rem] lg:text-[3rem]">District price map.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground font-medium">
            Compare listing density and average prices across {data.length || 25} Sri Lankan districts.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {[
              { label: "Districts", value: data.length || "—" },
              { label: "Total listed", value: totalListings ? totalListings.toLocaleString() : "—" },
              { label: "Status", value: loading ? "Syncing" : error ? "Error" : "Live" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 backdrop-blur-md">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80">{s.label}</span>
                <span className="text-[12px] font-bold text-white num">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 space-y-8 relative z-10">
        {/* Map */}
        <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-2 sm:p-3 backdrop-blur-md hover:border-primary/20 transition-all duration-300 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
          {loading ? (
            <div className="flex min-h-[450px] items-center justify-center rounded-lg bg-zinc-950/20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                <p className="text-[11px] text-muted-foreground font-semibold">Loading map data</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-[450px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-white/10 bg-zinc-950/20">
              <AlertTriangle className="h-5 w-5 text-rose-400/60" />
              <p className="text-[13px] text-muted-foreground font-medium">{error}</p>
              <button type="button" onClick={() => window.location.reload()} className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] font-bold text-white hover:bg-white/[0.04] transition-all">
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          ) : (
            <Suspense fallback={<div className="flex min-h-[450px] items-center justify-center rounded-lg bg-zinc-950/20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /></div>}>
              <div className="min-h-[450px] overflow-hidden rounded-lg h-[clamp(450px,58vh,640px)]">
                <MarketMap isLoading={loading} data={data} />
              </div>
            </Suspense>
          )}
        </motion.div>

        {/* Legend */}
        <motion.div variants={itemVariants} className="flex items-center gap-4 text-[11px] text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-zinc-700" /> Lower avg</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Higher avg</span>
          {medianPrice > 0 && <span className="ml-auto text-muted-foreground">National median: <span className="num font-bold text-white">{formatPrice(medianPrice)}</span></span>}
        </motion.div>

        {/* District roster */}
        <motion.div variants={itemVariants}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="font-display text-sm font-bold tracking-tight text-white">
              {showAllDistricts ? "All districts" : "Top districts by supply"}
            </h2>
            {data.length > 9 && (
              <button
                type="button"
                onClick={() => setShowAllDistricts((v) => !v)}
                aria-expanded={showAllDistricts}
                className="rounded-lg border border-white/5 bg-white/[0.01] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-white"
              >
                {showAllDistricts ? "Show top 9" : `Show all ${data.length}`}
              </button>
            )}
          </div>
          {roster.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {roster.map((row) => {
                const avg = Number(row.avg_price || 0);
                const above = medianPrice > 0 && avg > medianPrice;
                const delta = medianPrice > 0 ? ((avg - medianPrice) / medianPrice) * 100 : 0;
                return (
                  <div key={row.district} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.01] p-4 transition-all hover:border-primary/20 hover:bg-white/[0.02]">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-white">{row.district}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground num font-medium">{row.listing_count.toLocaleString()} listings · avg {formatPrice(avg)}</p>
                    </div>
                    {medianPrice > 0 && (
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold num ${above ? "border-rose-500/20 bg-rose-500/10 text-rose-400" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"}`}>
                        {above ? "+" : ""}{delta.toFixed(0)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : !loading && <p className="text-[11px] text-muted-foreground font-medium">No district data mapped yet.</p>}
        </motion.div>
      </div>
    </motion.div>
  );
}
