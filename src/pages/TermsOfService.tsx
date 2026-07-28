import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileText } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { PageBody } from "@/components/PageBody";
import { PageCanvas } from "@/components/PageCanvas";
import { PageHero } from "@/components/PageHero";
import { revealItem } from "@/lib/motion";
import { visuals } from "@/lib/visualAssets";

export default function TermsOfService() {
  return (
    <PageCanvas>
      <PageHero
        theme="default"
        eyebrow="Legal"
        eyebrowIcon={FileText}
        watermarkIcon={FileText}
        title={<>Terms of Service<span className="text-sheen">.</span></>}
        description={`The rules that govern your use of ${BRAND.name} and the obligations of both parties.`}
        media={visuals.pageFaqIllustration}
        mediaPosition="center 40%"
        mediaTone="brand"
        highlights={[
          { label: "Platform", value: "SL", hint: "Sri Lanka vehicle market" },
          { label: "Estimates", value: "Not appraisals", hint: "Algorithmic signals only" },
          { label: "Access", value: "Invite", hint: "Seat-based, revocable" },
        ]}
        actions={
          <>
            <Link
              to="/privacy"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[13px] font-semibold text-primary-foreground no-underline shadow-soft transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Privacy Policy
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
            <h2 className="font-display text-xl font-semibold text-foreground">1. Acceptance</h2>
            <p>
              By creating an account or using {BRAND.name} you agree to these Terms. If you do
              not agree, do not use the platform. Access is invite-only and may be revoked at
              any time for violation of these Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">2. Description of service</h2>
            <p>
              {BRAND.name} is a vehicle market intelligence platform that aggregates publicly
              available car listings from Sri Lanka classifieds, applies pricing algorithms,
              and presents analytics for buyers, dealers, and importers.
            </p>
            <p>
              Listing data is scraped from public sources and may lag real-world availability.
              {BRAND.name} does not sell vehicles, broker transactions, or guarantee the
              accuracy of any third-party listing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">3. Pricing estimates and FMV scores</h2>
            <p>
              Fair Market Value (FMV) estimates, deal scores, and price indices produced by
              {BRAND.name} are <strong>algorithmic signals derived from scraped listing data</strong>.
              They are not certified appraisals, professional valuations, or financial advice.
              Do not rely on them as the sole basis for any financial decision. {BRAND.name}
              accepts no liability for decisions made using platform outputs.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">4. Permitted use</h2>
            <p>You may use {BRAND.name} for lawful personal or business research. You must not:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Scrape, copy, or republish platform data in bulk without a written B2B licence.</li>
              <li>Attempt to reverse-engineer pricing algorithms or access APIs beyond published endpoints.</li>
              <li>Use the platform to mislead buyers or artificially inflate/deflate market perceptions.</li>
              <li>Share account credentials or seats with parties outside your licensed team.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">5. Subscription and payment</h2>
            <p>
              Free, Pro, and Dealer plans are described on the{" "}
              <Link to="/pricing" className="text-primary-bright underline decoration-primary/40 underline-offset-2">
                Pricing page
              </Link>
              . Paid plans are billed in advance. Failure to renew reverts access to Free tier.
              Refunds are not provided for partial periods except where required by applicable law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">6. WhatsApp notifications</h2>
            <p>
              WhatsApp market-alert messages are opt-in only. By adding a phone number to an
              alert you consent to receive automated messages via Twilio. Standard carrier
              message rates may apply. Opt out at any time by removing the alert.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">7. Intellectual property</h2>
            <p>
              The {BRAND.name} platform, brand, algorithms, and original content are owned by
              Ardeno Studio. Individual listing data remains the property of the originating
              classifieds platforms; {BRAND.name} aggregates it under fair-use indexing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">8. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, Ardeno Studio is not liable for any
              indirect, incidental, or consequential damages arising from use of {BRAND.name},
              including losses from transactions made using platform pricing signals.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">9. Governing law</h2>
            <p>
              These Terms are governed by the laws of Sri Lanka. Disputes shall be resolved
              in the courts of Sri Lanka unless otherwise agreed in writing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-foreground">10. Contact</h2>
            <p>
              Questions about these Terms:{" "}
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
