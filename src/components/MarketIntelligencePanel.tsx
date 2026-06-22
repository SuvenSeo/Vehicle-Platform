import { memo, useMemo } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Flame, Radio } from "lucide-react";
import { formatPrice } from "@/services/api";
import { useCountUp } from "@/hooks/useCountUp";
import type { DashboardInsights, LiveMarketSnapshot, StatsOverview } from "@/types/car";

interface MarketIntelligencePanelProps {
  snapshot: LiveMarketSnapshot | null;
  stats: StatsOverview | null;
  insights: DashboardInsights | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  ikman: "ikman",
  riyasewana: "Riyasewana",
  autolanka: "AutoLanka",
  autodirect: "AutoDirect",
  patpat: "Patpat",
  autostream: "AutoStream",
  carshop: "Carshop",
  saleme: "SaleMe",
  riyahub: "Riyahub",
  dimo: "Cars at DIMO",
};

function labelSource(raw: string): string {
  const compact = String(raw || "").toLowerCase().replace(/[-_.\s]/g, "");
  for (const key of Object.keys(SOURCE_LABELS)) {
    if (compact.startsWith(key)) return SOURCE_LABELS[key];
  }
  return raw || "Source";
}

function relativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

interface FeedRow {
  key: string;
  source: string;
  fresh: number;
  found: number;
  time: string;
}

// ── Metric cell ────────────────────────────────────────────────────────────

function MetricCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="bg-[hsl(220,8%,6.5%)] p-5 transition-colors duration-200 hover:bg-[hsl(220,8%,8%)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p
        className={`mt-2 flex items-center gap-1 font-display text-[1.5rem] font-bold leading-none tracking-tight num ${
          tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : "text-foreground"
        }`}
      >
        {tone === "up" && <ArrowUpRight className="h-4 w-4" />}
        {tone === "down" && <ArrowDownRight className="h-4 w-4" />}
        {value}
      </p>
    </div>
  );
}

export const MarketIntelligencePanel = memo(function MarketIntelligencePanel({
  snapshot,
  stats,
  insights,
}: MarketIntelligencePanelProps) {
  const totalIndexed = Number(snapshot?.total_listings ?? stats?.total_listings ?? 0);
  const sourceCount = Number(snapshot?.active_scrape_sources?.length || stats?.source_count || 0);
  const districtCount = Number(stats?.district_count || 0);
  const avgPrice = Number(snapshot?.avg_price_lkr ?? stats?.avg_price_lkr ?? 0);
  const momChange = Number(stats?.price_change_mom ?? 0);
  const new24h = Number(insights?.new_listings_24h ?? stats?.listings_this_week ?? 0);
  const goodDeals = Number(stats?.good_deals_count ?? 0);
  const freshness = relativeTime(snapshot?.latest_listing_at || stats?.last_updated);
  const isLive = freshness !== "—";

  // Animated counters
  const indexedCount = useCountUp(totalIndexed, 1400);
  const avgCount = useCountUp(avgPrice, 1400);
  const newCount = useCountUp(new24h, 1100);
  const dealsCount = useCountUp(goodDeals, 1100);

  const indexedDisplay = totalIndexed > 0 ? indexedCount.toLocaleString() : "120,000+";

  // Live incoming feed — prefer real scrape runs, fall back to scored deals.
  const feed = useMemo<FeedRow[]>(() => {
    const runs = (snapshot?.source_status || [])
      .filter((r) => r && (r.listings_found || r.listings_new || r.finished_at))
      .slice(0, 5)
      .map((r, i) => ({
        key: `${r.source}-${i}`,
        source: labelSource(r.source),
        fresh: Number(r.listings_new || 0),
        found: Number(r.listings_found || 0),
        time: relativeTime(r.finished_at || r.started_at),
      }));
    if (runs.length) return runs;

    return (insights?.hot_deals || []).slice(0, 5).map((d, i) => ({
      key: `deal-${d.id}-${i}`,
      source: `${d.make} ${d.model}`,
      fresh: Number(d.deal_score || 0),
      found: 0,
      time: d.district || "LK",
    }));
  }, [snapshot?.source_status, insights?.hot_deals]);

  const sources = useMemo(
    () =>
      (snapshot?.active_scrape_sources?.length
        ? snapshot.active_scrape_sources
        : (snapshot?.source_status || []).map((r) => r.source)
      )
        .map(labelSource)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, 10),
    [snapshot?.active_scrape_sources, snapshot?.source_status],
  );

  return (
    <div>
      {/* ── Bento grid ── */}
      <div
        className="grid grid-cols-2 overflow-hidden rounded-3xl lg:grid-cols-4"
        style={{ gap: "1px", background: "hsl(220 10% 100% / 0.07)", border: "1px solid hsl(220 10% 100% / 0.07)" }}
      >
        {/* Hero cell — moat number (spans 2 cols, 2 rows on lg) */}
        <div className="relative col-span-2 overflow-hidden bg-[hsl(220,8%,6.5%)] p-6 transition-colors duration-200 hover:bg-[hsl(220,8%,8%)] sm:p-8 lg:row-span-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 60% 55% at 18% 0%, hsl(var(--primary) / 0.10) 0%, transparent 68%)" }}
          />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">Vehicles indexed</p>
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                <span className="relative flex h-2 w-2">
                  {isLive && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--gold)] opacity-60" />}
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${isLive ? "bg-[var(--gold)]" : "bg-zinc-600"}`} />
                </span>
                Live {freshness}
              </span>
            </div>

            <p className="mt-4 font-display text-[3rem] font-bold leading-[0.92] tracking-[-0.04em] text-foreground num sm:text-[4rem] lg:text-[4.75rem]">
              {indexedDisplay}
            </p>

            <p className="mt-3 text-[13px] font-medium text-zinc-400">
              Across{" "}
              <span className="font-semibold text-zinc-200 num">{sourceCount > 0 ? sourceCount : 10}</span> live sources and{" "}
              <span className="font-semibold text-zinc-200 num">{districtCount > 0 ? districtCount : 25}</span> districts —
              indexed continuously, scored against market medians.
            </p>

            {/* Source badges */}
            {sources.length > 0 && (
              <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-5">
                {sources.map((s) => (
                  <span key={s} className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] font-semibold text-zinc-400">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Supporting metric cells */}
        <MetricCell label="Avg price" value={avgPrice > 0 ? formatPrice(avgCount) : "—"} />
        <MetricCell
          label="MoM change"
          value={`${momChange >= 0 ? "+" : ""}${momChange.toFixed(1)}%`}
          tone={momChange > 0 ? "up" : momChange < 0 ? "down" : undefined}
        />
        <MetricCell label="New · 24h" value={new24h > 0 ? newCount.toLocaleString() : "—"} />
        <MetricCell label="Good deals" value={goodDeals > 0 ? dealsCount.toLocaleString() : "—"} />
      </div>

      {/* ── Live incoming feed ── */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-[hsl(220,8%,5.5%)]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
            <Activity className="h-3.5 w-3.5 text-[var(--gold)]/70" />
            Live incoming feed
          </p>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
            <Radio className="h-3 w-3 text-[var(--gold)]/70" /> last sync
          </span>
        </div>
        <div className="divide-y divide-white/[0.03]">
          {feed.length ? (
            feed.map((row) => (
              <div key={row.key} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-white/[0.015]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Flame className="h-3.5 w-3.5 shrink-0 text-[var(--gold)]/50" />
                  <span className="truncate text-[13px] font-semibold text-zinc-200">{row.source}</span>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  {row.found > 0 ? (
                    <span className="text-[12px] font-bold text-emerald-400/90 num">+{row.fresh.toLocaleString()} new</span>
                  ) : (
                    <span className="text-[12px] font-bold text-[var(--gold)]/80 num">+{row.fresh.toFixed(0)} deal</span>
                  )}
                  <span className="w-8 text-right text-[11px] text-zinc-600 num">{row.time}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="px-5 py-8 text-center text-[12px] text-zinc-600">Awaiting live sync</p>
          )}
        </div>
      </div>
    </div>
  );
});

MarketIntelligencePanel.displayName = "MarketIntelligencePanel";
