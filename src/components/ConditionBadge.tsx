import { cn } from "@/lib/utils";
import { Condition } from "@/types/car";

interface ConditionBadgeProps {
  condition: Condition | string | null | undefined;
  className?: string;
}

const conditionConfig: Record<Condition, { label: string; className: string }> = {
  brand_new: { label: "Brand New (0 Mileage)", className: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
  reconditioned: { label: "Unregistered (Recon)", className: "bg-amber-500/15 text-amber-200 border border-amber-500/25" },
  used: { label: "Registered / Pre-owned", className: "bg-zinc-800 text-zinc-300 border border-zinc-700" },
};

export function ConditionBadge({ condition, className }: ConditionBadgeProps) {
  const config = condition ? conditionConfig[condition as Condition] : undefined;
  if (!config) {
    return (
      <span className={cn("inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground", className)}>
        Unknown
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold", config.className, className)}>
      {config.label}
    </span>
  );
}
