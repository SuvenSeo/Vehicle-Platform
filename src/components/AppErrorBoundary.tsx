import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Surface } from "@/components/Surface";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

const CHUNK_RELOAD_KEY = "autolens.chunk_reload_attempted";
const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk [\d]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
];

function isChunkLoadError(error: Error): boolean {
  const message = String(error?.message || "");
  const stack = String(error?.stack || "");
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message) || pattern.test(stack));
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, errorMessage: null };

  componentDidMount() {
    try {
      window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      // Ignore storage access issues in strict privacy modes.
    }
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true, errorMessage: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isChunkLoadError(error)) {
      try {
        const attempted = window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";
        if (!attempted) {
          window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
          window.location.reload();
          return;
        }
      } catch {
        // Ignore storage access issues and continue to fallback UI.
      }
    }

    this.setState({ errorMessage: error?.message || "Unknown runtime error" });
    console.error("Unhandled frontend error", error, errorInfo);
  }

  handleReload = () => {
    try {
      window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      // Ignore storage access issues in strict privacy modes.
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="page-canvas relative flex min-h-screen items-center justify-center px-6">
        <AmbientBackground variant="subtle" className="fixed inset-0" />
        <Surface variant="glass" className="relative w-full max-w-xl space-y-4 p-8 text-center">
          <p className="tech-label text-zinc-400">AutoLens LK</p>
          <h1 className="text-3xl font-bold">Something went wrong while loading the app.</h1>
          <p className="text-zinc-400 text-sm">
            This prevents a blank screen and lets you recover quickly. Check the browser console for the exact runtime error.
          </p>
          {this.state.errorMessage && (
            <p className="text-zinc-500 text-xs font-mono break-all">{this.state.errorMessage}</p>
          )}
          <Button onClick={this.handleReload} className="mt-2">Reload App</Button>
        </Surface>
      </div>
    );
  }
}
