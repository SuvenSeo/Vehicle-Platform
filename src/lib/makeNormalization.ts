/**
 * Canonical make normalization.
 *
 * Scrape-side make values are noisy: the same brand arrives as "Bmw"/"BMW",
 * "Mg"/"MG", "Dfsk"/"DFSK", "Land rover"/"Land Rover", plus typo variants
 * ("Mitshubishi", "Sukuzi", "Nisan", "Daihatzu", "Cheery") and outright junk
 * ("Test", "TestPOS", "testused", "2018", "Other brand").
 *
 * Those values reach the public make combobox and the valuation/trends model
 * pickers, where duplicates split a brand's listings across several rows and
 * junk makes pollute the filter. Everything that reaches the UI goes through
 * `canonicalizeMake` so a brand is one row with one set of listings.
 *
 * Mirrored in the backend at `backend/app/utils/make_canonical.py`; keep the
 * two tables in sync (the frontend owns the snapshot path, the backend owns
 * the live path).
 */

/** Normalized (lowercase, alnum-only) key -> canonical display name. */
const MAKE_ALIASES: Record<string, string> = {
  // Case / spacing duplicates of the big brands.
  toyota: "Toyota",
  suzuki: "Suzuki",
  nissan: "Nissan",
  honda: "Honda",
  bmw: "BMW",
  benz: "Mercedes",
  bencik: "Benz",
  mercedesbenz: "Mercedes",
  mercedes: "Mercedes",
  mg: "MG",
  kia: "Kia",
  dfsk: "DFSK",
  hyndai: "Hyundai",
  proton: "Proton",
  landrover: "Land Rover",
  rollsroyce: "Rolls-Royce",
  harley: "Harley-Davidson",
  harleydavidson: "Harley-Davidson",
  ssang: "SsangYong",
  ssangyong: "SsangYong",

  // Typo variants seen in live listings.
  mitshubishi: "Mitsubishi",
  suzuzi: "Suzuki",
  sukuzi: "Suzuki",
  nisan: "Nissan",
  daihatzu: "Daihatsu",
  cheery: "Chery",
  mubota: "Kubota",
  kubota: "Kubota",
  hyndaitrajet: "Hyundai",
  suzukimaruti: "Maruti Suzuki",
  marutisuzuki: "Maruti Suzuki",
  sahcmaxus: "Maxus",
  saicmaxus: "Maxus",
  maxus: "Maxus",

  // Scrape artifacts where a model name landed in the make column.
  hondafit: "Honda",
  hondacar: "Honda",
  tatanexon: "Tata",
  mg4: "MG",
  gacaion: "GAC",
  baicbeijing: "BAIC",
  microgeely: "Micro",
  heroelectric: "Hero",
  jeepwrangler: "Jeep",
  mercedesbenzc180: "Mercedes",
  singerlima: "Singer",
};

/**
 * Multi-word values that are a leaked model or garbage rather than a real
 * marque. Kept separate from JUNK_MAKES so genuine two-word brands ("Ashok
 * Leyland", "Royal Enfield", "John Deere") are never dropped by the same rule.
 */
const LEAKED_MODEL_MAKES = new Set([
  "vitzcar",
  "vezelzplay",
  "utone",
  "vivaelite",
  "scooty",
  "car",
  "cars",
  "auto",
  "vehicle",
]);

/**
 * Values that carry no brand information. Returning null for these keeps them
 * out of the make/model filters entirely rather than offering "Test" as a car
 * brand.
 */
const JUNK_MAKES = new Set([
  "other",
  "otherbrand",
  "otherbrands",
  "others",
  "unknown",
  "unnamed",
  "na",
  "n/a",
  "none",
  "null",
  "nil",
  "test",
  "test1",
  "test2",
  "testpos",
  "testlisting",
  "testused",
  "testuser",
  "sample",
  "demo",
  "dummy",
  "lorem",
  "ipsum",
  "asdf",
]);

function compactKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * True when a make value carries no usable brand signal and should be hidden
 * from make pickers, deal rails, and hero features.
 */
export function isJunkMake(value: unknown): boolean {
  const key = compactKey(String(value ?? "").trim());
  if (!key) return true;
  if (JUNK_MAKES.has(key) || LEAKED_MODEL_MAKES.has(key)) return true;
  // A bare model year in the make column ("2018") is never a brand.
  if (/^(19|20)\d{2}$/.test(key)) return true;
  return false;
}

/**
 * Resolve a raw make value to its canonical display name.
 *
 * Returns `null` for junk, so callers can drop the row rather than render an
 * unnamed brand. Unknown-but-plausible single-token makes ("Vikyno") are kept:
 * they may be real niche marques, and silently hiding a brand is worse than
 * showing an uncommon one.
 */
export function canonicalizeMake(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const collapsed = raw.replace(/\s+/g, " ");
  const key = compactKey(collapsed);
  if (!key) return null;
  if (JUNK_MAKES.has(key)) return null;
  if (/^(19|20)\d{2}$/.test(key)) return null;

  const direct = MAKE_ALIASES[key];
  if (direct) return direct;

  // "Honda fit" / "Jeep Wrangler" / "BAIC Beijing": a real brand followed by a
  // model that leaked into the make column. The leading brand is the truth.
  const firstToken = collapsed.split(" ")[0];
  if (firstToken && firstToken !== collapsed) {
    const firstKey = compactKey(firstToken);
    if (firstKey && !JUNK_MAKES.has(firstKey) && !/^(19|20)\d{2}$/.test(firstKey)) {
      const head = MAKE_ALIASES[firstKey];
      if (head) return head;
    }
  }

  // Known leaked model strings ("Vitz car", "VEZEL Z PLAY"). Anything else
  // multi-word is treated as a real marque — "Ashok Leyland" and "Royal
  // Enfield" must survive, so an unknown word is not proof of junk.
  if (LEAKED_MODEL_MAKES.has(key)) return null;

  // Title-case unknown makes so the combobox stays consistent, while
  // preserving genuine short acronyms (TVS, JAC, KTM, BYD).
  return collapsed
    .split(" ")
    .map((part) =>
      part.length <= 4 && part === part.toUpperCase()
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join(" ");
}

/**
 * Common model misspellings seen in live listings (normalized key -> display).
 * Case variants ("chr", "CHR", "C-HR") collapse to one canonical label so a
 * model's listings aren't split across several filter rows.
 */
const MODEL_ALIASES: Record<string, string> = {
  priuas: "Prius",
  prius: "Prius",
  hillux: "Hilux",
  hilux: "Hilux",
  vits: "Vitz",
  vitz: "Vitz",
  chr: "C-HR",
  axio: "Axio",
  aqua: "Aqua",
  vezel: "Vezel",
  vezelzplay: "Vezel",
  fit: "Fit",
  swift: "Swift",
  alto: "Alto",
  wagonr: "Wagon R",
  mira: "Mira",
  move: "Move",
  tanto: "Tanto",
  nv200: "NV200",
  leaf: "Leaf",
  notee: "Note",
  note: "Note",
  serena: "Serena",
  elgrand: "Elgrand",
  landcruiser: "Land Cruiser",
  landcruiserprado: "Land Cruiser Prado",
  prado: "Land Cruiser Prado",
  corolla: "Corolla",
  corollaaxio: "Corolla Axio",
  corollafielder: "Corolla Fielder",
  fielder: "Corolla Fielder",
  allion: "Allion",
  premio: "Premio",
  camry: "Camry",
  crown: "Crown",
  harrier: "Harrier",
  rav4: "RAV4",
  crv: "CR-V",
  x1: "X1",
  x3: "X3",
  x5: "X5",
  "3series": "3 Series",
  "5series": "5 Series",
  cclass: "C-Class",
  eclass: "E-Class",
  sclass: "S-Class",
};

/**
 * True when a model value is actually a phone number (scrape artifact where
 * the seller's contact leaked into the model column). Sri Lankan mobiles are
 * 07XXXXXXXX / +947XXXXXXXX; landlines 0XXXXXXXXX. A model that is mostly
 * digits with phone-like length is junk.
 */
function isPhoneNumberModel(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 12) return false;
  // Must be essentially all digits (allow +, spaces, dashes).
  if (raw.replace(/[+\s\-()]/g, "").replace(/[0-9]/g, "") !== "") return false;
  // SL mobile / landline prefixes, or a bare 9-10 digit run.
  return /^(?:\+?94|0)?[17]\d{8}$/.test(digits) || /^\d{9,10}$/.test(digits);
}

/** Canonicalize a model name: trim, drop junk, fold misspellings. */
export function canonicalizeModel(value: unknown): string {
  const raw = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  const key = compactKey(raw);
  if (!key) return "";
  if (JUNK_MAKES.has(key)) return "";
  if (/^(19|20)\d{2}$/.test(key)) return "";
  // Phone numbers and "other"/"null"-style placeholders carry no model signal.
  if (isPhoneNumberModel(raw)) return "";
  if (/^(other|othermodel|unknownmodel)$/.test(key)) return "";
  const alias = MODEL_ALIASES[key];
  if (alias) return alias;
  return raw;
}

/** A listing is "brandable" when both make and model resolve to real values. */
export function hasUsableMakeModel(make: unknown, model: unknown): boolean {
  return Boolean(canonicalizeMake(make)) && Boolean(canonicalizeModel(model));
}
