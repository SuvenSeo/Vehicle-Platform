import { motion } from "framer-motion";
import { ArrowUpRight, Flame, MapPin, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
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

type Props = {
  listingsCount: number;
  sourcesCount: number;
  districtsCount: number;
  trending?: TrendingRow | null;
  hotDeal?: DealRow | null;
  onTrendingClick?: () => void;
};

function SignalCard({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 240, damping: 26 }}
      className={`rounded-2xl border border-border/80 bg-card/85 p-3 shadow-soft backdrop-blur-md ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function HeroSideSignals({
  listingsCount,
  sourcesCount,
  districtsCount,
  trending,
  hotDeal,
  onTrendingClick,
}: Props) {
  return (
    <>
      {/* Left rail */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[min(16vw,220px)] xl:block">
        <div className="pointer-events-auto sticky top-28 flex flex-col gap-3 pt-8">
          {trending ? (
            <SignalCard delay={0.12}>
              <button
                type="button"
                onClick={onTrendingClick}
                className="flex w-full items-center gap-3 text-left outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <div className="h-11 w-14 shrink-0 overflow-hidden rounded-xl bg-black/20">
                  <VehicleThumbnail
                    src={trending.thumbnail_url}
                    alt={`${trending.make} ${trending.model}`}
                    className="h-full w-full object-cover"
                    placeholderClassName="flex h-full w-full items-center justify-center bg-black/10"
                  />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-bright">
                    <TrendingUp className="h-3 w-3" />
                    Trending now
                  </p>
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {trending.make} {trending.model}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground num">
                    {trending.listing_count.toLocaleString()} listed
                    {trending.avg_price_lkr ? ` · ${formatPrice(trending.avg_price_lkr)}` : ""}
                  </p>
                </div>
              </button>
            </SignalCard>
          ) : null}

          <SignalCard delay={0.2}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Live coverage</p>
            <p className="mt-1 text-[22px] font-semibold tracking-tight text-foreground num">
              {listingsCount > 0 ? listingsCount.toLocaleString() : "120k+"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              listings · {sourcesCount || 10} sources
            </p>
          </SignalCard>
        </div>
      </div>

      {/* Right rail */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[min(16vw,220px)] xl:block">
        <div className="pointer-events-auto sticky top-36 flex flex-col gap-3 pt-16">
          {hotDeal ? (
            <SignalCard delay={0.16}>
              <Link
                to={`/listing/${hotDeal.id}`}
                className="flex w-full items-center gap-3 no-underline outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <div className="h-11 w-14 shrink-0 overflow-hidden rounded-xl bg-black/20">
                  <VehicleThumbnail
                    src={hotDeal.thumbnail_url}
                    alt={`${hotDeal.make} ${hotDeal.model}`}
                    className="h-full w-full object-cover"
                    placeholderClassName="flex h-full w-full items-center justify-center bg-black/10"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-bright">
                    <Flame className="h-3 w-3" />
                    Top deal
                  </p>
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {hotDeal.make} {hotDeal.model} {hotDeal.year || ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground num">
                    {hotDeal.price_lkr ? formatPrice(hotDeal.price_lkr) : "—"}
                    {hotDeal.deal_score ? ` · ${Number(hotDeal.deal_score).toFixed(1)} score` : ""}
                  </p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            </SignalCard>
          ) : null}

          <SignalCard delay={0.24}>
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              District reach
            </p>
            <p className="mt-1 text-[22px] font-semibold tracking-tight text-foreground num">
              {districtsCount || 25}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">districts indexed</p>
          </SignalCard>

          <Link
            to="/best-picks"
            className="inline-flex items-center justify-center gap-1 rounded-full border border-border bg-card/80 px-3 py-2 text-[11px] font-semibold text-muted-foreground no-underline backdrop-blur-md transition-colors hover:border-primary/30 hover:text-foreground"
          >
            Best picks
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </>
  );
}
