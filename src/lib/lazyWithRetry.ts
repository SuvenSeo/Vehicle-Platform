import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk [\d]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
];

const CHUNK_RELOAD_KEY = "autolens.chunk_reload_attempted";

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? String(error.stack || "") : "";
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message) || pattern.test(stack));
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Retry lazy route chunks once, then auto-reload on stale deploy mismatches. */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (firstError) {
      if (!isChunkLoadError(firstError)) throw firstError;

      await sleep(350);
      try {
        return await factory();
      } catch (secondError) {
        if (!isChunkLoadError(secondError)) throw secondError;

        try {
          if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) !== "1") {
            window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
            window.location.reload();
          }
        } catch {
          // Ignore storage failures and surface the original error.
        }

        throw secondError;
      }
    }
  });
}
