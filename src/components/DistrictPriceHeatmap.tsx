import { memo, useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import { LazyMapMount } from "@/components/leaflet/LazyMapMount";
import { MapResizeController } from "@/components/leaflet/MapResizeController";
import { formatPrice } from "@/services/api";
import "leaflet/dist/leaflet.css";

export interface DistrictPriceHeatmapPoint {
  district: string;
  avg_price?: number | null;
  avg_price_lkr?: number | null;
  median_price?: number | null;
  median_price_lkr?: number | null;
  listing_count?: number | null;
  count?: number | null;
  lat?: number | null;
  lng?: number | null;
}

interface DistrictPriceHeatmapProps {
  data: DistrictPriceHeatmapPoint[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  currentDistrict?: string;
}

const SL_BOUNDS: [[number, number], [number, number]] = [[5.7, 79.2], [10.35, 82.15]];
const SL_CENTER: [number, number] = [7.8731, 80.7718];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toRgb(hex: string) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function lerpColor(from: string, to: string, ratio: number) {
  const s = toRgb(from);
  const e = toRgb(to);
  const t = clamp(ratio, 0, 1);
  return `rgb(${Math.round(s.r + (e.r - s.r) * t)}, ${Math.round(s.g + (e.g - s.g) * t)}, ${Math.round(s.b + (e.b - s.b) * t)})`;
}

function normalizeDistrictName(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

function priceValue(point: DistrictPriceHeatmapPoint): number {
  return Number(point.median_price_lkr ?? point.median_price ?? point.avg_price_lkr ?? point.avg_price ?? 0);
}

function averagePrice(point: DistrictPriceHeatmapPoint): number {
  return Number(point.avg_price_lkr ?? point.avg_price ?? 0);
}

function listingCount(point: DistrictPriceHeatmapPoint): number {
  return Math.round(Number(point.listing_count ?? point.count ?? 0));
}

function priceColor(price: number, minPrice: number, maxPrice: number): string {
  if (maxPrice <= 0) return "rgb(120, 53, 15)";
  const ratio = maxPrice === minPrice ? 0.65 : clamp((price - minPrice) / (maxPrice - minPrice), 0, 1);
  if (ratio < 0.5) return lerpColor("#f59e0b", "#f97316", ratio * 2);
  return lerpColor("#f97316", "#e11d48", (ratio - 0.5) * 2);
}

function priceRadius(count: number, maxCount: number): number {
  if (maxCount <= 0) return 9;
  return clamp(9 + (count / maxCount) * 15, 9, 24);
}

export const DistrictPriceHeatmap = memo(function DistrictPriceHeatmap({
  data,
  isLoading,
  isError,
  onRetry,
  currentDistrict,
}: DistrictPriceHeatmapProps) {
  const highlightedDistrict = normalizeDistrictName(currentDistrict);
  const points = useMemo(
    () =>
      data
        .map((point) => ({
          ...point,
          price: priceValue(point),
          average: averagePrice(point),
          count: listingCount(point),
          lat: Number(point.lat),
          lng: Number(point.lng),
        }))
        .filter((point) => (
          Boolean(point.district)
          && Number.isFinite(point.lat)
          && Number.isFinite(point.lng)
          && point.price > 0
        )),
    [data],
  );

  const minPrice = useMemo(
    () => Math.min(...points.map((p) => p.price)),
    [points],
  );
  const maxPrice = useMemo(
    () => Math.max(0, ...points.map((p) => p.price)),
    [points],
  );
  const maxCount = useMemo(
    () => Math.max(1, ...points.map((p) => p.count)),
    [points],
  );
  const topFive = useMemo(
    () =>
      new Set(
        [...points].sort((a, b) => b.price - a.price).slice(0, 5).map((p) => p.district),
      ),
    [points],
  );

  if (isLoading) {
    return (
      <div className="h-[420px] rounded-xl border border-border bg-card overflow-hidden flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-rose-500 animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest text-primary/80">Loading district prices</p>
        <p className="text-xs text-muted-foreground font-medium">Mapping average asks across Sri Lanka…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface px-4 text-center">
        <p className="text-sm text-muted-foreground">
          District price data temporarily unavailable — market API returned an error.
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-primary/30 hover:text-primary-bright"
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  if (!points.length) {
    return (
      <div className="h-[420px] rounded-xl border border-border bg-surface flex items-center justify-center px-4 text-center text-muted-foreground text-sm">
        District price data unavailable — listings are not yet indexed with district coordinates.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[0.1em]">
        <div className="rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground transition-colors">
          Color = median ask, average fallback
        </div>
        <div className="rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground transition-colors">
          Size = listing volume
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-muted-foreground transition-colors">
          <span>Lower</span>
          <div className="h-1.5 w-20 rounded-full bg-gradient-to-r from-[#f59e0b] via-[#f97316] to-[#e11d48]" />
          <span className="text-rose-600 dark:text-rose-400">Higher</span>
        </div>
      </div>

      <LazyMapMount
        className="overflow-hidden rounded-xl border border-border shadow-soft"
        style={{ height: 420 }}
      >
        <MapContainer
          center={SL_CENTER}
          zoom={7.5}
          minZoom={7}
          maxZoom={12}
          maxBounds={SL_BOUNDS}
          maxBoundsViscosity={0.75}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <MapResizeController bounds={SL_BOUNDS} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            noWrap
          />

          {points.map((point) => {
            const color = priceColor(point.price, minPrice, maxPrice);
            const radius = priceRadius(point.count, maxCount);
            const isCurrent = highlightedDistrict === normalizeDistrictName(point.district);
            const shouldLabel = isCurrent || topFive.has(point.district);

            return (
              <CircleMarker
                key={point.district}
                center={[point.lat, point.lng]}
                radius={radius}
                pathOptions={{
                  color: isCurrent ? "#fef3c7" : color,
                  fillColor: color,
                  weight: isCurrent ? 3 : 1.35,
                  fillOpacity: isCurrent ? 0.85 : 0.72,
                }}
              >
                <Tooltip permanent={shouldLabel} direction="top" offset={[0, -(radius + 2)]}>
                  {point.district}
                </Tooltip>
                <Popup autoPan keepInView autoPanPaddingTopLeft={[24, 84]} autoPanPaddingBottomRight={[24, 24]}>
                  <div className="min-w-[210px] text-sm space-y-1.5">
                    <p className="font-bold text-base">{point.district}</p>
                    <p>Total listings: <span className="num">{point.count.toLocaleString()}</span></p>
                    <p>
                      Median ask:{" "}
                      <span className="num font-semibold text-rose-600">{formatPrice(point.price)}</span>
                    </p>
                    {point.average > 0 && point.average !== point.price ? (
                      <p>Average ask: <span className="num">{formatPrice(point.average)}</span></p>
                    ) : null}
                    {isCurrent ? (
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-amber-600">
                        Current district
                      </p>
                    ) : null}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </LazyMapMount>
    </div>
  );
});

DistrictPriceHeatmap.displayName = "DistrictPriceHeatmap";
