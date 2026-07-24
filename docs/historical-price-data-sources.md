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
- FMV / deal scores / import-era split (do **not** reinvent a second `price_history` table)

### Phase 1 — Wayback / CC + seed imports (scaffolded in this branch)
1. CDX discovery for ikman (+ riyasewana) cars/brand SERPs, 2017→present.
2. Parse listing cards → `historical_price_observations`.
3. Kaggle/community CSV → same archive table (`scripts/ops/import_historical_csv.py`).
4. Curated DMT population/new-regs + policy flags → `market_signals` (`scripts/ops/seed_market_context.py`).
5. API: `GET /api/v1/stats/model-price-history?make=&model=` (calendar series + YOM cross-section, labeled).

### Phase 2 — Macro enrichment
1. Optional FRED US used-car CPI overlay (`FRED_API_KEY` required — not free without key).
2. CBSL transport CPI + USD/LKR for real-price series.
3. USS average auction ¥ as import-cost index.
4. NHTSA vPIC make/model catalog helper (`app/services/nhtsa_specs.py`) for specs enrichment — not SL prices.

### Phase 3 — Deep past (optional / selective)
1. Targeted Sunday Times / print harvest for flagship models (Aqua, Vitz, Alto, Premio).
2. Manual curation into observations with low confidence weights.
3. Never mix sparse 2005 newspaper points into high-confidence FMV without heavy Bayesian / prior constraints.

### Phase 4 — Product
- Long-horizon price index (mix-adjusted) spanning archive + live.
- “How prices moved through the import ban / 2022 crisis / 2025 reopening.”
- Predictions that condition on regime features (regs volume, FX, duty), not only recent comps.

## Community research audit (validated)

Many external write-ups mix good ideas with inaccuracies. Motormila-specific verdict:

| Claim | Verdict |
| --- | --- |
| “Scrapers only keep current listings; add a new `price_history` table” | **Partially wrong** — Motormila already has `vehicle_price_history` + monthly `price_aggregates`. Archive backfill belongs in `historical_price_observations`, not a duplicate live table. |
| “Only ikman + riyasewana” | **Outdated** — 13 live sources today. |
| “YOM on current listings fixes 2000s history” | **Wrong** — that is a cross-section, not calendar time. API now labels this explicitly. |
| Kaggle SL datasets as seed | **Yes** — point-in-time; import via CSV script; MIT-check each file. |
| DMT 2014–2025 population/regs | **Yes** — PDF downloads; curated series seeded into `market_signals`. Import-ban crash (80k→~1.5k new cars) is the killer overlay. |
| PriceMart / VehicleLK / Welandapola | **UX competitors** — study charts; Welandapola blog returned **403** from this environment — do not depend on scraping them. |
| FRED US used-car CPI 1953+ | **Useful benchmark only** — needs `api_key`; not SL prices. |
| NHTSA vPIC | **Yes for specs catalog** — free, no key; not prices. |
| Facebook Marketplace / groups | **Skip for now** — ToS, auth, brittle. |
| Commercial KBB / cap hpi / NADA | **Not SL-relevant** as primary data; optional methodology inspiration. |
| “ikman since 2012 ⇒ Wayback fills 2012–2024 easily” | **Optimistic** — dense extractable cars SERPs start ~**2017**; earlier years are sparse. |

## Ops commands

```bash
# Seed DMT + policy regime signals
cd backend && ALLOW_SQLITE_FALLBACK=true \
  .venv/bin/python scripts/ops/seed_market_context.py

# Import a downloaded Kaggle/community CSV
ALLOW_SQLITE_FALLBACK=true \
  .venv/bin/python scripts/ops/import_historical_csv.py ~/Downloads/sl_cars.csv \
  --archive-source kaggle_sl --observed-default 2025-01-15

# Dense Wayback backfill (brands + popular models + category + riyasewana)
ALLOW_SQLITE_FALLBACK=true \
  .venv/bin/python scripts/ops/backfill_wayback_prices.py \
  --profile dense --max-snapshots-per-url 30 --max-snapshots 600 --sleep 1.5 --dry-run
```

**Production (Supabase):** GitHub → Actions → **Historical Data Backfill** → Run workflow  
(defaults: `profile=dense`, 30 snapshots/URL, global cap 600, includes riyasewana; uses `secrets.HOT_DATABASE_URL`).

Or locally with prod URL:

```bash
cd backend
export HOT_DATABASE_URL='…' COLD_DATABASE_URL="$HOT_DATABASE_URL" ALLOW_SQLITE_FALLBACK=false
python scripts/ops/seed_market_context.py
python scripts/ops/import_historical_csv.py data/historical/kaggle_sl_car_price_dataset.csv \
  --archive-source kaggle_sl --price-unit lakhs
python scripts/ops/backfill_wayback_prices.py --profile dense \
  --max-snapshots-per-url 30 --max-snapshots 600 --sleep 1.5
```

Do **not** import Kaggle/community CSV into live `car_listings`.

API: `GET /api/v1/stats/model-price-history?make=toyota&model=aqua&from_year=2015&to_year=2026`  
UI: Price Time Machine on `/cars/:make/:model`

Modern ikman Wayback snapshots are JS apps — the parser reads `window.initialData` (not only classic `ui-item` HTML).

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

Highest-ROI next steps: (1) download + import a Kaggle SL CSV, (2) run `seed_market_context.py`, (3) rate-limited Wayback backfill for top brands, (4) wire the model-price-history API into a frontend “Price Time Machine” chart.
