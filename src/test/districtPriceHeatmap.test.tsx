import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="price-map">{children}</div>,
  TileLayer: () => null,
  CircleMarker: ({ children }: { children: ReactNode }) => <div data-testid="price-marker">{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  useMap: () => ({ invalidateSize: vi.fn() }),
}));

vi.mock("@/components/leaflet/LazyMapMount", () => ({
  LazyMapMount: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/leaflet/MapResizeController", () => ({
  MapResizeController: () => null,
}));

import { DistrictPriceHeatmap } from "@/components/DistrictPriceHeatmap";

describe("DistrictPriceHeatmap", () => {
  it("shows a loading state while district prices load", () => {
    render(<DistrictPriceHeatmap data={[]} isLoading />);

    expect(screen.getByText(/Loading district prices/i)).toBeInTheDocument();
    expect(screen.getByText(/Mapping average asks across Sri Lanka/i)).toBeInTheDocument();
  });

  it("renders district price points and highlights the current district", () => {
    render(
      <DistrictPriceHeatmap
        currentDistrict="Colombo"
        data={[
          {
            district: "Colombo",
            avg_price_lkr: 12_000_000,
            median_price_lkr: 11_500_000,
            listing_count: 120,
            lat: 6.9271,
            lng: 79.8612,
          },
          {
            district: "Kandy",
            avg_price_lkr: 9_000_000,
            median_price_lkr: 8_500_000,
            listing_count: 60,
            lat: 7.2906,
            lng: 80.6337,
          },
        ]}
      />,
    );

    expect(screen.getByText(/Color = median ask/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("price-marker")).toHaveLength(2);
    expect(screen.getAllByText("Colombo").length).toBeGreaterThan(0);
    expect(screen.getByText(/Current district/i)).toBeInTheDocument();
  });

  it("shows retry action when district price data errors", () => {
    const onRetry = vi.fn();

    render(<DistrictPriceHeatmap data={[]} isError onRetry={onRetry} />);

    expect(screen.getByText(/District price data temporarily unavailable/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
