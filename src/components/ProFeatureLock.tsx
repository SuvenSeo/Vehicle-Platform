import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Crown, Lock } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { cn } from "@/lib/utils";

type ProFeatureLockProps = {
  children: ReactNode;
  /** Short label shown on the blur overlay */
  label?: string;
  className?: string;
  /** When true, always show content (e.g. admin preview). Defaults to hasProAccess. */
  unlocked?: boolean;
};

/**
 * Blurs / locks premium surfaces for free-plan users while keeping layout visible.
 * Admins and Pro/Enterprise subscribers see the real content.
 */
export function ProFeatureLock({
  children,
  label = "Pro feature",
  className,
  unlocked,
}: ProFeatureLockProps) {
  const { hasProAccess, isAdmin } = useAuth();
  const open = unlocked ?? (hasProAccess || isAdmin);

  if (open) {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <div className="pointer-events-none select-none blur-[7px] opacity-55 saturate-[0.85]" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/60 px-5 text-center backdrop-blur-[3px]">
        <div className="rounded-2xl border border-primary/25 bg-card/90 px-6 py-5 shadow-soft-lg backdrop-blur-md">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary-bright">
            <Lock className="h-3 w-3" aria-hidden />
            {label}
          </span>
          <p className="mx-auto mt-3 max-w-xs text-[13px] font-medium leading-relaxed text-muted-foreground">
            Start your 7-day free trial for full lane intelligence, exports, and deeper market tools.
          </p>
          <Link
            to="/pricing"
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-5 text-[11px] font-bold uppercase tracking-[0.1em] text-primary-foreground no-underline shadow-soft transition-all hover:bg-primary/95 active:scale-[0.98]"
          >
            <Crown className="h-3.5 w-3.5" aria-hidden />
            Start 7-day free trial
          </Link>
        </div>
      </div>
    </div>
  );
}
