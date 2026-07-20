import { cn } from "@/lib/utils";

interface DealScoreBadgeProps {
  score: number | string | null | undefined;
  className?: string;
}

export function DealScoreBadge({ score, className }: DealScoreBadgeProps) {
  const safeScore = Number(score ?? 0);

  const getClasses = () => {
    if (safeScore > 30) return "bg-deal-green text-deal-green-foreground";
    if (safeScore > -30) return "bg-deal-amber text-deal-amber-foreground";
    return "bg-deal-red text-deal-red-foreground";
  };

  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums", getClasses(), className)}>
      {safeScore > 0 ? "+" : ""}{safeScore}
    </span>
  );
}
