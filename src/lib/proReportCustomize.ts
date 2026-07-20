import type { ProReportOptions, ProReportPayload, ProReportSectionId } from "@/types/pro";

const DEFAULT_SECTIONS: ProReportSectionId[] = ["metrics", "breakdowns", "trends", "listings", "table", "filters", "disclaimer"];

function normalizeSections(sections?: ProReportSectionId[]): ProReportSectionId[] {
  return sections?.length ? sections : DEFAULT_SECTIONS;
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
