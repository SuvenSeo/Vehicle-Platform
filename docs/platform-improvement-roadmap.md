# AutoLens LK Platform Improvement Roadmap

Last updated: 2026-07-13. Live inventory baseline: **131,913 listings** across **11 sources**.

## Completed on `cursor/nonblocking-fixes-and-review-2000`

### P0 — Data trust & scale (all done)
- Ingest-time district normalization + `backfill_districts.py`
- Cross-source deduplication (`RUN_DEDUP=true` in CI)
- Bulk SQL deal-score refresh (`RUN_DEAL_SCORE_REFRESH=true` in CI)
- Stats materialized cache (`RUN_STATS_CACHE_REFRESH=true` in CI)
- Price recovery job (`RUN_PRICE_RECOVERY=true` in CI)

### P1 — Product differentiation
- Hybrid tax arbitrage index on Trends (cc-band medians + excise cliff)
- Post-freeze depreciation cohorts (`/stats/import-era-split`, Pro Trends chart)
- EV share tracker (`/stats/ev-insight`, EV Hub TCO vs Aqua)
- District demand velocity map on Dashboard
- Market signals strip + `RUN_MARKET_SIGNALS=true` in CI

### P1 — UX & growth
- Server-side market alerts (`/alerts`) + post-scrape matcher (`RUN_ALERT_MATCH=true` in CI)
- Programmatic SEO `/cars/:make/:model` hubs + chunked sitemap index
- Rich listing JSON-LD with district `areaServed`
- Mobile bottom nav + mobile filter sheet
- Sinhala/Tamil i18n foundation (EN/SI/TA locale switcher)

### P2 — Pro & dealer
- Pro auth enforcement (`PRO_ACCESS_ENFORCED` / `VITE_PRO_ACCESS_ENFORCED`)
- Source quality scorecard on Pro Sources tab
- Arbitrage scanner (`/pro/arbitrage-gaps`)
- Dealer inventory URL benchmark (`/dealer/benchmark-urls`)
- Weekly Pro email digest scaffold (`send_pro_digest.py`, Monday cron workflow)

### P3 — Infrastructure
- Thumbnail CDN cache (`thumbnail_url_cached`, `RUN_THUMBNAIL_CACHE=true` in CI)
- SSE connection limits (`SSE_MAX_CONNECTIONS`, 503 when capped)
- Chunked listing sitemap for 131k URLs

### Hygiene & accuracy
- ESLint / audit / browserslist; `.env.example`; `utc_now()` + Pydantic `ConfigDict`
- True district medians; MoM "Building history"; freshness UX; Dealer dashboard live APIs

## Completed — Market decision features (`cursor/market-decision-features-2000`)

- Cash-to-own CBSL LTV strip + LeaseCalculator LTV warnings
- Hybrid 1,500cc excise cliff badges on cards/detail
- Mileage trust anomaly chips (km/year vs cohort)
- Public import-era cohorts + Pro arbitrage teaser on Trends

## Remaining (ops activation)

| Item | Notes |
|------|-------|
| Flip Pro enforcement in deploy | Set `PRO_ACCESS_ENFORCED=true` (HF) + `VITE_PRO_ACCESS_ENFORCED=true` (Vercel) |
| Live weekly digest email | Add GitHub secrets `SENDGRID_API_KEY` + `DIGEST_RECIPIENTS` |
| Province-level heatmap | District velocity done; aggregate provinces |
| Full i18n coverage | Foundation only — extend to all pages |
| Redis pub/sub for SSE | Connection cap in place; full Redis fan-out optional |
| Physical thumbnail download | CDN proxy URLs stored; binary cache optional |
| `httpx2` migration | Wait for stable release |

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

1. `npm run typecheck && npm run lint && npm run test` — 261 tests
2. `npm run build`
3. `cd backend && python3 -m pytest tests/ -q` — 394 tests
4. Spot-check `/api/v1/stats/summary` and `/api/v1/stats/live`
