import { Check, Globe, Monitor, MoonStar } from "lucide-react";
import { motion } from "framer-motion";
import { useAppPreferences } from "@/lib/appPreferences";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05
    }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 220,
      damping: 24
    }
  }
} as const;

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
      variants={containerVariants}
      className="min-h-screen relative overflow-hidden bg-background"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[10%] right-[-10%] w-[450px] h-[450px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-15%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[90px] pointer-events-none" />

      {/* Header */}
      <motion.section variants={itemVariants} className="border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-md relative z-10">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Preferences</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-tight leading-[1.05] text-white sm:text-[2.75rem] lg:text-[3rem]">
            {t("settings.title", "Personalize AutoLens")}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground font-medium">Language, theme, and display preferences.</p>
        </div>
      </motion.section>

      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-6 lg:py-10 relative z-10">
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Language */}
          <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 backdrop-blur-md">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
                <Globe className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <h2 className="text-[13px] font-bold text-white">{t("ui.language", "Language")}</h2>
                <p className="text-[10px] text-muted-foreground font-semibold">Display labels</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {LANGS.map((o) => {
                const active = language === o.value;
                return (
                  <button key={o.value} type="button" onClick={() => setLanguage(o.value)} aria-pressed={active}
                    className={cn("flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all",
                      active ? "border-primary/20 bg-primary/10 text-white" : "border-white/5 text-muted-foreground hover:border-primary/20 hover:text-white hover:bg-white/[0.02]"
                    )}
                  >
                    <span>
                      <span className="block text-[13px] font-bold">{t(o.key, o.fallback)}</span>
                      <span className="block text-[10px] text-muted-foreground font-medium">{o.hint}</span>
                    </span>
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border transition-all", active ? "border-primary bg-primary/10 text-primary" : "border-white/10 text-transparent")}>
                      <Check className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Theme */}
          <motion.div variants={itemVariants} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 backdrop-blur-md">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
                <Monitor className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <h2 className="text-[13px] font-bold text-white">{t("ui.theme", "Theme")}</h2>
                <p className="text-[10px] text-muted-foreground font-semibold">Visual style</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/10 px-3 py-2.5">
              <span className="flex items-center gap-2.5">
                <MoonStar className="h-3.5 w-3.5 text-primary" />
                <span>
                  <span className="block text-[13px] font-bold text-white">{t("theme.dark", "Dark")}</span>
                  <span className="block text-[10px] text-muted-foreground font-medium">
                    AutoLens is dark-only for now — a light theme is in development.
                  </span>
                </span>
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary bg-primary/10 text-primary">
                <Check className="h-3 w-3" />
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
