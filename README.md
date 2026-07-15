# AutoLens LK - Vehicle Price Intelligence Platform

Vehicle market intelligence platform inspired by the Sri Lanka Property Price Intelligence stack, adapted for car listings.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind + React Query
- Backend: FastAPI + SQLAlchemy
- Database: PostgreSQL (Supabase recommended)

## Project Structure

- `src/`: frontend app
- `backend/app/`: FastAPI routes and services
- `backend/db/`: SQLAlchemy models and DB session config

## 1) Environment Setup

### Frontend (`.env`)

Copy `.env.example` to `.env` and keep:

```env
VITE_API_URL=/api/v1
VITE_BACKEND_URL=http://127.0.0.1:8000
```

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and set Supabase:

```env
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
ALLOW_SQLITE_FALLBACK=false
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173,https://vehicle-platform-one.vercel.app
```

Notes:

- Use Supabase transaction pooler URL on port `6543`.
- If your URL starts with `postgres://`, backend auto-converts it to `postgresql://`.

## 2) Install Dependencies

Frontend:

```bash
npm install
```

Backend:

```bash
cd backend
pip install -r requirements.txt
```

## 3) Run Locally

Start backend (from repo root):

```bash
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start frontend (from repo root):

```bash
npm run dev
```

Open:

- Frontend: `http://localhost:8080`
- API health: `http://127.0.0.1:8000/health`

## 4) Common Issues

### White blank screen

If you hit a blank screen, check these first:

- Frontend env has `VITE_API_URL=/api/v1`.
- Backend is running on `127.0.0.1:8000`.
- Browser console for runtime errors.

This project now includes an app-level error boundary so runtime crashes show a fallback UI instead of a silent blank page.

### Supabase not connecting

- Confirm `DATABASE_URL` is set in `backend/.env`.
- Set `ALLOW_SQLITE_FALLBACK=false` to force fast failure.
- Ensure IP/network policy allows your machine.

## 5) Verification

```bash
npm run test
npm run build
```

Both should pass before deployment.

## 6) Deploy Backend On Hugging Face Spaces

The production backend runs on Hugging Face Spaces:

```text
https://seo292-vehicle-platform-backend.hf.space
```

After deploy, verify:

```bash
curl https://seo292-vehicle-platform-backend.hf.space/health
curl https://seo292-vehicle-platform-backend.hf.space/api/v1/stats/summary
```

## 7) Connect Vercel Frontend To Hugging Face Backend

In Vercel Project Settings -> Environment Variables, set:

```env
VITE_API_URL=https://seo292-vehicle-platform-backend.hf.space/api/v1
```

Then redeploy frontend in Vercel. Your live stats/map/listings/trends should populate once API calls target Hugging Face.

## 8) Make Deployments Fully Automatic

After one-time setup, every push updates production automatically.

### CI

Every push to `main` and every pull request runs [ci.yml](.github/workflows/ci.yml): frontend typecheck/lint/test/build and backend pytest. Deploys are handled separately by Vercel's Git integration and `deploy-hf-backend.yml` — CI does not deploy anything.

### Backend auto-deploy (GitHub -> Hugging Face Spaces)

This repo includes [deploy-hf-backend.yml](.github/workflows/deploy-hf-backend.yml). It syncs backend code to the Hugging Face Space when backend files change on `main`.

### Frontend auto-deploy (GitHub -> Vercel)

Use Vercel Git integration:

1. In Vercel project settings, connect this GitHub repo.
2. Set production branch to `main`.
3. Keep auto deploy enabled.
4. Set env var:

```env
VITE_API_URL=https://seo292-vehicle-platform-backend.hf.space/api/v1
```

Now pushes to `main` will:

1. Auto deploy backend to Hugging Face Spaces (if backend files changed).
2. Auto deploy frontend to Vercel (if frontend files changed).

### Optional: trigger Vercel redeploy even when only backend changes

Normally not required because frontend calls the same backend URL, but if needed you can manually click "Redeploy" in Vercel Deployments.

### Real Pro authentication (optional)

The backend ships an env-configured auth layer. Set on the backend:

```env
AUTH_TOKEN_SECRET=<long-random-string>
AUTH_USERS=[{"email":"owner@example.com","password_sha256":"<hex>","name":"Owner","plan":"enterprise","subscription_status":"active"}]
PRO_ACCESS_ENFORCED=true
```

Generate a password hash with:

```bash
python -c "import hashlib; print(hashlib.sha256(b'your-password').hexdigest())"
```

Then set `VITE_ENABLE_BACKEND_AUTH=true` on the frontend build. Sign-in
goes through `POST /api/v1/auth/login`, the issued bearer token is sent
on every `/api/v1/pro/*` call, and with `PRO_ACCESS_ENFORCED=true` those
endpoints reject requests without a valid pro/enterprise token. With the
flag unset, Pro endpoints stay public (previous behaviour).

### In-Space scheduler is off by default

The backend also ships an optional APScheduler-based sync
(`DAILY_SYNC_ENABLED`, default `false`). GitHub Actions is the single
owner of scraping; only enable the in-process scheduler on deployments
that have no external scrape runner, because Playwright competes with
API traffic for the container's memory.

## 9) Run Daily Scraping In GitHub Cloud

This repo now includes `.github/workflows/daily-scrape.yml` to run scraping in GitHub Actions (no local data/wifi usage from your side).

It supports:

- **Scheduled run**: daily at 02:00 UTC (7:30 AM Sri Lanka time)
- **Manual run**: GitHub -> Actions -> **Unified Vehicle Scraper** -> **Run workflow**
- **Independent source jobs**: every source runs as its own matrix job so one source cannot stop the others

### One-time GitHub setup

In GitHub repo -> **Settings** -> **Secrets and variables** -> **Actions**, add secret:

- `HOT_DATABASE_URL` = your production PostgreSQL/Supabase URL

Notes:

- Page depth and per-source timeouts are pinned inside the workflow file
  (`SCRAPE_MAX_PAGES: 20`, 6h timeout per source) — edit
  `.github/workflows/daily-scrape.yml` to change them.
- Workflow forces `ALLOW_SQLITE_FALLBACK=false` so it fails fast if DB config is missing.
- Playwright dependencies and Chromium are installed inside the runner automatically.
- The workflow uses `SCRAPE_ENABLED_SOURCES` internally so each job runs only one source.
