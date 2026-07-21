import { type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, Lock, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { useAppPreferences } from "@/lib/appPreferences";
import { revealContainer, revealItem, springSnappy } from "@/lib/motion";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { hasProAccess, isAuthenticated, logout, user } = useAuth();
  const { t } = useAppPreferences();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  if (!hasProAccess) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[1100px] grid min-h-screen items-center gap-8 px-5 py-10 sm:px-6 lg:grid-cols-[1fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSnappy}
            className="rounded-xl border border-border bg-card p-7 md:p-10"
          >
            <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/15 bg-primary/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/80">
              <Lock className="h-3 w-3" /> Subscription required
            </span>
            <h1 className="mt-5 font-display text-[2rem] font-semibold tracking-tight text-foreground md:text-[2.5rem]">
              {t("proGate.title", "Pro is locked.")}
            </h1>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              {user?.name || "This account"} is on the {user?.plan || "free"} plan. {t("proGate.body", "Lane intelligence, district profiles, and exports unlock with an active Pro subscription.")}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to="/pro-preview"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-4 text-[10px] font-semibold text-foreground no-underline transition-colors hover:bg-foreground/[0.03] active:bg-foreground/[0.06]"
              >
                <Sparkles className="h-3 w-3" /> {t("proGate.preview", "Preview Pro")}
              </Link>
              <Link
                to="/sign-in"
                onClick={logout}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[10px] font-bold uppercase tracking-[0.08em] text-primary-foreground no-underline shadow-soft transition-colors hover:bg-primary/95 active:bg-primary/90"
              >
                <Crown className="h-3 w-3" /> Use paid login
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground active:text-foreground"
              >
                <LogOut className="h-3 w-3" /> {t("nav.signOut", "Sign out")}
              </button>
            </div>
          </motion.div>

          <motion.aside
            variants={revealContainer}
            initial="hidden"
            animate="show"
            className="space-y-2"
          >
            {["Vehicle and district drill-downs", "Trend studio with exportable history", "Source coverage and quality signals", "PDF, Word, CSV, JSON exports"].map((item) => (
              <motion.div
                key={item}
                variants={revealItem}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/20"
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" />
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{item}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("proGate.lockedHint", "Locked until Pro subscription is active.")}</p>
                </div>
              </motion.div>
            ))}
          </motion.aside>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
