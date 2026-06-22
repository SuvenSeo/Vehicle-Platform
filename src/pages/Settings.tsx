import { Check, Globe, Monitor, MoonStar, Sun } from "lucide-react";
import { useAppPreferences } from "@/lib/appPreferences";
import { cn } from "@/lib/utils";
import { LiquidToggle } from "@/components/ui/liquid-toggle";

type LangOpt = { value: "en" | "si" | "ta"; key: string; fallback: string; hint: string };
type ThemeOpt = { value: "system" | "dark" | "light"; key: string; fallback: string; hint: string; Icon: typeof Monitor };

const LANGS: LangOpt[] = [
  { value: "en", key: "language.en", fallback: "English", hint: "Default product language" },
  { value: "si", key: "language.si", fallback: "Sinhala", hint: "Localized Sinhala labels" },
  { value: "ta", key: "language.ta", fallback: "Tamil", hint: "Localized Tamil labels" },
];

const THEMES: ThemeOpt[] = [
  { value: "dark", key: "theme.dark", fallback: "Dark", hint: "Default high-contrast workspace", Icon: MoonStar },
  { value: "system", key: "theme.system", fallback: "System", hint: "Match your device preference", Icon: Monitor },
  { value: "light", key: "theme.light", fallback: "Light", hint: "Bright workspace style", Icon: Sun },
];

export default function Settings() {
  const { language, setLanguage, themeMode, setThemeMode, resolvedTheme, t } = useAppPreferences();

  return (
    <div className="min-h-screen">
      <section className="border-b border-white/[0.04]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-6 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/70">Preferences</p>
          <h1 className="mt-3 font-display text-[2rem] font-bold tracking-[-0.035em] leading-[1.02] text-foreground sm:text-[2.75rem] lg:text-[3rem]">{t("settings.title", "Personalize AutoLens")}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-400">Language, theme, and display preferences.</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-6 lg:py-10">
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Language */}
          <div className="rounded-xl border border-white/[0.05] bg-[hsl(220,8%,6%)] p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <Globe className="h-3.5 w-3.5 text-amber-400/70" />
              </div>
              <div>
                <h2 className="text-[13px] font-semibold text-foreground">{t("ui.language", "Language")}</h2>
                <p className="text-[10px] text-zinc-500">Display labels</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {LANGS.map((o) => {
                const active = language === o.value;
                return (
                  <button key={o.value} type="button" onClick={() => setLanguage(o.value)} aria-pressed={active}
                    className={cn("flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors",
                      active ? "border-amber-400/20 bg-amber-400/5 text-foreground" : "border-white/[0.04] text-zinc-400 hover:border-white/[0.08] hover:text-zinc-200"
                    )}
                  >
                    <span>
                      <span className="block text-[13px] font-semibold">{t(o.key, o.fallback)}</span>
                      <span className="block text-[10px] text-zinc-500">{o.hint}</span>
                    </span>
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border", active ? "border-amber-400/30 bg-amber-400/15 text-amber-300" : "border-white/[0.06] text-transparent")}>
                      <Check className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme */}
          <div className="rounded-xl border border-white/[0.05] bg-[hsl(220,8%,6%)] p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <Monitor className="h-3.5 w-3.5 text-amber-400/70" />
              </div>
              <div>
                <h2 className="text-[13px] font-semibold text-foreground">{t("ui.theme", "Theme")}</h2>
                <p className="text-[10px] text-zinc-500">Visual style</p>
              </div>
            </div>

            <LiquidToggle
              checked={resolvedTheme === "dark"}
              onCheckedChange={(on) => setThemeMode(on ? "dark" : "light")}
              label={resolvedTheme === "dark" ? "Dark mode" : "Light mode"}
              description="Dark is the default for new sessions."
              className="mb-3"
            />

            <div className="space-y-1.5">
              {THEMES.map((o) => {
                const active = themeMode === o.value;
                const Icon = o.Icon;
                return (
                  <button key={o.value} type="button" onClick={() => setThemeMode(o.value)} aria-pressed={active}
                    className={cn("flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors",
                      active ? "border-amber-400/20 bg-amber-400/5 text-foreground" : "border-white/[0.04] text-zinc-400 hover:border-white/[0.08] hover:text-zinc-200"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-3.5 w-3.5 text-zinc-500" />
                      <span>
                        <span className="block text-[13px] font-semibold">{t(o.key, o.fallback)}</span>
                        <span className="block text-[10px] text-zinc-500">{o.hint}</span>
                      </span>
                    </span>
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border", active ? "border-amber-400/30 bg-amber-400/15 text-amber-300" : "border-white/[0.06] text-transparent")}>
                      <Check className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 rounded-lg border border-white/[0.04] bg-[hsl(220,8%,5%)] px-3 py-2 text-[10px] text-zinc-500">
              Active: <span className="font-semibold text-zinc-300">{resolvedTheme}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
