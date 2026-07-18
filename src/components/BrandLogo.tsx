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

/** Motormila mark + Motor/mila wordmark lockup (official brand assets). */
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
        alt="Motormila — Sri Lanka Vehicle Market Intelligence"
        className={cn("h-auto w-full max-w-[240px] object-contain", className)}
        decoding="async"
      />
    );
  }

  const markSize = compact ? "h-8 w-8" : "h-10 w-10";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {compact ? (
        <img
          src="/logo.png"
          alt=""
          width={32}
          height={32}
          className={cn(markSize, "shrink-0 rounded-[22%] object-cover shadow-sm", markClassName)}
          decoding="async"
        />
      ) : (
        <>
          <img
            src="/logo-mark.png"
            alt=""
            width={40}
            height={40}
            className={cn(markSize, "shrink-0 object-contain dark:hidden", markClassName)}
            decoding="async"
          />
          <img
            src="/logo.png"
            alt=""
            width={40}
            height={40}
            className={cn(
              markSize,
              "hidden shrink-0 rounded-[22%] object-cover shadow-sm dark:block",
              markClassName,
            )}
            decoding="async"
          />
        </>
      )}
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
            <span className="mt-1.5 block max-w-[16rem] truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
