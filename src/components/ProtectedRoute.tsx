import { type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Crown, Lock, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Surface } from "@/components/Surface";
import { useAuth } from "@/lib/authContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { hasProAccess, isAuthenticated, logout, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  if (!hasProAccess) {
    return (
      <div className="page-canvas min-h-screen">
        <AmbientBackground variant="subtle" className="fixed inset-0" />
        <main className="layout-shell relative z-10 grid min-h-screen items-center gap-8 py-10 lg:grid-cols-[0.92fr_1.08fr]">
          <Surface variant="elevated" className="relative overflow-hidden p-7 md:p-10">
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_20%_0%,rgba(216,155,53,0.16),transparent_42%)]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 tech-label font-bold text-amber-100">
                <Lock className="h-3.5 w-3.5" />
                Subscription required
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-none tracking-normal text-white md:text-6xl">
                Pro is locked for free accounts.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">
                {user?.name || "This account"} is signed in on the {user?.plan || "free"} plan. Vehicle lane drill-downs,
                district intelligence, source quality, and exports unlock after an active Pro subscription.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/pro-preview"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-4 text-label font-mono font-bold uppercase text-white no-underline transition-colors hover:bg-white/[0.08]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Preview Pro
                </Link>
                <Link
                  to="/sign-in"
                  onClick={logout}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-label font-mono font-bold uppercase text-black no-underline transition-colors hover:bg-amber-400"
                >
                  <Crown className="h-3.5 w-3.5" />
                  Use paid login
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/12 bg-black/20 px-4 text-label font-mono font-bold uppercase text-zinc-300 transition-colors hover:bg-white/[0.06]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          </Surface>

          <aside className="space-y-4">
            {[
              "Vehicle and district drill-down drawers",
              "Trend studio with exportable pricing history",
              "Source coverage, freshness, and quality signals",
              "PDF, Word, CSV, JSON, and print report packs",
            ].map((item) => (
              <div key={item} className="asset-surface flex items-start gap-3 rounded-xl p-4">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10">
                  <ShieldCheck className="h-4 w-4 text-amber-300" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{item}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Locked until the account has an active Pro or Enterprise subscription.</p>
                </div>
              </div>
            ))}
          </aside>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
