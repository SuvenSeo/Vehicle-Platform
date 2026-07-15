# Neon to Supabase Rescue Plan

Date: 2026-05-26

## Current state

- Neon is not readable right now. GitHub Actions logs show Postgres connections fail with: `project has exceeded the data transfer quota`.
- The local SQLite DB at `backend/autolens.db` has only 118 `car_listings`.
- The local snapshot at `backend/tmp-snapshots/latest` also has only 118 listings.
- The existing Supabase `vehicle-platform` project is inactive, and restoring it is currently blocked by the Supabase free active-project limit.

## What is possible without paying

The 80k+ listing dataset cannot be exported while Neon refuses all database connections. The no-pay path is:

1. Stop scheduled jobs so the project does not immediately burn quota again.
2. Wait for Neon's transfer quota reset.
3. Export the full Neon dataset locally immediately after reset.
4. Restore or prepare a Supabase project.
5. Import the local export into Supabase.
6. Configure the app/backend to use Supabase.
7. Run public reads from static snapshots so the DB is not hit by every visitor.

## Commands after Neon resets

From the repo root:

```powershell
cd "C:\Users\suven\Desktop\OneDriveBackupFiles\Documents\ARDENO STUDIO\VEHICLE-PLATFORM\auto-price-watch-main"
```

Set the source URL in the current PowerShell session without committing it:

```powershell
$env:SOURCE_DATABASE_URL = "<neon postgres connection string>"
python backend\rescue_postgres_data.py export
```

Or use GitHub Actions after the quota resets:

```text
GitHub -> Actions -> Rescue Neon Export -> Run workflow
```

That workflow uses the existing `COLD_DATABASE_URL` repository secret and uploads
`neon-rescue-export-<run_id>` as a downloadable artifact for 14 days.

The export will create a directory like:

```text
backend\rescue_exports\autolens-postgres-YYYYMMDDTHHMMSSZ
```

Set a Supabase target connection string:

```powershell
$env:TARGET_DATABASE_URL = "<supabase postgres connection string>"
python backend\rescue_postgres_data.py import --input "backend\rescue_exports\autolens-postgres-YYYYMMDDTHHMMSSZ" --replace
```

## Supabase blocker

The Supabase account currently has two active free projects. Restoring the inactive `vehicle-platform` project is blocked until one active project is paused or the active-project limit is increased.

Active projects seen:

- `serendib-trading`
- `food-platform`

Inactive candidate:

- `vehicle-platform`

## After import

Run a fresh public snapshot export from Supabase and host it on R2 or another static host. Then set:

```text
VITE_SNAPSHOT_BASE_URL=<public snapshot base URL>
```

Keep `VITE_API_URL` for private/pro/AI/admin flows only.
