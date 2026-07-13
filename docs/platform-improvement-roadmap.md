# AutoLens LK Platform Improvement Roadmap

Last updated: 2026-07-13. Live inventory baseline: **131,913 listings** across **11 sources**.

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

## P0 — Data trust & scale

| Item | Why | Approach |
|------|-----|----------|
| Ingest-time district normalization | Stops city strings polluting map/stats | Normalize in `CarCleaner` + backfill job |
| Cross-source deduplication | Double-counting inflates supply metrics | Fuzzy match on make/model/year/price/mileage |
| Deal-score SQL bulk update | 131k+ row Python loop risks HF memory | JOIN to latest `PriceAggregate`, batch UPDATE |
| Stats materialized cache | Heavy aggregates on every request | `market_stats_cache` refreshed post-scrape |
| Price recovery job | 528 unpriced listings | Nightly re-scrape of `price_lkr IS NULL` rows |

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
| Programmatic SEO pages | 131k listings, only 5k in sitemap | `/cars/:make-:model` hubs + sitemap index |
| Rich listing JSON-LD | Generic meta hurts search CTR | Pass make/model/price into `ListingDetail` schema |
| Mobile bottom nav | Filters hidden on small screens | Sheet filters + tab bar |
| Sinhala/Tamil i18n | Mass-market adoption | Settings-driven locale for districts/currency |

## P2 — Pro & dealer monetization

| Item | Why | Approach |
|------|-----|----------|
| Pro auth enforcement in prod | Gate exports and lane drill-downs | `PRO_ACCESS_ENFORCED=true` on HF + Vercel |
| Source quality scorecard | Dealers choose listing venues | Per-source price fill, freshness, outlier rates |
| Arbitrage scanner | Cross-district gaps are actionable | Pro lane comparing district medians |
| Dealer inventory upload | Mock dealer dashboard replaced — extend | Paste stock URLs → benchmark vs market |
| Weekly Pro email digest | Retention for paid users | Saved lanes + movement alerts |

## P3 — Infrastructure

| Item | Why | Approach |
|------|-----|----------|
| Thumbnail CDN cache | External images break/slow | Persist thumbnails during scrape |
| SSE connection limits | `/stats/live/stream` opens DB every 10s | Redis pub/sub or cap concurrent streams |
| Sitemap chunking | 131k URLs exceed single sitemap cap | `sitemap-listings-N.xml` index |
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
