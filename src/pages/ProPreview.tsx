import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Crown, Download, FileText, Lock, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { revealContainer, revealItem, springSoft } from "@/lib/motion";

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
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-background/70 backdrop-blur-[3px]">
      <div className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-center shadow-soft">
        <Lock aria-hidden className="mx-auto mb-1.5 h-4 w-4 text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary-bright">Unlock with Pro</p>
      </div>
    </div>
  );
}

export default function ProPreview() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="page-canvas relative min-h-screen overflow-hidden"
    >
      {/* Ambient wash — token-driven, adapts to both themes */}
      <div aria-hidden className="pointer-events-none absolute right-[-10%] top-[8%] h-[450px] w-[450px] rounded-full bg-primary/5 blur-[110px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-[18%] left-[-15%] h-[400px] w-[400px] rounded-full bg-primary/5 blur-[100px]" />

      {/* Hero — one confident, towering headline */}
      <motion.section variants={revealItem} className="relative z-10 border-b border-border">
        <div className="mx-auto max-w-[1320px] px-5 pb-14 pt-16 sm:px-6 lg:pb-20 lg:pt-24">
          <div className="section-eyebrow mb-5 inline-flex items-center gap-2">
            <Crown aria-hidden className="h-3.5 w-3.5" />
            Pro Preview
          </div>
          <h1 className="display-hero max-w-3xl text-foreground">Pro workspace preview.</h1>
          <p className="text-body-lg mt-6 max-w-xl">
            See the depth of lane drill-downs, district profiles, and export packs before you sign in.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/sign-in"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[13px] font-semibold text-primary-foreground no-underline shadow-soft transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ShieldCheck aria-hidden className="h-4 w-4" /> Sign in to unlock
            </Link>
            <Link
              to="/"
              className="inline-flex h-11 items-center rounded-full border border-border bg-card px-6 text-[13px] font-semibold text-foreground no-underline transition-all hover:border-primary/40 hover:bg-surface active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Browse public data
            </Link>
          </div>
        </div>
      </motion.section>

      <div className="relative z-10 mx-auto max-w-[1320px] px-5 py-14 sm:px-6 lg:py-20">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            {/* Featured card — lane table, the primary item */}
            <motion.div variants={revealItem} className="premium-surface relative p-6 sm:p-7">
              <LockedOverlay />
              <p className="section-eyebrow mb-5">Lane drill-downs</p>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-surface">
                      {["Vehicle", "Listings", "Median", "Top area"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {LANES.map((l) => (
                      <tr key={l.name} className="border-t border-border">
                        <td className="px-4 py-3 font-bold text-foreground">{l.name}</td>
                        <td className="num px-4 py-3 font-medium text-muted-foreground">{l.listings}</td>
                        <td className="num px-4 py-3 font-bold text-primary">{l.median}</td>
                        <td className="px-4 py-3 font-medium text-muted-foreground">{l.district}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Chart — theme-aware via tokens */}
            <motion.div variants={revealItem} className="data-card relative p-6">
              <LockedOverlay />
              <div className="mb-5 flex items-center justify-between">
                <p className="section-eyebrow">Source coverage</p>
                <BarChart3 aria-hidden className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={CHART_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--surface))" }}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 10,
                        fontSize: 11,
                        color: "hsl(var(--foreground))",
                        boxShadow: "0 8px 28px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)",
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          <aside className="space-y-6">
            <motion.div
              variants={revealItem}
              whileHover={{ y: -2 }}
              transition={springSoft}
              className="data-card p-6"
            >
              <Sparkles aria-hidden className="mb-3 h-5 w-5 text-primary" />
              <h2 className="font-display text-[15px] font-bold text-foreground">What Pro adds</h2>
              <div className="mt-4 space-y-2">
                {["Lane drill-downs with live samples", "District opportunity profiles", "Trend studio with exportable history", "Data quality coverage", "PDF, Word, CSV, JSON exports"].map((i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-xl border border-border bg-surface p-3">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <p className="text-[11px] font-semibold text-muted-foreground">{i}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={revealItem}
              whileHover={{ y: -2 }}
              transition={springSoft}
              className="data-card p-6"
            >
              <div className="mb-3 flex items-center gap-2">
                <FileText aria-hidden className="h-4 w-4 text-primary" />
                <h2 className="text-[15px] font-bold text-foreground">Report formats</h2>
              </div>
              <div className="space-y-2">
                {REPORTS.map((r) => (
                  <div key={r} className="flex h-9 items-center justify-between rounded-xl border border-border bg-surface px-3 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
                    <span>{r}</span>
                    <Download aria-hidden className="h-3 w-3 text-primary" />
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div variants={revealItem}>
              <Link
                to="/sign-in"
                className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-[13px] font-semibold text-primary-foreground no-underline shadow-soft transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <MapPin aria-hidden className="h-4 w-4" /> Unlock Pro workspace
              </Link>
            </motion.div>
          </aside>
        </div>
      </div>
    </motion.div>
  );
}
