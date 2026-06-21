import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Bell, ChevronDown, ChevronUp, Gauge, ShieldCheck } from "lucide-react";
import { formatPrice } from "@/services/api";
import { PlatformPageHero } from "@/components/PlatformPageHero";
import { PageCanvas } from "@/components/PageCanvas";

type WidgetKey = "turnover" | "priceGap" | "districtDemand";

const INVENTORY_TURNOVER = [
  { week: "W1", sellThrough: 42, leads: 81 },
  { week: "W2", sellThrough: 48, leads: 96 },
  { week: "W3", sellThrough: 53, leads: 112 },
  { week: "W4", sellThrough: 57, leads: 126 },
  { week: "W5", sellThrough: 61, leads: 141 },
  { week: "W6", sellThrough: 65, leads: 154 },
];

const PRICE_GAPS = [
  { district: "Colombo", gapPct: 4.8 },
  { district: "Gampaha", gapPct: 6.3 },
  { district: "Kandy", gapPct: 3.9 },
  { district: "Kurunegala", gapPct: 5.5 },
  { district: "Matara", gapPct: 2.7 },
];

const DISTRICT_DEMAND = [
  { district: "Colombo", demandScore: 87, topModel: "Toyota Aqua", avgPrice: 7800000 },
  { district: "Gampaha", demandScore: 82, topModel: "Suzuki Wagon R", avgPrice: 5400000 },
  { district: "Kandy", demandScore: 76, topModel: "Honda Vezel", avgPrice: 9800000 },
  { district: "Galle", demandScore: 71, topModel: "Toyota Axio", avgPrice: 7600000 },
];

const LEAD_NOTIFICATIONS = [
  "Qualified lead: Toyota Aqua 2016 buyer in Colombo (budget Rs. 7.8M)",
  "Arbitrage alert: Honda Fit listed 5.1% below district median in Kandy",
  "Finance-ready lead: Vezel lease pre-check approved with partner bank",
  "Inventory velocity spike: Aqua demand up 12% this week in Gampaha",
];

const COMMAND_STACK: { key: WidgetKey | "leads"; label: string; meta: string }[] = [
  { key: "turnover", label: "Inventory Turnover", meta: "6-week cycle" },
  { key: "priceGap", label: "Price Gap Scanner", meta: "5 districts" },
  { key: "districtDemand", label: "District Demand Heat", meta: "4 zones" },
  { key: "leads", label: "Lead Notifications", meta: "live feed" },
];

function WidgetShell({
  title,
  subtitle,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="console-section p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="tech-label">Dealer Intelligence</p>
          <h3 className="headline-display mt-1.5 text-lg leading-tight">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md border border-border bg-background text-zinc-300 transition-colors hover:border-amber-400/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && <div className="mt-5 border-t border-border pt-5">{children}</div>}
    </section>
  );
}

const CHART_TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "10px",
  fontSize: "12px",
} as const;

export default function DealerDashboard() {
  const [collapsed, setCollapsed] = useState<Record<WidgetKey, boolean>>({
    turnover: false,
    priceGap: false,
    districtDemand: false,
  });
  const [notificationIndex, setNotificationIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNotificationIndex((index) => (index + 1) % LEAD_NOTIFICATIONS.length);
    }, 5500);

    return () => window.clearInterval(timer);
  }, []);

  const activeNotification = useMemo(() => LEAD_NOTIFICATIONS[notificationIndex], [notificationIndex]);

  const toggleWidget = (key: WidgetKey) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <PageCanvas>
      <PlatformPageHero
        eyebrow="Dealer workspace"
        title="Dealer command center."
        icon={Gauge}
        metrics={[
          { label: "Live leads", value: "27" },
          { label: "Arbitrage alerts", value: "14" },
          { label: "Trust tier", value: "92" },
        ]}
        actions={
          <Link
            to="/#market"
            className="action-soft h-11 w-full no-underline"
          >
            Open public inventory
          </Link>
        }
      />

      <section className="layout-shell grid gap-6 py-10 md:py-12 lg:grid-cols-[268px_minmax(0,1fr)]">
        {/* ---- Command stack aside -------------------------------------- */}
        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="asset-surface p-5">
            <p className="tech-label text-amber-400">AutoLens LK</p>
            <h2 className="headline-display mt-2 text-2xl leading-tight">Command stack</h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Arbitrage, demand mapping, and lead flow.
            </p>

            <nav className="mt-5 space-y-1.5" aria-label="Dealer command stack">
              {COMMAND_STACK.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2.5"
                >
                  <span className="text-sm text-zinc-200">{item.label}</span>
                  <span className="tech-label text-muted-foreground num">
                    {item.meta}
                  </span>
                </div>
              ))}
            </nav>
          </div>

          <div className="metric-tile px-4 py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <p className="tech-label text-amber-400">Dealer quality tier</p>
            </div>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="num text-3xl font-bold text-white">92</span>
              <span className="text-sm text-zinc-500">/100</span>
            </p>
            <p className="mt-1 text-xs text-zinc-400">Inventory trust score</p>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
              role="img"
              aria-label="Inventory trust score 92 of 100"
            >
              <div className="h-full rounded-full bg-amber-500" style={{ width: "92%" }} />
            </div>
          </div>
        </aside>

        {/* ---- Operator cockpit ----------------------------------------- */}
        <main className="space-y-6">
          {/* Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="metric-tile px-5 py-4">
              <p className="tech-label">Live Lead Queue</p>
              <p className="num mt-2 text-3xl font-bold text-white">27</p>
              <p className="mt-1 text-xs text-emerald-400">+18% vs last week</p>
            </div>
            <div className="metric-tile px-5 py-4">
              <p className="tech-label">Arbitrage Alerts</p>
              <p className="num mt-2 text-3xl font-bold text-white">14</p>
              <p className="mt-1 text-xs text-zinc-400">Highest in Gampaha cluster</p>
            </div>
            <div className="metric-tile px-5 py-4 sm:col-span-2 md:col-span-1">
              <p className="tech-label">Finance Ready Leads</p>
              <p className="num mt-2 text-3xl font-bold text-white">9</p>
              <p className="mt-1 text-xs text-zinc-400">One-click pre-approval stream active</p>
            </div>
          </div>

          {/* Rotating lead notification */}
          <div key={activeNotification} className="asset-surface p-4 sm:p-5">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-md border border-amber-400/40 bg-amber-500/15 text-amber-400">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <p className="tech-label text-amber-400">Lead notification</p>
                <p className="text-sm leading-relaxed text-zinc-100">{activeNotification}</p>
                <div className="flex flex-wrap items-center gap-3 tech-label text-zinc-500">
                  <span className="inline-flex items-center gap-1.5 text-cyan-400">
                    <Gauge className="h-3 w-3" /> live
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-400">
                    <ShieldCheck className="h-3 w-3" /> qualified
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible analytics modules */}
          <WidgetShell
            title="Inventory Turnover"
            subtitle="Sell-through and lead velocity by weekly cycle"
            collapsed={collapsed.turnover}
            onToggle={() => toggleWidget("turnover")}
          >
            <div className="h-[280px] min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={INVENTORY_TURNOVER}>
                  <defs>
                    <linearGradient id="turnoverArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ stroke: "rgba(255,255,255,0.12)" }} />
                  <Area
                    type="monotone"
                    dataKey="sellThrough"
                    name="Sell-through %"
                    stroke="hsl(var(--primary))"
                    fill="url(#turnoverArea)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </WidgetShell>

          <WidgetShell
            title="Price Gaps vs Competitors"
            subtitle="District spread where your inventory can capture margin"
            collapsed={collapsed.priceGap}
            onToggle={() => toggleWidget("priceGap")}
          >
            <div className="h-[260px] min-h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={PRICE_GAPS}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="district" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fill: "#a1a1aa", fontSize: 11 }}
                    tickFormatter={(value) => `${value}%`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, "Price gap"]}
                  />
                  <Bar dataKey="gapPct" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </WidgetShell>

          <WidgetShell
            title="District Demand Heatmap"
            subtitle="Model concentration and average deal floor by district"
            collapsed={collapsed.districtDemand}
            onToggle={() => toggleWidget("districtDemand")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {DISTRICT_DEMAND.map((item) => (
                <div key={item.district} className="data-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{item.district}</p>
                    <span className="tech-label text-amber-400">
                      Demand <span className="num">{item.demandScore}</span>
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-xs text-zinc-500">Top model</dt>
                      <dd className="text-xs text-zinc-200">{item.topModel}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-xs text-zinc-500">Avg price</dt>
                      <dd className="num text-xs text-zinc-200">{formatPrice(item.avgPrice)}</dd>
                    </div>
                  </dl>
                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
                    role="img"
                    aria-label={`${item.district} demand score ${item.demandScore} of 100`}
                  >
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${item.demandScore}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </WidgetShell>
        </main>
      </section>
    </PageCanvas>
  );
}
