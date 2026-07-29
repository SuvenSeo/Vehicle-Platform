import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Gauge, RotateCcw } from "lucide-react";
import { getMakes, getMileagePriceScatter, getModels } from "@/services/api";
import type { MileagePricePoint } from "@/types/car";
import { PageBody } from "@/components/PageBody";
import { PageCanvas } from "@/components/PageCanvas";
import { PageHero } from "@/components/PageHero";
import { FreePlanBanner } from "@/components/FreePlanBanner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatPriceLkrMillions } from "@/lib/formatting";
import { revealItem } from "@/lib/motion";
import { useAppPreferences } from "@/lib/appPreferences";
import { visuals } from "@/lib/visualAssets";

const ALL_VALUE = "__all__";
const DEFAULT_LIMIT = 750;

function formatMileage(value: number | null | undefined): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "N/A";
  return `${Math.round(numeric).toLocaleString()} km`;
}

function median(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default function MileagePrice() {
  const { t } = useAppPreferences();
  const [makes, setMakes] = useState<{ make: string; count: number }[]>([]);
  const [modelsList, setModelsList] = useState<{ model: string; count: number }[]>([]);
  const [selectedMake, setSelectedMake] = useState(ALL_VALUE);
  const [selectedModel, setSelectedModel] = useState(ALL_VALUE);
  const [points, setPoints] = useState<MileagePricePoint[]>([]);
  const [sampleSize, setSampleSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveMake = selectedMake === ALL_VALUE ? undefined : selectedMake;
  const effectiveModel = selectedModel === ALL_VALUE ? undefined : selectedModel;

  useEffect(() => {
    let cancelled = false;
    getMakes()
      .then((items) => { if (!cancelled) setMakes(items); })
      .catch(() => { if (!cancelled) setMakes([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!effectiveMake) {
      setModelsList([]);
      setSelectedModel(ALL_VALUE);
      return;
    }

    let cancelled = false;
    setModelsList([]);
    setSelectedModel(ALL_VALUE);
    getModels(effectiveMake)
      .then((items) => { if (!cancelled) setModelsList(items); })
      .catch(() => { if (!cancelled) setModelsList([]); });
    return () => { cancelled = true; };
  }, [effectiveMake]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMileagePriceScatter({
      make: effectiveMake,
      model: effectiveModel,
      limit: DEFAULT_LIMIT,
    })
      .then((data) => {
        if (!cancelled) {
          setPoints(data.points);
          setSampleSize(data.sample_size);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPoints([]);
          setSampleSize(0);
          setError(t("mileagePrice.loadError", "Mileage-price analytics are temporarily unavailable."));
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [effectiveMake, effectiveModel, t]);

  const chartData = useMemo(() => {
    return points.map((point) => ({
      ...point,
      price_million: point.price_lkr / 1_000_000,
      label: `${point.make} ${point.model}`,
    }));
  }, [points]);

  const medianMileage = useMemo(() => median(points.map((point) => point.mileage_km)), [points]);
  const medianPrice = useMemo(() => median(points.map((point) => point.price_lkr)), [points]);
  const laneLabel = effectiveMake
    ? `${effectiveMake}${effectiveModel ? ` ${effectiveModel}` : ""}`
    : t("mileagePrice.allMarket", "All market");
  const hasFilters = Boolean(effectiveMake || effectiveModel);
  const emptyMessage = error || t("mileagePrice.empty", "No live priced listings with mileage for this selection yet.");

  const selectTriggerClass = "h-11 rounded-xl border-border bg-surface text-sm text-foreground";
  const selectContentClass = "border-border bg-popover text-popover-foreground";
  const fieldLabelClass = "text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground";

  return (
    <PageCanvas>
      <FreePlanBanner />
      <PageHero
        theme="trends"
        eyebrow={t("mileagePrice.eyebrow", "Scatter analytics")}
        watermarkIcon={BarChart3}
        title={<>{t("mileagePrice.title", "Mileage vs price.")}</>}
        description={t("mileagePrice.description", "See how asking prices decay across odometer readings for live Sri Lanka listings.")}
        media={visuals.priceIntelligenceBg}
        mediaPosition="center"
        mediaTone="brand"
        highlights={[
          { label: "Sample", value: sampleSize.toLocaleString(), hint: "Live priced listings" },
          { label: "Payload", value: `${DEFAULT_LIMIT}`, hint: "Client cap per query" },
          { label: "Filters", value: "Make/model", hint: "Narrow by vehicle lane" },
        ]}
      />

      <PageBody className="space-y-6">
        <motion.div variants={revealItem} className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div className="space-y-1.5">
              <label htmlFor="mp-make" className={fieldLabelClass}>{t("common.make", "Make")}</label>
              <Select value={selectedMake} onValueChange={setSelectedMake}>
                <SelectTrigger id="mp-make" className={selectTriggerClass}>
                  <SelectValue placeholder={t("common.selectMake", "Select make")} />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value={ALL_VALUE}>{t("common.allMakes", "All makes")}</SelectItem>
                  {makes.map((make) => (
                    <SelectItem key={make.make} value={make.make}>
                      {make.make} ({make.count.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="mp-model" className={fieldLabelClass}>{t("common.model", "Model")}</label>
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={!effectiveMake || !modelsList.length}
              >
                <SelectTrigger id="mp-model" className={selectTriggerClass}>
                  <SelectValue placeholder={t("common.selectModel", "Select model")} />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value={ALL_VALUE}>{t("common.allModels", "All models")}</SelectItem>
                  {modelsList.map((model) => (
                    <SelectItem key={model.model} value={model.model}>
                      {model.model} ({model.count.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={!hasFilters}
              onClick={() => {
                setSelectedMake(ALL_VALUE);
                setSelectedModel(ALL_VALUE);
              }}
              className="h-11 gap-2 rounded-xl"
            >
              <RotateCcw aria-hidden className="h-4 w-4" />
              {t("common.reset", "Reset")}
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className={fieldLabelClass}>{t("mileagePrice.lane", "Lane:")}</span>
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
              {laneLabel}
            </span>
          </div>
        </motion.div>

        <motion.section variants={revealItem} className="asset-surface rounded-xl p-4 sm:p-6 md:p-7">
          <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
            <aside className="data-card p-5">
              <div className="headline-kicker text-muted-foreground">
                <Gauge className="h-3.5 w-3.5 text-primary" />
                Odometer desk
              </div>
              <h2 className="headline-display mt-5 text-3xl leading-tight md:text-4xl">{laneLabel}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t("mileagePrice.chartCopy", "Each dot is one live listing with a valid asking price and mileage reading.")}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="data-card p-3">
                  <p className="tech-label">{t("mileagePrice.sample", "Sample")}</p>
                  <p className="mt-2 text-2xl font-bold tracking-normal text-foreground num">{sampleSize.toLocaleString()}</p>
                </div>
                <div className="data-card p-3">
                  <p className="tech-label">{t("mileagePrice.medianMileage", "Median mileage")}</p>
                  <p className="mt-2 text-lg font-bold tracking-normal text-foreground num">{formatMileage(medianMileage)}</p>
                </div>
                <div className="data-card p-3 sm:col-span-2">
                  <p className="tech-label">{t("mileagePrice.medianAsk", "Median ask")}</p>
                  <p className="mt-2 text-2xl font-bold tracking-normal text-foreground num">{formatPriceLkrMillions(medianPrice)}</p>
                </div>
              </div>
            </aside>

            <div className="data-card p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="tech-label">{t("mileagePrice.chartTitleEyebrow", "Scatter plot")}</p>
                  <h3 className="headline-display mt-1 text-xl">{t("mileagePrice.chartTitle", "Mileage against advertised price")}</h3>
                </div>
                <span className="status-chip w-fit">{t("common.publicData", "Public data")}</span>
              </div>

              <div className="mt-6 h-[380px] w-full sm:h-[430px]">
                {loading ? (
                  <div className="skeleton-shimmer h-full w-full rounded-xl border border-border" />
                ) : chartData.length === 0 ? (
                  <div className="console-empty flex h-full w-full items-center justify-center px-6 text-center text-sm leading-relaxed text-muted-foreground">
                    {emptyMessage}
                  </div>
                ) : (
                  <div
                    role="img"
                    aria-label={`${laneLabel} mileage vs price scatter with ${chartData.length} listings`}
                    className="h-full w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 18, right: 16, left: -8, bottom: 14 }}>
                        <CartesianGrid strokeDasharray="4 8" stroke="hsl(var(--foreground) / 0.06)" />
                        <XAxis
                          type="number"
                          dataKey="mileage_km"
                          name="Mileage"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 600, fontFamily: "Geist Mono" }}
                          tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="number"
                          dataKey="price_million"
                          name="Price"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 600, fontFamily: "Geist Mono" }}
                          tickFormatter={(value: number) => `${value.toFixed(1)}M`}
                          width={54}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3", stroke: "hsl(var(--primary) / 0.45)" }}
                          formatter={(value: number, name: string) => [
                            name === "Price" ? formatPriceLkrMillions(Number(value) * 1_000_000) : formatMileage(Number(value)),
                            name,
                          ]}
                          labelFormatter={(_, payload) => {
                            const point = payload?.[0]?.payload as MileagePricePoint | undefined;
                            return point ? `${point.make} ${point.model}${point.year ? ` (${point.year})` : ""}` : "";
                          }}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "16px",
                            boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
                          }}
                          itemStyle={{ color: "hsl(var(--muted-foreground))", fontWeight: 700 }}
                          labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 800 }}
                        />
                        <Scatter
                          name="Price"
                          data={chartData}
                          fill="var(--gold)"
                          fillOpacity={0.72}
                          line={false}
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 tech-label text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{t("mileagePrice.axisNote", "X axis: mileage in kilometers")}</span>
                <span>{t("mileagePrice.payloadNote", "Payload capped for fast rendering")}</span>
              </div>
            </div>
          </div>
        </motion.section>
      </PageBody>
    </PageCanvas>
  );
}
