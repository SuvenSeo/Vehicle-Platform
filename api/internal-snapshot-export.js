// Temporary/internal snapshot exporter for egress recovery.
// Uses HOT_DATABASE_URL / DATABASE_URL available at Vercel runtime
// (Sensitive env vars are not readable via `vercel env pull`).
//
// Auth: Authorization: Bearer <SNAPSHOT_EXPORT_SECRET>
// or ?token=<SNAPSHOT_EXPORT_SECRET>
//
// Query:
//   kind=stats-summary|live-market|district-prices|listing-makes|listing-sources|listings|ping
//   cursor=<int> limit=<int>  (listings only)

import pg from "pg";
const { Client } = pg;

const MIN_PRICE = 100_000;

function dbUrl() {
  return (
    String(process.env.HOT_DATABASE_URL || "").trim() ||
    String(process.env.DATABASE_URL || "").trim() ||
    String(process.env.COLD_DATABASE_URL || "").trim()
  );
}

function authorized(req) {
  const secret = String(process.env.SNAPSHOT_EXPORT_SECRET || "").trim();
  if (!secret) return false;
  const header = String(req.headers.authorization || "");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(req.url, "http://localhost");
  return url.searchParams.get("token") === secret;
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { detail: "GET only" });
  }
  if (!authorized(req)) {
    return json(res, 401, { detail: "Unauthorized" });
  }

  const url = new URL(req.url, "http://localhost");
  const kind = String(url.searchParams.get("kind") || "ping").trim();
  const cursor = Math.max(0, Number(url.searchParams.get("cursor") || 0) || 0);
  const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get("limit") || 500) || 500));

  const connectionString = dbUrl();
  if (!connectionString || connectionString === "[SENSITIVE]") {
    return json(res, 500, { detail: "No database URL configured on this deployment" });
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 8000,
    statement_timeout: 15000,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    if (kind === "ping") {
      const r = await client.query("SELECT 1 AS ok, NOW() AS ts");
      return json(res, 200, { ok: true, ts: r.rows[0]?.ts, host: "connected" });
    }

    if (kind === "stats-summary") {
      const total = await client.query(
        `SELECT COUNT(*)::int AS c FROM car_listings WHERE COALESCE(is_active, true) = true`,
      );
      const priced = await client.query(
        `SELECT COUNT(*)::int AS c, AVG(price_lkr)::float AS avg
         FROM car_listings
         WHERE COALESCE(is_active, true) = true AND price_lkr >= $1`,
        [MIN_PRICE],
      );
      const week = await client.query(
        `SELECT COUNT(*)::int AS c FROM car_listings
         WHERE COALESCE(is_active, true) = true
           AND scraped_at >= NOW() - INTERVAL '7 days'`,
      );
      const makes = await client.query(
        `SELECT make, COUNT(*)::int AS count
         FROM car_listings
         WHERE COALESCE(is_active, true) = true AND make IS NOT NULL AND make <> ''
         GROUP BY make ORDER BY count DESC LIMIT 12`,
      );
      const districts = await client.query(
        `SELECT COUNT(DISTINCT district)::int AS c FROM car_listings
         WHERE COALESCE(is_active, true) = true AND district IS NOT NULL AND district <> ''`,
      );
      return json(res, 200, {
        total_listings: total.rows[0]?.c || 0,
        priced_listings: priced.rows[0]?.c || 0,
        avg_price_lkr: priced.rows[0]?.avg || 0,
        listings_this_week: week.rows[0]?.c || 0,
        price_change_mom: null,
        top_makes: makes.rows,
        district_count: districts.rows[0]?.c || 0,
        generated_at: new Date().toISOString(),
      });
    }

    if (kind === "live-market") {
      const total = await client.query(
        `SELECT COUNT(*)::int AS c FROM car_listings WHERE COALESCE(is_active, true) = true`,
      );
      const latest = await client.query(
        `SELECT scraped_at FROM car_listings
         WHERE scraped_at IS NOT NULL
         ORDER BY scraped_at DESC LIMIT 1`,
      );
      return json(res, 200, {
        total_listings: total.rows[0]?.c || 0,
        latest_listing_at: latest.rows[0]?.scraped_at || null,
        generated_at: new Date().toISOString(),
        sources: [],
      });
    }

    if (kind === "district-prices") {
      const rows = await client.query(
        `SELECT district,
                COUNT(*)::int AS count,
                AVG(price_lkr)::float AS avg_price_lkr,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_lkr)::float AS median_price_lkr
         FROM car_listings
         WHERE COALESCE(is_active, true) = true
           AND district IS NOT NULL AND district <> ''
           AND price_lkr >= $1
         GROUP BY district
         ORDER BY count DESC`,
        [MIN_PRICE],
      );
      return json(res, 200, {
        points: rows.rows.map((r) => ({
          district: r.district,
          count: r.count,
          avg_price_lkr: r.avg_price_lkr,
          median_price_lkr: r.median_price_lkr,
          lat: null,
          lng: null,
        })),
      });
    }

    if (kind === "listing-makes") {
      const rows = await client.query(
        `SELECT make, COUNT(*)::int AS count FROM car_listings
         WHERE COALESCE(is_active, true) = true AND make IS NOT NULL AND make <> ''
         GROUP BY make ORDER BY count DESC`,
      );
      return json(res, 200, rows.rows);
    }

    if (kind === "listing-sources") {
      const rows = await client.query(
        `SELECT source, COUNT(*)::int AS count FROM car_listings
         WHERE COALESCE(is_active, true) = true AND source IS NOT NULL AND source <> ''
         GROUP BY source ORDER BY count DESC`,
      );
      return json(res, 200, rows.rows);
    }

    if (kind === "listings") {
      const rows = await client.query(
        `SELECT id, source, source_id, url, title, make, model, year, price_lkr,
                mileage, fuel_type, transmission, condition, body_type, district,
                thumbnail_url, is_active, scraped_at, deal_score
         FROM car_listings
         WHERE COALESCE(is_active, true) = true AND id > $1
         ORDER BY id ASC
         LIMIT $2`,
        [cursor, limit],
      );
      const items = rows.rows.map((row) => ({
        id: row.id,
        source: row.source,
        source_id: row.source_id,
        url: row.url,
        detail_url: row.url,
        external_url: row.url,
        title: row.title || "",
        make: row.make || "",
        model: row.model || "",
        year: row.year,
        price_lkr: row.price_lkr != null ? Number(row.price_lkr) : null,
        mileage: row.mileage,
        mileage_km: row.mileage,
        fuel_type: row.fuel_type,
        transmission: row.transmission,
        condition: row.condition,
        body_type: row.body_type,
        district: row.district,
        thumbnail_url: row.thumbnail_url,
        is_active: row.is_active !== false,
        scraped_at: row.scraped_at,
        deal_score: row.deal_score != null ? Number(row.deal_score) : null,
      }));
      const nextCursor = items.length ? items[items.length - 1].id : null;
      return json(res, 200, {
        items,
        next_cursor: items.length === limit ? nextCursor : null,
        count: items.length,
      });
    }

    return json(res, 400, { detail: `Unknown kind: ${kind}` });
  } catch (error) {
    return json(res, 500, {
      detail: "snapshot_export_failed",
      error: String(error && error.message ? error.message : error).slice(0, 300),
    });
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
};
