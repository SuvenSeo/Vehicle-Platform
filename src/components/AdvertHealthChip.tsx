import {
  computeAdvertHealth,
  type AdvertHealthBand,
  type AdvertHealthListingLike,
} from "@/lib/advertHealth";
import { cn } from "@/lib/utils";

interface AdvertHealthChipProps {
  listing: AdvertHealthListingLike;
  className?: string;
}

const TONE: Record<AdvertHealthBand, string> = {
  strong: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  fair: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  weak: "border-rose-500/25 bg-rose-500/10 text-rose-300",
};

export function AdvertHealthChip({ listing, className }: AdvertHealthChipProps) {
  const result = computeAdvertHealth(listing);

  return (
    <span
      title={result.detail}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
        TONE[result.band],
        className,
      )}
    >
      <span className="num normal-case tracking-normal">{result.score}</span>
      Ad health
    </span>
  );
}
