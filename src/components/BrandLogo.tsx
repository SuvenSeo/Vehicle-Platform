import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  showTagline?: boolean;
  tagline?: string;
  compact?: boolean;
  /** Use the full stacked lockup image instead of mark + text. */
  lockup?: boolean;
};

/** Motormila mark + Motor/mila wordmark lockup. */
export function BrandLogo({
  className,
  markClassName,
  showWordmark = true,
  showTagline = false,
  tagline = "Sri Lanka Vehicle Market Intelligence",
  compact = false,
  lockup = false,
}: BrandLogoProps) {
  if (lockup) {
    return (
      <img
        src="/brand-lockup.png"
        alt="Motormila — Sri Lanka Vehicle Price Intelligence"
        className={cn("h-auto w-full max-w-[220px] object-contain", className)}
        decoding="async"
      />
    );
  }

  const markSize = compact ? "h-8 w-8" : "h-9 w-9";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* Light: stamp mark. Dark: app-icon chip so black ink stays visible. */}
      <img
        src="/logo-mark.png"
        alt=""
        width={compact ? 32 : 36}
        height={compact ? 32 : 36}
        className={cn(markSize, "shrink-0 object-contain dark:hidden", markClassName)}
        decoding="async"
      />
      <img
        src="/logo.png"
        alt=""
        width={compact ? 32 : 36}
        height={compact ? 32 : 36}
        className={cn(markSize, "hidden shrink-0 rounded-[22%] object-cover dark:block", markClassName)}
        decoding="async"
      />
      {showWordmark && (
        <span className="brand-wordmark min-w-0 leading-none">
          <span
            className={cn(
              "block font-display font-extrabold italic tracking-[-0.045em] text-foreground",
              compact ? "text-[15px]" : "text-[17px]",
            )}
          >
            Motor<span className="text-primary">mila</span>
          </span>
          {showTagline && (
            <span className="mt-1.5 block max-w-[15rem] truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
