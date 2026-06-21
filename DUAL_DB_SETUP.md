# Dual Database Setup Guide

This guide helps you set up a dual-database architecture to scale your AutoLens platform beyond Supabase free tier limits while enabling 24/7 scraping.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   GitHub Actions │     │   GitHub Actions │     │   GitHub Actions │
│    (Scraper 1)   │     │    (Scraper 2)   │     │    (Scraper 3)   │
└─────────┬────────┘     └─────────┬────────┘     └─────────┬────────┘
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │        NeonDB (COLD)          │
                    │    Raw Scraped Data           │
                    │    - raw_listings             │
                    │    - High write volume        │
                    │    - 500MB free tier          │
                    │    - Unlimited connections    │
                    └──────────────┬───────────────┘
                                   │ Processing
                                   │ (Aggregator)
                                   ▼
                    ┌──────────────────────────────┐
                    │      Supabase (HOT)           │
                    │    Processed Listings         │
                    │    - car_listings             │
                    │    - price_aggregates         │
                    │    - locations                │
                    │    - API queries              │
                    │    - 500MB free tier          │
                    │    - 60 connections           │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │         Web App / API         │
                    └──────────────────────────────┘
```

## Why This Works

| Database | Purpose | Free Tier Limits | Best For |
|----------|---------|------------------|----------|
| **Supabase** | Hot data (processed listings) | 500MB, 60 connections | Fast API queries, smaller dataset |
| **NeonDB** | Cold data (raw scraped data) | 500MB, ~unlimited connections | High write volume, temporary data |

**Total capacity**: 1GB across two free tiers instead of 500MB on one!

## Step 1: Create NeonDB Project

1. Go to [https://neon.tech](https://neon.tech)
2. Sign up with your GitHub account
3. Click **"Create Project"**
4. Choose:
   - **Project Name**: `autolens-raw-data`
   - **Postgres Version**: 15 (latest)
   - **Region**: Choose closest to your users (e.g., `Singapore` for Sri Lanka)
5. Click **"Create Project"**

### Get Connection String

1. In your Neon dashboard, click **"Connect"**
2. Select **"PostgreSQL"**
3. Copy the connection string. It looks like:
   ```
   postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require
   ```
4. **Save this** - you'll need it in the next step

## Step 2: Configure Environment Variables

### Local Development (`.env.local`)

```bash
# Supabase (Hot DB) - Your existing Supabase URL
HOT_DATABASE_URL=postgresql://postgres:[password]@[project].supabase.co:5432/postgres

# NeonDB (Cold DB) - Your new NeonDB URL
COLD_DATABASE_URL=postgresql://[user]:[password]@[endpoint].neon.tech/autolens-raw-data?sslmode=require

# Disable SQLite fallback in production
ALLOW_SQLITE_FALLBACK=true
```

### GitHub Actions Secrets

Add these to your GitHub repository secrets:

1. Go to **Settings → Secrets and variables → Actions**
2. Click **"New repository secret"**
3. Add:
   - `HOT_DATABASE_URL` = Your Supabase connection string
   - `COLD_DATABASE_URL` = Your NeonDB connection string
4. (Optional but recommended) You can keep `DATABASE_URL` as a copy of `HOT_DATABASE_URL` for backward compatibility

## Step 3: Initialize Databases

Run this script to create tables on both databases:

```bash
cd backend
python -c "
from db.session import init_db
init_db()
print('✅ Databases initialized successfully!')
"
```

This will:
- Create `car_listings`, `price_aggregates`, `locations`, `scrape_runs` on **Supabase**
- Create `raw_listings` on **NeonDB**

## Step 4: Update Scrapers (Optional but Recommended)

The code is ready for dual databases! However, to optimize further, you can update your scrapers to explicitly use the cold database:

### Current Pattern (Single DB):
```python
from db.session import get_db

def scrape():
    db = next(get_db())  # Uses Supabase
    # ... save to raw_listings
```

### Optimized Pattern (Dual DB):
```python
from db.session import get_cold_db

def scrape():
    db = next(get_cold_db())  # Uses NeonDB
    # ... save to raw_listings
```

The current code already supports this - you just need to switch `get_db()` to `get_cold_db()` in your scraper modules.

## Step 5: Verify Setup

### Test Connection to Both Databases

```bash
cd backend
python -c "
from db.session import hot_engine, cold_engine, is_dual_db_mode

print(f'Dual DB Mode: {is_dual_db_mode()}')
print(f'Hot Engine (Supabase): {hot_engine.url}')
print(f'Cold Engine (NeonDB): {cold_engine.url}')

# Test connections
from sqlalchemy import text
with hot_engine.connect() as conn:
    result = conn.execute(text('SELECT version()'))
    print(f'\n✅ Supabase connected: {result.fetchone()[0][:50]}...')

with cold_engine.connect() as conn:
    result = conn.execute(text('SELECT version()'))
    print(f'✅ NeonDB connected: {result.fetchone()[0][:50]}...')

print('\n🎉 Dual database setup complete!')
"
```

### Check Tables on Each Database

```bash
# Check Supabase tables (should have car_listings, price_aggregates, etc.)
cd backend
python -c "
from db.session import hot_engine
from sqlalchemy import inspect
inspector = inspect(hot_engine)
print('Supabase (Hot) Tables:', inspector.get_table_names())
"

# Check NeonDB tables (should have raw_listings)
cd backend
python -c "
from db.session import cold_engine
from sqlalchemy import inspect
inspector = inspect(cold_engine)
print('NeonDB (Cold) Tables:', inspector.get_table_names())
"
```

## Step 6: Run a Test Scraper

Run a quick test to make sure everything works:

```bash
cd backend
HOT_DATABASE_URL="your-supabase-url" \
COLD_DATABASE_URL="your-neon-url" \
ALLOW_SQLITE_FALLBACK=false \
SCRAPE_ENABLED_SOURCES=patpat \
SCRAPE_MAX_PAGES=5 \
python run_sync.py
```

Watch for:
- ✅ Raw listings should go to **NeonDB**
- ✅ Processed listings should go to **Supabase**
- ✅ No connection limit errors!

## Monitoring Your Setup

### Check Row Counts

```sql
-- On Supabase (Hot DB)
SELECT 'car_listings' as table_name, COUNT(*) as rows FROM car_listings
UNION ALL
SELECT 'price_aggregates', COUNT(*) FROM price_aggregates;

-- On NeonDB (Cold DB)
SELECT 'raw_listings' as table_name, COUNT(*) as rows FROM raw_listings;
```

### Monitor Free Tier Usage

**Supabase Dashboard**:
- Go to [https://app.supabase.com](https://app.supabase.com)
- Check database size, connection usage

**NeonDB Dashboard**:
- Go to [https://console.neon.tech](https://console.neon.tech)
- Check storage usage

## Scaling Further

When you hit 500MB on both databases:

1. **NeonDB**: Upgrade to Launch plan ($19/month) = 10GB storage
2. **Supabase**: Upgrade to Pro ($25/month) = 8GB storage + 300 connections
3. **Alternative**: Set up automated data archival (delete old raw_listings after 30 days)

## Troubleshooting

### "Connection refused" to NeonDB

Make sure your NeonDB connection string includes `?sslmode=require`:
```
postgresql://user:pass@endpoint.neon.tech/dbname?sslmode=require
```

### "Table doesn't exist" errors

Run `init_db()` again to create missing tables:
```python
from db.session import init_db
init_db()
```

### GitHub Actions failures

Verify secrets are set correctly:
1. Go to **Settings → Secrets and variables → Actions**
2. Check `HOT_DATABASE_URL` and `COLD_DATABASE_URL` are set
3. Re-run failed workflows

## Next Steps

1. ✅ Set up your NeonDB project (Step 1)
2. ✅ Add environment variables (Step 2)
3. ✅ Initialize databases (Step 3)
4. ✅ Run a test scrape (Step 6)
5. 🚀 Deploy and enjoy unlimited 24/7 scraping!

---

**Questions?** The code is designed to be flexible - if you only set `DATABASE_URL`, it will still work in single-database mode. The dual-database setup only activates when `COLD_DATABASE_URL` is also provided.
