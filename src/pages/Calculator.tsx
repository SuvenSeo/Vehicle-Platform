import { useState } from "react";
import { motion } from "framer-motion";
import { formatPrice } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Banknote, Gauge, ShieldCheck, WalletCards } from "lucide-react";
import { LeaseCalculator } from "@/components/LeaseCalculator";
import { TaxBreakdown } from "@/components/TaxBreakdown";
import { CashToOwnStrip } from "@/components/CashToOwnStrip";
import {
  VEHICLE_FINANCE_CLASSES,
  getFinanceClassLabel,
  type VehicleFinanceClass,
} from "@/lib/cashToOwn";

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

export default function Calculator() {
  const [price, setPrice] = useState(15000000);
  const [engineCapacity, setEngineCapacity] = useState(1500);
  const [financeClass, setFinanceClass] = useState<VehicleFinanceClass>("registered_used");
  const dutyRisk = engineCapacity > 2000 ? "High" : engineCapacity > 1500 ? "Medium" : "Low";
  const monthlyBaseline = Math.round(price * 0.018 / 1000) * 1000;
  const dutyTone = dutyRisk === "High" ? "text-rose-400" : dutyRisk === "Medium" ? "text-primary" : "text-emerald-400";

  const tiles = [
    { label: "Planning reserve", value: formatPrice(Math.round(price * 0.12)), note: "Rule of thumb: 12% of value for transfer, insurance & first repairs", icon: WalletCards },
    { label: "Duty sensitivity", value: dutyRisk, note: "Based on engine capacity band — larger engines sit in higher excise bands", icon: ShieldCheck, tone: dutyTone },
    { label: "Monthly buffer", value: formatPrice(monthlyBaseline), note: "Rule of thumb: ~1.8% of value/month for fuel, service & insurance", icon: Gauge },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[110px] pointer-events-none" />

      {/* Header */}
      <motion.section variants={itemVariants} className="border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-md relative z-10">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Finance desk</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-tight leading-[1.05] text-white sm:text-[2.75rem] lg:text-[3rem]">Lease, duty & tax.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground font-medium">Import duty estimation, lease scenario modeling, and ownership cost planning.</p>
        </div>
      </motion.section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 space-y-8 relative z-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
          {/* Inputs */}
          <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 lg:sticky lg:top-20 backdrop-blur-md">
            <div className="mb-6 flex items-center gap-3 border-b border-white/5 pb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
                <Banknote className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Baseline</p>
                <h2 className="text-[14px] font-bold text-white">Vehicle assumptions</h2>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="calc-price" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">Vehicle value / CIF (LKR)</label>
                <Input id="calc-price" type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="h-11 rounded-lg border-white/5 bg-white/[0.02] text-white focus-visible:ring-primary/30 text-base font-semibold num" />
                <p className="text-[10px] text-muted-foreground/75 font-semibold num">{formatPrice(price)}</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="calc-cc" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">Engine capacity (CC)</label>
                <Input id="calc-cc" type="number" min={0} value={engineCapacity} onChange={(e) => setEngineCapacity(Number(e.target.value))} className="h-11 rounded-lg border-white/5 bg-white/[0.02] text-white focus-visible:ring-primary/30 text-base font-semibold num" />
                <p className="text-[10px] text-muted-foreground/75 font-semibold">{engineCapacity.toLocaleString()} cc · sensitivity <span className={dutyTone}>{dutyRisk}</span></p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="calc-finance-class" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">Finance class (CBSL LTV)</label>
                <select
                  id="calc-finance-class"
                  value={financeClass}
                  onChange={(e) => setFinanceClass(e.target.value as VehicleFinanceClass)}
                  className="h-11 w-full appearance-none rounded-lg border border-white/5 bg-white/[0.02] px-3 text-sm font-semibold text-white outline-none transition-[border-color,box-shadow] focus:ring-1 focus:ring-primary/30"
                >
                  {VEHICLE_FINANCE_CLASSES.map((cls) => (
                    <option key={cls} value={cls} className="bg-zinc-950 text-white">{getFinanceClassLabel(cls)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/85">Working value</span>
              <span className="text-lg font-bold text-white num">{formatPrice(price)}</span>
            </div>
          </motion.div>

          {/* Modules */}
          <motion.div variants={itemVariants} className="space-y-6">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Cash to own</p>
              <CashToOwnStrip priceLkr={price} financeClass={financeClass} />
            </div>
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Lease scenario</p>
              <LeaseCalculator price={price} financeClass={financeClass} />
            </div>
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Import duty & tax</p>
              <TaxBreakdown price={price} engineCapacity={engineCapacity} />
            </div>
          </motion.div>
        </div>

        {/* Planning tiles */}
        <motion.div variants={itemVariants}>
          <div className="mb-4 flex flex-wrap items-baseline gap-2">
            <h2 className="font-display text-sm font-bold tracking-tight text-white">Ownership planning</h2>
            <span className="text-[11px] text-muted-foreground font-semibold">Rules of thumb for budgeting — not quotes</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {tiles.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.label} className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.01] p-4 backdrop-blur-md transition-all hover:border-primary/20 hover:bg-white/[0.02]">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/75">{t.label}</p>
                    <p className={`mt-1.5 text-lg font-bold num ${t.tone || "text-white"}`}>{t.value}</p>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground font-medium">{t.note}</p>
                  </div>
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
