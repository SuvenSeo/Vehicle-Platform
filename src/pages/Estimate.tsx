import { useEffect, useMemo, useState } from "react";
import { APIError, estimatePrice, formatPrice, getMakes, getModels, getPriceTrends } from "@/services/api";
import { PriceEstimate, PriceTrendPoint } from "@/types/car";
import { SRI_LANKA_DISTRICTS } from "@/data/mockListings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AlertTriangle, BarChart3, Gauge, ShieldCheck, TrendingUp } from "lucide-react";

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
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return year * 12 + month;
}

function getTrendProjection(points: PriceTrendPoint[], baseMedian: number): TrendProjection | null {
  if (!Number.isFinite(baseMedian) || baseMedian <= 0) return null;
  const normalized = [...points]
    .filter((p) => Number.isFinite(p.median_price) && p.median_price > 0)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (normalized.length < 2) return null;
  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  const fi = monthToIndex(first.month);
  const li = monthToIndex(last.month);
  if (fi === null || li === null || li <= fi) return null;
  const window = li - fi;
  const ratio = Number(last.median_price) / Number(first.median_price);
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  const rate = Math.pow(ratio, 12 / window) - 1;
  if (!Number.isFinite(rate) || Math.abs(rate) > 0.75) return null;
  const y1 = baseMedian * (1 + rate);
  const y3 = baseMedian * Math.pow(1 + rate, 3);
  if (!Number.isFinite(y1) || !Number.isFinite(y3) || y1 <= 0 || y3 <= 0) return null;
  return { annualizedRate: rate, oneYearValue: y1, threeYearValue: y3, windowMonths: window };
}

const selectClass = "h-10 rounded-lg border-white/[0.06] bg-[hsl(220,8%,5%)] text-sm text-foreground focus:ring-1 focus:ring-amber-500/30";
const inputClass = "h-10 rounded-lg border-white/[0.06] bg-[hsl(220,8%,5%)] text-sm text-foreground num focus:ring-1 focus:ring-amber-500/30";

export default function Estimate() {
  const [makes, setMakes] = useState<{ make: string; count: number }[]>([]);
  const [modelsList, setModelsList] = useState<{ model: string; count: number }[]>([]);
  const [form, setForm] = useState<EstimateForm>({
    make: "", model: "", year: 2021, condition: "reconditioned",
    transmission: "automatic", fuel_type: "hybrid", mileage_km: 50_000, district: "Colombo",
  });
  const [result, setResult] = useState<PriceEstimate | null>(null);
  const [trendPoints, setTrendPoints] = useState<PriceTrendPoint[]>([]);
  const [trendUnavailable, setTrendUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getMakes().then(setMakes).catch(() => setMakes([])); }, []);
  useEffect(() => {
    if (!form.make) { setModelsList([]); return; }
    getModels(form.make).then(setModelsList).catch(() => setModelsList([]));
  }, [form.make]);

  const update = (patch: Partial<EstimateForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleEstimate = async () => {
    if (!form.make || !form.model) return;
    setLoading(true); setError(null); setTrendUnavailable(false);
    try {
      const [estimate, trends] = await Promise.all([
        estimatePrice(form),
        getPriceTrends(form.make, form.model, form.condition, form.district).catch(() => null),
      ]);
      setResult(estimate);
      setTrendPoints(Array.isArray(trends) ? trends : []);
      setTrendUnavailable(trends === null);
    } catch (err) {
      const fallback = "Unable to estimate. Try another model, year, or district.";
      setError(err instanceof APIError ? err.detail || fallback : err instanceof Error ? err.message || fallback : fallback);
      setResult(null); setTrendPoints([]);
    } finally { setLoading(false); }
  };

  const projection = useMemo(() => result ? getTrendProjection(trendPoints, result.median) : null, [result, trendPoints]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b border-white/[0.04]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">Valuation workbench</p>
          <h1 className="mt-3 font-display text-[1.75rem] font-semibold tracking-tight text-foreground sm:text-[2.25rem]">
            Market valuation.
          </h1>
          <p className="mt-2 max-w-lg text-sm text-zinc-500">
            Estimate fair value for any vehicle based on live market data, comparable listings, and district-level pricing.
          </p>
        </div>
      </section>

      {/* Two-column layout */}
      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">

          {/* ── INPUT PANEL ──────────────────────────────────────── */}
          <div className="rounded-xl border border-white/[0.05] bg-[hsl(220,8%,6%)] p-5 sm:p-6">
            <div className="mb-6 flex items-center gap-3 border-b border-white/[0.04] pb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <Gauge className="h-3.5 w-3.5 text-amber-400/70" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Step 01</p>
                <h2 className="text-[14px] font-semibold text-foreground">Vehicle profile</h2>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="est-make" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Make</label>
                  <Select value={form.make} onValueChange={(v) => update({ make: v, model: "" })}>
                    <SelectTrigger id="est-make" className={selectClass}><SelectValue placeholder="Select make" /></SelectTrigger>
                    <SelectContent className="border-white/[0.06] bg-[hsl(220,8%,5%)] text-foreground">
                      {makes.map((m) => <SelectItem key={m.make} value={m.make}>{m.make} ({m.count})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="est-model" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Model</label>
                  <Select value={form.model} onValueChange={(v) => update({ model: v })} disabled={!form.make || !modelsList.length}>
                    <SelectTrigger id="est-model" className={`${selectClass} disabled:opacity-50`}><SelectValue placeholder="Select model" /></SelectTrigger>
                    <SelectContent className="border-white/[0.06] bg-[hsl(220,8%,5%)] text-foreground">
                      {modelsList.map((m) => <SelectItem key={m.model} value={m.model}>{m.model} ({m.count})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="est-year" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Year</label>
                  <Input id="est-year" type="number" min={1990} max={new Date().getFullYear() + 1} value={form.year} onChange={(e) => update({ year: Number(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="est-cond" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Condition</label>
                  <Select value={form.condition} onValueChange={(v: EstimateForm["condition"]) => update({ condition: v })}>
                    <SelectTrigger id="est-cond" className={selectClass}><SelectValue /></SelectTrigger>
                    <SelectContent className="border-white/[0.06] bg-[hsl(220,8%,5%)] text-foreground">
                      <SelectItem value="brand_new">Brand New</SelectItem>
                      <SelectItem value="reconditioned">Reconditioned</SelectItem>
                      <SelectItem value="used">Used</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="est-trans" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Transmission</label>
                  <Select value={form.transmission} onValueChange={(v: EstimateForm["transmission"]) => update({ transmission: v })}>
                    <SelectTrigger id="est-trans" className={selectClass}><SelectValue /></SelectTrigger>
                    <SelectContent className="border-white/[0.06] bg-[hsl(220,8%,5%)] text-foreground">
                      <SelectItem value="automatic">Automatic</SelectItem><SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="cvt">CVT</SelectItem><SelectItem value="tiptronic">Tiptronic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="est-fuel" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Fuel type</label>
                  <Select value={form.fuel_type} onValueChange={(v: EstimateForm["fuel_type"]) => update({ fuel_type: v })}>
                    <SelectTrigger id="est-fuel" className={selectClass}><SelectValue /></SelectTrigger>
                    <SelectContent className="border-white/[0.06] bg-[hsl(220,8%,5%)] text-foreground">
                      <SelectItem value="petrol">Petrol</SelectItem><SelectItem value="diesel">Diesel</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem><SelectItem value="plugin_hybrid">Plug-in Hybrid</SelectItem>
                      <SelectItem value="electric">Electric</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="est-km" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Mileage (km)</label>
                  <Input id="est-km" type="number" min={0} max={500000} value={form.mileage_km} onChange={(e) => update({ mileage_km: Number(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="est-dist" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">District</label>
                  <Select value={form.district} onValueChange={(v) => update({ district: v })}>
                    <SelectTrigger id="est-dist" className={selectClass}><SelectValue /></SelectTrigger>
                    <SelectContent className="border-white/[0.06] bg-[hsl(220,8%,5%)] text-foreground">
                      {SRI_LANKA_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t border-white/[0.04] pt-5">
                <button type="button" onClick={handleEstimate} disabled={!form.make || !form.model || loading}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--gold)] text-[11px] font-bold uppercase tracking-[0.1em] text-black transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Gauge className="h-3.5 w-3.5" />
                  {loading ? "Running..." : "Run valuation"}
                </button>
                {!form.make || !form.model ? <p className="mt-2 text-center text-[11px] text-zinc-600">Select make and model to enable.</p> : null}
                {error && (
                  <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── OUTPUT PANEL ─────────────────────────────────────── */}
          <div className="rounded-xl border border-white/[0.05] bg-[hsl(220,8%,6%)] p-5 sm:p-6 lg:sticky lg:top-20">
            <div className="mb-6 flex items-center justify-between gap-3 border-b border-white/[0.04] pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-400/70" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Step 02</p>
                  <h2 className="text-[14px] font-semibold text-foreground">Market output</h2>
                </div>
              </div>
              {result && (
                <span className="rounded-md border border-amber-400/15 bg-amber-400/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-300/80">
                  {result.confidence}
                </span>
              )}
            </div>

            {!result && !loading && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/[0.04] py-14 text-center">
                <Gauge className="h-5 w-5 text-zinc-600" />
                <p className="max-w-xs text-[12px] text-zinc-500">
                  Enter a vehicle profile and run valuation to see live median pricing and trajectory.
                </p>
              </div>
            )}

            {loading && (
              <div className="space-y-3" aria-busy="true">
                <div className="skeleton-shimmer h-24 rounded-lg" />
                <div className="skeleton-shimmer h-16 rounded-lg" />
                <div className="skeleton-shimmer h-20 rounded-lg" />
              </div>
            )}

            {result && !loading && (
              <div className="space-y-4">
                {/* Median */}
                <div className="rounded-lg border border-white/[0.04] bg-[hsl(220,8%,5%)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Estimated median</p>
                  <p className="num mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{formatPrice(result.median)}</p>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Based on <span className="num font-semibold text-cyan-400">{result.comparable_count.toLocaleString()}</span> comparables
                  </p>
                </div>

                {/* Range */}
                <div className="rounded-lg border border-white/[0.04] bg-[hsl(220,8%,5%)] p-4">
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                    <span>Low</span><span>High</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800/60">
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-amber-600/60 via-amber-500/80 to-amber-300/60" />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="num text-[13px] font-bold text-foreground">{formatPrice(result.low)}</span>
                    <span className="num text-[13px] font-bold text-foreground">{formatPrice(result.high)}</span>
                  </div>
                </div>

                {/* Signals */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="flex items-center gap-1.5 rounded-md border border-amber-400/15 bg-amber-400/5 px-2 py-1 text-[10px] font-semibold text-amber-300/80">
                    <ShieldCheck className="h-3 w-3" /> {result.confidence}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-md border border-white/[0.05] px-2 py-1 text-[10px] font-semibold text-zinc-400">
                    <BarChart3 className="h-3 w-3" /> <span className="num">{result.comparable_count}</span> comparables
                  </span>
                  <span className="flex items-center gap-1.5 rounded-md border border-white/[0.05] px-2 py-1 text-[10px] font-semibold text-zinc-400">
                    <TrendingUp className="h-3 w-3" /> Mileage adj: {result.mileage_adjusted ? "Yes" : "No"}
                  </span>
                </div>

                {/* Trajectory */}
                <div className="rounded-lg border border-white/[0.04] bg-[hsl(220,8%,5%)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Trajectory</p>
                  {projection ? (
                    <div className="mt-3 space-y-3">
                      <p className="text-[11px] text-zinc-500">
                        Derived from <span className="num font-semibold text-zinc-300">{projection.windowMonths}</span> months of data for {form.make} {form.model}.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border border-white/[0.04] bg-[hsl(220,8%,4%)] p-3">
                          <p className="text-[10px] text-zinc-600">1Y projected</p>
                          <p className="num mt-1 text-[13px] font-bold text-foreground">{formatPrice(projection.oneYearValue)}</p>
                        </div>
                        <div className="rounded-md border border-white/[0.04] bg-[hsl(220,8%,4%)] p-3">
                          <p className="text-[10px] text-zinc-600">3Y projected</p>
                          <p className="num mt-1 text-[13px] font-bold text-foreground">{formatPrice(projection.threeYearValue)}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        Annual rate: <span className={`num font-semibold ${projection.annualizedRate >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {projection.annualizedRate >= 0 ? "+" : ""}{(projection.annualizedRate * 100).toFixed(1)}%
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-zinc-500">
                      {trendUnavailable ? "Trend data temporarily unavailable." : "Not enough historical data for projection."}
                    </p>
                  )}
                </div>

                {/* Methodology */}
                <div className="rounded-lg border border-white/[0.04] bg-[hsl(220,8%,5%)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Methodology</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{result.methodology}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
