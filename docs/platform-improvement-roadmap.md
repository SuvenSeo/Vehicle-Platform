# Motormila Platform Improvement Roadmap

Last updated: 2026-07-28. Live inventory across **13 sources**.

## Wave 0 — Platform hardening (branch `cursor/platform-hardening-phases-0a52`) — in progress

### Analytics
- `POST /api/v1/events` — public, rate-limited (60/min) append-only analytics endpoint
- `analytics_events` table (`db/models.py` + `db/schema_patches.py`), idempotent CREATE
- `src/lib/analytics.ts` — `trackEvent(name, props?)` fire-and-forget utility with session ID
- Client-side calls added: `listing_viewed` (ListingDetail), `alert_created` (useServerMarketAlerts), `search_submit` (Dashboard hero), `dealer_claim_success` (DealerDashboard)
- Backend tests: `tests/test_analytics_events.py` (persist, strip, rate-limit, recovery)

### Scrape checkpoint
- `backend/app/utils/scrape_checkpoint.py` — `create_scrape_checkpoint(db, source)` and `validate_post_scrape(db, source, checkpoint)`
- Mass-deactivation guard (>50 % listing drop) and price anomaly guard (>50 % avg shift)
- Wired into `run_sync.py` `_run_source` — pre/post checkpoint sessions, warnings logged via structlog, never aborts

## Shipped on `main` (Jul 19–21)

### Hardening & P1
- Security headers, CORS guard, pro `subscription_status`, B2B timing-safe keys
- Stats cache (summary/trends/insights/price-index), composite + `pg_trgm` indexes
- Slack scrape-failure hooks, optional scraper proxy/UA/stealth
- Granular React Query staleTime, CID surcharge notify, sitemap `content_updated_at`
- SEO hubs `/cars/:make` + `/locations/:district`, HF keep-alive cron

### P2 (shipped)
- HttpOnly `mm_session` cookie auth (+ Bearer fallback / logout clear)
- `/auth/me` session bootstrap + `credentials: include` on API client
- Twilio WhatsApp notify on alert match deltas (`notify_phone`, row badge + validation)
- Fair Market Value badges on cards + listing detail + `GET /listings/{id}/fmv`
- Dealer claim-profile (`/dealer/claim`, `/dealer/me`) with seller pattern + URL
- SI/TA i18n for hero, alerts, calculator, make hub
- Ops activation docs in `.env.example` / `backend/.env.example`

### Optional-later (this wave)
- Multi-feature OLS FMV (`method: ols_comps|adjusted_median|cohort_median`)
- pHash background job queue (`image_phash_jobs` + threaded drain)
- Dealer verified badge + billing fields + `POST /dealer/verify`
- Pro write CSRF: Bearer required + trusted Origin/Referer
- Expanded SI/TA coverage: nav, sign-in, Pro gate, dealer, listing, pricing, home pulse
- Historical asking-price backfill (Wayback/CC → `historical_price_observations`) — see `docs/historical-price-data-sources.md`

### Hotfixes
- `require_pro_access(request: Request)` — Optional[Request] broke FastAPI startup / B2B CI

## Phase 7 backlog (Ardeno deferred epics) — shipped 2026-07-23

| Epic | Delivered |
|------|-----------|
| B1 Scraper field enrichment | Cleaner canonicalize + Auto/hatch/PHEV/CVT/`brand_new` aliases; junk structured reset; riyasewana richer blobs |
| B2 Scraper guard fixtures | `tests/fixtures/scraper_payloads/*` + `test_scraper_payload_guards.py` |
| B3 Frontend test warnings | `TestRouter` future flags; async flush for Alerts / MobileFilterSheet act noise |
| B4 Bundle / code-splitting | Dashboard sub-lazies; pdf/report/form `manualChunks`; leaflet CSS deferred; FeedbackWidget lazy |
| B5 Repo hygiene | browserslist/`caniuse-lite` bump; `.gitignore` py/tooling cache coverage |

## Remaining ops activation (secrets — not code)

| Item | Where |
|------|-------|
| `PRO_ACCESS_ENFORCED` / `VITE_PRO_ACCESS_ENFORCED` | HF + Vercel |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | HF + Vercel |
| `SLACK_WEBHOOK_URL` | GitHub Actions secret |
| `TWILIO_ACCOUNT_SID` / `AUTH_TOKEN` / `WHATSAPP_FROM` | HF (WhatsApp alerts) |
| `DEALER_ADMIN_TOKEN` | HF (verify yards) |
| `SCRAPE_PROXY_*` / `SCRAPE_STEALTH` | HF / GHA when banned |
| `SENDGRID_API_KEY` + `DIGEST_RECIPIENTS` | Weekly Pro digest |

## Verification

1. `npm run typecheck && npm run lint && npm run test`
2. `npm run build`
3. `cd backend && ALLOW_SQLITE_FALLBACK=true pytest tests/ -q`
4. Spot-check `/health`, `/cars/toyota`, `/dealer`, `/alerts`, Calculator notify, language switch SI/TA
