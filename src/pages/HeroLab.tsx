import { BRAND } from "@/lib/brand";
import { AtmosphericImage } from "@/components/AtmosphericImage";
import {
  HERO_VARIANTS,
  getHeroVariant,
  isHeroVariantId,
  storeHeroVariantId,
  type HeroVariantId,
} from "@/lib/heroVariants";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

/**
 * Dev / local comparison surface for home-hero image + blend options.
 * Outside RequireAuth so you can pick without signing in.
 */
export default function HeroLab() {
  const [params, setParams] = useSearchParams();
  const paramId = params.get("hero");
  const [activeId, setActiveId] = useState<HeroVariantId>(
    isHeroVariantId(paramId) ? paramId : "ultrawide-day",
  );
  const variant = useMemo(() => getHeroVariant(activeId), [activeId]);

  const select = (id: HeroVariantId) => {
    setActiveId(id);
    storeHeroVariantId(id);
    const next = new URLSearchParams(params);
    next.set("hero", id);
    setParams(next, { replace: true });
  };

  const alignClass =
    variant.align === "left"
      ? "mr-auto max-w-xl text-left lg:max-w-2xl"
      : variant.align === "right"
        ? "ml-auto max-w-xl text-left lg:max-w-2xl"
        : "mx-auto max-w-3xl text-center";
  const copyTone = variant.tone === "dark" ? "text-white" : "text-foreground";
  const mutedTone =
    variant.tone === "dark" ? "text-white/75" : "text-foreground/80";
  const copyPanel =
    variant.tone === "dark"
      ? ""
      : "rounded-2xl bg-background/55 p-5 backdrop-blur-md sm:bg-background/40 sm:p-6";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Local hero lab
            </p>
            <p className="text-sm font-semibold">
              Pick a version · then tell me the ID to ship
            </p>
          </div>
          <Link
            to={`/?hero=${activeId}`}
            className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] font-bold hover:border-primary/40"
          >
            Open on home (needs sign-in)
          </Link>
        </div>
        <div className="mx-auto mt-3 flex max-w-6xl gap-2 overflow-x-auto pb-1">
          {HERO_VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => select(v.id)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ${
                v.id === activeId
                  ? "border-primary/50 bg-primary/10"
                  : "border-border bg-background hover:bg-surface"
              }`}
            >
              <span className="block text-[12px] font-bold">{v.label}</span>
              <span className="mt-0.5 block max-w-[180px] text-[10px] leading-snug text-muted-foreground">
                {v.blurb}
              </span>
            </button>
          ))}
        </div>
      </header>

      <section
        className={`relative min-h-[78vh] overflow-hidden border-b border-border ${
          variant.tone === "dark" ? "bg-background" : "bg-surface"
        }`}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <AtmosphericImage
            src={variant.image.src}
            srcSm={variant.image.srcSm}
            className={`h-full w-full object-cover ${variant.imageOpacity}`}
            style={{ objectPosition: variant.objectPosition }}
            priority
            sizes="100vw"
          />
          {variant.scrims.map((scrim) => (
            <div key={scrim} className={`absolute inset-0 ${scrim}`} />
          ))}
        </div>

        <div className="relative z-10 mx-auto flex min-h-[78vh] max-w-[1560px] items-center px-5 py-16 sm:px-6">
          <div className={`w-full ${alignClass} ${copyPanel}`}>
            <p className={`font-display text-4xl font-semibold tracking-tight sm:text-5xl ${copyTone}`}>
              {BRAND.name}
            </p>
            <p
              className={`mt-4 inline-flex rounded-full border px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] backdrop-blur-md ${
                variant.tone === "dark"
                  ? "border-white/15 bg-white/10 text-white/80"
                  : "border-border/80 bg-card/90 text-foreground/85"
              }`}
            >
              Vehicle Intelligence · Sri Lanka
            </p>
            <h1 className={`display-hero mt-6 ${copyTone}`}>
              Sri Lanka&apos;s entire vehicle market,
              <span className="text-sheen"> decoded.</span>
            </h1>
            <p className={`text-body-lg mt-6 max-w-xl ${mutedTone}`}>
              <span className={`font-bold num ${copyTone}`}>120,000+</span> live listings —
              real-time pricing, deal scores, and market intelligence.
            </p>
            <div
              className={`mt-8 flex max-w-xl items-center gap-2 rounded-xl border px-3 py-2 ${
                variant.tone === "dark"
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-border bg-card"
              }`}
            >
              <span className="text-[13px] opacity-60">Search vehicles…</span>
              <span className="ml-auto rounded-lg bg-primary px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white">
                Search
              </span>
            </div>
            <p className={`mt-6 text-[11px] font-medium ${mutedTone}`}>
              Active: <span className="font-bold">{variant.id}</span> — {variant.blurb}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-lg font-bold">All candidates at a glance</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HERO_VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => select(v.id)}
              className={`overflow-hidden rounded-2xl border text-left transition-shadow hover:shadow-soft-lg ${
                v.id === activeId ? "border-primary ring-2 ring-primary/30" : "border-border"
              }`}
            >
              <AtmosphericImage
                src={v.image.srcSm}
                className="h-36 w-full object-cover"
                sizes="400px"
              />
              <div className="p-3">
                <p className="text-[13px] font-bold">{v.label}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{v.blurb}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
