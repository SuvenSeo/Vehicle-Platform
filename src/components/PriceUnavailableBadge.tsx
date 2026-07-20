import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type PriceUnavailableBadgeProps = {
  label: string;
  actionLabel?: string;
  className?: string;
};

export function PriceUnavailableBadge({ label, actionLabel, className }: PriceUnavailableBadgeProps) {
  return (
    <span
      className={cn(
        "tech-label inline-flex items-center gap-1.5 rounded-lg border border-primary/60 bg-primary/18 px-2.5 py-1 text-primary",
        className,
      )}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      <span>{label}</span>
      {actionLabel ? <span className="text-primary/95 normal-case tracking-normal font-semibold">• {actionLabel}</span> : null}
    </span>
  );
}
