import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAppPreferences } from "@/lib/appPreferences";
import { BRAND } from "@/lib/brand";

type Meta = { title: string; description: string };

const SITE = BRAND.siteName;
const ORIGIN = BRAND.origin;

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
  const { t } = useAppPreferences();

  useEffect(() => {
    const siteVars = { site: SITE };
    const defaultDescription = t(
      "seo.defaultDescription",
      "Track Sri Lankan vehicle prices, trends, deal signals, and valuation tools in one market intelligence cockpit.",
    );

    const routeMeta: Record<string, Meta> = {
      "/": {
        title: t("seo.homeTitle", "{site} — {tagline}", { site: SITE, tagline: BRAND.tagline }),
        description: defaultDescription,
      },
      "/trends": {
        title: t("seo.trendsTitle", "Market Trends — {site}", siteVars),
        description: t(
          "seo.trendsDesc",
          "Sri Lankan vehicle price trends over time, by make, model, and district.",
        ),
      },
      "/estimate": {
        title: t("seo.estimateTitle", "Valuation — {site}", siteVars),
        description: t(
          "seo.estimateDesc",
          "Estimate a fair market price for any Sri Lankan vehicle from live listing data.",
        ),
      },
      "/calculator": {
        title: t("seo.calculatorTitle", "Import & Cost Calculator — {site}", siteVars),
        description: t(
          "seo.calculatorDesc",
          "Break down import duty, taxes, and total cost of ownership for vehicles in Sri Lanka.",
        ),
      },
      "/ev-hub": {
        title: t("seo.evHubTitle", "EV Hub — {site}", siteVars),
        description: t(
          "seo.evHubDesc",
          "Electric vehicle pricing, range, battery health, and charging intelligence for Sri Lanka.",
        ),
      },
      "/best-picks": {
        title: t("seo.bestPicksTitle", "Best Picks — {site}", siteVars),
        description: t(
          "seo.bestPicksDesc",
          "A strict, deal-score ranked shortlist of the strongest vehicle deals on the market.",
        ),
      },
      "/alerts": {
        title: t("seo.alertsTitle", "Alerts — {site}", siteVars),
        description: t(
          "seo.alertsDesc",
          "Saved listing watches and market match alerts for Sri Lanka vehicles.",
        ),
      },
      "/price-index": {
        title: t("seo.priceIndexTitle", "Price Index — {site}", siteVars),
        description: t(
          "seo.priceIndexDesc",
          "Mix-adjusted used-vehicle price index for the Sri Lankan market.",
        ),
      },
      "/dealer": {
        title: t("seo.dealerTitle", "Dealer Workspace — {site}", siteVars),
        description: t(
          "seo.dealerDesc",
          "Inventory turnover, price-gap, and demand intelligence for vehicle dealers.",
        ),
      },
      "/settings": {
        title: t("seo.settingsTitle", "Settings — {site}", siteVars),
        description: t(
          "seo.settingsDesc",
          "Language, theme, and display preferences for {site}.",
          siteVars,
        ),
      },
      "/sign-in": {
        title: t("seo.signInTitle", "Sign In — {site}", siteVars),
        description: t(
          "seo.signInDesc",
          "Sign in to the {site} vehicle intelligence dashboard.",
          siteVars,
        ),
      },
      "/pro": {
        title: t("seo.proTitle", "Pro Dashboard — {site}", siteVars),
        description: t(
          "seo.proDesc",
          "The paid {site} market terminal: drill-downs, exports, and source quality signals.",
          siteVars,
        ),
      },
      "/pro-preview": {
        title: t("seo.proPreviewTitle", "Pro Preview — {site}", siteVars),
        description: t(
          "seo.proPreviewDesc",
          "A locked preview of the {site} Pro analytics workspace.",
          siteVars,
        ),
      },
      "/official-pulse": {
        title: t("seo.pulseTitle", "Official Pulse — {site}", siteVars),
        description: t(
          "seo.pulseDesc",
          "Government and import market signals from DMT, Customs, and landed-cost references — explained in-platform.",
        ),
      },
      "/docs": {
        title: t("seo.docsTitle", "Platform Docs — {site}", siteVars),
        description: t(
          "seo.docsDesc",
          "How {site} works: data sources, deal scores, Official Pulse, workspaces, and access tiers.",
          siteVars,
        ),
      },
      "/pricing": {
        title: t("seo.pricingTitle", "Pricing — {site}", siteVars),
        description: t(
          "seo.pricingDesc",
          "Free, Pro, Dealer, and Custom access for Sri Lanka vehicle market intelligence.",
        ),
      },
    };

    const meta =
      routeMeta[pathname] ??
      (pathname.startsWith("/listing/")
        ? {
            title: t("seo.listingDetailTitle", "Vehicle Detail — {site}", siteVars),
            description: defaultDescription,
          }
        : pathname.startsWith("/cars/")
        ? {
            title: t("seo.hubTitle", "Vehicle Market Hub — {site}", siteVars),
            description: t(
              "seo.hubDesc",
              "Prices, district breakdown, and live listings for a specific vehicle in Sri Lanka.",
            ),
          }
        : pathname.startsWith("/official-pulse/guide/")
        ? {
            title: t("seo.pulseGuideTitle", "Pulse Guide — {site}", siteVars),
            description: t(
              "seo.pulseGuideDesc",
              "In-platform explanation of a government or import market signal source for Sri Lankan dealers.",
            ),
          }
        : pathname.startsWith("/official-pulse/")
        ? {
            title: t("seo.pulseSignalTitle", "Pulse Signal — {site}", siteVars),
            description: t(
              "seo.pulseSignalDesc",
              "Full official market signal with in-platform context from DMT, Customs, or import parity sources.",
            ),
          }
        : { title: SITE, description: defaultDescription });

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
        description: defaultDescription,
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
  }, [pathname, t]);

  return null;
}
