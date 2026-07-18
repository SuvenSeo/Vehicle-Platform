import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Landmark,
  Lightbulb,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { revealContainer, revealItem } from "@/lib/motion";
import {
  formatPulsePeriod,
  formatPulseValue,
  labelPulseSource,
  matchPulseGuide,
} from "@/lib/officialPulseContent";
import { formatRelativeTime } from "@/lib/formatting";
import { getMarketSignal } from "@/services/api";

function NotFoundState({ message }: { message: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="page-canvas relative flex min-h-screen items-center justify-center overflow-hidden px-5"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[8%] h-[450px] w-[450px] rounded-full bg-primary/5 blur-[110px]"
      />
      <motion.div variants={revealItem} className="relative z-10 max-w-md text-center">
        <Landmark aria-hidden className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="section-eyebrow mt-4 text-primary-bright">Unavailable</p>
        <h1 className="mt-3 font-display text-xl font-semibold text-foreground">Signal not found</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">{message}</p>
        <Link
          to="/official-pulse"
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-[12px] font-semibold text-primary-foreground no-underline shadow-soft transition-all hover:bg-primary/90 active:scale-[0.98]"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          Back to Official pulse
        </Link>
      </motion.div>
    </motion.div>
  );
}

export default function OfficialPulseDetail() {
  const { id: idParam } = useParams<{ id: string }>();
  const signalId = Number(idParam);
  const idIsValid = Number.isFinite(signalId) && signalId > 0 && String(signalId) === String(idParam).trim();
  const [sourceOpen, setSourceOpen] = useState(false);

  const signalQuery = useQuery({
    queryKey: ["market-signal", signalId],
    queryFn: () => getMarketSignal(signalId),
    enabled: idIsValid,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (!idIsValid) {
    return (
      <NotFoundState message="That signal ID is not valid. Pick a live signal from the Official pulse hub." />
    );
  }

  if (signalQuery.isPending) {
    return (
      <div className="page-canvas relative min-h-screen overflow-hidden">
        <div className="mx-auto max-w-[1320px] animate-pulse space-y-6 px-5 py-16 sm:px-6">
          <div className="h-4 w-40 rounded bg-surface" />
          <div className="h-12 w-2/3 max-w-xl rounded bg-surface" />
          <div className="h-32 rounded-2xl border border-border bg-card" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-48 rounded-2xl border border-border bg-card" />
            <div className="h-48 rounded-2xl border border-border bg-card" />
          </div>
        </div>
      </div>
    );
  }

  if (signalQuery.isError || !signalQuery.data) {
    return (
      <NotFoundState message="This market signal is missing or no longer in the live index." />
    );
  }

  const signal = signalQuery.data;
  const guide = matchPulseGuide(signal.source, signal.signal_type);
  const title = guide?.title || signal.category || signal.metric.replace(/_/g, " ") || "Market signal";
  const period = formatPulsePeriod(signal.period_year, signal.period_month);
  const value = formatPulseValue(signal.value_numeric, signal.unit, signal.metric);
  const hasSourceUrl = Boolean(signal.source_url?.trim());
  const observedLabel = signal.observed_at
    ? formatRelativeTime(signal.observed_at)
    : null;

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
          <Link
            to="/official-pulse"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground no-underline transition-colors hover:text-foreground"
          >
            <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
            Official pulse
          </Link>
          <div className="section-eyebrow mb-5 mt-6 inline-flex items-center gap-2">
            <Landmark aria-hidden className="h-3.5 w-3.5" />
            {labelPulseSource(signal.source)} · {signal.signal_type.replace(/_/g, " ")}
          </div>
          <h1 className="display-hero max-w-3xl text-foreground">{title}</h1>
          <p className="text-body-lg mt-6 max-w-xl">
            {guide?.summary ||
              "Government and import market signal observed by MilaMark, with in-platform context."}
          </p>
        </div>
      </motion.section>

      <div className="relative z-10 mx-auto max-w-[1320px] space-y-10 px-5 py-14 sm:px-6 lg:py-20">
        <motion.div
          variants={revealItem}
          className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-soft sm:grid-cols-2 lg:grid-cols-4"
        >
          {[
            { label: "Value", value, note: signal.unit ? `Unit · ${signal.unit}` : "Observed value" },
            { label: "Period", value: period || "—", note: "Reporting window" },
            { label: "Metric", value: signal.metric.replace(/_/g, " ") || "—", note: "Tracked field" },
            {
              label: "Observed",
              value: observedLabel || "—",
              note: signal.category ? `Category · ${signal.category}` : "Sync timestamp",
            },
          ].map((card) => (
            <div key={card.label} className="bg-card p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {card.label}
              </p>
              <p className="num mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {card.value}
              </p>
              <p className="mt-2 text-[11px] font-medium text-muted-foreground">{card.note}</p>
            </div>
          ))}
        </motion.div>

        {guide ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <motion.section variants={revealItem} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles aria-hidden className="h-4 w-4 text-primary" />
                <h2 className="font-display text-[15px] font-bold text-foreground">Why it matters</h2>
              </div>
              <ul className="space-y-3">
                {guide.whyItMatters.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">{item}</p>
                  </li>
                ))}
              </ul>
            </motion.section>

            <motion.section variants={revealItem} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="mb-4 flex items-center gap-2">
                <ListChecks aria-hidden className="h-4 w-4 text-primary" />
                <h2 className="font-display text-[15px] font-bold text-foreground">How we read it</h2>
              </div>
              <ul className="space-y-3">
                {guide.howWeReadIt.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">{item}</p>
                  </li>
                ))}
              </ul>
            </motion.section>

            <motion.section
              variants={revealItem}
              className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-soft lg:col-span-2"
            >
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb aria-hidden className="h-4 w-4 text-primary" />
                <h2 className="font-display text-[15px] font-bold text-foreground">Dealer tip</h2>
              </div>
              <p className="text-[13px] font-medium leading-relaxed text-foreground/90">{guide.dealerTip}</p>
              <Link
                to={`/official-pulse/guide/${guide.key}`}
                className="mt-4 inline-flex text-[12px] font-semibold text-primary no-underline hover:underline"
              >
                Full {guide.shortLabel.toLowerCase()} guide
              </Link>
            </motion.section>
          </div>
        ) : (
          <motion.div
            variants={revealItem}
            className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-[13px] text-muted-foreground"
          >
            No matching in-platform guide for this source yet. The live values above are still valid
            observations from the market-signals sync.
          </motion.div>
        )}

        {hasSourceUrl ? (
          <motion.div variants={revealItem} className="rounded-2xl border border-border bg-card shadow-soft">
            <button
              type="button"
              onClick={() => setSourceOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              aria-expanded={sourceOpen}
            >
              <span className="text-[12px] font-semibold text-foreground">Original source</span>
              {sourceOpen ? (
                <ChevronUp aria-hidden className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown aria-hidden className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {sourceOpen ? (
              <div className="border-t border-border px-5 py-4">
                <p className="text-[12px] text-muted-foreground">
                  Optional external reference. Primary explanation stays in MilaMark above.
                </p>
                <a
                  href={signal.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary no-underline hover:underline"
                >
                  <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                  Open original source
                </a>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </div>
    </motion.div>
  );
}
