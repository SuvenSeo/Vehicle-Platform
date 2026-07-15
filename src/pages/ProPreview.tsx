import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Crown, Download, FileText, Lock, MapPin, ShieldCheck, Sparkles } from "lucide-react";

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
      <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-center">
        <Lock className="mx-auto mb-1.5 h-4 w-4 text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary">Unlock with Pro</p>
      </div>
    </div>
  );
}

export default function ProPreview() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[10%] right-[-10%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-15%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[90px] pointer-events-none" />

      {/* Hero Header */}
      <motion.section variants={itemVariants} className="border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-md relative z-10">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 mb-4">
            <Crown className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-primary">Pro Preview</span>
          </div>
          <h1 className="font-display text-[2rem] font-bold tracking-tight leading-[1.05] text-white sm:text-[2.75rem] lg:text-[3rem]">Pro workspace preview.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground font-medium">See the depth of lane drill-downs, district profiles, and export packs before you sign in.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/sign-in" className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[10px] font-bold uppercase tracking-[0.08em] text-white no-underline transition-all hover:bg-primary/95 shadow-[0_2px_10px_rgba(124,58,237,0.15)]">
              <ShieldCheck className="h-3 w-3" /> Sign in to unlock
            </Link>
            <Link to="/" className="flex h-9 items-center rounded-lg border border-white/5 bg-white/[0.02] px-4 text-[10px] font-bold text-white no-underline hover:bg-white/[0.04] transition-all">Browse public data</Link>
          </div>
        </div>
      </motion.section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 relative z-10">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            {/* Lane table */}
            <motion.div variants={itemVariants} className="relative rounded-xl border border-white/5 bg-white/[0.01] p-5 backdrop-blur-md">
              <LockedOverlay />
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 mb-4">Lane drill-downs</p>
              <div className="overflow-hidden rounded-lg border border-white/5">
                <table className="w-full text-[12px]">
                  <thead><tr className="bg-white/[0.02] text-white">
                    {["Vehicle", "Listings", "Median", "Top area"].map((h) => <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {LANES.map((l) => (
                      <tr key={l.name} className="border-t border-white/5">
                        <td className="px-4 py-2.5 font-bold text-white">{l.name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground num font-medium">{l.listings}</td>
                        <td className="px-4 py-2.5 text-primary num font-bold">{l.median}</td>
                        <td className="px-4 py-2.5 text-muted-foreground font-medium">{l.district}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Chart */}
            <motion.div variants={itemVariants} className="relative rounded-xl border border-white/5 bg-white/[0.01] p-5 backdrop-blur-md">
              <LockedOverlay />
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Source coverage</p>
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={CHART_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          <aside className="space-y-5">
            <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 backdrop-blur-md">
              <Sparkles className="mb-3 h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-bold text-white">What Pro adds</h2>
              <div className="mt-4 space-y-1.5">
                {["Lane drill-downs with live samples", "District opportunity profiles", "Trend studio with exportable history", "Data quality coverage", "PDF, Word, CSV, JSON exports"].map((i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <p className="text-[11px] text-muted-foreground font-semibold">{i}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-[13px] font-bold text-white">Report formats</h2>
              </div>
              <div className="space-y-1.5">
                {REPORTS.map((r) => (
                  <div key={r} className="flex h-9 items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 text-[11px] text-muted-foreground font-semibold hover:text-white transition-all">
                    <span>{r}</span><Download className="h-3 w-3 text-primary" />
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Link to="/sign-in" className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary text-[10px] font-bold uppercase tracking-[0.08em] text-white no-underline transition-all hover:bg-primary/95 shadow-[0_2px_10px_rgba(124,58,237,0.15)]">
                <MapPin className="h-3 w-3" /> Unlock Pro workspace
              </Link>
            </motion.div>
          </aside>
        </div>
      </div>
    </motion.div>
  );
}
