import { Component, type ErrorInfo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { springSnappy, springSoft } from "@/lib/motion";

interface AppErrorBoundaryProps { children: ReactNode; }
interface AppErrorBoundaryState { hasError: boolean; errorMessage: string | null; }

const CHUNK_RELOAD_KEY = "autolens.chunk_reload_attempted";
const CHUNK_ERROR_PATTERNS = [/ChunkLoadError/i, /Loading chunk [\d]+ failed/i, /Failed to fetch dynamically imported module/i, /Importing a module script failed/i];

function isChunkLoadError(error: Error): boolean {
  const msg = String(error?.message || "");
  const stack = String(error?.stack || "");
  return CHUNK_ERROR_PATTERNS.some((p) => p.test(msg) || p.test(stack));
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, errorMessage: null };

  componentDidMount() { try { window.sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* storage unavailable */ } }

  static getDerivedStateFromError(): AppErrorBoundaryState { return { hasError: true, errorMessage: null }; }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isChunkLoadError(error)) {
      try {
        if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) !== "1") {
          window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
          window.location.reload();
          return;
        }
      } catch { /* storage unavailable — fall through to error UI */ }
    }
    this.setState({ errorMessage: error?.message || "Unknown runtime error" });
    console.error("Unhandled frontend error", error, errorInfo);
  }

  handleReload = () => {
    try { window.sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* storage unavailable */ }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
          className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-soft-lg"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Motormila</p>
          <h1 className="mt-3 font-display text-xl font-semibold text-foreground">Something went wrong.</h1>
          <p className="mt-2 text-[12px] text-muted-foreground">Check the browser console for the runtime error.</p>
          {this.state.errorMessage && (
            <p className="mt-3 break-all rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[10px] text-muted-foreground">{this.state.errorMessage}</p>
          )}
          <motion.button
            type="button"
            onClick={this.handleReload}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={springSnappy}
            className="mt-5 h-9 rounded-lg bg-primary px-5 text-[10px] font-bold uppercase tracking-[0.08em] text-white hover:bg-primary/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Reload App
          </motion.button>
        </motion.div>
      </div>
    );
  }
}
