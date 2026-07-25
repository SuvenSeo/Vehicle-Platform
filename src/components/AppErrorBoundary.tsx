import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorFallback } from "@/components/ErrorFallback";

interface AppErrorBoundaryProps { children: ReactNode; }
interface AppErrorBoundaryState { hasError: boolean; errorMessage: string | null; }

const CHUNK_RELOAD_KEY = "motormila.chunk_reload_attempted";
const CHUNK_RELOAD_KEY_LEGACY = "autolens.chunk_reload_attempted";
const CHUNK_ERROR_PATTERNS = [/ChunkLoadError/i, /Loading chunk [\d]+ failed/i, /Failed to fetch dynamically imported module/i, /Importing a module script failed/i];

function isChunkLoadError(error: Error): boolean {
  const msg = String(error?.message || "");
  const stack = String(error?.stack || "");
  return CHUNK_ERROR_PATTERNS.some((p) => p.test(msg) || p.test(stack));
}

const CHUNK_RELOAD_TTL_MS = 30_000;

function canAttemptChunkReload(): boolean {
  try {
    const raw =
      window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ||
      window.sessionStorage.getItem(CHUNK_RELOAD_KEY_LEGACY);
    if (!raw) return true;
    const stamped = Number(raw);
    if (!Number.isFinite(stamped)) return false;
    return Date.now() - stamped > CHUNK_RELOAD_TTL_MS;
  } catch {
    return true;
  }
}

function markChunkReloadAttempted() {
  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // storage unavailable
  }
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, errorMessage: null };

  static getDerivedStateFromError(): AppErrorBoundaryState { return { hasError: true, errorMessage: null }; }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isChunkLoadError(error)) {
      if (canAttemptChunkReload()) {
        markChunkReloadAttempted();
        window.location.reload();
        return;
      }
    }
    this.setState({ errorMessage: error?.message || "Unknown runtime error" });
    console.error("Unhandled frontend error", error, errorInfo);
    if (!import.meta.env.VITE_SENTRY_DSN) return;

    void import("@sentry/react")
      .then((Sentry) => {
        Sentry.captureException(error, {
          extra: {
            componentStack: errorInfo.componentStack,
          },
        });
      })
      .catch(() => {
        // Ignore reporting failures so the fallback UI never crashes.
      });
  }

  handleReload = () => {
    try {
      window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      window.sessionStorage.removeItem(CHUNK_RELOAD_KEY_LEGACY);
    } catch { /* storage unavailable */ }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <ErrorFallback onReload={this.handleReload} errorMessage={this.state.errorMessage} />
    );
  }
}
