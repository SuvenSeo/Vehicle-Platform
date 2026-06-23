import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Crown, Download, FileText, Lock, MapPin, ShieldCheck, Sparkles } from "lucide-react";

const LANES = [
  { name: "Toyota Aqua", listings: 824, median: "Rs. 7.8M", district: "Colombo" },
  { name: "Honda Vezel", listings: 612, median: "Rs. 11.2M", district: "Gampaha" },
  { name: "Suzuki Wagon R", listings: 589, median: "Rs. 5.4M", district: "Kandy" },
  { name: "Nissan Leaf", listings: 311, median: "Rs. 6.1M", district: "Colombo" },
];

const CHART_DATA = [
  { label: "Ikman", count: 9400 },
  { label: "Riyasewana", count: 5100 },
  { label: "AutoLanka", count: 1800 },
  { label: "Patpat", count: 1300 },
  { label: "AutoDirect", count: 800 },
];

const REPORTS = ["Executive PDF", "Editable Word brief", "CSV data pack", "JSON API snapshot", "Print-ready report"];

function LockedOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-surface/70 backdrop-blur-[3px]">
      <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-center">
        <Lock className="mx-auto mb-1.5 h-4 w-4 text-primary/70" />
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary/80">Unlock with Pro</p>
      </div>
    </div>
  );
}

export default function ProPreview() {
  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-primary/15 bg-primary/5 px-2.5 py-1 mb-4">
            <Crown className="h-3 w-3 text-primary/70" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/80">Pro Preview</span>
          </div>
          <h1 className="font-display text-[2rem] font-bold tracking-[-0.035em] leading-[1.02] text-foreground sm:text-[2.75rem] lg:text-[3rem]">Pro workspace preview.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">See the depth of lane drill-downs, district profiles, and export packs before you sign in.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/sign-in" className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--gold)] px-4 text-[10px] font-bold uppercase tracking-[0.08em] text-white no-underline hover:bg-[var(--gold-bright)]">
              <ShieldCheck className="h-3 w-3" /> Sign in to unlock
            </Link>
            <Link to="/" className="flex h-9 items-center rounded-lg border border-border px-4 text-[10px] font-semibold text-muted-foreground no-underline hover:text-foreground">Browse public data</Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            {/* Lane table */}
            <div className="relative rounded-xl border border-border bg-card p-5">
              <LockedOverlay />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">Lane drill-downs</p>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-[12px]">
                  <thead><tr className="bg-surface">
                    {["Vehicle", "Listings", "Median", "Top area"].map((h) => <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {LANES.map((l) => (
                      <tr key={l.name} className="border-t border-border">
                        <td className="px-4 py-2.5 font-semibold text-foreground">{l.name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground num">{l.listings}</td>
                        <td className="px-4 py-2.5 text-primary num">{l.median}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{l.district}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chart */}
            <div className="relative rounded-xl border border-border bg-card p-5">
              <LockedOverlay />
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Source coverage</p>
                <BarChart3 className="h-3.5 w-3.5 text-primary/60" />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={CHART_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(220,8%,6%)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="count" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-5">
              <Sparkles className="mb-3 h-4 w-4 text-primary/60" />
              <h2 className="font-display text-sm font-semibold text-foreground">What Pro adds</h2>
              <div className="mt-4 space-y-1.5">
                {["Lane drill-downs with live samples", "District opportunity profiles", "Trend studio with exportable history", "Data quality coverage", "PDF, Word, CSV, JSON exports"].map((i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                    <p className="text-[11px] text-muted-foreground">{i}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-3.5 w-3.5 text-primary/60" />
                <h2 className="text-[13px] font-semibold text-foreground">Report formats</h2>
              </div>
              <div className="space-y-1.5">
                {REPORTS.map((r) => (
                  <div key={r} className="flex h-9 items-center justify-between rounded-lg border border-border bg-surface px-3 text-[11px] text-muted-foreground">
                    <span>{r}</span><Download className="h-3 w-3" />
                  </div>
                ))}
              </div>
            </div>

            <Link to="/sign-in" className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--gold)] text-[10px] font-bold uppercase tracking-[0.08em] text-white no-underline hover:bg-[var(--gold-bright)]">
              <MapPin className="h-3 w-3" /> Unlock Pro workspace
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
