import { useState } from "react";
import { formatPrice } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Banknote, Gauge, ShieldCheck, WalletCards } from "lucide-react";
import { LeaseCalculator } from "@/components/LeaseCalculator";
import { TaxBreakdown } from "@/components/TaxBreakdown";

export default function Calculator() {
  const [price, setPrice] = useState(15000000);
  const [engineCapacity, setEngineCapacity] = useState(1500);
  const dutyRisk = engineCapacity > 2000 ? "High" : engineCapacity > 1500 ? "Medium" : "Low";
  const monthlyBaseline = Math.round(price * 0.018 / 1000) * 1000;
  const dutyTone = dutyRisk === "High" ? "text-rose-400" : dutyRisk === "Medium" ? "text-amber-400" : "text-emerald-400";

  const tiles = [
    { label: "Planning reserve", value: formatPrice(Math.round(price * 0.12)), icon: WalletCards },
    { label: "Duty sensitivity", value: dutyRisk, icon: ShieldCheck, tone: dutyTone },
    { label: "Monthly buffer", value: formatPrice(monthlyBaseline), icon: Gauge },
  ];

  return (
    <div className="min-h-screen">
      <section className="border-b border-white/[0.04]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/70">Finance desk</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-[-0.035em] leading-[1.02] text-foreground sm:text-[2.75rem] lg:text-[3rem]">Lease, duty & tax.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-zinc-400">Import duty estimation, lease scenario modeling, and ownership cost planning.</p>
        </div>
      </section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 space-y-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
          {/* Inputs */}
          <div className="rounded-xl border border-white/[0.05] bg-[hsl(220,8%,6%)] p-5 sm:p-6 lg:sticky lg:top-20">
            <div className="mb-6 flex items-center gap-3 border-b border-white/[0.04] pb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <Banknote className="h-3.5 w-3.5 text-amber-400/70" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Baseline</p>
                <h2 className="text-[14px] font-semibold text-foreground">Vehicle assumptions</h2>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="calc-price" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Vehicle value / CIF (LKR)</label>
                <Input id="calc-price" type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="h-11 rounded-lg border-white/[0.06] bg-[hsl(220,8%,5%)] text-base font-semibold text-foreground num" />
                <p className="text-[10px] text-zinc-600 num">{formatPrice(price)}</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="calc-cc" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Engine capacity (CC)</label>
                <Input id="calc-cc" type="number" min={0} value={engineCapacity} onChange={(e) => setEngineCapacity(Number(e.target.value))} className="h-11 rounded-lg border-white/[0.06] bg-[hsl(220,8%,5%)] text-base font-semibold text-foreground num" />
                <p className="text-[10px] text-zinc-600">{engineCapacity.toLocaleString()} cc · sensitivity <span className={dutyTone}>{dutyRisk}</span></p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-lg border border-white/[0.04] bg-[hsl(220,8%,5%)] px-4 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Working value</span>
              <span className="text-lg font-bold text-foreground num">{formatPrice(price)}</span>
            </div>
          </div>

          {/* Modules */}
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Lease scenario</p>
              <LeaseCalculator price={price} />
            </div>
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Import duty & tax</p>
              <TaxBreakdown price={price} engineCapacity={engineCapacity} />
            </div>
          </div>
        </div>

        {/* Planning tiles */}
        <div>
          <h2 className="mb-4 font-display text-sm font-semibold tracking-tight text-foreground">Ownership planning</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {tiles.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.04] bg-[hsl(220,8%,5.5%)] p-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">{t.label}</p>
                    <p className={`mt-1.5 text-lg font-bold num ${t.tone || "text-foreground"}`}>{t.value}</p>
                  </div>
                  <Icon className="h-4 w-4 shrink-0 text-zinc-600" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
