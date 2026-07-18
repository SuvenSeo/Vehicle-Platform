import { memo, useMemo } from "react";
import { Activity, Database, Gauge, ScanSearch, Satellite } from "lucide-react";
import { CarListing, PipelineStatusResponse } from "@/types/car";

interface VehicleDataFlowProps {
  listings: CarListing[];
  status: PipelineStatusResponse | null;
}

function formatSource(source: string): string {
  const compact = String(source || "").toLowerCase().replace(/[-_.\s]/g, "");
  if (compact.startsWith("ikman")) return "Ikman";
  if (compact.startsWith("riyasewana")) return "Riyasewana";
  if (compact.includes("autodirect")) return "AutoDirect";
  if (compact.includes("autolanka")) return "AutoLanka";
  if (compact.includes("autostream")) return "AutoStream";
  if (compact.includes("carshop")) return "Carshop";
  if (compact.includes("saleme")) return "SaleMe";
  if (compact.includes("riyahub")) return "Riyahub";
  if (compact.includes("carsatdimo") || compact === "dimo") return "Cars at DIMO";
  if (compact.startsWith("patpat")) return "Patpat";
  return source || "Unknown";
}

export const VehicleDataFlow = memo(function VehicleDataFlow({ listings, status }: VehicleDataFlowProps) {
  const sourceCards = useMemo(() => {
    const grouped = new Map<string, { count: number }>();

    for (const listing of listings) {
      const key = formatSource(listing.source);
      const current = grouped.get(key) || { count: 0 };
      current.count += 1;
      grouped.set(key, current);
    }

    return Array.from(grouped.entries())
      .map(([source, value]) => ({ source, ...value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [listings]);

  const healthyJobs = status?.jobs.filter((job) => job.status === "ok").length || 0;
  const runningJobs = status?.jobs.filter((job) => job.status === "running").length || 0;
  const delayedJobs = status?.jobs.filter((job) => job.status === "delayed").length || 0;
  const ingestedCount = sourceCards.reduce((sum, item) => sum + item.count, 0);
  const processedCount = listings.length;
  const scoredCount = listings.filter((listing) => Number.isFinite(Number(listing.deal_score))).length;
  const topSourceNames = sourceCards.slice(0, 3).map((item) => item.source).join(" + ") || "No active sources";

  const stages = [
    {
      key: "ingest",
      label: "Ingest",
      subtitle: "Source collectors",
      detail: `${ingestedCount} listing signals from ${topSourceNames}`,
      icon: Database,
      tone: "border-primary/30 bg-primary/10 text-primary-bright",
    },
    {
      key: "normalize",
      label: "Normalize",
      subtitle: "Clean + map",
      detail: runningJobs > 0 ? "Validation and duplicate checks in progress" : "Schema mapping and duplicate checks stable",
      icon: ScanSearch,
      tone: "border-border bg-surface text-foreground",
    },
    {
      key: "score",
      label: "Score",
      subtitle: "Deal intelligence",
      detail: `${scoredCount} rows benchmarked against market medians`,
      icon: Gauge,
      tone: "border-primary/35 bg-primary/10 text-primary-bright",
    },
    {
      key: "publish",
      label: "Publish",
      subtitle: "Motormila feed",
      detail: `${processedCount} listings powering cards, map, trends, and valuation`,
      icon: Satellite,
      tone: "border-border bg-surface text-foreground",
    },
  ] as const;

  return (
    <div className="page-panel cinematic-panel relative overflow-hidden rounded-xl p-8 sm:p-10">
      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-8">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-primary" />
            <p className="tech-label">Data pipeline</p>
          </div>
          <h3 className="headline-display text-3xl sm:text-4xl">From market source to Motormila feed.</h3>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            A single flow moves every listing through ingestion, cleanup, scoring, and publishing.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 tech-label">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-primary-bright num">{healthyJobs} healthy</span>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-primary-bright num">{runningJobs} running</span>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-primary-bright num">{delayedJobs} delayed</span>
        </div>
      </div>

      <div className="relative z-10 overflow-hidden rounded-xl border border-border bg-surface p-5 sm:p-6">
        <div className="absolute left-8 right-8 top-1/2 hidden h-px -translate-y-1/2 bg-primary/18 md:block" />
        <div className="absolute bottom-8 top-8 left-1/2 block w-px -translate-x-1/2 bg-primary/25 md:hidden" />

        <div className="relative grid grid-cols-1 gap-3 md:grid-cols-4 md:items-stretch">
          {stages.map((stage) => {
            const Icon = stage.icon;
            return (
              <article key={stage.key} className={`motion-card rounded-xl border p-4 md:p-5 ${stage.tone}`}>
                <div className="flex items-center justify-between mb-3">
                  <Icon className="w-4 h-4" />
                  <span className="tech-label">{stage.label}</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{stage.subtitle}</p>
                <p className="ui-caption mt-1 text-muted-foreground leading-relaxed">{stage.detail}</p>
              </article>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sourceCards.length > 0 ? (
          sourceCards.map((source) => {
            const scaleX = Math.max(0.18, Math.min(1, source.count * 0.08));

            return (
              <article
                key={source.source}
                className="motion-card rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground truncate">{source.source}</p>
                  <span className="rounded-full border border-border bg-card px-2 py-1 tech-label text-foreground num">
                    {source.count}
                  </span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-card overflow-hidden">
                  <div
                    className="h-full w-full origin-left bg-primary"
                    style={{ transform: `scaleX(${scaleX})` }}
                  />
                </div>
                <p className="tech-label mt-2">source throughput</p>
              </article>
            );
          })
        ) : (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            No source listings available yet. Run a pipeline sync to populate this view.
          </div>
        )}
      </div>
    </div>
  );
});

VehicleDataFlow.displayName = "VehicleDataFlow";
