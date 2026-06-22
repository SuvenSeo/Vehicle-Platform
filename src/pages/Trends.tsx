import { useState, useEffect } from "react";
import { getMakes, getModels, getPriceTrendSeries } from "@/services/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SRI_LANKA_DISTRICTS } from "@/data/mockListings";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { RotateCcw } from "lucide-react";
import type { PriceTrendPoint } from "@/types/car";

const selectClass = "h-10 rounded-lg border-white/[0.06] bg-[hsl(220,8%,5%)] text-sm text-foreground";

export default function Trends() {
  const [makes, setMakes] = useState<{ make: string; count: number }[]>([]);
  const [modelsList, setModelsList] = useState<{ model: string; count: number }[]>([]);
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [condition, setCondition] = useState("all");
  const [district, setDistrict] = useState("all");
  const [trendData, setTrendData] = useState<PriceTrendPoint[]>([]);
  const [coverageNote, setCoverageNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    getMakes().then((items) => { if (!c) { setMakes(items); setSelectedMake((cur) => cur || items[0]?.make || ""); } }).catch(() => { if (!c) setMakes([]); });
    return () => { c = true; };
  }, []);

  useEffect(() => {
    if (!selectedMake) { setModelsList([]); setSelectedModel(""); return; }
    let c = false;
    setModelsList([]); setSelectedModel("");
    getModels(selectedMake).then((items) => { if (!c) { setModelsList(items); setSelectedModel((cur) => cur || items[0]?.model || ""); } }).catch(() => { if (!c) setModelsList([]); });
    return () => { c = true; };
  }, [selectedMake]);

  useEffect(() => {
    if (!selectedMake || !selectedModel) { setTrendData([]); setCoverageNote(null); return; }
    let c = false;
    setLoading(true); setError(null);
    getPriceTrendSeries(selectedMake, selectedModel, condition !== "all" ? condition : undefined, district !== "all" ? district : undefined)
      .then((s) => { if (!c) { setTrendData(s.points); setCoverageNote(s.coverage_note); } })
      .catch(() => { if (!c) { setTrendData([]); setCoverageNote("Trend data temporarily unavailable."); setError("Unable to load trend data."); } })
      .finally(() => { if (!c) setLoading(false); });
    return () => { c = true; };
  }, [selectedMake, selectedModel, condition, district]);

  const chartTitle = selectedMake && selectedModel ? `${selectedMake} ${selectedModel}` : "Select a lane";
  const emptyMessage = !selectedMake || !selectedModel ? "Select make and model to load price history." : error || "No trend data for this combination yet.";
  const hasNarrow = district !== "all" || condition !== "all";

  return (
    <div className="min-h-screen">
      <section className="border-b border-white/[0.04]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/70">Trend studio</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-[-0.035em] leading-[1.02] text-foreground sm:text-[2.75rem] lg:text-[3rem]">Price trends.</h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-zinc-400">Track median price movement for any vehicle lane across Sri Lanka.</p>
        </div>
      </section>

      <div className="mx-auto max-w-[1320px] space-y-5 px-5 py-8 sm:px-6 lg:py-10">
        {/* Controls */}
        <div className="rounded-xl border border-white/[0.05] bg-[hsl(220,8%,6%)] p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label htmlFor="t-make" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Make</label>
              <Select value={selectedMake} onValueChange={setSelectedMake}>
                <SelectTrigger id="t-make" className={selectClass}><SelectValue placeholder="Select make" /></SelectTrigger>
                <SelectContent className="border-white/[0.06] bg-[hsl(220,8%,5%)] text-foreground">
                  {makes.map((m) => <SelectItem key={m.make} value={m.make}>{m.make}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="t-model" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Model</label>
              <Select value={selectedModel} onValueChange={setSelectedModel} disabled={!selectedMake || !modelsList.length}>
                <SelectTrigger id="t-model" className={`${selectClass} disabled:opacity-50`}><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent className="border-white/[0.06] bg-[hsl(220,8%,5%)] text-foreground">
                  {modelsList.map((m) => <SelectItem key={m.model} value={m.model}>{m.model}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="t-cond" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Condition</label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger id="t-cond" className={selectClass}><SelectValue /></SelectTrigger>
                <SelectContent className="border-white/[0.06] bg-[hsl(220,8%,5%)] text-foreground">
                  <SelectItem value="all">Any</SelectItem><SelectItem value="used">Used</SelectItem>
                  <SelectItem value="reconditioned">Reconditioned</SelectItem><SelectItem value="brand_new">Brand new</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="t-dist" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">District</label>
              <Select value={district} onValueChange={setDistrict}>
                <SelectTrigger id="t-dist" className={selectClass}><SelectValue /></SelectTrigger>
                <SelectContent className="border-white/[0.06] bg-[hsl(220,8%,5%)] text-foreground">
                  <SelectItem value="all">All districts</SelectItem>
                  {SRI_LANKA_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.04] pt-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600">Lane:</span>
            {[selectedMake || "—", selectedModel || "—", condition === "all" ? "Any" : condition, district === "all" ? "All LK" : district].map((chip) => (
              <span key={chip} className="rounded-md border border-white/[0.05] bg-[hsl(220,8%,5%)] px-2 py-1 text-[10px] font-semibold text-zinc-400">{chip}</span>
            ))}
            {hasNarrow && (
              <button type="button" onClick={() => { setDistrict("all"); setCondition("all"); }}
                className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-zinc-500 transition-colors hover:text-zinc-300"
              ><RotateCcw className="h-3 w-3" /> Reset filters</button>
            )}
          </div>
        </div>

        {/* Chart */}
        <div className="min-h-[480px]">
          <PriceHistoryChart title={chartTitle} points={trendData} isLoading={loading} coverageNote={coverageNote} emptyMessage={emptyMessage} emptyActionLabel={hasNarrow ? "Broaden filters" : undefined} onEmptyAction={hasNarrow ? () => { setDistrict("all"); setCondition("all"); } : undefined} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-[hsl(220,8%,5.5%)] px-4 py-3">
          <p className="text-[11px] text-zinc-500">
            {selectedMake && selectedModel ? "Median advertised prices grouped by month from the public Sri Lanka snapshot." : "Choose a make and model to render the trajectory."}
          </p>
          <span className="text-[10px] font-semibold text-cyan-400/60 num">Public data</span>
        </div>
      </div>
    </div>
  );
}
