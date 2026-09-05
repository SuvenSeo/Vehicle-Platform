/**
 * Granular React Query freshness windows.
 *
 * Listings change often (new posts / price cuts); market aggregates and
 * official pulse data are warmed post-scrape and rarely need sub-minute
 * refetching. Prefer these constants over magic numbers in pages.
 */
export const QUERY_STALE = {
  /** Live listing feeds / search results. */
  listings: 10_000,
  /** Summary stats that still benefit from fairly fresh counts. */
  stats: 60_000,
  /** Hub insight payloads (make/model/district). */
  hub: 120_000,
  /** Heavy aggregates: trends, velocity, drops, EV insight, pulse. */
  market: 300_000,
} as const;

/**
 * Stale-while-revalidate defaults for stats queries, mirroring the backend
 * per-key cache TTLs (`backend/app/utils/stats_cache.py`): the server only
 * recomputes each aggregate per TTL window, so refetching more often just
 * re-serves the identical cached payload. Spread one of these into a
 * stats `useQuery` — cached data renders instantly while React Query
 * revalidates in the background once past `staleTime` (SWR).
 */
export const STATS_SWR = {
  /** Summary: backend TTL 15min. */
  summary: { staleTime: 15 * 60_000, gcTime: 60 * 60_000 },
  /** District velocity: backend TTL 1h. */
  velocity: { staleTime: 60 * 60_000, gcTime: 4 * 60 * 60_000 },
  /** Price trends: backend TTL 6h. */
  trends: { staleTime: 6 * 60 * 60_000, gcTime: 12 * 60 * 60_000 },
  /** Price index: backend TTL 24h. */
  priceIndex: { staleTime: 24 * 60 * 60_000, gcTime: 48 * 60 * 60_000 },
  /** Shared SWR posture for all stats queries. */
  shared: { refetchOnWindowFocus: false, retry: 1 },
} as const;
