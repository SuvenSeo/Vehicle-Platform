import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Battery, Car, CheckCircle2, PlugZap, ShieldCheck } from "lucide-react";
import { getListings, formatPrice } from "@/services/api";
import { isReasonableListingPrice } from "@/lib/formatting";

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

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export default function EVHub() {
  const evQuery = useQuery({
    queryKey: ["listings", { fuel_type: "electric", sort: "newest", page: 1 }],
    queryFn: () => getListings({ fuel_type: "electric", sort: "newest", page: 1 }),
  });

  const evTotal = evQuery.data?.total ?? null;
  const sample = evQuery.data?.listings ?? [];
  const sampledPrices = sample
    .map((listing) => Number(listing.price_lkr || 0))
    .filter((price) => isReasonableListingPrice(price));
  const sampleMedian = median(sampledPrices);

  const liveStats = [
    {
      label: "Electric listings live",
      value: evQuery.isPending ? "…" : evTotal !== null ? evTotal.toLocaleString() : "N/A",
      note: "Priced EV inventory tracked right now",
    },
    {
      label: "Median of latest sample",
      value: evQuery.isPending ? "…" : sampleMedian !== null ? formatPrice(sampleMedian) : "N/A",
      note: `From the ${sampledPrices.length || 0} newest priced EV listings`,
    },
    {
      label: "Newest EV arrival",
      value: evQuery.isPending
        ? "…"
        : sample[0]
          ? `${sample[0].make} ${sample[0].model}`.trim() || "N/A"
          : "N/A",
      note: sample[0]?.district ? `Listed in ${sample[0].district}` : "Latest tracked electric listing",
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
