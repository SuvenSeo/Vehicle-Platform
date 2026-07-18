import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { API_BASE } from "@/services/api";
import { storeAuthToken } from "@/lib/authToken";

export interface AuthUser {
  email: string;
  name: string;
  plan: "free" | "pro" | "enterprise";
  subscriptionStatus: "none" | "trialing" | "active" | "past_due";
  avatarInitials: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  hasProAccess: boolean;
  previewAccessEnabled: boolean;
}

const STORAGE_KEY = "autolens.auth_user";
const DEMO_USERS_ENV = "VITE_DEMO_USERS";
const BACKEND_AUTH_ENABLED = import.meta.env.VITE_ENABLE_BACKEND_AUTH === "true";

/**
 * When true, Pro export actions require an authenticated Pro/Enterprise session.
 * Enabled explicitly via VITE_PRO_ACCESS_ENFORCED=true, or automatically in
 * production builds (import.meta.env.PROD), matching the backend PRO_ACCESS_ENFORCED flag.
 */
export const PRO_EXPORTS_ENFORCED: boolean =
  import.meta.env.VITE_PRO_ACCESS_ENFORCED === "true" || import.meta.env.PROD === true;

type DemoAccountRecord = AuthUser & { password: string };
type LoginResponse = { user?: Partial<AuthUser>; token?: string };

// No accounts are ever baked into the shipped bundle. Demo/review accounts
// exist only when a build explicitly opts in via VITE_ENABLE_DEMO_AUTH=true
// and provides them through VITE_DEMO_USERS.
function parseDemoUsers(): Record<string, DemoAccountRecord> {
  const users: Record<string, DemoAccountRecord> = {};

  if (import.meta.env.VITE_ENABLE_DEMO_AUTH !== "true") return users;

  const raw = String(import.meta.env[DEMO_USERS_ENV] || "").trim();
  if (!raw) return users;

  try {
    const parsed = JSON.parse(raw) as DemoAccountRecord[];
    if (!Array.isArray(parsed)) return users;

    return parsed.reduce<Record<string, DemoAccountRecord>>((acc, item) => {
      const email = String(item?.email || "").trim().toLowerCase();
      const password = String(item?.password || "");
      const plan = item?.plan === "enterprise" ? "enterprise" : item?.plan === "pro" ? "pro" : item?.plan === "free" ? "free" : null;
      if (!email || !password || !item?.name || !plan) return acc;

      acc[email] = {
        email,
        password,
        name: String(item.name),
        plan,
        subscriptionStatus:
          item.subscriptionStatus === "active" || item.subscriptionStatus === "trialing" || item.subscriptionStatus === "past_due"
            ? item.subscriptionStatus
            : plan === "free"
              ? "none"
              : "active",
        avatarInitials: String(item.avatarInitials || email.slice(0, 2)).slice(0, 3).toUpperCase(),
      };
      return acc;
    }, users);
  } catch {
    return users;
  }
}

const DEMO_USERS = parseDemoUsers();
export const DEMO_AUTH_ENABLED = Object.keys(DEMO_USERS).length > 0;
const PREVIEW_AUTH_ENABLED = !BACKEND_AUTH_ENABLED;
// Passwords are intentionally NOT exported: the sign-in page may list which
// review accounts exist, but secrets never leave this module.
export const DEMO_ACCOUNT_SUMMARY = Object.values(DEMO_USERS).map(({ email, name, plan, subscriptionStatus, avatarInitials }) => ({
  email,
  name,
  plan,
  subscriptionStatus,
  avatarInitials,
}));

const AuthContext = createContext<AuthContextType | null>(null);

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    return normalizeServerUser(parsed, parsed?.email || "");
  } catch {
    return null;
  }
}

function normalizeServerUser(raw: Partial<AuthUser> | undefined, email: string): AuthUser | null {
  if (!raw?.email && !email) return null;
  const normalizedEmail = String(raw?.email || email).trim().toLowerCase();
  const name = String(raw?.name || normalizedEmail.split("@")[0] || "Motormila User").trim();
  const plan = raw?.plan === "enterprise" ? "enterprise" : raw?.plan === "free" ? "free" : "pro";
  const subscriptionStatus =
    raw?.subscriptionStatus === "active" || raw?.subscriptionStatus === "trialing" || raw?.subscriptionStatus === "past_due"
      ? raw.subscriptionStatus
      : plan === "free"
        ? "none"
        : "active";

  return {
    email: normalizedEmail,
    name,
    plan,
    subscriptionStatus,
    avatarInitials: String(raw?.avatarInitials || name.split(/\s+/).map((part) => part[0]).join("") || "AU")
      .slice(0, 3)
      .toUpperCase(),
  };
}

async function loginWithBackend(email: string, password: string): Promise<AuthUser | null> {
  if (!BACKEND_AUTH_ENABLED) return null;

  const response = await fetch(new URL(`${API_BASE}/auth/login`, window.location.origin).toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(response.status === 401 ? "Invalid email or password." : "Authentication service is unavailable.");
  }

  const data = (await response.json().catch(() => ({}))) as LoginResponse;
  storeAuthToken(data.token || null);
  return normalizeServerUser(data.user, email);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser);
  const hasProAccess = Boolean(
    user &&
      (user.plan === "pro" || user.plan === "enterprise") &&
      (user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing"),
  );

  const login = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const serverUser = await loginWithBackend(normalizedEmail, password);
      if (serverUser) {
        setUser(serverUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverUser));
        return { success: true };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Authentication failed." };
    }

    const record = DEMO_USERS[normalizedEmail];
    if (!record || record.password !== password) {
      const error = DEMO_AUTH_ENABLED
        ? "Invalid email or password."
        : "Pro sign-in is not configured for this build.";
      return { success: false, error };
    }

    const demoUser = normalizeServerUser(record, normalizedEmail);
    if (!demoUser) return { success: false, error: "Demo account is misconfigured." };

    setUser(demoUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser));
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    storeAuthToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: user !== null,
        hasProAccess,
        previewAccessEnabled: PREVIEW_AUTH_ENABLED,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
