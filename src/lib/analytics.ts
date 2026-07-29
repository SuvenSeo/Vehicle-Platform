import { API_BASE } from "@/services/api";

const SESSION_KEY = "mm_session_id";

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "";
  }
}

/**
 * Fire-and-forget product analytics event.
 *
 * Sends to POST /api/v1/events in the background. Never throws — a failed
 * analytics call must never break the UX that triggered it.
 */
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  const payload: Record<string, unknown> = { event: name };
  if (props && Object.keys(props).length > 0) payload.properties = props;
  const sid = getSessionId();
  if (sid) payload.session_id = sid;

  try {
    fetch(`${API_BASE}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Swallow all errors — analytics must never surface to the user.
  }
}
