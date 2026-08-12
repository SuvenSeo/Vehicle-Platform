#!/usr/bin/env bash
# Manus-side scrape + upload: run on Manus's Cloud Computer (Linux).
#
# Scrapes the given sources into a LOCAL SQLite DB (no Neon needed), then
# uploads the compressed DB as a GitHub Release asset so the laptop can merge
# it into the outage pipeline DB (scripts/ops/merge_sqlite_dump.py).
#
# Usage (after cloning the repo on the Manus VM):
#   bash backend/scripts/ops/manus_scrape_dump.sh ikman autolanka hitad autostream
#
# Env:
#   GH_TOKEN                GitHub token with "releases" write on the repo (required)
#   MANUS_RELEASE_REPO      default SuvenSeo/Vehicle-Platform
#   MANUS_MAX_PAGES         per-source page budget, default 120
#
# NOTE: use this for API / plain-HTTP friendly sources (ikman, autolanka,
# hitad, autostream, saleme, riyahub, carshop, dimo, autodirect, cartivate).
# riyasewana/patpat Cloudflare-wall datacenter IPs — keep those on the laptop.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}/backend"

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "ERROR: GH_TOKEN not set (GitHub token with releases write)." >&2
  exit 1
fi

MAX="${MANUS_MAX_PAGES:-120}"
REPO="${MANUS_RELEASE_REPO:-SuvenSeo/Vehicle-Platform}"

echo "== installing deps =="
python3 -m pip install -q -r requirements.txt

# Fresh local DB for this run so the dump contains exactly what was scraped.
rm -f autolens.db autolens.db.gz

for src in "$@"; do
  upper="$(printf '%s' "$src" | tr '[:lower:]' '[:upper:]')"
  echo "== scraping ${src} (max ${MAX} pages) =="
  ALLOW_SQLITE_FALLBACK=true \
  RUN_SCRAPERS=true \
  RUN_MARKET_ANALYSIS=false \
  RUN_MARKET_SIGNALS=false \
  RUN_LISTING_LIFECYCLE=false \
  RUN_OUTLIER_DETECTION=false \
  SCRAPE_ENABLED_SOURCES="${src}" \
  "SCRAPE_MAX_PAGES_${upper}=${MAX}" \
  SCRAPE_SOURCE_TIMEOUT_SECONDS=7200 \
  python3 run_sync.py || echo "!! ${src} scrape failed — continuing with the rest"
done

TOTAL="$(python3 -c "
import sqlite3
try:
    con = sqlite3.connect('autolens.db')
    print(con.execute('SELECT COUNT(*) FROM car_listings').fetchone()[0])
except Exception:
    print(0)
")"
echo "== scraped ${TOTAL} listings total =="
if [[ "${TOTAL}" == "0" ]]; then
  echo "ERROR: nothing scraped — aborting upload." >&2
  exit 1
fi

gzip -f autolens.db

TAG="manus-scrape-$(date -u +%Y%m%dT%H%MZ)"
echo "== uploading release ${TAG} (${REPO}) =="
RELEASE_JSON="$(curl -fsSL -X POST \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO}/releases" \
  -d "{\"tag_name\":\"${TAG}\",\"name\":\"${TAG}\",\"body\":\"Sources: $* — listings: ${TOTAL}\",\"draft\":false,\"prerelease\":true,\"latest\":false}")"

RELEASE_ID="$(printf '%s' "${RELEASE_JSON}" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"

curl -fsSL -X POST \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  -H "Content-Type: application/gzip" \
  --data-binary "@autolens.db.gz" \
  "https://uploads.github.com/repos/${REPO}/releases/${RELEASE_ID}/assets?name=autolens.db.gz" >/dev/null

echo "== pruning old manus-scrape releases (keep 5) =="
python3 - <<'PY'
import json, os, subprocess, sys

repo = os.environ["REPO"]
token = os.environ["GH_TOKEN"]
out = subprocess.run(
    ["curl", "-fsSL", "-H", f"Authorization: Bearer {token}",
     f"https://api.github.com/repos/{repo}/releases?per_page=100"],
    capture_output=True, text=True, check=True,
).stdout
releases = [r for r in json.loads(out) if (r.get("tag_name") or "").startswith("manus-scrape-")]
for old in releases[5:]:
    subprocess.run(
        ["curl", "-fsSL", "-X", "DELETE",
         "-H", f"Authorization: Bearer {token}",
         f"https://api.github.com/repos/{repo}/releases/{old['id']}"],
        check=False,
    )
    print("deleted", old["tag_name"])
PY

echo "== DONE — download the release asset on the laptop and run merge_sqlite_dump.py =="
