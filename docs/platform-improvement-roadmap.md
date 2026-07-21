# Motormila Platform Improvement Roadmap

Last updated: 2026-07-21. Live inventory baseline: **131,913+ listings** across **13 sources**.

## Completed — Audit hardening wave (Jul 19–21)

### Merged to `main`
- **PR #40** masterplan hardening: security headers, CORS wildcard guard, pro `subscription_status`, timing-safe B2B keys, pipeline DEGRADED + Slack scrape alerts, composite indexes + `pg_trgm`, stats cache for trends/insights/price-index, optional scraper proxy/UA/stealth (`SCRAPE_*` env), Sentry error-boundary reporting, a11y smoke test
- **PR #39** navbar seam fix + `AGENTS.md`
- Earlier audit PRs **#30–#34**: demand-velocity harden, stack-overflow fix, full audit harden, pooler statement timeout, cleanup/rebrand
- Scrapers **#35–#38**: HitAd/Cartivate, ikman API + multi-vehicle, homepage cars-only, category filters

### Shipped on `cursor/audit-backlog-p1-d670` (this wave)
- Granular React Query `QUERY_STALE` (listings 10s / stats 60s / hub 2m / market 5m)
- CID surcharge “Notify me when it drops” reminder (local preference + one-shot toast)
- Sitemap `lastmod` driven by `content_updated_at` (price/status changes only)
- Programmatic SEO hubs: `/cars/:make`, `/locations/:district` (+ `/stats/make-insight`)
- HF keep-alive workflow (cron every 10 minutes → `/health`)

## Still remaining (ops / product)

| Priority | Item | Notes |
|----------|------|-------|
| P0 ops | Flip Pro enforcement in deploy | `PRO_ACCESS_ENFORCED` + `VITE_PRO_ACCESS_ENFORCED` |
| P0 ops | Activate Sentry | `SENTRY_DSN` + `VITE_SENTRY_DSN` |
| P0 ops | Slack scrape alerts | GitHub secret `SLACK_WEBHOOK_URL` (wired in #40) |
| P0 ops | Proxy rotation when banned | Set `SCRAPE_PROXY_URL` / `SCRAPE_PROXIES` + `SCRAPE_ROTATE_UA` / `SCRAPE_STEALTH` |
| P1 | HTTP-only cookie auth | Today: Bearer token in `localStorage` |
| P1 | Full SI/TA i18n coverage | Foundation exists; extend page-by-page |
| P2 | WhatsApp price-drop alerts | Twilio / Meta Business API |
| P2 | ML Fair Market Value model | Heuristic deal badges already ship |
| P2 | Dealer claim-profile SaaS | Dashboard + URL benchmark exist |
| P3 | pHash background queue | Sync path via `RUN_IMAGE_PHASH` is fine until bottleneck |
| Skip | `vite-plugin-compression` | Vercel already serves Brotli/gzip |
| Skip | SQLAlchemy `pool_size` | `NullPool` behind Supabase pooler is intentional |

## Nightly CI pipeline (`market-analysis` job)

```
RUN_MARKET_ANALYSIS=true
RUN_MARKET_SIGNALS=true
RUN_DEAL_SCORE_REFRESH=true
RUN_STATS_CACHE_REFRESH=true
RUN_DEDUP=true
RUN_PRICE_RECOVERY=true
RUN_ALERT_MATCH=true
RUN_THUMBNAIL_CACHE=true
```

## Verification checklist

1. `npm run typecheck && npm run lint && npm run test`
2. `npm run build`
3. `cd backend && ALLOW_SQLITE_FALLBACK=true pytest tests/ -q`
4. Spot-check `/api/v1/stats/summary`, `/cars/toyota`, `/locations/Colombo`
