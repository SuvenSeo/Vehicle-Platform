import { useEffect } from "react";
import { useLocation } from "react-router-dom";

type Meta = { title: string; description: string };

const SITE = "AutoLens LK";
const DEFAULT_DESCRIPTION =
  "Track Sri Lankan vehicle prices, trends, deal signals, and valuation tools in one market intelligence cockpit.";

/**
 * Per-route document metadata. Previously every route inherited the static
 * homepage <title>/description from index.html; this maps each path to its own.
 * Dynamic pages (e.g. listing detail) may still override the title afterwards.
 */
const ROUTE_META: Record<string, Meta> = {
  "/": {
    title: `${SITE} — See the Real Price. Every Car. Every District.`,
    description: DEFAULT_DESCRIPTION,
  },
  "/trends": {
    title: `Market Trends — ${SITE}`,
    description: "Sri Lankan vehicle price trends over time, by make, model, and district.",
  },
  "/estimate": {
    title: `Valuation — ${SITE}`,
    description: "Estimate a fair market price for any Sri Lankan vehicle from live listing data.",
  },
  "/calculator": {
    title: `Import & Cost Calculator — ${SITE}`,
    description: "Break down import duty, taxes, and total cost of ownership for vehicles in Sri Lanka.",
  },
  "/ev-hub": {
    title: `EV Hub — ${SITE}`,
    description: "Electric vehicle pricing, range, battery health, and charging intelligence for Sri Lanka.",
  },
  "/best-picks": {
    title: `Best Picks — ${SITE}`,
    description: "A strict, deal-score ranked shortlist of the strongest vehicle deals on the market.",
  },
  "/map": {
    title: `Market Map — ${SITE}`,
    description: "Explore vehicle listings and price intelligence across all 25 districts of Sri Lanka.",
  },
  "/blogs": {
    title: `Journal — ${SITE}`,
    description: "Guides and analysis on buying, pricing, and understanding the Sri Lankan vehicle market.",
  },
  "/dealer": {
    title: `Dealer Workspace — ${SITE}`,
    description: "Inventory turnover, price-gap, and demand intelligence for vehicle dealers.",
  },
  "/settings": {
    title: `Settings — ${SITE}`,
    description: "Language, theme, and display preferences for AutoLens LK.",
  },
  "/sign-in": {
    title: `Sign In — ${SITE}`,
    description: "Sign in to the AutoLens LK vehicle intelligence dashboard.",
  },
  "/pro": {
    title: `Pro Dashboard — ${SITE}`,
    description: "The paid AutoLens market terminal: drill-downs, exports, and source quality signals.",
  },
  "/pro-preview": {
    title: `Pro Preview — ${SITE}`,
    description: "A locked preview of the AutoLens Pro analytics workspace.",
  },
};

function setMeta(name: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setProperty(property: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

export function RouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta =
      ROUTE_META[pathname] ??
      (pathname.startsWith("/listing/")
        ? { title: `Vehicle Detail — ${SITE}`, description: DEFAULT_DESCRIPTION }
        : { title: `${SITE}`, description: DEFAULT_DESCRIPTION });

    document.title = meta.title;
    setMeta("description", meta.description);
    setProperty("og:title", meta.title);
    setProperty("og:description", meta.description);
    setMeta("twitter:title", meta.title);
    setMeta("twitter:description", meta.description);
  }, [pathname]);

  return null;
}
