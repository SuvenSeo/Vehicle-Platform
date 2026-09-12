# Neon-first ops: single DB + egress budget

> **Sep 2026 status — second block, and why we stayed on Neon.** After the
> first quota block (Supabase) and the SQLite-first architecture, the Neon
> free 5 GB budget tipped over again mid-month. The traffic study: public
> browsing is already zero-egress (R2 snapshots), so the remaining burn was
> (a) the weekly heavy passes streaming ~240k rows to the runner and (b) hot
> API cache misses re-reading Postgres. Fixes in this repo:
>
> 1. **Process-local TTL cache** (`app/utils/memory_cache.py`, wired into
>    `/stats/*` endpoints) — repeat API hits within the TTL cost **zero
>    payload bytes**; entries are keyed by the materialized cache entry's
>    `refreshed_at` anchor, so `DELETE FROM market_stats_cache` (the
>    documented ops lever) and every DB-side recompute invalidate it
>    automatically. Tune with `STATS_MEMORY_CACHE_TTL_SECONDS` (default 300 s).
> 2. **SQL-side outlier pass** (`app/utils/outliers.py`) — IQR fences are
>    computed with `percentile_cont` inside Postgres; nothing streams the
>    table to the runner anymore. SQLite (tests) keeps the Python path.
> 3. **Egress optimizer equivalent** (`scripts/ops/top_egress_queries.py`) —
>    ranks `pg_stat_statements` by rows returned and flags any statement
>    averaging ≥10k rows/call so over-fetching is found before it bills.
>
> Evaluated and rejected: **Cloudflare D1** (free tier enforces hard daily
> caps — 5M rows read/day, 100k rows written/day, enforced since 2026-09-01 —
> and a 500 MB free database size; a 240k-listing table with 2–3×/day
> upserts and weekly full passes would blow through both immediately) and
> **Turso** (SQLite, 500M rows read/mo on the free Developer plan, but the
> FastAPI + SQLAlchemy + Postgres stack would need a rewrite to libSQL with
> `psycopg2` dropped, percentile/window SQL semantics differ, and the same
> "move reads to snapshots" ceiling applies). Both would just trade the
> transfer cliff for a worse row-based cliff; neither accepts arbitrary SQL
> maintenance the way Postgres does. Decision: **stay on Neon**, keep the
> reads off the DB, and keep the gated heavy passes. Full analysis:
> `docs/supabase-egress-mitigation.md` (history) and §7 below.

Motormila moved **fully to NeonDB** (single database). Supabase free egress was
exceeded (5 GB/mo) and all scrapers were paused — this runbook explains the new
setup, why public browsing no longer burns DB transfer, and how to stay inside
Neon's monthly data-transfer allowance so scrapers never get blocked again.

> Historical context: `docs/supabase-egress-mitigation.md` and
> `docs/permanent-free-ops-r2-oracle.md` document the older dual-DB
> (Supabase reads / Neon writes) era. The current architecture is Neon-only.

---

## 1. Architecture after the move (and the zero-egress catalog, Sep 2026)

| Layer | Where | Egress impact |
|-------|-------|---------------|
| **Public browsing** (SPA) | Reads R2 / same-origin JSON snapshots (`VITE_SNAPSHOT_ONLY=true`) | **Zero DB reads** |
| **Public catalog refresh** | `manus-to-live.yml` exports the **merged SQLite DB** → R2/Vercel | **Zero Neon reads** |
| **Scrapers** | GitHub Actions `run_sync.py` → writes to Neon | Writes = **ingress, free** |
| **Daily maintenance** | SQL-side only (lifecycle, stats cache) | Negligible |
| **Heavy passes (dedup, outliers, aggregates, deal scores)** | Weekly, **egress-gated** (`heavy-maintenance.yml`) | ~60-80 MB per gated run |
| **Full catalog export from Neon** | **Never scheduled** — SQLite is the publish source | 0 |
| **DB backup (pg_dump)** | Monthly, manual, after a gated heavy run | ~1 full-table read |

`backend/db/session.py` runs in **single-DB mode**: set only
`HOT_DATABASE_URL` (the Neon pooled DSN) and both HOT and COLD engines point
at it. No Supabase secret is referenced anywhere anymore.

### The permanent fix (Sep 2026): SQLite is the publish source

Neon Free gives 5 GB transfer/month and blocks **all** connections once it is
exhausted. The old cadence (full-catalog export every 3 days + weekly pg_dump
+ **daily Python-side full-table passes**) rode at ~79% by Sep 10 and tipped
over mid-month. Three structural changes removed the cliff:

1. **The live catalog never reads Neon.** Manus scrapes → `manus-scrape-*`
   releases → `manus-to-live.yml` merges them into the durable SQLite
   `merged-db` release → exports snapshots from SQLite → deploys to Vercel.
   Neon is a write-only archive for listings; the merged SQLite DB (241k
   listings, ~70 MB gz) holds MORE than Neon and doubles as the backup.
2. **Python-side full-table passes run weekly behind an egress gate.** Dedup,
   outlier detection, monthly aggregates, and deal-score refresh each stream
   the whole table to the runner. They now live in
   `heavy-maintenance.yml` (Sunday 01:00 UTC), which refuses to run when
   `check_neon_egress.py` reports ≥50% of budget.
3. **Everything else is dispatch-only** (`neon-export`, pg_dump backup,
   full-catalog refresh, weekly digest, OCM cache) or SQL-side bounded
   (daily lifecycle + stats cache, hourly `ScrapeRun` monitor).

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

### 6.1 Over-fetching audit — current state of the code

| Pass / endpoint | Old behavior | Status |
|---|---|---|
| `mark_price_outliers` | streamed all ~240k live+priced rows to Python | **fixed** — `percentile_cont` fences computed server-side, only small fence tuples travel |
| `compute_aggregates` | one full read/month (already grouped columns only) | OK — read is by design the aggregate input; runs weekly, gated |
| `bulk_refresh_deal_scores` | one full read/week (JOIN projection, batched writes) | OK — SQL JOIN projection, batched `UPDATE..FROM` writes; weekly, gated |
| `mark_duplicates_batch` | full read only when `DEDUP_FULL_PASS=true` (weekly, gated); daily runs are `since`-windowed | OK |
| `/stats/summary`, `/district-prices`, `/district-velocity`, `/insights`, `/price-index` | every miss re-read Postgres (cache table + aggregates) | **fixed** — process-local TTL cache first, materialized cache second |
| Snapshot exports | full catalog read only in the full-refresh path; daily/stats-only exports are bounded (`load_only` + LIMIT 80) | OK |
| Keep-HF-awake probe | `SELECT 1` every 30 min | negligible |

Rule going forward: **any query that can return unbounded rows must either
have a LIMIT, project a bounded aggregate, or run behind the egress gate.**
Run `python scripts/ops/top_egress_queries.py` after big backfills to catch
regressions early.

## 7. Why not D1 / Turso (evaluated Sep 2026)

Both were seriously evaluated as Neon replacements ("free forever" hopes
after the second transfer block):

- **Cloudflare D1** — SQLite-based, no `pg` driver, so FastAPI/SQLAlchemy
  would need a rewrite to a D1 HTTP client. Free tier hard caps:
  **5M rows read/day, 100k rows written/day** (enforced — queries fail, not
  bill, since 2026-09-01) and **500 MB** database size on the free plan.
  Our single dedup/outlier/aggregate week is ~240k rows × several passes;
  two catalog syncs a day already approach the write cap, and any regression
  scan blows the read cap in one query. Paid tier removes caps but is
  priced per row-read — worse economics than Neon's flat 5 GB for this
  workload shape.
- **Turso** — libSQL/SQLite. Free Developer plan: 500M rows read/mo, 10M
  rows written/mo, 5 GB. Reads are generous, but the **write cap is the
  cliff**: every re-sighted listing is an UPDATE (≥1 row write each), so
  ~207k live listings × ~12 re-sights/mo ≈ 2.5M writes + ~58k inserts +
  ~1M heavy-pass writes lands at **~4-5M writes/mo (40-50% of cap)** with
  the catalog still growing. Turso's docs also confirm two hard behaviors:
  exceeding any limit returns a `BLOCKED` error (same all-or-nothing block
  as Neon), and "each updated row results in at least one row scan" —
  **UPDATEs burn the READ budget too**. On top of that: Postgres-specific
  SQL (`percentile_cont`, `UPDATE..FROM (VALUES)`) needs porting,
  `psycopg2` drops out, Alembic migrations get re-tested — a multi-day
  migration across ~30 files that re-locates the cliff rather than
  removing it.

**Decision:** stay on Neon. The structural fix is to keep *reads* off the
database (snapshots + caches) and make every scheduled pass either SQL-side
or egress-gated — which is now done. Neon also has a documented pattern of
unblocking accounts on request once the first fix ships.

## 8. The permanent-fix checklist (what actually moved the needle)

1. ✅ Public browsing reads R2 snapshots — zero DB reads (`VITE_SNAPSHOT_ONLY=true`).
2. ✅ Catalog refresh merges SQLite dumps — zero Neon reads (`manus-to-live.yml`).
3. ✅ Heavy passes weekly + egress-gated at 50% (`heavy-maintenance.yml`).
4. ✅ Outlier fences computed in Postgres, not streamed (this repo).
5. ✅ Hot stats endpoints cached in-process first (`app/utils/memory_cache.py`),
   keyed by the `market_stats_cache` entry's `refreshed_at` anchor — DB-side
   invalidation stays authoritative; memory only saves re-transferring and
   re-parsing a payload the worker already built.
6. ✅ `top_egress_queries.py` — pg_stat_statements watch for over-fetching.
7. ✅ Watchdog (`neon-egress-watch.yml`) warns at 70% and gates at 50%.
8. ⬜ Optional: set `NEON_API_KEY` + `NEON_PROJECT_ID` secrets so the
   watchdog reads real usage instead of the size estimate.
9. ⬜ Optional: `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;` once,
   so the top-consumer report works from day one.

---

## 2. Egress budget math (why it fits)

Neon Launch (free) includes **5 GB data transfer/month**. Once exceeded, Neon
blocks all DB connections — exactly what happened on Supabase before. The budget:

| Consumer | Frequency | Est. transfer |
|----------|-----------|---------------|
| Public browsing | every visitor | **0** (R2 snapshots) |
| Public catalog refresh | every merge (3×/day) | **0** (SQLite export) |
| Daily scrapes (writes + SQL-side passes) | 2–3×/day | < 0.2 GB |
| Weekly heavy passes (egress-gated) | 4/mo, skips above 50% | ~0.3 GB |
| Manual full exports / DR captures | occasional | ~0.5 GB |

This lands around **1 GB/mo** with wide headroom. The watchdog fails the
check over 100% and warns at 70%; the heavy-maintenance gate stops the heavy
passes at 50%.

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

### c) Normal cadence

| Workflow | Cadence | Notes |
|----------|---------|-------|
| Unified Vehicle Scraper (`daily-scrape.yml`) | 02:00, 12:40 UTC daily | 13 sources → Neon writes; SQL-side passes only |
| Manus Scrape Dump (`manus-scrape-every-2h.yml`) | 02:00, 10:00, 18:00 UTC | 3× daily incremental scrapes → SQLite dumps |
| **Manus to Live (`manus-to-live.yml`)** | after each scrape + 6h fallback | **Publishes the live catalog from SQLite — zero egress** |
| Midday Top Sources (`midday-top-sources-scrape.yml`) | 06:30 UTC daily | ikman + riyasewana; stats-only refresh |
| Weekly Heavy Maintenance (`heavy-maintenance.yml`) | Sun 01:00 UTC, **egress-gated** | dedup / outliers / aggregates / deal scores |
| Keep HF Space Awake | every 30 min | `SELECT 1` probe — negligible |
| Monitor Vehicle Pipeline | hourly | `ScrapeRun` reads only |
| Neon Egress Watchdog | Mon & Thu 04:00 UTC | early-warning (70% warning, gate at 50%) |
| Neon Export (`neon-export.yml`) | **dispatch-only** | DR capture — full-table read, budget carefully |
| Weekly DB Backup (`daily-db-backup.yml`) | **dispatch-only** | pg_dump — monthly, after a gated heavy run |
| Full-Catalog Refresh (`weekly-catalog-refresh.yml`) | **dispatch-only** | legacy Neon export — prefer manus-to-live |
| Weekly Pro Digest / OCM cache | **dispatch-only** | on demand |

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

## 6. After a quota block: the site keeps working, Neon is optional

A Neon block removes **connections**, not data — and since the SQLite-first
architecture it no longer matters for the public site:

1. **The site stays live.** `manus-to-live.yml` keeps merging Manus scrapes
   into the merged SQLite DB and deploying fresh snapshots — zero Neon reads,
   so scrapes, merges, catalog refreshes and deploys all continue during the
   block.
2. **Writes pause.** Scrapers that write to Neon (daily-scrape,
   midday-top-sources) will fail their DB steps until the quota resets on the
   1st. That only costs Neon-side freshness; the Manus-side pipeline is
   unaffected.
3. **After the reset:** let the gated `heavy-maintenance.yml` run (or force
   it once) to re-sync analytics, then optionally run **Neon Export** (dispatch-only)
   as a DR capture if the SQLite archive needs refreshing from Neon. Do not
   stack a full export + pg_dump + catalog refresh on the same day — that is
   how the quota was blown before.

To copy outage-era unique rows *into* Neon (the other direction), see
`docs/manus-scraping.md` → `import_sqlite_to_neon.py`.
