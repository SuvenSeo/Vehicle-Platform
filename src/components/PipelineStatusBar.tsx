import { memo } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2 } from "lucide-react";
import { PipelineJobStatus, PipelineStatusResponse } from "@/types/car";
import { formatRelativeTime } from "@/lib/formatting";

interface PipelineStatusBarProps {
  status: PipelineStatusResponse | null;
}

const JOB_LABELS: Record<string, string> = {
  scrape_ikman: "Ikman",
  scrape_riyasewana: "Riyasewana",
  scrape_autolanka: "AutoLanka",
  scrape_auto_lanka_site: "AutoLanka Site",
  scrape_autodirect: "AutoDirect",
  scrape_autostream: "AutoStream",
  scrape_patpat: "Patpat",
  scrape_carshop: "Carshop",
  scrape_saleme: "SaleMe",
  scrape_riyahub: "Riyahub",
  scrape_dimo: "Cars at DIMO",
  compute_aggregates: "Aggregates",
  clean_listings: "Cleaner",
};

function prettifyJobName(name: string): string {
  return JOB_LABELS[name] || name.replace(/^scrape_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function activityLabel(job: PipelineJobStatus): string {
  if (job.status === "running") {
    return "Running now";
  }
  if (job.last_success) {
    return `Last success ${formatRelativeTime(job.last_success)}`;
  }
  if (job.last_run) {
    return `Last run ${formatRelativeTime(job.last_run)}`;
  }
  return "Awaiting first run";
}

function statusColor(status: "ok" | "running" | "delayed") {
  if (status === "ok") return "#d89b35";
  if (status === "running") return "#f59e0b";
  return "#ef4444";
}

function statusIcon(status: "ok" | "running" | "delayed") {
  if (status === "ok") return CheckCircle2;
  if (status === "running") return Loader2;
  return AlertTriangle;
}

export const PipelineStatusBar = memo(function PipelineStatusBar({ status }: PipelineStatusBarProps) {
  const jobs = status?.jobs ?? [];
  const overall = status?.overall_status ?? "delayed";
  const loading = !status;
  const overallLabel = overall === "ok" ? "Healthy" : overall === "running" ? "Running" : "Delayed";
  const overallMessage =
    overall === "ok"
      ? "All monitored jobs are within expected cadence."
      : overall === "running"
        ? "Pipeline jobs are actively executing now."
        : "At least one job is delayed or requires attention.";
  const generatedLabel = status?.generated_at ? formatRelativeTime(status.generated_at) : "unknown";
  const healthyJobs = jobs.filter((job) => job.status === "ok").length;
  const runningJobs = jobs.filter((job) => job.status === "running").length;
  const delayedJobs = jobs.filter((job) => job.status === "delayed").length;

  return (
    <div className="console-section overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-white/[0.06] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(216,155,53,0.8)]" style={{ backgroundColor: statusColor(overall) }} />
          <span className="tech-label text-zinc-400">Data Pipeline</span>
          <span className="status-chip px-2.5 py-1">
            {overallLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 tech-label">
          <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-amber-300 num">{healthyJobs} healthy</span>
          <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-amber-300 num">{runningJobs} running</span>
          <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-amber-300 num">{delayedJobs} delayed</span>
        </div>
      </div>

      <div className="px-6 py-3 border-b border-white/[0.06] bg-black/20 flex flex-wrap items-center justify-between gap-2">
        <p className="ui-caption">{overallMessage}</p>
        <p className="tech-label text-zinc-500">Status refreshed {generatedLabel}</p>
      </div>

      <div className="p-5 sm:p-6">
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="data-card p-4">
                <div className="skeleton-shimmer mb-3 h-2.5 w-24 rounded" />
                <div className="skeleton-shimmer mb-2 h-2 w-32 rounded" />
                <div className="skeleton-shimmer h-2 w-20 rounded" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="console-empty px-5 py-4 ui-caption">
            No pipeline jobs have reported yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => {
              const Icon = statusIcon(job.status);
              const color = statusColor(job.status);
              return (
                <article key={job.name} className="data-card space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${job.status === "running" ? "animate-spin" : ""}`}
                        style={{ color }}
                      />
                      <p className="text-sm font-semibold text-white truncate">{prettifyJobName(job.name)}</p>
                    </div>
                    <span className="tech-label rounded-md border border-white/12 bg-white/5 px-2 py-1 text-zinc-300">
                      {job.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 ui-caption">
                    <Clock3 className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{activityLabel(job)}</span>
                  </div>

                  {job.last_status && (
                    <p className="tech-label text-zinc-500">
                      Last result: {String(job.last_status).toLowerCase()}
                    </p>
                  )}

                  {job.last_error && (
                    <p className="ui-caption text-amber-300/90 leading-relaxed line-clamp-2" title={job.last_error}>
                      {job.last_error}
                    </p>
                  )}
                </article>
              );
            })}
            </div>
        )}
      </div>
    </div>
  );
});

PipelineStatusBar.displayName = "PipelineStatusBar";
