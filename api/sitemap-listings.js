// Chunked dynamic sitemap for /listing/:id pages.
// Without ?page= returns a sitemap index; ?page=N returns one urlset chunk.

const SITE_ORIGIN = "https://vehicle-platform-one.vercel.app";
const DEFAULT_BACKEND = "https://seo292-vehicle-platform-backend.hf.space/api/v1";
const PAGE_SIZE = 5000;
const FETCH_TIMEOUT_MS = 9000;

function apiBase() {
  const configured = String(process.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
  if (!configured) return DEFAULT_BACKEND;
  if (configured.endsWith("/api") || configured.endsWith("/api/v1")) return configured;
  return `${configured}/api/v1`;
}

async function fetchJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase()}${path}`, {
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

async function fetchListingIds(page) {
  const offset = (page - 1) * PAGE_SIZE;
  const rows = await fetchJson(`/listings/sitemap-ids?limit=${PAGE_SIZE}&offset=${offset}`);
  return Array.isArray(rows) ? rows : [];
}

async function fetchSitemapMeta() {
  const meta = await fetchJson("/listings/sitemap-count");
  const total = Number(meta?.total || 0);
  const pageSize = Number(meta?.page_size || PAGE_SIZE);
  const pages = total > 0 ? Math.ceil(total / pageSize) : 1;
  return { total, pageSize, pages };
}

function toLastmod(value) {
  const parsed = new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function renderUrlset(rows) {
  const urls = rows
    .filter((row) => Number.isInteger(Number(row?.id)) && Number(row.id) > 0)
    .map((row) => {
      // Prefer content_updated_at (price/status change) over re-sight last_seen_at
      // so Google only re-crawls when the page meaningfully changed.
      const lastmod = toLastmod(
        row.content_updated_at || row.first_seen_at || row.last_seen_at,
      );
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

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function renderSitemapIndex(pages) {
  const entries = Array.from({ length: pages }, (_, index) => {
    const page = index + 1;
    return [
      "  <sitemap>",
      `    <loc>${SITE_ORIGIN}/api/sitemap-listings?page=${page}</loc>`,
      "  </sitemap>",
    ].join("\n");
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;
}

export default async function handler(req, res) {
  const rawPage = String(req.query?.page || "").trim();
  const page = rawPage ? Number.parseInt(rawPage, 10) : 0;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");

  if (!rawPage || !Number.isFinite(page) || page < 1) {
    const { pages } = await fetchSitemapMeta();
    const xml = renderSitemapIndex(Math.max(1, pages));
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).send(xml);
  }

  const rows = await fetchListingIds(page);
  const xml = renderUrlset(rows);
  res.setHeader(
    "Cache-Control",
    rows.length > 0 ? "public, s-maxage=21600, stale-while-revalidate=86400" : "public, s-maxage=300",
  );
  return res.status(200).send(xml);
}
