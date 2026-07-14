/**
 * Private-seller Instant Offer / fair-ask pack.
 *
 * Uses market median (or district median when available) to suggest:
 * - Suggested ask at the median
 * - Walkaway floor at median × 0.92 (good-deal aligned)
 * - Dealer offer band from median × 0.85 to median × 0.92
 */

export const WALKAWAY_MULTIPLIER = 0.92;
export const DEALER_OFFER_LOW_MULTIPLIER = 0.85;
export const DEALER_OFFER_HIGH_MULTIPLIER = 0.92;

export interface SellerFairAskInput {
  marketMedian: number;
  /** Optional district-level median; preferred when positive. */
  districtMedian?: number | null;
}

export interface DealerOfferBand {
  low: number;
  high: number;
}

export interface SellerFairAskResult {
  /** Median used for all targets (district when available, else market). */
  median: number;
  suggestedAsk: number;
  walkaway: number;
  dealerOfferBand: DealerOfferBand;
  /** Whether district median was used. */
  usedDistrictMedian: boolean;
}

function roundLkr(value: number): number {
  return Math.round(value);
}

/**
 * Resolve the pricing median: prefer a positive district median over market.
 */
export function resolveFairAskMedian(
  marketMedian: number,
  districtMedian?: number | null,
): { median: number; usedDistrictMedian: boolean } | null {
  const market = Number(marketMedian);
  const district = districtMedian == null ? NaN : Number(districtMedian);

  if (Number.isFinite(district) && district > 0) {
    return { median: district, usedDistrictMedian: true };
  }
  if (Number.isFinite(market) && market > 0) {
    return { median: market, usedDistrictMedian: false };
  }
  return null;
}

/**
 * Compute private-seller fair-ask targets from market / district medians.
 * Returns null when no usable median is provided.
 */
export function computeSellerFairAsk(input: SellerFairAskInput): SellerFairAskResult | null {
  const resolved = resolveFairAskMedian(input.marketMedian, input.districtMedian);
  if (!resolved) return null;

  const { median, usedDistrictMedian } = resolved;
  const suggestedAsk = roundLkr(median);
  const walkaway = roundLkr(median * WALKAWAY_MULTIPLIER);
  const dealerOfferBand: DealerOfferBand = {
    low: roundLkr(median * DEALER_OFFER_LOW_MULTIPLIER),
    high: roundLkr(median * DEALER_OFFER_HIGH_MULTIPLIER),
  };

  return {
    median: suggestedAsk,
    suggestedAsk,
    walkaway,
    dealerOfferBand,
    usedDistrictMedian,
  };
}

export interface SellerFairAskWhatsAppInput {
  make?: string;
  model?: string;
  year?: number;
  suggestedAsk: number;
  walkaway: number;
  dealerOfferBand: DealerOfferBand;
  /** Pre-formatted LKR strings (e.g. from formatPrice). */
  formatLkr: (value: number) => string;
}

/**
 * Short English WhatsApp message for private sellers sharing their ask pack.
 */
export function buildSellerFairAskWhatsAppText(input: SellerFairAskWhatsAppInput): string {
  const vehicle = [input.year, input.make, input.model].filter(Boolean).join(" ").trim();
  const title = vehicle || "My vehicle";
  const { formatLkr, suggestedAsk, walkaway, dealerOfferBand } = input;

  return [
    `AutoLens LK fair-ask for ${title}:`,
    `Suggested ask: ${formatLkr(suggestedAsk)}`,
    `Walkaway: ${formatLkr(walkaway)}`,
    `Dealer offer band: ${formatLkr(dealerOfferBand.low)} – ${formatLkr(dealerOfferBand.high)}`,
  ].join("\n");
}
