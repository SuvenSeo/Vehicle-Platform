import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { formatPrice } from "@/services/api";
import {
  computeImportTaxes,
  TAX_MODEL_REVIEWED,
  type ImportFuelType,
} from "@/lib/importTaxModel";

const FUEL_OPTIONS: { value: ImportFuelType; label: string }[] = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybrid" },
  { value: "electric", label: "Electric" },
];

export function TaxBreakdown({ price, engineCapacity = 1500 }: { price: number; engineCapacity?: number }) {
  const [fuelType, setFuelType] = useState<ImportFuelType>("petrol");
  const [motorKw, setMotorKw] = useState(110);

  const result = computeImportTaxes({
    cifLkr: price,
    fuelType,
    engineCc: engineCapacity,
    motorKw,
  });

  return (
    <div className="page-panel space-y-4 rounded-xl p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="field-label text-foreground">Import duty and tax</h3>
        <span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-0.5 text-label font-mono font-bold text-primary">
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
                  ? "border-primary/25 bg-primary/10 text-primary"
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
              {line.note && <span className="mt-0.5 block text-[10px] text-muted-foreground/70 num">{line.note}</span>}
            </span>
            <span className="shrink-0 font-medium text-foreground num">{formatPrice(line.amount)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
          <span className="text-xs font-medium text-muted-foreground">Total Est. Taxes</span>
          <span className="text-sm font-bold text-primary num">+{formatPrice(result.totalTax)}</span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Estimated landed cost</span>
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
