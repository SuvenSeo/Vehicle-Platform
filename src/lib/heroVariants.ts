import { visuals, type VisualAsset } from "@/lib/visualAssets";

export type HeroAlign = "center" | "left" | "right";
export type HeroTone = "light" | "dark" | "golden";

export type HeroVariantId =
  | "current"
  | "colombo-night"
  | "expressway-dusk"
  | "orange-sunset"
  | "ultrawide-day"
  | "blueprint";

export type HeroVariant = {
  id: HeroVariantId;
  label: string;
  blurb: string;
  image: VisualAsset;
  objectPosition: string;
  imageOpacity: string;
  align: HeroAlign;
  tone: HeroTone;
  /** Hide floating side chips for cleaner first viewport */
  hideSideSignals: boolean;
  /** Stacked absolute gradient layers over the photo */
  scrims: string[];
};

/**
 * Local hero lab options — switch via floating picker or `?hero=<id>`.
 * Do not commit a final pick until the user chooses.
 */
export const HERO_VARIANTS: HeroVariant[] = [
  {
    id: "current",
    label: "1 · Current traffic",
    blurb: "Soft market expressway wash (what’s live today).",
    image: visuals.pageSearchHero,
    objectPosition: "center 35%",
    imageOpacity: "opacity-[0.34]",
    align: "center",
    tone: "light",
    hideSideSignals: false,
    scrims: [
      "bg-gradient-to-b from-surface/90 via-surface/78 to-background",
      "bg-gradient-to-r from-surface/85 via-transparent to-surface/55",
    ],
  },
  {
    id: "colombo-night",
    label: "2 · Colombo night",
    blurb: "Lotus Tower + tuk-tuk market — left copy, cinematic dusk.",
    image: visuals.pageHomeHero,
    objectPosition: "center 42%",
    imageOpacity: "opacity-[0.78]",
    align: "left",
    tone: "dark",
    hideSideSignals: true,
    scrims: [
      "bg-gradient-to-r from-background via-background/85 to-background/20 sm:to-transparent",
      "bg-gradient-to-b from-background/55 via-transparent to-background",
    ],
  },
  {
    id: "expressway-dusk",
    label: "3 · Expressway dusk",
    blurb: "Lotus Tower + light-trail expressway — SUV right, brand left.",
    image: visuals.pageHomeHeroDusk,
    // Bias right so the blue SUV stays in frame; left sky stays open for type
    objectPosition: "68% 42%",
    imageOpacity: "opacity-[0.88]",
    align: "left",
    tone: "dark",
    hideSideSignals: true,
    scrims: [
      "bg-gradient-to-r from-background/92 via-background/55 to-background/10 sm:to-transparent",
      "bg-gradient-to-b from-background/45 via-transparent to-background/90",
    ],
  },
  {
    id: "orange-sunset",
    label: "4 · Orange sunset",
    blurb: "Luxury Colombo waterfront — left headline, car on the right.",
    image: visuals.alt2HeroOrangeSunset,
    objectPosition: "center 40%",
    imageOpacity: "opacity-[0.9]",
    align: "left",
    tone: "golden",
    hideSideSignals: true,
    scrims: [
      "bg-gradient-to-r from-background/94 via-background/72 to-background/10 sm:to-transparent",
      "bg-gradient-to-b from-background/35 via-transparent to-background/80",
    ],
  },
  {
    id: "ultrawide-day",
    label: "5 · Ultrawide day",
    blurb: "Bright bay panorama + red supercar — airy left space.",
    image: visuals.alt2HeroUltrawidePanorama,
    // Bias right so the car stays visible; slightly left of 68% on narrow crops
    objectPosition: "62% 42%",
    imageOpacity: "opacity-[0.86]",
    align: "left",
    tone: "light",
    hideSideSignals: true,
    scrims: [
      // Lighter left wash — photo stays dominant; type uses text-shadow for contrast
      "bg-gradient-to-r from-background/82 via-background/45 to-transparent",
      "bg-gradient-to-b from-background/25 via-transparent to-background/90",
    ],
  },
  {
    id: "blueprint",
    label: "6 · Blueprint intel",
    blurb: "CAD wireframe SUV — tech/data mood for intelligence brand.",
    image: visuals.alt2PageFeaturesBg,
    objectPosition: "left center",
    imageOpacity: "opacity-[0.92]",
    align: "right",
    tone: "dark",
    hideSideSignals: true,
    scrims: [
      "bg-gradient-to-l from-background/30 via-background/75 to-background/95",
      "bg-gradient-to-b from-background/50 via-transparent to-background",
    ],
  },
];

export const DEFAULT_HERO_VARIANT_ID: HeroVariantId = "expressway-dusk";

const STORAGE_KEY = "motormila.hero_variant.v3";

export function isHeroVariantId(value: string | null | undefined): value is HeroVariantId {
  return Boolean(value && HERO_VARIANTS.some((v) => v.id === value));
}

export function getHeroVariant(id: HeroVariantId): HeroVariant {
  return HERO_VARIANTS.find((v) => v.id === id) ?? HERO_VARIANTS[0];
}

export function readStoredHeroVariantId(): HeroVariantId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isHeroVariantId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function storeHeroVariantId(id: HeroVariantId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore quota */
  }
}
