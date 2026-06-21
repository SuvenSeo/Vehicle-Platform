import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketPredictor } from "@/components/MarketPredictor";

describe("MarketPredictor", () => {
  it("renders sentiment and predictive insight blocks", () => {
    render(
      <MarketPredictor
        listingsToday={37}
        trendData={[
          { month: "Jan", median_price: 7600000, avg_price: 7750000, sample_count: 10 },
          { month: "Feb", median_price: 7480000, avg_price: 7610000, sample_count: 9 },
          { month: "Mar", median_price: 7350000, avg_price: 7520000, sample_count: 11 },
        ]}
      />,
    );

    expect(screen.getByText("Market pulse")).toBeInTheDocument();
    expect(screen.getByText("Buy timing signal")).toBeInTheDocument();
  });
});
