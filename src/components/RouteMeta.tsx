import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { BRAND } from "@/lib/brand";

type Meta = { title: string; description: string };

const SITE = BRAND.siteName;
const ORIGIN = BRAND.origin;
const DEFAULT_DESCRIPTION =
  "Track Sri Lankan vehicle prices, trends, deal signals, and valuation tools in one market intelligence cockpit.";

const ROUTE_META: Record<string, Meta> = {
  "/": {
    title: `${SITE} — ${BRAND.tagline}`,
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
  "/alerts": {
    title: `Alerts — ${SITE}`,
    description: "Saved listing watches and market match alerts for Sri Lanka vehicles.",
  },
  "/price-index": {
    title: `Price Index — ${SITE}`,
    description: "Mix-adjusted used-vehicle price index for the Sri Lankan market.",
  },
  "/dealer": {
    title: `Dealer Workspace — ${SITE}`,
    description: "Inventory turnover, price-gap, and demand intelligence for vehicle dealers.",
  },
  "/settings": {
    title: `Settings — ${SITE}`,
    description: `Language, theme, and display preferences for ${SITE}.`,
  },
  "/sign-in": {
    title: `Sign In — ${SITE}`,
    description: `Sign in to the ${SITE} vehicle intelligence dashboard.`,
  },
  "/pro": {
    title: `Pro Dashboard — ${SITE}`,
    description: `The paid ${SITE} market terminal: drill-downs, exports, and source quality signals.`,
  },
  "/pro-preview": {
    title: `Pro Preview — ${SITE}`,
    description: `A locked preview of the ${SITE} Pro analytics workspace.`,
  },
  "/official-pulse": {
    title: `Official Pulse — ${SITE}`,
    description:
      "Government and import market signals from DMT, Customs, and landed-cost references — explained in-platform.",
  },
  "/docs": {
    title: `Platform Docs — ${SITE}`,
    description: `How ${SITE} works: data sources, deal scores, Official Pulse, workspaces, and access tiers.`,
  },
  "/pricing": {
    title: `Pricing — ${SITE}`,
    description: "Free, Pro, Dealer, and Custom access for Sri Lanka vehicle market intelligence.",
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
        : pathname.startsWith("/cars/")
        ? {
            title: `Vehicle Market Hub — ${SITE}`,
            description: "Prices, district breakdown, and live listings for a specific vehicle in Sri Lanka.",
          }
        : pathname.startsWith("/official-pulse/guide/")
        ? {
            title: `Pulse Guide — ${SITE}`,
            description:
              "In-platform explanation of a government or import market signal source for Sri Lankan dealers.",
          }
        : pathname.startsWith("/official-pulse/")
        ? {
            title: `Pulse Signal — ${SITE}`,
            description:
              "Full official market signal with in-platform context from DMT, Customs, or import parity sources.",
          }
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
