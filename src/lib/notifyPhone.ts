/** Lightweight WhatsApp / mobile validation for alert notify_phone. */

export function normalizeNotifyPhoneDigits(raw: string): string {
  return (raw || "").trim().replace(/[^\d+]/g, "");
}

/**
 * Accept optional empty values. Otherwise require a plausible SL mobile
 * (07XXXXXXXX / +947XXXXXXXX) or E.164-ish international (+ and 10–15 digits).
 */
export function isValidNotifyPhone(raw: string): boolean {
  const trimmed = (raw || "").trim();
  if (!trimmed) return true;

  const digits = normalizeNotifyPhoneDigits(trimmed);
  if (!digits) return false;

  if (digits.startsWith("+")) {
    const body = digits.slice(1);
    return /^\d{10,15}$/.test(body);
  }

  // Local Sri Lanka mobiles: 07XXXXXXXX
  if (/^0\d{9}$/.test(digits)) return true;

  // Country code without plus: 947XXXXXXXX
  if (/^94\d{9}$/.test(digits)) return true;

  // Bare international without +: 10–15 digits
  return /^\d{10,15}$/.test(digits);
}
