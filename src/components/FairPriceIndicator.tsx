import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface FairPriceIndicatorProps {
  score: number;
  condition?: string;
  size?: "sm" | "lg";
  className?: string;
}

function getDealLabel(score: number, condition?: string) {
  if (score >= 8) return "Good Deal";
  if (score <= -5) return "Overpriced";
  if (condition === "brand_new") return "NEW FAIR PRICE";
  return "USED FAIR PRICE";
}

function getDealBadgeClasses(label: string, size: "sm" | "lg"): string {
  const isSm = size === "sm";

  if (label === "Good Deal") {
    return isSm
      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 p-1 px-2.5 text-label font-mono border"
      : "text-emerald-400 text-4xl tracking-tight p-0 border-0";
  }
  if (label === "Overpriced") {
    return isSm
      ? "bg-rose-500/10 border-rose-500/30 text-rose-400 p-1 px-2.5 text-label font-mono border"
      : "text-rose-400 text-4xl tracking-tight p-0 border-0";
  }
  // Fair Price classes — in-band, neutral amber
  return isSm
    ? "bg-primary/10 border-primary/20 text-primary-bright p-1 px-2.5 text-label font-mono border"
    : "text-primary text-4xl tracking-tight p-0 border-0";
}

export function FairPriceIndicator({ score, condition, size = "sm", className }: FairPriceIndicatorProps) {
  const label = getDealLabel(score, condition);
  const badgeClasses = getDealBadgeClasses(label, size);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center gap-1.5 cursor-help transition-all duration-200 hover:opacity-80 active:scale-[0.98]", size === "sm" ? "font-semibold uppercase rounded" : "uppercase font-bold", badgeClasses, className)}>
            {label}
            <Info className={cn("opacity-60", size === "sm" ? "w-3 h-3" : "w-6 h-6 ml-2")} />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={8}
          collisionPadding={16}
          className="max-w-[280px] bg-popover border border-border p-4 shadow-soft-xl rounded-xl z-50"
        >
          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-widest text-primary-bright font-bold border-b border-border pb-2 mb-2">Dynamic Value Methodology</h4>
            <p className="text-sm text-foreground leading-relaxed font-medium">
              We calculate <span className="text-foreground font-semibold">Fair Price</span> using a proprietary multi-factor algorithm against thousands of active Sri Lankan listings.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1.5 font-medium">
              <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary" /> Adjusts for Vehicle Mileage & Age</li>
              <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary" /> Appraises Condition & Seller Trust</li>
              <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary" /> Accounts for live Market Demand</li>
              <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary" /> Factors in prevailing Import Duties</li>
            </ul>
            <div className="bg-surface p-2 rounded border border-border mt-2">
              <p className="ui-caption italic">Scores between -5 and +8 typically fall comfortably within the {condition === "brand_new" ? "New Fair Price" : "Used Fair Price"} band.</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
