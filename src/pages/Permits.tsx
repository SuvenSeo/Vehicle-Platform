import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  BadgeDollarSign,
  FileBadge,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { PageBody } from "@/components/PageBody";
import { PageCanvas } from "@/components/PageCanvas";
import { PageHero } from "@/components/PageHero";
import { getPermits, formatPrice, type PermitInfo } from "@/services/api";
import { useAppPreferences } from "@/lib/appPreferences";
import { useAuth } from "@/lib/authContext";
import { revealContainer, revealItem } from "@/lib/motion";
import { visuals } from "@/lib/visualAssets";

function permitTypeLabel(type: string): string {
  return String(type || "permit")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Permit";
}

function formatUpdatedLabel(value?: string | null): string {
  if (!value) return "Admin seeded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Admin seeded";
  return date.toLocaleDateString("en-LK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Permits() {
  const { t } = useAppPreferences();
  const { isAdmin } = useAuth();
  const [permits, setPermits] = useState<PermitInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPermits = useCallback(() => {
    setLoading(true);
    setError(null);
    getPermits()
      .then((data) => {
        setPermits(data);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load permit prices.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.title = "Permit Market Tracker — Motormila";
    loadPermits();
  }, [loadPermits]);

  const sortedPermits = useMemo(
    () => [...permits].sort((a, b) => b.market_price_lkr - a.market_price_lkr),
    [permits],
  );
  const topPermit = sortedPermits[0];
  const permitTypes = new Set(sortedPermits.map((permit) => permit.permit_type).filter(Boolean));

  return (
    <PageCanvas>
      <PageHero
        theme="calculator"
        eyebrow={t("permits.eyebrow", "Permit market")}
        eyebrowIcon={FileBadge}
        watermarkIcon={BadgeDollarSign}
        title={<>{t("permits.title", "Permit market tracker.")}</>}
        description={t(
          "permits.description",
          "Indicative Sri Lanka import-permit market prices from admin-seeded Motormila data. Use these as directional premiums, then model the full landed cost before committing.",
        )}
        media={visuals.alt2PageInsuranceFinance}
        mediaPosition="center 35%"
        mediaTone="brand"
        highlights={[
          {
            label: t("permits.highlightListings", "Permit rows"),
            value: loading ? "..." : String(sortedPermits.length),
            hint: t("permits.highlightListingsHint", "Admin maintained"),
          },
          {
            label: t("permits.highlightTop", "Top premium"),
            value: topPermit ? formatPrice(topPermit.market_price_lkr) : "-",
            hint: topPermit ? topPermit.permit_name : t("permits.noPremium", "Awaiting data"),
          },
          {
            label: t("permits.highlightScope", "Scope"),
            value: permitTypes.size ? String(permitTypes.size) : "-",
            hint: t("permits.highlightScopeHint", "Permit categories"),
          },
        ]}
        actions={
          <>
            <Link
              to="/calculator?tab=landed-cost"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[13px] font-semibold text-primary-foreground no-underline shadow-soft transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("permits.landedCostCta", "Model landed cost")}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
            <Link
              to="/calculator?tab=permits"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-6 text-[13px] font-semibold text-foreground no-underline transition-all hover:border-primary/40 hover:bg-surface active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <FileBadge aria-hidden className="h-4 w-4" />
              {t("permits.calculatorTabCta", "Open calculator tracker")}
            </Link>
          </>
        }
      />

      <PageBody className="space-y-8">
        <motion.section
          variants={revealItem}
          className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-5 sm:p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <ShieldCheck aria-hidden className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">
                {t("permits.noticeTitle", "Indicative premiums, not a transaction venue")}
              </h2>
              <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-muted-foreground">
                {t(
                  "permits.noticeBody",
                  "Permit values can move quickly with policy changes, transfer eligibility, vehicle category limits, and buyer urgency. Treat Motormila prices as market intelligence only; verify legal eligibility and compare the premium against your full landed-cost calculation.",
                )}
              </p>
            </div>
          </div>
        </motion.section>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("permits.loading", "Loading permit prices")}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-44 animate-pulse rounded-2xl border border-border bg-card" />
            ))}
          </div>
        ) : error ? (
          <motion.section
            variants={revealItem}
            className="flex flex-col items-start gap-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6"
          >
            <div className="flex items-center gap-2">
              <AlertCircle aria-hidden className="h-4 w-4 text-rose-400" />
              <h2 className="text-sm font-bold text-foreground">{t("permits.errorTitle", "Could not load permit prices")}</h2>
            </div>
            <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={loadPermits}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-5 text-[12px] font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-surface active:scale-[0.98]"
            >
              <RefreshCw aria-hidden className="h-3.5 w-3.5" />
              {t("common.retry", "Retry")}
            </button>
          </motion.section>
        ) : sortedPermits.length === 0 ? (
          <motion.section
            variants={revealItem}
            className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center"
          >
            <FileBadge aria-hidden className="mx-auto h-7 w-7 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-bold text-foreground">{t("permits.emptyTitle", "No permit prices yet")}</h2>
            <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
              {isAdmin
                ? t(
                    "permits.emptyAdminBody",
                    "The permits table is empty. Use the admin permits seed/upsert tools to publish current indicative permit premiums, then refresh this page.",
                  )
                : t(
                    "permits.emptyBody",
                    "Permit market rows will appear here after Motormila admins publish benchmark premiums.",
                  )}
            </p>
            {isAdmin ? (
              <Link
                to="/admin"
                className="mt-6 inline-flex h-10 items-center rounded-full bg-primary px-5 text-[12px] font-semibold text-primary-foreground no-underline"
              >
                {t("permits.openAdmin", "Open Admin")}
              </Link>
            ) : null}
          </motion.section>
        ) : (
          <>
            <motion.section variants={revealContainer} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedPermits.map((permit) => (
                <motion.article
                  key={permit.id}
                  variants={revealItem}
                  className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                      {permitTypeLabel(permit.permit_type)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {formatUpdatedLabel((permit as PermitInfo & { updated_at?: string | null }).updated_at)}
                    </span>
                  </div>
                  <h2 className="mt-5 font-display text-xl font-bold leading-tight text-foreground">
                    {permit.permit_name}
                  </h2>
                  <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {t("permits.marketPremium", "Indicative market premium")}
                  </p>
                  <p className="num mt-2 text-3xl font-black tracking-tight text-primary">
                    {formatPrice(permit.market_price_lkr)}
                  </p>
                  <div className="mt-5 border-t border-border pt-4">
                    <p className="text-[12px] leading-relaxed text-muted-foreground">
                      {t(
                        "permits.cardNote",
                        "Use this premium as one input in a full import-cost scenario, alongside CIF, FX, CID/excise, VAT, and registration costs.",
                      )}
                    </p>
                  </div>
                </motion.article>
              ))}
            </motion.section>

            <motion.section
              variants={revealItem}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
            >
              <div className="border-b border-border px-5 py-4 sm:px-6">
                <h2 className="text-sm font-bold text-foreground">{t("permits.tableTitle", "Permit price table")}</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {t("permits.tableDesc", "Same data in a compact format for quick comparison.")}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-5 py-3">{t("permits.nameColumn", "Permit type")}</th>
                      <th className="px-5 py-3">{t("permits.categoryColumn", "Category")}</th>
                      <th className="px-5 py-3 text-right">{t("permits.priceColumn", "Market price")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPermits.map((permit) => (
                      <tr key={`row-${permit.id}`} className="border-b border-border last:border-b-0 hover:bg-surface">
                        <td className="px-5 py-4 font-semibold text-foreground">{permit.permit_name}</td>
                        <td className="px-5 py-4 font-medium text-muted-foreground">{permitTypeLabel(permit.permit_type)}</td>
                        <td className="num px-5 py-4 text-right font-bold text-primary">
                          {formatPrice(permit.market_price_lkr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.section>
          </>
        )}

        <motion.section
          variants={revealItem}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <div>
            <p className="section-eyebrow mb-2">{t("permits.nextStep", "Next step")}</p>
            <h2 className="text-lg font-bold text-foreground">{t("permits.ctaTitle", "Check the full import equation")}</h2>
            <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">
              {t(
                "permits.ctaBody",
                "A permit premium is only one layer. Run landed cost with your CIF, fuel type, engine capacity, live FX, and surcharge settings.",
              )}
            </p>
          </div>
          <Link
            to="/calculator?tab=landed-cost"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[12px] font-semibold text-primary-foreground no-underline"
          >
            {t("permits.runCalculator", "Run calculator")}
            <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        </motion.section>

        {loading ? (
          <div className="sr-only" role="status">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            {t("permits.loadingStatus", "Loading permit prices")}
          </div>
        ) : null}
      </PageBody>
    </PageCanvas>
  );
}
