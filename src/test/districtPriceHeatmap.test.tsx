import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-leaflet", () => ({
  MapContainer: () => null,
  TileLayer: () => null,
  CircleMarker: () => null,
  Popup: () => null,
  Tooltip: () => null,
  useMap: () => ({ invalidateSize: vi.fn() }),
}));

vi.mock("@/components/leaflet/LazyMapMount", () => ({
  LazyMapMount: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="lazy-map-mount">{children}</div>
  ),
}));

vi.mock("@/components/leaflet/MapResizeController", () => ({
  MapResizeController: () => null,
}));

import { DistrictPriceHeatmap } from "@/components/DistrictPriceHeatmap";
import type { DistrictPrice } from "@/types/car";

const DISTRICT_PRICES: DistrictPrice[] = [
  { district: "Colombo", avg_price: 9_500_000, listing_count: 180, lat: 6.9271, lng: 79.8612 },
  { district: "Kandy", avg_price: 7_800_000, listing_count: 65, lat: 7.2906, lng: 80.6337 },
  { district: "Galle", avg_price: 6_200_000, listing_count: 42, lat: 6.0535, lng: 80.2210 },
  { district: "Jaffna", avg_price: 5_100_000, listing_count: 28, lat: 9.6615, lng: 80.0255 },
];

describe("DistrictPriceHeatmap", () => {
  it("renders the map when data is available", () => {
    render(<DistrictPriceHeatmap data={DISTRICT_PRICES} />);
    expect(screen.getByTestId("lazy-map-mount")).toBeInTheDocument();
  });

  it("shows min/max price legend", () => {
    render(<DistrictPriceHeatmap data={DISTRICT_PRICES} />);
    expect(screen.getByText(/Min:/i)).toBeInTheDocument();
    expect(screen.getByText(/Max:/i)).toBeInTheDocument();
  });

  it("shows color scale legend labels", () => {
    render(<DistrictPriceHeatmap data={DISTRICT_PRICES} />);
    expect(screen.getByText(/Color = avg district price/i)).toBeInTheDocument();
  });

  it("renders empty state when no data is provided", () => {
    render(<DistrictPriceHeatmap data={[]} />);
    expect(
      screen.getByText(/District price data unavailable/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("lazy-map-mount")).not.toBeInTheDocument();
  });

  it("renders loading state", () => {
    render(<DistrictPriceHeatmap data={[]} isLoading />);
    expect(screen.getByText(/Loading price map/i)).toBeInTheDocument();
  });

  it("renders error state with retry button", () => {
    const onRetry = vi.fn();
    render(<DistrictPriceHeatmap data={[]} isError onRetry={onRetry} />);

    expect(
      screen.getByText(/District price data temporarily unavailable/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("filters out data points with non-finite coordinates", () => {
    const withInvalid: DistrictPrice[] = [
      ...DISTRICT_PRICES,
      { district: "Invalid", avg_price: 5_000_000, listing_count: 5, lat: Number.NaN, lng: 80.0 },
    ];
    render(<DistrictPriceHeatmap data={withInvalid} />);
    // Map renders since valid points remain
    expect(screen.getByTestId("lazy-map-mount")).toBeInTheDocument();
  });

  it("renders with median_price data", () => {
    const withMedian: DistrictPrice[] = DISTRICT_PRICES.map((d, i) => ({
      ...d,
      median_price: d.avg_price - i * 100_000,
    }));
    render(<DistrictPriceHeatmap data={withMedian} />);
    expect(screen.getByTestId("lazy-map-mount")).toBeInTheDocument();
  });
});
