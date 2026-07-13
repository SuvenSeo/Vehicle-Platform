import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Bell, ChevronDown, ChevronUp, RefreshCw, ShieldCheck } from "lucide-react";
import {
  formatPrice,
  getDashboardInsights,
  getDistrictPrices,
  getProMarketSnapshot,
  getStats,
} from "@/services/api";
import { getStoredAuthToken } from "@/lib/authToken";
import type { ProMarketSnapshot } from "@/types/pro";
import {
  buildDealerNotifications,
  buildDistrictDemandRows,
  buildDistrictPriceGaps,
  buildTurnoverSeries,
} from "@/lib/dealerDashboardData";

type WidgetKey = "turnover" | "priceGap" | "districtDemand";

const TOOLTIP_STYLE = { background: "hsl(220,8%,6%)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "11px" } as const;

function WidgetShell({
  title,
  subtitle,
  collapsed,
  onToggle,
  loading,
  error,
  onRetry,
  emptyMessage,
  children,
}: {
  title: string;
  subtitle: string;
  collapsed: boolean;
  onToggle: () => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Dealer Intelligence</p>
          <h3 className="mt-1 text-[14px] font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <button type="button" onClick={onToggle} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground" aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`} aria-expanded={!collapsed}>
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>
      {!collapsed && (
        <div className="mt-4 border-t border-border pt-4">
          {loading ? (
            <div className="flex min-h-[180px] items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-amber-500" />
            </div>
          ) : error ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-center">
              <AlertTriangle className="h-4 w-4 text-rose-400/70" />
              <p className="text-[11px] text-muted-foreground">{error}</p>
              {onRetry ? (
                <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[10px] font-semibold text-foreground hover:bg-foreground/[0.03]">
                  <RefreshCw className="h-3 w-3" /> Retry
                </button>
              ) : null}
            </div>
          ) : emptyMessage ? (
            <p className="py-8 text-center text-[11px] text-muted-foreground">{emptyMessage}</p>
          ) : (
            children
          )}
        </div>
      )}
    </section>
  );
}

export default function DealerDashboard() {
  const [collapsed, setCollapsed] = useState<Record<WidgetKey, boolean>>({ turnover: false, priceGap: false, districtDemand: false });
  const [notifIdx, setNotifIdx] = useState(0);
  const hasAuthToken = Boolean(getStoredAuthToken());

  const statsQuery = useQuery({ queryKey: ["dealer-stats"], queryFn: getStats, retry: 1 });
  const insightsQuery = useQuery({ queryKey: ["dealer-insights"], queryFn: getDashboardInsights, retry: 1 });
  const districtsQuery = useQuery({ queryKey: ["dealer-district-prices"], queryFn: getDistrictPrices, retry: 1 });
  const proSnapshotQuery = useQuery({
    queryKey: ["dealer-pro-snapshot"],
    queryFn: getProMarketSnapshot,
    retry: false,
    enabled: hasAuthToken,
  });

  const stats = statsQuery.data ?? null;
  const insights = insightsQuery.data ?? null;
  const districts = useMemo(() => districtsQuery.data ?? [], [districtsQuery.data]);
  const proSnapshot: ProMarketSnapshot | null = proSnapshotQuery.isSuccess ? proSnapshotQuery.data : null;

  const turnoverData = useMemo(() => buildTurnoverSeries(insights), [insights]);
  const priceGaps = useMemo(() => buildDistrictPriceGaps(districts), [districts]);
  const districtDemand = useMemo(() => buildDistrictDemandRows(districts), [districts]);
  const notifications = useMemo(() => buildDealerNotifications(insights, stats), [insights, stats]);

  const metrics = useMemo(() => {
    const liveLeads = insights?.new_listings_24h ?? stats?.listings_this_week ?? proSnapshot?.new_listings_7d ?? null;
    const arbitrageAlerts = proSnapshot?.hot_deal_count ?? stats?.good_deals_count ?? insights?.hot_deals?.length ?? null;
    const financeReady = insights?.hot_deals?.filter((deal) => deal.deal_score >= 8).length ?? null;
    const topGapDistrict = priceGaps.length
      ? priceGaps.reduce((best, row) => (row.gapPct > best.gapPct ? row : best), priceGaps[0]).district
      : null;

    return [
      {
        label: "Live leads",
        value: liveLeads != null ? liveLeads.toLocaleString() : "—",
        delta: stats?.listings_this_week ? `${stats.listings_this_week.toLocaleString()} this week` : "Syncing market feed",
        tone: liveLeads != null ? "text-emerald-400" : "text-muted-foreground",
      },
      {
        label: "Arbitrage alerts",
        value: arbitrageAlerts != null ? arbitrageAlerts.toLocaleString() : "—",
        delta: topGapDistrict ? `Highest gap in ${topGapDistrict}` : "Scanning district spreads",
        tone: "text-muted-foreground",
      },
      {
        label: "Finance ready",
        value: financeReady != null ? financeReady.toLocaleString() : "—",
        delta: financeReady != null ? "High deal-score listings" : "Awaiting deal signals",
        tone: "text-muted-foreground",
      },
    ];
  }, [insights, stats, proSnapshot, priceGaps]);

  const trustScore = useMemo(() => {
    if (!stats?.total_listings) return null;
    const ratio = stats.good_deals_count / Math.max(stats.total_listings, 1);
    return Math.min(100, Math.round(68 + ratio * 320));
  }, [stats]);

  const dashboardLoading = statsQuery.isPending || insightsQuery.isPending || districtsQuery.isPending;
  const dashboardError =
    statsQuery.isError && insightsQuery.isError && districtsQuery.isError
      ? "Unable to load dealer intelligence."
      : null;

  useEffect(() => {
    if (notifications.length <= 1) return undefined;
    const t = window.setInterval(() => setNotifIdx((i) => (i + 1) % notifications.length), 5500);
    return () => window.clearInterval(t);
  }, [notifications.length]);

  useEffect(() => {
    setNotifIdx(0);
  }, [notifications]);

  const activeNotif = notifications[notifIdx] ?? notifications[0] ?? FALLBACK_NOTIFICATIONS[0];
  const toggle = (k: WidgetKey) => setCollapsed((p) => ({ ...p, [k]: !p[k] }));

  const retryAll = () => {
    void statsQuery.refetch();
    void insightsQuery.refetch();
    void districtsQuery.refetch();
    if (hasAuthToken) void proSnapshotQuery.refetch();
  };

  return (
    <div className="min-h-screen">
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/70">Dealer workspace</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-[-0.035em] leading-[1.02] text-foreground sm:text-[2.75rem] lg:text-[3rem]">Dealer command center.</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">Arbitrage, demand mapping, and lead flow intelligence.</p>
          <Link to="/#market" className="mt-4 inline-flex h-9 items-center rounded-lg border border-border px-4 text-[10px] font-semibold text-muted-foreground no-underline hover:text-foreground">Open public inventory</Link>
        </div>
      </section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10">
        {dashboardError ? (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400/80" />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-foreground">Dealer data unavailable</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{dashboardError}</p>
              <button type="button" onClick={retryAll} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[10px] font-semibold text-foreground hover:bg-foreground/[0.03]">
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[268px_1fr]">
          <aside className="space-y-4 lg:sticky lg:top-20">
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/70">AutoLens LK</p>
              <h2 className="mt-2 font-display text-lg font-semibold tracking-tight text-foreground">Command stack</h2>
              <nav className="mt-4 space-y-1" aria-label="Dealer command stack">
                {[
                  { label: "Inventory Turnover", meta: turnoverData.length ? `${turnoverData.length} models` : "—" },
                  { label: "Price Gap Scanner", meta: priceGaps.length ? `${priceGaps.length} districts` : "—" },
                  { label: "District Demand", meta: districtDemand.length ? `${districtDemand.length} zones` : "—" },
                  { label: "Lead Notifications", meta: notifications.length > 1 ? "live" : "standby" },
                ].map((i) => (
                  <div key={i.label} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                    <span className="text-[11px] text-foreground">{i.label}</span>
                    <span className="text-[9px] font-semibold text-muted-foreground num">{i.meta}</span>
                  </div>
                ))}
              </nav>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary/60" /><p className="text-[10px] font-semibold text-primary/80">Trust tier</p></div>
              {dashboardLoading ? (
                <div className="mt-3 h-8 animate-pulse rounded-md bg-secondary/40" />
              ) : (
                <>
                  <p className="mt-2 flex items-baseline gap-1">
                    <span className="num text-2xl font-bold text-foreground">{trustScore ?? "—"}</span>
                    {trustScore != null ? <span className="text-[11px] text-muted-foreground">/100</span> : null}
                  </p>
                  {trustScore != null ? (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary/50"><div className="h-full rounded-full bg-primary/60" style={{ width: `${trustScore}%` }} /></div>
                  ) : (
                    <p className="mt-2 text-[10px] text-muted-foreground">Trust score needs listing volume data.</p>
                  )}
                </>
              )}
            </div>
          </aside>

          <main className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-3">
              {metrics.map((m) => (
                <div key={m.label} className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{m.label}</p>
                  {dashboardLoading ? (
                    <div className="mt-2 h-8 w-16 animate-pulse rounded-md bg-secondary/40" />
                  ) : (
                    <p className="num mt-2 text-2xl font-bold text-foreground">{m.value}</p>
                  )}
                  <p className={`mt-0.5 text-[10px] ${m.tone}`}>{m.delta}</p>
                </div>
              ))}
            </div>

            <div key={activeNotif} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-primary/70"><Bell className="h-3.5 w-3.5" /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-primary/80">Lead notification</p>
                <p className="mt-1 text-[12px] text-foreground">{activeNotif}</p>
              </div>
            </div>

            <WidgetShell
              title="Inventory Turnover"
              subtitle={turnoverData.length ? "Trending model momentum and listing volume" : "Trending model momentum from market insights"}
              collapsed={collapsed.turnover}
              onToggle={() => toggle("turnover")}
              loading={insightsQuery.isPending}
              error={insightsQuery.isError ? "Unable to load turnover insights." : null}
              onRetry={() => void insightsQuery.refetch()}
              emptyMessage={!insightsQuery.isPending && !turnoverData.length ? "No trending model data yet." : undefined}
            >
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={turnoverData}>
                    <defs><linearGradient id="turnoverArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--gold)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--gold)" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="sellThrough" name="Momentum index" stroke="var(--gold)" fill="url(#turnoverArea)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </WidgetShell>

            <WidgetShell
              title="Price Gaps"
              subtitle="District spread vs national median"
              collapsed={collapsed.priceGap}
              onToggle={() => toggle("priceGap")}
              loading={districtsQuery.isPending}
              error={districtsQuery.isError ? "Unable to load district pricing." : null}
              onRetry={() => void districtsQuery.refetch()}
              emptyMessage={!districtsQuery.isPending && !priceGaps.length ? "No district price gaps mapped yet." : undefined}
            >
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priceGaps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="district" tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(1)}%`, "Gap"]} />
                    <Bar dataKey="gapPct" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </WidgetShell>

            <WidgetShell
              title="District Demand"
              subtitle="Supply concentration and average deal floor"
              collapsed={collapsed.districtDemand}
              onToggle={() => toggle("districtDemand")}
              loading={districtsQuery.isPending}
              error={districtsQuery.isError ? "Unable to load district demand." : null}
              onRetry={() => void districtsQuery.refetch()}
              emptyMessage={!districtsQuery.isPending && !districtDemand.length ? "No district demand data yet." : undefined}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {districtDemand.map((d) => (
                  <div key={d.district} className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-semibold text-foreground">{d.district}</p>
                      <span className="text-[10px] font-bold text-primary/70 num">Demand {d.demandScore}</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Top model</span><span className="text-foreground">{d.topModel}</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Avg price</span><span className="text-foreground num">{d.avgPrice > 0 ? formatPrice(d.avgPrice) : "—"}</span></div>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary/50"><div className="h-full rounded-full bg-primary/50" style={{ width: `${d.demandScore}%` }} /></div>
                  </div>
                ))}
              </div>
            </WidgetShell>
          </main>
        </div>
      </div>
    </div>
  );
}
