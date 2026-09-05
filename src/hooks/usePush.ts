import { useCallback, useEffect, useState } from "react";
import { subscribePushEndpoint, unsubscribePushEndpoint } from "@/services/api";
import { trackEvent } from "@/lib/analytics";

const SW_PATH = "/sw-push.js";
const SUB_STORAGE_KEY = "motormila.push_subscribed";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function readStoredSub(): boolean {
  try {
    return window.localStorage?.getItem(SUB_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export interface UsePushResult {
  supported: boolean;
  subscribed: boolean;
  subscribing: boolean;
  pushConfigured: boolean | null;
  vapidMissing: boolean;
  error: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
}

/**
 * Web-push (VAPID) subscription hook. Secrets-gated + fail-open: when
 * VITE_VAPID_PUBLIC_KEY is missing, SW/push is unsupported, or subscribe
 * fails, callers fall back to in-app delivery.
 *
 * Service-worker registration snippet (do NOT put build logic in
 * vite.config.ts — public/sw-push.js is served as-is):
 *
 *   if ("serviceWorker" in navigator) {
 *     await navigator.serviceWorker.register("/sw-push.js");
 *   }
 */
export function usePush(): UsePushResult {
  const [supported] = useState<boolean>(() => {
    try {
      return (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
      );
    } catch {
      return false;
    }
  });
  const [subscribed, setSubscribed] = useState<boolean>(() => readStoredSub());
  const [subscribing, setSubscribing] = useState(false);
  const [pushConfigured, setPushConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vapidKey = String(import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim();
  const vapidMissing = !vapidKey;

  // Reflect an existing SW push subscription on mount (best-effort).
  useEffect(() => {
    if (!supported || vapidMissing) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled && sub) {
          setSubscribed(true);
          try {
            window.localStorage?.setItem(SUB_STORAGE_KEY, "1");
          } catch {
            // ignore storage errors
          }
        }
      } catch {
        // fail open — in-app still works
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, vapidMissing]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!supported || vapidMissing) {
      setError("push-unavailable");
      return false;
    }
    setSubscribing(true);
    try {
      const reg = await navigator.serviceWorker.register(SW_PATH);
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("push-denied");
        return false;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const raw = sub.toJSON();
      const receipt = await subscribePushEndpoint({
        endpoint: sub.endpoint,
        p256dh: raw.keys?.p256dh,
        auth: raw.keys?.auth,
      });
      setPushConfigured(receipt.push_configured);
      setSubscribed(true);
      try {
        window.localStorage?.setItem(SUB_STORAGE_KEY, "1");
      } catch {
        // ignore storage errors
      }
      trackEvent("push_subscribed", { topic: "price-drops" });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "push-failed");
      return false;
    } finally {
      setSubscribing(false);
    }
  }, [supported, vapidMissing, vapidKey]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      if (sub) await sub.unsubscribe();
      if (endpoint) await unsubscribePushEndpoint(endpoint).catch(() => undefined);
    } catch {
      // fail silently — push is non-critical
    } finally {
      setSubscribed(false);
      try {
        window.localStorage?.removeItem(SUB_STORAGE_KEY);
      } catch {
        // ignore storage errors
      }
      trackEvent("push_unsubscribed", {});
    }
  }, []);

  return {
    supported: supported && !vapidMissing,
    subscribed,
    subscribing,
    pushConfigured,
    vapidMissing,
    error,
    subscribe,
    unsubscribe,
  };
}
