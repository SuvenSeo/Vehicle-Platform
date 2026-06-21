import { useEffect, useMemo, useState } from "react";
import { APIError, estimatePrice, formatPrice, getMakes, getModels, getPriceTrends } from "@/services/api";
import { PriceEstimate, PriceTrendPoint } from "@/types/car";
import { SRI_LANKA_DISTRICTS } from "@/data/mockListings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlatformPageHero } from "@/components/PlatformPageHero";
import { PageCanvas } from "@/components/PageCanvas";
import { AlertTriangle, BarChart3, Calculator as CalculatorIcon, Gauge, ShieldCheck, TrendingUp } from "lucide-react";

type EstimateForm = {
  make: string;
  model: string;
  year: number;
  condition: "brand_new" | "reconditioned" | "used";
  transmission: "automatic" | "manual" | "cvt" | "tiptronic";
  fuel_type: "petrol" | "diesel" | "hybrid" | "electric" | "plugin_hybrid";
  mileage_km: number;
  district: string;
};

type TrendProjection = {
  annualizedRate: number;
  oneYearValue: number;
  threeYearValue: number;
  windowMonths: number;
};

function monthToIndex(value: string): number | null {
  const [yearRaw, monthRaw] = String(value || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return year * 12 + month;
}

function getTrendProjection(points: PriceTrendPoint[], baseMedian: number): TrendProjection | null {
  if (!Number.isFinite(baseMedian) || baseMedian <= 0) return null;
  const normalized = [...points]
    .filter((point) => Number.isFinite(point.median_price) && point.median_price > 0)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));

  if (normalized.length < 2) return null;

  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  const firstIndex = monthToIndex(first.month);
  const lastIndex = monthToIndex(last.month);
  if (firstIndex === null || lastIndex === null || lastIndex <= firstIndex) return null;

  const monthWindow = lastIndex - firstIndex;
  const changeRatio = Number(last.median_price) / Number(first.median_price);
  if (!Number.isFinite(changeRatio) || changeRatio <= 0) return null;

  const annualizedRate = Math.pow(changeRatio, 12 / monthWindow) - 1;
  if (!Number.isFinite(annualizedRate) || Math.abs(annualizedRate) > 0.75) {
    return null;
  }

  const oneYearValue = baseMedian * (1 + annualizedRate);
  const threeYearValue = baseMedian * Math.pow(1 + annualizedRate, 3);

  if (!Number.isFinite(oneYearValue) || !Number.isFinite(threeYearValue) || oneYearValue <= 0 || threeYearValue <= 0) {
    return null;
  }

  return {
    annualizedRate,
    oneYearValue,
    threeYearValue,
    windowMonths: monthWindow,
  };
}

function formatAnnualizedRate(rate: number): string {
  const pct = rate * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% / year`;
}

const fieldLabelClass = "field-label block";
const controlClass =
  "h-11 rounded-lg border-border bg-background/40 text-foreground focus:ring-1 focus:ring-amber-500/50";

export default function Estimate() {
  const [makes, setMakes] = useState<{ make: string; count: number }[]>([]);
  const [modelsList, setModelsList] = useState<{ model: string; count: number }[]>([]);
  const [form, setForm] = useState<EstimateForm>({
    make: "",
    model: "",
    year: 2021,
    condition: "reconditioned",
    transmission: "automatic",
    fuel_type: "hybrid",
    mileage_km: 50_000,
    district: "Colombo",
  });
  const [result, setResult] = useState<PriceEstimate | null>(null);
  const [trendPoints, setTrendPoints] = useState<PriceTrendPoint[]>([]);
  const [trendUnavailable, setTrendUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMakes().then(setMakes).catch(() => setMakes([]));
  }, []);

  useEffect(() => {
    if (!form.make) {
      setModelsList([]);
      return;
    }
    getModels(form.make).then(setModelsList).catch(() => setModelsList([]));
  }, [form.make]);

  const update = (patch: Partial<EstimateForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleEstimate = async () => {
    if (!form.make || !form.model) return;

    setLoading(true);
    setError(null);
    setTrendUnavailable(false);

    try {
      const [estimate, trends] = await Promise.all([
        estimatePrice(form),
        getPriceTrends(form.make, form.model, form.condition, form.district).catch(() => null),
      ]);

      setResult(estimate);
      setTrendPoints(Array.isArray(trends) ? trends : []);
      setTrendUnavailable(trends === null);
    } catch (err) {
      const fallback = "Unable to estimate right now. Try another model, year, or district.";
      if (err instanceof APIError) {
        setError(err.detail || fallback);
      } else if (err instanceof Error) {
        setError(err.message || fallback);
      } else {
        setError(fallback);
      }
      setResult(null);
      setTrendPoints([]);
    } finally {
      setLoading(false);
    }
  };

  const projection = useMemo(() => {
    if (!result) return null;
    return getTrendProjection(trendPoints, result.median);
  }, [result, trendPoints]);

  const confidenceLabel = result ? `${result.confidence} confidence` : "Awaiting inputs";

  return (
    <PageCanvas className="pb-16">
      <PlatformPageHero
        eyebrow="Valuation workbench"
        title="Market valuation."
        icon={CalculatorIcon}
        metrics={[
          { label: "Makes tracked", value: makes.length.toLocaleString() },
          { label: "District scope", value: SRI_LANKA_DISTRICTS.length.toLocaleString() },
          { label: "Valuation mode", value: result ? result.confidence : "Ready" },
        ]}
      />

      <section className="layout-shell grid gap-6 py-10 md:py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        {/* ------------------------------------------------------------------ */}
        {/* Inputs (left on desktop, first on mobile)                          */}
        {/* ------------------------------------------------------------------ */}
        <div className="console-section p-5 md:p-6">
          <header className="mb-6 flex items-center gap-3 border-b border-border pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
              <CalculatorIcon className="h-5 w-5 text-amber-400" aria-hidden="true" />
            </div>
            <div>
              <p className="tech-label">Step 01 · Vehicle profile</p>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Configure inputs</h2>
            </div>
          </header>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="estimate-make" className={fieldLabelClass}>
                  Make
                </label>
                <Select value={form.make} onValueChange={(value) => update({ make: value, model: "" })}>
                  <SelectTrigger id="estimate-make" className={controlClass}>
                    <SelectValue placeholder="Select make" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card text-foreground">
                    {makes.map((item) => (
                      <SelectItem key={item.make} value={item.make}>
                        {item.make} ({item.count.toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="estimate-model" className={fieldLabelClass}>
                  Model
                </label>
                <Select
                  value={form.model}
                  onValueChange={(value) => update({ model: value })}
                  disabled={!form.make || modelsList.length === 0}
                >
                  <SelectTrigger id="estimate-model" className={`${controlClass} disabled:opacity-60`}>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card text-foreground">
                    {modelsList.map((item) => (
                      <SelectItem key={item.model} value={item.model}>
                        {item.model} ({item.count.toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="estimate-year" className={fieldLabelClass}>
                  Year
                </label>
                <Input
                  id="estimate-year"
                  type="number"
                  min={1990}
                  max={new Date().getFullYear() + 1}
                  value={form.year}
                  onChange={(event) => update({ year: Number(event.target.value) || 0 })}
                  className={`${controlClass} num`}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="estimate-condition" className={fieldLabelClass}>
                  Condition
                </label>
                <Select value={form.condition} onValueChange={(value: EstimateForm["condition"]) => update({ condition: value })}>
                  <SelectTrigger id="estimate-condition" className={controlClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card text-foreground">
                    <SelectItem value="brand_new">Brand New</SelectItem>
                    <SelectItem value="reconditioned">Reconditioned</SelectItem>
                    <SelectItem value="used">Used</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="estimate-transmission" className={fieldLabelClass}>
                  Transmission
                </label>
                <Select
                  value={form.transmission}
                  onValueChange={(value: EstimateForm["transmission"]) => update({ transmission: value })}
                >
                  <SelectTrigger id="estimate-transmission" className={controlClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card text-foreground">
                    <SelectItem value="automatic">Automatic</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="cvt">CVT</SelectItem>
                    <SelectItem value="tiptronic">Tiptronic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="estimate-fuel" className={fieldLabelClass}>
                  Fuel type
                </label>
                <Select value={form.fuel_type} onValueChange={(value: EstimateForm["fuel_type"]) => update({ fuel_type: value })}>
                  <SelectTrigger id="estimate-fuel" className={controlClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card text-foreground">
                    <SelectItem value="petrol">Petrol</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="plugin_hybrid">Plug-in Hybrid</SelectItem>
                    <SelectItem value="electric">Electric</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="estimate-mileage" className={fieldLabelClass}>
                  Mileage (km)
                </label>
                <Input
                  id="estimate-mileage"
                  type="number"
                  min={0}
                  max={500_000}
                  value={form.mileage_km}
                  onChange={(event) => update({ mileage_km: Number(event.target.value) || 0 })}
                  className={`${controlClass} num`}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="estimate-district" className={fieldLabelClass}>
                  District
                </label>
                <Select value={form.district} onValueChange={(value) => update({ district: value })}>
                  <SelectTrigger id="estimate-district" className={controlClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card text-foreground">
                    {SRI_LANKA_DISTRICTS.map((district) => (
                      <SelectItem key={district} value={district}>
                        {district}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <Button
                onClick={handleEstimate}
                disabled={!form.make || !form.model || loading}
                className="action-primary h-12 w-full text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Gauge className="h-4 w-4" aria-hidden="true" />
                {loading ? "Running valuation…" : "Run Live Valuation"}
              </Button>

              {!form.make || !form.model ? (
                <p className="text-center text-xs text-muted-foreground">
                  Select a make and model to enable valuation.
                </p>
              ) : null}

              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs leading-relaxed text-rose-300"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Valuation output (right on desktop, second on mobile)              */}
        {/* ------------------------------------------------------------------ */}
        <div className="console-section p-5 md:p-6 lg:sticky lg:top-6">
          <header className="mb-6 flex items-center justify-between gap-3 border-b border-border pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
                <Gauge className="h-5 w-5 text-amber-400" aria-hidden="true" />
              </div>
              <div>
                <p className="tech-label">Step 02 · Market output</p>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Valuation</h2>
              </div>
            </div>
            <span className="status-chip hidden sm:inline-flex">{confidenceLabel}</span>
          </header>

          <div className="space-y-5">
            {/* Empty state */}
            {!result && !loading ? (
              <div className="console-empty flex flex-col items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background/40">
                  <Gauge className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Enter a vehicle profile and run valuation to view live median pricing, confidence level, and trajectory insights.
                </p>
              </div>
            ) : null}

            {/* Loading state */}
            {loading ? (
              <div className="space-y-4" aria-busy="true" aria-live="polite">
                <div className="data-card animate-pulse p-5">
                  <div className="h-3 w-28 rounded bg-white/5" />
                  <div className="mt-3 h-9 w-48 rounded bg-white/5" />
                  <div className="mt-3 h-3 w-40 rounded bg-white/5" />
                </div>
                <div className="data-card animate-pulse p-4">
                  <div className="h-2 w-full rounded-full bg-white/5" />
                  <div className="mt-3 flex justify-between">
                    <div className="h-4 w-20 rounded bg-white/5" />
                    <div className="h-4 w-20 rounded bg-white/5" />
                  </div>
                </div>
                <div className="data-card animate-pulse p-4">
                  <div className="h-3 w-32 rounded bg-white/5" />
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="h-16 rounded-lg bg-white/5" />
                    <div className="h-16 rounded-lg bg-white/5" />
                  </div>
                </div>
              </div>
            ) : null}

            {/* Success state */}
            {result && !loading ? (
              <>
                {/* Headline median */}
                <div className="data-card p-5">
                  <p className="tech-label">Estimated median</p>
                  <p className="num mt-1.5 text-4xl font-semibold tracking-tight text-foreground sm:text-[2.75rem]">
                    {formatPrice(result.median)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Based on{" "}
                    <span className="num text-cyan-400">{result.comparable_count.toLocaleString()}</span>{" "}
                    comparable listings.
                  </p>
                </div>

                {/* Low / high band */}
                <div className="data-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="tech-label">Low</span>
                    <span className="tech-label">High</span>
                  </div>
                  <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full w-full bg-gradient-to-r from-amber-600/70 via-amber-500 to-amber-300" />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="num text-sm font-semibold text-foreground">{formatPrice(result.low)}</span>
                    <span className="num text-sm font-semibold text-foreground">{formatPrice(result.high)}</span>
                  </div>
                </div>

                {/* Signal chips */}
                <div className="flex flex-wrap gap-2">
                  <span className="status-chip border-amber-500/30 bg-amber-500/10 text-amber-300">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {result.confidence} confidence
                  </span>
                  <span className="status-chip">
                    <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="num">{result.comparable_count.toLocaleString()}</span> comparables
                  </span>
                  <span className="status-chip">
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                    Mileage adjusted: {result.mileage_adjusted ? "Yes" : "No"}
                  </span>
                </div>

                {/* Trajectory */}
                <div className="data-card p-4">
                  <p className="tech-label">Trajectory · data-derived</p>

                  {projection ? (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Derived from <span className="num">{projection.windowMonths}</span> months of historical median
                        prices for {form.make} {form.model} in {form.district}.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="metric-tile">
                          <p className="tech-label">Projected 1Y</p>
                          <p className="num mt-1 text-sm font-semibold text-foreground">
                            {formatPrice(projection.oneYearValue)}
                          </p>
                        </div>
                        <div className="metric-tile">
                          <p className="tech-label">Projected 3Y</p>
                          <p className="num mt-1 text-sm font-semibold text-foreground">
                            {formatPrice(projection.threeYearValue)}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Annualized trend:{" "}
                        <span
                          className={`num font-semibold ${
                            projection.annualizedRate >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {formatAnnualizedRate(projection.annualizedRate)}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      {trendUnavailable
                        ? "Historical trend stream is temporarily unavailable. Re-run shortly for trajectory analytics."
                        : "Not enough stable historical points yet to calculate a reliable forward projection for this exact configuration."}
                    </p>
                  )}
                </div>

                {/* Methodology */}
                <div className="data-card p-4">
                  <p className="tech-label">Methodology</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{result.methodology}</p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>
    </PageCanvas>
  );
}
