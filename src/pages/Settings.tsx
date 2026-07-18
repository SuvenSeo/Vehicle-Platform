import { Check, Globe, Monitor, MoonStar } from "lucide-react";
import { motion } from "framer-motion";
import { useAppPreferences } from "@/lib/appPreferences";
import { revealContainer, revealItem } from "@/lib/motion";
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
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[10%] right-[-10%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-15%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[90px] pointer-events-none" />

      {/* Hero */}
      <motion.section variants={revealItem} className="relative z-10 border-b border-border bg-surface/50 backdrop-blur-xl">
        <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-6 sm:py-20 lg:py-24">
          <p className="inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-primary-bright">
            <span aria-hidden className="h-1 w-1 rounded-full bg-primary-bright" />
            Preferences
          </p>
          <h1 className="mt-5 display-hero text-foreground">
            {t("settings.title", "Personalize MilaMark")}
          </h1>
          <p className="mt-5 max-w-xl text-body-lg">Language, theme, and display preferences.</p>
        </div>
      </motion.section>

      <div className="mx-auto max-w-5xl px-5 py-14 sm:px-6 lg:py-20 relative z-10">
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
                    MilaMark is dark-only for now — a light theme is in development.
                  </span>
                </span>
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary bg-primary/10 text-primary-bright">
                <Check className="h-3 w-3" />
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
