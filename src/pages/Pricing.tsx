import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Check, HelpCircle, Sparkles, Users } from "lucide-react";
import { ICP_PERSONAS, PRICING_FAQ, PRICING_TIERS } from "@/lib/pricingContent";
import { revealContainer, revealItem } from "@/lib/motion";

const COMPARE_ROWS: { label: string; free: string; pro: string; dealer: string; enterprise: string }[] = [
  { label: "Dashboard browse", free: "Yes", pro: "Yes", dealer: "Yes", enterprise: "Yes" },
  { label: "Official Pulse", free: "Limited", pro: "History", dealer: "History", enterprise: "Custom" },
  { label: "Pro terminal", free: "—", pro: "Full", dealer: "Full", enterprise: "Full" },
  { label: "Alerts depth", free: "Basic", pro: "Deep", dealer: "Deep", enterprise: "Custom" },
  { label: "Exports", free: "—", pro: "Yes", dealer: "Yes", enterprise: "Yes" },
  { label: "Dealer workspace", free: "—", pro: "—", dealer: "Full", enterprise: "Full" },
  { label: "Team seats", free: "—", pro: "—", dealer: "Yes", enterprise: "Packs" },
  { label: "SLA / feeds", free: "—", pro: "—", dealer: "—", enterprise: "Yes" },
];

const CTA_CLASS = (highlight?: boolean) =>
  `mt-6 inline-flex h-10 items-center justify-center rounded-full px-4 text-[12px] font-semibold no-underline transition-all active:scale-[0.98] ${
    highlight
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "border border-border bg-surface text-foreground hover:border-primary/35"
  }`;


export default function Pricing() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="relative min-h-screen overflow-hidden bg-background"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[25%] left-[-12%] h-[450px] w-[450px] rounded-full bg-primary/5 blur-[110px]"
      />

      <motion.section variants={revealItem} className="relative z-10 border-b border-border bg-card/50 backdrop-blur-md">
        <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-6 sm:py-20 lg:py-24">
          <p className="section-eyebrow mb-5 inline-flex items-center gap-2">
            <Sparkles aria-hidden className="h-3.5 w-3.5" />
            Access tiers
          </p>
          <h1 className="display-hero max-w-3xl text-foreground">Pricing.</h1>
          <p className="text-body-lg mt-6 max-w-xl">
            Built for Sri Lanka dealers and decision-makers — months of scraping shouldn’t be free forever.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/sign-in"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[13px] font-semibold text-primary-foreground no-underline shadow-soft transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Sign in
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
            <Link
              to="/dealer"
              className="inline-flex h-11 items-center rounded-full border border-border bg-card px-6 text-[13px] font-semibold text-foreground no-underline transition-all hover:border-primary/40 hover:bg-surface active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Dealer workspace
            </Link>
            <Link
              to="/docs"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-6 text-[13px] font-semibold text-foreground no-underline transition-all hover:border-primary/40 hover:bg-surface active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <BookOpen aria-hidden className="h-4 w-4" />
              Docs
            </Link>
          </div>
        </div>
      </motion.section>

      <div className="relative z-10 mx-auto max-w-[1320px] space-y-16 px-5 py-14 sm:px-6 lg:space-y-20 lg:py-20">
        <motion.section variants={revealItem} aria-labelledby="icp-heading">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="section-eyebrow mb-3 inline-flex items-center gap-2">
                <Users aria-hidden className="h-3.5 w-3.5" />
                Who it’s for
              </p>
              <h2 id="icp-heading" className="display-2 text-foreground">
                Built around real Sri Lanka operators.
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
          <p className="section-eyebrow mb-3">Plans</p>
          <h2 id="tiers-heading" className="display-2 mb-8 text-foreground">
            Choose the depth you need.
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
                    Recommended
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
                {tier.external ? (
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
          <p className="section-eyebrow mb-3">Compare</p>
          <h2 id="compare-heading" className="display-2 mb-6 text-foreground">
            Feature snapshot.
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead>
                <tr className="bg-surface">
                  <th className="px-4 py-3 font-bold uppercase tracking-[0.08em] text-muted-foreground">Capability</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-[0.08em] text-muted-foreground">Free</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-[0.08em] text-muted-foreground">Pro</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-[0.08em] text-primary-bright">Dealer</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-[0.08em] text-muted-foreground">Custom</th>
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
          <p className="section-eyebrow mb-3 inline-flex items-center gap-2">
            <HelpCircle aria-hidden className="h-3.5 w-3.5" />
            FAQ
          </p>
          <h2 id="faq-heading" className="display-2 mb-8 text-foreground">
            Common questions.
          </h2>
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
            <p className="section-eyebrow mb-2">Get started</p>
            <h3 className="text-lg font-bold text-foreground">Sign in, open Dealer, or read the docs.</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/sign-in"
              className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-[12px] font-semibold text-primary-foreground no-underline"
            >
              Sign in
            </Link>
            <Link
              to="/dealer"
              className="inline-flex h-10 items-center rounded-full border border-border bg-card px-5 text-[12px] font-semibold text-foreground no-underline"
            >
              Dealer workspace
            </Link>
            <Link
              to="/docs"
              className="inline-flex h-10 items-center rounded-full border border-border bg-card px-5 text-[12px] font-semibold text-foreground no-underline"
            >
              Docs
            </Link>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
