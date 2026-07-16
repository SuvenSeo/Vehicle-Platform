import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getMakes, getModels, getPriceTrendSeries, getHybridBands, formatPrice } from "@/services/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SRI_LANKA_DISTRICTS } from "@/data/districts";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { ImportEraPublicSection } from "@/components/ImportEraPublicSection";
import { RotateCcw, Zap } from "lucide-react";
import type { HybridBandsData, PriceTrendPoint } from "@/types/car";
import {
  getExciseRatePerCc,
  getHybridExciseCliffInsight,
  HYBRID_EXCISE_CLIFF_CC,
} from "@/lib/importTaxModel";

// Pre-compute per-band excise rates from importTaxModel (pure, no async).
const HYBRID_BAND_EXCISE = {
  low: getExciseRatePerCc("hybrid", HYBRID_EXCISE_CLIFF_CC),          // ≤1500 cc
  midLow: getExciseRatePerCc("hybrid", HYBRID_EXCISE_CLIFF_CC + 1),   // just above cliff
  midHigh: getExciseRatePerCc("hybrid", 2000),                         // 2000 cc
  highLow: getExciseRatePerCc("hybrid", 2001),                         // just over 2000
  highHigh: getExciseRatePerCc("hybrid", 3000),                        // 3000 cc
} as const;

function exciseLabelFor(ccMax: number | null): string {
  if (ccMax === null) return `Rs. ${HYBRID_BAND_EXCISE.highLow.toLocaleString()}–${HYBRID_BAND_EXCISE.highHigh.toLocaleString()}/cc`;
  if (ccMax <= HYBRID_EXCISE_CLIFF_CC) return `Rs. ${HYBRID_BAND_EXCISE.low.toLocaleString()}/cc`;
  return `Rs. ${HYBRID_BAND_EXCISE.midLow.toLocaleString()}–${HYBRID_BAND_EXCISE.midHigh.toLocaleString()}/cc`;
}

/** Band colour from low to high tax burden. */
function bandColor(index: number): { bar: string; badge: string; text: string } {
  const palette = [
    { bar: "bg-emerald-500", badge: "bg-emerald-500/10 border-emerald-500/25", text: "text-emerald-400" },
    { bar: "bg-amber-500",   badge: "bg-amber-500/10 border-amber-500/25",     text: "text-amber-400"   },
    { bar: "bg-rose-500",    badge: "bg-rose-500/10 border-rose-500/25",        text: "text-rose-400"    },
  ];
  return palette[Math.min(index, palette.length - 1)];
}

export default function Trends() {
  const [makes, setMakes] = useState<{ make: string; count: number }[]>([]);
  const [modelsList, setModelsList] = useState<{ model: string; count: number }[]>([]);
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [condition, setCondition] = useState("all");
  const [district, setDistrict] = useState("all");
  const [trendData, setTrendData] = useState<PriceTrendPoint[]>([]);
  const [coverageNote, setCoverageNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hybridBands, setHybridBands] = useState<HybridBandsData | null>(null);
  const [hybridLoading, setHybridLoading] = useState(false);
  const [hybridError, setHybridError] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    getMakes().then((items) => { if (!c) { setMakes(items); setSelectedMake((cur) => cur || items[0]?.make || ""); } }).catch(() => { if (!c) setMakes([]); });
    return () => { c = true; };
  }, []);

  useEffect(() => {
    if (!selectedMake) { setModelsList([]); setSelectedModel(""); return; }
    let c = false;
    setModelsList([]); setSelectedModel("");
    getModels(selectedMake).then((items) => { if (!c) { setModelsList(items); setSelectedModel((cur) => cur || items[0]?.model || ""); } }).catch(() => { if (!c) setModelsList([]); });
    return () => { c = true; };
  }, [selectedMake]);

  useEffect(() => {
    if (!selectedMake || !selectedModel) { setTrendData([]); setCoverageNote(null); return; }
    let c = false;
    setLoading(true); setError(null);
    getPriceTrendSeries(selectedMake, selectedModel, condition !== "all" ? condition : undefined, district !== "all" ? district : undefined)
      .then((s) => { if (!c) { setTrendData(s.points); setCoverageNote(s.coverage_note); } })
      .catch(() => { if (!c) { setTrendData([]); setCoverageNote("Trend data temporarily unavailable."); setError("Unable to load trend data."); } })
      .finally(() => { if (!c) setLoading(false); });
    return () => { c = true; };
  }, [selectedMake, selectedModel, condition, district]);

  useEffect(() => {
    let c = false;
    setHybridLoading(true);
    setHybridError(null);
    getHybridBands()
      .then((data) => { if (!c) setHybridBands(data); })
      .catch(() => { if (!c) setHybridError("Hybrid band data temporarily unavailable."); })
      .finally(() => { if (!c) setHybridLoading(false); });
    return () => { c = true; };
  }, []);

  const chartTitle = selectedMake && selectedModel ? `${selectedMake} ${selectedModel}` : "Select a lane";
  const emptyMessage = !selectedMake || !selectedModel ? "Select make and model to load price history." : error || "No trend data for this combination yet.";
  const hasNarrow = district !== "all" || condition !== "all";

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
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

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[30%] left-[-10%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[110px] pointer-events-none" />

      <motion.section variants={itemVariants} className="border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-md relative z-10">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Trend studio</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-tight leading-[1.05] text-white sm:text-[2.75rem] lg:text-[3rem]">Price trends.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground font-medium">Track median price movement for any vehicle lane across Sri Lanka.</p>
        </div>
      </motion.section>

      <div className="mx-auto max-w-[1320px] space-y-6 px-5 py-8 sm:px-6 lg:py-10 relative z-10">
        {/* Controls */}
        <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.02] p-5 sm:p-6 backdrop-blur-md">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label htmlFor="t-make" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">Make</label>
              <Select value={selectedMake} onValueChange={setSelectedMake}>
                <SelectTrigger id="t-make" className="h-10 rounded-lg border-white/5 bg-white/[0.02] text-sm text-white focus:ring-1 focus:ring-primary/30"><SelectValue placeholder="Select make" /></SelectTrigger>
                <SelectContent className="border-white/5 bg-[#0e0e11] text-white">
                  {makes.map((m) => <SelectItem key={m.make} value={m.make}>{m.make}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="t-model" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">Model</label>
              <Select value={selectedModel} onValueChange={setSelectedModel} disabled={!selectedMake || !modelsList.length}>
                <SelectTrigger id="t-model" className="h-10 rounded-lg border-white/5 bg-white/[0.02] text-sm text-white focus:ring-1 focus:ring-primary/30 disabled:opacity-50"><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent className="border-white/5 bg-[#0e0e11] text-white">
                  {modelsList.map((m) => <SelectItem key={m.model} value={m.model}>{m.model}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="t-cond" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">Condition</label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger id="t-cond" className="h-10 rounded-lg border-white/5 bg-white/[0.02] text-sm text-white focus:ring-1 focus:ring-primary/30"><SelectValue /></SelectTrigger>
                <SelectContent className="border-white/5 bg-[#0e0e11] text-white">
                  <SelectItem value="all">Any</SelectItem><SelectItem value="used">Used</SelectItem>
                  <SelectItem value="reconditioned">Reconditioned</SelectItem><SelectItem value="brand_new">Brand new</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="t-dist" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">District</label>
              <Select value={district} onValueChange={setDistrict}>
                <SelectTrigger id="t-dist" className="h-10 rounded-lg border-white/5 bg-white/[0.02] text-sm text-white focus:ring-1 focus:ring-primary/30"><SelectValue /></SelectTrigger>
                <SelectContent className="border-white/5 bg-[#0e0e11] text-white">
                  <SelectItem value="all">All districts</SelectItem>
                  {SRI_LANKA_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Lane:</span>
            {[
              { id: "make", label: selectedMake || "—" },
              { id: "model", label: selectedModel || "—" },
              { id: "condition", label: condition === "all" ? "Any" : condition },
              { id: "district", label: district === "all" ? "All LK" : district },
            ].map((chip) => (
              <span key={chip.id} className="rounded-md border border-white/5 bg-white/[0.01] px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">{chip.label}</span>
            ))}
            {hasNarrow && (
              <button type="button" onClick={() => { setDistrict("all"); setCondition("all"); }}
                className="ml-auto flex items-center gap-1 text-[10px] font-bold text-muted-foreground transition-colors hover:text-foreground"
              ><RotateCcw className="h-3 w-3" /> Reset filters</button>
            )}
          </div>
        </motion.div>

        {/* Chart */}
        <motion.div variants={itemVariants} className="min-h-[480px] rounded-xl border border-white/5 bg-white/[0.01] p-4 backdrop-blur-md">
          <PriceHistoryChart title={chartTitle} points={trendData} isLoading={loading} coverageNote={coverageNote} emptyMessage={emptyMessage} emptyActionLabel={hasNarrow ? "Broaden filters" : undefined} onEmptyAction={hasNarrow ? () => { setDistrict("all"); setCondition("all"); } : undefined} />
        </motion.div>

        <motion.div variants={itemVariants} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 backdrop-blur-sm">
          <p className="text-[11px] text-muted-foreground font-medium">
            {selectedMake && selectedModel ? "Median advertised prices grouped by month from the public Sri Lanka snapshot." : "Choose a make and model to render the trajectory."}
          </p>
          <span className="text-[10px] font-semibold text-primary/70 num">Public data</span>
        </motion.div>

        {/* ── HYBRID TAX ARBITRAGE ──────────────────────────────── */}
        <motion.div variants={itemVariants}>
          <HybridTaxArbitrageSection
            data={hybridBands}
            loading={hybridLoading}
            error={hybridError}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <ImportEraPublicSection />
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Hybrid Tax Arbitrage Section ─────────────────────────────────────────────

interface HybridTaxArbitrageSectionProps {
  data: HybridBandsData | null;
  loading: boolean;
  error: string | null;
}

function HybridTaxArbitrageSection({ data, loading, error }: HybridTaxArbitrageSectionProps) {
  const cliffInsight = getHybridExciseCliffInsight();

  const bands = data?.bands ?? [];
  const maxMedian = Math.max(...bands.map((b) => b.median_price_lkr ?? 0), 1);

  return (
    <section
      aria-labelledby="hybrid-tax-heading"
      className="rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/70">
            Import tax intelligence
          </p>
          <h2
            id="hybrid-tax-heading"
            className="mt-1.5 font-display text-[1.125rem] font-bold tracking-tight text-foreground sm:text-[1.25rem]"
          >
            Hybrid tax arbitrage bands
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Median market prices vs excise duty across three engine-cc bands.
            The 1,500 cc cliff creates a pricing discontinuity worth exploiting.
          </p>
        </div>
      </div>

      {loading && (
        <div
          aria-busy="true"
          aria-label="Loading hybrid band data"
          className="space-y-3"
        >
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-foreground/[0.04]" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center">
          <p className="text-[12px] text-muted-foreground">{error}</p>
          <p className="mt-1 text-[11px] text-muted-foreground/60">
            Excise cliff insight is still available below from the static tax model.
          </p>
        </div>
      )}

      {!loading && !error && bands.length === 0 && (
        <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center">
          <p className="text-[12px] text-muted-foreground">No hybrid band data available yet.</p>
        </div>
      )}

      {!loading && !error && bands.length > 0 && (
        <div className="space-y-4" role="list" aria-label="Hybrid engine bands">
          {bands.map((band, idx) => {
            const colors = bandColor(idx);
            const barPct = band.median_price_lkr
              ? Math.round((band.median_price_lkr / maxMedian) * 100)
              : 0;
            const isCliffBand = band.cc_max !== null && band.cc_max <= HYBRID_EXCISE_CLIFF_CC;

            return (
              <div
                key={band.label}
                role="listitem"
                aria-label={`${band.label} hybrid band`}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${colors.badge} ${colors.text}`}>
                      {band.label}
                    </span>
                    {isCliffBand && (
                      <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-400">
                        Tax cliff ↓
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-[11px] text-muted-foreground num">
                      {band.count.toLocaleString()} listings
                    </span>
                    {band.median_price_lkr !== null && (
                      <span className="text-[13px] font-bold text-foreground num">
                        {formatPrice(band.median_price_lkr)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bar */}
                <div className="mb-2.5 h-3 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                  <div
                    role="img"
                    aria-label={`${band.label} median price bar ${barPct}%`}
                    className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>

                {/* Excise note */}
                <p className="text-[11px] text-muted-foreground">
                  Excise duty:{" "}
                  <span className={`font-semibold ${colors.text}`}>
                    {exciseLabelFor(band.cc_max)}
                  </span>
                  {isCliffBand && (
                    <span className="ml-2 text-emerald-400/80">
                      · lowest hybrid rate
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Cliff insight card ── */}
      <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
        <div className="mb-2 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" aria-hidden />
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-400">
            1,500 cc excise cliff
          </p>
        </div>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          At exactly{" "}
          <span className="font-semibold text-foreground num">
            {cliffInsight.cliffCc.toLocaleString()} cc
          </span>{" "}
          the hybrid excise rate jumps from{" "}
          <span className="font-semibold text-foreground num">
            Rs. {cliffInsight.rateAtOrBelowCliff.toLocaleString()}/cc
          </span>{" "}
          to{" "}
          <span className="font-semibold text-foreground num">
            Rs. {cliffInsight.rateAboveCliff.toLocaleString()}/cc
          </span>
          , adding{" "}
          <span className="font-semibold text-amber-300 num">
            Rs. {cliffInsight.exciseStepUp.toLocaleString()}
          </span>{" "}
          in excise duty crossing one cc. Buyers sourcing ≤ 1,500 cc hybrids
          also save{" "}
          <span className="font-semibold text-emerald-300 num">
            Rs. {cliffInsight.exciseSavingVsPetrolAtCliff.toLocaleString()}
          </span>{" "}
          in excise versus the equivalent petrol band at this capacity.
        </p>
        <p className="mt-2 text-[10px] font-medium text-muted-foreground/60">
          Rates from the indicative 2025–2026 Sri Lanka excise schedule ·{" "}
          verify against the latest gazette before transacting.
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Median prices from live market snapshot · excise rates from the 2025–2026 import tax model.
        </p>
        <span className="text-[10px] font-semibold text-amber-400/60 num">Tax model</span>
      </div>
    </section>
  );
}
