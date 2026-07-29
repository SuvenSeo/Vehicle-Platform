import { useEffect, useState } from "react";
import { BadgeCheck, Car, Database, Info } from "lucide-react";
import { getVehicleSpecs } from "@/services/api";
import type { VehicleSpecsResponse } from "@/services/api";

type VehicleSpecsCardProps = {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  className?: string;
};

function compactModelKey(value: string | null | undefined): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function sourceLabel(source: string): string {
  return source === "nhtsa_vpic" ? "NHTSA vPIC" : source.replace(/[_-]/g, " ");
}

export function VehicleSpecsCard({ make, model, year, className = "" }: VehicleSpecsCardProps) {
  const [specs, setSpecs] = useState<VehicleSpecsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const cleanedMake = String(make || "").trim();
  const cleanedModel = String(model || "").trim();
  const validYear = typeof year === "number" && Number.isFinite(year) && year > 0 ? year : null;

  useEffect(() => {
    let cancelled = false;
    setSpecs(null);
    setFailed(false);

    if (!cleanedMake || !cleanedModel) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    getVehicleSpecs(cleanedMake, cleanedModel, validYear)
      .then((payload) => {
        if (!cancelled) setSpecs(payload);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cleanedMake, cleanedModel, validYear]);

  const models = specs?.models ?? [];
  const exactModel = models.find((row) => compactModelKey(row.model) === compactModelKey(cleanedModel));
  const primaryModel = exactModel || models[0] || null;
  const otherModels = models.filter((row) => row !== primaryModel).slice(0, 3);
  const statusText = validYear
    ? `${validYear} model-year catalog`
    : "Make/model catalog";

  return (
    <div className={`rounded-2xl border border-border bg-card p-5 shadow-soft ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <Database className="h-4 w-4 text-primary" aria-hidden />
          </div>
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Factory catalog check
            </h2>
            <p className="mt-1 text-[13px] font-bold text-foreground">{sourceLabel(specs?.source || "nhtsa_vpic")}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-surface px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Free data
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-surface" />
          <div className="h-16 animate-pulse rounded-xl bg-surface" />
        </div>
      ) : !cleanedMake || !cleanedModel ? (
        <div className="flex gap-2 rounded-xl border border-border bg-surface p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Add a make and model to check the public NHTSA catalog.
          </p>
        </div>
      ) : failed ? (
        <div className="flex gap-2 rounded-xl border border-border bg-surface p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            NHTSA specs are temporarily unavailable. Listing data remains usable.
          </p>
        </div>
      ) : primaryModel ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <p className="text-[12px] font-bold text-foreground">
                {primaryModel.make} {primaryModel.model}
              </p>
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
              Found in the {statusText} from the public vPIC vehicle catalog.
            </p>
            {(primaryModel.model_id || primaryModel.vehicle_type) && (
              <p className="mt-2 text-[10px] font-semibold text-muted-foreground">
                {primaryModel.vehicle_type || "Vehicle"}
                {primaryModel.model_id ? ` · Model ID ${primaryModel.model_id}` : ""}
              </p>
            )}
          </div>

          {otherModels.length > 0 && (
            <div>
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Nearby vPIC matches
              </p>
              <div className="flex flex-wrap gap-1.5">
                {otherModels.map((row) => (
                  <span
                    key={`${row.make}-${row.model}-${row.model_id || ""}`}
                    className="rounded-full border border-border bg-surface px-2 py-1 text-[10px] font-semibold text-muted-foreground"
                  >
                    {row.model}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2 rounded-xl border border-border bg-surface p-3">
          <Car className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            No public vPIC match for {cleanedMake} {cleanedModel}
            {validYear ? ` in ${validYear}` : ""}. This can happen with market aliases or trims.
          </p>
        </div>
      )}
    </div>
  );
}
