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
import { revealContainer, revealItem, springSoft } from "@/lib/motion";
import { SectionHeader } from "@/components/SectionHeader";
import {
  buildDealerNotifications,
  buildDistrictDemandRows,
  buildDistrictPriceGaps,
  buildTurnoverSeries,
} from "@/lib/dealerDashboardData";

type WidgetKey = "turnover" | "priceGap" | "districtDemand" | "inventoryBenchmark";

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "10px",
  fontSize: "11px",
  color: "hsl(var(--foreground))",
  boxShadow: "var(--shadow-md)",
} as const;

const TOOLTIP_LABEL_STYLE = { color: "hsl(var(--muted-foreground))" } as const;

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
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">Dealer Intelligence</p>
          <h3 className="mt-1 font-display text-[15px] font-bold tracking-tight text-foreground">{title}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground font-medium">{subtitle}</p>
        </div>
        <button type="button" onClick={onToggle} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground active:scale-[0.95]" aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`} aria-expanded={!collapsed}>
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>
      {!collapsed && (
        <div className="mt-4 border-t border-border pt-4">
          {loading ? (
            <div className="flex min-h-[180px] items-center justify-center">
              <div aria-hidden className="h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            </div>
          ) : error ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-center">
              <AlertTriangle className="h-4 w-4 text-rose-500 dark:text-rose-400" />
              <p className="text-[11px] text-muted-foreground">{error}</p>
              {onRetry ? (
                <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[10px] font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-surface active:scale-[0.97]">
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
  if (pct <= -5) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 5) return "text-rose-600 dark:text-rose-400";
  return "text-amber-600 dark:text-amber-400";
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
      <div className="rounded-xl border border-border bg-surface p-4">
        <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80 mb-2 font-semibold">
          Listing URLs <span className="normal-case font-normal">(one per line, max 50)</span>
        </label>
        <textarea
          ref={textareaRef}
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder={"https://ikman.lk/en/ad/toyota-vitz-2018-for-sale-...\nhttps://riyasewana.com/listing/..."}
          rows={5}
          className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[10px] text-muted-foreground font-bold num">{urlCount > 0 ? `${urlCount} URL${urlCount === 1 ? "" : "s"}` : "Paste URLs above"}</span>
          <div className="flex items-center gap-2">
            {(results !== null || urlsText) && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex h-8 items-center rounded-full border border-border bg-surface px-3 text-[10px] font-bold text-muted-foreground transition-all hover:text-foreground hover:bg-card active:scale-[0.97]"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={loading || !urlCount}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-4 text-[10px] font-bold text-white shadow-soft transition-all hover:bg-primary/95 active:scale-[0.97] disabled:opacity-40"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="h-3 w-3 animate-spin rounded-full border border-current/30 border-t-current" />
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
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
          <p className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">{submitError}</p>
        </div>
      )}

      {results !== null && results.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[600px] text-[11px]">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="px-3 py-2.5 text-left font-bold text-muted-foreground/80">URL</th>
                <th className="px-3 py-2.5 text-left font-bold text-muted-foreground/80">Vehicle</th>
                <th className="px-3 py-2.5 text-right font-bold text-muted-foreground/80">Listing price</th>
                <th className="px-3 py-2.5 text-right font-bold text-muted-foreground/80">Market median</th>
                <th className="px-3 py-2.5 text-right font-bold text-muted-foreground/80">Gap</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, idx) => (
                <tr key={row.url + String(idx)} className="border-b border-border last:border-0 transition-colors hover:bg-card">
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
                      <span className="mt-0.5 block text-[9px] text-rose-600 dark:text-rose-400">{row.error}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-foreground font-medium">
                    {row.make ? (
                      <span>
                        {row.make}{row.model ? ` ${row.model}` : ""}{row.year ? ` (${row.year})` : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right num text-foreground font-medium">
                    {row.listing_price != null ? formatPrice(row.listing_price) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right num text-foreground font-medium">
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
        tone: liveLeads != null ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
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
      variants={revealContainer}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative Orbs */}
      <div aria-hidden className="absolute top-[5%] right-[-10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[90px] pointer-events-none" />
      <div aria-hidden className="absolute bottom-[10%] left-[-15%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[90px] pointer-events-none" />

      <motion.section variants={revealItem} className="relative z-10 border-b border-border bg-surface">
        <div className="mx-auto max-w-[1320px] px-5 py-14 sm:px-6 lg:py-20">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-bright">
            <span aria-hidden className="h-1 w-1 rounded-full bg-primary" />
            Dealer workspace
          </p>
          <h1 className="display-hero mt-4 max-w-3xl text-foreground">Dealer command center.</h1>
          <p className="text-body-lg mt-5 max-w-xl">Arbitrage, demand mapping, and lead flow intelligence.</p>
          <Link to="/#market" className="mt-7 inline-flex h-10 items-center rounded-full border border-border bg-card px-5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground no-underline shadow-soft transition-all hover:border-primary/40 hover:text-foreground hover:bg-surface active:scale-[0.98]">Open public inventory</Link>
        </div>
      </motion.section>

      <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 lg:py-14 relative z-10">
        {dashboardError ? (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-foreground">Dealer data unavailable</p>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">{dashboardError}</p>
              <button type="button" onClick={retryAll} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[10px] font-bold text-foreground transition-all hover:border-primary/40 hover:bg-card active:scale-[0.97]">
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[268px_1fr]">
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <motion.div variants={revealItem} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary-bright">AutoLens LK</p>
              <h2 className="mt-2 font-display text-lg font-bold tracking-tight text-foreground">Command stack</h2>
              <nav className="mt-4 space-y-1" aria-label="Dealer command stack">
                {[
                  { label: "Inventory Turnover", meta: turnoverData.length ? `${turnoverData.length} models` : "—" },
                  { label: "Price Gap Scanner", meta: priceGaps.length ? `${priceGaps.length} districts` : "—" },
                  { label: "District Demand", meta: districtDemand.length ? `${districtDemand.length} zones` : "—" },
                  { label: "Lead Notifications", meta: notifications.length > 1 ? "live" : "standby" },
                  { label: "Inventory Benchmark", meta: "URL upload" },
                ].map((i) => (
                  <div key={i.label} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 transition-all hover:border-primary/40 hover:bg-card">
                    <span className="text-[11px] text-foreground font-medium">{i.label}</span>
                    <span className="text-[9px] font-bold text-primary-bright num">{i.meta}</span>
                  </div>
                ))}
              </nav>
            </motion.div>
            <motion.div variants={revealItem} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary-bright" /><p className="text-[10px] font-bold text-primary-bright">Trust tier</p></div>
              {dashboardLoading ? (
                <div className="mt-3 h-8 animate-pulse rounded-md bg-surface" />
              ) : (
                <>
                  <p className="mt-2 flex items-baseline gap-1">
                    <span className="num text-2xl font-bold text-foreground">{trustScore ?? "—"}</span>
                    {trustScore != null ? <span className="text-[11px] text-muted-foreground font-bold">/100</span> : null}
                  </p>
                  {trustScore != null ? (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-primary" style={{ width: `${trustScore}%` }} /></div>
                  ) : (
                    <p className="mt-2 text-[10px] text-muted-foreground font-medium">Trust score needs listing volume data.</p>
                  )}
                </>
              )}
            </motion.div>
          </aside>

          <main className="space-y-6">
            {/* Featured KPI bento: primary metric towers over the pair */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((m, idx) => {
                const featured = idx === 0;
                return (
                  <motion.div
                    key={m.label}
                    variants={revealItem}
                    whileHover={featured ? { y: -2 } : undefined}
                    transition={springSoft}
                    className={`group rounded-2xl border border-border bg-card shadow-soft transition-all hover:border-primary/30 ${featured ? "sm:col-span-2 p-6" : "p-5"}`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">{m.label}</p>
                    {dashboardLoading ? (
                      <div className={`mt-3 animate-pulse rounded-md bg-surface ${featured ? "h-12 w-28" : "h-8 w-16"}`} />
                    ) : (
                      <p className={`num mt-2 font-bold text-foreground ${featured ? "text-4xl sm:text-5xl" : "text-2xl"}`}>{m.value}</p>
                    )}
                    <p className={`mt-1 text-[11px] font-semibold ${m.tone}`}>{m.delta}</p>
                  </motion.div>
                );
              })}
            </div>

            <motion.div variants={revealItem} key={activeNotif} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary-bright"><Bell className="h-3.5 w-3.5" /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-primary-bright">Lead notification</p>
                <p className="mt-1 text-[12px] text-foreground font-medium leading-relaxed">{activeNotif}</p>
              </div>
            </motion.div>

            <div className="pt-4">
              <SectionHeader
                eyebrow="Analytics"
                title="Inventory & benchmark analytics"
                description="Momentum, price spread, and district demand across your live market feed."
              />

              <div className="space-y-5">
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
                        <defs><linearGradient id="turnoverArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                        <Area type="monotone" dataKey="sellThrough" name="Momentum index" stroke="hsl(var(--primary))" fill="url(#turnoverArea)" strokeWidth={2} />
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
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="district" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v: number) => [`${v.toFixed(1)}%`, "Gap"]} />
                        <Bar dataKey="gapPct" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
                      <div key={d.district} className="rounded-xl border border-border bg-surface p-4 transition-all hover:border-primary/40 hover:bg-card hover:shadow-soft">
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] font-bold text-foreground">{d.district}</p>
                          <span className="text-[10px] font-bold text-primary-bright num">Demand {d.demandScore}</span>
                        </div>
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-[10px] font-medium"><span className="text-muted-foreground">Top model</span><span className="text-foreground">{d.topModel}</span></div>
                          <div className="flex justify-between text-[10px] font-medium"><span className="text-muted-foreground">Avg price</span><span className="text-foreground num">{d.avgPrice > 0 ? formatPrice(d.avgPrice) : "—"}</span></div>
                        </div>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-card"><div className="h-full rounded-full bg-primary" style={{ width: `${d.demandScore}%` }} /></div>
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
              </div>
            </div>
          </main>
        </div>
      </div>
    </motion.div>
  );
}
