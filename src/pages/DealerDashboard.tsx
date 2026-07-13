import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bell, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { formatPrice } from "@/services/api";

type WidgetKey = "turnover" | "priceGap" | "districtDemand";

const INVENTORY_TURNOVER = [
  { week: "W1", sellThrough: 42, leads: 81 }, { week: "W2", sellThrough: 48, leads: 96 },
  { week: "W3", sellThrough: 53, leads: 112 }, { week: "W4", sellThrough: 57, leads: 126 },
  { week: "W5", sellThrough: 61, leads: 141 }, { week: "W6", sellThrough: 65, leads: 154 },
];
const PRICE_GAPS = [
  { district: "Colombo", gapPct: 4.8 }, { district: "Gampaha", gapPct: 6.3 },
  { district: "Kandy", gapPct: 3.9 }, { district: "Kurunegala", gapPct: 5.5 }, { district: "Matara", gapPct: 2.7 },
];
const DISTRICT_DEMAND = [
  { district: "Colombo", demandScore: 87, topModel: "Toyota Aqua", avgPrice: 7800000 },
  { district: "Gampaha", demandScore: 82, topModel: "Suzuki Wagon R", avgPrice: 5400000 },
  { district: "Kandy", demandScore: 76, topModel: "Honda Vezel", avgPrice: 9800000 },
  { district: "Galle", demandScore: 71, topModel: "Toyota Axio", avgPrice: 7600000 },
];
const NOTIFICATIONS = [
  "Qualified lead: Toyota Aqua 2016 buyer in Colombo (budget Rs. 7.8M)",
  "Arbitrage alert: Honda Fit listed 5.1% below district median in Kandy",
  "Finance-ready lead: Vezel lease pre-check approved with partner bank",
  "Inventory velocity spike: Aqua demand up 12% this week in Gampaha",
];

const TOOLTIP_STYLE = { background: "hsl(220,8%,6%)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "11px" } as const;

function WidgetShell({ title, subtitle, collapsed, onToggle, children }: { title: string; subtitle: string; collapsed: boolean; onToggle: () => void; children: React.ReactNode }) {
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
      {!collapsed && <div className="mt-4 border-t border-border pt-4">{children}</div>}
    </section>
  );
}

export default function DealerDashboard() {
  const [collapsed, setCollapsed] = useState<Record<WidgetKey, boolean>>({ turnover: false, priceGap: false, districtDemand: false });
  const [notifIdx, setNotifIdx] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setNotifIdx((i) => (i + 1) % NOTIFICATIONS.length), 5500);
    return () => window.clearInterval(t);
  }, []);

  const activeNotif = useMemo(() => NOTIFICATIONS[notifIdx], [notifIdx]);
  const toggle = (k: WidgetKey) => setCollapsed((p) => ({ ...p, [k]: !p[k] }));

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
        <div className="grid gap-6 lg:grid-cols-[268px_1fr]">
          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-20">
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/70">AutoLens LK</p>
              <h2 className="mt-2 font-display text-lg font-semibold tracking-tight text-foreground">Command stack</h2>
              <nav className="mt-4 space-y-1" aria-label="Dealer command stack">
                {[
                  { label: "Inventory Turnover", meta: "6-week" },
                  { label: "Price Gap Scanner", meta: "5 districts" },
                  { label: "District Demand", meta: "4 zones" },
                  { label: "Lead Notifications", meta: "live" },
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
              <p className="mt-2 flex items-baseline gap-1"><span className="num text-2xl font-bold text-foreground">92</span><span className="text-[11px] text-muted-foreground">/100</span></p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary/50"><div className="h-full rounded-full bg-primary/60" style={{ width: "92%" }} /></div>
            </div>
          </aside>

          {/* Main */}
          <main className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-3">
              {[{ label: "Live leads", value: "27", delta: "+18% vs last week", tone: "text-emerald-400" }, { label: "Arbitrage alerts", value: "14", delta: "Highest in Gampaha", tone: "text-muted-foreground" }, { label: "Finance ready", value: "9", delta: "Pre-approval active", tone: "text-muted-foreground" }].map((m) => (
                <div key={m.label} className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{m.label}</p>
                  <p className="num mt-2 text-2xl font-bold text-foreground">{m.value}</p>
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

            <WidgetShell title="Inventory Turnover" subtitle="Sell-through by weekly cycle" collapsed={collapsed.turnover} onToggle={() => toggle("turnover")}>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={INVENTORY_TURNOVER}>
                    <defs><linearGradient id="turnoverArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--gold)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--gold)" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="sellThrough" name="Sell-through %" stroke="var(--gold)" fill="url(#turnoverArea)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </WidgetShell>

            <WidgetShell title="Price Gaps" subtitle="District spread for margin capture" collapsed={collapsed.priceGap} onToggle={() => toggle("priceGap")}>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PRICE_GAPS}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="district" tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(1)}%`, "Gap"]} />
                    <Bar dataKey="gapPct" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </WidgetShell>

            <WidgetShell title="District Demand" subtitle="Model concentration and deal floor" collapsed={collapsed.districtDemand} onToggle={() => toggle("districtDemand")}>
              <div className="grid gap-2 sm:grid-cols-2">
                {DISTRICT_DEMAND.map((d) => (
                  <div key={d.district} className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-semibold text-foreground">{d.district}</p>
                      <span className="text-[10px] font-bold text-primary/70 num">Demand {d.demandScore}</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Top model</span><span className="text-foreground">{d.topModel}</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Avg price</span><span className="text-foreground num">{formatPrice(d.avgPrice)}</span></div>
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
