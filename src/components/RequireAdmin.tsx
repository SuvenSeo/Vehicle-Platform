import { type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/authContext";

/** Admin-only route guard for /admin. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-rose-500" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">Admin only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This console is limited to Motormila administrators.
        </p>
        <Link to="/" className="mt-6 inline-flex text-sm font-semibold text-primary underline-offset-2 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
