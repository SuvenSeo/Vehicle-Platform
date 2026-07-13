# AutoLens LK Platform Improvement Roadmap

Last updated: 2026-07-13. Live inventory baseline: **131,913 listings** across **11 sources**.

## Completed — Pro auth enforcement

- **`PRO_ACCESS_ENFORCED` backend env var** — `backend/app/api/v1/endpoints/auth.py` exposes `pro_access_enforced()` (reads `PRO_ACCESS_ENFORCED`; default off) and `require_pro_access()` FastAPI dependency that returns a `401` when no token is supplied and a `403` when the token's plan is not `pro`/`enterprise`.  Applied as a router-level dependency in `backend/app/api/v1/api.py` so every `/api/v1/pro/*` route is covered automatically.
- **`VITE_PRO_ACCESS_ENFORCED` frontend env var** — Documented in `.env.example`.  `PRO_EXPORTS_ENFORCED` constant exported from `src/lib/authContext.tsx` is `true` when `VITE_PRO_ACCESS_ENFORCED=true` **or** when Vite runs a production build (`import.meta.env.PROD`).
- **`ProDashboard` export gate** — `ExportButtons` in `src/pages/ProDashboard.tsx` checks `PRO_EXPORTS_ENFORCED` before triggering any download.  Unauthenticated users or free-plan holders see a Sonner toast ("Pro subscription required") with a "Sign in" action that navigates to `/sign-in`.  When enforcement is off (local / preview), behaviour is unchanged.
- **Tests** — `backend/tests/test_pro_access.py` adds 6 pytest tests (env monkeypatching): default-off, truthy strings, no-op when unenforced, 401 on missing token, 403 on free-plan token, pass on valid Pro token.  All 207 backend tests continue to pass.

## Completed — Price recovery job

- **`RUN_PRICE_RECOVERY` backend env var** — `backend/run_sync.py` reads `RUN_PRICE_RECOVERY` (default `false`).  When `true`, calls `recover_missing_prices()` from `backend/scripts/recover_missing_prices.py` after every nightly scrape cycle with `dry_run=False, mark_retry=True`: finds `price_lkr IS NULL` listings seen within the last 7 days, writes a JSON retry manifest to `/tmp/`, and touches `last_seen_at` to flag them for re-evaluation on the next pass.
- **Nightly CI step** — `RUN_PRICE_RECOVERY: "true"` added to the `market-analysis` job in `.github/workflows/daily-scrape.yml` so recovery runs once after all scrape-source shards finish.
- **Tests** — `backend/tests/test_price_recovery.py` adds 15 pytest tests covering `find_missing_price_listings`, `recover_missing_prices` (dry-run, mark-retry, report-only), and the `run_sync` hook (enabled, disabled, absent, exception-tolerance) via monkeypatching.

## Completed — Post-scrape job flags enabled in CI

Three post-scrape processing jobs are now activated via env vars in the `market-analysis` CI job (`.github/workflows/daily-scrape.yml`):

- **`RUN_DEAL_SCORE_REFRESH: "true"`** — triggers the bulk SQL deal-score update after every nightly scrape, replacing the Python-loop approach that risked OOM on 131k+ rows.
- **`RUN_STATS_CACHE_REFRESH: "true"`** — refreshes the `market_stats_cache` materialized snapshot post-scrape so heavy aggregate queries are not computed on every API request.
- **`RUN_DEDUP: "true"`** — runs cross-source deduplication (fuzzy match on make/model/year/price/mileage) to remove double-counted supply metrics.

All three flags are set on the `market-analysis` job, which runs once after all `scrape-source` matrix shards complete (`needs: scrape-source`, `if: always()`).

## Completed on `cursor/nonblocking-fixes-and-review-2000`

- ESLint / audit / browserslist hygiene
- Frontend `.env.example`
- Backend `utc_now()` + Pydantic `ConfigDict`
- District normalization for `districts_covered`
- Live `active_scrape_sources` includes recent SUCCESS runs
- Dashboard freshness UX (`Data as of`, stale banner)
- True district medians in `/stats/district-prices` and `/stats/district-insight`
- Trending `movement_pct` uses real 30d price change
- Dealer dashboard wired to live APIs
- Hybrid 1,500cc excise cliff callout
- Market signals strip on dashboard
- MoM null shows "Building history" instead of `0.0%`
- Ingest-time district normalization in `CarCleaner`
- District backfill script (`backend/scripts/backfill_districts.py`)
- Chunked listing sitemap index (131k-scale SEO)
- Rich listing JSON-LD with district `areaServed`

## P0 — Data trust & scale

| Item | Why | Approach |
|------|-----|----------|
| Ingest-time district normalization | Stops city strings polluting map/stats | ~~Normalize in `CarCleaner`~~ + backfill job |
| ~~Cross-source deduplication~~ | ~~Double-counting inflates supply metrics~~ | Fuzzy match on make/model/year/price/mileage — **`RUN_DEDUP=true` in CI** |
| ~~Deal-score SQL bulk update~~ | ~~131k+ row Python loop risks HF memory~~ | JOIN to latest `PriceAggregate`, batch UPDATE — **`RUN_DEAL_SCORE_REFRESH=true` in CI** |
| ~~Stats materialized cache~~ | ~~Heavy aggregates on every request~~ | `market_stats_cache` refreshed post-scrape — **`RUN_STATS_CACHE_REFRESH=true` in CI** |
| ~~Price recovery job~~ | ~~528 unpriced listings~~ | ~~Nightly re-scrape of `price_lkr IS NULL` rows~~ — **`RUN_PRICE_RECOVERY=true` in CI** |

## P1 — Product differentiation (Sri Lanka)

| Item | Why | Approach |
|------|-----|----------|
| Hybrid tax arbitrage index | ~80% imports are hybrids; 1,500cc cliff matters | Extend calculator + Trends with band comparisons |
| Post-freeze depreciation cohorts | Pre/post 2025 import freeze two-tier market | Tag listings by era; chart median spread in Pro |
| EV share tracker | EV ~10% of 2025 imports | EV Hub live share + TCO vs Aqua |
| Regional demand heatmap | Western vs Southern growth patterns | Province-level velocity score on map |
| Market signals schedule | DMT/customs data exists but sparse in UI | Enable `RUN_MARKET_SIGNALS` in daily sync |

## P1 — UX & growth

| Item | Why | Approach |
|------|-----|----------|
| Server-side market alerts | Alerts are localStorage-only today | `POST /alerts` + post-scrape matcher |
| Programmatic SEO pages | 131k listings, only 5k in sitemap | `/cars/:make-:model` hubs + ~~sitemap index~~ |
| Rich listing JSON-LD | Generic meta hurts search CTR | Pass make/model/price into `ListingDetail` schema |
| Mobile bottom nav | Filters hidden on small screens | Sheet filters + tab bar |
| Sinhala/Tamil i18n | Mass-market adoption | Settings-driven locale for districts/currency |

## P2 — Pro & dealer monetization

| Item | Why | Approach |
|------|-----|----------|
| ~~Pro auth enforcement in prod~~ | ~~Gate exports and lane drill-downs~~ | ~~`PRO_ACCESS_ENFORCED=true` on HF + Vercel~~ — **done** |
| Source quality scorecard | Dealers choose listing venues | Per-source price fill, freshness, outlier rates |
| Arbitrage scanner | Cross-district gaps are actionable | Pro lane comparing district medians |
| Dealer inventory upload | Mock dealer dashboard replaced — extend | Paste stock URLs → benchmark vs market |
| Weekly Pro email digest | Retention for paid users | Saved lanes + movement alerts |

## P3 — Infrastructure

| Item | Why | Approach |
|------|-----|----------|
| Thumbnail CDN cache | External images break/slow | Persist thumbnails during scrape |
| SSE connection limits | `/stats/live/stream` opens DB every 10s | Redis pub/sub or cap concurrent streams |
| Sitemap chunking | 131k URLs exceed single sitemap cap | ~~`sitemap-listings-N.xml` index~~ |
| `httpx2` migration | Starlette test client deprecation | Add dev dependency when stable |

## Research references

- Sri Lanka hybrid excise bands and 1,500cc cliff (Gazette-driven duty structure)
- Post-import-freeze two-tier used market (2025–2026 price floor shifts)
- EV import share growth and registration-fee incentives
- Western/Southern province used-car volume concentration

## Verification checklist for future PRs

1. `npm run typecheck && npm run lint && npm run test`
2. `npm run build`
3. `cd backend && python3 -m pytest tests/ -q`
4. Spot-check production `/api/v1/stats/summary` and `/api/v1/stats/live`
