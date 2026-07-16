import { memo } from "react";
import { StatsOverview } from "@/types/car";
import { formatPrice } from "@/services/api";
import { useEffect, useState, useRef } from "react";
import { DataFreshnessIndicator } from "@/components/DataFreshnessIndicator";

interface StatsBarProps {
  stats: StatsOverview;
  latestListingAt?: string | null;
}

function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);
  const prevTarget = useRef(0);
  const currentValue = useRef(0);

  useEffect(() => {
    if (!target || target === prevTarget.current) return;
    prevTarget.current = target;
    const start = Date.now();
    const from = currentValue.current;

    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (target - from) * eased);
      currentValue.current = next;
      setValue(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

export const StatsBar = memo(function StatsBar({ stats, latestListingAt }: StatsBarProps) {
  const totalCount = useCountUp(stats.total_listings);
  const avgPrice = useCountUp(stats.avg_price_lkr);
  const dealsCount = useCountUp(stats.good_deals_count);
  const momChange = stats.price_change_mom;
  const sourceLabel = stats.source_count > 0 ? `${stats.source_count} sources` : "source scan pending";

  return (
    <div className="mb-0">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Hero: Average Price */}
        <div className="cinematic-panel motion-card rounded-xl p-8 lg:col-span-2 group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="relative z-10 flex flex-col justify-between h-full space-y-8">
            <p className="tech-label tracking-[0.18em]">Average Index Price</p>
            <div>
              <p className="text-5xl font-semibold leading-none text-white num lg:text-7xl">
                {formatPrice(avgPrice)}
              </p>
              <div className={`mt-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 tech-label num ${
                momChange == null
                  ? "bg-muted/30 text-muted-foreground border border-border"
                  : momChange < 0
                    ? "bg-primary/10 text-primary-bright border border-primary/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}>
                {momChange == null ? (
                  "Building history"
                ) : (
                  <>
                    <span>{momChange < 0 ? "▼" : "▲"}</span>
                    {Math.abs(momChange)}% Movement vs month-0
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Listings Count */}
        <div className="cinematic-panel motion-card rounded-xl p-8 flex flex-col justify-between group">
          <p className="tech-label tracking-[0.18em]">Total Depth</p>
          <div>
            <p className="text-4xl font-semibold leading-none text-white num lg:text-5xl">
              {totalCount.toLocaleString()}
            </p>
            <p className="mt-4 flex items-center gap-2 tech-label text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Priced listings
            </p>
          </div>
        </div>

        {/* Good Deals */}
        <div className="cinematic-panel motion-card rounded-xl p-8 flex flex-col justify-between group">
          <p className="tech-label tracking-[0.18em]">Opportunities</p>
          <div>
            <p className="text-4xl font-semibold leading-none text-primary num lg:text-5xl">
              {dealsCount}+
            </p>
            <p className="mt-4 tech-label text-muted-foreground">Arbitrage Deals</p>
          </div>
        </div>

      </div>

      {/* Subline Data */}
      <div className="mt-8 flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2 opacity-80">
          <p className="tech-label text-muted-foreground">Multi-platform Aggregate · {sourceLabel}</p>
          <DataFreshnessIndicator
            latestListingAt={latestListingAt}
            lastUpdated={stats.last_updated}
            variant="subline"
          />
        </div>
        <p className="tech-label text-muted-foreground opacity-80">Build v1.4.2</p>
      </div>
    </div>
  );
});

StatsBar.displayName = "StatsBar";
