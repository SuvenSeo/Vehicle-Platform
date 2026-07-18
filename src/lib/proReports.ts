import type {
  ProExportFormat,
  ProListingSample,
  ProReportOptions,
  ProReportPayload,
  ProReportSectionId,
  ProReportTheme,
} from "@/types/pro";
import type { FileChild } from "docx";
import { formatPriceLkrMillions } from "@/lib/formatting";

type JsPDFDoc = import("jspdf").jsPDF;

const DATA_DISCLAIMER =
  "MilaMark aggregates public Sri Lanka vehicle marketplace data. Treat outputs as decision support, not a binding valuation or offer.";

const DEFAULT_SECTIONS: ProReportSectionId[] = ["metrics", "breakdowns", "trends", "listings", "table", "filters", "disclaimer"];

const REPORT_THEMES: Record<
  ProReportTheme,
  {
    name: string;
    ink: [number, number, number];
    panel: [number, number, number];
    muted: [number, number, number];
    paper: [number, number, number];
    accent: [number, number, number];
    accent2: [number, number, number];
    gold: [number, number, number];
    text: [number, number, number];
    softText: [number, number, number];
  }
> = {
  "executive-dark": {
    name: "Executive dark",
    ink: [6, 10, 12],
    panel: [18, 24, 27],
    muted: [83, 96, 102],
    paper: [248, 250, 247],
    accent: [18, 194, 139],
    accent2: [78, 161, 255],
    gold: [218, 173, 82],
    text: [245, 248, 246],
    softText: [184, 193, 190],
  },
  "board-light": {
    name: "Board light",
    ink: [22, 30, 34],
    panel: [238, 243, 239],
    muted: [107, 118, 117],
    paper: [252, 252, 248],
    accent: [9, 145, 112],
    accent2: [28, 88, 164],
    gold: [176, 119, 35],
    text: [20, 27, 31],
    softText: [96, 107, 110],
  },
  "dealer-slate": {
    name: "Dealer slate",
    ink: [11, 18, 26],
    panel: [27, 39, 52],
    muted: [92, 111, 126],
    paper: [247, 249, 251],
    accent: [14, 165, 233],
    accent2: [52, 211, 153],
    gold: [245, 158, 11],
    text: [242, 247, 250],
    softText: [184, 198, 207],
  },
};

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

function htmlCell(value: unknown): string {
  return cleanCell(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeSections(sections?: ProReportSectionId[]): ProReportSectionId[] {
  return sections?.length ? sections : DEFAULT_SECTIONS;
}

function hasSection(report: ProReportPayload, section: ProReportSectionId): boolean {
  return normalizeSections(report.sections).includes(section);
}

function shouldIncludeDisclaimer(report: ProReportPayload): boolean {
  return report.includeDisclaimer !== false && hasSection(report, "disclaimer");
}

function themeFor(report: ProReportPayload) {
  return REPORT_THEMES[report.theme || "executive-dark"] || REPORT_THEMES["executive-dark"];
}

function listingRows(listings: ProListingSample[] = []): string[][] {
  return listings.map((listing) => [
    `${listing.make} ${listing.model}`.trim(),
    listing.year ? String(listing.year) : "N/A",
    listing.price_lkr ? formatPriceLkrMillions(listing.price_lkr) : "N/A",
    listing.district || "Sri Lanka",
    listing.source,
    listing.deal_score != null ? String(listing.deal_score) : "N/A",
  ]);
}

function reportTables(report: ProReportPayload): Array<{ title: string; columns: string[]; rows: string[][] }> {
  const tables: Array<{ title: string; columns: string[]; rows: string[][] }> = [];

  if (hasSection(report, "metrics") && report.metrics?.length) {
    tables.push({
      title: "Metrics",
      columns: ["Metric", "Value", "Detail"],
      rows: report.metrics.map((metric) => [metric.label, metric.value, metric.detail || ""]),
    });
  }

  if (hasSection(report, "breakdowns")) {
    for (const breakdown of report.breakdowns || []) {
      if (!breakdown.rows.length) continue;
      tables.push({
        title: breakdown.title,
        columns: ["Label", "Count", "Share", "Average Price", "Latest Seen"],
        rows: breakdown.rows.map((row) => [
          row.label,
          row.count.toLocaleString(),
          `${row.share_pct.toFixed(1)}%`,
          row.avg_price_lkr ? formatPriceLkrMillions(row.avg_price_lkr) : "N/A",
          row.latest_seen_at ? new Date(row.latest_seen_at).toLocaleDateString("en-LK") : "N/A",
        ]),
      });
    }
  }

  if (hasSection(report, "trends") && report.trends?.length) {
    tables.push({
      title: "Trend Points",
      columns: ["Month", "Median", "Average", "Samples"],
      rows: report.trends.map((point) => [
        point.month,
        point.median_price_lkr ? formatPriceLkrMillions(point.median_price_lkr) : "N/A",
        point.avg_price_lkr ? formatPriceLkrMillions(point.avg_price_lkr) : "N/A",
        point.listing_count.toLocaleString(),
      ]),
    });
  }

  if (hasSection(report, "listings") && report.listings?.length) {
    tables.push({
      title: "Sample Listings",
      columns: ["Vehicle", "Year", "Price", "District", "Source", "Deal Score"],
      rows: listingRows(report.listings),
    });
  }

  if (hasSection(report, "table") && report.table?.rows.length) {
    tables.push({
      title: report.table.title,
      columns: report.table.columns,
      rows: report.table.rows.map((row) => row.map(cleanCell)),
    });
  }

  return tables;
}

export function customizeProReport(report: ProReportPayload, options: ProReportOptions = {}): ProReportPayload {
  const sections = normalizeSections(options.sections || report.sections);
  const selected = new Set(sections);
  const listingLimit = Math.max(1, Math.min(80, Math.floor(options.listingLimit || report.listings?.length || 12)));
  const includeFilters = options.includeFilters ?? selected.has("filters");
  const includeDisclaimer = options.includeDisclaimer ?? selected.has("disclaimer");

  return {
    ...report,
    title: options.title?.trim() || report.title,
    subtitle: options.subtitle?.trim() || report.subtitle,
    preparedFor: options.preparedFor?.trim() || report.preparedFor,
    notes: options.notes?.trim() || report.notes,
    coverSummary: options.coverSummary?.trim() || report.coverSummary,
    theme: options.theme || report.theme || "executive-dark",
    sections,
    includeDisclaimer,
    filters: includeFilters ? report.filters : undefined,
    metrics: selected.has("metrics") ? report.metrics : undefined,
    breakdowns: selected.has("breakdowns") ? report.breakdowns : undefined,
    trends: selected.has("trends") ? report.trends : undefined,
    listings: selected.has("listings") ? (report.listings || []).slice(0, listingLimit) : undefined,
    table: selected.has("table") ? report.table : undefined,
  };
}

export function buildProReportCsv(report: ProReportPayload): string {
  const lines = [
    ["MilaMark Pro Report"],
    ["Title", report.title],
    ["Subtitle", report.subtitle || ""],
    ["Prepared for", report.preparedFor || ""],
    ["Generated", report.generatedAt],
    ["Scope", report.scope],
    ["Theme", themeFor(report).name],
    [],
  ];

  if (hasSection(report, "filters") && report.filters && Object.keys(report.filters).length) {
    lines.push(["Filters"]);
    Object.entries(report.filters).forEach(([key, value]) => {
      lines.push([key, cleanCell(value)]);
    });
    lines.push([]);
  }

  if (report.notes) {
    lines.push(["Analyst Notes", report.notes], []);
  }

  for (const table of reportTables(report)) {
    lines.push([table.title]);
    lines.push(table.columns);
    table.rows.forEach((row) => lines.push(row));
    lines.push([]);
  }

  if (shouldIncludeDisclaimer(report)) {
    lines.push(["Disclaimer", DATA_DISCLAIMER]);
  }

  return lines.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function buildProReportJson(report: ProReportPayload): string {
  return JSON.stringify(
    {
      ...report,
      ...(shouldIncludeDisclaimer(report) ? { disclaimer: DATA_DISCLAIMER } : {}),
    },
    null,
    2,
  );
}

function filename(report: ProReportPayload, extension: string): string {
  const slug = report.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "autolens-pro-report";
  return `${slug}-${new Date(report.generatedAt).toISOString().slice(0, 10)}.${extension}`;
}

async function downloadText(report: ProReportPayload, extension: "csv" | "json", content: string, type: string) {
  const { saveAs } = await import("file-saver");
  saveAs(new Blob([content], { type }), filename(report, extension));
}

function drawTextBlock(doc: JsPDFDoc, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function drawFooter(doc: JsPDFDoc, report: ProReportPayload, pageWidth: number, pageHeight: number, pageNumber: number) {
  const theme = themeFor(report);
  doc.setDrawColor(...theme.muted);
  doc.setLineWidth(0.4);
  doc.line(40, pageHeight - 42, pageWidth - 40, pageHeight - 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...theme.muted);
  doc.text(`MilaMark Pro Intelligence | ${new Date(report.generatedAt).toLocaleString("en-LK")}`, 40, pageHeight - 24);
  doc.text(`Page ${pageNumber}`, pageWidth - 72, pageHeight - 24);
}

function drawCover(doc: JsPDFDoc, report: ProReportPayload, pageWidth: number) {
  const theme = themeFor(report);
  doc.setFillColor(...theme.ink);
  doc.rect(0, 0, pageWidth, 214, "F");
  doc.setFillColor(...theme.accent);
  doc.rect(0, 0, 8, 214, "F");
  doc.setFillColor(...theme.gold);
  doc.rect(8, 204, pageWidth - 8, 3, "F");
  doc.setFillColor(...theme.accent2);
  doc.roundedRect(pageWidth - 166, 36, 112, 34, 10, 10, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...theme.softText);
  doc.text("AUTOLENS LK PRO", 40, 46);
  doc.text(theme.name.toUpperCase(), pageWidth - 150, 58);

  doc.setFontSize(28);
  doc.setTextColor(...theme.text);
  drawTextBlock(doc, report.title, 40, 92, pageWidth - 210, 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...theme.softText);
  const subtitle = report.subtitle || "Professional Sri Lanka vehicle market intelligence";
  drawTextBlock(doc, subtitle, 40, 170, pageWidth - 110, 14);

  doc.setFontSize(8.5);
  doc.setTextColor(...theme.muted);
  doc.text(`Generated ${new Date(report.generatedAt).toLocaleString("en-LK")}`, 40, 232);
  if (report.preparedFor) {
    doc.setTextColor(...theme.accent);
    doc.text(`Prepared for ${report.preparedFor}`, 40, 248);
  }
}

function drawMetricCards(doc: JsPDFDoc, report: ProReportPayload, startY: number, pageWidth: number): number {
  if (!hasSection(report, "metrics") || !report.metrics?.length) return startY;
  const theme = themeFor(report);
  const metrics = report.metrics.slice(0, 8);
  const gap = 10;
  const columns = metrics.length > 4 ? 4 : Math.min(4, metrics.length);
  const cardWidth = (pageWidth - 80 - gap * (columns - 1)) / columns;
  let y = startY;

  metrics.forEach((metric, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = 40 + col * (cardWidth + gap);
    const cardY = y + row * 78;
    doc.setFillColor(...theme.panel);
    doc.roundedRect(x, cardY, cardWidth, 62, 11, 11, "F");
    doc.setFillColor(...theme.accent);
    doc.roundedRect(x, cardY, 4, 62, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...theme.softText);
    doc.text(metric.label.toUpperCase(), x + 12, cardY + 18);
    doc.setFontSize(15);
    doc.setTextColor(...theme.text);
    doc.text(String(metric.value), x + 12, cardY + 40, { maxWidth: cardWidth - 20 });
    if (metric.detail) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...theme.muted);
      doc.text(metric.detail, x + 12, cardY + 52, { maxWidth: cardWidth - 20 });
    }
  });

  y += Math.ceil(metrics.length / columns) * 78;
  return y + 6;
}

function drawNarrative(doc: JsPDFDoc, report: ProReportPayload, startY: number, pageWidth: number): number {
  const theme = themeFor(report);
  const summary = report.coverSummary || report.notes;
  if (!summary) return startY;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(40, startY, pageWidth - 80, 58, 12, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...theme.accent2);
  doc.text("REPORT BRIEF", 56, startY + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(43, 52, 57);
  drawTextBlock(doc, summary, 56, startY + 36, pageWidth - 112, 11);
  return startY + 76;
}

async function exportPdf(report: ProReportPayload) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const theme = themeFor(report);
  const tables = reportTables(report).filter((table) => table.title !== "Metrics");
  let y = 272;

  doc.setFillColor(...theme.paper);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  drawCover(doc, report, pageWidth);
  y = drawMetricCards(doc, report, y, pageWidth);
  y = drawNarrative(doc, report, y, pageWidth);

  if (hasSection(report, "filters") && report.filters && Object.keys(report.filters).length) {
    const filterText = Object.entries(report.filters)
      .map(([key, value]) => `${key}: ${cleanCell(value)}`)
      .join("   ");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...theme.muted);
    doc.text("ACTIVE FILTERS", 40, y);
    doc.setFont("helvetica", "normal");
    y = drawTextBlock(doc, filterText, 40, y + 14, pageWidth - 80, 10) + 12;
  }

  for (const table of tables) {
    if (y > pageHeight - 170) {
      drawFooter(doc, report, pageWidth, pageHeight, doc.getNumberOfPages());
      doc.addPage();
      doc.setFillColor(...theme.paper);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      y = 50;
    }

    doc.setFillColor(...theme.accent);
    doc.roundedRect(40, y, 5, 22, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...theme.ink);
    doc.text(table.title, 54, y + 15);
    y += 30;

    autoTable(doc, {
      head: [table.columns],
      body: table.rows,
      startY: y,
      margin: { left: 40, right: 40 },
      styles: {
        font: "helvetica",
        fontSize: 7.8,
        cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
        textColor: [36, 44, 48],
        lineColor: [222, 229, 226],
        lineWidth: 0.35,
      },
      headStyles: {
        fillColor: theme.ink,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        lineColor: theme.ink,
      },
      alternateRowStyles: { fillColor: [242, 247, 244] },
      bodyStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { fontStyle: "bold", textColor: theme.ink },
      },
      didDrawPage: () => {
        drawFooter(doc, report, pageWidth, pageHeight, doc.getNumberOfPages());
      },
    });
    y = ((doc as JsPDFDoc & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || y) + 28;
  }

  if (report.notes && !report.coverSummary) {
    if (y > pageHeight - 130) {
      doc.addPage();
      doc.setFillColor(...theme.paper);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      y = 54;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...theme.ink);
    doc.text("Analyst notes", 40, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(62, 72, 78);
    y = drawTextBlock(doc, report.notes, 40, y + 16, pageWidth - 80, 11) + 12;
  }

  if (shouldIncludeDisclaimer(report)) {
    if (y > pageHeight - 92) {
      doc.addPage();
      doc.setFillColor(...theme.paper);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      y = 54;
    }
    doc.setFillColor(250, 247, 237);
    doc.roundedRect(40, y, pageWidth - 80, 44, 10, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...theme.gold);
    doc.text("DATA DISCLAIMER", 56, y + 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(87, 77, 55);
    doc.text(DATA_DISCLAIMER, 56, y + 31, { maxWidth: pageWidth - 112 });
  }

  drawFooter(doc, report, pageWidth, pageHeight, doc.getNumberOfPages());
  doc.save(filename(report, "pdf"));
}

function tableCell(
  TableCell: typeof import("docx").TableCell,
  Paragraph: typeof import("docx").Paragraph,
  TextRun: typeof import("docx").TextRun,
  text: string,
  strong = false,
  fill?: string,
) {
  return new TableCell({
    shading: fill ? { fill } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text: cleanCell(text), bold: strong, color: fill ? "FFFFFF" : "1F2933" })],
      }),
    ],
  });
}

async function exportDocx(report: ProReportPayload) {
  const [{ saveAs }, { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType }] = await Promise.all([
    import("file-saver"),
    import("docx"),
  ]);
  const theme = themeFor(report);
  const children: FileChild[] = [
    new Paragraph({
      children: [
        new TextRun({ text: "AUTOLENS LK PRO", bold: true, color: "0E9F6E", size: 20 }),
        new TextRun({ text: `   ${theme.name}`, color: "6B7280", size: 18 }),
      ],
    }),
    new Paragraph({ text: report.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: report.subtitle || "Professional Sri Lanka vehicle market intelligence" }),
    new Paragraph({ text: `Generated: ${new Date(report.generatedAt).toLocaleString("en-LK")}` }),
  ];

  if (report.preparedFor) {
    children.push(new Paragraph({ children: [new TextRun({ text: `Prepared for ${report.preparedFor}`, bold: true })] }));
  }

  if (report.coverSummary || report.notes) {
    children.push(new Paragraph({ text: report.coverSummary || report.notes || "", heading: HeadingLevel.HEADING_2 }));
  }

  for (const table of reportTables(report)) {
    children.push(new Paragraph({ text: table.title, heading: HeadingLevel.HEADING_2 }));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: table.columns.map((column) => tableCell(TableCell, Paragraph, TextRun, column, true, "0B121A")),
          }),
          ...table.rows.map(
            (row) =>
              new TableRow({
                children: row.map((cell) => tableCell(TableCell, Paragraph, TextRun, cleanCell(cell))),
              }),
          ),
        ],
      }),
    );
  }

  if (shouldIncludeDisclaimer(report)) {
    children.push(new Paragraph({ text: DATA_DISCLAIMER }));
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename(report, "docx"));
}

function exportPrint(report: ProReportPayload) {
  const theme = themeFor(report);
  const metricsHtml = hasSection(report, "metrics") && report.metrics?.length
    ? `<section class="metrics">${report.metrics
        .slice(0, 8)
        .map(
          (metric) => `<article>
            <span>${htmlCell(metric.label)}</span>
            <strong>${htmlCell(metric.value)}</strong>
            ${metric.detail ? `<small>${htmlCell(metric.detail)}</small>` : ""}
          </article>`,
        )
        .join("")}</section>`
    : "";
  const tablesHtml = reportTables(report)
    .filter((table) => table.title !== "Metrics")
    .map(
      (table) => `
        <section class="table-section">
          <h2>${htmlCell(table.title)}</h2>
          <table>
            <thead><tr>${table.columns.map((column) => `<th>${htmlCell(column)}</th>`).join("")}</tr></thead>
            <tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${htmlCell(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </section>
      `,
    )
    .join("");
  const popup = window.open("", "_blank", "width=1100,height=820");
  if (!popup) return;
  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${htmlCell(report.title)}</title>
        <style>
          :root {
            --ink: rgb(${theme.ink.join(",")});
            --accent: rgb(${theme.accent.join(",")});
            --accent2: rgb(${theme.accent2.join(",")});
            --gold: rgb(${theme.gold.join(",")});
            --paper: rgb(${theme.paper.join(",")});
          }
          * { box-sizing: border-box; }
          body { margin: 0; background: #eef2f1; color: #172026; font-family: "Aptos", "Segoe UI", Arial, sans-serif; }
          .page { max-width: 1120px; margin: 0 auto; background: var(--paper); min-height: 100vh; }
          .hero { position: relative; overflow: hidden; background: var(--ink); color: white; padding: 42px 48px 52px; }
          .hero:before { content: ""; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(${theme.accent.join(",")}, .26), transparent 42%), radial-gradient(circle at 86% 24%, rgba(${theme.gold.join(",")}, .22), transparent 32%); }
          .hero > * { position: relative; }
          .kicker { color: var(--accent); font-size: 11px; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; }
          h1 { margin: 16px 0 10px; max-width: 820px; font-size: 42px; line-height: .98; letter-spacing: 0; }
          .subtitle { max-width: 760px; color: #cbd5d1; line-height: 1.6; }
          .meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; color: #dce6e1; font-size: 12px; }
          .meta span { border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 8px 12px; background: rgba(255,255,255,.06); }
          main { padding: 32px 48px 48px; }
          .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: -60px; margin-bottom: 28px; position: relative; }
          .metrics article { min-height: 112px; border-radius: 18px; background: white; padding: 18px; box-shadow: 0 18px 48px rgba(15,23,42,.12); border: 1px solid #e6ece9; }
          .metrics span { display: block; color: #64706d; font-size: 10px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
          .metrics strong { display: block; margin-top: 12px; color: #101820; font-size: 24px; }
          .metrics small { display: block; margin-top: 6px; color: #71807b; }
          .brief { border-left: 5px solid var(--accent); background: white; border-radius: 16px; padding: 18px 20px; margin-bottom: 24px; color: #35413e; box-shadow: 0 10px 28px rgba(15,23,42,.07); }
          .table-section { margin-top: 26px; break-inside: avoid; }
          h2 { margin: 0 0 10px; font-size: 17px; color: #152027; }
          table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; border-radius: 14px; border: 1px solid #dfe7e3; background: white; }
          th, td { padding: 10px 11px; font-size: 12px; text-align: left; border-bottom: 1px solid #e8eeee; }
          th { background: var(--ink); color: white; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
          tr:nth-child(even) td { background: #f7faf8; }
          .notes, .disclaimer { margin-top: 26px; border-radius: 16px; padding: 16px 18px; background: #fff; border: 1px solid #e6ece9; color: #43504d; }
          .disclaimer { background: #fff8e8; color: #68552c; border-color: #f3ddb2; font-size: 12px; }
          @media print {
            body { background: white; }
            .page { max-width: none; }
            .metrics article { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <header class="hero">
            <div class="kicker">MilaMark Pro Intelligence</div>
            <h1>${htmlCell(report.title)}</h1>
            <p class="subtitle">${htmlCell(report.subtitle || "Professional Sri Lanka vehicle market intelligence")}</p>
            <div class="meta">
              <span>Generated ${htmlCell(new Date(report.generatedAt).toLocaleString("en-LK"))}</span>
              ${report.preparedFor ? `<span>Prepared for ${htmlCell(report.preparedFor)}</span>` : ""}
              <span>${htmlCell(theme.name)}</span>
            </div>
          </header>
          <main>
            ${metricsHtml}
            ${report.coverSummary ? `<section class="brief">${htmlCell(report.coverSummary)}</section>` : ""}
            ${tablesHtml}
            ${report.notes && !report.coverSummary ? `<section class="notes">${htmlCell(report.notes)}</section>` : ""}
            ${shouldIncludeDisclaimer(report) ? `<section class="disclaimer">${htmlCell(DATA_DISCLAIMER)}</section>` : ""}
          </main>
        </div>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

export async function exportProReport(report: ProReportPayload, format: ProExportFormat): Promise<void> {
  if (format === "csv") {
    await downloadText(report, "csv", buildProReportCsv(report), "text/csv;charset=utf-8");
    return;
  }

  if (format === "json") {
    await downloadText(report, "json", buildProReportJson(report), "application/json;charset=utf-8");
    return;
  }

  if (format === "pdf") {
    await exportPdf(report);
    return;
  }

  if (format === "docx") {
    await exportDocx(report);
    return;
  }

  exportPrint(report);
}
