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
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
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

- Frontend env has `VITE_API_URL=/api`.
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

## 6) Deploy Backend On Fly.io

This repo now includes `backend/Dockerfile` and `backend/fly.toml` for Fly deployment.

From repo root:

```bash
cd backend
fly auth login
fly launch --no-deploy
```

Set required backend secrets:

```bash
fly secrets set DATABASE_URL="postgresql://..." \
  CORS_ORIGINS="https://vehicle-platform-one.vercel.app" \
  ALLOW_SQLITE_FALLBACK="false"
```

Deploy:

```bash
fly deploy
```

After deploy, verify:

```bash
curl https://<your-fly-app>.fly.dev/health
curl https://<your-fly-app>.fly.dev/api/v1/stats/summary
```

## 7) Connect Vercel Frontend To Fly Backend

In Vercel Project Settings -> Environment Variables, set:

```env
VITE_API_URL=https://<your-fly-app>.fly.dev/api/v1
```

Then redeploy frontend in Vercel. Your live stats/map/listings/trends should populate once API calls target Fly.

## 8) Make Deployments Fully Automatic

After one-time setup, every push updates production automatically.

### Backend auto-deploy (GitHub -> Fly.io)

This repo includes [deploy-backend-fly.yml](.github/workflows/deploy-backend-fly.yml). It deploys the backend whenever `backend/**` changes on `main`.

One-time setup in GitHub:

1. Generate Fly token:

```bash
fly auth token
```

1. In GitHub repo -> Settings -> Secrets and variables -> Actions, add:

- `FLY_API_TOKEN` = output of `fly auth token`

1. Confirm your Fly app is initialized once (`fly launch --no-deploy`) and `backend/fly.toml` app name matches your real Fly app.

### Frontend auto-deploy (GitHub -> Vercel)

Use Vercel Git integration:

1. In Vercel project settings, connect this GitHub repo.
2. Set production branch to `main`.
3. Keep auto deploy enabled.
4. Set env var:

```env
VITE_API_URL=https://<your-fly-app>.fly.dev/api/v1
```

Now pushes to `main` will:

1. Auto deploy backend to Fly (if backend files changed).
2. Auto deploy frontend to Vercel (if frontend files changed).

### Optional: trigger Vercel redeploy even when only backend changes

Normally not required because frontend calls the same backend URL, but if needed you can manually click "Redeploy" in Vercel Deployments.

## 9) Run Daily Scraping In GitHub Cloud

This repo now includes `.github/workflows/daily-scrape.yml` to run scraping in GitHub Actions (no local data/wifi usage from your side).

It supports:

- **Scheduled run**: 12:10 AM and 12:10 PM Sri Lanka time
- **Manual run**: GitHub -> Actions -> **Daily Vehicle Scraper** -> **Run workflow**
- **Independent source jobs**: Ikman, Riyasewana, and Patpat run as separate jobs so one source cannot stop the others

### One-time GitHub setup

In GitHub repo -> **Settings** -> **Secrets and variables** -> **Actions**:

1. Add secret:

- `DATABASE_URL` = your production PostgreSQL/Supabase URL

1. (Optional) Add repository variables:

- `SCRAPE_MAX_PAGES` = global page depth fallback (default is `500`)
- `SCRAPE_MAX_PAGES_IKMAN` = Ikman page depth override
- `SCRAPE_MAX_PAGES_RIYASEWANA` = Riyasewana page depth override
- `SCRAPE_MAX_PAGES_PATPAT` = Patpat page depth override
- `SCRAPE_SOURCE_TIMEOUT_SECONDS_IKMAN` = per-source timeout in seconds (default `1800`)
- `SCRAPE_SOURCE_TIMEOUT_SECONDS_RIYASEWANA` = per-source timeout in seconds (default `1800`)
- `SCRAPE_SOURCE_TIMEOUT_SECONDS_PATPAT` = per-source timeout in seconds (default `1800`)

Notes:

- Workflow forces `ALLOW_SQLITE_FALLBACK=false` so it fails fast if DB config is missing.
- Playwright dependencies and Chromium are installed inside the runner automatically.
- The workflow uses `SCRAPE_ENABLED_SOURCES` internally so each job runs only one source.

## 10) Run Alternate Sources In Parallel

This repo also includes `.github/workflows/alt-sources-scrape.yml`.

It currently runs this source as an independent job:

- `PatpatScraper` (`patpat.lk`)

Each job sets `SCRAPE_ENABLED_SOURCES` so one source failure/timeout does not block the others.  
Within each job, `backend/run_alt_sync.py` scrapes enabled source(s) and then refreshes aggregates/deal scores.

### Trigger options

- Manual: GitHub -> Actions -> **Alternate Sources Scraper** -> **Run workflow**

### Optional tuning

Add repository variable in GitHub Actions:

- `SCRAPE_MAX_PAGES_ALT` (default: `500`)
- `SCRAPE_SOURCE_TIMEOUT_SECONDS_ALT` (default: `1800`)
- `SCRAPE_SOURCE_TIMEOUT_SECONDS_PATPAT` (optional source-specific override)
