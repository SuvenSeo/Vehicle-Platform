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

## Post-reset note

After Neon's quota resets (Sept 1), the canonical pipeline (daily-scrape.yml)
resumes against Neon; the merged local DB can be imported into Neon the same
way (keyed on `source, source_id`), so Manus-era scrapes aren't lost.
