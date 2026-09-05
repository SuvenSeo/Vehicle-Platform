/**
 * Trial gating for Pro lane intelligence.
 * Free visitors see 1 lane / 3 arbitrage gaps (the rest blurred + locked);
 * Pro + trialing plans see everything and get clean (unwatermarked) exports.
 */

/** Free teaser depth: lanes visible before the blur gate. */
export const FREE_LANE_LIMIT = 1;
/** Free teaser depth: arbitrage gaps visible before the blur gate. */
export const FREE_GAP_LIMIT = 3;

export interface GatedRows<T> {
  visible: T[];
  lockedCount: number;
}

export function gateByLimit<T>(rows: T[], hasProAccess: boolean, freeLimit: number): GatedRows<T> {
  if (hasProAccess) return { visible: rows, lockedCount: 0 };
  return {
    visible: rows.slice(0, freeLimit),
    lockedCount: Math.max(0, rows.length - freeLimit),
  };
}

export function gateLanes<T>(lanes: T[], hasProAccess: boolean): GatedRows<T> {
  return gateByLimit(lanes, hasProAccess, FREE_LANE_LIMIT);
}

export function gateGaps<T>(gaps: T[], hasProAccess: boolean): GatedRows<T> {
  return gateByLimit(gaps, hasProAccess, FREE_GAP_LIMIT);
}
