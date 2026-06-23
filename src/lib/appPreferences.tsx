import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemeMode = "system" | "dark" | "light";
type Language = "en" | "si" | "ta";

type Dictionary = Record<string, string>;

type AppPreferencesContextValue = {
  themeMode: ThemeMode;
  resolvedTheme: "dark" | "light";
  setThemeMode: (mode: ThemeMode) => void;
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, fallback?: string) => string;
};

const THEME_STORAGE_KEY = "autolens_theme_mode";
const LANGUAGE_STORAGE_KEY = "autolens_language";
const DEFAULT_THEME_MODE: ThemeMode = "light";

const DICTIONARIES: Record<Language, Dictionary> = {
  en: {
    "ui.theme": "Theme",
    "ui.language": "Language",
    "theme.system": "System",
    "theme.dark": "Dark",
    "theme.light": "Light",
    "language.en": "English",
    "language.si": "Sinhala",
    "language.ta": "Tamil",

    "nav.overview": "Overview",
    "nav.quickInsights": "Quick Insights",
    "nav.trends": "Trends",
    "nav.market": "Market",
    "nav.map": "Map",
    "nav.valuation": "Valuation",
    "nav.aiValue": "AI Value",
    "nav.source": "Source",
    "nav.settings": "Settings",
    "nav.live": "Live",
    "nav.syncing": "Syncing",
    "nav.delayed": "Delayed",
    "nav.awaiting": "Awaiting sync",

    "settings.title": "Personalize AutoLens",
    "settings.subtitle": "Move language and theme controls out of the main nav so the dashboard stays clean and focused.",
    "settings.backToDashboard": "Back to dashboard",
    "settings.languageHint": "Set display language for navigation and labels",
    "settings.themeHint": "Choose visual style for the entire app",
    "settings.activeTheme": "Active theme",

    "hero.explore": "Explore Market",
    "hero.value": "Value my car",

    "valuation.title": "Custom Vehicle Valuation.",
    "valuation.subtitle": "Enter your vehicle details and compare against live listings.",
    "valuation.cta": "Value My Car",
    "valuation.loading": "Thinking...",
    "valuation.select": "Select",
    "valuation.selectDistrict": "Select District",
    "valuation.askingOptional": "Optional asking price",

    "valuation.field.brand": "Brand",
    "valuation.field.model": "Model",
    "valuation.field.condition": "Condition",
    "valuation.field.transmission": "Transmission",
    "valuation.field.fuel": "Fuel Type",
    "valuation.field.body": "Body Type",
    "valuation.field.year": "Year",
    "valuation.field.mileage": "Mileage (KM)",
    "valuation.field.district": "District",
    "valuation.field.asking": "Asking Price (LKR)",

    "valuation.result.caption": "Custom Vehicle Valuation",
    "valuation.ready": "Ready for Input",
    "valuation.marketVerdict": "Market verdict",
    "valuation.confidence": "confidence",
    "valuation.vsMarketMedian": "vs market median",
    "valuation.lowBand": "Low band",
    "valuation.medianBand": "Median band",
    "valuation.highBand": "High band",
    "valuation.comparableListings": "Comparable listings",
    "valuation.matches": "matches",
    "valuation.topComparables": "Top comparables",
    "valuation.liveListings": "Live listings",
    "valuation.priceUnavailable": "Price unavailable",
    "valuation.inputPrice": "Input Price",
    "valuation.openListing": "Open listing",
    "valuation.next.title": "What to do next",
    "valuation.next.path": "Action path",

    "valuation.next.list": "List Your Car",
    "valuation.next.listDesc": "Publish your ad on a major marketplace with your valuation range in hand.",
    "valuation.next.buyers": "Find Buyers Now",
    "valuation.next.buyersDesc": "Jump to matching listings in this app to benchmark and position your asking price.",
    "valuation.next.inspect": "Get Inspection",
    "valuation.next.inspectDesc": "Book a certified inspection and add the report to increase buyer trust.",

    "chat.tooltip.title": "Ask AutoLens Copilot",
    "chat.tooltip.subtitle": "Find, value, compare, and inspect cars",
    "chat.header.title": "AutoLens Copilot",
    "chat.header.status": "Live market assistant",
    "chat.intro": "Ask the market copilot before you decide.",
    "chat.introBody": "I can search live listings, explain fair value, compare options, surface deal risk, and read pipeline freshness.",
    "chat.placeholder": "Ask about budget, value, listings, or seller risk...",
    "chat.thinking": "Reading live market context...",
    "chat.error.serviceUnavailable": "AI service is temporarily unavailable. Please try again in a moment.",
    "chat.error.connection": "Connection issue. Please try again.",
    "chat.card.priceUnavailable": "Price unavailable",
    "chat.card.inputPrice": "Input Price",
    "chat.card.openListing": "Open Listing",
    "chat.card.source": "Source",
    "chat.copy": "Copy",
    "chat.copied": "Copied",
    "chat.enterHint": "Enter to send · Shift+Enter for new line",
    "chat.quick.snapshot": "Snapshot",
    "chat.quick.deals": "Best Deals",
    "chat.quick.clear": "Clear",
    "chat.quick.liveSnapshot": "Live Snapshot",
    "chat.quick.topDeals": "Top Deals",
    "chat.quick.toyota": "Toyota Trend",
    "chat.quick.colombo": "Colombo Prices",
    "chat.quick.honda": "Honda Pricing",
    "chat.quick.budget": "Budget Picks",
  },
  si: {
    "ui.theme": "තේමාව",
    "ui.language": "භාෂාව",
    "theme.system": "පද්ධති",
    "theme.dark": "අඳුරු",
    "theme.light": "ආලෝක",
    "language.en": "ඉංග්‍රීසි",
    "language.si": "සිංහල",
    "language.ta": "දෙමළ",

    "nav.overview": "සාරාංශය",
    "nav.quickInsights": "ඉක්මන් අවබෝධ",
    "nav.trends": "ප්‍රවණතා",
    "nav.market": "වෙළඳපොළ",
    "nav.map": "නක්ෂාය",
    "nav.valuation": "වටිනාකම",
    "nav.aiValue": "AI අගය",
    "nav.source": "මූලාශ්‍රය",
    "nav.settings": "සැකසුම්",
    "nav.live": "සජීවී",
    "nav.syncing": "සමමුහුර්ත කරමින්",
    "nav.delayed": "ප්‍රමාදයි",
    "nav.awaiting": "සමමුහුර්තය බලාසිටී",

    "hero.explore": "වෙළඳපොළ බලන්න",
    "hero.value": "මගේ කාර් වටිනාකම",

    "valuation.title": "අභිරුචි වාහන වටිනාකම.",
    "valuation.subtitle": "ඔබේ වාහනය ඇතුල් කර සජීවී ලැයිස්තු සමඟ සසඳන්න.",
    "valuation.cta": "වටිනාකම ගන්න",
    "valuation.loading": "ගණනය වෙමින්...",
    "valuation.select": "තෝරන්න",
    "valuation.selectDistrict": "දිස්ත්‍රික්කය තෝරන්න",
    "valuation.askingOptional": "විකිණීමේ මිල (විකල්ප)",

    "valuation.field.brand": "බ්‍රෑන්ඩ්",
    "valuation.field.model": "මාදිලිය",
    "valuation.field.condition": "තත්ත්වය",
    "valuation.field.transmission": "ගියර් පද්ධතිය",
    "valuation.field.fuel": "ඉන්ධන වර්ගය",
    "valuation.field.body": "බොඩි වර්ගය",
    "valuation.field.year": "වසර",
    "valuation.field.mileage": "දුර (KM)",
    "valuation.field.district": "දිස්ත්‍රික්කය",
    "valuation.field.asking": "ඉල්ලා සිටින මිල (LKR)",

    "valuation.result.caption": "අභිරුචි වාහන වටිනාකම",
    "valuation.ready": "තොරතුරු සඳහා සූදානම්",
    "valuation.marketVerdict": "වෙළඳපොළ තීරණය",
    "valuation.confidence": "විශ්වාසය",
    "valuation.vsMarketMedian": "වෙළඳපොළ මධ්‍යමයට සාපේක්ෂව",
    "valuation.lowBand": "පහළ පරාසය",
    "valuation.medianBand": "මධ්‍ය පරාසය",
    "valuation.highBand": "ඉහළ පරාසය",
    "valuation.comparableListings": "සසඳන ලැයිස්තු",
    "valuation.matches": "ගැලපීම්",
    "valuation.topComparables": "ඉහළ සසඳන දත්ත",
    "valuation.liveListings": "සජීවී ලැයිස්තු",
    "valuation.priceUnavailable": "මිල නොමැත",
    "valuation.inputPrice": "මිල ඇතුල් කරන්න",
    "valuation.openListing": "ලැයිස්තුව විවෘත කරන්න",
    "valuation.next.title": "ඊළඟට කරන්න",
    "valuation.next.path": "ක්‍රියා මාර්ගය",

    "valuation.next.list": "ඔබේ කාර්යය ලැයිස්තුගත කරන්න",
    "valuation.next.listDesc": "ඔබේ වටිනාකම පරාසය සමඟ ප්‍රධාන වෙළඳපොළක දැන්වීම පළ කරන්න.",
    "valuation.next.buyers": "ගැනුම්කරුවන් සොයන්න",
    "valuation.next.buyersDesc": "මෙම යෙදුමේ ගැළපෙන ලැයිස්තු බලලා ඔබේ මිල ස්ථාපනය කරන්න.",
    "valuation.next.inspect": "පරීක්ෂාවක් ගන්න",
    "valuation.next.inspectDesc": "සහතික පරීක්ෂාවක් කර වාර්තාව එකතු කර විශ්වාසය වැඩි කරන්න.",

    "chat.tooltip.title": "AutoLens Copilot අහන්න",
    "chat.tooltip.subtitle": "සජීවී වෙළඳපොළ මිල දැන්",
    "chat.header.title": "AutoLens Copilot",
    "chat.header.status": "Live market assistant",
    "chat.intro": "AutoLens Copilot සමඟ කතා කරන්න",
    "chat.introBody": "සජීවී snapshot, හොඳ deals, make trend, දිස්ත්‍රික්ක මිල ගැන අහන්න.",
    "chat.placeholder": "කාර් ගැන අහන්න...",
    "chat.thinking": "AutoLens සිතමින්...",
    "chat.error.serviceUnavailable": "AI සේවාව තාවකාලිකව නොමැත. කරුණාකර මොහොතකින් නැවත උත්සාහ කරන්න.",
    "chat.error.connection": "සම්බන්ධතා දෝෂයක්. කරුණාකර නැවත උත්සාහ කරන්න.",
    "chat.card.priceUnavailable": "මිල නොමැත",
    "chat.card.inputPrice": "මිල ඇතුල් කරන්න",
    "chat.card.openListing": "ලැයිස්තුව විවෘත කරන්න",
    "chat.card.source": "මූලාශ්‍රය",
    "chat.copy": "පිටපත්",
    "chat.copied": "පිටපත් කළා",
    "chat.enterHint": "යවන්න Enter · නව පේළියට Shift+Enter",
    "chat.quick.snapshot": "Snapshot",
    "chat.quick.deals": "හොඳ Deals",
    "chat.quick.clear": "මකන්න",
    "chat.quick.liveSnapshot": "Live Snapshot",
    "chat.quick.topDeals": "Top Deals",
    "chat.quick.toyota": "Toyota Trend",
    "chat.quick.colombo": "Colombo Prices",
    "chat.quick.honda": "Honda Pricing",
    "chat.quick.budget": "Budget Picks",
  },
  ta: {
    "ui.theme": "தீம்",
    "ui.language": "மொழி",
    "theme.system": "சிஸ்டம்",
    "theme.dark": "இருள்",
    "theme.light": "ஒளி",
    "language.en": "ஆங்கிலம்",
    "language.si": "சிங்களம்",
    "language.ta": "தமிழ்",

    "nav.overview": "கண்ணோட்டம்",
    "nav.quickInsights": "விரைவு பார்வைகள்",
    "nav.trends": "போக்குகள்",
    "nav.market": "சந்தை",
    "nav.map": "வரைபடம்",
    "nav.valuation": "மதிப்பீடு",
    "nav.aiValue": "AI மதிப்பு",
    "nav.source": "மூலம்",
    "nav.settings": "அமைப்புகள்",
    "nav.live": "நேரடி",
    "nav.syncing": "ஒத்திசைக்கிறது",
    "nav.delayed": "தாமதம்",
    "nav.awaiting": "ஒத்திசைவை காத்திருக்கிறது",

    "hero.explore": "சந்தையை பார்க்க",
    "hero.value": "என் காரை மதிப்பிடு",

    "valuation.title": "தனிப்பயன் வாகன மதிப்பீடு.",
    "valuation.subtitle": "உங்கள் வாகன விவரங்களை உள்ளிட்டு live listings-ஐ ஒப்பிடுங்கள்.",
    "valuation.cta": "வாகனத்தை மதிப்பிடு",
    "valuation.loading": "கணக்கிடுகிறது...",
    "valuation.select": "தேர்வு செய்",
    "valuation.selectDistrict": "மாவட்டத்தைத் தேர்வு செய்",
    "valuation.askingOptional": "கோரிக்கை விலை (விருப்பம்)",

    "valuation.field.brand": "பிராண்ட்",
    "valuation.field.model": "மாடல்",
    "valuation.field.condition": "நிலை",
    "valuation.field.transmission": "கியர் வகை",
    "valuation.field.fuel": "எரிபொருள் வகை",
    "valuation.field.body": "உடல் வகை",
    "valuation.field.year": "ஆண்டு",
    "valuation.field.mileage": "மைலேஜ் (KM)",
    "valuation.field.district": "மாவட்டம்",
    "valuation.field.asking": "கோரிக்கை விலை (LKR)",

    "valuation.result.caption": "தனிப்பயன் வாகன மதிப்பீடு",
    "valuation.ready": "உள்ளீட்டிற்கு தயாராக உள்ளது",
    "valuation.marketVerdict": "சந்தை தீர்ப்பு",
    "valuation.confidence": "நம்பிக்கை",
    "valuation.vsMarketMedian": "சந்தை மத்திய விலையுடன் ஒப்பிடுகையில்",
    "valuation.lowBand": "குறைந்த வரம்பு",
    "valuation.medianBand": "மத்திய வரம்பு",
    "valuation.highBand": "உயர் வரம்பு",
    "valuation.comparableListings": "ஒப்பிடத்தக்க பட்டியல்கள்",
    "valuation.matches": "பொருத்தங்கள்",
    "valuation.topComparables": "சிறந்த ஒப்பீடுகள்",
    "valuation.liveListings": "நேரடி பட்டியல்கள்",
    "valuation.priceUnavailable": "விலை இல்லை",
    "valuation.inputPrice": "விலையை உள்ளிடு",
    "valuation.openListing": "பட்டியலை திற",
    "valuation.next.title": "அடுத்து என்ன செய்யலாம்",
    "valuation.next.path": "செயல் பாதை",

    "valuation.next.list": "உங்கள் காரை பட்டியலிடுங்கள்",
    "valuation.next.listDesc": "உங்கள் மதிப்பீட்டு வரம்புடன் பெரிய சந்தையில் விளம்பரம் வெளியிடுங்கள்.",
    "valuation.next.buyers": "வாங்குபவர்களை கண்டுபிடி",
    "valuation.next.buyersDesc": "இந்த பயன்பாட்டில் பொருந்தும் பட்டியல்களைப் பார்த்து உங்கள் விலையை அமைக்கவும்.",
    "valuation.next.inspect": "ஆய்வு பெறுங்கள்",
    "valuation.next.inspectDesc": "சான்றளிக்கப்பட்ட ஆய்வு செய்து அறிக்கையை சேர்த்து நம்பிக்கையை உயர்த்துங்கள்.",

    "chat.tooltip.title": "AutoLens Copilot-ஐ கேளுங்கள்",
    "chat.tooltip.subtitle": "உடனடி live சந்தை விலை",
    "chat.header.title": "AutoLens Copilot",
    "chat.header.status": "Live market assistant",
    "chat.intro": "AutoLens Copilot உடன் பேசுங்கள்",
    "chat.introBody": "Live snapshot, top deals, trend, district pricing குறித்து கேளுங்கள்.",
    "chat.placeholder": "கார்கள் பற்றி கேளுங்கள்...",
    "chat.thinking": "AutoLens யோசிக்கிறது...",
    "chat.error.serviceUnavailable": "AI சேவை தற்காலிகமாக கிடைக்கவில்லை. சில நொடிகளில் மீண்டும் முயற்சிக்கவும்.",
    "chat.error.connection": "இணைப்பு சிக்கல். மீண்டும் முயற்சிக்கவும்.",
    "chat.card.priceUnavailable": "விலை இல்லை",
    "chat.card.inputPrice": "விலையை உள்ளிடு",
    "chat.card.openListing": "பட்டியலை திற",
    "chat.card.source": "மூலம்",
    "chat.copy": "நகலெடு",
    "chat.copied": "நகலெடுக்கப்பட்டது",
    "chat.enterHint": "அனுப்ப Enter · புதிய வரிக்கு Shift+Enter",
    "chat.quick.snapshot": "Snapshot",
    "chat.quick.deals": "Best Deals",
    "chat.quick.clear": "அழி",
    "chat.quick.liveSnapshot": "Live Snapshot",
    "chat.quick.topDeals": "Top Deals",
    "chat.quick.toyota": "Toyota Trend",
    "chat.quick.colombo": "Colombo Prices",
    "chat.quick.honda": "Honda Pricing",
    "chat.quick.budget": "Budget Picks",
  },
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

function resolveTheme(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }
  return mode;
}

function readStorage(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== "function") return null;
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    const storage = window.localStorage;
    if (!storage || typeof storage.setItem !== "function") return;
    storage.setItem(key, value);
  } catch {
    // Ignore storage errors (e.g. privacy mode, test mocks, blocked storage)
  }
}

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [language, setLanguageState] = useState<Language>("en");
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const savedTheme = (readStorage(THEME_STORAGE_KEY) as ThemeMode | null) || DEFAULT_THEME_MODE;
    const savedLanguage = (readStorage(LANGUAGE_STORAGE_KEY) as Language | null) || "en";
    setThemeModeState(savedTheme);
    setLanguageState(savedLanguage);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      const next = resolveTheme(themeMode);
      setResolvedTheme(next);
      root.classList.toggle("theme-light", next === "light");
      root.classList.toggle("theme-dark", next === "dark");
      root.style.colorScheme = next;
    };

    applyTheme();

    if (themeMode !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme();
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    writeStorage(THEME_STORAGE_KEY, mode);
  };

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    writeStorage(LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  const t = useMemo(() => {
    return (key: string, fallback?: string) => {
      const selected = DICTIONARIES[language][key];
      if (selected) return selected;
      const english = DICTIONARIES.en[key];
      if (english) return english;
      return fallback || key;
    };
  }, [language]);

  const value = useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      setThemeMode,
      language,
      setLanguage,
      t,
    }),
    [language, resolvedTheme, t, themeMode],
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error("useAppPreferences must be used inside AppPreferencesProvider");
  }
  return context;
}
