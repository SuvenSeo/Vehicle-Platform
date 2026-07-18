import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  showTagline?: boolean;
  tagline?: string;
  compact?: boolean;
};

function MotormilaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-foreground", className)}
      aria-hidden
    >
      <circle cx="240" cy="272" r="150" className="stroke-current" strokeWidth="16" />
      <circle cx="90" cy="272" r="8" className="fill-current" />
      <circle cx="390" cy="272" r="8" className="fill-current" />

      <path
        d="M118 220C140 168 186 138 240 138C294 138 340 168 362 220"
        className="stroke-current"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <path
        d="M132 214L118 236C114 242 118 250 126 250H154"
        className="stroke-current"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M348 214L362 236C366 242 362 250 354 250H326"
        className="stroke-current"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="146" cy="228" r="7" className="fill-primary" />

      <path
        d="M132 360V228L188 320L244 228V360"
        className="stroke-current"
        strokeWidth="28"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M244 360V228L300 320L356 228V360"
        className="stroke-primary"
        strokeWidth="28"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      <g transform="translate(372 248) rotate(18)">
        <path
          d="M0 26C0 12 12 0 26 0H72C80 0 86 6 86 14V72C86 80 80 86 72 86H26C12 86 0 74 0 60Z"
          className="fill-primary"
        />
        <circle cx="26" cy="26" r="9" className="fill-background" />
        <rect x="40" y="44" width="32" height="7" rx="3.5" className="fill-background" />
        <rect x="40" y="58" width="22" height="7" rx="3.5" className="fill-background" fillOpacity="0.8" />
      </g>
    </svg>
  );
}

/** Motormila mark + optional Motor/mila wordmark lockup. */
export function BrandLogo({
  className,
  markClassName,
  showWordmark = true,
  showTagline = false,
  tagline = "Sri Lanka Vehicle Market Intelligence",
  compact = false,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <MotormilaMark className={cn(compact ? "h-8 w-8" : "h-9 w-9", markClassName)} />
      {showWordmark && (
        <span className="brand-wordmark min-w-0 leading-none">
          <span
            className={cn(
              "block font-display font-extrabold italic tracking-[-0.04em] text-foreground",
              compact ? "text-[15px]" : "text-[17px]",
            )}
          >
            Motor<span className="text-primary">mila</span>
          </span>
          {showTagline && (
            <span className="mt-1.5 block max-w-[14rem] truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
