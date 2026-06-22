import { type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Crown, Lock, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/authContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { hasProAccess, isAuthenticated, logout, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  if (!hasProAccess) {
    return (
      <div className="min-h-screen bg-[hsl(220,10%,3%)]">
        <div className="mx-auto max-w-[1100px] grid min-h-screen items-center gap-8 px-5 py-10 sm:px-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-white/[0.05] bg-[hsl(220,8%,6%)] p-7 md:p-10">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/15 bg-amber-400/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-300/80">
              <Lock className="h-3 w-3" /> Subscription required
            </span>
            <h1 className="mt-5 font-display text-[2rem] font-semibold tracking-tight text-foreground md:text-[2.5rem]">
              Pro is locked.
            </h1>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-zinc-500">
              {user?.name || "This account"} is on the {user?.plan || "free"} plan. Vehicle lane drill-downs,
              district intelligence, and exports unlock with an active Pro subscription.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/pro-preview" className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.06] px-4 text-[10px] font-semibold text-zinc-300 no-underline hover:bg-white/[0.03]">
                <Sparkles className="h-3 w-3" /> Preview Pro
              </Link>
              <Link to="/sign-in" onClick={logout} className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--gold)] px-4 text-[10px] font-bold uppercase tracking-[0.08em] text-black no-underline hover:bg-[var(--gold-bright)]">
                <Crown className="h-3 w-3" /> Use paid login
              </Link>
              <button type="button" onClick={logout} className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 text-[10px] font-semibold text-zinc-500 hover:text-zinc-300">
                <LogOut className="h-3 w-3" /> Sign out
              </button>
            </div>
          </div>

          <aside className="space-y-2">
            {["Vehicle and district drill-downs", "Trend studio with exportable history", "Source coverage and quality signals", "PDF, Word, CSV, JSON exports"].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-white/[0.04] bg-[hsl(220,8%,5.5%)] p-4">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/60" />
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{item}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">Locked until Pro subscription is active.</p>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
