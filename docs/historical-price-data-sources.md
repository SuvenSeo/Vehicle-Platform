# Historical vehicle price data for Motormila (2000s–2026)

Research summary for building **longitudinal** Sri Lanka used-vehicle price history — not just “price by manufacture year from today’s ads.”

Motormila already scrapes **live** listings (13 sources), writes `vehicle_price_history` on price changes, and rolls monthly `price_aggregates`. That grows a real archive **from now forward**. Going back to the 2000s requires separate backfills.

## Critical distinction

| Concept | What it is | Motormila today |
| --- | --- | --- |
| **Manufacture-year cross-section** | What a 2014 Aqua costs *today* vs a 2020 Aqua | Live scrapers + PriceMart-style charts |
| **Calendar-time history** | What a 2014 Aqua cost in *Jan 2018* vs *Jan 2024* | Only since Motormila started scraping; needs archive backfill |

Without dated observations, predictions and “how the market changed” charts are incomplete.

## Reality check: no single 2000–2026 listing dump

There is **no public, complete make/model retail time series** for Sri Lanka covering 2000–2026. Competitors (e.g. PriceMart) also scrape **live** ikman/riyasewana daily — they do not magically own 25 years of listing history.

What *is* recoverable varies by era:

| Era | Best sources | Density | Notes |
| --- | --- | --- | --- |
| **~2017–2026** | Wayback Machine category/brand SERPs; Common Crawl WARCs; Motormila live scrape (ongoing) | Medium–high | Real asking prices extractable from archived HTML |
| **~2010–2016** | Wayback on riyasewana / auto-lanka / early ikman; sparse Common Crawl | Low–medium | Homepage + some vehicle pages; fewer full SERPs |
| **~2000–2009** | Sunday Times / newspaper classifieds; CBSL/DMT macro series; journalist market pieces | Sparse | Ad-level prices exist in print archives but need OCR/manual harvest; not a full market sample |
| **Any era (proxies)** | DMT registrations/transfers; CBSL transport CPI + FX; USS Japan auction averages; Customs tariff/duty schedules | High (aggregate) | Excellent for regime shifts (import ban, crisis, duty changes) — not substitute for listing medians |

## Source inventory (verified / probed)

### A. Archive web (primary backfill for retail asking prices)

**Internet Archive Wayback Machine**

- `ikman.lk` domain captures from **2012**; cars category SERPs with extractable cards from **~2017**.
- Sample probe (`ikman.lk/en/ads/sri-lanka/cars`, HTTP 200): roughly **34 / 1 / 35 / 59 / 51 / 54 / 28** snapshots in 2017 / 2019 / 2021 / 2022 / 2023 / 2024 / 2025 (uneven; brand pages add more).
- **2017-01-07** raw snapshot contains listing cards with title, mileage, district, and `Rs …` prices (e.g. Toyota Allion 2014 @ Rs 4,500,000; Honda Vezel 2014 @ Rs 5,695,000).
- `riyasewana.com` domain from **2010**; `/search/cars` captures from **~2019**.
- `auto-lanka.com` / `patpat.lk` also archived (useful secondary).

**Common Crawl**

- Monthly indexes since ~2008; confirmed `ikman.lk` HTML in **2018** and **2020** crawls (mix of live ads + 410s).
- Use CDX → WARC range fetch (offset/length) — do **not** download whole WARCs.
- Good for filling months Wayback missed; noisier (all categories, redirects).

**Implementation in this repo**

- Parser + CDX client: `backend/app/services/historical_archive.py`
- Ops backfill: `backend/scripts/ops/backfill_wayback_prices.py`
- Storage: `historical_price_observations` (dated snapshots; **not** live `car_listings`)

Respect IA rate limits; prefer `id_` raw captures; dedupe on `(archive_source, source_id, observed_at)`.

### B. Official / macro (regime & volume signals)

Already partially wired via `MarketSignalImporter` (`backend/app/services/market_signals.py`):

| Source | URL / product | Use |
| --- | --- | --- |
| **DMT** | [Statistics](https://dmt.gov.lk/index.php?Itemid=132&id=16&lang=en&option=com_content&view=article) — population, monthly new regs, transfers, fuel type | Supply / churn; import-ban fingerprints |
| **NTC** | National Transport Statistics PDFs | Longer vehicle-population series (~2001+) |
| **CBSL** | ESS Ch.2 (new registrations), transport CPI, Monthly Bulletin | Deflate LKR prices; macro context |
| **Customs** | Chapter 87 tariff PDFs, tender sales | Duty/tax regime; seized-vehicle signals |

**Gap:** DMT PDFs are table-by-type, not make/model. Worth a PDF→`market_signals` parser (next step) rather than treating them as listing prices.

### C. Import / landed-cost proxies (Japan → SL)

Most SL “used” stock is Japan-origin. Useful for **import-era** modelling and FMV floors:

| Source | What you get |
| --- | --- |
| **USS IR monthly data** | Official average contracted auction price (¥), multi-year archives — [ussnet.co.jp monthly](https://www.ussnet.co.jp/en/ir/library/monthly/index.html) |
| **JP Sheet / exporters** | Model-level hammer samples (smaller, commercial) |
| **Motormila** | `import_price_snapshots` + tax calculator configs already exist |

Combine: auction ¥ × FX × duty stack ≈ synthetic landed cost timeline. Complements, does not replace, domestic asking prices.

### D. One-shot public datasets (bootstrap only)

| Dataset | Caveat |
| --- | --- |
| Kaggle “Sri Lanka vehicle ads” / second-hand car sets | Point-in-time scrapes; licenses vary; not a calendar time series |
| GitHub ML projects (ikman scrapes, predictors) | Often recent CSVs only; verify license before ingest |
| Academic papers (e.g. ICOBI fair-price RPA) | Tiny samples |

Use to seed models or QA parsers — **not** as “history from 2000.”

### E. Commercial APIs

- **Carapis** (and similar) expose live ikman parse APIs — history depth is product-dependent and paid.
- Do not rely on these for multi-decade backfill unless contracted with explicit archive rights.

### F. Newspaper classifieds (deep past)

- Sunday Times online archive spans **1996+**; historical “Cars for Sale” pages exist (e.g. 2006 ads with LKR prices).
- High effort (layout OCR, sparse coverage, selection bias). Best as **anecdotal anchors** for famous models / duty shocks, not primary index construction.

## What Motormila should build (phased)

### Phase 0 — Already shipping
- Daily multi-source scrape → `car_listings` + `vehicle_price_history`
- Monthly `price_aggregates` + Laspeyres-style `/stats/price-index`
- Market signal probes (DMT / Customs / import parity)

### Phase 1 — Wayback / CC backfill (this PR scaffolds)
1. CDX discovery for ikman (+ riyasewana) cars/brand SERPs, 2017→present.
2. Parse listing cards → `historical_price_observations`.
3. Rebuild monthly aggregates **including** archive rows (flag `observation_origin=archive|live`).
4. Surface “market then vs now” on make hubs / Pro insights.

### Phase 2 — Macro enrichment
1. Parse DMT monthly registration/transfer PDFs into `market_signals`.
2. Ingest CBSL transport CPI + USD/LKR for real-price series.
3. Ingest USS average auction ¥ as import-cost index.

### Phase 3 — Deep past (optional / selective)
1. Targeted Sunday Times / print harvest for flagship models (Aqua, Vitz, Alto, Premio).
2. Manual curation into observations with low confidence weights.
3. Never mix sparse 2005 newspaper points into high-confidence FMV without heavy Bayesian / prior constraints.

### Phase 4 — Product
- Long-horizon price index (mix-adjusted) spanning archive + live.
- “How prices moved through the import ban / 2022 crisis / 2025 reopening.”
- Predictions that condition on regime features (regs volume, FX, duty), not only recent comps.

## Legal / ops notes

- Prefer **public archives** and official stats over aggressive live historical scraping of sites’ private APIs.
- IA and Common Crawl: polite concurrency, caching, idempotent upserts.
- Do **not** insert archive rows into live `car_listings` as active inventory — that would poison velocity, deal scores, and maps.
- Asking prices ≠ transaction prices; label confidence accordingly.

## Bottom line

| Goal | Feasible? |
| --- | --- |
| Dense make/model asking-price history **~2017–2026** | **Yes** — Wayback + Common Crawl + Motormila live |
| Useful market **regime** history **2000–2026** | **Yes** — DMT + CBSL + FX + duty + USS |
| Complete listing-level history **2000–2016** | **No** as a full census; only sparse newspaper / early-web samples |
| “Insane” charts of how the market changed | **Yes** if we combine archive SERPs + macro signals + ongoing scrape — not if we wait for a mythical complete dump |

The highest-ROI next engineering step after this scaffold: run a rate-limited Wayback backfill for ikman cars + top brands (Toyota, Suzuki, Honda, Nissan) monthly from 2017–2026, then fold observations into `price_aggregates` / price-index.
