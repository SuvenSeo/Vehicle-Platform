import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type BadgeDeltaTrend = "up" | "down" | "neutral";

const toneByTrend: Record<BadgeDeltaTrend, string> = {
  up: "border-amber-300/30 bg-amber-400/12 text-amber-100 shadow-[0_0_26px_rgba(224,170,72,0.12)]",
  down: "border-amber-300/22 bg-amber-400/8 text-amber-100 shadow-[0_0_26px_rgba(224,170,72,0.08)]",
  neutral: "border-white/12 bg-white/[0.05] text-zinc-200",
};

const iconByTrend = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: ArrowRight,
};

export function BadgeDelta({
  trend = "neutral",
  children,
  className,
}: {
  trend?: BadgeDeltaTrend;
  children: ReactNode;
  className?: string;
}) {
  const Icon = iconByTrend[trend];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold leading-none",
        toneByTrend[trend],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}
