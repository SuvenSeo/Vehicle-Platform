import { Link } from "react-router-dom";
import { Crown, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/authContext";

/** Compact plan callout for free users browsing the gated product. */
export function FreePlanBanner() {
  const { user, hasProAccess, isAdmin } = useAuth();
  if (!user || hasProAccess || isAdmin) return null;

  return (
    <div className="border-b border-primary/15 bg-primary/[0.06]">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-3 px-5 py-2.5 sm:px-6">
        <p className="flex items-center gap-2 text-[12px] font-medium text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          You&apos;re on the <span className="font-bold">Free</span> plan — Pro lanes, exports, and deep analytics stay locked.
        </p>
        <Link
          to="/pricing"
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-primary-foreground no-underline"
        >
          <Crown className="h-3 w-3" aria-hidden />
          Upgrade
        </Link>
      </div>
    </div>
  );
}
