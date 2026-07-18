// Serves real Open Graph meta for /listing/:id to social crawlers.
//
// WhatsApp/Facebook/Twitter fetch link previews without executing JS, so the
// SPA's client-side RouteMeta never reaches them. vercel.json rewrites
// crawler user-agents on /listing/:id to this function; humans keep getting
// the SPA. The page also meta-refreshes to the SPA route as a fallback for
// anything that renders it.

const SITE_ORIGIN = "https://vehicle-platform-one.vercel.app";
const DEFAULT_BACKEND = "https://seo292-vehicle-platform-backend.hf.space/api/v1";
const FETCH_TIMEOUT_MS = 8000;

function apiBase() {
  const configured = String(process.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
  if (!configured) return DEFAULT_BACKEND;
  if (configured.endsWith("/api") || configured.endsWith("/api/v1")) return configured;
  return `${configured}/api/v1`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPriceLkr(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 100_000) return null;
  return `Rs. ${(numeric / 1_000_000).toFixed(2)}M`;
}

async function fetchListing(id) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase()}/listings/${id}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function renderPage({ title, description, image, url }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = escapeHtml(image);
  const u = escapeHtml(url);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${u}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Motormila" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${u}" />
<meta property="og:image" content="${img}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />
<meta http-equiv="refresh" content="0;url=${u}" />
</head>
<body>
<p><a href="${u}">${t}</a></p>
</body>
</html>`;
}

export default async function handler(req, res) {
  const id = String(req.query?.id || "").trim();
  const listingUrl = `${SITE_ORIGIN}/listing/${encodeURIComponent(id)}`;

  let title = "Vehicle Listing — Motormila";
  let description =
    "Track Sri Lankan vehicle prices, trends, deal signals, and valuation tools in one market intelligence cockpit.";
  let image = `${SITE_ORIGIN}/og-card.jpg`;

  if (/^\d+$/.test(id)) {
    const listing = await fetchListing(id);
    if (listing && (listing.make || listing.title)) {
      const name = [listing.year, listing.make, listing.model].filter(Boolean).join(" ") || listing.title;
      const price = formatPriceLkr(listing.price_lkr);
      title = `${name}${price ? ` — ${price}` : ""} | Motormila`;

      const parts = [];
      if (price) parts.push(price);
      else parts.push("Price unavailable");
      if (listing.district) parts.push(String(listing.district));
      if (Number.isFinite(Number(listing.mileage)) && Number(listing.mileage) > 0) {
        parts.push(`${Number(listing.mileage).toLocaleString()} km`);
      }
      if (listing.fuel_type) parts.push(String(listing.fuel_type));
      if (listing.source) parts.push(`via ${listing.source}`);
      description = `${parts.join(" · ")} — live market data on Motormila.`;

      const thumb = String(listing.thumbnail_url || "").trim();
      if (/^https:\/\//.test(thumb)) image = thumb;
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(renderPage({ title, description, image, url: listingUrl }));
}
