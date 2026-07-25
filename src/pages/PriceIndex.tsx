import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight, LineChart, Info } from "lucide-react";
import { getPriceIndex } from "@/services/api";
import type { PriceIndex, PriceIndexPoint } from "@/types/car";
import { useAppPreferences } from "@/lib/appPreferences";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 220, damping: 24 } },
} as const;

function formatPeriod(period: string): string {
  const [y, m] = period.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : period;
}

function formatPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export default function PriceIndexPage() {
  const { t } = useAppPreferences();
  const [data, setData] = useState<PriceIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeSegment, setActiveSegment] = useState<string>("overall");

  useEffect(() => {
    let cancelled = false;
    document.title = "SL Used Vehicle Price Index — Motormila";
    getPriceIndex()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const segmentKeys = useMemo(() => ["overall", ...Object.keys(data?.segments || {})], [data]);
  const activePoints: PriceIndexPoint[] = useMemo(() => {
    if (!data) return [];
    return activeSegment === "overall" ? data.points : data.segments[activeSegment] || [];
  }, [data, activeSegment]);

  const chartData = activePoints.map((p) => ({ ...p, label: formatPeriod(p.period) }));
  const latest = activePoints[activePoints.length - 1];
  const first = activePoints[0];
  const totalChange = latest && first && first.index_value > 0
    ? ((latest.index_value - first.index_value) / first.index_value) * 100
    : null;
  const up = (totalChange ?? 0) >= 0;

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="min-h-screen relative overflow-hidden bg-background">
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.section variants={itemVariants} className="border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-md relative z-10">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-bright">{t("index.eyebrow", "Market benchmark")}</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-tight leading-[1.05] text-white sm:text-[2.75rem] lg:text-[3rem]">
            {t("index.title", "SL Used Vehicle Price Index.")}
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground font-medium">
            {t("index.description", "One number for the whole used-car market, mix-adjusted so it tracks real price movement — not whichever cars happened to be for sale that month.")}
          </p>
        </div>
      </motion.section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 space-y-6 relative z-10">
        {loading ? (
          <div className="h-[420px] rounded-xl border border-white/5 bg-white/[0.01] animate-pulse" />
        ) : error || !data || activePoints.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 py-16 text-center">
            <LineChart className="h-5 w-5 text-muted-foreground" />
            <p className="max-w-md text-[13px] text-muted-foreground font-medium">
              {t("index.empty", "The index needs a few months of accumulated market aggregates before it can plot a like-for-like trend. It will populate as daily scans build history.")}
            </p>
          </div>
        ) : (
          <>
            {/* Headline stats */}
            <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{t("index.current", "Current index")}</p>
                <p className="num mt-2 text-3xl font-bold text-white">{latest?.index_value.toFixed(1)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                  {t("index.baseEquals100", "base {period} = 100", { period: data.base_period ? formatPeriod(data.base_period) : "—" })}
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{t("index.sinceBase", "Since base")}</p>
                <p className={`num mt-2 flex items-center gap-1.5 text-3xl font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
                  {up ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownRight className="h-6 w-6" />}
                  {formatPct(totalChange)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground font-medium">{t("index.wholeWindow", "whole tracked window")}</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{t("index.mom", "Month-on-month")}</p>
                <p className="num mt-2 text-3xl font-bold text-white">{formatPct(latest?.mom_change_pct ?? null)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                  latest: {latest ? formatPeriod(latest.period) : "—"}
                </p>
              </div>
            </motion.div>

            {/* Segment switcher */}
            {segmentKeys.length > 1 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("index.segmentAria", "Index segment")}>
                {segmentKeys.map((seg) => (
                  <button
                    key={seg}
                    type="button"
                    onClick={() => setActiveSegment(seg)}
                    aria-pressed={activeSegment === seg}
                    className={`rounded-lg border px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-all ${
                      activeSegment === seg
                        ? "border-primary/30 bg-primary/10 text-primary-bright"
                        : "border-white/5 bg-white/[0.01] text-muted-foreground hover:text-white"
                    }`}
                  >
                    {seg === "overall" ? t("index.allVehicles", "All vehicles") : seg}
                  </button>
                ))}
              </div>
            )}

            {/* Chart */}
            <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 backdrop-blur-md">
              <div
                role="img"
                aria-label={`${activeSegment === "overall" ? "Overall" : activeSegment} price index: ${chartData.length} months, currently ${latest?.index_value.toFixed(1)} (${formatPct(totalChange)} since base)`}
                className="h-[360px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 18, right: 12, left: -8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="idxFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(250 89% 65%)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(250 89% 65%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={44} />
                    <Tooltip
                      contentStyle={{ background: "#0e0e11", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: "#fff", fontWeight: 700 }}
                      formatter={(value: number, _name, entry) => {
                        const mom = (entry?.payload as PriceIndexPoint | undefined)?.mom_change_pct;
                        return [`${value.toFixed(1)}  (${formatPct(mom ?? null)} MoM)`, "Index"];
                      }}
                    />
                    <Area type="monotone" dataKey="index_value" stroke="hsl(250 89% 78%)" strokeWidth={2} fill="url(#idxFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Methodology */}
            <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-5">
              <div className="flex items-start gap-2.5">
                <Info className="h-4 w-4 text-primary-bright shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-[13px] font-bold text-white">{t("index.methodology", "Methodology")}</h2>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground font-medium">{data.methodology}</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}
