#!/usr/bin/env bash
# deploy-snapshots-to-cloudflare.sh
#
# Deploy the Motormila site + refreshed snapshots to Cloudflare Pages
# (motormila.pages.dev) from CI (or locally).
#
# This is the Cloudflare counterpart to deploy-snapshots-to-prod.sh (Vercel).
# It expects public/snapshots/latest/ to already be prepared (the Vercel script
# does the overlay/catalog/DB/APK prep); this script builds the Vite site and
# uploads dist/ + functions/ via Wrangler.
#
# Requires (CI): CLOUDFLARE_API_TOKEN (Pages:Edit), CLOUDFLARE_ACCOUNT_ID secrets.
# Local fallback: existing `wrangler` login.
#
# Usage:
#   bash scripts/deploy-snapshots-to-cloudflare.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SNAP_DIR="${ROOT}/public/snapshots/latest"
PROJECT="motormila"
LIVE_BASE="https://motormila.pages.dev"

if [[ ! -s "${SNAP_DIR}/stats-summary.json" ]]; then
  echo "ERROR: ${SNAP_DIR}/stats-summary.json missing — run deploy-snapshots-to-prod.sh first" >&2
  exit 1
fi

cd "${ROOT}"

echo "==> Installing dependencies…"
if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

echo "==> Building site (Vite)…"
npm run build

if [[ ! -d dist ]]; then
  echo "ERROR: dist/ not produced by build" >&2
  exit 1
fi
echo "==> dist/ built: $(du -sh dist | cut -f1)"

echo "==> Deploying to Cloudflare Pages (${PROJECT})…"
if [[ -n "${CLOUDFLARE_API_TOKEN:-}" && -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  npx --yes wrangler pages deploy dist \
    --project-name="${PROJECT}" \
    --commit-dirty=true
else
  npx --yes wrangler pages deploy dist \
    --project-name="${PROJECT}" \
    --commit-dirty=true
fi

echo "==> Verifying production snapshots…"
sleep 10
STATUS=$(curl -s -o /dev/null -w "%{http_code}|%{content_type}" --max-time 30 \
  "${LIVE_BASE}/snapshots/latest/stats-summary.json")
CODE="${STATUS%%|*}"; CTYPE="${STATUS#*|}"
echo "==> Production stats check: HTTP ${CODE} (${CTYPE})"
if [[ "${CODE}" != "200" || "${CTYPE}" != *json* ]]; then
  echo "ERROR: Cloudflare snapshots did not come up (HTTP ${STATUS})" >&2
  exit 1
fi

echo "==> Done — motormila.pages.dev updated."
