/**
 * Free vs Pro product limits.
 *
 * Free is a deliberate teaser: enough to feel Motormila’s value,
 * not enough to replace Pro for serious pricing / research work.
 * Admins and Pro/Enterprise subscribers are treated as full access.
 */

export const FREE_LISTINGS_PAGE_SIZE = 12;
/** Free users only see page 1 of the market feed. */
export const FREE_MAX_LISTING_PAGES = 1;
/** Best Picks shortlist length on free. */
export const FREE_BEST_PICKS_LIMIT = 6;
/** Server + local alert cap for free. */
export const FREE_ALERTS_LIMIT = 1;
/** Official Pulse cards shown on free. */
export const FREE_PULSE_LIMIT = 6;
/** Trend history window (months) for free. */
export const FREE_TRENDS_MONTHS = 6;
/** Price-drop cards shown on free Best Picks / dashboard. */
export const FREE_PRICE_DROPS_LIMIT = 3;

export function hasFullPlatformAccess(opts: {
  hasProAccess: boolean;
  isAdmin?: boolean;
}): boolean {
  return Boolean(opts.hasProAccess || opts.isAdmin);
}

export function freeListingsVisibleTotal(marketTotal: number): number {
  return Math.min(Math.max(0, marketTotal), FREE_LISTINGS_PAGE_SIZE * FREE_MAX_LISTING_PAGES);
}

export const freePlanCopy = {
  listingsTitle: "Free browse limit reached",
  listingsBody:
    "You’re seeing the first 12 live listings. Pro unlocks the full market feed, deal scores, and unlimited pagination.",
  picksTitle: "More elite deals on Pro",
  picksBody: "Free shows a short teaser shortlist. Pro unlocks the full ranked Best Picks board and price-cut feed.",
  alertsTitle: "One free alert included",
  alertsBody: "Pro unlocks deeper alert watches, richer match refresh, and WhatsApp notifications.",
  scoresTitle: "Deal scores are a Pro signal",
  scoresBody: "Upgrade to see fair-price scoring on every listing and sort by deal quality.",
  genericCta: "Upgrade to Pro",
} as const;
