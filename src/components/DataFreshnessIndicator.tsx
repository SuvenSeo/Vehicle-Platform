import { AlertTriangle, Clock3 } from "lucide-react";
import { getListingDataFreshness, type ListingDataFreshness } from "@/lib/dataFreshness";
import { cn } from "@/lib/utils";

type DataFreshnessIndicatorProps = {
  latestListingAt?: string | null;
  lastUpdated?: string | null;
  variant?: "badge" | "subline" | "banner";
  className?: string;
  now?: Date;
};

function toneClasses(tone: ListingDataFreshness["tone"]) {
  if (tone === "stale") {
    return {
      dot: "bg-primary",
      text: "text-primary/90",
      border: "border-primary/25 bg-primary/10",
    };
  }
  if (tone === "live") {
    return {
      dot: "bg-primary",
      text: "text-muted-foreground",
      border: "border-border bg-foreground/[0.03]",
    };
  }
  return {
    dot: "bg-muted-foreground/70",
    text: "text-muted-foreground",
    border: "border-border bg-foreground/[0.03]",
  };
}

export function DataFreshnessIndicator({
  latestListingAt,
  lastUpdated,
  variant = "badge",
  className,
  now,
}: DataFreshnessIndicatorProps) {
  const freshness = getListingDataFreshness({ latestListingAt, lastUpdated, now });
  const tone = toneClasses(freshness.tone);

  if (variant === "banner" && freshness.isStale) {
    return (
      <div
        className={cn(
          "flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.06] px-4 py-2.5",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-primary/90">{freshness.staleNotice}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {freshness.dataAsOfLabel}
            {freshness.listingAt && freshness.statsAt && freshness.listingAt !== freshness.statsAt ? (
              <span className="ml-1">· stats refreshed {freshness.statsAt ? formatStatsNote(freshness, now) : "pending"}</span>
            ) : null}
          </p>
        </div>
      </div>
    );
  }

  if (variant === "banner" && !freshness.isStale) {
    return null;
  }

  if (variant === "subline") {
    return (
      <p
        className={cn("tech-label text-muted-foreground", className)}
        title={freshness.primaryAt ? freshness.absoluteLabel : undefined}
      >
        {freshness.dataAsOfLabel}
        {freshness.listingAt && freshness.statsAt && freshness.listingAt !== freshness.statsAt ? (
          <span> · stats {formatStatsNote(freshness, now)}</span>
        ) : null}
        {freshness.isStale ? <span className="text-primary/80"> · stale</span> : null}
      </p>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
        tone.border,
        tone.text,
        className,
      )}
      title={freshness.primaryAt ? freshness.absoluteLabel : undefined}
      role="status"
      aria-live="polite"
    >
      {freshness.isStale ? (
        <Clock3 className="h-3 w-3 shrink-0 text-primary/80" aria-hidden="true" />
      ) : (
        <span className="relative flex h-2 w-2 shrink-0">
          {freshness.tone === "live" ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          ) : null}
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", tone.dot)} />
        </span>
      )}
      {freshness.isStale ? (
        <span>Stale · {freshness.compactLabel}</span>
      ) : (
        <span>{freshness.dataAsOfLabel}</span>
      )}
    </span>
  );
}

function formatStatsNote(freshness: ListingDataFreshness, now?: Date) {
  if (!freshness.statsAt) return "pending";
  return getListingDataFreshness({ lastUpdated: freshness.statsAt, now }).relativeLabel;
}
