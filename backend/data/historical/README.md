# Historical / reference datasets (not live inventory)

These files feed **archive** tables only (`historical_price_observations`,
`market_signals`). Do **not** import them into live `car_listings`.

## `kaggle_sl_car_price_dataset.csv`

- Source: [Prasad Nirmal — Sri Lankan Second Vehicle/Car Price Dataset](https://www.kaggle.com/datasets/prasadnirmal/srilankan-second-vehiclecar-price-dataset)
- Rows: ~9,788 listings dated **2024-12-03 → 2025-02-05**
- **Price column is in lakhs LKR** (e.g. `43.0` → `4,300,000` LKR)
- Mileage column is misspelled `Millage(KM)` (importer accepts it)

Import into SQLite (local):

```bash
cd backend
ALLOW_SQLITE_FALLBACK=true PRO_ACCESS_ENFORCED=false \
  .venv/bin/python scripts/ops/import_historical_csv.py \
  data/historical/kaggle_sl_car_price_dataset.csv \
  --archive-source kaggle_sl --price-unit lakhs
```

Production (HF / Supabase — set your real `DATABASE_URL`):

```bash
cd backend
python scripts/ops/seed_market_context.py
python scripts/ops/import_historical_csv.py \
  data/historical/kaggle_sl_car_price_dataset.csv \
  --archive-source kaggle_sl --price-unit lakhs
```

Dry-run first with `--dry-run` if preferred.

## `Vehicle_Population_2014-2025.pdf`

Original DMT PDF used to verify curated seed numbers in
`app/services/market_context_seed.py`. Seed with:

```bash
ALLOW_SQLITE_FALLBACK=true .venv/bin/python scripts/ops/seed_market_context.py
```

Source URL: https://dmt.gov.lk/images/2026/Vehicle_Population_2014-2025.pdf
