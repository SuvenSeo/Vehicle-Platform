import { SURCHARGE_EXPIRY_ISO, getSurchargeCountdown } from "@/lib/importTaxModel";

const SURCHARGE_NOTIFY_KEY = "motormila.surcharge_lapse_notify.v1";

export interface SurchargeNotifyPreference {
  subscribed: boolean;
  subscribed_at: string;
  expiry_iso: string;
  /** Set once we've surfaced the post-lapse toast so we don't spam. */
  notified_at?: string;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readPreference(): SurchargeNotifyPreference | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SURCHARGE_NOTIFY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SurchargeNotifyPreference>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      subscribed: Boolean(parsed.subscribed),
      subscribed_at: String(parsed.subscribed_at || ""),
      expiry_iso: String(parsed.expiry_iso || SURCHARGE_EXPIRY_ISO),
      notified_at: parsed.notified_at ? String(parsed.notified_at) : undefined,
    };
  } catch {
    return null;
  }
}

function writePreference(pref: SurchargeNotifyPreference): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(SURCHARGE_NOTIFY_KEY, JSON.stringify(pref));
  } catch {
    // Private browsing / quota — ignore.
  }
}

export function isSurchargeNotifySubscribed(): boolean {
  return Boolean(readPreference()?.subscribed);
}

export function subscribeSurchargeLapseNotify(now: Date = new Date()): SurchargeNotifyPreference {
  const pref: SurchargeNotifyPreference = {
    subscribed: true,
    subscribed_at: now.toISOString(),
    expiry_iso: SURCHARGE_EXPIRY_ISO,
  };
  writePreference(pref);
  return pref;
}

export function unsubscribeSurchargeLapseNotify(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(SURCHARGE_NOTIFY_KEY);
  } catch {
    // ignore
  }
}

/**
 * If the user asked to be notified and the gazetted surcharge window has
 * ended, return a one-shot message and mark the preference as notified.
 * Returns null when there is nothing to show.
 */
export function consumeSurchargeLapseNotification(now: Date = new Date()): string | null {
  const pref = readPreference();
  if (!pref?.subscribed || pref.notified_at) return null;

  const countdown = getSurchargeCountdown(now);
  if (!countdown.expired) return null;

  writePreference({
    ...pref,
    notified_at: now.toISOString(),
  });

  return `The 50% CID surcharge's gazetted period ended on ${countdown.expiryLabel}. Recalculate landed cost without the surcharge before you commit an import.`;
}
