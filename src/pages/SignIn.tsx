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

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05
    }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 220,
      damping: 24
    }
  }
} as const;

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
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="relative min-h-screen flex items-center justify-center px-5 py-10 bg-background overflow-hidden"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[10%] right-[-10%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-15%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[90px] pointer-events-none" />

      <div className="grid w-full max-w-[960px] gap-8 lg:grid-cols-[1fr_1.1fr] relative z-10">
        {/* Form */}
        <motion.div variants={itemVariants} className="w-full max-w-md mx-auto lg:mx-0 rounded-xl border border-white/5 bg-white/[0.01] p-6 sm:p-7 space-y-6 backdrop-blur-md">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 mb-6 group">
              <div className="w-7 h-7 rounded-md overflow-hidden ring-1 ring-white/[0.06] group-hover:ring-primary/40 transition-all">
                <img src="/logo.svg" alt="AutoLens LK" className="w-full h-full object-cover" />
              </div>
              <span className="font-display text-sm font-bold text-white">AutoLens<span className="text-muted-foreground font-medium">LK</span></span>
            </Link>
            <div className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 mb-4">
              <Lock className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-primary">Pro Access</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">Sign in</h1>
            <p className="text-[12px] text-muted-foreground mt-1 font-medium">Access the vehicle intelligence dashboard.</p>
          </div>

          {previewAccessEnabled && (
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3.5">
              <p className="text-[10px] font-bold text-primary mb-1">Preview available</p>
              <p className="text-[11px] text-muted-foreground font-semibold">Preview the Pro workspace without signing in.</p>
              <button type="button" onClick={() => navigate("/pro-preview")} className="mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] text-[10px] font-bold text-white hover:bg-white/[0.04] transition-all">
                Preview Pro <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}

          {DEMO_AUTH_ENABLED && (
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3.5 space-y-2">
              <p className="text-[10px] font-bold text-primary">Review accounts</p>
              {DEMO_ACCOUNT_SUMMARY.map((acc) => (
                <button key={acc.email} type="button" onClick={() => { setValue("email", acc.email); setServerError(""); }}
                  className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-left hover:border-primary/20 transition-all"
                >
                  <div><p className="text-[11px] font-bold text-white">{acc.name}</p><p className="text-[10px] text-muted-foreground font-medium">{acc.email}</p></div>
                  <span className={`text-[9px] font-bold uppercase tracking-[0.08em] rounded-md border px-2 py-0.5 ${acc.subscriptionStatus === "active" ? "border-primary/25 bg-primary/10 text-primary" : "border-white/10 text-muted-foreground"}`}>{acc.plan}</span>
                </button>
              ))}
              <p className="text-[10px] text-muted-foreground font-medium">Selecting an account fills the email — enter its password to sign in.</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...register("email")} className="h-10 rounded-lg border-white/5 bg-white/[0.02] text-sm text-white placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-primary/30" />
              {errors.email && <p className="text-[10px] text-rose-400 font-semibold">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" {...register("password")} className="h-10 rounded-lg border-white/5 bg-white/[0.02] text-sm text-white placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-primary/30 pr-10" />
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-all">
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {errors.password && <p className="text-[10px] text-rose-400 font-semibold">{errors.password.message}</p>}
            </div>
            {serverError && <p className="text-[11px] text-rose-300 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 font-medium">{serverError}</p>}
            <button type="submit" disabled={loading} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[10px] font-bold uppercase tracking-[0.08em] text-white transition-all hover:bg-primary/95 disabled:opacity-50 shadow-[0_2px_10px_rgba(124,58,237,0.15)]">
              {loading ? "Signing in..." : <><span>Sign in</span><ArrowRight className="h-3.5 w-3.5" /></>}
            </button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground font-semibold">
            Not a subscriber? <Link to="/" className="text-muted-foreground hover:text-white underline underline-offset-2 transition-all">Browse public data</Link>
          </p>
        </motion.div>

        {/* Showcase */}
        <motion.div variants={itemVariants} className="hidden lg:flex flex-col justify-center rounded-xl border border-white/5 bg-white/[0.01] p-8 xl:p-10 space-y-6 backdrop-blur-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold tracking-tight text-white">Pro Intelligence</h2>
          <div className="space-y-2">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 transition-all hover:border-primary/20">
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="text-[12px] font-bold text-white">{text}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Who uses this</p>
            <p className="text-[12px] text-white font-semibold mt-1">Dealers · finance · insurance</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
