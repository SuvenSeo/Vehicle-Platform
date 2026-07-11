// Dynamic sitemap for /listing/:id pages, referenced from robots.txt.
// Pulls recent listing IDs from the backend and renders a standard urlset.

const SITE_ORIGIN = "https://vehicle-platform-one.vercel.app";
const DEFAULT_BACKEND = "https://seo292-vehicle-platform-backend.hf.space/api/v1";
const FETCH_TIMEOUT_MS = 9000;

function apiBase() {
  const configured = String(process.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
  if (!configured) return DEFAULT_BACKEND;
  if (configured.endsWith("/api") || configured.endsWith("/api/v1")) return configured;
  return `${configured}/api/v1`;
}

async function fetchListingIds() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase()}/listings/sitemap-ids?limit=5000`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function toLastmod(value) {
  const parsed = new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  const rows = await fetchListingIds();

  const urls = rows
    .filter((row) => Number.isInteger(Number(row?.id)) && Number(row.id) > 0)
    .map((row) => {
      const lastmod = toLastmod(row.last_seen_at);
      return [
        "  <url>",
        `    <loc>${SITE_ORIGIN}/listing/${Number(row.id)}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  // Cache 6h on success; retry sooner when the backend gave us nothing.
  res.setHeader(
    "Cache-Control",
    rows.length > 0 ? "public, s-maxage=21600, stale-while-revalidate=86400" : "public, s-maxage=300",
  );
  res.status(200).send(xml);
}
