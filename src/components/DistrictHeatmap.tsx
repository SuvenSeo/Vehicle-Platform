import { memo } from "react";
import { DistrictPrice } from "@/types/car";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import { formatPriceLkrMillions } from "@/lib/formatting";

interface DistrictHeatmapProps {
  data: DistrictPrice[];
  selectedDistrict?: string;
  onDistrictSelect?: (district: string) => void;
}

const SL_BOUNDS: [[number, number], [number, number]] = [[5.9, 79.5], [9.9, 81.9]];
const SL_CENTER: [number, number] = [7.8731, 80.7718];

function getColorByPrice(price: number, minPrice: number, maxPrice: number): string {
  if (maxPrice === minPrice) return "#7c9cbf";
  const ratio = (price - minPrice) / (maxPrice - minPrice);
  if (ratio > 0.72) return "#e05c5c";
  if (ratio > 0.45) return "#d4924a";
  if (ratio > 0.22) return "#4fae8a";
  return "#7c9cbf";
}

function getRadius(count: number, maxCount: number): number {
  const ratio = count / maxCount;
  return Math.max(7, Math.min(27, ratio * 30 + 7));
}

function MapController() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.fitBounds(SL_BOUNDS, { padding: [16, 16] });
  }, [map]);
  return null;
}

export const DistrictHeatmap = memo(function DistrictHeatmap({ data, selectedDistrict, onDistrictSelect }: DistrictHeatmapProps) {
  const points = data.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const topLabelDistricts = new Set(
    [...points]
      .sort((a, b) => b.listing_count - a.listing_count)
      .slice(0, 5)
      .map((point) => point.district),
  );
  const maxCount = Math.max(...points.map((p) => p.listing_count), 1);
  const prices = points.map((p) => p.avg_price);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 1;

  if (points.length === 0) {
    return (
      <div className="h-[420px] rounded-xl border border-border bg-black/30 flex items-center justify-center text-muted-foreground text-sm">
        No geo points available yet. Run sync and ensure district mapping exists.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 tech-label text-muted-foreground">
        <span>Color = avg price</span>
        <span className="text-foreground">•</span>
        <span>Size = volume</span>
        <span className="text-foreground">•</span>
        <span>Click district to filter</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 tech-label font-bold">
        <div className="flex items-center gap-2 rounded-full border border-border bg-black/30 px-3 py-1.5 text-muted-foreground">
          <span>Low</span>
          <div className="h-1.5 w-24 rounded-full bg-gradient-to-r from-[#7c9cbf] via-[#4fae8a] via-[#d4924a] to-[#e05c5c]" />
          <span>Hot</span>
        </div>
        {selectedDistrict && (
          <button
            type="button"
            onClick={() => onDistrictSelect?.(selectedDistrict)}
            className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-primary"
          >
            Selected: {selectedDistrict} (clear)
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border" style={{ height: 420 }}>
        <MapContainer
          center={SL_CENTER}
          zoom={7.5}
          minZoom={7}
          maxZoom={12}
          maxBounds={SL_BOUNDS}
          maxBoundsViscosity={1.0}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <MapController />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            noWrap={true}
          />

          {points.map((pt) => {
            const radius = getRadius(pt.listing_count, maxCount);
            const color = getColorByPrice(pt.avg_price, minPrice, maxPrice);
            const isSelected = selectedDistrict === pt.district;

            return (
              <CircleMarker
                key={pt.district}
                center={[pt.lat, pt.lng]}
                radius={isSelected ? radius + 4 : radius}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.78,
                  color: isSelected ? "#ffffff" : color,
                  weight: isSelected ? 3 : 1.5,
                  opacity: 0.95,
                }}
                eventHandlers={{
                  click: () => onDistrictSelect?.(pt.district),
                }}
              >
                <Tooltip permanent={isSelected || topLabelDistricts.has(pt.district)} direction="top" offset={[0, -(radius + 4)]}>
                  {pt.district}
                </Tooltip>
                <Popup>
                  <div className="text-sm min-w-[150px]">
                    <p className="font-bold mb-1">{pt.district}</p>
                    <p>{pt.listing_count} listings</p>
                    <p>Avg: {formatPriceLkrMillions(pt.avg_price)}</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
});

DistrictHeatmap.displayName = "DistrictHeatmap";
