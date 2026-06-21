import { useState, useEffect } from "react";
import { getMakes, getModels, getPriceTrendSeries } from "@/services/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SRI_LANKA_DISTRICTS } from "@/data/mockListings";
import { PlatformPageHero } from "@/components/PlatformPageHero";
import { PageCanvas } from "@/components/PageCanvas";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { Activity, SlidersHorizontal, MapPin, Layers, Car, RotateCcw } from "lucide-react";
import type { PriceTrendPoint } from "@/types/car";

export default function Trends() {
  const [makes, setMakes] = useState<{ make: string; count: number }[]>([]);
  const [modelsList, setModelsList] = useState<{ model: string; count: number }[]>([]);
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [condition, setCondition] = useState<string>("all");
  const [district, setDistrict] = useState<string>("all");
  const [trendData, setTrendData] = useState<PriceTrendPoint[]>([]);
  const [coverageNote, setCoverageNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getMakes()
      .then((items) => {
        if (cancelled) return;
        setMakes(items);
        setSelectedMake((current) => current || items[0]?.make || "");
      })
      .catch(() => {
        if (!cancelled) setMakes([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedMake) {
      setModelsList([]);
      setSelectedModel("");
      return;
    }

    let cancelled = false;
    setModelsList([]);
    setSelectedModel("");

    getModels(selectedMake)
      .then((items) => {
        if (cancelled) return;
        setModelsList(items);
        setSelectedModel((current) => current || items[0]?.model || "");
      })
      .catch(() => {
        if (!cancelled) setModelsList([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMake]);

  useEffect(() => {
    if (!selectedMake || !selectedModel) {
      setTrendData([]);
      setCoverageNote(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getPriceTrendSeries(
      selectedMake,
      selectedModel,
      condition && condition !== "all" ? condition : undefined,
      district && district !== "all" ? district : undefined
    )
      .then((series) => {
        if (cancelled) return;
        setTrendData(series.points);
        setCoverageNote(series.coverage_note);
      })
      .catch(() => {
        if (cancelled) return;
        setTrendData([]);
        setCoverageNote("Historical trend stream is temporarily unavailable. Re-run shortly for trajectory analytics.");
        setError("Unable to load trend data right now.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMake, selectedModel, condition, district]);

  const chartTitle = selectedMake && selectedModel
    ? `Sri Lanka - ${selectedMake} ${selectedModel}`
    : "Select a market lane";
  const emptyMessage = !selectedMake || !selectedModel
    ? "Select a make and model to build a price history view."
    : error || "No trend data is available for this filter combination yet.";

  const conditionLabel = condition === "all" ? "Any condition" : condition.replace("_", " ");
  const districtLabel = district === "all" ? "All districts" : district;
  const hasNarrowFilters = district !== "all" || condition !== "all";
  const laneReady = Boolean(selectedMake && selectedModel);

  const resetFilters = () => {
    setDistrict("all");
    setCondition("all");
  };

  return (
    <PageCanvas>
      <PlatformPageHero
        eyebrow="Trend studio"
        title="Price trends by lane."
        icon={Activity}
        metrics={[
          { label: "Makes", value: makes.length.toLocaleString() },
          { label: "Models", value: selectedMake ? modelsList.length.toLocaleString() : "—" },
          { label: "Districts", value: SRI_LANKA_DISTRICTS.length.toLocaleString() },
        ]}
      />

      <section className="layout-shell space-y-5 py-10 md:py-12">
        {/* Command surface — integrated controls above the chart workspace */}
        <div className="console-section p-4 sm:p-5 md:p-6">
          <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <div className="headline-kicker text-zinc-400">
                <SlidersHorizontal className="h-3.5 w-3.5 text-amber-300" />
                Trend controls
              </div>
              <h2 className="headline-display text-2xl leading-tight md:text-3xl">Build a lane</h2>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label htmlFor="trend-make" className="field-label flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-zinc-500" />
                Make
              </label>
              <Select value={selectedMake} onValueChange={setSelectedMake}>
                <SelectTrigger id="trend-make" className="control-dark w-full">
                  <SelectValue placeholder="Select make" />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-white/10">
                  {makes.map((make) => (
                    <SelectItem key={make.make} value={make.make}>{make.make}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="trend-model" className="field-label flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-zinc-500" />
                Model
              </label>
              <Select value={selectedModel} onValueChange={setSelectedModel} disabled={!selectedMake || modelsList.length === 0}>
                <SelectTrigger id="trend-model" className="control-dark w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-white/10">
                  {modelsList.map((model) => (
                    <SelectItem key={model.model} value={model.model}>{model.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="trend-condition" className="field-label flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-zinc-500" />
                Condition
              </label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger id="trend-condition" className="control-dark w-full">
                  <SelectValue placeholder="Any condition" />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-white/10">
                  <SelectItem value="all">Any condition</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="reconditioned">Reconditioned</SelectItem>
                  <SelectItem value="brand_new">Brand new</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="trend-district" className="field-label flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                District
              </label>
              <Select value={district} onValueChange={setDistrict}>
                <SelectTrigger id="trend-district" className="control-dark w-full">
                  <SelectValue placeholder="All districts" />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-white/10">
                  <SelectItem value="all">All districts</SelectItem>
                  {SRI_LANKA_DISTRICTS.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active lane summary */}
          <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="field-label mr-1 text-zinc-500">Active lane</span>
              <span className="status-chip">{selectedMake || "No make"}</span>
              <span className="status-chip">{selectedModel || "No model"}</span>
              <span className="status-chip">{conditionLabel}</span>
              <span className="status-chip">{districtLabel}</span>
            </div>
            {hasNarrowFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="action-soft h-9 self-start py-0 sm:self-auto"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Chart workspace */}
        <div className="min-h-[520px]">
          <PriceHistoryChart
            title={chartTitle}
            points={trendData}
            isLoading={loading}
            coverageNote={coverageNote}
            emptyMessage={emptyMessage}
            emptyActionLabel={hasNarrowFilters ? "Show broader lane" : undefined}
            onEmptyAction={hasNarrowFilters ? resetFilters : undefined}
          />
        </div>

        {/* Coverage / methodology footnote */}
        <div className="data-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="text-xs leading-relaxed text-zinc-500">
            {laneReady
              ? "Trajectory reflects median advertised prices from the public Sri Lanka snapshot, grouped by month for the selected lane."
              : "Choose a make and model to render the price trajectory for that lane."}
          </p>
          <span className="tech-label text-cyan-400">
            Public snapshot data
          </span>
        </div>
      </section>
    </PageCanvas>
  );
}
