import { useEffect } from "react";
import { useLocation } from "react-router-dom";

type Meta = { title: string; description: string };

const SITE = "AutoLens LK";
const ORIGIN = "https://vehicle-platform-one.vercel.app";
const DEFAULT_DESCRIPTION =
  "Track Sri Lankan vehicle prices, trends, deal signals, and valuation tools in one market intelligence cockpit.";

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

function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

function setJsonLd(data: Record<string, unknown>) {
  const id = "autolens-jsonld";
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
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
    setProperty("og:url", `${ORIGIN}${pathname}`);
    setMeta("twitter:title", meta.title);
    setMeta("twitter:description", meta.description);
    setCanonical(`${ORIGIN}${pathname}`);

    if (pathname === "/") {
      setJsonLd({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE,
        url: ORIGIN,
        description: DEFAULT_DESCRIPTION,
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${ORIGIN}/?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      });
    } else if (pathname === "/best-picks") {
      setJsonLd({
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Best Vehicle Deals in Sri Lanka",
        description: "Top-ranked vehicle deals from live market data.",
        url: `${ORIGIN}/best-picks`,
        itemListOrder: "https://schema.org/ItemListOrderDescending",
      });
    } else if (pathname.startsWith("/listing/")) {
      setJsonLd({
        "@context": "https://schema.org",
        "@type": "Vehicle",
        name: meta.title,
        description: meta.description,
        url: `${ORIGIN}${pathname}`,
      });
    } else {
      setJsonLd({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: meta.title,
        description: meta.description,
        url: `${ORIGIN}${pathname}`,
        isPartOf: { "@type": "WebSite", name: SITE, url: ORIGIN },
      });
    }
  }, [pathname]);

  return null;
}
