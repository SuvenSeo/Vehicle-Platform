import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Bell, ChevronDown, ChevronUp, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import {
  benchmarkDealerUrls,
  formatPrice,
  getDashboardInsights,
  getDistrictPrices,
  getProMarketSnapshot,
  getStats,
} from "@/services/api";
import type { UrlBenchmarkResult } from "@/services/api";
import { getStoredAuthToken } from "@/lib/authToken";
import type { ProMarketSnapshot } from "@/types/pro";
import {
  buildDealerNotifications,
  buildDistrictDemandRows,
  buildDistrictPriceGaps,
  buildTurnoverSeries,
} from "@/lib/dealerDashboardData";

type WidgetKey = "turnover" | "priceGap" | "districtDemand" | "inventoryBenchmark";

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

const TOOLTIP_STYLE = { background: "rgba(9,9,11,0.95)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "11px" } as const;

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
    <section className="rounded-xl border border-white/5 bg-white/[0.01] backdrop-blur-md p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">Dealer Intelligence</p>
          <h3 className="mt-1 text-[14px] font-bold text-white">{title}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground font-medium">{subtitle}</p>
        </div>
        <button type="button" onClick={onToggle} className="flex h-7 w-7 items-center justify-center rounded-md border border-white/5 text-muted-foreground hover:border-primary/20 hover:text-white transition-colors" aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`} aria-expanded={!collapsed}>
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>
      {!collapsed && (
        <div className="mt-4 border-t border-white/5 pt-4">
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

function gapTone(pct: number | null): string {
  if (pct === null) return "text-muted-foreground";
  if (pct <= -5) return "text-emerald-400";
  if (pct >= 5) return "text-rose-400";
  return "text-amber-400";
}

function InventoryBenchmark() {
  const [urlsText, setUrlsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UrlBenchmarkResult[] | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    const urls = urlsText.split("\n").map((u) => u.trim()).filter(Boolean);
    if (!urls.length) return;
    setLoading(true);
    setSubmitError(null);
    setResults(null);
    try {
      const data = await benchmarkDealerUrls(urls);
      setResults(data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setUrlsText("");
    setResults(null);
    setSubmitError(null);
    textareaRef.current?.focus();
  };

  const urlCount = urlsText.split("\n").filter((l) => l.trim()).length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/5 bg-white/[0.01] p-4">
        <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80 mb-2 font-semibold">
          Listing URLs <span className="normal-case font-normal">(one per line, max 50)</span>
        </label>
        <textarea
          ref={textareaRef}
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder={"https://ikman.lk/en/ad/toyota-vitz-2018-for-sale-...\nhttps://riyasewana.com/listing/..."}
          rows={5}
          className="w-full resize-none rounded-lg border border-white/5 bg-white/[0.01] px-3 py-2.5 text-[12px] text-white placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/20"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[10px] text-muted-foreground font-bold num">{urlCount > 0 ? `${urlCount} URL${urlCount === 1 ? "" : "s"}` : "Paste URLs above"}</span>
          <div className="flex items-center gap-2">
            {(results !== null || urlsText) && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex h-8 items-center rounded-lg border border-white/5 bg-white/[0.02] px-3 text-[10px] font-bold text-muted-foreground hover:text-white hover:bg-white/[0.04] transition-all"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={loading || !urlCount}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-4 text-[10px] font-bold text-white hover:bg-primary/95 disabled:opacity-40 shadow-[0_2px_8px_rgba(124,58,237,0.12)] transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border border-current/30 border-t-current" />
                  Benchmarking…
                </span>
              ) : (
                <>
                  <Upload className="h-3 w-3" />
                  Benchmark
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400/80" />
          <p className="text-[11px] text-rose-300/90 font-medium">{submitError}</p>
        </div>
      )}

      {results !== null && results.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/5 bg-white/[0.01]">
          <table className="w-full min-w-[600px] text-[11px]">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-3 py-2.5 text-left font-bold text-muted-foreground/80">URL</th>
                <th className="px-3 py-2.5 text-left font-bold text-muted-foreground/80">Vehicle</th>
                <th className="px-3 py-2.5 text-right font-bold text-muted-foreground/80">Listing price</th>
                <th className="px-3 py-2.5 text-right font-bold text-muted-foreground/80">Market median</th>
                <th className="px-3 py-2.5 text-right font-bold text-muted-foreground/80">Gap</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, idx) => (
                <tr key={row.url + String(idx)} className="border-b border-white/5/50 last:border-0 hover:bg-white/[0.02]">
                  <td className="max-w-[180px] px-3 py-2.5">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-primary hover:underline font-medium"
                      title={row.url}
                    >
                      {row.url.replace(/^https?:\/\//, "").slice(0, 45)}{row.url.length > 50 ? "…" : ""}
                    </a>
                    {row.error && (
                      <span className="mt-0.5 block text-[9px] text-rose-450">{row.error}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-white font-medium">
                    {row.make ? (
                      <span>
                        {row.make}{row.model ? ` ${row.model}` : ""}{row.year ? ` (${row.year})` : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right num text-white font-medium">
                    {row.listing_price != null ? formatPrice(row.listing_price) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right num text-white font-medium">
                    {row.market_median != null ? (
                      <span title={`${row.comparable_count} comparables`}>
                        {formatPrice(row.market_median)}
                        <span className="ml-1 text-[9px] text-muted-foreground">({row.comparable_count})</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={`px-3 py-2.5 text-right num font-bold ${gapTone(row.price_gap_pct)}`}>
                    {row.price_gap_pct != null ? (
                      `${row.price_gap_pct > 0 ? "+" : ""}${row.price_gap_pct.toFixed(1)}%`
                    ) : (
                      <span className="font-normal text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results !== null && results.length === 0 && (
        <p className="py-6 text-center text-[11px] text-muted-foreground">No results returned.</p>
      )}
    </div>
  );
}

export default function DealerDashboard() {
  const [collapsed, setCollapsed] = useState<Record<WidgetKey, boolean>>({ turnover: false, priceGap: false, districtDemand: false, inventoryBenchmark: false });
  const [notifIdx, setNotifIdx] = useState(0);
  const hasAuthToken = Boolean(getStoredAuthToken());

  const statsQuery = useQuery({ queryKey: ["stats"], queryFn: getStats, retry: 1 });
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

  const activeNotif =
    notifications[notifIdx] ??
    notifications[0] ??
    "Market intelligence syncs from live listing data when available.";
  const toggle = (k: WidgetKey) => setCollapsed((p) => ({ ...p, [k]: !p[k] }));

  const retryAll = () => {
    void statsQuery.refetch();
    void insightsQuery.refetch();
    void districtsQuery.refetch();
    if (hasAuthToken) void proSnapshotQuery.refetch();
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[5%] right-[-10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-15%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[90px] pointer-events-none" />

      <motion.section variants={itemVariants} className="border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-md relative z-10">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Dealer workspace</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-tight leading-[1.05] text-white sm:text-[2.75rem] lg:text-[3rem]">Dealer command center.</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground font-medium">Arbitrage, demand mapping, and lead flow intelligence.</p>
          <Link to="/#market" className="mt-4 inline-flex h-9 items-center rounded-lg border border-white/5 bg-white/[0.01] px-4 text-[10px] font-bold text-muted-foreground no-underline hover:text-white hover:bg-white/[0.03] transition-all">Open public inventory</Link>
        </div>
      </motion.section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 relative z-10">
        {dashboardError ? (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-450" />
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-white">Dealer data unavailable</p>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">{dashboardError}</p>
              <button type="button" onClick={retryAll} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 text-[10px] font-bold text-white hover:bg-white/[0.04]">
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[268px_1fr]">
          <aside className="space-y-4 lg:sticky lg:top-20">
            <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 backdrop-blur-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">AutoLens LK</p>
              <h2 className="mt-2 font-display text-lg font-bold tracking-tight text-white">Command stack</h2>
              <nav className="mt-4 space-y-1" aria-label="Dealer command stack">
                {[
                  { label: "Inventory Turnover", meta: turnoverData.length ? `${turnoverData.length} models` : "—" },
                  { label: "Price Gap Scanner", meta: priceGaps.length ? `${priceGaps.length} districts` : "—" },
                  { label: "District Demand", meta: districtDemand.length ? `${districtDemand.length} zones` : "—" },
                  { label: "Lead Notifications", meta: notifications.length > 1 ? "live" : "standby" },
                  { label: "Inventory Benchmark", meta: "URL upload" },
                ].map((i) => (
                  <div key={i.label} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.01] px-3 py-2 hover:border-primary/20 hover:bg-white/[0.02] transition-all">
                    <span className="text-[11px] text-white font-medium">{i.label}</span>
                    <span className="text-[9px] font-bold text-primary num">{i.meta}</span>
                  </div>
                ))}
              </nav>
            </motion.div>
            <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-4 backdrop-blur-md">
              <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /><p className="text-[10px] font-bold text-primary">Trust tier</p></div>
              {dashboardLoading ? (
                <div className="mt-3 h-8 animate-pulse rounded-md bg-white/[0.02]" />
              ) : (
                <>
                  <p className="mt-2 flex items-baseline gap-1">
                    <span className="num text-2xl font-bold text-white">{trustScore ?? "—"}</span>
                    {trustScore != null ? <span className="text-[11px] text-muted-foreground font-bold">/100</span> : null}
                  </p>
                  {trustScore != null ? (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.04]"><div className="h-full rounded-full bg-primary" style={{ width: `${trustScore}%` }} /></div>
                  ) : (
                    <p className="mt-2 text-[10px] text-muted-foreground font-medium">Trust score needs listing volume data.</p>
                  )}
                </>
              )}
            </motion.div>
          </aside>

          <main className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-3">
              {metrics.map((m) => (
                <motion.div key={m.label} variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-4 backdrop-blur-md">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">{m.label}</p>
                  {dashboardLoading ? (
                    <div className="mt-2 h-8 w-16 animate-pulse rounded-md bg-white/[0.02]" />
                  ) : (
                    <p className="num mt-2 text-2xl font-bold text-white">{m.value}</p>
                  )}
                  <p className={`mt-0.5 text-[10px] font-semibold ${m.tone}`}>{m.delta}</p>
                </motion.div>
              ))}
            </div>

            <motion.div variants={itemVariants} key={activeNotif} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.01] p-4 backdrop-blur-md">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><Bell className="h-3.5 w-3.5" /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-primary">Lead notification</p>
                <p className="mt-1 text-[12px] text-white font-medium leading-relaxed">{activeNotif}</p>
              </div>
            </motion.div>

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
                    <defs><linearGradient id="turnoverArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="sellThrough" name="Momentum index" stroke="var(--primary)" fill="url(#turnoverArea)" strokeWidth={2} />
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
                    <XAxis dataKey="district" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 10 }} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(1)}%`, "Gap"]} />
                    <Bar dataKey="gapPct" fill="var(--primary)" radius={[4, 4, 0, 0]} />
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
                  <div key={d.district} className="rounded-lg border border-white/5 bg-white/[0.01] p-4 transition-all hover:border-primary/20 hover:bg-white/[0.03]">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-bold text-white">{d.district}</p>
                      <span className="text-[10px] font-bold text-primary num">Demand {d.demandScore}</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[10px] font-medium"><span className="text-muted-foreground">Top model</span><span className="text-white">{d.topModel}</span></div>
                      <div className="flex justify-between text-[10px] font-medium"><span className="text-muted-foreground">Avg price</span><span className="text-white num">{d.avgPrice > 0 ? formatPrice(d.avgPrice) : "—"}</span></div>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.04]"><div className="h-full rounded-full bg-primary" style={{ width: `${d.demandScore}%` }} /></div>
                  </div>
                ))}
              </div>
            </WidgetShell>

            <WidgetShell
              title="Inventory Benchmark"
              subtitle="Paste listing URLs to benchmark against the current market"
              collapsed={collapsed.inventoryBenchmark}
              onToggle={() => toggle("inventoryBenchmark")}
            >
              <InventoryBenchmark />
            </WidgetShell>
          </main>
        </div>
      </div>
    </motion.div>
  );
}
