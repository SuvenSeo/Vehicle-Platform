import { useState } from "react";
import { PageCanvas } from "@/components/PageCanvas";
import { Navigate, useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ShieldCheck, BarChart3, TrendingUp, MapPin, Sparkles,
  Eye, EyeOff, ArrowRight, Database, Zap, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/Surface";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_ACCOUNT_SUMMARY, DEMO_AUTH_ENABLED, useAuth } from "@/lib/authContext";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const PRO_FEATURES = [
  { icon: BarChart3, text: "Market analytics dashboard", desc: "Stats across auto platforms" },
  { icon: TrendingUp, text: "Price trend forecasting", desc: "Historical + predictive pricing" },
  { icon: MapPin, text: "District intelligence", desc: "Supply and pricing by district" },
  { icon: Sparkles, text: "Hot deal leaderboard", desc: "Deal scoring on every listing" },
  { icon: Database, text: "Multi-platform aggregation", desc: "Ikman, Riyasewana, and more" },
  { icon: Zap, text: "Live pipeline data", desc: "Synced from live sources" },
];

export default function SignIn() {
  const { login, isAuthenticated, previewAccessEnabled } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/pro";

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    setServerError("");
    const result = await login(values.email, values.password);
    setLoading(false);
    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setServerError(result.error || "Login failed");
    }
  };

  const fillDemo = (email: string, password: string) => {
    setValue("email", email);
    setValue("password", password);
    setServerError("");
  };

  const openPreview = () => {
    navigate("/pro-preview");
  };

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <PageCanvas className="relative overflow-hidden" ambient="hero">
      <div className="sign-in-stage layout-shell relative z-10 grid min-h-screen items-center gap-8 py-10 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="relative flex items-center justify-center">

        <Surface
          variant="glass"
          className="sign-in-card relative z-10 w-full max-w-md space-y-7 p-6 md:p-7"
        >
          <div>
            <Link to="/" className="inline-flex items-center gap-2 mb-7 group">
              <div className="w-8 h-8 rounded-md overflow-hidden ring-1 ring-white/10 group-hover:ring-amber-500/30 transition-[border-color,background-color,color,box-shadow,transform,opacity]">
                <img src="/logo.svg" alt="AutoLens LK" className="w-full h-full object-cover" />
              </div>
              <span className="headline-display text-sm">
                AutoLens<span className="text-zinc-500">LK</span>
              </span>
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/8 px-3 py-1 mb-4">
              <Lock className="w-3 h-3 text-amber-400" />
              <span className="tech-label text-amber-300">Pro Access Only</span>
            </div>
            <h1 className="headline-display text-3xl">Sign in</h1>
            <p className="text-zinc-400 text-sm mt-1">Access the Sri Lanka vehicle intelligence dashboard.</p>
          </div>

          {previewAccessEnabled && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4">
              <p className="tech-label mb-1.5 text-amber-300">
                Public teaser stays locked
              </p>
              <p className="text-xs leading-relaxed text-zinc-400">
                Preview the Pro workspace without creating a Pro session, or use the review credentials below to test paid and free access.
              </p>
              <Button
                type="button"
                onClick={openPreview}
                variant="outline"
                size="sm"
                className="mt-3 h-10 w-full"
              >
                Preview Pro workspace <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {DEMO_AUTH_ENABLED ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/6 p-3.5">
              <p className="tech-label mb-2 text-amber-300">Review credentials</p>
              <div className="space-y-2">
                {DEMO_ACCOUNT_SUMMARY.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillDemo(acc.email, acc.password)}
                    className="w-full rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 text-left transition-colors hover:border-amber-400/25 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-zinc-100">{acc.name}</p>
                        <p className="mt-0.5 ui-caption">{acc.email} / {acc.password}</p>
                      </div>
                      <span className={`tech-label rounded-full border px-2 py-1 ${
                        acc.subscriptionStatus === "active"
                          ? "border-amber-400/25 bg-amber-500/10 text-amber-200"
                          : "border-zinc-500/25 bg-zinc-500/10 text-zinc-400"
                      }`}>
                        {acc.plan}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <p className="tech-label mb-1 text-zinc-300">
                Production Auth Required
              </p>
              <p className="text-xs leading-relaxed text-zinc-500">
                Enable backend auth or private demo credentials to access Pro.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="field-label text-zinc-400">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register("email")}
                className="h-11 bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/40 focus-visible:border-amber-500/40 rounded-xl"
              />
              {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="field-label text-zinc-400">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register("password")}
                  className="h-11 bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/40 focus-visible:border-amber-500/40 rounded-xl pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
            </div>

            {serverError && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                {serverError}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Signing in...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  Sign In <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-zinc-600 text-xs">
            Not a paid subscriber?{" "}
            <Link to="/" className="text-zinc-400 hover:text-white transition-colors underline underline-offset-2">
              Browse public data
            </Link>
          </p>
        </Surface>
      </div>

      <Surface
        variant="glass"
        className="sign-in-showcase relative hidden min-h-[650px] flex-col justify-center overflow-hidden p-10 lg:flex xl:p-12"
      >
        <div className="relative z-10 space-y-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
            <ShieldCheck className="h-6 w-6 text-amber-400" />
          </div>

          <div>
            <h2 className="headline-display text-2xl">Pro Intelligence</h2>
          </div>

          <div className="space-y-3">
            {PRO_FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="sign-in-feature-card group flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] group-hover:border-amber-500/30 transition-colors">
                  <Icon className="h-5 w-5 text-amber-400" />
                </div>
                <p className="text-sm text-zinc-200 font-medium">{text}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <p className="tech-label text-zinc-600">Who uses this</p>
            <p className="text-zinc-300 mt-2 text-sm">Dealers · finance · insurance</p>
          </div>
        </div>
      </Surface>
      </div>
    </PageCanvas>
  );
}
