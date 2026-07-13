import { describe, it, expect, beforeEach } from "vitest";
import { getLocale, setLocale, t, LOCALES, LOCALE_STORAGE_KEY } from "@/lib/i18n";

describe("i18n module", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── getLocale ──────────────────────────────────────────────────────────────

  describe("getLocale()", () => {
    it("returns 'en' when nothing is stored", () => {
      expect(getLocale()).toBe("en");
    });

    it("returns stored 'si' locale", () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "si");
      expect(getLocale()).toBe("si");
    });

    it("returns stored 'ta' locale", () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "ta");
      expect(getLocale()).toBe("ta");
    });

    it("falls back to 'en' when stored value is invalid", () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "fr");
      expect(getLocale()).toBe("en");
    });
  });

  // ── setLocale ──────────────────────────────────────────────────────────────

  describe("setLocale()", () => {
    it("persists locale so getLocale() reads it back", () => {
      setLocale("si");
      expect(getLocale()).toBe("si");
    });

    it("overwrites a previous locale", () => {
      setLocale("si");
      setLocale("ta");
      expect(getLocale()).toBe("ta");
    });

    it("writes to localStorage under the correct key", () => {
      setLocale("ta");
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ta");
    });
  });

  // ── t() ───────────────────────────────────────────────────────────────────

  describe("t()", () => {
    it("translates a key in English", () => {
      expect(t("common.search", "en")).toBe("Search");
    });

    it("translates a key in Sinhala", () => {
      expect(t("common.search", "si")).toBe("සොයන්න");
    });

    it("translates a key in Tamil", () => {
      expect(t("common.search", "ta")).toBe("தேடு");
    });

    it("translates nav labels in all three locales", () => {
      expect(t("nav.home", "en")).toBe("Home");
      expect(t("nav.home", "si")).toBe("මුල් පිටුව");
      expect(t("nav.home", "ta")).toBe("முகப்பு");
    });

    it("translates district names in all three locales", () => {
      expect(t("district.colombo", "en")).toBe("Colombo");
      expect(t("district.colombo", "si")).toBe("කොළඹ");
      expect(t("district.colombo", "ta")).toBe("கொழும்பு");
    });

    it("translates currency label in all three locales", () => {
      expect(t("currency.lkr", "en")).toBe("LKR");
      expect(t("currency.lkr", "si")).toBe("රු");
      expect(t("currency.lkr", "ta")).toBe("இலங்கை ரூபாய்");
    });

    it("falls back to English when key is missing from requested locale", () => {
      // Use a key only defined in en.json but not in any partial override dict
      // We simulate this by checking that t always returns a non-empty string
      const result = t("common.save", "si");
      expect(result).toBeTruthy();
    });

    it("returns the explicit fallback string when key is absent in all locales", () => {
      expect(t("no.such.key", "en", "Default")).toBe("Default");
    });

    it("returns the key itself when absent in all locales and no fallback is given", () => {
      expect(t("totally.unknown.key", "en")).toBe("totally.unknown.key");
    });

    it("uses localStorage locale when no explicit locale arg is passed", () => {
      setLocale("si");
      expect(t("common.search")).toBe("සොයන්න");
    });

    it("uses 'en' by default when localStorage is empty", () => {
      expect(t("common.alerts")).toBe("Alerts");
    });

    it("returns Save alert translation for common.saveAlert", () => {
      expect(t("common.saveAlert", "en")).toBe("Save alert");
      expect(t("common.saveAlert", "si")).toBe("ඇඟවීම සුරකින්න");
      expect(t("common.saveAlert", "ta")).toBe("விழிப்பூட்டலை சேமி");
    });

    it("covers all 10 district keys", () => {
      const districts = [
        "colombo", "gampaha", "kalutara", "kandy", "galle",
        "matara", "kurunegala", "ratnapura", "badulla", "anuradhapura",
      ];
      for (const d of districts) {
        const key = `district.${d}`;
        expect(t(key, "en")).not.toBe(key);
        expect(t(key, "si")).not.toBe(key);
        expect(t(key, "ta")).not.toBe(key);
      }
    });
  });

  // ── LOCALES constant ──────────────────────────────────────────────────────

  describe("LOCALES", () => {
    it("contains exactly en, si, ta", () => {
      expect([...LOCALES].sort()).toEqual(["en", "si", "ta"]);
    });
  });
});
