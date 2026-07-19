import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { DistrictPrice } from "@/types/car";
import { formatPrice } from "@/services/api";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import { revealItem } from "@/lib/motion";
import { LazyMapMount } from "@/components/leaflet/LazyMapMount";
import { MapResizeController } from "@/components/leaflet/MapResizeController";

interface MarketMapProps {
  data: DistrictPrice[];
  selectedDistrict?: string;
  onDistrictSelect?: (district: string) => void;
  isLoading?: boolean;
}

const SL_BOUNDS: [[number, number], [number, number]] = [[5.7, 79.2], [10.35, 82.15]];
const SL_CENTER: [number, number] = [7.8731, 80.7718];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toRgb(hex: string) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function lerpColor(from: string, to: string, ratio: number) {
  const start = toRgb(from);
  const end = toRgb(to);
  const t = clamp(ratio, 0, 1);
  const r = Math.round(start.r + (end.r - start.r) * t);
  const g = Math.round(start.g + (end.g - start.g) * t);
  const b = Math.round(start.b + (end.b - start.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function mapColor(value: number, min: number, max: number) {
  if (max <= min) return "rgb(72, 85, 99)";
  const ratio = (value - min) / (max - min);
  return lerpColor("#3f4755", "#d89b35", ratio);
}

function mapRadius(listingCount: number, maxCount: number) {
  if (maxCount <= 0) return 8;
  const ratio = listingCount / maxCount;
  return clamp(8 + ratio * 14, 8, 22);
}

export const MarketMap = memo(function MarketMap({ data, selectedDistrict, onDistrictSelect, isLoading }: MarketMapProps) {
  const points = useMemo(
    () => data.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)),
    [data],
  );

  const maxCount = Math.max(1, ...points.map((point) => point.listing_count));
  const minPrice = points.length ? Math.min(...points.map((point) => point.avg_price)) : 0;
  const maxPrice = points.length ? Math.max(...points.map((point) => point.avg_price)) : 1;

  if (isLoading) {
    return (
      <div className="h-[420px] rounded-xl border border-border bg-surface overflow-hidden relative flex flex-col items-center justify-center space-y-4">
        <div className="relative flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-4" />
          <p className="text-sm font-bold uppercase tracking-widest text-primary/80">Syncing Geo Intelligence</p>
          <p className="text-xs text-muted-foreground mt-2 font-medium">Aggregating market density data across districts...</p>
        </div>
      </div>
    );
  }

  if (!points.length) {
    return (
      <div className="h-[420px] rounded-xl border border-border bg-surface flex items-center justify-center text-muted-foreground text-sm">
        Market intelligence map is waiting for district geo data.
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-4"
      variants={revealItem}
      initial="hidden"
      animate="show"
    >
      <div className="flex flex-wrap items-center gap-3 tech-label font-bold">
        <div className="rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground transition-colors">Price concentration: lower to higher</div>
        <div className="rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground transition-colors">Click any district for detail</div>
      </div>

      <LazyMapMount
        className="overflow-hidden rounded-xl border border-border transition-colors"
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
            const color = mapColor(point.avg_price, minPrice, maxPrice);
            const radius = mapRadius(point.listing_count, maxCount);
            const isSelected = selectedDistrict === point.district;
            const topModelLabel = point.top_make && point.top_model
              ? `${point.top_make} ${point.top_model}`
              : point.top_model || "No dominant model signal yet";
            const topModelMeta = Number(point.top_model_count || 0) > 0
              ? `${Number(point.top_model_count).toLocaleString()} listings`
              : null;

            return (
              <CircleMarker
                key={point.district}
                center={[point.lat, point.lng]}
                radius={isSelected ? radius + 3 : radius}
                pathOptions={{
                  color: isSelected ? "#e5e7eb" : color,
                  fillColor: color,
                  weight: isSelected ? 2.2 : 1.3,
                  fillOpacity: 0.62,
                }}
                eventHandlers={{ click: () => onDistrictSelect?.(point.district) }}
              >
                <Tooltip direction="top" offset={[0, -(radius + 2)]}>
                  {point.district}
                </Tooltip>
                <Popup
                  autoPan
                  keepInView
                  autoPanPaddingTopLeft={[24, 84]}
                  autoPanPaddingBottomRight={[24, 24]}
                >
                  <div className="min-w-[220px] text-sm space-y-1.5">
                    <p className="font-bold text-base">{point.district}</p>
                    <p>Total Listings: <span className="num">{point.listing_count.toLocaleString()}</span></p>
                    <p>
                      Top Model: {topModelLabel}
                      {topModelMeta ? <span className="text-xs text-muted-foreground num"> ({topModelMeta})</span> : null}
                    </p>
                    <p>Avg. Price: <span className="num">{formatPrice(point.avg_price)}</span></p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </LazyMapMount>
    </motion.div>
  );
});

MarketMap.displayName = "MarketMap";
