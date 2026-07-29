# Alembic (light scaffold)

Schema changes are still applied at API/scraper startup by `backend/db/schema_patches.py` (`init_db`). Alembic is wired for a future cutover; the baseline revision is intentionally empty.

## Run migrations

From `backend/` with the same env as the app:

```bash
ALLOW_SQLITE_FALLBACK=true .venv/bin/alembic upgrade head
```

Production / Postgres: set `HOT_DATABASE_URL` and/or `COLD_DATABASE_URL` / `DATABASE_URL` (same resolution as `db/session.py`). In dual-DB mode Alembic uses **COLD** when both URLs are set; run again with only `HOT_DATABASE_URL` if you need the version stamp on Supabase too.

Other commands: `alembic current`, `alembic history`, `alembic downgrade -1`.

## Ownership until cutover

- **schema_patches** — additive columns, indexes, and missing tables on legacy DBs.
- **Alembic** — version tracking only (`20260728_baseline`); do not autogenerate the full schema yet.

New DDL should continue in `schema_patches` until the team explicitly moves to Alembic revisions.
