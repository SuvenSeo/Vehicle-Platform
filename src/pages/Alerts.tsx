import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, BellOff, ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useServerMarketAlerts } from "@/hooks/useServerMarketAlerts";
import { loadMarketAlerts } from "@/lib/marketAlerts";
import { useAppPreferences } from "@/lib/appPreferences";
import { isValidNotifyPhone } from "@/lib/notifyPhone";
import { matchAlerts, formatPrice, type AlertMatchResponse, type ServerMarketAlert } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageBody } from "@/components/PageBody";
import { PageCanvas } from "@/components/PageCanvas";
import { PageHero } from "@/components/PageHero";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { revealItem, springSoft } from "@/lib/motion";
import { useAuth } from "@/lib/authContext";
import { FREE_ALERTS_LIMIT, freePlanCopy, hasFullPlatformAccess } from "@/lib/planLimits";

const itemVariants = revealItem;

function AlertMatchSection({ token }: { token: string }) {
  const { t } = useAppPreferences();
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
      setError(err instanceof Error ? err.message : t("alerts.matchFailed", "Failed to fetch matches"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    runMatch();
  }, [runMatch]);

  if (!token) return null;

  return (
    <section aria-labelledby="match-results-heading">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-primary">
            <span aria-hidden className="h-1 w-1 rounded-full bg-primary" />
            {t("alerts.liveResults", "Live results")}
          </p>
          <h2 id="match-results-heading" className="display-2 text-foreground">
            {t("alerts.currentMatches", "Current matches")}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={runMatch}
          disabled={loading}
          aria-label={t("alerts.refreshAria", "Refresh matches")}
          className="h-8 shrink-0 gap-1.5 px-2.5 text-[11px] font-semibold text-muted-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh", "Refresh")}
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
          <p className="text-[12px] text-muted-foreground">{t("alerts.noMatches", "No matching listings for your alerts right now.")}</p>
        </div>
      )}

      {matchData && matchData.results.length > 0 && (
        <div className="space-y-5">
          {matchData.results.map((result) => (
            <div key={result.alert_id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                    {[result.make, result.model].filter(Boolean).join(" ") || t("alerts.allVehicles", "All vehicles")}
                    {result.district ? ` · ${result.district}` : ""}
                  </p>
                  {result.max_price ? (
                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                      {t("alerts.underPrice", "Under {price}", { price: formatPrice(result.max_price) })}
                    </p>
                  ) : null}
                </div>
                <Badge variant="secondary" className="num shrink-0 border-border bg-surface text-[11px] font-semibold text-primary-bright">
                  {t("alerts.found", "{count} found", { count: result.matching_count.toLocaleString() })}
                </Badge>
              </div>
              {result.listings.length > 0 && (
                <div className="divide-y divide-border">
                  {result.listings.slice(0, 5).map((listing) => (
                    <div key={listing.id} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {listing.title || `${listing.make} ${listing.model}`}
                          {listing.year ? ` ${listing.year}` : ""}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {listing.district || "LK"}
                          {listing.deal_score !== null ? ` ${t("alerts.dealSuffix", "· +{score} deal", { score: Number(listing.deal_score).toFixed(0) })}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {listing.price_lkr !== null && (
                          <span className="num text-[13px] font-bold text-foreground">
                            {formatPrice(listing.price_lkr)}
                          </span>
                        )}
                        <Link
                          to={`/listing/${listing.id}`}
                          aria-label={t("alerts.viewListingAria", "View listing {title}", { title: listing.title || listing.id })}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground no-underline transition-all hover:border-primary/40 hover:text-foreground"
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
          <p className="num text-right text-[10px] text-muted-foreground">
            {t("alerts.checkedAt", "Checked {time}", { time: new Date(matchData.checked_at).toLocaleTimeString() })}
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
  alertCount: number;
  fullAccess: boolean;
  onCreate: (data: {
    make?: string;
    model?: string;
    district?: string;
    max_price?: number;
    notify_phone?: string;
  }) => Promise<unknown>;
}

function CreateAlertForm({ onCreated, onCreate, alertCount, fullAccess }: CreateAlertFormProps) {
  const { t } = useAppPreferences();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [district, setDistrict] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [notifyPhone, setNotifyPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const atFreeLimit = !fullAccess && alertCount >= FREE_ALERTS_LIMIT;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullAccess && alertCount >= FREE_ALERTS_LIMIT) {
      setFormError(t("alerts.freeLimitError", "Free plan includes {n} alert. Upgrade to Pro for more.", { n: FREE_ALERTS_LIMIT }));
      return;
    }
    if (!make.trim() && !model.trim() && !district.trim() && !maxPrice.trim()) {
      setFormError(t("alerts.needFilter", "Provide at least one filter."));
      return;
    }
    if (!fullAccess && notifyPhone.trim()) {
      setFormError(t("alerts.whatsappProError", "WhatsApp notifications unlock with Pro."));
      return;
    }
    if (!isValidNotifyPhone(notifyPhone)) {
      setFormError(t("alerts.invalidPhone", "Enter a valid WhatsApp number (e.g. 0771234567 or +94771234567)."));
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
        notify_phone: fullAccess ? (notifyPhone.trim() || undefined) : undefined,
      });
      setMake(""); setModel(""); setDistrict(""); setMaxPrice(""); setNotifyPhone("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("alerts.saveFailed", "Failed to save alert"));
    } finally {
      setSaving(false);
    }
  }, [make, model, district, maxPrice, notifyPhone, onCreate, onCreated, fullAccess, alertCount, t]);

  if (atFreeLimit) {
    return (
      <UpgradePrompt
        variant="strip"
        title={t("plan.alertsTitle", freePlanCopy.alertsTitle)}
        body={t("plan.alertsBody", freePlanCopy.alertsBody)}
      />
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-9 gap-2 text-[12px] font-semibold"
        aria-label={t("alerts.createAria", "Create new alert")}
      >
        <Plus className="h-4 w-4" />
        {t("alerts.newAlert", "New alert")}
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={t("alerts.formAria", "Create alert form")}
      className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-soft"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("alerts.newAlert", "New alert")}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="alert-make" className="mb-1 block text-[11px] font-semibold text-muted-foreground">{t("common.make", "Make")}</label>
          <Input id="alert-make" value={make} onChange={(e) => setMake(e.target.value)} placeholder="Toyota" className="h-9 border-border bg-surface text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30" />
        </div>
        <div>
          <label htmlFor="alert-model" className="mb-1 block text-[11px] font-semibold text-muted-foreground">{t("common.model", "Model")}</label>
          <Input id="alert-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Aqua" className="h-9 border-border bg-surface text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30" />
        </div>
        <div>
          <label htmlFor="alert-district" className="mb-1 block text-[11px] font-semibold text-muted-foreground">{t("common.district", "District")}</label>
          <Input id="alert-district" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Colombo" className="h-9 border-border bg-surface text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30" />
        </div>
        <div>
          <label htmlFor="alert-price" className="mb-1 block text-[11px] font-semibold text-muted-foreground">{t("alerts.maxPrice", "Max price (LKR)")}</label>
          <Input
            id="alert-price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="5000000"
            className="num h-9 border-border bg-surface text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
          />
        </div>
        {fullAccess ? (
          <div className="col-span-2">
            <label htmlFor="alert-whatsapp" className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              {t("alerts.notifyWhatsapp", "WhatsApp (optional)")}
            </label>
            <Input
              id="alert-whatsapp"
              value={notifyPhone}
              onChange={(e) => setNotifyPhone(e.target.value)}
              placeholder="0771234567"
              inputMode="tel"
              className="h-9 border-border bg-surface text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              {t("alerts.whatsappHint", "Get a WhatsApp ping when new matches appear (requires Twilio on the server).")}
            </p>
          </div>
        ) : (
          <div className="col-span-2 rounded-xl border border-primary/15 bg-primary/[0.05] px-3 py-2.5 text-[11px] text-muted-foreground">
            {t("alerts.whatsappPro", "WhatsApp match pings unlock with Pro.")}
          </div>
        )}
      </div>
      {formError && (
        <p role="alert" className="text-[11px] font-medium text-destructive/80">{formError}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving} className="h-9 flex-1 text-[12px] font-bold">
          {saving ? t("common.saving", "Saving…") : t("alerts.save", "Save alert")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setFormError(null); }} className="h-9 px-3 text-[12px] text-muted-foreground hover:bg-surface">
          {t("common.cancel", "Cancel")}
        </Button>
      </div>
    </form>
  );
}

function AlertRow({ alert, onDelete }: { alert: ServerMarketAlert; onDelete: (id: number) => void }) {
  const { t } = useAppPreferences();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      onDelete(alert.id);
    } finally {
      setDeleting(false);
    }
  }, [alert.id, onDelete]);

  const label = [alert.make, alert.model].filter(Boolean).join(" ") || t("alerts.allVehicles", "All vehicles");

  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={springSoft}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors duration-300 hover:border-primary/40 hover:bg-surface hover:shadow-soft"
      data-testid="alert-row"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight text-foreground">{label}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-muted-foreground">
          {alert.district && <span>{alert.district}</span>}
          {alert.max_price && <span className="num">{t("alerts.underPrice", "Under {price}", { price: formatPrice(alert.max_price) })}</span>}
          {alert.notify_phone && (
            <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
              WA {alert.notify_phone}
            </span>
          )}
          {!alert.district && !alert.max_price && !alert.notify_phone && (
            <span>{t("alerts.anyPriceAllDistricts", "Any price · All districts")}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          to={`/?make=${encodeURIComponent(alert.make || "")}&model=${encodeURIComponent(alert.model || "")}${alert.district ? `&district=${encodeURIComponent(alert.district)}` : ""}${alert.max_price ? `&price_max=${alert.max_price}` : ""}#market`}
          className="flex h-7 items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2.5 text-[10px] font-bold text-primary-bright no-underline transition-all hover:bg-primary/20"
        >
          {t("common.browse", "Browse")}
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label={t("alerts.deleteAria", "Delete alert for {label}", { label })}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-rose-600 disabled:opacity-40 dark:hover:text-rose-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

export default function Alerts() {
  const { t } = useAppPreferences();
  const { hasProAccess, isAdmin } = useAuth();
  const fullAccess = hasFullPlatformAccess({ hasProAccess, isAdmin });
  const { alerts, loading, error, token, refresh, create, remove } = useServerMarketAlerts();

  const localAlerts = loadMarketAlerts();
  const showFallback = !loading && error !== null && alerts.length === 0 && localAlerts.length > 0;

  return (
    <PageCanvas ambient="subtle">
      <PageHero
        theme="alerts"
        eyebrow={t("alerts.eyebrow", "Market watch")}
        eyebrowIcon={Bell}
        watermarkIcon={Bell}
        title={<>{t("alerts.title", "Market Alerts")}</>}
        description={t("alerts.description", "Get notified when vehicles matching your criteria appear on the market.")}
        highlights={[
          { label: t("alerts.highlightActive", "Active"), value: String(alerts.length), hint: fullAccess ? t("alerts.highlightActiveHint", "Saved alert rules") : t("alerts.highlightFreeLimit", "Free limit {n}", { n: FREE_ALERTS_LIMIT }) },
          { label: t("alerts.highlightMatches", "Matches"), value: t("common.live", "Live"), hint: t("alerts.highlightMatchesHint", "Scan against inventory") },
          { label: t("alerts.highlightSync", "Sync"), value: token ? t("common.on", "On") : t("common.local", "Local"), hint: t("alerts.highlightSyncHint", "Server or device storage") },
        ]}
      />

      <PageBody narrow className="py-8 sm:py-10">
        <motion.div variants={itemVariants} className="mb-14">
        <CreateAlertForm
          token={token}
          onCreated={refresh}
          onCreate={create}
          alertCount={alerts.length}
          fullAccess={fullAccess}
        />
        </motion.div>

      {/* Active alerts */}
      <motion.section variants={itemVariants} aria-labelledby="active-alerts-heading" className="relative z-10 mb-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-primary">
              <span aria-hidden className="h-1 w-1 rounded-full bg-primary" />
              {t("alerts.yourWatchlist", "Your watchlist")}
            </p>
            <h2 id="active-alerts-heading" className="display-2 text-foreground">
              {t("alerts.active", "Active alerts")}
            </h2>
          </div>
          {!loading && (
            <span className="num shrink-0 text-sm font-bold text-primary-bright">
              {alerts.length}
            </span>
          )}
        </div>

        {loading && (
          <div className="space-y-2" aria-label={t("alerts.loadingAria", "Loading alerts")}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        )}

        {!loading && error && alerts.length === 0 && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-[12px] font-medium text-destructive/80" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && alerts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 py-14 text-center">
            <BellOff className="mx-auto mb-3 h-7 w-7 text-muted-foreground/40" aria-hidden />
            <p className="text-[13px] font-medium text-muted-foreground">{t("alerts.empty", "No active alerts. Create one above to get started.")}</p>
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
          <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("alerts.localSaved", "Locally saved (offline)")}
            </p>
            <div className="space-y-1.5">
              {localAlerts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{a.label}</p>
                    {a.target_price_lkr ? (
                      <p className="num mt-0.5 text-[11px] font-medium text-muted-foreground">{t("alerts.underPrice", "Under {price}", { price: formatPrice(a.target_price_lkr) })}</p>
                    ) : null}
                  </div>
                  <Link
                    to={`/?${new URLSearchParams(Object.fromEntries(Object.entries(a.filters).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString()}#market`}
                    className="flex h-7 items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2.5 text-[10px] font-bold text-primary-bright no-underline transition-all hover:bg-primary/20"
                  >
                    {t("common.browse", "Browse")}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.section>

      {/* Match results */}
      <motion.div variants={itemVariants}>
        <AlertMatchSection token={token} />
      </motion.div>
      </PageBody>
    </PageCanvas>
  );
}
