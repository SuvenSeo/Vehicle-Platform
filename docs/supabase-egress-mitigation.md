# Supabase Egress Mitigation

Project: `vehicle-platform` · Region: ap-southeast-1 · Tier: Nano (free)  
Threshold: 5 GB / month · Status: **exceeded** — grace period ended.

## Immediate operational step

**Upgrade to Pro ($25/month)** in the Supabase dashboard → Settings → Billing.  
Pro unlocks: 8 GB egress, daily backups, PITR, and higher connection limits.  
Do this now to restore access.

## Root causes

1. **No VITE_SNAPSHOT_BASE_URL set** — the frontend falls back to live polling
   the Postgres-backed `/api/v1/stats/live` endpoint (plus SSE stream) on every
   page load, bypassing the R2 CDN snapshot entirely.
2. **Aggressive poll intervals** — fallback polling was 30 s (snapshot) and 45 s
   (pipeline), multiplied across concurrent users.
3. **HF backend direct DB reads** — scrapers and aggregation queries stream
   large table scans directly from Supabase with no CDN layer.
4. **No HTTP cache on stats endpoints** — every `/stats/summary`,
   `/stats/district-prices`, and `/stats/district-velocity` request hit the DB
   even when data was fresh inside the 1-hour materialized cache.

## Egress reduction checklist

- [ ] **Enable R2 snapshots** — upload `snapshot.json` to an R2 bucket after
  each scrape run and set `VITE_SNAPSHOT_BASE_URL=https://<r2-public-domain>`
  on Vercel. The frontend then reads from CDN instead of hitting the API.
- [ ] **Set pooled connection string** — use port `6543` (Transaction Pooler)
  in `DATABASE_URL`, not the direct port 5432. Fewer open connections = less
  DB CPU overhead and reduced internal Supabase egress.
- [ ] **Avoid `SELECT *` dumps** — scraper reconciliation and historical
  backfill queries should select only needed columns. Never run full-table
  exports from client apps.
- [ ] **No historical backfill from the browser** — `historical_csv_import.py`
  and related scripts must only run from the HF Space or GitHub Actions, never
  triggered from a browser session.
- [ ] **Reduce polling** — snapshot fallback: ≥ 60 s; pipeline status: 90 s.
  Admin pipeline tab: 60 s. Dashboard insights: 180 s (done in this PR).
- [ ] **Cache-Control headers** — public GET stats endpoints now emit
  `Cache-Control: public, max-age=60` so Vercel Edge / CDN absorbs repeat
  requests within the TTL.
- [ ] **Delete stale cache rows** after data changes to force recompute:
  `DELETE FROM market_stats_cache;`
