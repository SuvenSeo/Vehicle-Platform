# Neon-first ops: single DB + egress budget

Motormila moved **fully to NeonDB** (single database). Supabase free egress was
exceeded (5 GB/mo) and all scrapers were paused — this runbook explains the new
setup, why public browsing no longer burns DB transfer, and how to stay inside
Neon's monthly data-transfer allowance so scrapers never get blocked again.

> Historical context: `docs/supabase-egress-mitigation.md` and
> `docs/permanent-free-ops-r2-oracle.md` document the older dual-DB
> (Supabase reads / Neon writes) era. The current architecture is Neon-only.

---

## 1. Architecture after the move

| Layer | Where | Egress impact |
|-------|-------|---------------|
| **Public browsing** (SPA) | Reads R2 / same-origin JSON snapshots (`VITE_SNAPSHOT_ONLY=true`) | **Zero DB reads** |
| **Scrapers** | GitHub Actions `run_sync.py` → writes to Neon | Writes = **ingress, free** |
| **Stats / pipeline / digest** | Small bounded SELECTs (stats cache, `ScrapeRun`) | Negligible |
| **Full catalog snapshot export** | Weekly / manual (`--skip-catalog` daily) | ~1 full-table read each |
| **DB backup (pg_dump)** | **Weekly** (Neon has its own PITR) | ~1 full-table read each |

`backend/db/session.py` runs in **single-DB mode**: set only
`HOT_DATABASE_URL` (the Neon pooled DSN) and both HOT and COLD engines point
at it. No Supabase secret is referenced anywhere anymore.

### Required secrets (GitHub Actions)

| Secret | Value |
|--------|-------|
| `HOT_DATABASE_URL` | Neon **pooled** DSN (see §3) |
| `NEON_API_KEY`, `NEON_PROJECT_ID` | Optional — enables the live egress API check |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Snapshot CDN upload |
| `SNAPSHOT_EXPORT_SECRET` | Same value as Vercel env `SNAPSHOT_EXPORT_SECRET` |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Auto redeploy |
| `SLACK_WEBHOOK_URL` | Egress watchdog + failure alerts |

Delete `SUPABASE_DB_URL` once the switch is verified.

### Vercel env (frontend)

```text
VITE_SNAPSHOT_BASE_URL=https://<public-r2-domain>/latest
VITE_SNAPSHOT_ONLY=true
```

With `VITE_SNAPSHOT_ONLY=true`, the SPA **never** falls back to the live API
for public reads — missing snapshots render empty instead of hitting Postgres.
`scripts/apply-snapshot-vercel-env.sh` applies this idempotently.

### HF Space env (backend)

```text
HOT_DATABASE_URL=<neon pooled dsn>
ALLOW_SQLITE_FALLBACK=false
DISABLE_LIVE_SSE=true
LIVE_STREAM_INTERVAL_SECONDS=120
```

---

## 2. Egress budget math (why it fits)

Neon Launch (free) includes **5 GB data transfer/month**. Once exceeded, Neon
blocks all DB connections — exactly what happened on Supabase before. The budget:

| Consumer | Frequency | Est. transfer |
|----------|-----------|---------------|
| Public browsing | every visitor | **0** (R2 snapshots) |
| Stats / pipeline polls | hourly | < 0.1 GB |
| Daily scrape runs (writes) | 2–3×/day | ~0 (ingress) |
| Full catalog export | weekly (5/mo) + manual backfill | ~5 × catalog size |
| pg_dump backup | weekly (4/mo) | ~4 × dump size |

With an 80k-listing catalog (~40–90 MB JSON) this lands around **1–2 GB/mo**,
comfortably under 5 GB. The two levers if usage climbs:

1. **Skip the full catalog more often** — daily runs already use
   `export_public_snapshots.py --skip-catalog` (stats-only). Only the weekly /
   manual refresh reads the whole table.
2. **Keep pg_dump weekly, not daily** — Neon's built-in branch/PITR history
   covers day-to-day recovery (`docs/disaster-recovery-plan.md`).

### Watchdog

`.github/workflows/neon-egress-watch.yml` runs **every Monday 04:00 UTC**:

- Uses `check_neon_egress.py` (`backend/scripts/ops/check_neon_egress.py`)
- Live path: Neon Admin API (`NEON_API_KEY` + `NEON_PROJECT_ID`)
- Fallback path: DB-size estimate from `pg_total_relation_size('car_listings')`
  × documented full-read cadence
- Posts to Slack at **≥80%** and fails the check **over 100%** so you get a
  heads-up weeks before the block.

Manual run anytime: Actions → **Neon Egress Watchdog** → Run workflow.

---

## 3. Neon pooled vs unpooled DSN

- **Pooled** (PgBouncer, `-pooler` endpoint or port `6543`): use everywhere
  (API, scrapers, workflows). Fewer connections = less Neon compute churn.
- **Unpooled** (direct `5432`): only for one-off migrations / DDL.

```
postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/neondb?sslmode=require
```

`db/session.py` deliberately does **not** pass libpq `options=-c statement_timeout`
(breaks PgBouncer); the timeout is applied per-session in `get_db()` instead.

---

## 4. Resume + catch-up playbook

### a) Verify the switch (one-time)

1. Run Actions → **Ikman Deep Backfill** with `max_pages=20` (small first).
2. Confirm the job's "Count ikman listings before/after" increments.
3. Hard-refresh https://motormila.vercel.app — listings/stats must come from
   R2 (`/snapshots/latest/*`), never `/api/v1`.

### b) Catch up on the inactive days (the big one)

Run Actions → **Ikman Deep Backfill** (`.github/workflows/ikman-bulk-backfill.yml`):

- `max_pages=150` — deep pull across all vehicle categories via
  `api.ikman.lk/v1/serp` (`IKMAN_SCRAPE_MODE=api`). Cars (primary) gets the
  full page budget; secondary categories a capped share
  (`backend/app/scrapers/page_budget.py`).
- `refresh_catalog=true` — rebuilds the public catalog afterward (one full
  read, budgeted).
- Repeat weekly or when inventory looks stale. The lighter one-shot
  (`scrape-ikman-once.yml`, default 20 pages) is triggered by touching
  `.github/triggers/scrape-ikman` — it is NOT the deep backfill, so use this
  workflow for the big catch-up.

> ikman API tip: the scraper keeps `sort=date&order=desc` with
> `next_page_token` pagination and a 0.35 s/page delay, so deep runs are
> polite to the source and safe to run unattended.

### c) Normal cadence (now scheduled again)

| Workflow | Cron (UTC) | Notes |
|----------|-----------|-------|
| Unified Vehicle Scraper (`daily-scrape.yml`) | 02:00, 12:40 | 13 sources, stats-only snapshot export |
| Manus Scrape Dump (`manus-scrape-every-2h.yml`) | 02:00, 10:00, 18:00 | 3x daily polite incremental scrapes (30 pages/src) |
| Manus to Live (`manus-to-live.yml`) | on complete, fallback 6h | hosted merge & deploy, only triggers when needed |
| Midday Top Sources (`midday-top-sources-scrape.yml`) | 06:30 | ikman + riyasewana, stats-only export |
| Keep HF Space Awake | every 30 min | cheap `SELECT 1` probe — scale-to-zero compute protection |
| Monitor Vehicle Pipeline | hourly | `ScrapeRun` reads only |
| Weekly Pro Digest | Mon 01:00 | bounded aggregate reads |
| Weekly DB Backup | Sun 02:30 | pg_dump — weekly to protect egress |
| Neon Egress Watchdog | Mon & Thu 04:00 | budget early-warning (70% warning threshold) |
| Full-Catalog Refresh (`weekly-catalog-refresh.yml`) | Every 3 days (03:00) | Maximizes 5GB budget safely (~3.97 GB/mo utilized) |
| Neon Export | daily 03:20 | skips automatically once month export exists |

---

## 5. If the budget is still tight

1. Drop the weekly full-catalog export to fortnightly (run it manually after a
   big backfill instead of on a cron).
2. Reduce `SCRAPE_MAX_PAGES_*` in the daily workflow (60 → 40).
3. Raise the estimate accuracy: set `NEON_API_KEY` + `NEON_PROJECT_ID` so the
   watchdog reads real usage instead of the size estimate.
4. As a last resort Neon bills overage per GB (paid), which is cheaper than a
   blocked database — upgrade only if the product outgrows free.

---

## 6. After a quota block: getting 180k+ listings on the site again

The block is **connections**, not a wipe. Neon still holds the table. Public
pages read R2 snapshots, so they show whatever `manus-to-live.yml` last
deployed (Manus unique listings, not the full Neon catalog) until an export
runs.

1. Wait for the monthly transfer quota to reset (1st of the month).
2. Let **Neon Export** succeed once (or run it with `limit: 5000` then `0`).
   That publishes `neon-export-*` and `manus-to-live.yml` merges it.
3. Do **not** immediately re-export, run weekly pg_dump, and full-catalog
   snapshot from Neon on the same day — that is how the quota is blown again.
   Keep `VITE_SNAPSHOT_ONLY=true`.

To copy outage-era unique rows *into* Neon (the other direction), see
`docs/manus-scraping.md` → `import_sqlite_to_neon.py`.
