import { useState } from "react";
import { AlertTriangle, ArrowRight, Leaf } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { formatPrice } from "@/services/api";
import {
  computeImportTaxes,
  getHybridExciseCliffInsight,
  isAtHybridExciseCliff,
  TAX_MODEL_REVIEWED,
  type ImportFuelType,
} from "@/lib/importTaxModel";

const FUEL_OPTIONS: { value: ImportFuelType; label: string }[] = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybrid" },
  { value: "electric", label: "Electric" },
];

function HybridTaxAdvantageCallout({ engineCapacity, fuelType }: { engineCapacity: number; fuelType: ImportFuelType }) {
  const location = useLocation();
  const insight = getHybridExciseCliffInsight();
  const onCalculator = location.pathname.startsWith("/calculator");
  const atCliff = isAtHybridExciseCliff(engineCapacity);

  return (
    <div className="flex gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
      <Leaf className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
      <div className="min-w-0 space-y-1.5">
        <p className="text-[11px] font-semibold text-emerald-300">Hybrid tax advantage</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Hybrid excise is charged per cm³ in capacity bands. At{" "}
          <span className="num font-medium text-foreground">{insight.cliffCc.toLocaleString()} cc</span> the rate is Rs.{" "}
          <span className="num font-medium text-foreground">{insight.rateAtOrBelowCliff.toLocaleString()}</span>/cc — one
          cc over moves to Rs.{" "}
          <span className="num font-medium text-foreground">{insight.rateAboveCliff.toLocaleString()}</span>/cc, stepping excise
          up by <span className="num font-medium text-foreground">{formatPrice(insight.exciseStepUp)}</span> on this model.
          At the cliff, hybrid saves{" "}
          <span className="num font-medium text-foreground">{formatPrice(insight.exciseSavingVsPetrolAtCliff)}</span> in excise
          alone vs petrol (Rs. {insight.petrolRateAtCliff.toLocaleString()}/cc).
          {atCliff && (
            <>
              {" "}
              Your {engineCapacity.toLocaleString()} cc input sits on this boundary — confirm the declared capacity before
              import.
            </>
          )}
        </p>
        {!onCalculator && (
          <Link
            to={`/calculator?tab=landed-cost&fuel=${fuelType}&cc=${engineCapacity}`}
            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-300 no-underline transition-colors hover:text-emerald-200"
          >
            Model import duty in calculator
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function TaxBreakdown({
  price,
  engineCapacity = 1500,
  initialFuelType,
}: {
  price: number;
  engineCapacity?: number;
  /** Seed from the listing's known fuel type so a hybrid doesn't open on petrol excise. */
  initialFuelType?: ImportFuelType;
}) {
  const [fuelType, setFuelType] = useState<ImportFuelType>(initialFuelType ?? "petrol");
  const [motorKw, setMotorKw] = useState(110);

  const result = computeImportTaxes({
    cifLkr: price,
    fuelType,
    engineCc: engineCapacity,
    motorKw,
  });

  const showHybridAdvantage = fuelType === "hybrid" || isAtHybridExciseCliff(engineCapacity);

  return (
    <div className="page-panel space-y-4 rounded-xl p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="field-label text-foreground">Import duty and tax</h3>
        <span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-0.5 text-label font-mono font-bold text-primary-bright">
          Indicative
        </span>
      </div>

      {/* Fuel type + EV power input */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Fuel type">
          {FUEL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFuelType(option.value)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                fuelType === option.value
                  ? "border-primary/25 bg-primary/10 text-primary-bright"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {fuelType === "electric" && (
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            Motor power
            <input
              type="number"
              min={0}
              value={motorKw}
              onChange={(e) => setMotorKw(Number(e.target.value))}
              className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary/50 num"
              aria-label="Motor power in kilowatts"
            />
            kW
          </label>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between border-b border-border pb-2 text-xs text-muted-foreground">
          <span>Base Value (CIF est.)</span>
          <span className="font-medium text-foreground num">{formatPrice(price)}</span>
        </div>

        {result.lines.map((line) => (
          <div key={line.key} className="flex justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {line.label}
              {line.note && <span className="mt-0.5 block text-[10px] text-muted-foreground num">{line.note}</span>}
            </span>
            <span className="shrink-0 font-medium text-foreground num">{formatPrice(line.amount)}</span>
          </div>
        ))}
      </div>

      {showHybridAdvantage && <HybridTaxAdvantageCallout engineCapacity={engineCapacity} fuelType={fuelType} />}

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
          <span className="text-xs font-medium text-muted-foreground">Total Est. Taxes</span>
          <span className="text-sm font-bold text-primary num">+{formatPrice(result.totalTax)}</span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-bright">Estimated landed cost</span>
          <span className="text-lg font-bold tracking-tight text-foreground num">{formatPrice(result.totalOnRoad)}</span>
        </div>
      </div>

      <div className="flex gap-2 rounded-lg border border-deal-amber/30 bg-deal-amber/10 p-3">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-deal-amber" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Indicative model of the post-2025 import regime (per-cm³/per-kW excise bands, luxury tax above the CIF
          threshold, VAT on the duty-inclusive value). Band rates last reviewed {TAX_MODEL_REVIEWED} — actual duty
          changes by gazette, so verify with Sri Lanka Customs or your clearing agent before committing to an import.
        </p>
      </div>
    </div>
  );
}
