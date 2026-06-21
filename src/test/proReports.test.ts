import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProReportPayload } from "@/types/pro";

const mocks = vi.hoisted(() => ({
  saveAs: vi.fn(),
  autoTable: vi.fn((doc: any) => {
    doc.lastAutoTable = { finalY: 160 };
  }),
  pdfSave: vi.fn(),
  packer: vi.fn(async () => new Blob(["docx"])),
}));

vi.mock("file-saver", () => ({
  saveAs: mocks.saveAs,
}));

vi.mock("jspdf", () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    internal: {
      pageSize: {
        getWidth: vi.fn(() => 595),
        getHeight: vi.fn(() => 842),
      },
    },
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setFillColor: vi.fn(),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    text: vi.fn(),
    rect: vi.fn(),
    roundedRect: vi.fn(),
    line: vi.fn(),
    addPage: vi.fn(),
    getNumberOfPages: vi.fn(() => 1),
    splitTextToSize: vi.fn((text: string) => [text]),
    save: mocks.pdfSave,
  })),
}));

vi.mock("jspdf-autotable", () => ({
  default: mocks.autoTable,
}));

vi.mock("docx", () => ({
  Document: vi.fn().mockImplementation((options) => ({ options })),
  HeadingLevel: { TITLE: "title", HEADING_2: "heading2" },
  Packer: { toBlob: mocks.packer },
  Paragraph: vi.fn().mockImplementation((options) => ({ options })),
  Table: vi.fn().mockImplementation((options) => ({ options })),
  TableCell: vi.fn().mockImplementation((options) => ({ options })),
  TableRow: vi.fn().mockImplementation((options) => ({ options })),
  TextRun: vi.fn().mockImplementation((options) => ({ options })),
  WidthType: { PERCENTAGE: "pct" },
}));

import { buildProReportCsv, buildProReportJson, customizeProReport, exportProReport } from "@/lib/proReports";

const report: ProReportPayload = {
  title: "Toyota Aqua, Colombo",
  subtitle: "Vehicle lane report",
  scope: "vehicle_lane",
  generatedAt: "2026-05-20T10:00:00Z",
  metrics: [
    { label: "Listings", value: "12", detail: "Priced inventory" },
    { label: "Median", value: "Rs. 7.8M" },
  ],
  breakdowns: [
    {
      title: "Source Mix",
      rows: [{ label: "Ikman", count: 8, share_pct: 66.7, avg_price_lkr: 7_800_000 }],
    },
  ],
  listings: [
    {
      id: 1,
      title: "Toyota Aqua 2018",
      make: "Toyota",
      model: "Aqua",
      year: 2018,
      price_lkr: 7_800_000,
      district: "Colombo",
      source: "Ikman",
      deal_score: 10.2,
    },
  ],
};

describe("pro report exports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds CSV and JSON report payloads with disclaimer metadata", () => {
    const csv = buildProReportCsv(report);
    const json = buildProReportJson(report);

    expect(csv).toContain('"Toyota Aqua, Colombo"');
    expect(csv).toContain("Source Mix");
    expect(csv).toContain("AutoLens LK aggregates public Sri Lanka vehicle marketplace data");

    const parsed = JSON.parse(json);
    expect(parsed.title).toBe(report.title);
    expect(parsed.disclaimer).toMatch(/decision support/i);
  });

  it("customizes sections, theme, and report metadata before export", () => {
    const custom = customizeProReport(report, {
      title: "Dealer board pack",
      preparedFor: "AutoLens Owner",
      theme: "dealer-slate",
      sections: ["metrics", "disclaimer"],
      includeFilters: false,
    });
    const csv = buildProReportCsv(custom);
    const parsed = JSON.parse(buildProReportJson(custom));

    expect(custom.title).toBe("Dealer board pack");
    expect(custom.theme).toBe("dealer-slate");
    expect(csv).toContain("Dealer board pack");
    expect(csv).toContain("AutoLens Owner");
    expect(csv).not.toContain("Source Mix");
    expect(csv).not.toContain("Sample Listings");
    expect(parsed.sections).toEqual(["metrics", "disclaimer"]);
  });

  it("dispatches CSV, JSON, PDF, and Word exports through the expected generators", async () => {
    await exportProReport(report, "csv");
    await exportProReport(report, "json");
    await exportProReport(report, "pdf");
    await exportProReport(report, "docx");

    expect(mocks.saveAs).toHaveBeenCalledTimes(3);
    expect(mocks.autoTable).toHaveBeenCalled();
    expect(mocks.pdfSave).toHaveBeenCalled();
    expect(mocks.packer).toHaveBeenCalled();
  });
});
