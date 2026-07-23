# Motormila Platform Improvement Roadmap

Last updated: 2026-07-23. Live inventory across **13 sources**.

## Shipped on `main` (Jul 19–21)

### Hardening & P1
- Security headers, CORS guard, pro `subscription_status`, B2B timing-safe keys
- Stats cache (summary/trends/insights/price-index), composite + `pg_trgm` indexes
- Slack scrape-failure hooks, optional scraper proxy/UA/stealth
- Granular React Query staleTime, CID surcharge notify, sitemap `content_updated_at`
- SEO hubs `/cars/:make` + `/locations/:district`, HF keep-alive cron

### P2 backlog
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
