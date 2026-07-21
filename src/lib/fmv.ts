/** Fair Market Value helpers — cohort median vs asking price. */

export type FmvBand = "below" | "fair" | "above";

export interface FmvSummary {
  fmv_lkr: number;
  asking_lkr: number;
  delta_lkr: number;
  delta_pct: number;
  band: FmvBand;
  label: string;
}

export function summarizeFmv(asking: number, fmv: number): FmvSummary | null {
  if (!Number.isFinite(asking) || !Number.isFinite(fmv) || asking <= 0 || fmv <= 0) {
    return null;
  }
  const delta_lkr = asking - fmv;
  const delta_pct = (delta_lkr / fmv) * 100;
  let band: FmvBand = "fair";
  if (delta_pct <= -5) band = "below";
  else if (delta_pct >= 8) band = "above";

  const absPct = Math.abs(delta_pct);
  const label =
    band === "below"
      ? `Priced ${absPct.toFixed(0)}% below FMV`
      : band === "above"
        ? `Overpriced ${absPct.toFixed(0)}% vs FMV`
        : "Near fair market value";

  return { fmv_lkr: fmv, asking_lkr: asking, delta_lkr, delta_pct, band, label };
}
