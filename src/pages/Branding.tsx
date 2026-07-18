import { motion } from "framer-motion";
import { Check, Palette, Sparkles, Type, Volume2, X } from "lucide-react";
import { BRAND_OPTIONS, BRAND_SYSTEM } from "@/lib/brandingOptions";
import { revealContainer, revealItem } from "@/lib/motion";

const COLOR_SWATCHES = [
  { key: "ink", label: "Ink", value: BRAND_SYSTEM.colors.ink },
  { key: "paper", label: "Paper", value: BRAND_SYSTEM.colors.paper },
  { key: "primary", label: "Primary", value: BRAND_SYSTEM.colors.primary },
  { key: "good", label: "Good", value: BRAND_SYSTEM.colors.good },
  { key: "risk", label: "Risk", value: BRAND_SYSTEM.colors.risk },
  { key: "gold", label: "Gold", value: BRAND_SYSTEM.colors.gold },
] as const;

export default function Branding() {
  const recommended = BRAND_OPTIONS.find((o) => o.recommended) ?? BRAND_OPTIONS[0];

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="relative min-h-screen overflow-hidden bg-background"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[-8%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[18%] left-[-12%] h-[420px] w-[420px] rounded-full bg-primary/5 blur-[100px]"
      />

      <motion.section variants={revealItem} className="relative z-10 border-b border-border bg-card/50 backdrop-blur-md">
        <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-6 sm:py-20 lg:py-24">
          <p className="section-eyebrow mb-5 inline-flex items-center gap-2">
            <Palette aria-hidden className="h-3.5 w-3.5" />
            Internal brand lab
          </p>
          <h1 className="display-hero max-w-3xl text-foreground">Branding.</h1>
          <p className="text-body-lg mt-6 max-w-xl">
            Name options and a system brief for the founder to design logos from — not a public marketing page.
          </p>
        </div>
      </motion.section>

      <div className="relative z-10 mx-auto max-w-[1320px] space-y-16 px-5 py-14 sm:px-6 lg:space-y-20 lg:py-20">
        <motion.section
          variants={revealItem}
          className="rounded-2xl border border-primary/35 bg-primary/[0.07] p-6 sm:p-8"
        >
          <p className="section-eyebrow mb-3 inline-flex items-center gap-2">
            <Sparkles aria-hidden className="h-3.5 w-3.5" />
            Ship recommendation
          </p>
          <h2 className="display-2 text-foreground">{recommended.name}</h2>
          <p className="mt-3 max-w-2xl text-[15px] font-medium text-muted-foreground">{recommended.tagline}</p>
          <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-foreground/85">{recommended.why}</p>
          <p className="mt-4 text-[12px] text-muted-foreground">
            Primary product name in system: <span className="font-semibold text-foreground">{BRAND_SYSTEM.primaryName}</span>
          </p>
        </motion.section>

        <motion.section variants={revealItem} aria-labelledby="options-heading">
          <p className="section-eyebrow mb-3">Name grid</p>
          <h2 id="options-heading" className="display-2 mb-3 text-foreground">
            Brand options.
          </h2>
          <p className="mb-8 max-w-xl text-[13px] text-muted-foreground">
            Founder designs the logo from each brief — these are direction notes, not final artwork.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {BRAND_OPTIONS.map((option) => (
              <article
                key={option.name}
                className={`rounded-2xl border p-5 sm:p-6 ${
                  option.recommended
                    ? "border-primary/40 bg-primary/[0.06]"
                    : "border-border bg-card/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[16px] font-bold text-foreground">{option.name}</h3>
                  {option.recommended && (
                    <span className="shrink-0 rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-primary-bright">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[13px] font-medium text-muted-foreground">{option.tagline}</p>
                <p className="mt-3 text-[12px] leading-relaxed text-foreground/80">{option.why}</p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Domain vibe
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">{option.domainVibe}</p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Logo brief
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-foreground/75">{option.logoBrief}</p>
              </article>
            ))}
          </div>
        </motion.section>

        <motion.section variants={revealItem} aria-labelledby="system-heading">
          <p className="section-eyebrow mb-3">System</p>
          <h2 id="system-heading" className="display-2 mb-8 text-foreground">
            Colors, type, voice.
          </h2>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card/40 p-6">
              <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <Palette aria-hidden className="h-3.5 w-3.5" />
                Colors
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {COLOR_SWATCHES.map((swatch) => (
                  <div key={swatch.key} className="overflow-hidden rounded-xl border border-border">
                    <div className="h-16 w-full" style={{ backgroundColor: swatch.value }} />
                    <div className="bg-surface px-3 py-2">
                      <p className="text-[11px] font-bold text-foreground">{swatch.label}</p>
                      <p className="num text-[10px] text-muted-foreground">{swatch.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card/40 p-6">
                <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  <Type aria-hidden className="h-3.5 w-3.5" />
                  Fonts
                </p>
                <ul className="space-y-3 text-[13px]">
                  <li className="flex justify-between gap-3 border-b border-border pb-3">
                    <span className="text-muted-foreground">Display</span>
                    <span className="font-semibold text-foreground">{BRAND_SYSTEM.fonts.display}</span>
                  </li>
                  <li className="flex justify-between gap-3 border-b border-border pb-3">
                    <span className="text-muted-foreground">Body</span>
                    <span className="font-semibold text-foreground">{BRAND_SYSTEM.fonts.body}</span>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Mono</span>
                    <span className="font-semibold text-foreground">{BRAND_SYSTEM.fonts.mono}</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-card/40 p-6">
                <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  <Volume2 aria-hidden className="h-3.5 w-3.5" />
                  Voice
                </p>
                <p className="text-[13px] leading-relaxed text-foreground/85">{BRAND_SYSTEM.voice}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card/40 p-6">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Kill list — do not ship
            </p>
            <div className="flex flex-wrap gap-2">
              {BRAND_SYSTEM.killNames.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-muted-foreground"
                >
                  <X aria-hidden className="h-3 w-3 text-destructive" />
                  {name}
                </span>
              ))}
            </div>
            <p className="mt-4 inline-flex items-center gap-2 text-[12px] text-muted-foreground">
              <Check aria-hidden className="h-3.5 w-3.5 text-primary" />
              Ship {BRAND_SYSTEM.primaryName} unless research overturns it.
            </p>
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
