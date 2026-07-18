import { motion } from "framer-motion";
import { ArrowUpRight, Flame, Radar, Sparkles, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useCountUp } from "@/hooks/useCountUp";
import { prefersReducedMotion, springSnappy, springSoft } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/services/api";
import { VehicleThumbnail } from "@/components/VehicleThumbnail";

type TrendingRow = {
  make: string;
  model: string;
  listing_count: number;
  avg_price_lkr?: number | null;
  thumbnail_url?: string | null;
};

type DealRow = {
  id: number;
  make: string;
  model: string;
  year?: number | null;
  price_lkr?: number | null;
  deal_score?: number | null;
  thumbnail_url?: string | null;
};

type PriceDropRow = {
  id: number;
  make: string;
  model: string;
  year?: number | null;
  previous_price_lkr: number;
  new_price_lkr: number;
  drop_pct: number;
  thumbnail_url?: string | null;
};

type Props = {
  trending?: TrendingRow | null;
  hotDeal?: DealRow | null;
  priceDrop?: PriceDropRow | null;
  newListings24h?: number;
  goodDealsCount?: number;
  onTrendingClick?: () => void;
  onBrowseNewest?: () => void;
};

type Accent = "primary" | "emerald" | "amber" | "violet";
type FloatVariant = "a" | "b" | "c";

function FloatingSignalCard({
  children,
  className = "",
  delay = 0,
  accent = "primary",
  float = "a",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  accent?: Accent;
  float?: FloatVariant;
}) {
  const reduced = prefersReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, ...springSoft }}
      whileHover={reduced ? undefined : { y: -5, scale: 1.025, transition: springSnappy }}
      className={cn(
        "hero-signal-card group p-3.5",
        `hero-signal-card--accent-${accent}`,
        `hero-signal-card--float-${float}`,
        !reduced && "hero-signal-card--animate",
        className,
      )}
    >
      <span className="hero-signal-card__glow" aria-hidden />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

function MetricValue({ value, fallback }: { value: number; fallback: string }) {
  const display = useCountUp(value > 0 ? value : 0, 1400);
  if (value <= 0) return <>{fallback}</>;
  return <>{display.toLocaleString()}</>;
}

export function HeroSideSignals({
  trending,
  hotDeal,
  priceDrop,
  newListings24h = 0,
  goodDealsCount = 0,
  onTrendingClick,
  onBrowseNewest,
}: Props) {
  const reduced = prefersReducedMotion();

  return (
    <>
      {/* Left rail */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[min(18vw,248px)] xl:block">
        <div className="pointer-events-auto sticky top-28 flex flex-col gap-4 pt-6">
          {trending ? (
            <FloatingSignalCard delay={0.1} accent="primary" float="a">
              <button
                type="button"
                onClick={onTrendingClick}
                className="flex w-full items-center gap-3 text-left outline-none transition-transform duration-300 group-hover:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <div className="hero-signal-thumb h-12 w-[3.6rem] shrink-0 bg-black/25 ring-1 ring-primary/25 transition-shadow group-hover:ring-primary/45">
                  <VehicleThumbnail
                    src={trending.thumbnail_url}
                    alt={`${trending.make} ${trending.model}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    placeholderClassName="flex h-full w-full items-center justify-center bg-black/10"
                  />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-bright">
                    <TrendingUp className="h-3 w-3" />
                    Trending now
                  </p>
                  <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                    {trending.make} {trending.model}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground num">
                    {trending.listing_count.toLocaleString()} listed
                    {trending.avg_price_lkr ? ` · ${formatPrice(trending.avg_price_lkr)}` : ""}
                  </p>
                </div>
              </button>
            </FloatingSignalCard>
          ) : null}

          {priceDrop ? (
            <FloatingSignalCard delay={0.22} accent="emerald" float="b">
              <Link
                to={`/listing/${priceDrop.id}`}
                className="group/drop flex w-full items-center gap-3 no-underline outline-none transition-transform duration-300 hover:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <div className="hero-signal-thumb h-12 w-[3.6rem] shrink-0 bg-black/25 ring-1 ring-emerald-400/30 transition-shadow group-hover/drop:ring-emerald-400/55">
                  <VehicleThumbnail
                    src={priceDrop.thumbnail_url}
                    listingId={priceDrop.id}
                    alt={`${priceDrop.make} ${priceDrop.model}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover/drop:scale-105"
                    placeholderClassName="flex h-full w-full items-center justify-center bg-black/10"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400">
                    <TrendingDown className="h-3 w-3" />
                    Fresh price cut
                  </p>
                  <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                    {priceDrop.make} {priceDrop.model} {priceDrop.year || ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground num">
                    <span className="line-through opacity-70">{formatPrice(priceDrop.previous_price_lkr)}</span>{" "}
                    <span className="font-semibold text-foreground">{formatPrice(priceDrop.new_price_lkr)}</span>
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300 num">
                  −{priceDrop.drop_pct}%
                </span>
              </Link>
            </FloatingSignalCard>
          ) : newListings24h > 0 ? (
            <FloatingSignalCard delay={0.22} accent="emerald" float="b">
              <button
                type="button"
                onClick={onBrowseNewest}
                className="flex w-full flex-col text-left outline-none transition-transform duration-300 group-hover:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400">
                  <Zap className="h-3 w-3" />
                  New today
                </p>
                <p className="mt-2 font-display text-[26px] font-semibold leading-none tracking-tight text-foreground num">
                  +<MetricValue value={newListings24h} fallback="—" />
                </p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">listings added in the last 24 hours</p>
              </button>
            </FloatingSignalCard>
          ) : null}
        </div>
      </div>

      {/* Right rail */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[min(18vw,248px)] xl:block">
        <div className="pointer-events-auto sticky top-32 flex flex-col gap-4 pt-10">
          {hotDeal ? (
            <FloatingSignalCard delay={0.14} accent="amber" float="c">
              <Link
                to={`/listing/${hotDeal.id}`}
                className="group/deal flex w-full items-center gap-3 no-underline outline-none transition-transform duration-300 hover:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <div className="hero-signal-thumb h-12 w-[3.6rem] shrink-0 bg-black/25 ring-1 ring-amber-400/30 transition-shadow group-hover/deal:ring-amber-400/55">
                  <VehicleThumbnail
                    src={hotDeal.thumbnail_url}
                    alt={`${hotDeal.make} ${hotDeal.model}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover/deal:scale-105"
                    placeholderClassName="flex h-full w-full items-center justify-center bg-black/10"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                    <Flame className="h-3 w-3" />
                    Top deal
                  </p>
                  <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                    {hotDeal.make} {hotDeal.model} {hotDeal.year || ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground num">
                    {hotDeal.price_lkr ? formatPrice(hotDeal.price_lkr) : "—"}
                    {hotDeal.deal_score ? ` · ${Number(hotDeal.deal_score).toFixed(1)} score` : ""}
                  </p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover/deal:translate-x-0.5 group-hover/deal:-translate-y-0.5 group-hover/deal:text-primary-bright" />
              </Link>
            </FloatingSignalCard>
          ) : null}

          <FloatingSignalCard delay={0.26} accent="violet" float="b">
            <Link
              to="/best-picks"
              className="group/radar block no-underline outline-none transition-transform duration-300 hover:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Radar className="h-3 w-3" />
                Deal radar
              </p>
              <p className="mt-2 font-display text-[26px] font-semibold leading-none tracking-tight text-foreground num">
                <MetricValue value={goodDealsCount} fallback="—" />
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">scored 8+ on the market right now</p>
            </Link>
          </FloatingSignalCard>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, ...springSoft }}
            whileHover={reduced ? undefined : { y: -4, scale: 1.03, transition: springSnappy }}
          >
            <Link
              to="/best-picks"
              className={cn(
                "hero-signal-chip inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold text-muted-foreground no-underline",
                !reduced && "hero-signal-chip--animate",
                "transition-colors hover:border-primary/35 hover:text-foreground",
              )}
            >
              <Sparkles className="h-3 w-3 text-primary-bright" />
              Best picks
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </motion.div>
        </div>
      </div>
    </>
  );
}
