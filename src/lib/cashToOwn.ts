/**
 * Cash-to-own / CBSL LTV helpers for Sri Lanka vehicle finance planning.
 *
 * LTV caps reflect CBSL Act Directions No. 01 of 2026 (effective 25 May
 * 2026): commercial vehicles 60%, registered used (>1yr since first
 * registration) 60%, all other private vehicles (unregistered / brand-new /
 * under-1yr) 40%. The 2018-era EV LTV concession was eliminated in July
 * 2025 — private EVs follow their registration class like any other car.
 * Rates are planning defaults; banks set final margins.
 */

export type VehicleFinanceClass =
  | "registered_used"
  | "unregistered"
  | "brand_new"
  | "electric_commercial";

export interface CashToOwnInput {
  priceLkr: number;
  financeClass?: VehicleFinanceClass;
  /** Override max financeable share (0–1). Defaults from CBSL class table. */
  ltvCap?: number;
  interestRatePct?: number;
  termYears?: number;
  /** Annual comprehensive insurance estimate override (LKR). */
  insuranceAnnualLkr?: number;
  /** Stamp duty + fees as share of financed principal (default 2%). */
  stampDutyPct?: number;
}

export interface CashToOwnResult {
  priceLkr: number;
  financeClass: VehicleFinanceClass;
  ltvCap: number;
  maxFinanceLkr: number;
  minCashDownLkr: number;
  stampDutyLkr: number;
  insuranceAnnualLkr: number;
  cashToOwnTodayLkr: number;
  monthlyPaymentLkr: number;
  totalInterestLkr: number;
  termYears: number;
  interestRatePct: number;
  affordableNote: string;
}

/** CBSL max loan-to-value by vehicle class (Directions No. 01 of 2026). */
export const CBSL_LTV_CAPS: Record<VehicleFinanceClass, number> = {
  registered_used: 0.6,
  unregistered: 0.4,
  brand_new: 0.4,
  electric_commercial: 0.6, // commercial-vehicle tier; EV concession removed Jul 2025
};

/** Stable order for finance-class selectors. */
export const VEHICLE_FINANCE_CLASSES: readonly VehicleFinanceClass[] = [
  "registered_used",
  "unregistered",
  "brand_new",
  "electric_commercial",
];

export const DEFAULT_INTEREST_RATE_PCT = 15;
export const DEFAULT_TERM_YEARS = 5;
export const DEFAULT_STAMP_DUTY_PCT = 2;

const FINANCE_CLASS_LABELS: Record<VehicleFinanceClass, string> = {
  registered_used: "Registered used (>1yr)",
  unregistered: "Unregistered / reconditioned",
  brand_new: "Brand new / <1yr",
  electric_commercial: "Commercial (60% LTV)",
};

export function getFinanceClassLabel(financeClass: VehicleFinanceClass): string {
  return FINANCE_CLASS_LABELS[financeClass];
}

export function inferFinanceClass(input: {
  condition?: string | null;
  fuelType?: string | null;
  year?: number | null;
  nowYear?: number;
}): VehicleFinanceClass {
  const condition = String(input.condition || "").toLowerCase();
  const nowYear = input.nowYear ?? new Date().getFullYear();
  const year = Number(input.year);

  // Note: EVs no longer get a higher-LTV class (concession removed Jul 2025)
  // — private EVs follow their registration class like any other car.
  if (condition.includes("new") || condition.includes("unreg") || condition.includes("recon")) {
    return "unregistered";
  }
  if (Number.isFinite(year) && year >= nowYear - 1) {
    return "brand_new";
  }
  return "registered_used";
}

export function estimateInsuranceAnnual(priceLkr: number): number {
  if (!Number.isFinite(priceLkr) || priceLkr <= 0) return 0;
  // Rough comprehensive band: ~1.2% of ask with floor/ceiling for local market.
  return Math.round(Math.min(250_000, Math.max(80_000, priceLkr * 0.012)));
}

function amortizeMonthly(principal: number, annualRatePct: number, termYears: number): number {
  if (principal <= 0 || termYears <= 0) return 0;
  const n = termYears * 12;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function computeCashToOwn(input: CashToOwnInput): CashToOwnResult | null {
  const price = Number(input.priceLkr);
  if (!Number.isFinite(price) || price < 100_000) return null;

  const financeClass = input.financeClass ?? "registered_used";
  const ltvCap = Math.min(0.9, Math.max(0.1, input.ltvCap ?? CBSL_LTV_CAPS[financeClass]));
  const interestRatePct = input.interestRatePct ?? DEFAULT_INTEREST_RATE_PCT;
  const termYears = input.termYears ?? DEFAULT_TERM_YEARS;
  const stampDutyPct = input.stampDutyPct ?? DEFAULT_STAMP_DUTY_PCT;

  const maxFinanceLkr = Math.round(price * ltvCap);
  const minCashDownLkr = Math.round(price - maxFinanceLkr);
  const stampDutyLkr = Math.round(maxFinanceLkr * (stampDutyPct / 100));
  const insuranceAnnualLkr =
    input.insuranceAnnualLkr ?? estimateInsuranceAnnual(price);
  const cashToOwnTodayLkr = minCashDownLkr + stampDutyLkr + Math.round(insuranceAnnualLkr / 12);

  const monthlyPaymentLkr = amortizeMonthly(maxFinanceLkr, interestRatePct, termYears);
  const totalInterestLkr = Math.max(0, monthlyPaymentLkr * termYears * 12 - maxFinanceLkr);

  return {
    priceLkr: price,
    financeClass,
    ltvCap,
    maxFinanceLkr,
    minCashDownLkr,
    stampDutyLkr,
    insuranceAnnualLkr,
    cashToOwnTodayLkr,
    monthlyPaymentLkr: Math.round(monthlyPaymentLkr),
    totalInterestLkr: Math.round(totalInterestLkr),
    termYears,
    interestRatePct,
    affordableNote: `CBSL-oriented ${Math.round(ltvCap * 100)}% LTV · ${getFinanceClassLabel(financeClass)}`,
  };
}

/** Down-payment % needed to meet LTV (for sliders: e.g. 40 when LTV is 60%). */
export function minDownPaymentPctForClass(financeClass: VehicleFinanceClass): number {
  return Math.round((1 - CBSL_LTV_CAPS[financeClass]) * 100);
}

/**
 * Min cash down (LTV gap) for a listing price. Defaults to registered_used
 * for comparable ranking when listing metadata is incomplete.
 */
export function minCashDownForPrice(
  priceLkr: number,
  financeClass: VehicleFinanceClass = "registered_used",
): number | null {
  return computeCashToOwn({ priceLkr, financeClass })?.minCashDownLkr ?? null;
}

/**
 * Rank listings by ascending min cash down (CBSL LTV gap). Ties break by
 * higher deal_score so strong deals still surface among similar cash needs.
 */
export function sortListingsByAffordability<
  T extends { price_lkr?: number | null; deal_score?: number | null },
>(listings: T[], financeClass: VehicleFinanceClass = "registered_used"): T[] {
  return [...listings].sort((a, b) => {
    const aDown =
      minCashDownForPrice(Number(a.price_lkr || 0), financeClass) ?? Number.POSITIVE_INFINITY;
    const bDown =
      minCashDownForPrice(Number(b.price_lkr || 0), financeClass) ?? Number.POSITIVE_INFINITY;
    if (aDown !== bDown) return aDown - bDown;
    return Number(b.deal_score || 0) - Number(a.deal_score || 0);
  });
}
