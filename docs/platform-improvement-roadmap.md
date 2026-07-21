# Motormila Platform Improvement Roadmap

Last updated: 2026-07-21. Live inventory across **13 sources**.

## Shipped on `main` (Jul 19–21)

### Hardening & P1
- Security headers, CORS guard, pro `subscription_status`, B2B timing-safe keys
- Stats cache (summary/trends/insights/price-index), composite + `pg_trgm` indexes
- Slack scrape-failure hooks, optional scraper proxy/UA/stealth
- Granular React Query staleTime, CID surcharge notify, sitemap `content_updated_at`
- SEO hubs `/cars/:make` + `/locations/:district`, HF keep-alive cron

### P2 backlog (`cursor/audit-backlog-p2-d670`)
- HttpOnly `mm_session` cookie auth (+ Bearer fallback / logout clear)
- Twilio WhatsApp notify on alert match deltas (`notify_phone`)
- Fair Market Value badges + `GET /listings/{id}/fmv`
- Dealer claim-profile (`/dealer/claim`, `/dealer/me`) + dashboard card
- SI/TA i18n for hero, alerts, calculator, make hub
- Ops activation docs in `.env.example` / `backend/.env.example`

## Remaining ops activation (secrets — not code)

| Item | Where |
|------|-------|
| `PRO_ACCESS_ENFORCED` / `VITE_PRO_ACCESS_ENFORCED` | HF + Vercel |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | HF + Vercel |
| `SLACK_WEBHOOK_URL` | GitHub Actions secret |
| `TWILIO_ACCOUNT_SID` / `AUTH_TOKEN` / `WHATSAPP_FROM` | HF (WhatsApp alerts) |
| `SCRAPE_PROXY_*` / `SCRAPE_STEALTH` | HF / GHA when banned |
| `SENDGRID_API_KEY` + `DIGEST_RECIPIENTS` | Weekly Pro digest |

## Optional later

| Item | Notes |
|------|-------|
| True ML FMV (XGBoost) | Heuristic FMV badges already ship via cohort median |
| Full SI/TA page coverage | High-visibility surfaces done; extend page-by-page |
| pHash background queue | Sync `RUN_IMAGE_PHASH` fine until bottleneck |
| Dealer verified badge / billing | Claim flow is the foundation |

## Verification

1. `npm run typecheck && npm run lint && npm run test`
2. `npm run build`
3. `cd backend && ALLOW_SQLITE_FALLBACK=true pytest tests/ -q`
4. Spot-check `/health`, `/cars/toyota`, `/dealer`, `/alerts`, Calculator notify
