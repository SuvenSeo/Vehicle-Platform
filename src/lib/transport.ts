import type { ProArbitrageGap } from "@/types/pro";

/**
 * Props-driven transport estimator for cross-district arbitrage.
 * Net opportunity = gross median gap − (fuel + driver + transfer).
 */

export interface TransportEstimateInput {
  /** One-way distance in km between the buy and sell districts. */
  distanceKm?: number | null;
  /** Fuel + wear cost per km in LKR. */
  fuelLkrPerKm?: number | null;
  /** Driver / delivery fee in LKR. */
  driverFeeLkr?: number | null;
  /** Ownership transfer + RMV paperwork fee in LKR. */
  transferFeeLkr?: number | null;
}

export interface TransportBreakdown {
  distanceKm: number;
  fuelLkr: number;
  driverLkr: number;
  transferLkr: number;
  totalLkr: number;
}

/** Sensible Sri Lanka defaults: ~Colombo↔Kandy round-trip distance basis. */
export const DEFAULT_TRANSPORT: Required<TransportEstimateInput> = {
  distanceKm: 120,
  fuelLkrPerKm: 150,
  driverFeeLkr: 8000,
  transferFeeLkr: 15000,
};

function toPositive(value: number | null | undefined, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

export function estimateTransportCost(input: TransportEstimateInput = {}): TransportBreakdown {
  const distanceKm = toPositive(input.distanceKm, DEFAULT_TRANSPORT.distanceKm);
  const fuelLkrPerKm = toPositive(input.fuelLkrPerKm, DEFAULT_TRANSPORT.fuelLkrPerKm);
  const driverLkr = toPositive(input.driverFeeLkr, DEFAULT_TRANSPORT.driverFeeLkr);
  const transferLkr = toPositive(input.transferFeeLkr, DEFAULT_TRANSPORT.transferFeeLkr);
  const fuelLkr = Math.round(distanceKm * fuelLkrPerKm);
  return {
    distanceKm,
    fuelLkr,
    driverLkr,
    transferLkr,
    totalLkr: fuelLkr + driverLkr + transferLkr,
  };
}

export function grossGapLkr(gap: Pick<ProArbitrageGap, "sell_median_lkr" | "buy_median_lkr">): number {
  const sell = Number(gap.sell_median_lkr);
  const buy = Number(gap.buy_median_lkr);
  if (!Number.isFinite(sell) || !Number.isFinite(buy)) return 0;
  return sell - buy;
}

/** Net gap after transport. Positive = opportunity survives the move. */
export function netGapLkr(
  gap: Pick<ProArbitrageGap, "sell_median_lkr" | "buy_median_lkr">,
  transportLkr: number | null | undefined,
): number {
  const transport = Number(transportLkr);
  return grossGapLkr(gap) - (Number.isFinite(transport) && transport > 0 ? transport : 0);
}

/**
 * Props-driven transport override for tables/exports:
 * a flat LKR figure, or a per-gap resolver (e.g. district distance lookup).
 */
export type TransportForGap = number | ((gap: ProArbitrageGap) => number | null | undefined);

export function resolveTransportLkr(
  gap: ProArbitrageGap,
  transport?: TransportForGap,
  fallbackInput: TransportEstimateInput = {},
): number {
  if (typeof transport === "function") {
    const resolved = Number(transport(gap));
    if (Number.isFinite(resolved) && resolved >= 0) return resolved;
  } else if (transport !== undefined) {
    const flat = Number(transport);
    if (Number.isFinite(flat) && flat >= 0) return flat;
  }
  return estimateTransportCost(fallbackInput).totalLkr;
}
