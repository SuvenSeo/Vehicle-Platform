import en from "@/locales/en.json";
import si from "@/locales/si.json";
import ta from "@/locales/ta.json";

export type Locale = "en" | "si" | "ta";

export const LOCALE_STORAGE_KEY = "autolens_language";

const CATALOGS: Record<Locale, Record<string, string>> = { en, si, ta };

const VALID_LOCALES: readonly Locale[] = ["en", "si", "ta"] as const;

function isLocale(value: string): value is Locale {
  return (VALID_LOCALES as readonly string[]).includes(value);
}

export function getLocale(): Locale {
  try {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocale(stored)) return stored;
  } catch {
    // Ignore storage errors (privacy mode, SSR, blocked storage)
  }
  return "en";
}

export function setLocale(locale: Locale): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Translates a key using the given locale (defaults to the locale stored in
 * localStorage). Falls back to English, then to `fallback`, then to the key
 * itself so the UI never renders an empty string.
 */
export function t(key: string, locale?: Locale, fallback?: string): string {
  const lang = locale ?? getLocale();
  return CATALOGS[lang][key] ?? CATALOGS.en[key] ?? fallback ?? key;
}

/** All locale codes supported by this application. */
export const LOCALES: readonly Locale[] = VALID_LOCALES;
