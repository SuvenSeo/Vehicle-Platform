export type PricingTierId = "free" | "pro" | "dealer" | "enterprise";

export type PricingTier = {
  id: PricingTierId;
  name: string;
  priceLkr: string;
  priceNote: string;
  annualNote?: string;
  audience: string;
  highlight?: boolean;
  features: string[];
  ctaLabel: string;
  ctaTo: string;
};

export type IcpPersona = {
  title: string;
  pain: string;
  fit: string;
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    priceLkr: "LKR 0",
    priceNote: "/mo",
    audience: "Browsers and first-time buyers testing the market",
    features: [
      "Dashboard browse across live listings",
      "Limited Official Pulse snapshot",
      "Starter import calculator",
      "Public trends and map access",
      "Deal scores on listing cards",
    ],
    ctaLabel: "Open dashboard",
    ctaTo: "/",
  },
  {
    id: "pro",
    name: "Pro",
    priceLkr: "LKR 4,990",
    priceNote: "/mo",
    annualNote: "LKR 49,900/yr",
    audience: "Brokers, analysts, and serious buyers who need depth",
    features: [
      "Full Pro terminal (/pro)",
      "Official Pulse history",
      "Deeper alerts and match refresh",
      "Lane drill-downs and source coverage",
      "CSV / PDF export packs",
      "Pro preview available before you pay",
    ],
    ctaLabel: "Sign in or preview",
    ctaTo: "/pro-preview",
  },
  {
    id: "dealer",
    name: "Dealer",
    priceLkr: "LKR 19,990",
    priceNote: "/mo",
    annualNote: "LKR 199,900/yr",
    audience: "Yards and multi-lot dealers running inventory every day",
    highlight: true,
    features: [
      "Everything in Pro",
      "Full Dealer workspace (/dealer)",
      "URL benchmark against live comps",
      "Aging and price-gap views",
      "Team seats for sales staff",
      "WhatsApp onboarding after sign-in",
    ],
    ctaLabel: "Open dealer workspace",
    ctaTo: "/dealer",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceLkr: "Custom",
    priceNote: "from LKR 99,000/mo",
    audience: "Banks, leasing desks, and insurers needing institutional feeds",
    features: [
      "Everything in Dealer",
      "Custom data feeds and SLAs",
      "Seat packs and SSO-ready workflows",
      "Policy and portfolio brief formats",
      "Dedicated onboarding",
    ],
    ctaLabel: "Talk to us",
    ctaTo: "/sign-in",
  },
];

export const ICP_PERSONAS: IcpPersona[] = [
  {
    title: "Dealers",
    pain: "Aging stock and guesses on asks while buyers quote other yards’ ads.",
    fit: "Dealer workspace, URL benchmark, and team seats keep the lot priced against live comps.",
  },
  {
    title: "Brokers",
    pain: "Clients expect a defensible number, not a gut feel from one board.",
    fit: "Pro terminal, deal scores, and exports turn a shortlist into a brief you can send.",
  },
  {
    title: "Importers",
    pain: "Duty and surcharge shifts erase margin before the car clears.",
    fit: "Calculator plus Official Pulse keep landed-cost scenarios aligned with policy signals.",
  },
  {
    title: "Leasing / banks",
    pain: "Residual and collateral reads lag noisy classified medians.",
    fit: "Enterprise feeds, price index context, and lane history for portfolio decisions.",
  },
  {
    title: "Insurers",
    pain: "Claims and underwriting need a consistent market read by district and segment.",
    fit: "Index, map, and institutional tiers for structured market references.",
  },
  {
    title: "Serious buyers",
    pain: "Hours lost scrolling boards without knowing if an ask is actually cheap.",
    fit: "Free browse to start; Pro when you want alerts, history, and sharper deal confidence.",
  },
];

export const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: "Why isn’t everything free?",
    a: "Scraping, normalizing, and scoring Sri Lanka’s vehicle boards is ongoing ops cost. Free covers browse and starter tools; Pro and Dealer fund pipeline uptime, pulse depth, and workspaces.",
  },
  {
    q: "Can I try Pro before paying?",
    a: "Yes. /pro-preview shows the locked terminal layout. Sign in activates /pro when your subscription is live.",
  },
  {
    q: "How does Dealer onboarding work?",
    a: "Open /dealer after sign-in. WhatsApp onboarding for yard setup and seats happens once the account is active — we do not put a public wa.me placeholder in the product.",
  },
  {
    q: "Is annual billing cheaper?",
    a: "Pro is LKR 49,900/yr and Dealer is LKR 199,900/yr — a discount versus twelve monthly invoices.",
  },
  {
    q: "What does Enterprise include?",
    a: "Custom scope from LKR 99,000/mo: feeds, SLAs, seat packs, and brief formats for banks, leasing, and insurers. Start at /sign-in and we scope from there.",
  },
  {
    q: "Do deal scores work on Free?",
    a: "Yes — listing cards and Best Picks expose deal bands on the public surface. Pro adds history, exports, and deeper lane context around those scores.",
  },
];
