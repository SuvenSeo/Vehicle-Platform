import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  FileText,
  Landmark,
  Loader2,
  Radio,
  RefreshCw,
} from "lucide-react";
import { SectionHeader } from "@/components/SectionHeader";
import { revealContainer, revealItem, springSoft } from "@/lib/motion";
import {
  PULSE_SOURCE_GUIDES,
  formatPulsePeriod,
  formatPulseValue,
  labelPulseSource,
  matchPulseGuide,
} from "@/lib/officialPulseContent";
import { cn } from "@/lib/utils";
import { getMarketSignals } from "@/services/api";
import type { MarketSignal } from "@/types/car";

type SourceFilter = "all" | string;

function signalTitle(signal: MarketSignal): string {
  const guide = matchPulseGuide(signal.source, signal.signal_type);
  return guide?.title || signal.category || signal.metric.replace(/_/g, " ") || "Market signal";
}

function SignalCard({ signal }: { signal: MarketSignal }) {
  const title = signalTitle(signal);
  const period = formatPulsePeriod(signal.period_year, signal.period_month);
  const value = formatPulseValue(signal.value_numeric, signal.unit, signal.metric);
  const hasSourceUrl = Boolean(signal.source_url?.trim());

  return (
    <motion.article
      variants={revealItem}
      whileHover={{ y: -2 }}
      transition={springSoft}
      className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary/30"
    >
      <Link to={`/official-pulse/${signal.id}`} className="flex flex-1 flex-col no-underline">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/70">
          {labelPulseSource(signal.source)} · {signal.signal_type.replace(/_/g, " ")}
        </p>
        <h3 className="mt-2 text-sm font-semibold text-foreground group-hover:text-primary">
          {title}
        </h3>
        <p className="num mt-4 text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {period ? `Period ${period}` : "Latest official pulse"}
          {signal.metric ? ` · ${signal.metric.replace(/_/g, " ")}` : null}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary">
          Open in-platform
          <ArrowRight aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
      {hasSourceUrl ? (
        <a
          href={signal.source_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 self-start text-[10px] font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
        >
          <ExternalLink aria-hidden className="h-3 w-3" />
          View original source
        </a>
      ) : null}
    </motion.article>
  );
}

export default function OfficialPulse() {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const signalsQuery = useQuery({
    queryKey: ["market-signals", 48],
    queryFn: () => getMarketSignals(48),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const signals = signalsQuery.data ?? [];
  const sourceChips = Array.from(new Set(signals.map((s) => s.source.toLowerCase()))).sort();
  const filteredSignals =
    sourceFilter === "all"
      ? signals
      : signals.filter((s) => s.source.toLowerCase() === sourceFilter);

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="page-canvas relative min-h-screen overflow-hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[8%] h-[450px] w-[450px] rounded-full bg-primary/5 blur-[110px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[18%] left-[-15%] h-[400px] w-[400px] rounded-full bg-primary/5 blur-[100px]"
      />

      <motion.section variants={revealItem} className="relative z-10 border-b border-border">
        <div className="mx-auto max-w-[1320px] px-5 pb-14 pt-16 sm:px-6 lg:pb-20 lg:pt-24">
          <div className="section-eyebrow mb-5 inline-flex items-center gap-2">
            <Landmark aria-hidden className="h-3.5 w-3.5" />
            Official pulse
          </div>
          <h1 className="display-hero max-w-3xl text-foreground">Official pulse.</h1>
          <p className="text-body-lg mt-6 max-w-xl">
            Government &amp; import market signals, explained in-platform
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/docs#official-pulse"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[13px] font-semibold text-primary-foreground no-underline shadow-soft transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <BookOpen aria-hidden className="h-4 w-4" />
              Read the docs
            </Link>
            <Link
              to="/pricing"
              className="inline-flex h-11 items-center rounded-full border border-border bg-card px-6 text-[13px] font-semibold text-foreground no-underline transition-all hover:border-primary/40 hover:bg-surface active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              View pricing
            </Link>
          </div>
        </div>
      </motion.section>

      <div className="relative z-10 mx-auto max-w-[1320px] space-y-16 px-5 py-14 sm:px-6 lg:space-y-24 lg:py-20">
        <motion.section variants={revealItem}>
          <SectionHeader
            eyebrow="How to read it"
            title="Signal guides"
            description="Each source is explained in AutoLens so you can act without leaving for a government site first."
            className="mb-8"
          />
          <motion.div
            variants={revealContainer}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {PULSE_SOURCE_GUIDES.map((guide) => (
              <motion.div key={guide.key} variants={revealItem}>
                <Link
                  to={`/official-pulse/guide/${guide.key}`}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-soft no-underline transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft-lg"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/70">
                    {labelPulseSource(guide.source)}
                  </p>
                  <h3 className="mt-2 font-display text-[15px] font-bold text-foreground group-hover:text-primary">
                    {guide.title}
                  </h3>
                  <p className="mt-3 flex-1 text-[12px] font-medium leading-relaxed text-muted-foreground">
                    {guide.summary}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                    <FileText aria-hidden className="h-3.5 w-3.5" />
                    Open guide
                    <ArrowRight
                      aria-hidden
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        <motion.section variants={revealItem}>
          <SectionHeader
            eyebrow="Live feed"
            title="Recent market signals"
            description="Latest DMT, Customs, and import-parity observations synced into AutoLens."
            className="mb-8"
            actions={
              <div className="inline-flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                <Radio aria-hidden className="h-3.5 w-3.5 text-primary" />
                Last 48 observations
              </div>
            }
          />

          {sourceChips.length > 0 ? (
            <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by source">
              <button
                type="button"
                onClick={() => setSourceFilter("all")}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors",
                  sourceFilter === "all"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                All sources
              </button>
              {sourceChips.map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setSourceFilter(source)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors",
                    sourceFilter === source
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  {labelPulseSource(source)}
                </button>
              ))}
            </div>
          ) : null}

          {signalsQuery.isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-40 animate-pulse rounded-2xl border border-border bg-card"
                />
              ))}
            </div>
          ) : signalsQuery.isError ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
              <div className="flex items-center gap-2">
                <Loader2 aria-hidden className="h-4 w-4 text-rose-500" />
                <p className="text-[13px] font-semibold text-foreground">Could not load live signals</p>
              </div>
              <p className="text-[12px] text-muted-foreground">
                The market-signals feed is temporarily unavailable. Retry in a moment.
              </p>
              <button
                type="button"
                onClick={() => void signalsQuery.refetch()}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-[11px] font-bold text-foreground transition-all hover:border-primary/40 hover:bg-surface active:scale-[0.97]"
              >
                <RefreshCw aria-hidden className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          ) : filteredSignals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
              <Landmark aria-hidden className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-[14px] font-semibold text-foreground">No signals yet</p>
              <p className="mx-auto mt-2 max-w-md text-[12px] text-muted-foreground">
                {sourceFilter === "all"
                  ? "Official registration, transfer, tender, and import-cost signals will appear here after the market-signals sync runs."
                  : `No live signals for ${labelPulseSource(sourceFilter)} in the latest batch. Try another source chip.`}
              </p>
            </div>
          ) : (
            <motion.div
              variants={revealContainer}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filteredSignals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </motion.div>
          )}
        </motion.section>
      </div>
    </motion.div>
  );
}
