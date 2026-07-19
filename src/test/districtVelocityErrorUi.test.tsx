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
  LazyMapMount: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/leaflet/MapResizeController", () => ({
  MapResizeController: () => null,
}));

import { DistrictVelocityMap } from "@/components/DistrictVelocityMap";
import { ProvinceVelocityStrip } from "@/components/ProvinceVelocityStrip";

describe("district velocity error UI", () => {
  it("shows retry action on province strip when the API errors", () => {
    const onRetry = vi.fn();

    render(<ProvinceVelocityStrip data={[]} isError onRetry={onRetry} />);

    expect(
      screen.getByText(/Province velocity temporarily unavailable/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows retry action on district map when the API errors", () => {
    const onRetry = vi.fn();

    render(<DistrictVelocityMap data={[]} isError onRetry={onRetry} />);

    expect(
      screen.getByText(/Velocity data temporarily unavailable/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the empty indexed copy when there is no error and no points", () => {
    render(<DistrictVelocityMap data={[]} />);
    expect(
      screen.getByText(/listings not yet indexed with district timestamps/i),
    ).toBeInTheDocument();
  });
});
