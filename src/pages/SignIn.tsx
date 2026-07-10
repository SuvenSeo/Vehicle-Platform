import { useState } from "react";
import { Navigate, useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, ArrowRight, Lock, ShieldCheck, BarChart3, TrendingUp, MapPin, Sparkles, Database, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_ACCOUNT_SUMMARY, DEMO_AUTH_ENABLED, useAuth } from "@/lib/authContext";

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

  return (
    <div className="relative min-h-screen flex items-center justify-center px-5 py-10 bg-background">
      <div className="grid w-full max-w-[960px] gap-8 lg:grid-cols-[1fr_1.1fr]">
        {/* Form */}
        <div className="w-full max-w-md mx-auto lg:mx-0 rounded-xl border border-border bg-card p-6 sm:p-7 space-y-6">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 mb-6 group">
              <div className="w-7 h-7 rounded-md overflow-hidden ring-1 ring-white/[0.06] group-hover:ring-primary/20 transition-all">
                <img src="/logo.svg" alt="AutoLens LK" className="w-full h-full object-cover" />
              </div>
              <span className="font-display text-sm font-semibold text-foreground">AutoLens<span className="text-muted-foreground">LK</span></span>
            </Link>
            <div className="inline-flex items-center gap-1.5 rounded-md border border-primary/15 bg-primary/5 px-2.5 py-1 mb-4">
              <Lock className="w-3 h-3 text-primary/70" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/80">Pro Access</span>
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
            <p className="text-[12px] text-muted-foreground mt-1">Access the vehicle intelligence dashboard.</p>
          </div>

          {previewAccessEnabled && (
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-3.5">
              <p className="text-[10px] font-semibold text-primary/80 mb-1">Preview available</p>
              <p className="text-[11px] text-muted-foreground">Preview the Pro workspace without signing in.</p>
              <button type="button" onClick={() => navigate("/pro-preview")} className="mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border text-[10px] font-semibold text-foreground hover:bg-foreground/[0.03]">
                Preview Pro <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}

          {DEMO_AUTH_ENABLED && (
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-3.5 space-y-2">
              <p className="text-[10px] font-semibold text-primary/80">Review accounts</p>
              {DEMO_ACCOUNT_SUMMARY.map((acc) => (
                <button key={acc.email} type="button" onClick={() => { setValue("email", acc.email); setServerError(""); }}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-left hover:border-border"
                >
                  <div><p className="text-[11px] font-semibold text-foreground">{acc.name}</p><p className="text-[10px] text-muted-foreground">{acc.email}</p></div>
                  <span className={`text-[9px] font-bold uppercase tracking-[0.08em] rounded-md border px-2 py-0.5 ${acc.subscriptionStatus === "active" ? "border-primary/15 text-primary/80" : "border-border text-muted-foreground"}`}>{acc.plan}</span>
                </button>
              ))}
              <p className="text-[10px] text-muted-foreground">Selecting an account fills the email — enter its password to sign in.</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...register("email")} className="h-10 rounded-lg border-border bg-surface text-sm text-foreground placeholder:text-muted-foreground" />
              {errors.email && <p className="text-[10px] text-rose-400">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" {...register("password")} className="h-10 rounded-lg border-border bg-surface text-sm text-foreground placeholder:text-muted-foreground pr-10" />
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {errors.password && <p className="text-[10px] text-rose-400">{errors.password.message}</p>}
            </div>
            {serverError && <p className="text-[11px] text-rose-400 rounded-lg border border-rose-500/15 bg-rose-500/5 px-3 py-2">{serverError}</p>}
            <button type="submit" disabled={loading} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--gold)] text-[10px] font-bold uppercase tracking-[0.08em] text-white hover:bg-[var(--gold-bright)] disabled:opacity-50">
              {loading ? "Signing in..." : <><span>Sign in</span><ArrowRight className="h-3.5 w-3.5" /></>}
            </button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground">
            Not a subscriber? <Link to="/" className="text-muted-foreground hover:text-foreground underline underline-offset-2">Browse public data</Link>
          </p>
        </div>

        {/* Showcase */}
        <div className="hidden lg:flex flex-col justify-center rounded-xl border border-border bg-card p-8 xl:p-10 space-y-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-foreground/[0.03]">
            <ShieldCheck className="h-4 w-4 text-primary/70" />
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">Pro Intelligence</h2>
          <div className="space-y-2">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border">
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                <span className="text-[12px] font-medium text-foreground">{text}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-[10px] text-muted-foreground">Who uses this</p>
            <p className="text-[12px] text-muted-foreground mt-1">Dealers · finance · insurance</p>
          </div>
        </div>
      </div>
    </div>
  );
}
