import { BadgeCheck, Minus, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPriceLkrMillions } from "@/lib/formatting";

/**
 * Unified 4-tier deal taxonomy — single source of truth for TRACK C.
 * Thresholds stay compatible with the 3-tier backend (deal_scores.py):
 * score = (1 - price/median) * 100. Steal is a subset of Good Deal
 * (score >= 8), so existing Good Deal callers keep working.
 *
 * - Steal:      score >= 15  (deep below FMV)
 * - Great:      score >= 8   (Good Deal band)
 * - Fair:       score > -5   (within FMV band)
 * - Overpriced: score <= -5
 */
export type DealTier = "steal" | "great" | "fair" | "overpriced";

export const STEAL_SCORE = 15;
export const GREAT_SCORE = 8;
export const OVERPRICED_SCORE = -5;

export function getDealTier(score: number | string | null | undefined): DealTier {
  const s = Number(score ?? 0);
  if (!Number.isFinite(s)) return "fair";
  if (s >= STEAL_SCORE) return "steal";
  if (s >= GREAT_SCORE) return "great";
  if (s <= OVERPRICED_SCORE) return "overpriced";
  return "fair";
}

export const DEAL_TIER_META: Record<
  DealTier,
  { label: string; classes: string; Icon: typeof Zap }
> = {
  steal: {
    label: "Steal",
    classes:
      "border-emerald-500/40 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    Icon: Zap,
  },
  great: {
    label: "Great",
    classes:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    Icon: BadgeCheck,
  },
  fair: {
    label: "Fair",
    classes: "border-primary/20 bg-primary/10 text-primary-bright",
    Icon: Minus,
  },
  overpriced: {
    label: "Overpriced",
    classes: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    Icon: TrendingUp,
  },
};

export interface DealBadgeProps {
  score: number | string | null | undefined;
  /** Asking price — enables the Rs delta readout when paired with fmvLkr. */
  priceLkr?: number | null;
  /** Fair-market reference for the Rs delta readout. */
  fmvLkr?: number | null;
  size?: "sm" | "md";
  showDelta?: boolean;
  className?: string;
}

function formatRsDelta(priceLkr: number, fmvLkr: number): string | null {
  if (!Number.isFinite(priceLkr) || !Number.isFinite(fmvLkr) || fmvLkr <= 0) return null;
  const delta = priceLkr - fmvLkr;
  if (Math.abs(delta) < 1000) return "at FMV";
  const abs = formatPriceLkrMillions(Math.abs(delta));
  return delta < 0 ? `${abs} below` : `${abs} above`;
}

export function DealScoreBadge({
  score,
  priceLkr,
  fmvLkr,
  size = "sm",
  showDelta = true,
  className,
}: DealBadgeProps) {
  const safeScore = Number(score ?? 0);
  const tier = getDealTier(safeScore);
  const meta = DEAL_TIER_META[tier];
  const Icon = meta.Icon;

  const rsDelta =
    priceLkr != null && fmvLkr != null ? formatRsDelta(Number(priceLkr), Number(fmvLkr)) : null;
  const fallbackDelta = `${safeScore > 0 ? "+" : ""}${Number.isFinite(safeScore) ? safeScore : 0}%`;
  const deltaText = rsDelta ?? fallbackDelta;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 font-bold tabular-nums",
        size === "sm" ? "py-0.5 text-xs" : "px-2 py-1 text-[13px]",
        meta.classes,
        className,
      )}
      title={`${meta.label} · deal score ${fallbackDelta}`}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {meta.label}
      {showDelta && (
        <span className="font-semibold opacity-80">· {deltaText}</span>
      )}
    </span>
  );
}
