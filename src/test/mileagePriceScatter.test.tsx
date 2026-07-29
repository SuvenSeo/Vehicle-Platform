import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("recharts", () => ({
  ScatterChart: ({ children }: { children: React.ReactNode }) => <div data-testid="scatter-chart">{children}</div>,
  Scatter: () => <div data-testid="scatter-dots" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

import { MileagePriceScatter } from "@/components/MileagePriceScatter";

const POINTS = [
  { mileage: 45000, price_lkr: 8_500_000, id: 1, label: "Toyota Prius 2018" },
  { mileage: 62000, price_lkr: 7_900_000, id: 2, label: "Toyota Prius 2017" },
  { mileage: 30000, price_lkr: 9_200_000, id: 3, label: "Toyota Prius 2019" },
  { mileage: 80000, price_lkr: 6_500_000, id: 4, label: "Toyota Prius 2016" },
];

describe("MileagePriceScatter", () => {
  it("renders the scatter chart with enough points", () => {
    render(<MileagePriceScatter points={POINTS} title="Toyota Prius — mileage vs. price" />);

    expect(screen.getByTestId("scatter-chart")).toBeInTheDocument();
    expect(screen.getByTestId("scatter-dots")).toBeInTheDocument();
  });

  it("shows the title label", () => {
    render(<MileagePriceScatter points={POINTS} title="Toyota Prius — mileage vs. price" />);
    expect(screen.getByText("Toyota Prius — mileage vs. price")).toBeInTheDocument();
  });

  it("shows a listing count badge", () => {
    render(<MileagePriceScatter points={POINTS} />);
    expect(screen.getByText(`${POINTS.length} listings`)).toBeInTheDocument();
  });

  it("renders empty state when fewer than 3 valid points", () => {
    render(
      <MileagePriceScatter
        points={[
          { mileage: 50000, price_lkr: 8_000_000 },
          { mileage: 70000, price_lkr: 7_200_000 },
        ]}
        title="Not enough data"
      />,
    );

    expect(screen.getByText("Not enough data")).toBeInTheDocument();
    expect(screen.getByText(/minimum 3 required/i)).toBeInTheDocument();
    expect(screen.queryByTestId("scatter-chart")).not.toBeInTheDocument();
  });

  it("renders empty state with no points", () => {
    render(<MileagePriceScatter points={[]} title="No data chart" />);

    expect(screen.getByText("No data chart")).toBeInTheDocument();
    expect(screen.getByText(/minimum 3 required/i)).toBeInTheDocument();
  });

  it("filters out points with non-finite mileage", () => {
    const mixedPoints = [
      ...POINTS,
      { mileage: Number.NaN, price_lkr: 5_000_000 },
      { mileage: -1, price_lkr: 4_000_000 },
    ];
    render(<MileagePriceScatter points={mixedPoints} title="Mixed data" />);

    // Should still render the chart since 4 valid points remain
    expect(screen.getByTestId("scatter-chart")).toBeInTheDocument();
    // Badge should show only the valid count
    expect(screen.getByText(`${POINTS.length} listings`)).toBeInTheDocument();
  });

  it("uses default title when none provided", () => {
    render(<MileagePriceScatter points={POINTS} />);
    expect(screen.getByText("Mileage vs. Price")).toBeInTheDocument();
  });
});
