import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Check, HelpCircle, Loader2, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { BRAND } from "@/lib/brand";
import { ICP_PERSONAS, PRICING_FAQ, PRICING_TIERS } from "@/lib/pricingContent";
import type { PricingTierId } from "@/lib/pricingContent";
import { PageBody } from "@/components/PageBody";
import { PageCanvas } from "@/components/PageCanvas";
import { PageHero } from "@/components/PageHero";
import { AtmosphericImage } from "@/components/AtmosphericImage";
import { revealItem } from "@/lib/motion";
import { useAppPreferences } from "@/lib/appPreferences";
import { visuals } from "@/lib/visualAssets";
import { API_BASE } from "@/services/api";
import { authHeaders } from "@/lib/authToken";

type CheckoutIntentResponse = {
  provider: "manual" | "payhere" | "stripe";
  checkout_url?: string | null;
  message: string;
};

async function fetchCheckoutIntent(plan: string): Promise<CheckoutIntentResponse> {
  const res = await fetch(`${API_BASE}/billing/checkout-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
    body: JSON.stringify({ plan }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("checkout-intent request failed");
  return res.json() as Promise<CheckoutIntentResponse>;
}

const COMPARE_ROW_DEFS = [
  { labelKey: "pricing.compare.dashboard", labelFb: "Dashboard browse", freeKey: "pricing.val.yes", freeFb: "Yes", proKey: "pricing.val.yes", proFb: "Yes", dealerKey: "pricing.val.yes", dealerFb: "Yes", enterpriseKey: "pricing.val.yes", enterpriseFb: "Yes" },
  { labelKey: "pricing.compare.pulse", labelFb: "Official Pulse", freeKey: "pricing.val.limited", freeFb: "Limited", proKey: "pricing.val.history", proFb: "History", dealerKey: "pricing.val.history", dealerFb: "History", enterpriseKey: "pricing.val.custom", enterpriseFb: "Custom" },
  { labelKey: "pricing.compare.terminal", labelFb: "Pro terminal", freeKey: "", freeFb: "—", proKey: "pricing.val.full", proFb: "Full", dealerKey: "pricing.val.full", dealerFb: "Full", enterpriseKey: "pricing.val.full", enterpriseFb: "Full" },
  { labelKey: "pricing.compare.alerts", labelFb: "Alerts depth", freeKey: "pricing.val.basic", freeFb: "Basic", proKey: "pricing.val.deep", proFb: "Deep", dealerKey: "pricing.val.deep", dealerFb: "Deep", enterpriseKey: "pricing.val.custom", enterpriseFb: "Custom" },
  { labelKey: "pricing.compare.exports", labelFb: "Exports", freeKey: "", freeFb: "—", proKey: "pricing.val.yes", proFb: "Yes", dealerKey: "pricing.val.yes", dealerFb: "Yes", enterpriseKey: "pricing.val.yes", enterpriseFb: "Yes" },
  { labelKey: "pricing.compare.dealer", labelFb: "Dealer workspace", freeKey: "", freeFb: "—", proKey: "", proFb: "—", dealerKey: "pricing.val.full", dealerFb: "Full", enterpriseKey: "pricing.val.full", enterpriseFb: "Full" },
  { labelKey: "pricing.compare.seats", labelFb: "Team seats", freeKey: "", freeFb: "—", proKey: "", proFb: "—", dealerKey: "pricing.val.yes", dealerFb: "Yes", enterpriseKey: "pricing.val.packs", enterpriseFb: "Packs" },
  { labelKey: "pricing.compare.sla", labelFb: "SLA / feeds", freeKey: "", freeFb: "—", proKey: "", proFb: "—", dealerKey: "", dealerFb: "—", enterpriseKey: "pricing.val.yes", enterpriseFb: "Yes" },
] as const;

const CTA_CLASS = (highlight?: boolean) =>
  `mt-6 inline-flex h-10 items-center justify-center rounded-full px-4 text-[12px] font-semibold no-underline transition-all active:scale-[0.98] ${
    highlight
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "border border-border bg-surface text-foreground hover:border-primary/35"
  }`;


export default function Pricing() {
  const { t } = useAppPreferences();
  const [checkoutLoading, setCheckoutLoading] = useState<PricingTierId | null>(null);
  const cell = (key: string, fb: string) => (key ? t(key, fb) : fb);

  const handleCheckout = async (tierId: PricingTierId, fallbackTo: string) => {
    setCheckoutLoading(tierId);
    try {
      const intent = await fetchCheckoutIntent(tierId);
      if (intent.checkout_url) {
        window.location.href = intent.checkout_url;
      } else {
        window.location.href = `mailto:${BRAND.contactEmail}?subject=Motormila%20${tierId}%20plan%20upgrade`;
      }
    } catch {
      window.location.href = fallbackTo;
    } finally {
      setCheckoutLoading(null);
    }
  };
  const COMPARE_ROWS = COMPARE_ROW_DEFS.map((row) => ({
    label: t(row.labelKey, row.labelFb),
    free: cell(row.freeKey, row.freeFb),
    pro: cell(row.proKey, row.proFb),
    dealer: cell(row.dealerKey, row.dealerFb),
    enterprise: cell(row.enterpriseKey, row.enterpriseFb),
  }));
  return (
    <PageCanvas>
      <PageHero
        theme="default"
        eyebrow={t("pricing.eyebrow", "Plans")}
        eyebrowIcon={Sparkles}
        watermarkIcon={Users}
        title={<>{t("pricing.title", "Pricing that funds the pipeline")}<span className="text-sheen">.</span></>}
        description={t("pricing.body", "Free browse stays free. Pro and Dealer fund scrapes, scores, and workspaces.")}
        media={visuals.alt2PagePricingBg}
        mediaPosition="center 40%"
        mediaTone="brand"
        highlights={[
          { label: "Workspaces", value: "4", hint: "Free through enterprise tiers" },
          { label: "Dealer lane", value: "Pro", hint: "Command center + exports" },
          { label: "Docs", value: "Live", hint: "Platform methodology" },
        ]}
        actions={
          <>
            <Link
              to="/sign-in"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[13px] font-semibold text-primary-foreground no-underline shadow-soft transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("common.signIn", "Sign in")}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
            <Link
              to="/dealer"
              className="inline-flex h-11 items-center rounded-full border border-border bg-card px-6 text-[13px] font-semibold text-foreground no-underline transition-all hover:border-primary/40 hover:bg-surface active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("pricing.dealerWorkspace", "Dealer workspace")}
            </Link>
            <Link
              to="/docs"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-6 text-[13px] font-semibold text-foreground no-underline transition-all hover:border-primary/40 hover:bg-surface active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <BookOpen aria-hidden className="h-4 w-4" />
              {t("common.docs", "Docs")}
            </Link>
          </>
        }
      />

      <PageBody className="space-y-16 lg:space-y-20">
        <motion.section variants={revealItem} aria-labelledby="icp-heading">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="section-eyebrow mb-3 inline-flex items-center gap-2">
                <Users aria-hidden className="h-3.5 w-3.5" />
                {t("pricing.whoFor", "Who it's for")}
              </p>
              <h2 id="icp-heading" className="display-2 text-foreground">
                {t("pricing.icpTitle", "Built around real Sri Lanka operators.")}
              </h2>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ICP_PERSONAS.map((persona) => (
              <div
                key={persona.title}
                className="rounded-2xl border border-border bg-card/50 p-5 transition-colors hover:border-primary/25"
              >
                <h3 className="text-[15px] font-bold text-foreground">{persona.title}</h3>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{persona.pain}</p>
                <p className="mt-3 border-t border-border pt-3 text-[12px] font-medium leading-relaxed text-foreground/80">
                  {persona.fit}
                </p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={revealItem} aria-labelledby="tiers-heading">
          <p className="section-eyebrow mb-3">{t("pricing.plansEyebrow", "Plans")}</p>
          <h2 id="tiers-heading" className="display-2 mb-8 text-foreground">
            {t("pricing.tiersTitle", "Choose the depth you need.")}
          </h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  tier.highlight
                    ? "border-primary/40 bg-primary/[0.07] shadow-soft"
                    : "border-border bg-card/50"
                }`}
              >
                {tier.highlight && (
                  <span className="absolute -top-2.5 right-4 rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-primary-bright">
                    {t("pricing.recommended", "Recommended")}
                  </span>
                )}
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{tier.name}</p>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="num text-2xl font-bold text-foreground">{tier.priceLkr}</span>
                  <span className="text-[12px] text-muted-foreground">{tier.priceNote}</span>
                </div>
                {tier.annualNote && (
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">{tier.annualNote}</p>
                )}
                <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{tier.audience}</p>
                <ul className="mt-5 flex-1 space-y-2.5 border-t border-border pt-5">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-[12px] leading-snug text-foreground/85">
                      <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {(tier.id === "pro" || tier.id === "dealer") ? (
                  <button
                    type="button"
                    disabled={checkoutLoading === tier.id}
                    onClick={() => void handleCheckout(tier.id, tier.ctaTo)}
                    className={CTA_CLASS(tier.highlight)}
                  >
                    {checkoutLoading === tier.id ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden />
                    ) : null}
                    {tier.ctaLabel}
                  </button>
                ) : tier.external ? (
                  <a href={tier.ctaTo} className={CTA_CLASS(tier.highlight)}>
                    {tier.ctaLabel}
                  </a>
                ) : (
                  <Link to={tier.ctaTo} className={CTA_CLASS(tier.highlight)}>
                    {tier.ctaLabel}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={revealItem} aria-labelledby="compare-heading">
          <p className="section-eyebrow mb-3">{t("pricing.compare", "Compare")}</p>
          <h2 id="compare-heading" className="display-2 mb-6 text-foreground">
            {t("pricing.featureSnapshot", "Feature snapshot.")}
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead>
                <tr className="bg-surface">
                  <th className="px-4 py-3 font-bold uppercase tracking-[0.08em] text-muted-foreground">{t("pricing.capability", "Capability")}</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-[0.08em] text-muted-foreground">{t("common.free", "Free")}</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-[0.08em] text-muted-foreground">{t("common.pro", "Pro")}</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-[0.08em] text-primary-bright">{t("nav.dealer", "Dealer")}</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-[0.08em] text-muted-foreground">{t("pricing.val.custom", "Custom")}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.label} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold text-foreground">{row.label}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.free}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.pro}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{row.dealer}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        <motion.section variants={revealItem} aria-labelledby="faq-heading">
          <div className="mb-8 grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <p className="section-eyebrow mb-3 inline-flex items-center gap-2">
                <HelpCircle aria-hidden className="h-3.5 w-3.5" />
                {t("pricing.faq", "FAQ")}
              </p>
              <h2 id="faq-heading" className="display-2 text-foreground">
                {t("pricing.faqTitle", "Common questions.")}
              </h2>
            </div>
            <AtmosphericImage
              src={visuals.pageFaqIllustration.src}
              srcSm={visuals.pageFaqIllustration.srcSm}
              className="hidden h-28 w-full rounded-2xl object-cover object-center opacity-90 lg:block"
              sizes="220px"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {PRICING_FAQ.map((item) => (
              <div key={item.q} className="rounded-2xl border border-border bg-card/40 p-5">
                <h3 className="text-[14px] font-bold text-foreground">{item.q}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.div
          variants={revealItem}
          className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/[0.06] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
        >
          <div>
            <p className="section-eyebrow mb-2">{t("pricing.getStarted", "Get started")}</p>
            <h3 className="text-lg font-bold text-foreground">{t("pricing.ctaBanner", "Sign in, open Dealer, or read the docs.")}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/sign-in"
              className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-[12px] font-semibold text-primary-foreground no-underline"
            >
              {t("common.signIn", "Sign in")}
            </Link>
            <Link
              to="/dealer"
              className="inline-flex h-10 items-center rounded-full border border-border bg-card px-5 text-[12px] font-semibold text-foreground no-underline"
            >
              {t("pricing.dealerWorkspace", "Dealer workspace")}
            </Link>
            <Link
              to="/docs"
              className="inline-flex h-10 items-center rounded-full border border-border bg-card px-5 text-[12px] font-semibold text-foreground no-underline"
            >
              {t("common.docs", "Docs")}
            </Link>
            <a
              href={BRAND.contactMailto}
              className="inline-flex h-10 items-center rounded-full border border-border bg-card px-5 text-[12px] font-semibold text-foreground no-underline"
            >
              {t("common.messageUs", "Message us")}
            </a>
          </div>
        </motion.div>
      </PageBody>
    </PageCanvas>
  );
}
