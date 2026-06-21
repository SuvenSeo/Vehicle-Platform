import { Link } from "react-router-dom";
import { ArrowRight, Battery, Car, CheckCircle2, PlugZap, ShieldCheck, Zap } from "lucide-react";
import { PlatformPageHero } from "@/components/PlatformPageHero";
import { PageCanvas } from "@/components/PageCanvas";

const evModules = [
  {
    icon: Battery,
    step: "01",
    title: "Battery health",
  },
  {
    icon: ShieldCheck,
    step: "02",
    title: "Duty & policy",
  },
  {
    icon: PlugZap,
    step: "03",
    title: "Charging fit",
  },
];

const readinessRows = [
  { label: "City commuter", value: "High", width: "86%" },
  { label: "Long-distance family car", value: "Medium", width: "58%" },
  { label: "Fleet delivery loop", value: "High", width: "78%" },
];

const ownershipChecks = [
  { label: "Battery reserve", value: "20-30%" },
  { label: "Home charging", value: "Priority" },
  { label: "Resale proof", value: "Records" },
];

const inventoryActions = [
  "Filter electric inventory",
  "Check finance baseline",
  "Compare resale pressure",
];

export default function EVHub() {
  return (
    <PageCanvas>
      <PlatformPageHero
        eyebrow="EV intelligence lane"
        title="EV buying signals."
        icon={Zap}
        metrics={[
          { label: "Primary checks", value: "3" },
          { label: "Inventory link", value: "EV" },
          { label: "Planning mode", value: "TCO" },
        ]}
      />

      <div className="layout-shell space-y-10 py-12 md:space-y-12 md:py-16">
        {/* ---- Decision lane: review modules ---------------------------------- */}
        <section aria-labelledby="ev-review-stack">
          <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="tech-label">Decision modules</p>
              <h2 id="ev-review-stack" className="headline-display mt-2 text-2xl sm:text-3xl">
                The EV review stack
              </h2>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-3">
            {evModules.map((module) => {
              const Icon = module.icon;
              return (
                <article
                  key={module.title}
                  className="data-card flex flex-col p-5 transition-colors hover:border-amber-400/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-background">
                      <Icon className="h-7 w-7 text-amber-400" aria-hidden="true" />
                    </div>
                    <span className="tech-label text-muted-foreground num">
                      {module.step}
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-semibold tracking-tight text-foreground">
                    {module.title}
                  </h3>
                </article>
              );
            })}
          </div>
        </section>

        {/* ---- Readiness matrix + inventory action --------------------------- */}
        <section
          aria-labelledby="ev-readiness-matrix"
          className="grid gap-4 lg:grid-cols-[1.35fr_1fr] lg:items-stretch"
        >
          <div className="data-card flex flex-col p-5 md:p-7">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="tech-label">Readiness matrix</p>
                <h2 id="ev-readiness-matrix" className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  Use-case fit by operating pattern
                </h2>
              </div>
              <span className="status-chip shrink-0">Operating fit</span>
            </header>

            <div className="mt-6 flex flex-1 flex-col justify-center gap-5">
              {readinessRows.map((row) => {
                const isHigh = row.value === "High";
                return (
                  <div key={row.label}>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{row.label}</span>
                      <span
                        className={`tech-label num ${
                          isHigh ? "text-emerald-400" : "text-muted-foreground"
                        }`}
                      >
                        {row.value}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full ${isHigh ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: row.width }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="data-card flex flex-col p-5 md:p-7" aria-labelledby="ev-market-action">
            <div className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-border bg-background">
              <Car className="h-6 w-6 text-foreground" aria-hidden="true" />
            </div>
            <p className="tech-label mt-6">Market action</p>
            <h2 id="ev-market-action" className="mt-2 text-xl font-semibold leading-snug tracking-tight text-foreground">
              Browse EV inventory
            </h2>

            <ul className="mb-6 mt-5 flex flex-wrap gap-2">
              {inventoryActions.map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs font-medium text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              to="/?fuel_type=electric#market"
              className="action-primary mt-auto h-11 w-full no-underline"
            >
              Browse electric inventory
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </aside>
        </section>

        {/* ---- Ownership checklist ------------------------------------------- */}
        <section aria-labelledby="ev-ownership-planning">
          <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="tech-label">Ownership planning</p>
              <h2 id="ev-ownership-planning" className="headline-display mt-2 text-2xl sm:text-3xl">
                Checks that keep the decision practical
              </h2>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-3">
            {ownershipChecks.map((item) => (
              <article key={item.label} className="data-card p-5">
                <p className="field-label">{item.label}</p>
                <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground num">{item.value}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </PageCanvas>
  );
}
