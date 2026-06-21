import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { getDistrictPrices, formatPrice } from "@/services/api";
import { DistrictPrice } from "@/types/car";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformPageHero } from "@/components/PlatformPageHero";
import { PageCanvas } from "@/components/PageCanvas";
import { Activity, Database, MapPin, TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";

// Lazy load the map component for better performance
const MarketMap = lazy(() => import("@/components/MarketMap").then(m => ({ default: m.MarketMap })));

const MAP_MIN_HEIGHT = "min-h-[420px] h-[clamp(420px,58vh,640px)]";

export default function MapPage() {
  const [data, setData] = useState<DistrictPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDistrictPrices()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError("Unable to load district pricing right now."))
      .finally(() => setLoading(false));
  }, []);

  const geoSummary = useMemo(() => {
    const totalListings = data.reduce((sum, row) => sum + Number(row.listing_count || 0), 0);
    const leader = [...data].sort((a, b) => Number(b.listing_count || 0) - Number(a.listing_count || 0))[0];
    const premium = [...data].sort((a, b) => Number(b.avg_price || 0) - Number(a.avg_price || 0))[0];

    return [
      {
        label: "Supply center",
        value: leader?.district || "Loading",
        detail: leader ? `${leader.listing_count.toLocaleString()} listings` : "—",
        icon: Database,
      },
      {
        label: "Premium pressure",
        value: premium?.district || "Loading",
        detail: premium ? `Rs. ${(premium.avg_price / 1_000_000).toFixed(1)}M avg` : "—",
        icon: TrendingUp,
      },
      {
        label: "Mapped inventory",
        value: totalListings ? totalListings.toLocaleString() : "Syncing",
        detail: "Across districts",
        icon: Activity,
      },
    ];
  }, [data]);

  // Median average price across districts — used to flag districts above / below the national line.
  const medianPrice = useMemo(() => {
    const prices = data
      .map((row) => Number(row.avg_price || 0))
      .filter((value) => value > 0)
      .sort((a, b) => a - b);
    if (!prices.length) return 0;
    const mid = Math.floor(prices.length / 2);
    return prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];
  }, [data]);

  // Top districts by supply density for the console roster.
  const districtRoster = useMemo(
    () => [...data].sort((a, b) => Number(b.listing_count || 0) - Number(a.listing_count || 0)).slice(0, 9),
    [data],
  );

  return (
    <PageCanvas className="pb-16">
      <PlatformPageHero
        eyebrow="Geo intelligence"
        title="Regional price map."
        icon={MapPin}
        metrics={[
          { label: "Districts", value: data.length ? data.length.toLocaleString() : "25" },
          { label: "Map mode", value: "Heat" },
          { label: "Status", value: loading ? "Syncing" : error ? "Retry" : "Ready" },
        ]}
      />

      <main className="layout-shell pt-10 md:pt-12">
        {/* ---- Summary console ------------------------------------------------ */}
        <section aria-labelledby="geo-console-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="tech-label">Summary console</p>
              <h2 id="geo-console-heading" className="headline-display mt-1.5 text-xl sm:text-2xl">
                Regional supply &amp; price signals
              </h2>
            </div>
            <span className="status-chip hidden sm:inline-flex">
              <span className={`h-1.5 w-1.5 rounded-full ${error ? "bg-rose-400" : loading ? "bg-amber-400" : "bg-emerald-400"}`} />
              {loading ? "Syncing" : error ? "Degraded" : "Live"}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {geoSummary.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="data-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="field-label">{item.label}</p>
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background/40">
                      <Icon className="h-5 w-5 text-amber-400" />
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-bold text-foreground num">{item.value}</p>
                  <p className="mt-1 tech-label text-muted-foreground">{item.detail}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ---- Map workspace -------------------------------------------------- */}
        <section aria-labelledby="geo-map-heading" className="mt-10 md:mt-12">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="tech-label">District map</p>
              <h2 id="geo-map-heading" className="headline-display mt-1.5 text-xl sm:text-2xl">
                Average vehicle prices across Sri Lanka
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#3f4755" }} aria-hidden="true" />
                Lower avg
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#d89b35" }} aria-hidden="true" />
                Higher avg
              </span>
            </div>
          </div>

          <div className="premium-surface p-2 sm:p-3">
            {loading ? (
              <Skeleton className={`w-full rounded-[8px] ${MAP_MIN_HEIGHT}`} />
            ) : error ? (
              <div
                role="alert"
                className={`flex w-full flex-col items-center justify-center gap-4 rounded-[8px] border border-dashed border-border bg-background/40 px-6 text-center ${MAP_MIN_HEIGHT}`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10">
                  <AlertTriangle className="h-5 w-5 text-rose-400" />
                </span>
                <div className="space-y-1.5">
                  <p className="text-base font-semibold text-foreground">District map unavailable</p>
                  <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="action-soft h-10"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Retry load
                </button>
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className={`flex w-full flex-col items-center justify-center gap-4 rounded-[8px] border border-border bg-background/40 ${MAP_MIN_HEIGHT}`}>
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-500" />
                    <p className="tech-label">Rendering map layer</p>
                  </div>
                }
              >
                <div className={`overflow-hidden rounded-[8px] ${MAP_MIN_HEIGHT}`}>
                  <MarketMap isLoading={loading} data={data} />
                </div>
              </Suspense>
            )}
          </div>
        </section>

        {/* ---- District roster ----------------------------------------------- */}
        <section aria-labelledby="geo-roster-heading" className="mt-10 md:mt-12">
          <div className="mb-4 flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="tech-label">District roster</p>
              <h2 id="geo-roster-heading" className="headline-display mt-1.5 text-xl sm:text-2xl">
                Top districts by supply density
              </h2>
            </div>
            {medianPrice > 0 && (
              <p className="text-xs text-muted-foreground">
                National median avg{" "}
                <span className="text-foreground num">{formatPrice(medianPrice)}</span>
              </p>
            )}
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[140px] w-full rounded-[10px]" />
              ))}
            </div>
          ) : error ? (
            <div className="console-empty">
              <p className="text-sm text-muted-foreground">District breakdown will return once the geo dataset reloads.</p>
            </div>
          ) : districtRoster.length === 0 ? (
            <div className="console-empty">
              <p className="text-sm text-muted-foreground">No district pricing has been mapped yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {districtRoster.map((row) => {
                const avg = Number(row.avg_price || 0);
                const aboveMedian = medianPrice > 0 && avg > medianPrice;
                const deltaPct = medianPrice > 0 ? ((avg - medianPrice) / medianPrice) * 100 : 0;
                return (
                  <article key={row.district} className="data-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-foreground">{row.district}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground num">
                          {row.listing_count.toLocaleString()} listings
                        </p>
                      </div>
                      {medianPrice > 0 && (
                        <span
                          className={`inline-flex shrink-0 items-center rounded-md border px-2 py-1 tech-label ${
                            aboveMedian
                              ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
                              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                          }`}
                        >
                          {aboveMedian ? "+" : ""}
                          {deltaPct.toFixed(0)}% vs median
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="field-label">Avg price</p>
                        <p className="mt-1 text-lg font-bold text-foreground num">{formatPrice(avg)}</p>
                      </div>
                      {row.top_make && (
                        <div className="text-right">
                          <p className="field-label">Top make</p>
                          <p className="mt-1 truncate text-sm text-foreground">
                            {row.top_make}
                            {row.top_model ? ` ${row.top_model}` : ""}
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </PageCanvas>
  );
}
