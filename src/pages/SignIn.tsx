import { useState } from "react";
import { motion } from "framer-motion";
import { Navigate, useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, ArrowRight, Lock, ShieldCheck, BarChart3, TrendingUp, MapPin, Sparkles, Database, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_ACCOUNT_SUMMARY, DEMO_AUTH_ENABLED, useAuth } from "@/lib/authContext";
import { revealContainer, revealItem, springSoft } from "@/lib/motion";

const schema = z.object({ email: z.string().email("Invalid email"), password: z.string().min(1, "Required") });
type FormValues = z.infer<typeof schema>;

const FEATURES = [
  { icon: BarChart3, text: "Market analytics dashboard" },
  { icon: TrendingUp, text: "Price trend forecasting" },
  { icon: MapPin, text: "District intelligence" },
  { icon: Sparkles, text: "Hot deal leaderboard" },
  { icon: Database, text: "Multi-platform aggregation" },
  { icon: Zap, text: "Live pipeline data" },
];

export default function SignIn() {
  const { login, isAuthenticated, previewAccessEnabled } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/pro";

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setLoading(true); setServerError("");
    const result = await login(values.email, values.password);
    setLoading(false);
    if (result.success) navigate(from, { replace: true });
    else setServerError(result.error || "Login failed");
  };

  if (isAuthenticated) return <Navigate to={from} replace />;

  const [primaryFeature, ...supportingFeatures] = FEATURES;
  const PrimaryFeatureIcon = primaryFeature.icon;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="relative min-h-screen flex items-center justify-center px-5 py-14 lg:py-20 bg-background overflow-hidden"
    >
      {/* Decorative Orbs */}
      <div aria-hidden className="absolute top-[8%] right-[-12%] w-[480px] h-[480px] bg-primary/5 rounded-full blur-[110px] pointer-events-none" />
      <div aria-hidden className="absolute bottom-[16%] left-[-16%] w-[420px] h-[420px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="grid w-full max-w-[1040px] gap-8 lg:gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-stretch relative z-10">
        {/* Form */}
        <motion.div
          variants={revealItem}
          className="w-full max-w-md mx-auto lg:mx-0 flex flex-col justify-center rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-7 shadow-soft"
        >
          <div>
            <Link to="/" className="inline-flex items-center gap-2 mb-8 group">
              <div className="w-7 h-7 rounded-lg overflow-hidden ring-1 ring-border transition-all group-hover:ring-primary/40">
                <img src="/logo.svg" alt="Motormila" className="w-full h-full object-cover" />
              </div>
              <span className="font-display text-sm font-bold text-foreground">Motormila</span>
            </Link>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 mb-5">
              <Lock className="w-3 h-3 text-primary" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-bright">Pro Access</span>
            </div>
            <h1 className="display-1 text-foreground">Sign in</h1>
            <p className="text-body-lg mt-3">Access the vehicle intelligence dashboard.</p>
          </div>

          {previewAccessEnabled && (
            <div className="rounded-xl border border-primary/20 bg-primary/[0.07] p-4">
              <p className="text-[11px] font-bold text-primary-bright mb-1">Preview available</p>
              <p className="text-xs text-muted-foreground font-medium">Preview the Pro workspace without signing in.</p>
              <motion.button
                type="button"
                onClick={() => navigate("/pro-preview")}
                whileTap={{ scale: 0.98 }}
                transition={springSoft}
                className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-border bg-surface text-[11px] font-bold text-foreground transition-all hover:border-primary/40 hover:bg-muted"
              >
                Preview Pro <ArrowRight className="h-3 w-3" aria-hidden />
              </motion.button>
            </div>
          )}

          {DEMO_AUTH_ENABLED && (
            <div className="rounded-xl border border-primary/20 bg-primary/[0.07] p-4 space-y-2">
              <p className="text-[11px] font-bold text-primary-bright">Review accounts</p>
              {DEMO_ACCOUNT_SUMMARY.map((acc) => (
                <motion.button
                  key={acc.email}
                  type="button"
                  onClick={() => { setValue("email", acc.email); setServerError(""); }}
                  whileTap={{ scale: 0.99 }}
                  transition={springSoft}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-left transition-all hover:border-primary/30"
                >
                  <div><p className="text-xs font-bold text-foreground">{acc.name}</p><p className="text-[11px] text-muted-foreground font-medium">{acc.email}</p></div>
                  <span className={`text-[9px] font-bold uppercase tracking-[0.08em] rounded-full border px-2 py-0.5 ${acc.subscriptionStatus === "active" ? "border-primary/25 bg-primary/10 text-primary-bright" : "border-border text-muted-foreground"}`}>{acc.plan}</span>
                </motion.button>
              ))}
              <p className="text-[11px] text-muted-foreground font-medium">Selecting an account fills the email — enter its password to sign in.</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...register("email")} className="h-11 rounded-xl border-border bg-surface text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/30" />
              {errors.email && <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" {...register("password")} className="h-11 rounded-xl border-border bg-surface text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/30 pr-10" />
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-all hover:text-foreground">
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{errors.password.message}</p>}
            </div>
            {serverError && <p className="text-[11px] text-rose-600 dark:text-rose-300 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 font-medium">{serverError}</p>}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              transition={springSoft}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-[11px] font-bold uppercase tracking-[0.1em] text-primary-foreground transition-all hover:bg-primary/95 disabled:opacity-50 shadow-soft"
            >
              {loading ? "Signing in..." : <><span>Sign in</span><ArrowRight className="h-3.5 w-3.5" aria-hidden /></>}
            </motion.button>
          </form>

          <p className="text-center text-xs text-muted-foreground font-semibold">
            Not a subscriber? <Link to="/" className="text-foreground underline underline-offset-2 transition-all hover:text-primary">Browse public data</Link>
          </p>
        </motion.div>

        {/* Showcase */}
        <motion.div
          variants={revealItem}
          className="hidden lg:flex flex-col justify-center rounded-2xl border border-border bg-card p-8 xl:p-10 space-y-7 shadow-soft"
        >
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 mb-5">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <h2 className="display-2 text-foreground">Pro Intelligence</h2>
          </div>

          <div className="space-y-3">
            {/* Featured primary capability — larger weight to lead the eye */}
            <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 transition-all hover:border-primary/40">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <PrimaryFeatureIcon className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <span className="text-[15px] font-bold text-foreground">{primaryFeature.text}</span>
            </div>

            {/* Supporting capabilities — compact, quieter grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {supportingFeatures.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-3 transition-all hover:border-primary/30">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                  <span className="text-xs font-bold text-foreground leading-tight">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.12em]">Who uses this</p>
            <p className="text-[13px] text-foreground font-semibold mt-1.5">Dealers · finance · insurance</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
