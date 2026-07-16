import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Landmark } from "lucide-react";
import { getMarketSignals } from "@/services/api";
import type { MarketSignal } from "@/types/car";

const SOURCE_LABELS: Record<string, string> = {
  dmt: "DMT",
  customs: "Customs",
  import_reference: "Import refs",
};

function labelSource(source: string): string {
  const key = source.toLowerCase();
  return SOURCE_LABELS[key] || source.replace(/_/g, " ");
}

function formatSignalValue(signal: MarketSignal): string {
  if (signal.value_numeric == null) return signal.metric;
  const value = signal.value_numeric.toLocaleString();
  return signal.unit ? `${value} ${signal.unit}` : value;
}

function SignalCard({ signal }: { signal: MarketSignal }) {
  const title = signal.category || signal.metric;
  const period =
    signal.period_year && signal.period_month
      ? `${signal.period_year}-${String(signal.period_month).padStart(2, "0")}`
      : null;

  return (
    <article className="min-w-[220px] flex-1 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/70">
            {labelSource(signal.source)} · {signal.signal_type.replace(/_/g, " ")}
          </p>
          <h3 className="mt-2 text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {signal.source_url ? (
          <a
            href={signal.source_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Open ${title} source`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
      <p className="mt-3 text-lg font-semibold tracking-tight text-foreground num">{formatSignalValue(signal)}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {period ? `Period ${period}` : "Latest official pulse"}
      </p>
    </article>
  );
}

export function MarketSignalsStrip() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["market-signals", 6],
    queryFn: () => getMarketSignals(6),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (isError) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-label="Official market signals">
      <div className="mb-4 flex items-center gap-2">
        <Landmark className="h-4 w-4 text-primary/80" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Official pulse</p>
          <h2 className="text-sm font-semibold text-foreground">Government & import market signals</h2>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {data.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Official registration and import-cost signals will appear here after the market-signals sync runs.
        </p>
      )}
    </section>
  );
}
