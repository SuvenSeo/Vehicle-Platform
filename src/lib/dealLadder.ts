/**
 * CarGurus-style deal ladder thresholds aligned with FairPriceIndicator
 * and backend deal_scores: score = (1 - price/median) * 100.
 *
 * - Good Deal:  score >= 8  → price ≤ median × 0.92
 * - Overpriced: score ≤ -5 → price ≥ median × 1.05
 * - Fair:       otherwise
 */

export const GOOD_DEAL_SCORE = 8;
export const OVERPRICED_SCORE = -5;

/** Price multiplier for Good Deal (8% below median). */
export const GOOD_DEAL_MULTIPLIER = 1 - GOOD_DEAL_SCORE / 100; // 0.92

/** Price multiplier for Overpriced threshold (5% above median). */
export const OVERPRICED_MULTIPLIER = 1 - OVERPRICED_SCORE / 100; // 1.05

export type DealBand = "good_deal" | "fair" | "overpriced";

export interface DealLadderInput {
  askingPrice: number;
  marketMedianLkr: number;
}

export interface DealLadderRung {
  band: DealBand;
  label: string;
  /** Max asking price that still qualifies for this band (inclusive). */
  maxPrice: number;
  active: boolean;
}

export interface DealLadderResult {
  band: DealBand;
  bandLabel: string;
  dealScore: number;
  askingPrice: number;
  median: number;
  /** Asking price at or below this hits Good Deal (score ≥ 8). */
  goodDealPrice: number;
  /** Asking price at or above this is Overpriced (score ≤ -5). */
  overpricedThreshold: number;
  /** Rupees to cut to reach goodDealPrice; 0 if already in Good Deal. */
  cutToGoodDeal: number;
  /** Rupees to cut to exit Overpriced into Fair; 0 when not overpriced. */
  cutToFair: number;
  headline: string;
  rungs: DealLadderRung[];
}

export function dealScoreFromPrice(askingPrice: number, median: number): number {
  if (!(median > 0) || !Number.isFinite(askingPrice) || !Number.isFinite(median)) {
    return 0;
  }
  return Math.round((1 - askingPrice / median) * 1000) / 10;
}

export function bandFromDealScore(score: number): DealBand {
  if (score >= GOOD_DEAL_SCORE) return "good_deal";
  if (score <= OVERPRICED_SCORE) return "overpriced";
  return "fair";
}

export function bandLabel(band: DealBand): string {
  switch (band) {
    case "good_deal":
      return "Good Deal";
    case "fair":
      return "Fair Price";
    case "overpriced":
      return "Overpriced";
    default: {
      const _exhaustive: never = band;
      return _exhaustive;
    }
  }
}

function roundLkr(value: number): number {
  return Math.round(value);
}

/**
 * Compute deal-ladder targets from asking price and market median.
 * Returns null when inputs are missing or non-positive.
 */
export function computeDealLadder(input: DealLadderInput): DealLadderResult | null {
  const askingPrice = Number(input.askingPrice);
  const median = Number(input.marketMedianLkr);

  if (!Number.isFinite(askingPrice) || !Number.isFinite(median) || askingPrice <= 0 || median <= 0) {
    return null;
  }

  const goodDealPrice = roundLkr(median * GOOD_DEAL_MULTIPLIER);
  const overpricedThreshold = roundLkr(median * OVERPRICED_MULTIPLIER);
  const dealScore = dealScoreFromPrice(askingPrice, median);
  const band = bandFromDealScore(dealScore);
  const cutToGoodDeal = Math.max(0, roundLkr(askingPrice - goodDealPrice));
  const cutToFair = band === "overpriced" ? Math.max(0, roundLkr(askingPrice - overpricedThreshold + 1)) : 0;

  let headline: string;
  if (band === "good_deal") {
    headline = "Already a Good Deal";
  } else if (cutToGoodDeal > 0) {
    headline = `Cut ${cutToGoodDeal.toLocaleString("en-LK")} to hit Good Deal`;
  } else {
    headline = bandLabel(band);
  }

  const rungs: DealLadderRung[] = [
    {
      band: "good_deal",
      label: "Good Deal",
      maxPrice: goodDealPrice,
      active: band === "good_deal",
    },
    {
      band: "fair",
      label: "Fair Price",
      maxPrice: overpricedThreshold - 1,
      active: band === "fair",
    },
    {
      band: "overpriced",
      label: "Overpriced",
      maxPrice: Number.POSITIVE_INFINITY,
      active: band === "overpriced",
    },
  ];

  return {
    band,
    bandLabel: bandLabel(band),
    dealScore,
    askingPrice,
    median,
    goodDealPrice,
    overpricedThreshold,
    cutToGoodDeal,
    cutToFair,
    headline,
    rungs,
  };
}
