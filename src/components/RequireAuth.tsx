import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/authContext";

/** Blocks the whole product shell until the visitor has a Motormila session. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center" aria-label="Checking session" role="status">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-foreground/[0.08]" />
            <div className="absolute inset-0 animate-spin rounded-full border-t-2 border-primary" />
          </div>
          <p className="tech-label">Checking session</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
