import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart2, Car, MapPin, TrendingUp } from "lucide-react";
import { getMakeModelInsight, getListings, formatPrice } from "@/services/api";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05
    }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 220,
      damping: 24
    }
  }
} as const;

const SITE = "AutoLens LK";
const ORIGIN = "https://vehicle-platform-one.vercel.app";

function toTitleCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 backdrop-blur-md hover:border-primary/20 hover:bg-white/[0.02] transition-all">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">
        {label}
      </p>
      <p className="num mt-2 text-xl font-bold text-white">{value}</p>
      {note && <p className="mt-1.5 text-[11px] text-muted-foreground font-medium">{note}</p>}
    </div>
  );
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
    ? `${insight.total} ${canonicalMake} ${canonicalModel} listings in Sri Lanka. Average price ${formatPrice(insight.avg_price_lkr)}, median ${formatPrice(insight.median_price_lkr)}. Browse live market data on AutoLens LK.`
    : `Browse ${vehicleLabel} prices, listings, and market intelligence for the Sri Lankan vehicle market on AutoLens LK.`;

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
      variants={containerVariants}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[10%] right-[-10%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-15%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[90px] pointer-events-none" />

      {/* Hero */}
      <motion.section variants={itemVariants} className="border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-md relative z-10">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Market hub
          </p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-tight leading-[1.05] text-white sm:text-[2.75rem] lg:text-[3rem]">
            {isPending ? vehicleLabel : `${canonicalMake} ${canonicalModel}`}
          </h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground font-medium">
            Prices, district breakdown, and live listings for the Sri Lankan market.
          </p>
        </div>
      </motion.section>

      <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:py-10 space-y-10 relative z-10">
        {isError && (
          <div className="rounded-xl border border-white/5 bg-white/[0.01] p-6 text-[13px] text-muted-foreground font-medium">
            Could not load market data for this vehicle. Try browsing listings directly.
          </div>
        )}

        {/* Stats grid */}
        <motion.div variants={itemVariants}>
          <h2 className="mb-5 font-display text-sm font-bold tracking-tight text-white">
            Market snapshot
          </h2>
          <div className="grid gap-2 md:grid-cols-3">
            {statsCards.map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} note={card.note} />
            ))}
          </div>
        </motion.div>

        {/* District breakdown */}
        {(isPending || (insight && insight.top_districts.length > 0)) && (
          <motion.div variants={itemVariants}>
            <h2 className="mb-5 font-display text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              District breakdown
            </h2>
            {isPending ? (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 rounded-xl border border-white/5 bg-white/[0.01] animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {insight!.top_districts.map((entry) => (
                  <div
                    key={entry.district}
                    className="rounded-xl border border-white/5 bg-white/[0.01] p-4 hover:border-primary/20 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-white">{entry.district}</p>
                      <span className="text-[10px] font-bold text-muted-foreground num">
                        {entry.count} listing{entry.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] text-muted-foreground num font-medium">
                      {entry.avg_price_lkr != null ? formatPrice(entry.avg_price_lkr) : "Price N/A"}
                      {entry.avg_price_lkr != null && (
                        <span className="ml-1 text-[10px] text-muted-foreground/60">avg</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Recent listings preview */}
        {recentListings.length > 0 && (
          <motion.div variants={itemVariants}>
            <h2 className="mb-5 font-display text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <Car className="h-3.5 w-3.5 text-primary" />
              Recent listings
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
              {recentListings.map((listing) => (
                <Link
                  key={listing.id}
                  to={`/listing/${listing.id}`}
                  className="rounded-xl border border-white/5 bg-white/[0.01] p-4 no-underline hover:border-primary/20 transition-all hover:bg-white/[0.02]"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">
                    {listing.district ?? "—"}
                  </p>
                  <p className="mt-1 text-[13px] font-bold text-white truncate">
                    {listing.year} {listing.make} {listing.model}
                  </p>
                  <p className="mt-1 text-[13px] font-bold text-primary num">
                    {listing.price_lkr != null ? formatPrice(listing.price_lkr) : "Price N/A"}
                  </p>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* CTA row */}
        <motion.div variants={itemVariants} className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
              <BarChart2 className="h-4 w-4 text-primary" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/85">
              Browse all listings
            </p>
            <p className="text-[13px] text-muted-foreground leading-relaxed font-medium">
              See every live {canonicalMake} {canonicalModel} on the market, with price filters, district drill-down, and deal scoring.
            </p>
            <Link
              to={`/?make=${encodeURIComponent(makeParam)}&model=${encodeURIComponent(modelParam)}#market`}
              className="mt-6 flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-[10px] font-bold uppercase tracking-[0.1em] text-white no-underline transition-all hover:bg-primary/95 shadow-[0_2px_10px_rgba(124,58,237,0.15)]"
            >
              Browse listings <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/85">
              Price trends
            </p>
            <p className="text-[13px] text-muted-foreground leading-relaxed font-medium">
              Track how {canonicalMake} {canonicalModel} prices have moved month-over-month in Sri Lanka.
            </p>
            <Link
              to={`/trends?make=${encodeURIComponent(makeParam)}&model=${encodeURIComponent(modelParam)}`}
              className="mt-6 flex h-10 items-center justify-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] text-[10px] font-bold uppercase tracking-[0.1em] text-white no-underline transition-all hover:bg-white/[0.04]"
            >
              View price trends <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.01] p-5 sm:p-6 backdrop-blur-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
              <Car className="h-4 w-4 text-primary" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/85">
              Estimate value
            </p>
            <p className="text-[13px] text-muted-foreground leading-relaxed font-medium">
              Get a market valuation for a specific {canonicalMake} {canonicalModel} using live comparable data.
            </p>
            <Link
              to={`/estimate?make=${encodeURIComponent(makeParam)}&model=${encodeURIComponent(modelParam)}`}
              className="mt-6 flex h-10 items-center justify-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] text-[10px] font-bold uppercase tracking-[0.1em] text-white no-underline transition-all hover:bg-white/[0.04]"
            >
              Estimate price <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
