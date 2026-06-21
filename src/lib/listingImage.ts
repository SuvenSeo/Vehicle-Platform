const PLACEHOLDER_IMAGE_HOSTS = new Set([
  "placehold.co",
  "via.placeholder.com",
  "dummyimage.com",
  "placekitten.com",
]);

function isAbsoluteUrl(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

function normalizeBaseUrls(baseUrls: Array<unknown>): string[] {
  const normalized: string[] = [];

  for (const base of baseUrls) {
    if (typeof base !== "string") continue;
    const trimmed = base.trim();
    if (!trimmed) continue;

    const candidate = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
    if (!isAbsoluteUrl(candidate)) continue;

    try {
      normalized.push(new URL(candidate).toString());
    } catch {
      // Ignore malformed base URLs from source payloads.
    }
  }

  return normalized;
}

function getBaseOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost";
}

export function normalizeVehicleImageUrl(value: unknown): string | null {
  return normalizeVehicleImageUrlWithBase(value, []);
}

export function normalizeVehicleImageUrlWithBase(value: unknown, baseUrls: Array<unknown>): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;

  const baseCandidates = normalizeBaseUrls(baseUrls);
  const parseCandidates: string[] = [];

  if (trimmed.startsWith("//")) {
    parseCandidates.push(`https:${trimmed}`);
  } else if (isAbsoluteUrl(trimmed)) {
    parseCandidates.push(trimmed);
  } else {
    for (const base of baseCandidates) {
      parseCandidates.push(new URL(trimmed, base).toString());
    }
    parseCandidates.push(new URL(trimmed, getBaseOrigin()).toString());
  }

  for (const candidate of parseCandidates) {
    try {
      const parsed = new URL(candidate, getBaseOrigin());
      if (PLACEHOLDER_IMAGE_HOSTS.has(parsed.hostname.toLowerCase())) {
        continue;
      }
      return parsed.toString();
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

export function pickVehicleImageUrl(candidates: Array<unknown>, baseUrls: Array<unknown> = []): string | null {
  for (const candidate of candidates) {
    const normalized = normalizeVehicleImageUrlWithBase(candidate, baseUrls);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}
