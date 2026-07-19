/**
 * Returns a safe absolute http(s) URL for use in href attributes, or null
 * when the value is missing, malformed, or uses a non-allowlisted scheme
 * (e.g. javascript:, data:, vbscript:).
 */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Protocol-relative URLs are treated as https.
  const candidate = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;

  try {
    const parsed = new URL(candidate);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}
