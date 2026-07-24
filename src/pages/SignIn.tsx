import { useState } from "react";
import { motion } from "framer-motion";
import { Navigate, useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  ArrowRight,
  Lock,
  ShieldCheck,
  BarChart3,
  TrendingUp,
  MapPin,
  Sparkles,
  Database,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_ACCOUNT_SUMMARY, DEMO_AUTH_ENABLED, useAuth } from "@/lib/authContext";
import { useAppPreferences } from "@/lib/appPreferences";
import { revealContainer, revealItem, springSoft } from "@/lib/motion";
import { sanitizeSignInRedirect } from "@/lib/signIn";
import { BRAND } from "@/lib/brand";

type FormValues = { email: string; password: string };

const CAPABILITIES = [
  { icon: BarChart3, title: "Market terminal", detail: "Live inventory intelligence across Sri Lanka" },
  { icon: TrendingUp, title: "Price foresight", detail: "Trend lanes with historical context" },
  { icon: MapPin, title: "District depth", detail: "Regional demand and clearing prices" },
  { icon: Sparkles, title: "Deal quality", detail: "Scored opportunities, not guesswork" },
  { icon: Database, title: "Multi-source truth", detail: "Aggregated listings, twice daily" },
  { icon: Zap, title: "Operator speed", detail: "From ask to decision in minutes" },
];

export default function SignIn() {
  const { login, isAuthenticated, previewAccessEnabled } = useAuth();
  const { t } = useAppPreferences();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const from = sanitizeSignInRedirect(
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname,
  );

  const schema = z.object({
    email: z.string().email(t("signin.invalidEmail", "Invalid email")),
    password: z.string().min(1, t("signin.required", "Required")),
  });

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    setServerError("");
    const result = await login(values.email, values.password);
    setLoading(false);
    if (result.success) navigate(from, { replace: true });
    else setServerError(result.error || t("signin.failed", "Login failed"));
  };

  if (isAuthenticated) return <Navigate to={from} replace />;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="relative min-h-screen overflow-hidden bg-background"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,hsl(var(--primary)/0.12),transparent_55%)]" />
        <div className="absolute -left-[18%] top-[28%] h-[520px] w-[520px] rounded-full bg-primary/[0.06] blur-[120px]" />
        <div className="absolute -right-[12%] bottom-[8%] h-[460px] w-[460px] rounded-full bg-primary/[0.05] blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(hsl(var(--foreground)/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.03)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1180px] items-stretch gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:py-16 xl:gap-16">
        {/* Brand narrative */}
        <motion.aside variants={revealItem} className="hidden flex-col justify-between lg:flex">
          <div>
            <Link to="/sign-in" className="inline-flex items-center gap-3 no-underline">
              <div className="h-11 w-11 overflow-hidden rounded-2xl ring-1 ring-border shadow-soft">
                <img src="/logo.svg" alt="" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="font-display text-[17px] font-semibold tracking-tight text-foreground">{BRAND.name}</p>
                <p className="text-[11px] font-medium text-muted-foreground">{BRAND.subtitle}</p>
              </div>
            </Link>

            <p className="section-eyebrow mt-14 mb-4 inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Private intelligence platform
            </p>
            <h1 className="display-hero max-w-[14ch] text-foreground">
              The market, made legible<span className="text-sheen">.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              {BRAND.tagline} Access is invite-only — reserved for operators who price, finance, and move vehicles with data.
            </p>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2">
            {CAPABILITIES.map(({ icon: Icon, title, detail }) => (
              <div
                key={title}
                className="group rounded-2xl border border-border bg-card/60 p-4 shadow-soft backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" aria-hidden />
                </div>
                <p className="text-[13px] font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
        </motion.aside>

        {/* Credential panel */}
        <motion.div variants={revealItem} className="flex items-center">
          <div className="premium-surface w-full max-w-md mx-auto lg:mx-0 lg:max-w-none p-7 sm:p-9 shadow-soft-lg">
            <div className="mb-8 lg:hidden">
              <Link to="/sign-in" className="inline-flex items-center gap-2.5 no-underline">
                <div className="h-9 w-9 overflow-hidden rounded-xl ring-1 ring-border">
                  <img src="/logo.svg" alt="Motormila" className="h-full w-full object-cover" />
                </div>
                <span className="font-display text-sm font-bold text-foreground">{BRAND.name}</span>
              </Link>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1">
              <Lock className="h-3 w-3 text-primary" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-bright">
                {t("signin.eyebrow", "Invite only")}
              </span>
            </div>
            <h2 className="mt-5 font-display text-[2rem] font-semibold tracking-tight text-foreground sm:text-[2.35rem]">
              {t("signin.title", "Sign in")}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Enter your Motormila credentials to open the intelligence cockpit.
            </p>

            {previewAccessEnabled && (
              <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
                <p className="text-[11px] font-bold text-primary-bright">Preview available</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Preview the Pro workspace without signing in.
                </p>
                <motion.button
                  type="button"
                  onClick={() => navigate("/pro-preview")}
                  whileTap={{ scale: 0.98 }}
                  transition={springSoft}
                  className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-border bg-card text-[12px] font-semibold text-foreground transition-all hover:border-primary/40"
                >
                  Preview Pro <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </motion.button>
              </div>
            )}

            {DEMO_AUTH_ENABLED && (
              <div className="mt-6 space-y-2 rounded-2xl border border-border bg-surface p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Review accounts</p>
                {DEMO_ACCOUNT_SUMMARY.map((acc) => (
                  <motion.button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setValue("email", acc.email);
                      setServerError("");
                    }}
                    whileTap={{ scale: 0.99 }}
                    transition={springSoft}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-all hover:border-primary/30"
                  >
                    <div>
                      <p className="text-xs font-bold text-foreground">{acc.name}</p>
                      <p className="text-[11px] font-medium text-muted-foreground">{acc.email}</p>
                    </div>
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-primary-bright">
                      {acc.plan}
                    </span>
                  </motion.button>
                ))}
                <p className="text-[11px] font-medium text-muted-foreground">
                  Selecting an account fills the email — enter its password to sign in.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="field-label">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.lk"
                  autoComplete="email"
                  {...register("email")}
                  className="h-12 rounded-xl border-border bg-surface text-[14px] text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
                />
                {errors.email && <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="field-label">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...register("password")}
                    className="h-12 rounded-xl border-border bg-surface pr-11 text-[14px] text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{errors.password.message}</p>}
              </div>
              {serverError && (
                <p className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3.5 py-2.5 text-[12px] font-medium text-rose-600 dark:text-rose-300">
                  {serverError}
                </p>
              )}
              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                transition={springSoft}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[12px] font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-soft transition-all hover:bg-primary/95 disabled:opacity-50"
              >
                {loading ? t("signin.loading", "Signing in...") : (
                  <>
                    <span>{t("signin.submit", "Sign in")}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </>
                )}
              </motion.button>
            </form>

            <div className="mt-8 border-t border-border pt-6 text-center">
              <p className="text-[12px] font-medium text-muted-foreground">
                Have an invite link?{" "}
                <Link to="/sign-up" className="font-semibold text-foreground underline decoration-primary/40 underline-offset-4 transition-colors hover:text-primary">
                  Complete sign-up
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
