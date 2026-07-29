import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Shield } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { PageBody } from "@/components/PageBody";
import { PageCanvas } from "@/components/PageCanvas";
import { PageHero } from "@/components/PageHero";
import { revealItem } from "@/lib/motion";
import { visuals } from "@/lib/visualAssets";

export default function PrivacyPolicy() {
  return (
    <PageCanvas>
      <PageHero
        theme="default"
        eyebrow="Legal"
        eyebrowIcon={Shield}
        watermarkIcon={Shield}
        title={<>Privacy Policy<span className="text-sheen">.</span></>}
        description={`How ${BRAND.name} collects, uses, and protects information when you use the platform.`}
        media={visuals.pageFaqIllustration}
        mediaPosition="center 40%"
        mediaTone="brand"
        highlights={[
          { label: "Data", value: "Public", hint: "Listings from public sources" },
          { label: "Opt-in", value: "WhatsApp", hint: "Alerts require your consent" },
          { label: "Contact", value: "Email", hint: "Full erasure on request" },
        ]}
        actions={
          <>
            <Link
              to="/terms"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[13px] font-semibold text-primary-foreground no-underline shadow-soft transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Terms of Service
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <PageBody>
        <motion.article
          variants={revealItem}
          className="prose prose-sm prose-neutral dark:prose-invert max-w-3xl space-y-8 text-[14px] leading-7 text-foreground/85"
        >
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">1. What we collect</h2>
            <p>
              {BRAND.name} aggregates vehicle listing data from publicly accessible Sri Lanka
              classified websites (Ikman, Riyasewana, AutoLanka, and others). We do not collect
              personal information from those listings — only vehicle attributes, asking prices,
              and seller-provided descriptions that are already public.
            </p>
            <p>
              When you create an account, we store your email address, chosen display name,
              access plan, and encrypted password hash. We also record sign-in timestamps and
              the IP address of each authenticated request for security purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">2. How we use your information</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>To authenticate your session and enforce plan limits.</li>
              <li>To send platform invite emails and transactional notifications.</li>
              <li>To deliver WhatsApp market-alert messages — only when you explicitly opt in by providing your phone number in the Alerts panel.</li>
              <li>To improve scrape quality and detect data anomalies (aggregate, anonymised).</li>
            </ul>
            <p>We do not sell, rent, or share your personal data with third parties for marketing.</p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">3. Fair Market Value estimates</h2>
            <p>
              Price intelligence, deal scores, and FMV estimates on {BRAND.name} are
              <strong> algorithmic signals derived from live listing data</strong> — they are
              not formal appraisals, certified valuations, or financial advice. Treat them as
              market reference points only.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">4. WhatsApp alerts</h2>
            <p>
              WhatsApp notifications are strictly opt-in. By submitting a phone number in the
              Alerts panel you consent to receiving vehicle-match messages via Twilio. You can
              withdraw consent at any time by removing the alert or contacting us.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">5. Cookies and local storage</h2>
            <p>
              We use a session cookie (HttpOnly, Secure) to maintain your authenticated session.
              Watchlist IDs and UI preferences (theme, language) are stored in your browser's
              local storage and never transmitted to our servers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">6. Data retention and erasure</h2>
            <p>
              Account data is retained while your account is active. You may request full
              erasure at any time by emailing{" "}
              <a
                href={BRAND.contactMailto}
                className="text-primary-bright underline decoration-primary/40 underline-offset-2"
              >
                {BRAND.contactEmail}
              </a>{" "}
              with subject "Data erasure request". We will complete erasure within 30 days.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">7. Changes to this policy</h2>
            <p>
              Material changes will be communicated via email to registered users at least 14 days
              before taking effect. Continued use of the platform after that date constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">8. Contact</h2>
            <p>
              Questions about privacy:{" "}
              <a
                href={BRAND.contactMailto}
                className="text-primary-bright underline decoration-primary/40 underline-offset-2"
              >
                {BRAND.contactEmail}
              </a>
            </p>
          </section>

          <p className="border-t border-border pt-6 text-[12px] text-muted-foreground">
            Last updated: July 2025 · {BRAND.name} is operated by Ardeno Studio.
          </p>
        </motion.article>
      </PageBody>
    </PageCanvas>
  );
}
