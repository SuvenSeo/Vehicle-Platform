import { computeDealLadder } from "@/lib/dealLadder";
import { formatPrice } from "@/services/api";
import { cn } from "@/lib/utils";

interface DealLadderProps {
  askingPrice: number;
  marketMedianLkr: number;
  className?: string;
}

const RUNG_TONE = {
  good_deal: {
    active: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
    idle: "border-border/60 text-muted-foreground",
  },
  fair: {
    active: "border-primary/35 bg-primary/10 text-primary",
    idle: "border-border/60 text-muted-foreground",
  },
  overpriced: {
    active: "border-rose-500/35 bg-rose-500/10 text-rose-300",
    idle: "border-border/60 text-muted-foreground",
  },
} as const;

export function DealLadder({ askingPrice, marketMedianLkr, className }: DealLadderProps) {
  const ladder = computeDealLadder({ askingPrice, marketMedianLkr });
  if (!ladder) return null;

  return (
    <div className={cn("mt-4 border-t border-border pt-3", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Deal ladder
      </p>
      <p className="mt-2 text-[13px] font-semibold text-foreground">
        {ladder.band === "good_deal" ? (
          ladder.headline
        ) : ladder.cutToGoodDeal > 0 ? (
          <>
            Cut{" "}
            <span className="num text-[var(--gold)]">{formatPrice(ladder.cutToGoodDeal)}</span> to
            hit Good Deal
          </>
        ) : (
          ladder.headline
        )}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Current band:{" "}
        <span
          className={cn(
            "font-semibold",
            ladder.band === "good_deal" && "text-emerald-400",
            ladder.band === "fair" && "text-primary",
            ladder.band === "overpriced" && "text-rose-400",
          )}
        >
          {ladder.bandLabel}
        </span>
      </p>

      <ol className="mt-3 space-y-1.5">
        {ladder.rungs.map((rung) => {
          const tone = RUNG_TONE[rung.band];
          const priceHint =
            rung.band === "good_deal"
              ? `≤ ${formatPrice(ladder.goodDealPrice)}`
              : rung.band === "fair"
                ? `≤ ${formatPrice(ladder.overpricedThreshold - 1)}`
                : `≥ ${formatPrice(ladder.overpricedThreshold)}`;

          return (
            <li
              key={rung.band}
              className={cn(
                "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
                rung.active ? tone.active : tone.idle,
              )}
            >
              <span>{rung.label}{rung.active ? " · you" : ""}</span>
              <span className="num font-medium normal-case tracking-normal opacity-80">{priceHint}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
