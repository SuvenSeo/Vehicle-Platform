import { Link } from "react-router-dom";
import { ArrowRight, Battery, Car, CheckCircle2, PlugZap, ShieldCheck } from "lucide-react";

const evModules = [
  { icon: Battery, step: "01", title: "Battery health", desc: "Degradation patterns, SoH benchmarks, and what to inspect before buying." },
  { icon: ShieldCheck, step: "02", title: "Duty & policy", desc: "Sri Lanka EV import duty rates, exemptions, and policy outlook." },
  { icon: PlugZap, step: "03", title: "Charging fit", desc: "Home vs public charging, range per use case, and cost comparison." },
];

const readinessRows = [
  { label: "City commuter", value: "High", width: "86%" },
  { label: "Long-distance family", value: "Medium", width: "58%" },
  { label: "Fleet delivery loop", value: "High", width: "78%" },
];

const ownershipChecks = [
  { label: "Battery reserve", value: "20-30%" },
  { label: "Home charging", value: "Priority" },
  { label: "Resale proof", value: "Records" },
];

export default function EVHub() {
  return (
    <div className="min-h-screen">
      <section className="border-b border-white/[0.04]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/70">EV intelligence</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-[-0.035em] leading-[1.02] text-foreground sm:text-[2.75rem] lg:text-[3rem]">EV buying signals.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-zinc-400">Battery health, charging fit, and duty signals for the Sri Lankan EV market.</p>
        </div>
      </section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 space-y-10">
        {/* Decision modules */}
        <div>
          <h2 className="mb-5 font-display text-sm font-semibold tracking-tight text-foreground">Decision modules</h2>
          <div className="grid gap-2 md:grid-cols-3">
            {evModules.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.title} className="rounded-xl border border-white/[0.04] bg-[hsl(220,8%,5.5%)] p-5 transition-colors hover:border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
                      <Icon className="h-4 w-4 text-amber-400/70" />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-600 num">{m.step}</span>
                  </div>
                  <h3 className="mt-4 text-[14px] font-semibold text-foreground">{m.title}</h3>
                  <p className="mt-1.5 text-[11px] text-zinc-500 leading-relaxed">{m.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Readiness + Action */}
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl border border-white/[0.04] bg-[hsl(220,8%,5.5%)] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Readiness matrix</p>
            <h3 className="mt-1.5 text-[14px] font-semibold text-foreground">Use-case fit</h3>
            <div className="mt-6 space-y-5">
              {readinessRows.map((r) => (
                <div key={r.label}>
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="font-medium text-zinc-300">{r.label}</span>
                    <span className={`font-bold num ${r.value === "High" ? "text-emerald-400" : "text-amber-400"}`}>{r.value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800/50">
                    <div className={`h-full rounded-full ${r.value === "High" ? "bg-emerald-500/60" : "bg-amber-500/60"}`} style={{ width: r.width }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-white/[0.04] bg-[hsl(220,8%,5.5%)] p-5 sm:p-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <Car className="h-4 w-4 text-zinc-400" />
            </div>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Market action</p>
            <h3 className="mt-1.5 text-base font-semibold text-foreground">Browse EV inventory</h3>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {["Filter electric inventory", "Check finance baseline", "Compare resale pressure"].map((a) => (
                <li key={a} className="flex items-center gap-1.5 rounded-md border border-white/[0.05] px-2 py-1 text-[10px] font-medium text-zinc-400">
                  <CheckCircle2 className="h-3 w-3 text-amber-400/60" /> {a}
                </li>
              ))}
            </ul>
            <Link to="/?fuel_type=electric#market" className="mt-auto flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--gold)] text-[10px] font-bold uppercase tracking-[0.1em] text-black no-underline transition-colors hover:bg-[var(--gold-bright)]">
              Browse electric inventory <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Ownership checks */}
        <div>
          <h2 className="mb-4 font-display text-sm font-semibold tracking-tight text-foreground">Ownership checks</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {ownershipChecks.map((c) => (
              <div key={c.label} className="rounded-xl border border-white/[0.04] bg-[hsl(220,8%,5.5%)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">{c.label}</p>
                <p className="mt-2 text-xl font-bold text-foreground num">{c.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
