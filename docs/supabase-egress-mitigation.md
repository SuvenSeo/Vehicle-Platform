# Supabase Egress Mitigation

> **ARCHIVED / SUPERSEDED** — Motormila moved **fully to NeonDB** (single DB).
> See **`docs/neon-egress-budget.md`** for the current architecture, the
> weekly egress budget, and the `neon-egress-watch` watchdog. This page is
> kept for historical context of the Supabase-era mitigations.

Project: `vehicle-platform` · Region: ap-southeast-1 · Tier: Nano (free)  
Threshold: 5 GB / month · Status: **exceeded** — grace period ended (historical).

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

- [ ] **Enable R2 (or same-origin) snapshots** — after each scrape, export
  `listing-catalog.json` (or multi-part `listing-catalog-part-*.json` +
  manifest), `stats-summary.json`, `live-market.json`, etc., upload to R2 (or
  `public/snapshots/latest/` on Vercel), then set
  `VITE_SNAPSHOT_BASE_URL=https://<public-r2-domain>/latest` (or
  `https://motormila.vercel.app/snapshots/latest`) and `VITE_SNAPSHOT_ONLY=true`
  on Vercel. See `docs/permanent-free-ops-r2-oracle.md`.
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

---

## Free path (no Pro upgrade)

### Steps to take right now

1. **STOP scheduled scrapes** — done. Cron disabled on
   `daily-scrape.yml`, `midday-top-sources-scrape.yml`, `keep-hf-awake.yml`,
   and `pipeline-monitor.yml`. Manual `workflow_dispatch` only until R2 is live.

2. **RIGHT NOW backup** — Actions → **Emergency DB Backup** → Run workflow.
   Requires `HOT_DATABASE_URL` secret set in the repository. Or run locally:
   ```bash
   export SOURCE_DATABASE_URL='postgresql://...'  # from Supabase Dashboard → Project Settings → Database → URI (use Session mode / direct if pooler fails)
   cd backend && python scripts/ops/rescue_postgres_data.py export
   ```

3. **Download and store** the artifact (`emergency-pgdump-<run_id>` and
   `rescue-exports-<run_id>`) to an encrypted USB drive, Google Drive, or
   laptop. **Do NOT commit database dumps to git.**

4. **Turn on R2 + snapshot-only** — follow **`docs/permanent-free-ops-r2-oracle.md`**:
   export snapshots → upload R2 → set on Vercel:
   ```text
   VITE_SNAPSHOT_BASE_URL=https://<public-r2-domain>/latest
   VITE_SNAPSHOT_ONLY=true
   ```
   Redeploy. Public browsing then never falls back to Postgres.

5. **Wait for free egress quota reset** (monthly reset on billing anniversary)
   before running heavy scrapes again — and only after step 4 is verified.

6. **Do NOT run** `historical-backfill` or a full scrape matrix until a
   confirmed backup exists and R2 snapshot-only is live.

7. **Optional long-term free Postgres host** — Oracle Always Free VM (see the
   same runbook). Do not move to Neon free expecting a different outcome.
