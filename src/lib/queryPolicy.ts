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
