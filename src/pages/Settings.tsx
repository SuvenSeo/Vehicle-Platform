import { Check, ChevronRight, Globe, Monitor, MoonStar, SlidersHorizontal, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppPreferences } from "@/lib/appPreferences";
import { cn } from "@/lib/utils";
import { PlatformPageHero } from "@/components/PlatformPageHero";
import { PageCanvas } from "@/components/PageCanvas";
import { LiquidToggle } from "@/components/ui/liquid-toggle";

type LanguageOption = {
  value: "en" | "si" | "ta";
  key: string;
  fallback: string;
  hint: string;
};

type ThemeOption = {
  value: "system" | "dark" | "light";
  key: string;
  fallback: string;
  hint: string;
  Icon: typeof Monitor;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    value: "en",
    key: "language.en",
    fallback: "English",
    hint: "Default product language",
  },
  {
    value: "si",
    key: "language.si",
    fallback: "Sinhala",
    hint: "Localized Sinhala labels",
  },
  {
    value: "ta",
    key: "language.ta",
    fallback: "Tamil",
    hint: "Localized Tamil labels",
  },
];

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "dark",
    key: "theme.dark",
    fallback: "Dark",
    hint: "Default high-contrast workspace",
    Icon: MoonStar,
  },
  {
    value: "system",
    key: "theme.system",
    fallback: "System",
    hint: "Match your device preference",
    Icon: Monitor,
  },
  {
    value: "light",
    key: "theme.light",
    fallback: "Light",
    hint: "Bright workspace style",
    Icon: Sun,
  },
];

export default function Settings() {
  const { language, setLanguage, themeMode, setThemeMode, resolvedTheme, t } = useAppPreferences();

  return (
    <PageCanvas>
      <PlatformPageHero
        eyebrow={t("nav.settings", "Settings")}
        title={t("settings.title", "Personalize AutoLens")}
        description={t(
          "settings.subtitle",
          "Move language and theme controls out of the main nav so the dashboard stays clean and focused.",
        )}
        icon={SlidersHorizontal}
        metrics={[
          { label: t("ui.language", "Language"), value: language.toUpperCase(), detail: "Display labels" },
          { label: t("ui.theme", "Theme"), value: resolvedTheme, detail: "Active theme" },
          { label: "Scope", value: "App", detail: "Saved preferences" },
        ]}
        actions={
          <Link
            to="/"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-label font-mono font-bold uppercase text-zinc-200 no-underline transition-colors hover:bg-white/[0.08]"
          >
            {t("settings.backToDashboard", "Back to dashboard")}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <section className="layout-shell pb-20 pt-10">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="page-panel rounded-xl p-6 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/35">
                  <Globe className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-zinc-300">
                    {t("ui.language", "Language")}
                  </h2>
                  <p className="text-xs text-zinc-500">{t("settings.languageHint", "Set display language for navigation and labels")}</p>
                </div>
              </div>

              <div className="space-y-2">
                {LANGUAGE_OPTIONS.map((option) => {
                  const active = language === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setLanguage(option.value)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-[border-color,background-color,color,box-shadow,transform,opacity]",
                        active
                          ? "border-amber-400/45 bg-amber-500/12 text-white"
                          : "border-white/10 bg-black/25 text-zinc-300 hover:border-white/20 hover:text-zinc-100",
                      )}
                      aria-pressed={active}
                    >
                      <span>
                        <span className="block text-sm font-semibold">{t(option.key, option.fallback)}</span>
                        <span className="block tech-label text-zinc-500">{option.hint}</span>
                      </span>
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full border",
                          active ? "border-amber-300/40 bg-amber-400/20 text-amber-200" : "border-white/10 text-transparent",
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="page-panel rounded-xl p-6 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/35">
                  <Monitor className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-zinc-300">{t("ui.theme", "Theme")}</h2>
                  <p className="text-xs text-zinc-500">{t("settings.themeHint", "Choose visual style for the entire app")}</p>
                </div>
              </div>

              <LiquidToggle
                checked={resolvedTheme === "dark"}
                onCheckedChange={(enabled) => setThemeMode(enabled ? "dark" : "light")}
                label={resolvedTheme === "dark" ? "Cinematic dark mode" : "Bright workspace mode"}
                description="Dark is the product default for new sessions; light and system preference remain available below."
                className="mb-3"
              />

              <div className="space-y-2">
                {THEME_OPTIONS.map((option) => {
                  const active = themeMode === option.value;
                  const Icon = option.Icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setThemeMode(option.value)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-[border-color,background-color,color,box-shadow,transform,opacity]",
                        active
                          ? "border-amber-400/45 bg-amber-500/12 text-white"
                          : "border-white/10 bg-black/25 text-zinc-300 hover:border-white/20 hover:text-zinc-100",
                      )}
                      aria-pressed={active}
                    >
                      <span className="inline-flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/25">
                          <Icon className="h-4 w-4 text-zinc-300" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">{t(option.key, option.fallback)}</span>
                          <span className="block tech-label text-zinc-500">{option.hint}</span>
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full border",
                          active ? "border-amber-300/40 bg-amber-400/20 text-amber-200" : "border-white/10 text-transparent",
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-5 rounded-xl border border-white/10 bg-black/25 px-4 py-3 tech-label text-zinc-500">
                {t("settings.activeTheme", "Active theme")}: <span className="text-zinc-200">{resolvedTheme}</span>
              </p>
            </section>
          </div>
        </div>
      </section>
    </PageCanvas>
  );
}
