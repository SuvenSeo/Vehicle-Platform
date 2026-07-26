import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DEFAULT_HERO_VARIANT_ID,
  HERO_VARIANTS,
  getHeroVariant,
  isHeroVariantId,
  readStoredHeroVariantId,
  storeHeroVariantId,
  type HeroVariant,
  type HeroVariantId,
} from "@/lib/heroVariants";

/**
 * Local-only hero A/B lab. Enabled in Vite DEV (or when `?heroLab=1`).
 * Persists pick in localStorage; also accepts `?hero=<id>`.
 */
export function useHeroVariantLab(): {
  variant: HeroVariant;
  setVariantId: (id: HeroVariantId) => void;
  showPicker: boolean;
} {
  const [params, setParams] = useSearchParams();
  const showPicker = import.meta.env.DEV || params.get("heroLab") === "1";

  const paramId = params.get("hero");
  const initial =
    (isHeroVariantId(paramId) ? paramId : null) ??
    readStoredHeroVariantId() ??
    DEFAULT_HERO_VARIANT_ID;

  const [variantId, setVariantIdState] = useState<HeroVariantId>(initial);

  useEffect(() => {
    if (isHeroVariantId(paramId) && paramId !== variantId) {
      setVariantIdState(paramId);
      storeHeroVariantId(paramId);
    }
  }, [paramId, variantId]);

  const setVariantId = (id: HeroVariantId) => {
    setVariantIdState(id);
    storeHeroVariantId(id);
    const next = new URLSearchParams(params);
    next.set("hero", id);
    setParams(next, { replace: true });
  };

  return {
    variant: getHeroVariant(variantId),
    setVariantId,
    showPicker,
  };
}

export function HeroVariantPicker({
  activeId,
  onSelect,
}: {
  activeId: HeroVariantId;
  onSelect: (id: HeroVariantId) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[80] flex justify-center sm:left-auto sm:right-4 sm:justify-end">
      <div className="pointer-events-auto max-w-md rounded-2xl border border-border bg-card/95 p-3 shadow-soft-xl backdrop-blur-xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Hero lab · local only
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Local preview only. Production ships <code className="text-foreground">expressway-dusk</code>.
        </p>
        <div className="mt-2 grid max-h-[42vh] gap-1.5 overflow-y-auto pr-1">
          {HERO_VARIANTS.map((v) => {
            const active = v.id === activeId;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v.id)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-primary/50 bg-primary/10"
                    : "border-border bg-background/60 hover:border-primary/30 hover:bg-surface"
                }`}
              >
                <span className="block text-[12px] font-bold text-foreground">{v.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{v.blurb}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
