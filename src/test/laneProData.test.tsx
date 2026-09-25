import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ArbitrageTable } from "@/components/ArbitrageTable";
import { FREE_GAP_LIMIT, FREE_LANE_LIMIT, gateGaps, gateLanes } from "@/lib/laneGating";
import { buildLanePackCsv, LANE_PACK_CHECKLIST } from "@/lib/laneExport";
import { estimateTransportCost, grossGapLkr, netGapLkr, resolveTransportLkr } from "@/lib/transport";
import { resolveDomDays, resolveVelocity, velocityBandForDom } from "@/lib/velocity";
import type { ProArbitrageGap } from "@/types/pro";

const gap = (overrides: Partial<ProArbitrageGap> = {}): ProArbitrageGap => ({
  buy_district: "Kandy",
  sell_district: "Colombo",
  buy_median_lkr: 6_300_000,
  sell_median_lkr: 7_300_000,
  gap_pct: 15.87,
  buy_listing_count: 8,
  sell_listing_count: 42,
  ...overrides,
});

describe("transport estimator", () => {
  it("sums fuel + driver + transfer with SL defaults", () => {
    const estimate = estimateTransportCost();
    expect(estimate.totalLkr).toBe(120 * 150 + 8000 + 15000);
    expect(estimate.totalLkr).toBe(41_000);
  });

  it("computes gross and net gaps", () => {
    expect(grossGapLkr(gap())).toBe(1_000_000);
    expect(netGapLkr(gap(), 41_000)).toBe(959_000);
  });

  it("supports flat and per-gap transport overrides", () => {
    expect(resolveTransportLkr(gap(), 10_000)).toBe(10_000);
    expect(resolveTransportLkr(gap(), (g) => (g.sell_district === "Colombo" ? 5_000 : 9_000))).toBe(5_000);
    expect(resolveTransportLkr(gap())).toBe(41_000);
  });
});

describe("trial gating", () => {
  const rows = [1, 2, 3, 4, 5];

  it("caps free visitors at 1 lane / 3 gaps", () => {
    expect(FREE_LANE_LIMIT).toBe(1);
    expect(FREE_GAP_LIMIT).toBe(3);
    expect(gateLanes(rows, false)).toEqual({ visible: [1], lockedCount: 4 });
    expect(gateGaps(rows, false)).toEqual({ visible: [1, 2, 3], lockedCount: 2 });
  });

  it("passes everything through for Pro access", () => {
    expect(gateLanes(rows, true)).toEqual({ visible: rows, lockedCount: 0 });
    expect(gateGaps(rows, true)).toEqual({ visible: rows, lockedCount: 0 });
  });
});

describe("velocity bands", () => {
  it("marks Fast <21d and Slow >65d from stats median DOM", () => {
    expect(velocityBandForDom(10)).toBe("fast");
    expect(velocityBandForDom(21)).toBe("steady");
    expect(velocityBandForDom(65)).toBe("steady");
    expect(velocityBandForDom(66)).toBe("slow");
    expect(velocityBandForDom(null)).toBe("unknown");
  });

  it("falls back to first/last-seen DOM lengths", () => {
    expect(
      resolveDomDays({ firstSeenAt: "2026-01-01T00:00:00Z", lastSeenAt: "2026-01-11T00:00:00Z" }),
    ).toBe(10);
    expect(resolveVelocity({ medianDomDays: 80 }).band).toBe("slow");
    expect(resolveVelocity({}).band).toBe("unknown");
  });
});

describe("lane pack CSV", () => {
  const input = {
    lanes: [
      {
        make: "Toyota",
        model: "Aqua",
        listing_count: 12,
        median_price_lkr: 7_650_000,
        min_price_lkr: 7_100_000,
        max_price_lkr: 8_200_000,
        avg_deal_score: 11.2,
        district_count: 2,
        source_count: 2,
        top_district: "Colombo",
        top_source: "Ikman",
      },
    ],
    gaps: [gap()],
    comps: [
      {
        id: 10,
        title: "Toyota Aqua 2018",
        make: "Toyota",
        model: "Aqua",
        year: 2018,
        price_lkr: 7_600_000,
        district: "Colombo",
        source: "Ikman",
        deal_score: 12.4,
      },
    ],
    watermark: true,
    generatedAt: "2026-05-20T10:00:00.000Z",
  };

  it("packs lane table + net gaps + comps + checklist header with watermark", () => {
    const csv = buildLanePackCsv(input);
    expect(csv).toContain("Trial watermark");
    expect(csv).toContain("Pre-transfer checklist");
    expect(csv).toContain(LANE_PACK_CHECKLIST[0]);
    expect(csv).toContain("Toyota Aqua");
    expect(csv).toContain("Arbitrage gaps (net of transport)");
    expect(csv).toContain("Comparable listings");
  });

  it("omits the watermark for Pro packs", () => {
    expect(buildLanePackCsv({ ...input, watermark: false })).not.toContain("Trial watermark");
  });
});

describe("ArbitrageTable", () => {
  const gaps = [
    gap(),
    gap({
      buy_district: "Galle",
      sell_district: "Colombo",
      buy_median_lkr: 7_000_000,
      sell_median_lkr: 7_300_000,
      gap_pct: 4.29,
      buy_listing_count: 5,
      sell_listing_count: 42,
    }),
  ];

  it("renders net-after-transport and sorts by net by default", () => {
    render(
      <MemoryRouter>
        <ArbitrageTable gaps={gaps} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Transport")).toBeInTheDocument();
    expect(screen.getByText("Net")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    // Header + 2 body rows, best net first (Kandy→Colombo).
    expect(rows).toHaveLength(3);
    expect(rows[1].textContent).toContain("Kandy");
  });

  it("re-sorts when the Gap % header is toggled", () => {
    render(
      <MemoryRouter>
        <ArbitrageTable gaps={gaps} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /sort by gap %/i }));
    fireEvent.click(screen.getByRole("button", { name: /sort by gap %/i }));
    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Galle");
  });

  it("blurs rows beyond the trial limit with a lock note", () => {
    render(
      <MemoryRouter>
        <ArbitrageTable gaps={gaps} visibleLimit={1} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/1 more gap locked/i)).toBeInTheDocument();
  });
});
