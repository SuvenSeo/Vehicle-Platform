import { Check, Globe, Monitor, MoonStar } from "lucide-react";
import { motion } from "framer-motion";
import { useAppPreferences } from "@/lib/appPreferences";
import { PageBody } from "@/components/PageBody";
import { PageCanvas } from "@/components/PageCanvas";
import { PageHero } from "@/components/PageHero";
import { revealItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

type LangOpt = { value: "en" | "si" | "ta"; key: string; fallback: string; hint: string };
const LANGS: LangOpt[] = [
  { value: "en", key: "language.en", fallback: "English", hint: "Default product language" },
  { value: "si", key: "language.si", fallback: "Sinhala", hint: "Localized Sinhala labels" },
  { value: "ta", key: "language.ta", fallback: "Tamil", hint: "Localized Tamil labels" },
];

export default function Settings() {
  const { language, setLanguage, t } = useAppPreferences();

  return (
    <PageCanvas ambient="subtle">
      <PageHero
        theme="settings"
        eyebrow="Preferences"
        eyebrowIcon={Globe}
        watermarkIcon={MoonStar}
        title={t("settings.title", "Personalize Motormila")}
        description="Language, theme, and display preferences."
        highlights={[
          { label: "Languages", value: "3", hint: "English, Sinhala, Tamil" },
          { label: "Theme", value: "Auto", hint: "Light or dark display" },
          { label: "Locale", value: "Live", hint: "Labels across the app" },
        ]}
      />

      <PageBody narrow>
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Language — featured, primary preference */}
          <motion.div variants={revealItem} className="surface lg:col-span-7 p-6 sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-foreground">{t("ui.language", "Language")}</h2>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Display labels</p>
              </div>
            </div>
            <div className="space-y-2">
              {LANGS.map((o) => {
                const active = language === o.value;
                return (
                  <button key={o.value} type="button" onClick={() => setLanguage(o.value)} aria-pressed={active}
                    className={cn("flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.99]",
                      active
                        ? "border-primary/30 bg-primary/10 text-foreground shadow-soft"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-surface"
                    )}
                  >
                    <span>
                      <span className="block text-[13px] font-bold">{t(o.key, o.fallback)}</span>
                      <span className="block text-[11px] text-muted-foreground font-medium">{o.hint}</span>
                    </span>
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border transition-all", active ? "border-primary bg-primary/10 text-primary-bright" : "border-border text-transparent")}>
                      <Check className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Theme */}
          <motion.div variants={revealItem} className="surface lg:col-span-5 p-6 sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface">
                <Monitor className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-foreground">{t("ui.theme", "Theme")}</h2>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Visual style</p>
              </div>
            </div>

            {/* Decorative theme preview */}
            <div aria-hidden className="mb-4 flex h-24 items-end gap-2 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/12 via-card to-background p-3">
              <div className="h-2.5 w-14 rounded-full bg-foreground/20" />
              <div className="ml-auto flex h-full flex-col justify-between">
                <MoonStar className="h-4 w-4 text-primary-bright" />
                <div className="space-y-1.5">
                  <div className="h-1.5 w-16 rounded-full bg-foreground/15" />
                  <div className="h-1.5 w-10 rounded-full bg-foreground/10" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 shadow-soft">
              <span className="flex items-center gap-2.5">
                <MoonStar className="h-4 w-4 text-primary" />
                <span>
                  <span className="block text-[13px] font-bold text-foreground">{t("theme.dark", "Dark")}</span>
                  <span className="block text-[11px] text-muted-foreground font-medium">
                    Motormila is dark-only for now — a light theme is in development.
                  </span>
                </span>
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary bg-primary/10 text-primary-bright">
                <Check className="h-3 w-3" />
              </span>
            </div>
          </motion.div>
        </div>
      </PageBody>
    </PageCanvas>
  );
}
