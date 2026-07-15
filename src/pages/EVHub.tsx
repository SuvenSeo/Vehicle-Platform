import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Battery,
  Car,
  CheckCircle2,
  PlugZap,
  ShieldCheck,
  TrendingDown,
  Zap,
} from "lucide-react";
import { getEvInsight, formatPrice } from "@/services/api";

const evModules = [
  { icon: Battery, step: "01", title: "Battery health", desc: "Degradation patterns, SoH benchmarks, and what to inspect before buying." },
  { icon: ShieldCheck, step: "02", title: "Duty & policy", desc: "Sri Lanka EV import duty rates, exemptions, and policy outlook." },
  { icon: PlugZap, step: "03", title: "Charging fit", desc: "Home vs public charging, range per use case, and cost comparison." },
];

const ownershipChecks = [
  { label: "Battery reserve", value: "20-30%", note: "Guideline: keep this much SoH headroom when buying used" },
  { label: "Home charging", value: "Priority", note: "Guideline: overnight charging beats public-charger dependence" },
  { label: "Resale proof", value: "Records", note: "Guideline: battery reports protect resale value" },
];

const TCO_FUEL_COST_PER_KM_PETROL_LKR = 28;
const TCO_FUEL_COST_PER_KM_EV_LKR = 6;
const TCO_KM_PER_YEAR = 20_000;

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

export default function EVHub() {
  const insightQuery = useQuery({
    queryKey: ["ev-insight"],
    queryFn: getEvInsight,
    staleTime: 5 * 60 * 1000,
  });

  const insight = insightQuery.data;
  const pending = insightQuery.isPending;

  const evCount = insight?.ev_count ?? null;
  const evPct = insight?.ev_pct ?? null;
  const medianEvPrice = insight?.median_ev_price_lkr ?? null;
  const topModels = insight?.top_ev_models ?? [];
  const benchmark = insight?.hybrid_benchmark ?? null;

  const annualFuelSavingLkr = (TCO_FUEL_COST_PER_KM_PETROL_LKR - TCO_FUEL_COST_PER_KM_EV_LKR) * TCO_KM_PER_YEAR;
  const evPremiumLkr =
    medianEvPrice !== null && benchmark?.median_price_lkr
      ? medianEvPrice - benchmark.median_price_lkr
      : null;
  const paybackYears =
    evPremiumLkr !== null && annualFuelSavingLkr > 0
      ? Math.ceil(evPremiumLkr / annualFuelSavingLkr)
      : null;

  const liveStats = [
    {
      label: "Electric listings live",
      value: pending ? "…" : evCount !== null ? evCount.toLocaleString() : "N/A",
      note: "Active EV inventory tracked across all sources",
    },
    {
      label: "EV market share",
      value: pending ? "…" : evPct !== null ? `${evPct.toFixed(1)}%` : "N/A",
      note: "Share of all tracked listings that are electric",
    },
    {
      label: "Median EV price",
      value: pending ? "…" : medianEvPrice !== null ? formatPrice(medianEvPrice) : "N/A",
      note: "Median price across all priced EV listings",
    },
  ];

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

      {/* Header */}
      <motion.section variants={itemVariants} className="border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-md relative z-10">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">EV intelligence</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-tight leading-[1.05] text-white sm:text-[2.75rem] lg:text-[3rem]">EV buying signals.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground font-medium">Battery health, charging fit, and duty signals for the Sri Lankan EV market.</p>
        </div>
      </motion.section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 space-y-10 relative z-10">
        {/* Live inventory pulse */}
        <motion.div variants={itemVariants}>
          <h2 className="mb-5 font-display text-sm font-bold tracking-tight text-white">Live EV inventory</h2>
          <div className="grid gap-2 md:grid-cols-3">
            {liveStats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 backdrop-blur-md hover:border-primary/20 transition-all">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">{stat.label}</p>
                <p className="num mt-2 text-xl font-bold text-white">{stat.value}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground font-medium">{stat.note}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Top EV models */}
        {(pending || topModels.length > 0) && (
          <motion.div variants={itemVariants}>
            <h2 className="mb-5 font-display text-sm font-bold tracking-tight text-white">Top EV models</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {pending
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 animate-pulse">
                      <div className="h-3 w-2/3 rounded bg-white/[0.04] mb-3" />
                      <div className="h-5 w-1/2 rounded bg-white/[0.04]" />
                    </div>
                  ))
                : topModels.map((m) => (
                    <div key={`${m.make}-${m.model}`} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 backdrop-blur-md hover:border-primary/25 hover:bg-white/[0.02] transition-all">
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/5 bg-white/[0.02]">
                          <Zap className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <p className="text-[12px] font-bold text-white leading-tight">{m.make} {m.model}</p>
                      </div>
                      <p className="num text-base font-bold text-white">
                        {m.median_price_lkr !== null ? formatPrice(m.median_price_lkr) : "—"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground font-medium">{m.listing_count} listing{m.listing_count !== 1 ? "s" : ""} · median</p>
                    </div>
                  ))}
            </div>
          </motion.div>
        )}

        {/* TCO comparison callout */}
        <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <TrendingDown className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">TCO comparison</p>
              <h3 className="mt-1 text-[14px] font-bold text-white">EV vs. Toyota Aqua hybrid — real running cost</h3>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground font-medium">
                Fuel saving estimated at <span className="font-bold text-white">Rs.{annualFuelSavingLkr.toLocaleString()}/yr</span> (LKR {TCO_FUEL_COST_PER_KM_EV_LKR} vs LKR {TCO_FUEL_COST_PER_KM_PETROL_LKR} per km, {(TCO_KM_PER_YEAR / 1000).toFixed(0)}k km/yr).
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-white/5 bg-white/[0.01] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Median EV price</p>
                  <p className="num mt-1.5 text-base font-bold text-white">
                    {pending ? "…" : medianEvPrice !== null ? formatPrice(medianEvPrice) : "N/A"}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.01] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Toyota Aqua benchmark</p>
                  <p className="num mt-1.5 text-base font-bold text-white">
                    {pending ? "…" : benchmark?.median_price_lkr != null ? formatPrice(benchmark.median_price_lkr) : "N/A"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground font-medium">
                    {benchmark?.listing_count ? `${benchmark.listing_count} listings` : "hybrid benchmark"}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.01] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Fuel savings payback</p>
                  <p className="num mt-1.5 text-base font-bold text-white">
                    {pending
                      ? "…"
                      : paybackYears !== null
                        ? `~${paybackYears} yr${paybackYears !== 1 ? "s" : ""}`
                        : "N/A"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground font-medium">to recover EV price premium</p>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground/60 font-medium">
                Indicative only. Actual savings vary by charging cost, mileage, and model.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Decision modules */}
        <motion.div variants={itemVariants}>
          <h2 className="mb-5 font-display text-sm font-bold tracking-tight text-white">Decision modules</h2>
          <div className="grid gap-2 md:grid-cols-3">
            {evModules.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.title} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 transition-all hover:border-primary/20 hover:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-[10px] font-bold text-primary num">{m.step}</span>
                  </div>
                  <h3 className="mt-4 text-[14px] font-bold text-white">{m.title}</h3>
                  <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed font-medium">{m.desc}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Market action */}
        <motion.div variants={itemVariants} className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Ownership checks</p>
            <h3 className="mt-1.5 text-[14px] font-bold text-white">Buyer guidelines</h3>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              {ownershipChecks.map((c) => (
                <div key={c.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">{c.label}</p>
                  <p className="mt-2 text-xl font-bold text-white num">{c.value}</p>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground font-medium">{c.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
              <Car className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Market action</p>
            <h3 className="mt-1.5 text-base font-bold text-white">Browse EV inventory</h3>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {["Filter electric inventory", "Check finance baseline", "Compare resale pressure"].map((a) => (
                <li key={a} className="flex items-center gap-1.5 rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1 text-[10px] font-bold text-muted-foreground hover:text-white transition-all">
                  <CheckCircle2 className="h-3 w-3 text-primary" /> {a}
                </li>
              ))}
            </ul>
            <Link to="/?fuel_type=electric#market" className="mt-6 flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-[10px] font-bold uppercase tracking-[0.1em] text-white no-underline transition-all hover:bg-primary/95 shadow-[0_4px_12px_rgba(124,58,237,0.15)]">
              Browse electric inventory <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
