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
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      <div className="pointer-events-none select-none blur-[6px] opacity-60" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/55 px-4 text-center backdrop-blur-[2px]">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-primary">
          <Lock className="h-3 w-3" aria-hidden />
          {label}
        </span>
        <p className="max-w-xs text-xs font-medium text-muted-foreground">
          Upgrade to Pro for full lane intelligence, exports, and deeper market tools.
        </p>
        <Link
          to="/pricing"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[11px] font-bold uppercase tracking-[0.08em] text-primary-foreground no-underline shadow-soft"
        >
          <Crown className="h-3.5 w-3.5" aria-hidden />
          View plans
        </Link>
      </div>
    </div>
  );
}
