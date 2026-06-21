import { memo } from "react";
import { StatsOverview } from "@/types/car";
import { formatPrice } from "@/services/api";
import { useEffect, useState, useRef } from "react";
import { formatRelativeTime } from "@/lib/formatting";

interface StatsBarProps {
  stats: StatsOverview;
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

export const StatsBar = memo(function StatsBar({ stats }: StatsBarProps) {
  const totalCount = useCountUp(stats.total_listings);
  const avgPrice = useCountUp(stats.avg_price_lkr);
  const dealsCount = useCountUp(stats.good_deals_count);
  const momChange = stats.price_change_mom ?? 0;
  const freshnessLabel = stats.last_updated ? formatRelativeTime(stats.last_updated) : "awaiting sync";
  const sourceLabel = stats.source_count > 0 ? `${stats.source_count} sources` : "source scan pending";

  return (
    <div className="mb-0">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Hero: Average Price */}
        <div className="cinematic-panel motion-card rounded-xl p-8 lg:col-span-2 group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
          <div className="relative z-10 flex flex-col justify-between h-full space-y-8">
            <p className="tech-label tracking-[0.18em]">Average Index Price</p>
            <div>
              <p className="text-5xl font-semibold leading-none text-white num lg:text-7xl">
                {formatPrice(avgPrice)}
              </p>
              <div className={`mt-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 tech-label num ${
                momChange < 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                <span>{momChange < 0 ? '▼' : '▲'}</span>
                {Math.abs(momChange)}% Movement vs month-0
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
            <p className="mt-4 flex items-center gap-2 tech-label text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Priced listings
            </p>
          </div>
        </div>

        {/* Good Deals */}
        <div className="cinematic-panel motion-card rounded-xl p-8 flex flex-col justify-between group">
          <p className="tech-label tracking-[0.18em]">Opportunities</p>
          <div>
            <p className="text-4xl font-semibold leading-none text-amber-400 num lg:text-5xl">
              {dealsCount}+
            </p>
            <p className="mt-4 tech-label text-zinc-400">Arbitrage Deals</p>
          </div>
        </div>

      </div>

      {/* Subline Data */}
      <div className="flex items-center justify-between mt-8 px-4 opacity-50">
        <p className="tech-label text-zinc-500">
            Multi-platform Aggregate · {sourceLabel} · Updated {freshnessLabel}
        </p>
        <p className="tech-label text-zinc-600">
            Build v1.4.2
        </p>
      </div>
    </div>
  );
});

StatsBar.displayName = "StatsBar";
