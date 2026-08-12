#!/usr/bin/env bash
# Manus-side scrape + upload: run on Manus's Cloud Computer (Linux).
#
# Scrapes the given sources into a LOCAL SQLite DB (no Neon needed), then
# delivers the compressed DB to GitHub so the laptop can merge it into the
# outage pipeline DB (scripts/ops/merge_sqlite_dump.py).
#
# Delivery tries, in order:
#   1) `gh` CLI if already authenticated (Manus's GitHub integration often
#      provides this)      -> creates a GitHub Release + uploads the asset
#   2) GH_TOKEN env var     -> same via the REST API (curl)
#   3) git push             -> commits the dump into data/manus-dumps/ and
#                              pushes (uses Manus's git credentials)
#
# Usage (after cloning the repo on the Manus VM):
#   bash backend/scripts/ops/manus_scrape_dump.sh ikman autolanka hitad autostream
#
# Env:
#   GH_TOKEN            optional GitHub token with "releases" write
#   MANUS_RELEASE_REPO  default SuvenSeo/Vehicle-Platform
#   MANUS_MAX_PAGES     per-source page budget, default 120
#
# NOTE: use this for API / plain-HTTP friendly sources (ikman, autolanka,
# hitad, autostream, saleme, riyahub, carshop, dimo, autodirect, cartivate).
# riyasewana/patpat Cloudflare-wall datacenter IPs — keep those on the laptop.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}/backend"

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

# ---------------------------------------------------------------------------
# Delivery path 1: `gh` CLI (Manus integration may already authenticate it)
# ---------------------------------------------------------------------------
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "== gh CLI available — creating release ${TAG} (${REPO}) =="
  if gh release create "${TAG}" autolens.db.gz --repo "${REPO}" \
      --title "${TAG}" --notes "Sources: $* — listings: ${TOTAL}" \
      --prerelease --latest=false; then
    echo "== uploaded via gh. DONE =="
    exit 0
  fi
  echo "!! gh release create failed — trying the API / commit fallbacks."
fi

# ---------------------------------------------------------------------------
# Delivery path 2: GH_TOKEN via the REST API
# ---------------------------------------------------------------------------
if [[ -n "${GH_TOKEN:-}" ]]; then
  echo "== uploading release ${TAG} via API (${REPO}) =="
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
import json, os, subprocess

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

  echo "== uploaded via API. DONE =="
  exit 0
fi

# ---------------------------------------------------------------------------
# Delivery path 3: commit the dump into the repo (git credentials fallback)
# ---------------------------------------------------------------------------
echo "== no release auth — committing the dump into the repo instead =="
cd "${ROOT}"
mkdir -p data/manus-dumps
cp backend/autolens.db.gz "data/manus-dumps/${TAG}.db.gz"
# Keep the last 5 dumps in the repo
python3 - <<'PY'
import glob, os
files = sorted(glob.glob("data/manus-dumps/manus-scrape-*.db.gz"))
for old in files[:-5]:
    os.remove(old)
    print("removed", old)
PY
git add data/manus-dumps
git -c user.name="manus-scrape" -c user.email="manus-scrape@users.noreply.github.com" \
  commit -m "Manus scrape dump ${TAG}: sources [$*] — ${TOTAL} listings"
git push || {
  echo "!! git push failed — the dump is at data/manus-dumps/${TAG}.db.gz" >&2
  echo "   Tell Manus to push it, or download it manually." >&2
  exit 1
}
echo "== committed + pushed ${TAG}.db.gz. DONE =="
