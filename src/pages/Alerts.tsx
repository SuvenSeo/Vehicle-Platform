import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, BellOff, ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useServerMarketAlerts } from "@/hooks/useServerMarketAlerts";
import { loadMarketAlerts } from "@/lib/marketAlerts";
import { matchAlerts, formatPrice, type AlertMatchResponse, type ServerMarketAlert } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
  hidden: { opacity: 0, y: 12 },
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

function AlertMatchSection({ token }: { token: string }) {
  const [matchData, setMatchData] = useState<AlertMatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runMatch = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await matchAlerts(token);
      setMatchData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch matches");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    runMatch();
  }, [runMatch]);

  if (!token) return null;

  return (
    <section aria-labelledby="match-results-heading">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="match-results-heading" className="text-base font-semibold tracking-tight text-foreground">
          Current matches
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={runMatch}
          disabled={loading}
          aria-label="Refresh matches"
          className="h-8 gap-1.5 px-2.5 text-[11px] font-semibold text-muted-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-[12px] text-destructive/80">
          {error}
        </p>
      )}

      {matchData && matchData.results.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <BellOff className="mx-auto mb-3 h-6 w-6 text-muted-foreground/40" />
          <p className="text-[12px] text-muted-foreground">No matching listings for your alerts right now.</p>
        </div>
      )}

      {matchData && matchData.results.length > 0 && (
        <div className="space-y-6">
          {matchData.results.map((result) => (
            <div key={result.alert_id} className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-md overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-white">
                    {[result.make, result.model].filter(Boolean).join(" ") || "All vehicles"}
                    {result.district ? ` · ${result.district}` : ""}
                  </p>
                  {result.max_price ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground/80 font-medium">
                      Under {formatPrice(result.max_price)}
                    </p>
                  ) : null}
                </div>
                <Badge variant="secondary" className="shrink-0 text-[11px] font-bold num border-white/5 bg-white/[0.02] text-primary">
                  {result.matching_count.toLocaleString()} found
                </Badge>
              </div>
              {result.listings.length > 0 && (
                <div className="divide-y divide-white/5">
                  {result.listings.slice(0, 5).map((listing) => (
                    <div key={listing.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {listing.title || `${listing.make} ${listing.model}`}
                          {listing.year ? ` ${listing.year}` : ""}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {listing.district || "LK"}
                          {listing.deal_score !== null ? ` · +${Number(listing.deal_score).toFixed(0)} deal` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {listing.price_lkr !== null && (
                          <span className="text-[13px] font-bold text-white num">
                            {formatPrice(listing.price_lkr)}
                          </span>
                        )}
                        <Link
                          to={`/listing/${listing.id}`}
                          aria-label={`View listing ${listing.title || listing.id}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-white/5 text-muted-foreground no-underline transition-all hover:border-primary/20 hover:text-white"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <p className="text-right text-[10px] text-muted-foreground">
            Checked {new Date(matchData.checked_at).toLocaleTimeString()}
          </p>
        </div>
      )}

      {loading && !matchData && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-foreground/[0.02]" />
          ))}
        </div>
      )}
    </section>
  );
}

interface CreateAlertFormProps {
  onCreated: () => void;
  token: string;
  onCreate: (data: { make?: string; model?: string; district?: string; max_price?: number }) => Promise<void>;
}

function CreateAlertForm({ onCreated, onCreate }: CreateAlertFormProps) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [district, setDistrict] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!make.trim() && !model.trim() && !district.trim() && !maxPrice.trim()) {
      setFormError("Provide at least one filter.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const price = Number(maxPrice.replace(/[^\d]/g, ""));
      await onCreate({
        make: make.trim() || undefined,
        model: model.trim() || undefined,
        district: district.trim() || undefined,
        max_price: Number.isFinite(price) && price > 0 ? price : undefined,
      });
      setMake(""); setModel(""); setDistrict(""); setMaxPrice("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save alert");
    } finally {
      setSaving(false);
    }
  }, [make, model, district, maxPrice, onCreate, onCreated]);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-9 gap-2 text-[12px] font-semibold"
        aria-label="Create new alert"
      >
        <Plus className="h-4 w-4" />
        New alert
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Create alert form"
      className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-md p-4 space-y-3"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">New alert</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="alert-make" className="mb-1 block text-[11px] font-bold text-muted-foreground/80">Make</label>
          <Input id="alert-make" value={make} onChange={(e) => setMake(e.target.value)} placeholder="Toyota" className="h-9 text-sm border-white/5 bg-white/[0.02] text-white placeholder-zinc-600 focus-visible:ring-primary/30" />
        </div>
        <div>
          <label htmlFor="alert-model" className="mb-1 block text-[11px] font-bold text-muted-foreground/80">Model</label>
          <Input id="alert-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Aqua" className="h-9 text-sm border-white/5 bg-white/[0.02] text-white placeholder-zinc-600 focus-visible:ring-primary/30" />
        </div>
        <div>
          <label htmlFor="alert-district" className="mb-1 block text-[11px] font-bold text-muted-foreground/80">District</label>
          <Input id="alert-district" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Colombo" className="h-9 text-sm border-white/5 bg-white/[0.02] text-white placeholder-zinc-600 focus-visible:ring-primary/30" />
        </div>
        <div>
          <label htmlFor="alert-price" className="mb-1 block text-[11px] font-bold text-muted-foreground/80">Max price (LKR)</label>
          <Input
            id="alert-price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="5000000"
            className="h-9 text-sm border-white/5 bg-white/[0.02] text-white placeholder-zinc-600 focus-visible:ring-primary/30"
          />
        </div>
      </div>
      {formError && (
        <p role="alert" className="text-[11px] text-destructive/80 font-medium">{formError}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving} className="h-9 flex-1 text-[12px] font-bold bg-primary hover:bg-primary/95 text-white">
          {saving ? "Saving…" : "Save alert"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setFormError(null); }} className="h-9 px-3 text-[12px] border-white/5 hover:bg-white/[0.02] text-muted-foreground">
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AlertRow({ alert, onDelete }: { alert: ServerMarketAlert; onDelete: (id: number) => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      onDelete(alert.id);
    } finally {
      setDeleting(false);
    }
  }, [alert.id, onDelete]);

  const label = [alert.make, alert.model].filter(Boolean).join(" ") || "All vehicles";

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.01] p-3 hover:border-primary/20 hover:bg-white/[0.03] transition-all duration-300"
      data-testid="alert-row"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-white">{label}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground font-medium">
          {alert.district && <span>{alert.district}</span>}
          {alert.max_price && <span>Under {formatPrice(alert.max_price)}</span>}
          {!alert.district && !alert.max_price && <span>Any price · All districts</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          to={`/?make=${encodeURIComponent(alert.make || "")}&model=${encodeURIComponent(alert.model || "")}${alert.district ? `&district=${encodeURIComponent(alert.district)}` : ""}${alert.max_price ? `&price_max=${alert.max_price}` : ""}#market`}
          className="flex h-7 items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2.5 text-[10px] font-bold text-primary no-underline transition-all hover:bg-primary/20"
        >
          Browse
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label={`Delete alert for ${label}`}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-white/5 text-muted-foreground transition-colors hover:border-destructive/30 hover:text-rose-400 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function Alerts() {
  const { alerts, loading, error, token, refresh, create, remove } = useServerMarketAlerts();

  const localAlerts = loadMarketAlerts();
  const showFallback = !loading && error !== null && alerts.length === 0 && localAlerts.length > 0;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="mx-auto max-w-2xl px-5 py-10 sm:px-6 relative overflow-hidden bg-background"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[10%] right-[-10%] w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-20%] w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8 relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight text-white">Market Alerts</h1>
        </div>
        <p className="text-[14px] text-muted-foreground font-medium">
          Get notified when vehicles matching your criteria appear on the market.
        </p>
      </motion.div>

      {/* Create form */}
      <motion.div variants={itemVariants} className="mb-8 relative z-10">
        <CreateAlertForm token={token} onCreated={refresh} onCreate={create} />
      </motion.div>

      {/* Active alerts */}
      <motion.section variants={itemVariants} aria-labelledby="active-alerts-heading" className="mb-10 relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="active-alerts-heading" className="text-base font-bold tracking-tight text-white">
            Active alerts
          </h2>
          {!loading && (
            <span className="text-[11px] font-bold text-primary num">
              {alerts.length}
            </span>
          )}
        </div>

        {loading && (
          <div className="space-y-2" aria-label="Loading alerts">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-white/5 bg-white/[0.01]" />
            ))}
          </div>
        )}

        {!loading && error && alerts.length === 0 && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-[12px] text-destructive/80 font-medium" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && alerts.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
            <BellOff className="mx-auto mb-3 h-6 w-6 text-muted-foreground/30" aria-hidden />
            <p className="text-[12px] text-muted-foreground font-medium">No active alerts. Create one above to get started.</p>
          </div>
        )}

        {!loading && alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <motion.div key={alert.id} variants={itemVariants}>
                <AlertRow alert={alert} onDelete={remove} />
              </motion.div>
            ))}
          </div>
        )}

        {showFallback && (
          <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-md p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">
              Locally saved (offline)
            </p>
            <div className="space-y-1.5">
              {localAlerts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.01] p-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-white">{a.label}</p>
                    {a.target_price_lkr ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground font-medium">Under {formatPrice(a.target_price_lkr)}</p>
                    ) : null}
                  </div>
                  <Link
                    to={`/?${new URLSearchParams(Object.fromEntries(Object.entries(a.filters).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString()}#market`}
                    className="flex h-7 items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2.5 text-[10px] font-bold text-primary no-underline transition-all hover:bg-primary/20"
                  >
                    Browse
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.section>

      {/* Match results */}
      <motion.div variants={itemVariants} className="relative z-10">
        <AlertMatchSection token={token} />
      </motion.div>
    </motion.div>
  );
}
