// Indicative Sri Lanka vehicle import tax model.
//
// This mirrors the STRUCTURE of the post-2025 import regime:
//   CIF → Customs Import Duty (CID) → CID surcharge → Excise duty charged
//   PER cm³ (per kW for EVs) in capacity bands → Luxury Tax on the CIF
//   portion above a fuel-specific threshold → VAT on the duty-inclusive base.
//
// The band rates below are indicative approximations of the 2025 excise
// schedule and MUST be re-verified against the latest gazette before being
// treated as exact. Update TAX_MODEL_REVIEWED whenever rates are checked.

export const TAX_MODEL_REVIEWED = "2026-07";

export type ImportFuelType = "petrol" | "diesel" | "hybrid" | "electric";

export interface ImportTaxInput {
  cifLkr: number;
  fuelType: ImportFuelType;
  /** Engine capacity in cm³ — required for petrol/diesel/hybrid. */
  engineCc?: number;
  /** Motor power in kW — required for electric. */
  motorKw?: number;
}

export interface ImportTaxLine {
  key: string;
  label: string;
  amount: number;
  note?: string;
}

export interface ImportTaxResult {
  lines: ImportTaxLine[];
  totalTax: number;
  totalOnRoad: number;
}

const CID_RATE = 0.2;
const CID_SURCHARGE_RATE = 0.5; // surcharge applied on the CID amount
const VAT_RATE = 0.18;

interface Band {
  upTo: number; // inclusive upper bound of the band (cc or kW)
  ratePerUnit: number; // LKR per cm³ or per kW, applied to the full capacity
}

const EXCISE_BANDS_PER_CC: Record<Exclude<ImportFuelType, "electric">, Band[]> = {
  petrol: [
    { upTo: 1000, ratePerUnit: 2_450 },
    { upTo: 1300, ratePerUnit: 3_850 },
    { upTo: 1500, ratePerUnit: 4_450 },
    { upTo: 1800, ratePerUnit: 5_150 },
    { upTo: 2000, ratePerUnit: 6_400 },
    { upTo: 2500, ratePerUnit: 7_700 },
    { upTo: Infinity, ratePerUnit: 8_900 },
  ],
  diesel: [
    { upTo: 1500, ratePerUnit: 5_150 },
    { upTo: 1800, ratePerUnit: 6_150 },
    { upTo: 2000, ratePerUnit: 7_100 },
    { upTo: 2500, ratePerUnit: 8_400 },
    { upTo: Infinity, ratePerUnit: 9_650 },
  ],
  hybrid: [
    { upTo: 1000, ratePerUnit: 2_100 },
    { upTo: 1300, ratePerUnit: 3_300 },
    { upTo: 1500, ratePerUnit: 3_850 },
    { upTo: 1800, ratePerUnit: 4_700 },
    { upTo: 2000, ratePerUnit: 5_600 },
    { upTo: 2500, ratePerUnit: 7_100 },
    { upTo: Infinity, ratePerUnit: 8_400 },
  ],
};

const EXCISE_BANDS_PER_KW: Band[] = [
  { upTo: 50, ratePerUnit: 12_500 },
  { upTo: 100, ratePerUnit: 25_000 },
  { upTo: 200, ratePerUnit: 43_000 },
  { upTo: Infinity, ratePerUnit: 55_000 },
];

const LUXURY_TAX: Record<ImportFuelType, { thresholdLkr: number; rateOnExcess: number }> = {
  petrol: { thresholdLkr: 5_000_000, rateOnExcess: 1.0 },
  diesel: { thresholdLkr: 5_000_000, rateOnExcess: 1.2 },
  hybrid: { thresholdLkr: 5_500_000, rateOnExcess: 0.8 },
  electric: { thresholdLkr: 6_000_000, rateOnExcess: 0.6 },
};

function bandRate(bands: Band[], units: number): number {
  const band = bands.find((item) => units <= item.upTo) ?? bands[bands.length - 1];
  return band.ratePerUnit;
}

export function computeImportTaxes(input: ImportTaxInput): ImportTaxResult {
  const cif = Math.max(0, Number(input.cifLkr) || 0);

  const cid = cif * CID_RATE;
  const surcharge = cid * CID_SURCHARGE_RATE;

  let excise = 0;
  let exciseNote = "";
  if (input.fuelType === "electric") {
    const kw = Math.max(0, Number(input.motorKw) || 0);
    const rate = bandRate(EXCISE_BANDS_PER_KW, kw);
    excise = kw * rate;
    exciseNote = kw > 0 ? `Rs. ${rate.toLocaleString()} × ${kw.toLocaleString()} kW` : "Enter motor power (kW)";
  } else {
    const cc = Math.max(0, Number(input.engineCc) || 0);
    const rate = bandRate(EXCISE_BANDS_PER_CC[input.fuelType], cc);
    excise = cc * rate;
    exciseNote = cc > 0 ? `Rs. ${rate.toLocaleString()} × ${cc.toLocaleString()} cc` : "Enter engine capacity";
  }

  const luxury = LUXURY_TAX[input.fuelType];
  const luxuryExcess = Math.max(0, cif - luxury.thresholdLkr);
  const luxuryTax = luxuryExcess * luxury.rateOnExcess;

  // Luxury tax is levied on the CIF excess and is not part of the VAT base.
  const vat = (cif + cid + surcharge + excise) * VAT_RATE;

  const lines: ImportTaxLine[] = [
    { key: "cid", label: `Customs Import Duty (${Math.round(CID_RATE * 100)}%)`, amount: cid },
    { key: "surcharge", label: `CID Surcharge (${Math.round(CID_SURCHARGE_RATE * 100)}% of CID)`, amount: surcharge },
    {
      key: "excise",
      label: input.fuelType === "electric" ? "Excise Duty (per kW band)" : "Excise Duty (per cm³ band)",
      amount: excise,
      note: exciseNote,
    },
    { key: "vat", label: `VAT (${Math.round(VAT_RATE * 100)}% on duty-inclusive value)`, amount: vat },
  ];

  if (luxuryTax > 0) {
    lines.push({
      key: "luxury",
      label: `Luxury Tax (${Math.round(luxury.rateOnExcess * 100)}% of CIF above Rs. ${(luxury.thresholdLkr / 1_000_000).toFixed(1)}M)`,
      amount: luxuryTax,
    });
  }

  const totalTax = lines.reduce((sum, line) => sum + line.amount, 0);

  return {
    lines,
    totalTax,
    totalOnRoad: cif + totalTax,
  };
}
