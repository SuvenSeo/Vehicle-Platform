import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SourceQualityScorecard } from "@/components/SourceQualityScorecard";
import type { SourceQualityResponse } from "@/types/car";

vi.mock("@/services/api", () => ({
  getSourceQuality: vi.fn(),
}));

import { getSourceQuality } from "@/services/api";

const sampleData: SourceQualityResponse = {
  generated_at: "2026-07-01T00:00:00Z",
  sources: [
    {
      source: "ikman",
      listing_count: 700,
      price_fill_rate: 0.85,
      fresh_24h_pct: 0.42,
      outlier_rate: 0.03,
      duplicate_rate: 0.01,
    },
    {
      source: "riyasewana",
      listing_count: 500,
      price_fill_rate: 0.72,
      fresh_24h_pct: 0.18,
      outlier_rate: 0.05,
      duplicate_rate: 0.02,
    },
  ],
};

describe("SourceQualityScorecard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a card for each source with its name and listing count", async () => {
    vi.mocked(getSourceQuality).mockResolvedValue(sampleData);
    render(<SourceQualityScorecard />);

    await waitFor(() => {
      expect(screen.getByText("ikman")).toBeInTheDocument();
    });
    expect(screen.getByText("riyasewana")).toBeInTheDocument();
    expect(screen.getByText(/700 listings/)).toBeInTheDocument();
    expect(screen.getByText(/500 listings/)).toBeInTheDocument();
  });

  it("formats price fill rate as percentage with one decimal", async () => {
    vi.mocked(getSourceQuality).mockResolvedValue(sampleData);
    render(<SourceQualityScorecard />);

    await waitFor(() => {
      expect(screen.getByText("ikman")).toBeInTheDocument();
    });
    expect(screen.getAllByText("85.0%").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all four metric labels for each source", async () => {
    vi.mocked(getSourceQuality).mockResolvedValue({
      generated_at: "2026-07-01T00:00:00Z",
      sources: [sampleData.sources[0]],
    });
    render(<SourceQualityScorecard />);

    await waitFor(() => {
      expect(screen.getByText("ikman")).toBeInTheDocument();
    });
    expect(screen.getByText("Price fill rate")).toBeInTheDocument();
    expect(screen.getByText("Fresh 24h")).toBeInTheDocument();
    expect(screen.getByText("Outlier rate")).toBeInTheDocument();
    expect(screen.getByText("Duplicate rate")).toBeInTheDocument();
  });

  it("shows loading skeleton while fetching", () => {
    vi.mocked(getSourceQuality).mockReturnValue(new Promise(() => {}));
    render(<SourceQualityScorecard />);

    expect(screen.queryByText("ikman")).not.toBeInTheDocument();
    expect(screen.queryByText("riyasewana")).not.toBeInTheDocument();
  });

  it("shows empty state message when no sources are returned", async () => {
    vi.mocked(getSourceQuality).mockResolvedValue({
      generated_at: "2026-07-01T00:00:00Z",
      sources: [],
    });
    render(<SourceQualityScorecard />);

    await waitFor(() => {
      expect(screen.getByText(/no source quality data available yet/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when the API call fails", async () => {
    vi.mocked(getSourceQuality).mockRejectedValue(new Error("Network error"));
    render(<SourceQualityScorecard />);

    await waitFor(() => {
      expect(screen.getByText(/no source quality data available yet/i)).toBeInTheDocument();
    });
  });

  it("formats zero rates correctly", async () => {
    vi.mocked(getSourceQuality).mockResolvedValue({
      generated_at: "2026-07-01T00:00:00Z",
      sources: [
        {
          source: "cleanSource",
          listing_count: 200,
          price_fill_rate: 1.0,
          fresh_24h_pct: 0.5,
          outlier_rate: 0.0,
          duplicate_rate: 0.0,
        },
      ],
    });
    render(<SourceQualityScorecard />);

    await waitFor(() => {
      expect(screen.getByText("cleanSource")).toBeInTheDocument();
    });
    expect(screen.getAllByText("0.0%").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("100.0%").length).toBeGreaterThanOrEqual(1);
  });
});
