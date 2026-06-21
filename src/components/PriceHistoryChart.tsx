import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight, BarChart3, Gauge } from "lucide-react";
import { formatPriceLkrMillions } from "@/lib/formatting";
import type { PriceTrendPoint } from "@/types/car";

interface PriceHistoryChartProps {
  title?: string;
  points?: PriceTrendPoint[];
  isLoading?: boolean;
  emptyMessage?: string;
  coverageNote?: string | null;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}

function formatMonthLabel(monthKey: string): string {
  const [yearRaw, monthRaw] = String(monthKey || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey;
  }
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatPercentChange(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatSampleCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "Collecting samples";
  return `${value.toLocaleString()} samples`;
}

export function PriceHistoryChart({
  title = "Sri Lanka Market",
  points = [],
  isLoading = false,
  emptyMessage = "No historical values available for this selection.",
  coverageNote,
  emptyActionLabel,
  onEmptyAction,
}: PriceHistoryChartProps) {
  const normalizedPoints = useMemo(() => {
    return [...points]
      .filter((point) => Number.isFinite(Number(point?.median_price)) && Number(point?.median_price) > 0)
      .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  }, [points]);

  const chartData = useMemo(() => {
    return normalizedPoints.map((point) => ({
      label: formatMonthLabel(point.month),
      month: point.month,
      median_million: Number(point.median_price) / 1_000_000,
      median_lkr: Number(point.median_price),
      sample_count: Number(point.sample_count || 0),
    }));
  }, [normalizedPoints]);

  const latestPoint = normalizedPoints.length ? normalizedPoints[normalizedPoints.length - 1] : null;
  const baselinePoint = normalizedPoints.length ? normalizedPoints[0] : null;
  const highPoint = normalizedPoints.length
    ? normalizedPoints.reduce((best, point) => (Number(point.median_price) > Number(best.median_price) ? point : best))
    : null;
  const lowPoint = normalizedPoints.length
    ? normalizedPoints.reduce((best, point) => (Number(point.median_price) < Number(best.median_price) ? point : best))
    : null;

  const latestMedianLabel = latestPoint ? formatPriceLkrMillions(latestPoint.median_price) : "N/A";
  const changePct =
    baselinePoint && latestPoint && Number(baselinePoint.median_price) > 0
      ? ((Number(latestPoint.median_price) - Number(baselinePoint.median_price)) / Number(baselinePoint.median_price)) * 100
      : null;
  const changeLabel = formatPercentChange(changePct);
  const hasChangeSignal = changePct !== null;
  const changePositive = hasChangeSignal && changePct >= 0;
  const totalSamples = normalizedPoints.reduce((sum, point) => sum + Number(point.sample_count || 0), 0);
  const averageSamples = normalizedPoints.length ? Math.round(totalSamples / normalizedPoints.length) : 0;
  const periodLabel = baselinePoint && latestPoint
    ? `${formatMonthLabel(baselinePoint.month)} to ${formatMonthLabel(latestPoint.month)}`
    : "Waiting for history";
  const trendTone = changePct === null ? "Awaiting signal" : changePositive ? "Market heating" : "Price cooling";

  return (
    <div className="asset-surface w-full rounded-xl p-4 sm:p-6 md:p-7">
      <div className="grid gap-5 lg:grid-cols-[0.78fr_1.32fr]">
        <aside className="data-card p-5">
          <div className="headline-kicker text-zinc-400">
            <BarChart3 className="h-3.5 w-3.5 text-amber-300" />
            Trend desk
          </div>

          <h3 className="headline-display mt-5 text-3xl leading-tight md:text-4xl">{title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Median advertised price movement for the selected make, model, condition, and district filters.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="data-card p-3">
              <p className="tech-label">Current median</p>
              <p className="mt-2 text-2xl font-bold tracking-normal text-white num">{latestMedianLabel}</p>
            </div>
            <div className="data-card p-3">
              <p className="tech-label">Movement</p>
              <div className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${
                !hasChangeSignal
                  ? "bg-white/[0.04] text-zinc-400"
                  : changePositive
                    ? "bg-amber-500/10 text-amber-200"
                    : "bg-amber-500/10 text-amber-200"
              }`}>
                {!hasChangeSignal ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                ) : changePositive ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {changeLabel}
              </div>
            </div>
            <div className="data-card p-3">
              <p className="tech-label">Avg depth</p>
              <p className="mt-2 text-lg font-bold tracking-normal text-white num">{formatSampleCount(averageSamples)}</p>
            </div>
            <div className="data-card p-3">
              <p className="tech-label">Range</p>
              <p className="mt-2 text-sm font-bold leading-5 text-white num">
                {lowPoint && highPoint ? `${formatPriceLkrMillions(lowPoint.median_price)} - ${formatPriceLkrMillions(highPoint.median_price)}` : "N/A"}
              </p>
            </div>
          </div>
        </aside>

        <section className="data-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="tech-label">Price history</p>
              <h4 className="headline-display mt-1 text-xl">{periodLabel}</h4>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="status-chip w-fit">
                <Gauge className="h-3.5 w-3.5 text-amber-300" />
                {trendTone}
              </div>
              {coverageNote ? (
                <p className="max-w-sm text-left text-caption font-semibold leading-5 text-amber-100/80 sm:text-right">
                  {coverageNote}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 h-[340px] w-full sm:h-[390px]">
            {isLoading ? (
              <div className="skeleton-shimmer h-full w-full rounded-xl border border-white/5" />
            ) : chartData.length === 0 ? (
              <div className="console-empty flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-sm leading-relaxed text-zinc-500">
                <p>{emptyMessage}</p>
                {emptyActionLabel && onEmptyAction ? (
                  <button
                    type="button"
                    onClick={onEmptyAction}
                    className="tech-label rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-amber-100 transition-colors hover:bg-amber-500/20"
                  >
                    {emptyActionLabel}
                  </button>
                ) : null}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 18, right: 12, left: -18, bottom: 8 }}>
                  <defs>
                    <linearGradient id="priceHistoryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e9b652" stopOpacity={0.26} />
                      <stop offset="58%" stopColor="#b87922" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#b87922" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="rgba(255,255,255,0.045)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#71717a", fontSize: 10, fontWeight: 600, fontFamily: "Geist Mono" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#71717a", fontSize: 10, fontWeight: 600, fontFamily: "Geist Mono" }}
                    tickFormatter={(value: number) => `${value.toFixed(1)}M`}
                    width={56}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "Median" ? formatPriceLkrMillions(Number(value) * 1_000_000) : value,
                      name,
                    ]}
                    labelStyle={{ color: "#e4e4e7", fontWeight: 800 }}
                    contentStyle={{
                      backgroundColor: "#080909",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "16px",
                      boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
                    }}
                    itemStyle={{ color: "#d4d4d8", fontWeight: 700 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="median_million"
                    name="Median"
                    stroke="#e9b652"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#priceHistoryGradient)"
                    dot={{ r: 3, strokeWidth: 2, fill: "#050607", stroke: "#e9b652" }}
                    activeDot={{ r: 5, strokeWidth: 2, fill: "#e9b652", stroke: "#fff7df" }}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.06] pt-4 tech-label text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Median advertised listings</span>
            <span className="num">{formatSampleCount(totalSamples)} tracked across this range</span>
          </div>
        </section>
      </div>
    </div>
  );
}
