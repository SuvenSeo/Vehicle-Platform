import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Mail, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/authContext";
import { API_BASE, resolveFetchCredentials } from "@/services/api";
import { revealContainer, revealItem, springSoft } from "@/lib/motion";

type FormValues = { name: string; password: string; confirm: string };

type InvitePreview = {
  email: string;
  plan: string;
  expiresAt?: string;
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

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-14"
    >
      <div aria-hidden className="pointer-events-none absolute right-[-10%] top-[10%] h-[420px] w-[420px] rounded-full bg-primary/5 blur-[100px]" />
      <motion.div
        variants={revealItem}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8"
      >
        <Link to="/sign-in" className="mb-8 inline-flex items-center gap-2 group">
          <div className="h-7 w-7 overflow-hidden rounded-lg ring-1 ring-border transition-all group-hover:ring-primary/40">
            <img src="/logo.svg" alt="Motormila" className="h-full w-full object-cover" />
          </div>
          <span className="font-display text-sm font-bold text-foreground">Motormila</span>
        </Link>

        <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1">
          <ShieldCheck className="h-3 w-3 text-primary" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-bright">Invite only</span>
        </div>
        <h1 className="display-1 text-foreground">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Motormila is closed to the public. Complete signup with the invite your admin sent you.
        </p>

        {inviteLoading && (
          <p className="mt-6 text-sm text-muted-foreground" role="status">
            Verifying invite…
          </p>
        )}

        {inviteError && (
          <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-3 text-[12px] font-medium text-rose-600 dark:text-rose-300">
            {inviteError}
            <p className="mt-2">
              Already registered?{" "}
              <Link to="/sign-in" className="font-semibold underline underline-offset-2">
                Sign in
              </Link>
            </p>
          </div>
        )}

        {invite && !inviteError && (
          <>
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3">
              <Mail className="h-4 w-4 text-primary" aria-hidden />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Invited as</p>
                <p className="text-sm font-semibold text-foreground">{invite.email}</p>
              </div>
              <span className="ml-auto rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-primary">
                {invite.plan}
              </span>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Full name
                </Label>
                <Input id="name" autoComplete="name" {...register("name")} className="h-11 rounded-xl" />
                {errors.name && <p className="text-[11px] font-semibold text-rose-600">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    {...register("password")}
                    className="h-11 rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] font-semibold text-rose-600">{errors.password.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Confirm password
                </Label>
                <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} className="h-11 rounded-xl" />
                {errors.confirm && <p className="text-[11px] font-semibold text-rose-600">{errors.confirm.message}</p>}
              </div>
              {serverError && (
                <p className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] font-medium text-rose-600">
                  {serverError}
                </p>
              )}
              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                transition={springSoft}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-[11px] font-bold uppercase tracking-[0.1em] text-primary-foreground disabled:opacity-50"
              >
                {loading ? "Creating account…" : (
                  <>
                    <span>Activate account</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </>
                )}
              </motion.button>
            </form>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
