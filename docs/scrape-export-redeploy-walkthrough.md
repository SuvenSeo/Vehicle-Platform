# Walkthrough: scrape → export → redeploy

Manual loop that refreshes Motormila **without** turning daily cron back on.
Public site stays on `VITE_SNAPSHOT_ONLY=true`; scrapers only write to the DB,
then snapshots are rebuilt for CDN/same-origin reads.

Workflow file: `.github/workflows/scrape-export-redeploy.yml`  
Actions name: **Scrape → Export → Redeploy**

---

## Before you start

### 1) Check Supabase free egress
If the free quota is still exhausted, the scrape job will fail or hang on DB
writes. Wait for the monthly reset (or confirm the project can accept writes).

### 2) Confirm GitHub Actions billing
Recent Motormila CI failed with *“spending limit needs to be increased”*.  
If Actions still won’t start, fix billing first — the workflow cannot run.

Repo → **Settings → Billing** (or org billing) → raise spending limit / fix payment.

### 3) Secrets (repo → Settings → Secrets and variables → Actions)

| Secret | Required for | Notes |
|--------|----------------|-------|
| `HOT_DATABASE_URL` | Scrape + DB export fallback | Already used by other scrape workflows |
| `SNAPSHOT_EXPORT_SECRET` | Preferred snapshot refresh | Same value as Vercel env `SNAPSHOT_EXPORT_SECRET` |
| `VERCEL_TOKEN` | Auto production redeploy | [Vercel → Account → Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Auto redeploy | `npx vercel project ls` / project settings |
| `VERCEL_PROJECT_ID` | Auto redeploy | Project settings → General |
| `R2_*` | Optional R2 upload | Only if you already set up Cloudflare R2 |

If `VERCEL_TOKEN` is missing, the workflow still scrapes + uploads a **snapshot
artifact** — you download it and run locally:

```bash
# unzip artifact into public/snapshots/latest/
bash scripts/redeploy-prod-with-snapshots.sh
```

---

## First run (recommended): ikman only

1. Open  
   https://github.com/SuvenSeo/Vehicle-Platform/actions/workflows/scrape-export-redeploy.yml  
2. Click **Run workflow** (branch: `main`).
3. Set inputs:

| Input | Value |
|-------|--------|
| `source` | **ikman** |
| `max_pages` | **10** or **20** (start small) |
| `refresh_catalog` | **true** (so new listings appear on the site) |
| `redeploy` | **true** |

4. Click **Run workflow**.
5. Watch jobs in order:
   - `scrape` — ikman write to Postgres  
   - `refresh-snapshots` — rebuild `/snapshots/latest`  
   - `redeploy` — production deploy **with** snapshot JSON  

6. When green, hard-refresh https://motormila.vercel.app  
   Confirm `/snapshots/latest/stats-summary.json` is JSON (not HTML).

### What “good” looks like in the logs
- `ikman_active_before=…` / `ikman_active_after=…` / `ikman_scraped_last_2h=…`
- Snapshot pull finishes without auth errors
- Redeploy aliases `https://motormila.vercel.app`
- Verify step prints `content-type=application/json`

---

## Export-only (no scrape)

Use when the DB already has fresh rows and you only need to refresh the site:

| Input | Value |
|-------|--------|
| `source` | **none** |
| `refresh_catalog` | true (or false for stats/insights only) |
| `redeploy` | true |

---

## If redeploy is skipped / fails

1. Open the successful run → **Artifacts** → `public-snapshots-latest-<id>`
2. Download and unpack into `public/snapshots/latest/`
3. Locally (Vercel CLI logged in):

```bash
bash scripts/redeploy-prod-with-snapshots.sh
```

---

## After it works once

- Prefer **weekly** manual runs, not daily cron.
- Prefer **one source** (`ikman` or midday pair) before the full matrix.
- Keep `VITE_SNAPSHOT_ONLY=true` — do not flip back to live API browsing on free Supabase.
- Every scrape should end with snapshot refresh + redeploy (this workflow).

## Do not (yet)

- Re-enable `daily-scrape` / `midday` cron schedules
- Run `historical-backfill` while egress is tight
- Unset `VITE_SNAPSHOT_ONLY` “to make maps live again”

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Workflow never starts | Actions spending limit | Fix GitHub billing |
| Scrape fails on DB connect | Egress exhausted / bad DSN | Wait for quota; check `HOT_DATABASE_URL` |
| Snapshot refresh 401 | Wrong/missing `SNAPSHOT_EXPORT_SECRET` | Match Vercel env value |
| Site empty after GitHub merge | Git deploy wiped gitignored JSON | Re-run this workflow with `source=none` or local redeploy script |
| Catalog too large / deploy fails | Part split missing | Ensure `split-listing-catalog.mjs` / pull script multi-part ran |
