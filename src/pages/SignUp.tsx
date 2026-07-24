import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, KeyRound, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/authContext";
import { API_BASE, resolveFetchCredentials } from "@/services/api";
import { revealContainer, revealItem, springSoft } from "@/lib/motion";
import { BRAND } from "@/lib/brand";

type FormValues = { name: string; password: string; confirm: string };

type InvitePreview = {
  email: string;
  plan: string;
  expiresAt?: string;
};

const PLAN_COPY: Record<string, { title: string; detail: string }> = {
  free: {
    title: "Free access",
    detail: "Browse the market cockpit. Pro lanes and exports stay locked until upgraded.",
  },
  pro: {
    title: "Pro access",
    detail: "Full terminal — lane intelligence, district depth, and export packs.",
  },
  enterprise: {
    title: "Enterprise access",
    detail: "Operator-grade access with admin capabilities where provisioned.",
  },
};

export default function SignUp() {
  const { signup, isAuthenticated, authReady } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = (params.get("token") || "").trim();

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(Boolean(token));
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const schema = z
    .object({
      name: z.string().min(1, "Name is required").max(120),
      password: z.string().min(8, "Password must be at least 8 characters"),
      confirm: z.string().min(1, "Confirm your password"),
    })
    .refine((values) => values.password === values.confirm, {
      message: "Passwords do not match",
      path: ["confirm"],
    });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!token) {
      setInviteLoading(false);
      setInviteError("This sign-up link is missing an invite token. Ask your Motormila admin for a new invite.");
      return;
    }

    let cancelled = false;
    void (async () => {
      setInviteLoading(true);
      setInviteError("");
      try {
        const response = await fetch(
          new URL(`${API_BASE}/auth/invite/${encodeURIComponent(token)}`, window.location.origin).toString(),
          {
            credentials: resolveFetchCredentials(API_BASE),
            headers: { Accept: "application/json" },
          },
        );
        if (cancelled) return;
        if (!response.ok) {
          const detail =
            response.status === 410
              ? "This invite has expired or was already used."
              : "Invite not found. Ask your admin to send a new one.";
          setInviteError(detail);
          setInvite(null);
          return;
        }
        const data = (await response.json()) as InvitePreview;
        setInvite(data);
      } catch {
        if (!cancelled) setInviteError("Could not verify invite. Try again shortly.");
      } finally {
        if (!cancelled) setInviteLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = async (values: FormValues) => {
    if (!token) return;
    setLoading(true);
    setServerError("");
    const result = await signup({ token, name: values.name, password: values.password });
    setLoading(false);
    if (result.success) {
      navigate("/", { replace: true });
      return;
    }
    setServerError(result.error || "Sign-up failed");
  };

  if (authReady && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const planMeta = PLAN_COPY[invite?.plan || ""] || PLAN_COPY.free;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="relative min-h-screen overflow-hidden bg-background"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_70%_-8%,hsl(var(--primary)/0.14),transparent_55%)]" />
        <div className="absolute left-[-10%] bottom-[10%] h-[420px] w-[420px] rounded-full bg-primary/[0.05] blur-[110px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1080px] items-center px-5 py-14 sm:px-8">
        <div className="grid w-full gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-14">
          <motion.div variants={revealItem} className="hidden lg:block">
            <p className="section-eyebrow mb-4 inline-flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
              Invitation
            </p>
            <h1 className="display-1 max-w-[12ch] text-foreground">
              Activate your Motormila seat<span className="text-sheen">.</span>
            </h1>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
              {BRAND.vision}
            </p>
            <div className="mt-8 space-y-3">
              {[
                "Closed platform — no public self-serve signup",
                "Your plan is set by the Motormila admin",
                "Credentials stay private to your organisation",
              ].map((line) => (
                <div key={line} className="flex items-start gap-3 rounded-xl border border-border bg-card/50 px-4 py-3">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                  <p className="text-[13px] font-medium text-foreground/90">{line}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={revealItem} className="premium-surface mx-auto w-full max-w-md p-7 shadow-soft-lg sm:p-9 lg:mx-0 lg:max-w-none">
            <Link to="/sign-in" className="mb-8 inline-flex items-center gap-2.5 no-underline group">
              <div className="h-9 w-9 overflow-hidden rounded-xl ring-1 ring-border transition-all group-hover:ring-primary/40">
                <img src="/logo.svg" alt="Motormila" className="h-full w-full object-cover" />
              </div>
              <span className="font-display text-sm font-bold text-foreground">{BRAND.name}</span>
            </Link>

            <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1">
              <ShieldCheck className="h-3 w-3 text-primary" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-bright">Invite only</span>
            </div>
            <h2 className="font-display text-[1.85rem] font-semibold tracking-tight text-foreground sm:text-[2.1rem]">
              Create your account
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Motormila is closed to the public. Complete signup with the invite your admin sent you.
            </p>

            {inviteLoading && (
              <div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground" role="status">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Verifying invite…
              </div>
            )}

            {inviteError && (
              <div className="mt-7 rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-4 text-[13px] font-medium text-rose-600 dark:text-rose-300">
                {inviteError}
                <p className="mt-3 text-muted-foreground">
                  Already registered?{" "}
                  <Link to="/sign-in" className="font-semibold text-foreground underline underline-offset-4">
                    Sign in
                  </Link>
                </p>
              </div>
            )}

            {invite && !inviteError && (
              <>
                <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-surface">
                  <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10">
                      <Mail className="h-4 w-4 text-primary" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Invited as</p>
                      <p className="truncate text-[14px] font-semibold text-foreground">{invite.email}</p>
                    </div>
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-primary-bright">
                      {invite.plan}
                    </span>
                  </div>
                  <div className="px-4 py-3.5">
                    <p className="text-[13px] font-semibold text-foreground">{planMeta.title}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{planMeta.detail}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="field-label">Full name</Label>
                    <Input id="name" autoComplete="name" {...register("name")} className="h-12 rounded-xl bg-surface" />
                    {errors.name && <p className="text-[11px] font-semibold text-rose-600">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="field-label">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        {...register("password")}
                        className="h-12 rounded-xl bg-surface pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-[11px] font-semibold text-rose-600">{errors.password.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm" className="field-label">Confirm password</Label>
                    <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} className="h-12 rounded-xl bg-surface" />
                    {errors.confirm && <p className="text-[11px] font-semibold text-rose-600">{errors.confirm.message}</p>}
                  </div>
                  {serverError && (
                    <p className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3.5 py-2.5 text-[12px] font-medium text-rose-600">
                      {serverError}
                    </p>
                  )}
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileTap={{ scale: 0.98 }}
                    transition={springSoft}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[12px] font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-soft disabled:opacity-50"
                  >
                    {loading ? "Creating account…" : (
                      <>
                        <span>Activate account</span>
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </>
                    )}
                  </motion.button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
