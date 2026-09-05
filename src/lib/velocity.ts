/**
 * Velocity bands for Pro lane intelligence.
 * Primary signal is a stats-provided median days-on-market; when absent we
 * fall back to DOM lengths derived from listing first/last seen timestamps.
 */

/** Under this many days on market → Fast. */
export const FAST_DOM_DAYS = 21;
/** Over this many days on market → Slow. */
export const SLOW_DOM_DAYS = 65;

export type VelocityBand = "fast" | "steady" | "slow" | "unknown";

export interface VelocityInput {
  /** Stats-provided median days-on-market (preferred when available). */
  medianDomDays?: number | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  /** Override wall clock for deterministic tests (ms since epoch). */
  nowMs?: number;
}

const DAY_MS = 86_400_000;

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Resolve days-on-market: stats median first, else last−first seen length,
 * else first-seen→now age. Null when nothing usable is available.
 */
export function resolveDomDays(input: VelocityInput): number | null {
  const median = Number(input.medianDomDays);
  if (Number.isFinite(median) && median >= 0) return median;

  const first = parseTime(input.firstSeenAt);
  const last = parseTime(input.lastSeenAt);
  if (first !== null && last !== null && last >= first) {
    return Math.floor((last - first) / DAY_MS);
  }
  if (first !== null) {
    const now = typeof input.nowMs === "number" ? input.nowMs : Date.now();
    if (now >= first) return Math.floor((now - first) / DAY_MS);
  }
  return null;
}

export function velocityBandForDom(domDays: number | null): VelocityBand {
  if (domDays === null || !Number.isFinite(domDays) || domDays < 0) return "unknown";
  if (domDays < FAST_DOM_DAYS) return "fast";
  if (domDays > SLOW_DOM_DAYS) return "slow";
  return "steady";
}

export function resolveVelocity(input: VelocityInput): { domDays: number | null; band: VelocityBand } {
  const domDays = resolveDomDays(input);
  return { domDays, band: velocityBandForDom(domDays) };
}
