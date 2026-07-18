import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart2, Car, TrendingUp } from "lucide-react";
import { getMakeModelInsight, getListings, formatPrice } from "@/services/api";
import { revealContainer, revealItem } from "@/lib/motion";
import { ListingCard } from "@/components/ListingCard";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

const SITE = BRAND.siteName;
const ORIGIN = BRAND.origin;

function toTitleCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default function MakeModelHub() {
  const { make: makeParam = "", model: modelParam = "" } = useParams<{
    make: string;
    model: string;
  }>();

  const makeDisplay = toTitleCase(decodeURIComponent(makeParam));
  const modelDisplay = toTitleCase(decodeURIComponent(modelParam));
  const vehicleLabel = `${makeDisplay} ${modelDisplay}`.trim();

  const insightQuery = useQuery({
    queryKey: ["make-model-insight", makeParam, modelParam],
    queryFn: () => getMakeModelInsight(makeParam, modelParam),
    enabled: Boolean(makeParam && modelParam),
    staleTime: 120_000,
  });

  const listingsQuery = useQuery({
    queryKey: ["listings", { make: makeParam, model: modelParam, sort: "newest", page: 1 }],
    queryFn: () =>
      getListings({ make: makeParam, model: modelParam, sort: "newest", page: 1 }),
    enabled: Boolean(makeParam && modelParam),
    staleTime: 60_000,
  });

  const insight = insightQuery.data;
  const canonicalMake = insight?.make ?? makeDisplay;
  const canonicalModel = insight?.model ?? modelDisplay;
  const title = `${canonicalMake} ${canonicalModel} — Prices & Listings in Sri Lanka | ${SITE}`;
  const description = insight
    ? `${insight.total} ${canonicalMake} ${canonicalModel} listings in Sri Lanka. Average price ${formatPrice(insight.avg_price_lkr)}, median ${formatPrice(insight.median_price_lkr)}. Browse live market data on Motormila.`
    : `Browse ${vehicleLabel} prices, listings, and market intelligence for the Sri Lankan vehicle market on Motormila.`;

  useEffect(() => {
    document.title = title;

    const setMeta = (name: string, content: string) => {
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    const setProperty = (property: string, content: string) => {
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    const setCanonical = (href: string) => {
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", href);
    };

    const setJsonLd = (data: Record<string, unknown>) => {
      const id = "autolens-jsonld";
      let script = document.getElementById(id) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = id;
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(data);
    };

    const pathname = `/cars/${encodeURIComponent(makeParam)}/${encodeURIComponent(modelParam)}`;
    setMeta("description", description);
    setProperty("og:title", title);
    setProperty("og:description", description);
    setProperty("og:url", `${ORIGIN}${pathname}`);
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    setCanonical(`${ORIGIN}${pathname}`);
    setJsonLd({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${canonicalMake} ${canonicalModel} listings in Sri Lanka`,
      description,
      url: `${ORIGIN}${pathname}`,
      numberOfItems: insight?.total ?? undefined,
    });
  }, [title, description, makeParam, modelParam, insight, canonicalMake, canonicalModel]);

  const isPending = insightQuery.isPending;
  const isError = insightQuery.isError && !insightQuery.data;

  const recentListings = listingsQuery.data?.listings?.slice(0, 4) ?? [];

  const statsCards = [
    {
      label: "Live listings",
      value: isPending ? "…" : insight ? insight.total.toLocaleString() : "N/A",
      note: `${canonicalMake} ${canonicalModel} listings tracked now`,
    },
    {
      label: "Average price",
      value: isPending ? "…" : formatPrice(insight?.avg_price_lkr ?? null),
      note: "Mean across priced listings",
    },
    {
      label: "Median price",
      value: isPending ? "…" : formatPrice(insight?.median_price_lkr ?? null),
      note: "Midpoint of priced listings",
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative ambient orbs — primary-tinted, adapt across themes */}
      <div className="absolute top-[10%] right-[-10%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-[20%] left-[-15%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[90px] pointer-events-none" aria-hidden />

      {/* ── Hero — the model, its lead, and the aggregate snapshot as hero numbers ── */}
      <motion.section
        variants={revealItem}
        className="relative z-10 border-b border-border bg-card/50 backdrop-blur-md"
      >
        <div className="mx-auto max-w-[1320px] px-5 py-14 sm:px-6 sm:py-20 lg:py-24">
          <p className="section-eyebrow inline-flex items-center gap-2 text-primary-bright">
            <span aria-hidden className="h-1 w-1 rounded-full bg-primary-bright" />
            Market hub
          </p>
          <h1 className="display-hero mt-5 max-w-3xl text-foreground">
            {isPending ? vehicleLabel : `${canonicalMake} ${canonicalModel}`}
          </h1>
          <p className="text-body-lg mt-5 max-w-xl">
            Prices, district breakdown, and live listings for the Sri Lankan market.
          </p>

          {/* Aggregate stat band — the key numbers, at hero scale */}
          <div className="mt-10 sm:mt-12">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-live-dot" />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Market snapshot
              </h2>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-soft sm:grid-cols-3">
              {statsCards.map((card) => (
                <div key={card.label} className="bg-card p-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="num mt-2.5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    {card.value}
                  </p>
                  {card.note && (
                    <p className="mt-2 text-[11px] font-medium text-muted-foreground">{card.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <div className="mx-auto max-w-[1320px] px-5 py-12 sm:px-6 lg:py-16 space-y-16 lg:space-y-24 relative z-10">
        {isError && (
          <motion.div
            variants={revealItem}
            className="rounded-2xl border border-border bg-card p-6 text-[13px] font-medium text-muted-foreground shadow-soft"
          >
            Could not load market data for this vehicle. Try browsing listings directly.
          </motion.div>
        )}

        {/* District breakdown */}
        {(isPending || (insight && insight.top_districts.length > 0)) && (
          <motion.section variants={revealItem}>
            <SectionHeader
              eyebrow="Geography"
              title="District breakdown"
              className="mb-8"
            />
            {isPending ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 rounded-2xl border border-border bg-surface animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <motion.div
                variants={revealContainer}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {insight!.top_districts.map((entry) => (
                  <motion.div
                    key={entry.district}
                    variants={revealItem}
                    className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-soft-lg"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[14px] font-bold tracking-tight text-foreground">
                        {entry.district}
                      </p>
                      <span className="num shrink-0 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {entry.count} listing{entry.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="num mt-3 text-lg font-bold tracking-tight text-foreground">
                      {entry.avg_price_lkr != null ? formatPrice(entry.avg_price_lkr) : "Price N/A"}
                      {entry.avg_price_lkr != null && (
                        <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">avg</span>
                      )}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.section>
        )}

        {/* Recent listings — photo-forward tiles, reusing the shared ListingCard */}
        {recentListings.length > 0 && (
          <motion.section variants={revealItem}>
            <SectionHeader
              eyebrow="Live inventory"
              title="Recent listings"
              className="mb-8"
            />
            <motion.div
              variants={revealContainer}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {recentListings.map((listing) => (
                <motion.div key={listing.id} variants={revealItem}>
                  <ListingCard listing={listing} />
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        )}

        {/* Explore — deeper tools for this model */}
        <motion.div variants={revealContainer} className="grid gap-4 lg:grid-cols-3">
          <motion.div
            variants={revealItem}
            className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-soft-lg"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface transition-colors group-hover:border-primary/30 group-hover:bg-primary/10">
              <BarChart2 className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Browse all listings
            </p>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">
              See every live {canonicalMake} {canonicalModel} on the market, with price filters, district drill-down, and deal scoring.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link to={`/?make=${encodeURIComponent(makeParam)}&model=${encodeURIComponent(modelParam)}#market`}>
                Browse listings <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            variants={revealItem}
            className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-soft-lg"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface transition-colors group-hover:border-primary/30 group-hover:bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Price trends
            </p>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">
              Track how {canonicalMake} {canonicalModel} prices have moved month-over-month in Sri Lanka.
            </p>
            <Button asChild variant="outline" className="mt-6 w-full">
              <Link to={`/trends?make=${encodeURIComponent(makeParam)}&model=${encodeURIComponent(modelParam)}`}>
                View price trends <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            variants={revealItem}
            className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-soft-lg"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface transition-colors group-hover:border-primary/30 group-hover:bg-primary/10">
              <Car className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Estimate value
            </p>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">
              Get a market valuation for a specific {canonicalMake} {canonicalModel} using live comparable data.
            </p>
            <Button asChild variant="outline" className="mt-6 w-full">
              <Link to={`/estimate?make=${encodeURIComponent(makeParam)}&model=${encodeURIComponent(modelParam)}`}>
                Estimate price <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
