import { type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { useAppPreferences } from "@/lib/appPreferences";
import { springSnappy } from "@/lib/motion";

/** Admin-only route guard for /admin. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, authReady } = useAuth();
  const { t } = useAppPreferences();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label={t("common.loading", "Loading")}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-foreground/[0.08]" />
            <div className="absolute inset-0 animate-spin rounded-full border-t-2 border-primary" />
          </div>
          <p className="tech-label">{t("adminGate.verifying", "Verifying access")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return (
      <div className="relative mx-auto flex min-h-[60vh] max-w-lg items-center px-5 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSnappy}
          className="premium-surface w-full p-8 shadow-soft-lg"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10">
            <ShieldAlert className="h-5 w-5 text-rose-500" aria-hidden />
          </div>
          <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight text-foreground">{t("adminGate.title", "Admin only")}</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            {t("adminGate.body", "This console is limited to Motormila administrators.")}
          </p>
          <Link
            to="/"
            className="mt-7 inline-flex h-11 items-center rounded-full border border-border bg-card px-5 text-[13px] font-semibold text-foreground no-underline transition-all hover:border-primary/40"
          >
            {t("common.backToHome", "Back to home")}
          </Link>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}
