import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk [\d]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
];

const CHUNK_RELOAD_KEY = "motormila.chunk_reload_attempted";
const CHUNK_RELOAD_KEY_LEGACY = "autolens.chunk_reload_attempted";
const CHUNK_RELOAD_TTL_MS = 30_000;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? String(error.stack || "") : "";
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message) || pattern.test(stack));
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

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
    // Ignore storage failures.
  }
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

        if (canAttemptChunkReload()) {
          markChunkReloadAttempted();
          window.location.reload();
        }

        throw secondError;
      }
    }
  });
}
