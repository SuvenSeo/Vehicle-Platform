# Manus Cloud Computer scraping (outage boost)

Manus's Cloud Computer keeps a Linux VM alive for days, runs while the laptop
is closed, and can run tasks on a schedule. While it's available, use it as a
**second scraping farm** for the sources that don't Cloudflare-wall datacenter
IPs, and deliver results to GitHub so the laptop pipeline can merge them.

## Why not every source

Manus VMs run on datacenter IPs. riyasewana and patpat block datacenter IPs
(the reason the laptop runners exist). **Use Manus for:** `ikman`
(API-based — proven to work from hosted runners), `autolanka`, `hitad`,
`autostream`, `saleme`, `riyahub`, `carshop`, `dimo`, `autodirect`,
`cartivate`. **Keep on the laptop:** `riyasewana`, `patpat`.

## One-time setup (you do this once)

1. Create a fine-scoped GitHub token for the Manus session:
   - GitHub → Settings → Developer settings → Personal access tokens →
     Fine-grained → New token
   - Repo access: `SuvenSeo/Vehicle-Platform` only
   - Permissions: **Contents: read**, **Releases: write**
2. Keep that token handy — you'll paste it into the Manus task below
   (or set it as `GH_TOKEN` in the Manus session when asked).

## The task to paste into Manus

> You have a Linux cloud computer. Clone
> `https://github.com/SuvenSeo/Vehicle-Platform` and run:
>
> ```
> GH_TOKEN=<the fine-grained token> bash backend/scripts/ops/manus_scrape_dump.sh ikman autolanka hitad autostream saleme riyahub carshop dimo autodirect cartivate
> ```
>
> This installs dependencies (may take a few minutes), scrapes each listed
> source into a local SQLite database, compresses it, and uploads it as a
> GitHub Release asset tagged `manus-scrape-*`. Do not modify any repo code.
> When it finishes, report the printed "scraped N listings" number and the
> release tag. If a source errors, let the script continue with the others and
> still report what succeeded.

You can run several Manus tasks in parallel for different subsets, and repeat
the task daily — each run creates a fresh release. Old `manus-scrape-*`
releases are pruned automatically (5 kept).

## Merging into the laptop pipeline

On the laptop, download the newest `manus-scrape-*` release asset
(`autolens.db.gz`) and merge it into the local outage DB:

```
cd backend
python scripts/ops/merge_sqlite_dump.py path/to/autolens.db.gz --dry-run   # preview first
python scripts/ops/merge_sqlite_dump.py path/to/autolens.db.gz             # merge
```

Rows are upserted by `(source, source_id)` — existing cars get refreshed with
the Manus-scraped data, genuinely new cars are inserted, price history is
recorded. Nothing is duplicated. After merging, run the outage pipeline's
analysis + export (`gh workflow run outage-local-pipeline.yml` and wait, or
run `python run_sync.py` + `python export_public_snapshots.py` locally) so the
site picks up the merged data.

## Hosted merge → live site (no laptop needed)

`.github/workflows/manus-to-live.yml` runs entirely on GitHub-hosted runners
and keeps the live site updated **~whenever a dump is published** — no laptop
or Manus session required. It triggers:

- right after `manus-scrape-every-2h.yml` completes,
- right after `neon-export.yml` completes,
- every 30 minutes on a schedule (catches laptop-made dumps + retries),
- manually, with an optional `release-tag` input to force-merge a specific dump.

Each run:

1. restores a **durable merged SQLite DB** published as the `merged-db`
   release (`merged-autolens.db.gz` + `last-merged.txt` marker),
2. merges every dump newer than the marker — it scans **all** dump prefixes:
   `manus-scrape-*`, `manus-scrape-dedicated-*` (laptop riyasewana runs),
   `laptop-db-*` (full laptop DB, below), and `neon-export-*`,
3. runs market analysis + dedup (`run_sync.py`),
4. exports full public snapshots and deploys them to Vercel via
   `scripts/deploy-snapshots-to-prod.sh`,
5. re-publishes the merged DB + marker **only after a successful deploy**,
   so a failed run is retried from the same point.

Requires the repo secrets `VERCEL_TOKEN` / `VERCEL_ORG_ID` /
`VERCEL_PROJECT_ID` (already used by the other workflows). Optional:
`SLACK_WEBHOOK_URL` for failure alerts.

The first run merges all existing `manus-scrape-*` dumps at once. Subsequent
runs only merge what's new. Because `last-merged.txt` lives on the release,
the merged DB is durable across runner restarts and GitHub-hosted runners are
fully interchangeable.

### Verified data inventory (2026-08-14, 33 releases)

A local replay of the first-run merge over all released dumps produced:

| Metric | Count |
|---|---:|
| Dump releases merged | 32 (`manus-scrape-*` + 1 `manus-scrape-dedicated-*`) |
| Raw scraped rows across all dumps | 218,682 |
| **Unique listings after (source, source_id) merge** | **16,485** |
| Re-scrape rows that were duplicates/updates | 202,197 (92.5%) |
| Cross-source duplicates flagged by dedup | 3,084 (same car on 2+ sites) |
| Outliers flagged | 518 |
| Listings exported to the live catalog | 15,967 (unique − outliers) |
| Price-history points recorded | 15,995 |

Per-source unique listings: ikman 7,917 · riyasewana 5,370 (laptop dedicated
dump) · autostream 1,420 · riyahub 1,113 · hitad 439 · saleme 81 ·
cartivate 51 · dimo 29 · autolanka 26 · autodirect 24 · carshop 15.

The `manus-scrape-parallel-*` experimental release (asset
`autolens-recovered.db.gz`) is intentionally skipped — the merge only looks
for assets named `autolens.db.gz`. riyasewana/patpat/auto-lanka bulk coverage
comes from `laptop-db-*` releases and the post-reset Neon export.

### Laptop full-DB upload

`outage-local-pipeline.yml` now also uploads the laptop's complete DB
(all 12 sources, incl. `patpat`/`auto-lanka`, which Manus dumps don't cover)
as a `laptop-db-*` release. The hosted workflow merges it too, so the live
catalog stays complete even when the laptop is off. The laptop pipeline still
scrapes + deploys directly when it runs; the hosted workflow is the safety
net that keeps the site fresh the rest of the time.

## Post-reset Neon export (Sept 1)

After Neon's quota resets, export the full pre-outage database (the 180k+
listings and their price history) before/while the canonical pipeline resumes:

1. Make sure the repo secret `HOT_DATABASE_URL` (the Neon DSN) is set —
   the canonical daily-scrape.yml already uses it.
2. Run the **Neon Export** workflow (Actions → Neon Export → Run workflow).
   It streams `car_listings` + `vehicle_price_history` out of Neon into a
   gzipped SQLite dump and publishes a `neon-export-*` release.
   (Use `limit: 5000` first as a quick connectivity check.)
3. `manus-to-live.yml` picks up that release automatically and merges it into
   the merged DB — the live site's catalog and price history are restored,
   and the canonical pipeline can keep going from there.

Locally, the same export can be run with:

```
cd backend
export DATABASE_URL=postgresql://...
python scripts/ops/export_neon_to_sqlite.py --output autolens.db.gz
```

After the outage ends, the merged DB can also be imported into Neon the other
way (keyed on `source, source_id`) so Manus/laptop-era scrapes aren't lost
from the canonical database.
