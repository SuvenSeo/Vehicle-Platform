export type BrandOption = {
  name: string;
  tagline: string;
  why: string;
  domainVibe: string;
  logoBrief: string;
  recommended?: boolean;
};

export const BRAND_OPTIONS: BrandOption[] = [
  {
    name: "MilaMark",
    tagline: "The fair mark for every listing.",
    why: "‘Mila’ nods to price/value in local speech; ‘Mark’ suggests a stamped fair-price signal dealers can trust.",
    domainVibe: "milamark.lk — short, brandable, slightly premium.",
    logoBrief:
      "Stamp or seal motif: a rounded rectangle ‘MM’ chop with a thin registration-style border. Avoid literal rupee signs. Works as app icon at 16px.",
    recommended: true,
  },
  {
    name: "Nethra Motor",
    tagline: "Eyes on the motor market.",
    why: "‘Nethra’ (eye/vision) pairs with motor for a Sri Lankan-forward name that still reads internationally.",
    domainVibe: "nethramotor.com — editorial, confident, slightly heritage.",
    logoBrief:
      "Single eye / aperture glyph simplified to two arcs and a pupil dot; wordmark in Syne. No eyelashes or mascot faces — keep it industrial.",
  },
  {
    name: "Parity Desk",
    tagline: "Price parity for the trade desk.",
    why: "Sounds institutional — good for brokers and leasing — less consumer-warm than a consumer fair-ask brand.",
    domainVibe: "paritydesk.com — fintech-adjacent, B2B.",
    logoBrief:
      "Two parallel bars of equal length (parity) meeting a small desk/ledger corner. Monochrome ink with primary accent on the equal gap.",
  },
  {
    name: "District Index",
    tagline: "One index. Twenty-five districts.",
    why: "Leans into map and index products; strong for data credibility, weaker as a consumer brand.",
    domainVibe: "districtindex.lk — research / index product feel.",
    logoBrief:
      "Grid of 25 micro-cells forming a soft island outline, or a bold ‘DI’ with one cell highlighted. Typography-led; minimal icon.",
  },
  {
    name: "Harbour Motor",
    tagline: "From port to lot — priced clearly.",
    why: "Evokes Colombo harbour and import flow; natural fit for landed-cost storytelling.",
    domainVibe: "harbourmotor.lk — trade and import heritage.",
    logoBrief:
      "Abstract harbour crane or chevron bow wave reduced to three strokes beside a clean sans wordmark. No ships with smoke — keep it modern.",
  },
  {
    name: "FairAsk LK",
    tagline: "Know if the ask is fair.",
    why: "Literal product promise tied to fair-ask scoring; memorable for buyers, slightly less premium for banks.",
    domainVibe: "fairask.lk — direct, consumer-clear.",
    logoBrief:
      "Speech-bubble ask mark simplified into a price tick / check hybrid. Wordmark with ‘LK’ as a small caps suffix, not a flag.",
  },
  {
    name: "AxleMark",
    tagline: "Marked to the axle of the market.",
    why: "Mechanical metaphor; strong for dealers. Risk of sounding like a parts brand if the mark is too literal.",
    domainVibe: "axlemark.com — industrial, durable.",
    logoBrief:
      "Cross-section axle as a horizontal bar with a centered hub circle; wordmark locked to the right. Avoid tire tread textures.",
  },
  {
    name: "ClearLane",
    tagline: "Clear lanes. Clear prices.",
    why: "‘Lane’ already matches product language (model lanes); ‘Clear’ signals transparency.",
    domainVibe: "clearlane.lk — product UX friendly.",
    logoBrief:
      "Three converging lane lines into an open horizon, or a simple ‘CL’ with a lane gap through the C. Light motion-friendly for splash screens.",
  },
  {
    name: "MotorLedger LK",
    tagline: "The ledger for motor prices.",
    why: "Trust and auditability — good for enterprise and insurers; heavier for casual buyers.",
    domainVibe: "motorledger.lk — finance / registry tone.",
    logoBrief:
      "Open ledger book reduced to two stacked rules and a spine; or an ‘ML’ monogram with a single underline rule. Ink-first, gold sparingly.",
  },
  {
    name: "LotPulse",
    tagline: "The pulse of every lot.",
    why: "Dealer-yard energy with a live-data feel; strong for inventory ops, slightly less national for consumers.",
    domainVibe: "lotpulse.lk — operational, yard-first.",
    logoBrief:
      "Heartbeat / pulse line resolving into a lot-grid of three parking rectangles. Keep geometry sharp; no ECG medical clichés.",
  },
  {
    name: "AskIndex LK",
    tagline: "Index the ask. Know the fair.",
    why: "Pairs asking-price language with index credibility — clear for buyers and brokers, a bit long for wordmark.",
    domainVibe: "askindex.lk — research + consumer hybrid.",
    logoBrief:
      "Ascending index bars capped by a small ask-tick mark. ‘LK’ as a quiet suffix. Prefer tabular numerals in the mark.",
  },
  {
    name: "Kerbside Mark",
    tagline: "Fair marks at the kerb.",
    why: "Evokes street-level deals and walk-up yards; memorable locally, less formal for banking ICPs.",
    domainVibe: "kerbsidemark.lk — grounded, Sri Lanka street trade.",
    logoBrief:
      "Simple kerb edge as a horizontal rule under a stamp ‘KM’ chop. Avoid literal sidewalk photos — keep it glyph-led.",
  },
];

export const BRAND_SYSTEM = {
  primaryName: "MilaMark",
  colors: {
    ink: "#09090B",
    paper: "#FBFBFD",
    primary: "#0A7AFF",
    good: "#12A594",
    risk: "#E11D48",
    gold: "#C4A35A",
  },
  fonts: {
    display: "Syne",
    body: "Geist Sans / Satoshi",
    mono: "Geist Mono",
  },
  voice:
    "Direct, Sri Lanka–specific, and operator-honest. Prefer short declarative headlines, concrete market language (lane, ask, median, district), and no hype adjectives. Speak to dealers and decision-makers first; buyers second. Never invent statistics in marketing copy — point to the live product.",
  killNames: ["AutoLens", "AutoLens LK", "Vehicle Platform", "Auto Price Watch"],
} as const;
