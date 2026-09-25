import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCompactAge, getListingAgeMs } from "@/lib/dataFreshness";

export interface UseStalenessOptions {
  /** React Query key to revalidate on refresh. Omit + pass onRefresh for custom fetching. */
  queryKey?: unknown[];
  /** Age after which isStale flips. Defaults to 6h (LISTING_DATA_STALE_MS scale). */
  staleAfterMs?: number;
  /** Injectable clock for deterministic tests/stories. */
  now?: Date;
  /** Mock-friendly override; when set, refresh() calls this instead of the query client. */
  onRefresh?: () => void | Promise<unknown>;
}

export interface Staleness {
  ageMs: number | null;
  /** e.g. "updated 5m ago" / "updated just now" / "updated —". */
  updatedXMinAgo: string;
  isStale: boolean;
  /** Append to a queryKey for a true cache-bust remount of cached stats. */
  cacheBuster: number;
  /** SWR refresh: keeps stale data visible while revalidating in background. */
  refresh: (opts?: { cacheBust?: boolean }) => Promise<void>;
}

const DEFAULT_STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export function useStaleness(
  updatedAt: string | null | undefined,
  options: UseStalenessOptions = {},
): Staleness {
  const { queryKey, staleAfterMs = DEFAULT_STALE_AFTER_MS, now, onRefresh } = options;
  const queryClient = useQueryClient();
  const [cacheBuster, setCacheBuster] = useState(0);

  // Reactive "now" is intentionally the render time (or injected test clock);
  // callers re-render on query state changes, which is when age labels matter.
  const currentNow = useMemo(() => now ?? new Date(), [now]);

  const ageMs = useMemo(
    () => getListingAgeMs(updatedAt, currentNow),
    [updatedAt, currentNow],
  );

  const updatedXMinAgo = useMemo(() => {
    if (ageMs === null) return "updated —";
    if (ageMs < 60_000) return "updated just now";
    return `updated ${formatCompactAge(updatedAt, currentNow)} ago`;
  }, [ageMs, updatedAt, currentNow]);

  const isStale = useMemo(
    () => (ageMs === null ? false : ageMs > staleAfterMs),
    [ageMs, staleAfterMs],
  );

  const refresh = useCallback(
    async (opts?: { cacheBust?: boolean }) => {
      if (onRefresh) {
        await onRefresh();
        return;
      }
      if (!queryKey) return;
      if (opts?.cacheBust) {
        // Bump first so a keyed query ([...queryKey, cacheBuster]) drops the
        // cached entry entirely; invalidate then refetches both old and new keys.
        setCacheBuster((n) => n + 1);
        await queryClient.invalidateQueries({ queryKey, refetchType: "all" });
        return;
      }
      await queryClient.refetchQueries({ queryKey });
    },
    [onRefresh, queryKey, queryClient],
  );

  return { ageMs, updatedXMinAgo, isStale, cacheBuster, refresh };
}
