export type DealerPlaybookItem = {
  id: string;
  title: string;
  forWhom: string; // dealers | brokers | importers | yards
  problem: string;
  whatMotormilaDoes: string;
  whereToGo: { label: string; to: string };
};

export const DEALER_PLAYBOOK: DealerPlaybookItem[] = [
  {
    id: "price-against-median",
    title: "Price stock against district median",
    forWhom: "dealers",
    problem: "Yard asks drift from local comps and sit stale or leave money on the table.",
    whatMotormilaDoes: "Benchmark listing URLs against live district medians and show the gap in one pass.",
    whereToGo: { label: "Open inventory benchmark", to: "/dealer#benchmark" },
  },
  {
    id: "spot-arbitrage",
    title: "Spot arbitrage across districts",
    forWhom: "brokers",
    problem: "The same model prices differently by district, but spreads are hard to see in listing feeds.",
    whatMotormilaDoes: "Surface district spreads on the map and trend views so you can buy low and place high.",
    whereToGo: { label: "View district demand", to: "/#market" },
  },
  {
    id: "import-landed-cost",
    title: "Import duty / landed cost before buying stock",
    forWhom: "importers",
    problem: "Duty, VAT, and CIF assumptions blow up landed cost after the purchase is already committed.",
    whatMotormilaDoes: "Run import duty and landed-cost scenarios before you wire money or bid on a unit.",
    whereToGo: { label: "Open calculator", to: "/calculator" },
  },
  {
    id: "official-pulse",
    title: "Watch DMT / Customs official pulse",
    forWhom: "importers",
    problem: "Policy and gazette moves land late, after stock decisions are already locked in.",
    whatMotormilaDoes: "Track official DMT and Customs signals in one pulse feed so operators react early.",
    whereToGo: { label: "Open official pulse", to: "/official-pulse" },
  },
  {
    id: "fair-ask",
    title: "Fair ask / negotiation",
    forWhom: "dealers",
    problem: "Sellers and buyers anchor on list price instead of condition-adjusted market value.",
    whatMotormilaDoes: "Estimate fair value from live comps so negotiation starts from a defensible ask.",
    whereToGo: { label: "Run valuation", to: "/estimate" },
  },
  {
    id: "under-market-alerts",
    title: "Alerts for under-market comps",
    forWhom: "brokers",
    problem: "Underpriced units disappear before the yard team refreshes the board.",
    whatMotormilaDoes: "Watch saved filters and ping when comps land under market.",
    whereToGo: { label: "Set alerts", to: "/alerts" },
  },
  {
    id: "pro-yard-review",
    title: "Pro reports for weekly yard review",
    forWhom: "yards",
    problem: "Weekly stock reviews rely on screenshots and gut feel instead of a shared market brief.",
    whatMotormilaDoes: "Package Pro market reports you can walk through in the Monday yard meeting.",
    whereToGo: { label: "Open Pro preview", to: "/pro-preview" },
  },
  {
    id: "best-picks-acquisition",
    title: "Best picks for acquisition",
    forWhom: "dealers",
    problem: "Acquisition lists mix noise with real deal-score opportunities.",
    whatMotormilaDoes: "Shortlist strict deal-score picks ready for sourcing and floor planning.",
    whereToGo: { label: "View best picks", to: "/best-picks" },
  },
];

export type DealerQuickTool = {
  id: string;
  title: string;
  description: string;
  to: string;
};

export const DEALER_QUICK_TOOLS: DealerQuickTool[] = [
  {
    id: "official-pulse",
    title: "Official Pulse",
    description: "DMT & Customs signals",
    to: "/official-pulse",
  },
  {
    id: "calculator",
    title: "Calculator",
    description: "Import duty & landed cost",
    to: "/calculator",
  },
  {
    id: "valuation",
    title: "Valuation",
    description: "Fair ask from live comps",
    to: "/estimate",
  },
  {
    id: "alerts",
    title: "Alerts",
    description: "Under-market comps",
    to: "/alerts",
  },
  {
    id: "trends",
    title: "Trends",
    description: "Segment momentum",
    to: "/trends",
  },
  {
    id: "pricing",
    title: "Pricing plans",
    description: "Dealer & Pro tiers",
    to: "/pricing",
  },
  {
    id: "docs",
    title: "Docs",
    description: "Operator guides",
    to: "/docs",
  },
  {
    id: "pro-preview",
    title: "Pro Preview",
    description: "Weekly market reports",
    to: "/pro-preview",
  },
];
