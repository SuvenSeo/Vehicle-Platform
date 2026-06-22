import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { getDistrictPrices, formatPrice } from "@/services/api";
import { DistrictPrice } from "@/types/car";
import { AlertTriangle, RefreshCw } from "lucide-react";

const MarketMap = lazy(() => import("@/components/MarketMap").then(m => ({ default: m.MarketMap })));

export default function MapPage() {
  const [data, setData] = useState<DistrictPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    () => [...data].sort((a, b) => Number(b.listing_count || 0) - Number(a.listing_count || 0)).slice(0, 9),
    [data],
  );

  const totalListings = useMemo(() => data.reduce((s, r) => s + Number(r.listing_count || 0), 0), [data]);

  return (
    <div className="min-h-screen">
      <section className="border-b border-white/[0.04]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/70">Geo intelligence</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-[-0.035em] leading-[1.02] text-foreground sm:text-[2.75rem] lg:text-[3rem]">District price map.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-zinc-400">
            Compare listing density and average prices across {data.length || 25} Sri Lankan districts.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {[
              { label: "Districts", value: data.length || "—" },
              { label: "Total listed", value: totalListings ? totalListings.toLocaleString() : "—" },
              { label: "Status", value: loading ? "Syncing" : error ? "Error" : "Live" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2 rounded-md border border-white/[0.04] bg-white/[0.015] px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{s.label}</span>
                <span className="text-[12px] font-bold text-zinc-300 num">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 space-y-8">
        {/* Map */}
        <div className="rounded-xl border border-white/[0.05] bg-[hsl(220,8%,6%)] p-2 sm:p-3">
          {loading ? (
            <div className="flex min-h-[450px] items-center justify-center rounded-lg bg-[hsl(220,8%,5%)]">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-500" />
                <p className="text-[11px] text-zinc-500">Loading map data</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-[450px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-white/[0.04] bg-[hsl(220,8%,5%)]">
              <AlertTriangle className="h-5 w-5 text-rose-400/60" />
              <p className="text-[13px] text-zinc-400">{error}</p>
              <button type="button" onClick={() => window.location.reload()} className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-2 text-[11px] font-semibold text-zinc-300 hover:bg-white/[0.03]">
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          ) : (
            <Suspense fallback={<div className="flex min-h-[450px] items-center justify-center rounded-lg bg-[hsl(220,8%,5%)]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-500" /></div>}>
              <div className="min-h-[450px] overflow-hidden rounded-lg h-[clamp(450px,58vh,640px)]">
                <MarketMap isLoading={loading} data={data} />
              </div>
            </Suspense>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#3f4755" }} /> Lower avg</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#d89b35" }} /> Higher avg</span>
          {medianPrice > 0 && <span className="ml-auto">National median: <span className="num font-semibold text-zinc-300">{formatPrice(medianPrice)}</span></span>}
        </div>

        {/* District roster */}
        <div>
          <h2 className="mb-5 font-display text-sm font-semibold tracking-tight text-foreground">Top districts by supply</h2>
          {roster.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {roster.map((row) => {
                const avg = Number(row.avg_price || 0);
                const above = medianPrice > 0 && avg > medianPrice;
                const delta = medianPrice > 0 ? ((avg - medianPrice) / medianPrice) * 100 : 0;
                return (
                  <div key={row.district} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.04] bg-[hsl(220,8%,5.5%)] p-4 transition-colors hover:border-white/[0.07]">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-foreground">{row.district}</p>
                      <p className="mt-0.5 text-[10px] text-zinc-500 num">{row.listing_count.toLocaleString()} listings · avg {formatPrice(avg)}</p>
                    </div>
                    {medianPrice > 0 && (
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold num ${above ? "border-rose-500/15 text-rose-400" : "border-emerald-500/15 text-emerald-400"}`}>
                        {above ? "+" : ""}{delta.toFixed(0)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : !loading && <p className="text-[11px] text-zinc-600">No district data mapped yet.</p>}
        </div>
      </div>
    </div>
  );
}
