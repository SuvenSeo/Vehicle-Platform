import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice, calculateLandedCost, calculateTco, getPermits, type LandedCostResult, type TcoResult, type PermitInfo } from "@/services/api";
import { Input } from "@/components/ui/input";
import {
  Banknote,
  Gauge,
  WalletCards,
  FileText,
  TrendingDown,
  Compass,
  AlertTriangle,
  CheckCircle,
  Link2,
} from "lucide-react";
import { LeaseCalculator } from "@/components/LeaseCalculator";
import { CashToOwnStrip } from "@/components/CashToOwnStrip";
import { toast } from "sonner";
import { getSurchargeCountdown } from "@/lib/importTaxModel";

type TabType = "landed-cost" | "lease" | "tco" | "permits" | "depreciation";
type FuelType = "petrol" | "diesel" | "hybrid" | "electric";

const TAB_IDS: TabType[] = ["landed-cost", "lease", "tco", "permits", "depreciation"];
const FUEL_TYPES: FuelType[] = ["petrol", "diesel", "hybrid", "electric"];

// Cap URL-seeded numbers well above any real-world value; a crafted
// ?cif=1e300 must not reach the backend or overflow the math.
const MAX_URL_NUMBER = 1e12;

function numParam(
  params: URLSearchParams,
  key: string,
  fallback: number,
  { positive = false }: { positive?: boolean } = {},
): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > MAX_URL_NUMBER) return fallback;
  if (positive && value <= 0) return fallback;
  return value;
}

function fuelParam(params: URLSearchParams, key: string, fallback: FuelType): FuelType {
  const raw = params.get(key) as FuelType | null;
  return raw && FUEL_TYPES.includes(raw) ? raw : fallback;
}

function boolParam(params: URLSearchParams, key: string, fallback: boolean): boolean {
  const raw = params.get(key);
  if (raw === null) return fallback;
  return raw !== "0" && raw !== "false";
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const raw = searchParams.get("tab") as TabType | null;
    return raw && TAB_IDS.includes(raw) ? raw : "landed-cost";
  });

  // Landed Cost State (seeded from the shareable URL when present)
  const [cifUsd, setCifUsd] = useState(() => numParam(searchParams, "cif", 12000, { positive: true }));
  const [exchangeRate, setExchangeRate] = useState(() => numParam(searchParams, "fx", 300.0, { positive: true }));
  const [lcFuelType, setLcFuelType] = useState<FuelType>(() => fuelParam(searchParams, "fuel", "hybrid"));
  const [lcEngineCc, setLcEngineCc] = useState(() => numParam(searchParams, "cc", 1500));
  const [lcMotorKw, setLcMotorKw] = useState(() => numParam(searchParams, "kw", 110));
  const [applySurcharge, setApplySurcharge] = useState(() => boolParam(searchParams, "surcharge", true));
  const [applySscl, setApplySscl] = useState(() => boolParam(searchParams, "sscl", true));
  const [lcResult, setLcResult] = useState<LandedCostResult | null>(null);
  // What this exact import saves if the 50% surcharge lapses on schedule.
  const [lcLapseSavings, setLcLapseSavings] = useState<number | null>(null);
  const [lcLoading, setLcLoading] = useState(false);
  const surchargeCountdown = getSurchargeCountdown();

  // Lease / Cash-to-own state (original logic wrapper)
  const [leasePrice, setLeasePrice] = useState(() => numParam(searchParams, "price", 15000000));
  const [leaseCc, setLeaseCc] = useState(() => numParam(searchParams, "leasecc", 1500));

  // TCO Calculator State (seeded from the shareable URL when present)
  const [tcoDailyKm, setTcoDailyKm] = useState(() => numParam(searchParams, "km", 40));
  const [tcoFuelType, setTcoFuelType] = useState<FuelType>(() => fuelParam(searchParams, "tfuel", "hybrid"));
  const [tcoKmpl, setTcoKmpl] = useState(() => numParam(searchParams, "kmpl", 18, { positive: true }));
  const [tcoLease, setTcoLease] = useState(() => numParam(searchParams, "lease", 85000));
  const [tcoInsurance, setTcoInsurance] = useState(() => numParam(searchParams, "ins", 120000));
  const [tcoService, setTcoService] = useState(() => numParam(searchParams, "svc", 60000));
  const [tcoTyres, setTcoTyres] = useState(() => numParam(searchParams, "tyres", 30000));
  const [tcoDepreciation, setTcoDepreciation] = useState(() => numParam(searchParams, "dep", 100000));
  const [tcoResult, setTcoResult] = useState<TcoResult | null>(null);
  const [tcoLoading, setTcoLoading] = useState(false);

  // Permit state
  const [permits, setPermits] = useState<PermitInfo[]>([]);
  const [permitsLoading, setPermitsLoading] = useState(false);

  // Fetch permits on tab mount
  useEffect(() => {
    if (activeTab === "permits") {
      setPermitsLoading(true);
      getPermits()
        .then((data) => {
          setPermits(data);
          // If empty, seed mock data in UI for rich preview representation
          if (data.length === 0) {
            setPermits([
              { id: 1, permit_name: "Government Doctor Permit", permit_type: "duty_free", market_price_lkr: 5500000 },
              { id: 2, permit_name: "Government MP / State Officer Permit", permit_type: "duty_free", market_price_lkr: 9800000 },
              { id: 3, permit_name: "Special EV Import Permit (Remittance)", permit_type: "ev", market_price_lkr: 2200000 },
              { id: 4, permit_name: "Foreign Employment EV Permit", permit_type: "ev", market_price_lkr: 1800000 },
            ]);
          }
        })
        .catch(() => {
          toast.error("Network error", {
            description: "Failed to load permit prices. Showing benchmark rates.",
          });
        })
        .finally(() => setPermitsLoading(false));
    }
  }, [activeTab]);

  // Run calculations automatically or on submit
  const runLandedCostCalc = async () => {
    setLcLoading(true);
    try {
      const payload = {
        cif_usd: cifUsd,
        exchange_rate: exchangeRate,
        fuel_type: lcFuelType,
        engine_cc: lcFuelType !== "electric" ? lcEngineCc : undefined,
        motor_kw: lcFuelType === "electric" ? lcMotorKw : undefined,
        apply_sscl: applySscl,
      };
      const [res, resWithoutSurcharge] = await Promise.all([
        calculateLandedCost({ ...payload, apply_surcharge: applySurcharge }),
        // Second variant powers the "if the surcharge lapses" delta.
        applySurcharge && !surchargeCountdown.expired
          ? calculateLandedCost({ ...payload, apply_surcharge: false })
          : Promise.resolve(null),
      ]);
      setLcResult(res);
      setLcLapseSavings(
        resWithoutSurcharge ? Math.max(0, res.landed_cost - resWithoutSurcharge.landed_cost) : null,
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "An error occurred.";
      toast.error("Calculation failed", { description: message });
    } finally {
      setLcLoading(false);
    }
  };

  const runTcoCalc = async () => {
    setTcoLoading(true);
    try {
      const res = await calculateTco({
        daily_km: tcoDailyKm,
        fuel_type: tcoFuelType,
        mileage_kmpl: tcoKmpl,
        lease_installment: tcoLease,
        insurance_annual: tcoInsurance,
        service_annual: tcoService,
        tyres_annual: tcoTyres,
        resale_loss_annual: tcoDepreciation,
      });
      setTcoResult(res);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "An error occurred.";
      toast.error("Calculation failed", { description: message });
    } finally {
      setTcoLoading(false);
    }
  };

  // Debounced recalcs: typing fires one request per pause, not per keystroke
  // (the backend rate-limits /calculators, so per-keystroke POSTs would 429).
  useEffect(() => {
    const timer = setTimeout(() => void runLandedCostCalc(), 350);
    return () => clearTimeout(timer);
    // Recalculate only when landed-cost inputs change (not when helper identity changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional input-driven recalculation
  }, [cifUsd, exchangeRate, lcFuelType, lcEngineCc, lcMotorKw, applySurcharge, applySscl]);

  useEffect(() => {
    const timer = setTimeout(() => void runTcoCalc(), 350);
    return () => clearTimeout(timer);
    // Recalculate only when TCO inputs change (not when helper identity changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional input-driven recalculation
  }, [tcoDailyKm, tcoFuelType, tcoKmpl, tcoLease, tcoInsurance, tcoService, tcoTyres, tcoDepreciation]);

  // Keep the URL shareable: tab + active tab's inputs, replace-state so
  // typing doesn't spam browser history.
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    if (activeTab === "landed-cost") {
      params.set("cif", String(cifUsd));
      params.set("fx", String(exchangeRate));
      params.set("fuel", lcFuelType);
      if (lcFuelType === "electric") {
        params.set("kw", String(lcMotorKw));
      } else {
        params.set("cc", String(lcEngineCc));
      }
      if (!applySurcharge) params.set("surcharge", "0");
      if (!applySscl) params.set("sscl", "0");
    } else if (activeTab === "lease") {
      params.set("price", String(leasePrice));
      params.set("leasecc", String(leaseCc));
    } else if (activeTab === "tco") {
      params.set("km", String(tcoDailyKm));
      params.set("tfuel", tcoFuelType);
      params.set("kmpl", String(tcoKmpl));
      params.set("lease", String(tcoLease));
      params.set("ins", String(tcoInsurance));
      params.set("svc", String(tcoService));
      params.set("tyres", String(tcoTyres));
      params.set("dep", String(tcoDepreciation));
    }
    if (`?${params.toString()}` !== window.location.search) {
      setSearchParams(params, { replace: true });
    }
  }, [
    activeTab, cifUsd, exchangeRate, lcFuelType, lcEngineCc, lcMotorKw,
    applySurcharge, applySscl, leasePrice, leaseCc, tcoDailyKm, tcoFuelType,
    tcoKmpl, tcoLease, tcoInsurance, tcoService, tcoTyres, tcoDepreciation,
    setSearchParams,
  ]);

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied", { description: "This calculation is now shareable." });
    } catch {
      toast.error("Copy failed", {
        description: "Copy the address bar URL to share this calculation.",
      });
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[110px] pointer-events-none" />

      {/* Header */}
      <motion.section variants={itemVariants} className="border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-md relative z-10">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">AutoLens Intelligence Hub</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-tight leading-[1.05] text-white sm:text-[2.75rem] lg:text-[3rem]">Mobility & Tax Calculators.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground font-medium">Verify import tax gazettes, map Total Cost of Ownership (TCO), track black market permits, and assess retention curves.</p>
        </div>
      </motion.section>

      {/* Tabs Selector */}
      <div className="mx-auto flex max-w-[1320px] flex-nowrap items-center gap-3 px-5 py-6 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-nowrap gap-1 overflow-x-auto rounded-xl border border-white/5 bg-white/[0.01] p-1.5 backdrop-blur-md snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-none sm:flex-wrap sm:overflow-visible">
          {[
            { id: "landed-cost", label: "Landed Cost", icon: Banknote },
            { id: "lease", label: "Lease Scenario", icon: WalletCards },
            { id: "tco", label: "Ownership TCO", icon: Gauge },
            { id: "permits", label: "Permit Tracker", icon: FileText },
            { id: "depreciation", label: "Retention Curves", icon: TrendingDown },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`relative flex min-h-[40px] shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold tracking-wide transition-colors z-10 ${
                  activeTab === tab.id
                    ? "text-black font-bold"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="active-tab-indicator"
                    className="absolute inset-0 bg-primary rounded-lg -z-10 shadow-md shadow-primary/20"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => void copyShareLink()}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-white/5 bg-white/[0.01] px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground backdrop-blur-md transition-colors hover:text-white"
          title="Copy a shareable link to this calculation"
        >
          <Link2 className="h-3.5 w-3.5" />
          Share
        </button>
      </div>

      <div className="mx-auto max-w-[1320px] px-5 pb-16 sm:px-6 relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === "landed-cost" && (
            <motion.div
              key="landed-cost-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
            >
              {/* Surcharge countdown — time-boxed gazette moment */}
              <div className="lg:col-span-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-4 backdrop-blur-md">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-amber-300">
                      {surchargeCountdown.expired
                        ? "The 50% CID surcharge's gazetted 3-month period has ended"
                        : `50% CID surcharge in force — set to lapse in ${surchargeCountdown.daysLeft} day${surchargeCountdown.daysLeft === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {surchargeCountdown.expired
                      ? "No extension has been gazetted as of our last review — verify current customs rates before committing an import."
                      : `Gazetted expiry ${surchargeCountdown.expiryLabel} · no extension decision announced · LCs opened on or before 15 May 2026 are exempt`}
                  </span>
                  <AnimatePresence initial={false}>
                    {!surchargeCountdown.expired && applySurcharge && lcLapseSavings !== null && lcLapseSavings > 0 && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ duration: 0.18 }}
                        className="w-full text-center sm:w-auto sm:text-left sm:ml-auto rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-bold text-emerald-300 num"
                      >
                        This import lands {formatPrice(lcLapseSavings)} cheaper if it lapses
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Inputs */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-md h-fit space-y-5">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
                    <Banknote className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-[14px] font-bold text-white">Import Configuration</h2>
                    <p className="text-[10px] text-muted-foreground font-semibold">Taxes compounding on CIF valuation</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">CIF Price (USD)</label>
                      <Input type="number" value={cifUsd} onChange={(e) => setCifUsd(Number(e.target.value))} className="bg-white/[0.02] border-white/5 focus-visible:ring-primary/30" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Exchange Rate (LKR)</label>
                      <Input type="number" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} className="bg-white/[0.02] border-white/5 focus-visible:ring-primary/30" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Fuel Category</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(["petrol", "diesel", "hybrid", "electric"] as const).map((fuel) => (
                        <button
                          key={fuel}
                          onClick={() => setLcFuelType(fuel)}
                          className={`min-h-[36px] rounded-lg border py-2.5 text-[10px] font-bold capitalize transition-all ${
                            lcFuelType === fuel
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-white/5 bg-white/[0.01] text-muted-foreground hover:text-white"
                          }`}
                        >
                          {fuel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {lcFuelType !== "electric" ? (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Engine Capacity (CC)</label>
                      <Input type="number" value={lcEngineCc} onChange={(e) => setLcEngineCc(Number(e.target.value))} className="bg-white/[0.02] border-white/5 focus-visible:ring-primary/30" />
                      {lcFuelType === "hybrid" && lcEngineCc > 1500 && (
                        <p className="flex items-center gap-1.5 text-[10px] text-amber-400 font-semibold mt-1">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Capacity is above the 1500cc cliff. Excise rate steps up significantly.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Motor Power (kW)</label>
                      <Input type="number" value={lcMotorKw} onChange={(e) => setLcMotorKw(Number(e.target.value))} className="bg-white/[0.02] border-white/5 focus-visible:ring-primary/30" />
                    </div>
                  )}

                  <div className="space-y-3 pt-3 border-t border-white/5">
                    <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-muted-foreground hover:text-white">
                      <input type="checkbox" checked={applySurcharge} onChange={(e) => setApplySurcharge(e.target.checked)} className="accent-primary h-4 w-4 rounded" />
                      Apply 50% CID Gazette Surcharge (Compounding)
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-muted-foreground hover:text-white">
                      <input type="checkbox" checked={applySscl} onChange={(e) => setApplySscl(e.target.checked)} className="accent-primary h-4 w-4 rounded" />
                      Apply 2.5% SSCL Levy
                    </label>
                  </div>
                </div>
              </div>

              {/* Landed Cost Results */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-md space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-white">Landed Cost breakdown</h3>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Indicative tax components based on 2026 gazette calculations</p>
                </div>

                {lcLoading && !lcResult ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border border-t-transparent border-primary" />
                  </div>
                ) : lcResult ? (
                  <div className={`space-y-5 transition-opacity duration-200 ${lcLoading ? "opacity-60" : "opacity-100"}`}>
                    <div className="space-y-3 border-b border-white/5 pb-4">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Base CIF LKR Equivalent</span>
                        <span className="font-semibold text-white num">{formatPrice(lcResult.cif_lkr)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Customs Import Duty (20%)</span>
                        <span className="font-semibold text-white num">{formatPrice(lcResult.cid)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Surcharge on CID (50% Surcharge)</span>
                        <span className="font-semibold text-white num">{formatPrice(lcResult.surcharge)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Excise Duty (Capacity Banded)</span>
                        <span className="font-semibold text-white num">{formatPrice(lcResult.excise)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>SSCL (2.5%)</span>
                        <span className="font-semibold text-white num">{formatPrice(lcResult.sscl)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>VAT (18% Compounded)</span>
                        <span className="font-semibold text-white num">{formatPrice(lcResult.vat)}</span>
                      </div>
                      {lcResult.luxury_tax > 0 && (
                        <div className="flex justify-between text-xs text-rose-400 font-semibold">
                          <span>Luxury Tax (Excess Portion)</span>
                          <span className="num">{formatPrice(lcResult.luxury_tax)}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Taxes & Duties</span>
                        <p className="text-xl font-bold text-primary mt-1 num">+{formatPrice(lcResult.total_tax)}</p>
                      </div>
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Est. Landed Cost</span>
                        <p className="text-xl font-bold text-white mt-1 num">{formatPrice(lcResult.landed_cost)}</p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3 flex gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] leading-relaxed text-muted-foreground font-semibold">{lcResult.notes}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}

          {activeTab === "lease" && (
            <motion.div
              key="lease-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
            >
              {/* ORIGINAL CONFIG INPUTS */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-md h-fit space-y-5">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
                    <WalletCards className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-[14px] font-bold text-white">Lease Assumptions</h2>
                    <p className="text-[10px] text-muted-foreground font-semibold">Bases for loan to value margins</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Vehicle Valuation (LKR)</label>
                    <Input type="number" value={leasePrice} onChange={(e) => setLeasePrice(Number(e.target.value))} className="bg-white/[0.02] border-white/5 focus-visible:ring-primary/30 font-semibold text-white text-base" />
                    <p className="text-[10px] text-muted-foreground/75 font-semibold num">{formatPrice(leasePrice)}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Engine Capacity (CC)</label>
                    <Input type="number" value={leaseCc} onChange={(e) => setLeaseCc(Number(e.target.value))} className="bg-white/[0.02] border-white/5 focus-visible:ring-primary/30" />
                  </div>
                </div>
              </div>

              {/* RENDER DUAL PANELS */}
              <div className="space-y-6">
                {/* CBSL 40/60 LTV arbitrage — regulation-made, nobody else surfaces it */}
                <AnimatePresence initial={false}>
                {leasePrice >= 1_000_000 && (() => {
                  const usedDown = leasePrice * 0.4;   // 60% LTV on registered used
                  const newDown = leasePrice * 0.6;    // 40% LTV on new/unregistered
                  const usedBudgetFromNewDown = newDown / 0.4; // same cash, used market
                  return (
                    <motion.div
                      key="ltv-arbitrage"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden rounded-xl border border-primary/15 bg-primary/[0.04]"
                    >
                      <div className="p-4">
                      <div className="flex items-start gap-2.5">
                        <Compass className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div className="space-y-1.5">
                          <p className="text-xs font-bold text-white">The 40/60 rule is working in your favour on used cars</p>
                          <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
                            CBSL caps financing at <span className="font-bold text-white">40%</span> for brand-new or unregistered vehicles but{" "}
                            <span className="font-bold text-white">60%</span> for registered used (&gt;1yr). For this{" "}
                            <span className="num font-bold text-white">{formatPrice(leasePrice)}</span> vehicle: registered used needs{" "}
                            <span className="num font-bold text-emerald-400">{formatPrice(usedDown)}</span> down; new or unregistered needs{" "}
                            <span className="num font-bold text-rose-400">{formatPrice(newDown)}</span> — the same cash that would stretch to a{" "}
                            <span className="num font-bold text-white">{formatPrice(usedBudgetFromNewDown)}</span> registered used car.
                          </p>
                          <p className="text-[10px] font-semibold text-muted-foreground/70">
                            CBSL Act Directions No. 01 of 2026 (from 25 May 2026) · banks may apply stricter internal caps
                          </p>
                        </div>
                      </div>
                      </div>
                    </motion.div>
                  );
                })()}
                </AnimatePresence>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cash requirements</span>
                  <CashToOwnStrip priceLkr={leasePrice} financeClass="registered_used" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lease Scenario modeling</span>
                  <LeaseCalculator price={leasePrice} financeClass="registered_used" />
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "tco" && (
            <motion.div
              key="tco-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
            >
              {/* Inputs */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-md space-y-4 h-fit">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
                    <Gauge className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-[14px] font-bold text-white">TCO Assumptions</h2>
                    <p className="text-[10px] text-muted-foreground font-semibold">Commute, service, and amortization</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Daily Commute (KM)</label>
                    <Input type="number" value={tcoDailyKm} onChange={(e) => setTcoDailyKm(Number(e.target.value))} className="bg-white/[0.02] border-white/5 focus-visible:ring-primary/30" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Fuel Efficiency (KMPL)</label>
                    <Input type="number" value={tcoKmpl} onChange={(e) => setTcoKmpl(Number(e.target.value))} className="bg-white/[0.02] border-white/5 focus-visible:ring-primary/30" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Fuel Type</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["petrol", "diesel", "hybrid", "electric"] as const).map((fuel) => (
                      <button
                        key={fuel}
                        onClick={() => setTcoFuelType(fuel)}
                        className={`min-h-[36px] rounded-lg border py-2.5 text-[10px] font-bold capitalize transition-all ${
                          tcoFuelType === fuel
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-white/5 bg-white/[0.01] text-muted-foreground hover:text-white"
                        }`}
                      >
                        {fuel}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Monthly Lease (LKR)</label>
                  <Input type="number" value={tcoLease} onChange={(e) => setTcoLease(Number(e.target.value))} className="bg-white/[0.02] border-white/5 focus-visible:ring-primary/30" />
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Annual Insurance</label>
                    <Input type="number" value={tcoInsurance} onChange={(e) => setTcoInsurance(Number(e.target.value))} className="bg-white/[0.02] border-white/5 focus-visible:ring-primary/30" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Annual Service</label>
                    <Input type="number" value={tcoService} onChange={(e) => setTcoService(Number(e.target.value))} className="bg-white/[0.02] border-white/5 focus-visible:ring-primary/30" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Annual Tyres</label>
                    <Input type="number" value={tcoTyres} onChange={(e) => setTcoTyres(Number(e.target.value))} className="bg-white/[0.02] border-white/5 focus-visible:ring-primary/30" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Annual Resale Loss</label>
                    <Input type="number" value={tcoDepreciation} onChange={(e) => setTcoDepreciation(Number(e.target.value))} className="bg-white/[0.02] border-white/5 focus-visible:ring-primary/30" />
                  </div>
                </div>
              </div>

              {/* TCO Results */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-md space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-white">Monthly Cost of Ownership breakdown</h3>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Calculated using live Octane API price metrics</p>
                </div>

                {tcoLoading && !tcoResult ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border border-t-transparent border-primary" />
                  </div>
                ) : tcoResult ? (
                  <div className={`space-y-5 transition-opacity duration-200 ${tcoLoading ? "opacity-60" : "opacity-100"}`}>
                    <div className="space-y-3 border-b border-white/5 pb-4">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Live fuel/energy price benchmark</span>
                        <span className="font-semibold text-white num">Rs. {tcoResult.fuel_price_lkr.toLocaleString()} / L or kWh</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Monthly fuel/energy consumption</span>
                        <span className="font-semibold text-white num">{formatPrice(tcoResult.fuel_cost_monthly)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Monthly lease installments</span>
                        <span className="font-semibold text-white num">{formatPrice(tcoResult.lease_cost_monthly)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Amortized service, insurance, tyres & depreciation</span>
                        <span className="font-semibold text-white num">{formatPrice(tcoResult.overhead_cost_monthly)}</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Total ownership cost / month</span>
                      <p className="text-3xl font-bold text-white mt-1.5 num">{formatPrice(tcoResult.total_tco_monthly)}</p>
                    </div>

                    <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3 flex gap-2">
                      <Compass className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-[10px] leading-relaxed text-muted-foreground font-semibold">{tcoResult.notes}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}

          {activeTab === "permits" && (
            <motion.div
              key="permits-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-md">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-white">Live Permit Black Market Tracker</h3>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Indicative values of transferable and EV remittance import licenses</p>
                </div>

                {permitsLoading ? (
                  <div className="h-32 flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border border-t-transparent border-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/5 text-muted-foreground uppercase tracking-wider text-[9px] font-bold">
                          <th className="py-3 px-4">Permit Name</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4 text-right">Premium Value (LKR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {permits.map((permit) => (
                          <tr key={permit.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                            <td className="py-4 px-4 font-semibold text-white">{permit.permit_name}</td>
                            <td className="py-4 px-4 capitalize font-medium text-muted-foreground">{permit.permit_type.replace("_", " ")}</td>
                            <td className="py-4 px-4 text-right font-bold text-primary num">{formatPrice(permit.market_price_lkr)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "depreciation" && (
            <motion.div
              key="depreciation-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-md">
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-white">Sri Lanka Value Retention Curves</h3>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Asset retention curves demonstrating how specific models retain value in the local market</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { model: "Suzuki Wagon R", type: "Kei Car / Hybrid", values: ["92%", "85%", "78%"], tone: "text-emerald-400", border: "border-emerald-500/20", note: "The gold standard of value retention. Heavy demand for daily urban runs." },
                    { model: "Honda Vezel Hybrid", type: "Crossover", values: ["82%", "65%", "48%"], tone: "text-amber-400", border: "border-amber-500/20", note: "Drops heavily after 3 years once the hybrid battery pack warranty expires." },
                    { model: "Toyota Land Cruiser Prado", type: "Luxury SUV", values: ["95%", "92%", "88%"], tone: "text-primary", border: "border-primary/20", note: "Prado holds extreme value due to luxury status symbol and low import options." },
                    { model: "Nissan Leaf EV", type: "Full EV", values: ["60%", "38%", "20%"], tone: "text-rose-400", border: "border-rose-500/20", note: "Fastest depreciation curve due to battery degradation fears." },
                  ].map((curve) => (
                    <div key={curve.model} className={`rounded-xl border ${curve.border} bg-white/[0.01] p-4 flex flex-col justify-between`}>
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{curve.type}</span>
                        <h4 className="text-sm font-bold text-white mt-1">{curve.model}</h4>
                        
                        <div className="mt-4 space-y-2 border-b border-white/5 pb-4">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Year 1</span>
                            <span className={`font-bold ${curve.tone}`}>{curve.values[0]}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Year 3</span>
                            <span className={`font-bold ${curve.tone}`}>{curve.values[1]}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Year 5</span>
                            <span className={`font-bold ${curve.tone}`}>{curve.values[2]}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[10px] leading-relaxed text-muted-foreground font-semibold mt-4">{curve.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
