import { cn } from "@/lib/utils";
import { TrendingDown } from "lucide-react";

interface PriceDropBadgeProps {
  pct: number;
  className?: string;
}

export function PriceDropBadge({ pct, className }: PriceDropBadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/15 text-emerald-300 px-2 py-0.5 text-xs font-semibold", className)}>
      <TrendingDown className="h-3 w-3" />
      {pct.toFixed(1)}% drop
    </span>
  );
}
