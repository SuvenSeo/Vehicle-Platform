import { useState } from "react";
import { formatPrice } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Calculator as CalcIcon, Banknote, Gauge, ShieldCheck, WalletCards } from "lucide-react";
import { LeaseCalculator } from "@/components/LeaseCalculator";
import { TaxBreakdown } from "@/components/TaxBreakdown";
import { PlatformPageHero } from "@/components/PlatformPageHero";
import { PageCanvas } from "@/components/PageCanvas";

export default function Calculator() {
  const [price, setPrice] = useState<number>(15000000);
  const [engineCapacity, setEngineCapacity] = useState<number>(1500);
  const dutyRisk = engineCapacity > 2000 ? "High" : engineCapacity > 1500 ? "Medium" : "Low";
  const monthlyPlanningBaseline = Math.round(price * 0.018 / 1000) * 1000;

  const dutyTone =
    dutyRisk === "High"
      ? "text-rose-400"
      : dutyRisk === "Medium"
        ? "text-amber-400"
        : "text-emerald-400";

  const planningTiles = [
    {
      label: "Planning reserve",
      value: formatPrice(Math.round(price * 0.12)),
      icon: WalletCards,
      tone: "text-white",
    },
    {
      label: "Duty sensitivity",
      value: dutyRisk,
      icon: ShieldCheck,
      tone: dutyTone,
    },
    {
      label: "Monthly buffer",
      value: formatPrice(monthlyPlanningBaseline),
      icon: Gauge,
      tone: "text-white",
    },
  ];

  return (
    <PageCanvas>
      <PlatformPageHero
        eyebrow="Finance desk"
        title="Lease, duty, and tax desk."
        icon={CalcIcon}
        metrics={[
          { label: "Vehicle value", value: formatPrice(price) },
          { label: "Engine", value: `${engineCapacity.toLocaleString()} cc` },
          { label: "Mode", value: "Live" },
        ]}
      />

      <section className="layout-shell space-y-10 py-10 md:py-14">
        {/* Workbench: baseline assumptions (left) + finance modules (right) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
          {/* Baseline assumptions — anchored, sticky on desktop */}
          <div className="asset-surface rounded-[14px] p-5 md:p-6 lg:sticky lg:top-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-amber-400/25 bg-amber-500/10">
                <Banknote className="h-5 w-5 text-amber-300" aria-hidden="true" />
              </div>
              <div>
                <p className="tech-label">Vehicle baseline</p>
            <h2 className="text-lg font-semibold tracking-tight text-white">Primary assumptions</h2>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <label htmlFor="vehicle-value" className="field-label">
                  Vehicle value / CIF (LKR)
                </label>
                <Input
                  id="vehicle-value"
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="h-12 rounded-[10px] border-white/15 bg-black/40 text-lg font-medium text-white num focus-visible:ring-amber-400/50"
                />
                <p className="ui-caption num">{formatPrice(price)}</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="engine-capacity" className="field-label">
                  Engine capacity (CC)
                </label>
                <Input
                  id="engine-capacity"
                  type="number"
                  min={0}
                  value={engineCapacity}
                  onChange={(e) => setEngineCapacity(Number(e.target.value))}
                  className="h-12 rounded-[10px] border-white/15 bg-black/40 text-lg font-medium text-white num focus-visible:ring-amber-400/50"
                />
                <p className="ui-caption">
                  {engineCapacity.toLocaleString()} cc &middot; duty sensitivity{" "}
                  <span className={dutyTone}>{dutyRisk}</span>
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <div className="metric-tile flex items-center justify-between gap-4 rounded-[10px]">
                <span className="field-label">Working value</span>
                <span className="text-xl font-bold tracking-tight text-white num">{formatPrice(price)}</span>
              </div>
            </div>
          </div>

          {/* Finance modules — lease + tax, stacked */}
          <div className="space-y-6">
            <div>
              <p className="tech-label mb-3">Lease scenario</p>
              <LeaseCalculator price={price} />
            </div>
            <div>
              <p className="tech-label mb-3">Import duty and tax</p>
              <TaxBreakdown price={price} engineCapacity={engineCapacity} />
            </div>
          </div>
        </div>

        {/* Planning tiles */}
        <div>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-base font-bold tracking-tight text-white">Ownership planning</h2>
            <p className="tech-label hidden sm:block">Derived from baseline</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {planningTiles.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="data-card rounded-[10px] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="field-label">{item.label}</p>
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/50">
                      <Icon className="h-4 w-4 text-amber-400" aria-hidden="true" />
                    </span>
                  </div>
                  <p className={`mt-4 text-2xl font-bold num ${item.tone}`}>{item.value}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </PageCanvas>
  );
}
