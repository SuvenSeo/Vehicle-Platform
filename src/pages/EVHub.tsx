import { Link } from "react-router-dom";
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
    <div className="min-h-screen">
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/70">EV intelligence</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-[-0.035em] leading-[1.02] text-foreground sm:text-[2.75rem] lg:text-[3rem]">EV buying signals.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">Battery health, charging fit, and duty signals for the Sri Lankan EV market.</p>
        </div>
      </section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 space-y-10">
        {/* Live inventory pulse */}
        <div>
          <h2 className="mb-5 font-display text-sm font-semibold tracking-tight text-foreground">Live EV inventory</h2>
          <div className="grid gap-2 md:grid-cols-3">
            {liveStats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-surface p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{stat.label}</p>
                <p className="num mt-2 text-xl font-bold text-foreground">{stat.value}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{stat.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top EV models */}
        {(pending || topModels.length > 0) && (
          <div>
            <h2 className="mb-5 font-display text-sm font-semibold tracking-tight text-foreground">Top EV models</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {pending
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border bg-surface p-5 animate-pulse">
                      <div className="h-3 w-2/3 rounded bg-muted-foreground/10 mb-3" />
                      <div className="h-5 w-1/2 rounded bg-muted-foreground/10" />
                    </div>
                  ))
                : topModels.map((m) => (
                    <div key={`${m.make}-${m.model}`} className="rounded-xl border border-border bg-surface p-5">
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-foreground/[0.03]">
                          <Zap className="h-3.5 w-3.5 text-[var(--gold)]/70" />
                        </div>
                        <p className="text-[12px] font-semibold text-foreground leading-tight">{m.make} {m.model}</p>
                      </div>
                      <p className="num text-base font-bold text-foreground">
                        {m.median_price_lkr !== null ? formatPrice(m.median_price_lkr) : "—"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{m.listing_count} listing{m.listing_count !== 1 ? "s" : ""} · median</p>
                    </div>
                  ))}
            </div>
          </div>
        )}

        {/* TCO comparison callout */}
        <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/[0.04] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--gold)]/30 bg-[var(--gold)]/[0.08]">
              <TrendingDown className="h-4 w-4 text-[var(--gold)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gold)]/80">TCO comparison</p>
              <h3 className="mt-1 text-[14px] font-semibold text-foreground">EV vs. Toyota Aqua hybrid — real running cost</h3>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                Fuel saving estimated at <span className="font-semibold text-foreground">Rs.{annualFuelSavingLkr.toLocaleString()}/yr</span> (LKR {TCO_FUEL_COST_PER_KM_EV_LKR} vs LKR {TCO_FUEL_COST_PER_KM_PETROL_LKR} per km, {(TCO_KM_PER_YEAR / 1000).toFixed(0)}k km/yr).
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Median EV price</p>
                  <p className="num mt-1.5 text-base font-bold text-foreground">
                    {pending ? "…" : medianEvPrice !== null ? formatPrice(medianEvPrice) : "N/A"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Toyota Aqua benchmark</p>
                  <p className="num mt-1.5 text-base font-bold text-foreground">
                    {pending ? "…" : benchmark?.median_price_lkr != null ? formatPrice(benchmark.median_price_lkr) : "N/A"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {benchmark?.listing_count ? `${benchmark.listing_count} listings` : "hybrid benchmark"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Fuel savings payback</p>
                  <p className="num mt-1.5 text-base font-bold text-foreground">
                    {pending
                      ? "…"
                      : paybackYears !== null
                        ? `~${paybackYears} yr${paybackYears !== 1 ? "s" : ""}`
                        : "N/A"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">to recover EV price premium</p>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground/60">
                Indicative only. Actual savings vary by charging cost, mileage, and model.
              </p>
            </div>
          </div>
        </div>

        {/* Decision modules */}
        <div>
          <h2 className="mb-5 font-display text-sm font-semibold tracking-tight text-foreground">Decision modules</h2>
          <div className="grid gap-2 md:grid-cols-3">
            {evModules.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.title} className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-foreground/[0.03]">
                      <Icon className="h-4 w-4 text-primary/70" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground num">{m.step}</span>
                  </div>
                  <h3 className="mt-4 text-[14px] font-semibold text-foreground">{m.title}</h3>
                  <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Market action */}
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ownership checks</p>
            <h3 className="mt-1.5 text-[14px] font-semibold text-foreground">Buyer guidelines</h3>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              {ownershipChecks.map((c) => (
                <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{c.label}</p>
                  <p className="mt-2 text-xl font-bold text-foreground num">{c.value}</p>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">{c.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-foreground/[0.03]">
              <Car className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Market action</p>
            <h3 className="mt-1.5 text-base font-semibold text-foreground">Browse EV inventory</h3>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {["Filter electric inventory", "Check finance baseline", "Compare resale pressure"].map((a) => (
                <li key={a} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-primary/60" /> {a}
                </li>
              ))}
            </ul>
            <Link to="/?fuel_type=electric#market" className="mt-auto flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--gold)] text-[10px] font-bold uppercase tracking-[0.1em] text-white no-underline transition-colors hover:bg-[var(--gold-bright)]">
              Browse electric inventory <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
