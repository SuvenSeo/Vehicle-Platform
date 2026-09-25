/**
 * Instalment-first affordability helpers (financing discovery, track B3-E).
 *
 * All CBSL Directions No. 01 of 2026 constants live in `@/lib/cashToOwn`
 * (single source) and are imported here — never redefined.
 *
 * Core inversion: PMT = P·r(1+r)^n / ((1+r)^n − 1)  ⇒
 *   P = PMT · (1 − (1+r)^−n) / r,  maxPrice = P / ltvCap
 */

import {
  CBSL_LTV_CAPS,
  EV_HOME_CHARGER_LKR,
  LEASE_VS_LOAN_RATES_PCT,
  SALARY_DSR_CAP,
  computeCashToOwn,
  maxPrincipalForInstalment,
  monthlyPaymentForPrincipal,
  sortListingsByCashToday,
  type VehicleFinanceClass,
} from "@/lib/cashToOwn";

export const AFFORDABILITY_DEFAULTS = {
  /** "I can pay Rs85k/mo" hero budget. */
  budgetRs: 85_000,
  annualRatePct: 20.5,
  termYears: 5,
  financeClass: "registered_used" as VehicleFinanceClass,
} as const;

export interface AffordabilityTerms {
  annualRatePct?: number;
  termYears?: number;
  financeClass?: VehicleFinanceClass;
}

/** Max sticker price whose max-finance instalment fits `monthlyRs`. */
export function maxPriceFromInstalment(
  monthlyRs: number,
  terms: AffordabilityTerms = {},
): number | null {
  const {
    annualRatePct = AFFORDABILITY_DEFAULTS.annualRatePct,
    termYears = AFFORDABILITY_DEFAULTS.termYears,
    financeClass = AFFORDABILITY_DEFAULTS.financeClass,
  } = terms;
  const principal = maxPrincipalForInstalment(monthlyRs, annualRatePct, termYears);
  if (principal == null) return null;
  const ltvCap = CBSL_LTV_CAPS[financeClass];
  const price = Math.round(principal / ltvCap);
  // Same realism floor as computeCashToOwn — CBSL floors, not fantasy cars.
  return computeCashToOwn({ priceLkr: price, financeClass }) ? price : null;
}

/** Monthly instalment for a sticker price at max CBSL finance (LTV floor down). */
export function monthlyForPrice(
  priceLkr: number,
  terms: AffordabilityTerms = {},
): number | null {
  const {
    annualRatePct = AFFORDABILITY_DEFAULTS.annualRatePct,
    termYears = AFFORDABILITY_DEFAULTS.termYears,
    financeClass = AFFORDABILITY_DEFAULTS.financeClass,
  } = terms;
  const result = computeCashToOwn({
    priceLkr: Number(priceLkr),
    financeClass,
    interestRatePct: annualRatePct,
    termYears,
  });
  return result ? result.monthlyPaymentLkr : null;
}

/** True drive-away cash for a price (+ charger when electric). */
export function trueCashForPrice(
  priceLkr: number,
  financeClass: VehicleFinanceClass = AFFORDABILITY_DEFAULTS.financeClass,
  isElectric = false,
): number | null {
  return (
    computeCashToOwn({
      priceLkr: Number(priceLkr),
      financeClass,
      chargerLkr: isElectric ? EV_HOME_CHARGER_LKR : 0,
    })?.trueCashTodayLkr ?? null
  );
}

export type AffordableListing = {
  price_lkr?: number | null;
  deal_score?: number | null;
  fuel_type?: string | null;
};

function isElectricListing(l: AffordableListing): boolean {
  return String(l.fuel_type || "").toLowerCase() === "electric";
}

/**
 * "I can pay Rs X/mo" → eligible listings (instalment ≤ budget) sorted by
 * TRUE cash-today ascending, deal_score tiebreak. Never mutates input.
 */
export function eligibleForInstalment<T extends AffordableListing>(
  listings: T[],
  monthlyRs: number,
  terms: AffordabilityTerms = {},
): T[] {
  const budget = Number(monthlyRs);
  if (!Number.isFinite(budget) || budget <= 0) return [];
  const eligible = listings.filter((l) => {
    const monthly = monthlyForPrice(Number(l.price_lkr || 0), terms);
    return monthly != null && monthly <= budget;
  });
  return sortListingsByCashToday(
    eligible,
    terms.financeClass ?? AFFORDABILITY_DEFAULTS.financeClass,
    (l) => (isElectricListing(l) ? EV_HOME_CHARGER_LKR : 0),
  );
}

export interface DsrInput {
  netSalaryRs: number;
  existingCommitmentsRs?: number;
  proposedInstalmentRs: number;
  dsrCap?: number;
}

export interface DsrResult {
  maxInstalmentRs: number;
  withinCap: boolean;
  utilisationPct: number | null;
}

/** Salary DSR 60% pre-check: instalments ≤ 60% of net salary. */
export function dsrPreCheck(input: DsrInput): DsrResult {
  const salary = Number(input.netSalaryRs);
  const existing = Number(input.existingCommitmentsRs ?? 0);
  const proposed = Number(input.proposedInstalmentRs);
  const cap = input.dsrCap ?? SALARY_DSR_CAP;
  if (!Number.isFinite(salary) || salary <= 0) {
    return { maxInstalmentRs: 0, withinCap: false, utilisationPct: null };
  }
  const maxInstalmentRs = Math.max(0, Math.round(salary * cap - (Number.isFinite(existing) && existing > 0 ? existing : 0)));
  const total = (Number.isFinite(existing) && existing > 0 ? existing : 0) + (Number.isFinite(proposed) ? proposed : 0);
  return {
    maxInstalmentRs,
    withinCap: Number.isFinite(proposed) && proposed > 0 && proposed <= maxInstalmentRs,
    utilisationPct: Math.round((total / (salary * cap)) * 100),
  };
}

export interface LeaseVsLoanRow {
  annualRatePct: number;
  principalLkr: number;
  monthlyLkr: number;
  totalInterestLkr: number;
  totalPayableLkr: number;
}

/** Same max-finance principal priced at 19 / 20.5 / 22% for lease-vs-loan. */
export function leaseVsLoanRows(
  priceLkr: number,
  terms: Omit<AffordabilityTerms, "annualRatePct"> = {},
  rates: readonly number[] = LEASE_VS_LOAN_RATES_PCT,
): LeaseVsLoanRow[] {
  const {
    termYears = AFFORDABILITY_DEFAULTS.termYears,
    financeClass = AFFORDABILITY_DEFAULTS.financeClass,
  } = terms;
  const base = computeCashToOwn({ priceLkr: Number(priceLkr), financeClass, termYears });
  if (!base) return [];
  return rates.map((annualRatePct) => {
    const monthly = monthlyPaymentForPrincipal(base.maxFinanceLkr, annualRatePct, termYears);
    const totalPayable = monthly * termYears * 12;
    return {
      annualRatePct,
      principalLkr: base.maxFinanceLkr,
      monthlyLkr: Math.round(monthly),
      totalInterestLkr: Math.round(Math.max(0, totalPayable - base.maxFinanceLkr)),
      totalPayableLkr: Math.round(totalPayable),
    };
  });
}
