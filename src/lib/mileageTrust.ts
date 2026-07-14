/**
 * Mileage anomaly / trust heuristics against typical annual km for Sri Lanka.
 * Cohort benchmarks are planning defaults (private daily + highway mix).
 */

export type MileageRiskLevel = "low" | "medium" | "high" | "unknown";

export interface MileageTrustInput {
  mileageKm: number | null | undefined;
  year: number | null | undefined;
  nowYear?: number;
}

export interface MileageTrustResult {
  risk: MileageRiskLevel;
  label: string;
  detail: string;
  kmPerYear: number | null;
  expectedKmPerYear: number;
  ageYears: number | null;
}

/** Typical annual km for Sri Lanka passenger cars used in anomaly checks. */
export const TYPICAL_KM_PER_YEAR = 12_000;

export function computeMileageTrust(input: MileageTrustInput): MileageTrustResult {
  const expectedKmPerYear = TYPICAL_KM_PER_YEAR;
  const nowYear = input.nowYear ?? new Date().getFullYear();
  const year = Number(input.year);
  const mileage = Number(input.mileageKm);

  if (!Number.isFinite(year) || year < 1980 || year > nowYear + 1) {
    return {
      risk: "unknown",
      label: "Mileage unverified",
      detail: "Year missing — cannot score km/year vs cohort.",
      kmPerYear: null,
      expectedKmPerYear,
      ageYears: null,
    };
  }

  if (input.mileageKm == null || !Number.isFinite(mileage) || mileage < 0) {
    return {
      risk: "unknown",
      label: "Mileage unverified",
      detail: "Odometer not listed.",
      kmPerYear: null,
      expectedKmPerYear,
      ageYears: Math.max(1, nowYear - year),
    };
  }

  const ageYears = Math.max(1, nowYear - year);
  const kmPerYear = mileage / ageYears;
  const ratio = kmPerYear / expectedKmPerYear;

  // Extremely low km/year on older cars is a common fraud / rollback signal.
  if (ageYears >= 3 && ratio < 0.35) {
    return {
      risk: "high",
      label: "Low km anomaly",
      detail: `≈ ${Math.round(kmPerYear).toLocaleString()} km/yr vs ~${expectedKmPerYear.toLocaleString()} typical — verify odometer.`,
      kmPerYear,
      expectedKmPerYear,
      ageYears,
    };
  }

  // Very high usage changes residual expectations but is less often fraud.
  if (ratio > 2.2) {
    return {
      risk: "medium",
      label: "High usage",
      detail: `≈ ${Math.round(kmPerYear).toLocaleString()} km/yr — above typical SL private use.`,
      kmPerYear,
      expectedKmPerYear,
      ageYears,
    };
  }

  if (ratio < 0.55 && ageYears >= 2) {
    return {
      risk: "medium",
      label: "Below-average km",
      detail: `≈ ${Math.round(kmPerYear).toLocaleString()} km/yr — confirm service/history.`,
      kmPerYear,
      expectedKmPerYear,
      ageYears,
    };
  }

  return {
    risk: "low",
    label: "Mileage looks typical",
    detail: `≈ ${Math.round(kmPerYear).toLocaleString()} km/yr vs ~${expectedKmPerYear.toLocaleString()} cohort baseline.`,
    kmPerYear,
    expectedKmPerYear,
    ageYears,
  };
}
