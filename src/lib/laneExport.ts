import { formatPriceLkrMillions } from "@/lib/formatting";
import { grossGapLkr, netGapLkr, resolveTransportLkr, type TransportForGap } from "@/lib/transport";
import type { ProArbitrageGap, ProListingSample, ProVehicleLane } from "@/types/pro";

export type LanePackFormat = "csv" | "pdf";

/** Pre-transfer checklist stamped into the head of every lane pack. */
export const LANE_PACK_CHECKLIST = [
  "Verify registration book + revenue licence match chassis/engine numbers",
  "Check lease/loan settlement + RMV liens before paying any deposit",
  "Confirm service history + accident repair record with the seller",
  "Re-price against the lane median after deducting transport + transfer",
  "Budget the buy-district → sell-district move (fuel + driver + transfer)",
  "File this pack with the offer — medians move as fresh supply lands",
];

export interface LanePackInput {
  lanes: ProVehicleLane[];
  gaps: ProArbitrageGap[];
  /** Comparable listings (e.g. lane sample listings / top opportunities). */
  comps: ProListingSample[];
  /** Trial-gated packs are stamped with a trial watermark. */
  watermark: boolean;
  transport?: TransportForGap;
  laneLabel?: string;
  generatedAt?: string;
}

function cleanCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "N/A";
  return String(value).replace(/\s+/g, " ").trim();
}

function csvCell(value: unknown): string {
  const text = cleanCell(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function packTitle(input: LanePackInput): string {
  return input.laneLabel ? `Motormila Lane Pack — ${input.laneLabel}` : "Motormila Lane Pack";
}

function laneRow(lane: ProVehicleLane): string[] {
  return [
    `${lane.make} ${lane.model}`.trim(),
    String(lane.listing_count),
    lane.median_price_lkr ? formatPriceLkrMillions(lane.median_price_lkr) : "N/A",
    `${lane.min_price_lkr ? formatPriceLkrMillions(lane.min_price_lkr) : "N/A"} - ${lane.max_price_lkr ? formatPriceLkrMillions(lane.max_price_lkr) : "N/A"}`,
    lane.avg_deal_score?.toFixed(1) || "N/A",
    lane.top_district || "N/A",
    lane.top_source || "N/A",
  ];
}

function gapRow(gap: ProArbitrageGap, transport?: TransportForGap): string[] {
  const transportLkr = resolveTransportLkr(gap, transport);
  return [
    gap.buy_district,
    gap.sell_district,
    formatPriceLkrMillions(gap.buy_median_lkr),
    formatPriceLkrMillions(gap.sell_median_lkr),
    `+${gap.gap_pct.toFixed(1)}%`,
    formatPriceLkrMillions(transportLkr),
    formatPriceLkrMillions(netGapLkr(gap, transportLkr)),
    formatPriceLkrMillions(grossGapLkr(gap)),
  ];
}

function compRow(comp: ProListingSample): string[] {
  return [
    `${comp.make} ${comp.model}`.trim(),
    comp.year ? String(comp.year) : "N/A",
    comp.price_lkr ? formatPriceLkrMillions(comp.price_lkr) : "N/A",
    comp.district || "Sri Lanka",
    comp.source,
    comp.deal_score != null ? String(comp.deal_score) : "N/A",
  ];
}

/** Pure builder — covered by unit tests, no DOM/browser dependency. */
export function buildLanePackCsv(input: LanePackInput): string {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const lines: string[][] = [
    [packTitle(input)],
    ["Generated", generatedAt],
    ...(input.watermark ? [["Trial watermark — upgrade to Pro for the full unwatermarked pack"]] : []),
    [],
    ["Pre-transfer checklist"],
    ...LANE_PACK_CHECKLIST.map((item, index) => [`${index + 1}. ${item}`]),
    [],
    ["Lane table"],
    ["Vehicle", "Listings", "Median", "Range", "Avg Deal", "Top District", "Top Source"],
    ...input.lanes.map(laneRow),
    [],
    ["Arbitrage gaps (net of transport)"],
    ["Buy in", "Sell in", "Buy median", "Sell median", "Gap %", "Transport", "Net", "Gross"],
    ...input.gaps.map((gap) => gapRow(gap, input.transport)),
    [],
    ["Comparable listings"],
    ["Vehicle", "Year", "Price", "District", "Source", "Deal Score"],
    ...input.comps.map(compRow),
    [],
    ["Disclaimer", "Asking-price medians from public listings — decision support, not a valuation."],
  ];
  return lines.map((row) => row.map(csvCell).join(",")).join("\n");
}

function packFilename(input: LanePackInput, extension: string): string {
  const slug = (input.laneLabel || "lane-pack").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "lane-pack";
  return `motormila-${slug}-${new Date(input.generatedAt || Date.now()).toISOString().slice(0, 10)}.${extension}`;
}

export async function downloadLanePackCsv(input: LanePackInput): Promise<void> {
  const { saveAs } = await import("file-saver");
  saveAs(
    new Blob([buildLanePackCsv(input)], { type: "text/csv;charset=utf-8" }),
    packFilename(input, "csv"),
  );
}

export async function downloadLanePackPdf(input: LanePackInput): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const generatedAt = input.generatedAt || new Date().toISOString();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(packTitle(input), 40, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 110, 112);
  doc.text(`Generated ${new Date(generatedAt).toLocaleString("en-LK")}`, 40, y);
  y += 16;
  if (input.watermark) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(176, 119, 35);
    doc.text("TRIAL PACK — upgrade to Pro for the full unwatermarked pack", 40, y);
    y += 18;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 27, 31);
  doc.text("Pre-transfer checklist", 40, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(53, 65, 62);
  for (const [index, item] of LANE_PACK_CHECKLIST.entries()) {
    const wrapped = doc.splitTextToSize(`${index + 1}. ${item}`, pageWidth - 80) as string[];
    doc.text(wrapped, 40, y + 12);
    y += 12 + (wrapped.length - 1) * 11;
  }
  y += 16;

  const tables: Array<{ title: string; columns: string[]; rows: string[][] }> = [
    {
      title: "Lane table",
      columns: ["Vehicle", "Listings", "Median", "Range", "Avg Deal", "Top District", "Top Source"],
      rows: input.lanes.map(laneRow),
    },
    {
      title: "Arbitrage gaps (net of transport)",
      columns: ["Buy in", "Sell in", "Buy median", "Sell median", "Gap %", "Transport", "Net", "Gross"],
      rows: input.gaps.map((gap) => gapRow(gap, input.transport)),
    },
    {
      title: "Comparable listings",
      columns: ["Vehicle", "Year", "Price", "District", "Source", "Deal Score"],
      rows: input.comps.map(compRow),
    },
  ];

  for (const table of tables) {
    if (!table.rows.length) continue;
    if (y > pageHeight - 170) {
      doc.addPage();
      y = 56;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 27, 31);
    doc.text(table.title, 40, y);
    y += 8;
    autoTable(doc, {
      head: [table.columns],
      body: table.rows,
      startY: y,
      margin: { left: 40, right: 40 },
      styles: { font: "helvetica", fontSize: 8, cellPadding: 6, textColor: [36, 44, 48] },
      headStyles: { fillColor: [11, 18, 26], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [242, 247, 244] },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || y) + 28;
  }

  if (input.watermark) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(64);
    doc.setTextColor(176, 119, 35);
    doc.text("TRIAL", pageWidth / 2, pageHeight / 2, { align: "center", angle: 32 });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(107, 118, 117);
  doc.text("Asking-price medians from public listings — decision support, not a valuation.", 40, pageHeight - 30);
  doc.save(packFilename(input, "pdf"));
}

/** One-click lane pack export: lane table + net gaps + comps + checklist header. */
export async function exportLanePack(input: LanePackInput, format: LanePackFormat): Promise<void> {
  if (format === "csv") {
    await downloadLanePackCsv(input);
    return;
  }
  await downloadLanePackPdf(input);
}
