#!/usr/bin/env bash
# redeploy-prod-with-snapshots.sh
#
# Redeploy production from a working tree that includes gitignored snapshot
# JSON under public/snapshots/latest/. GitHub → Vercel deploys omit those
# files, so after every main merge you must either run this script (or
# equivalent) or host snapshots on R2 via VITE_SNAPSHOT_BASE_URL.
#
# Usage (from repo root):
#   bash scripts/redeploy-prod-with-snapshots.sh
#
# Requires: Vercel CLI logged in and project linked; snapshot JSON present.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SNAPSHOT_DIR="${ROOT}/public/snapshots/latest"
REQUIRED_FILES=(
  "${SNAPSHOT_DIR}/stats-summary.json"
  "${SNAPSHOT_DIR}/listing-catalog.json"
)

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

echo "==> Checking required snapshot JSON under public/snapshots/latest/"

for path in "${REQUIRED_FILES[@]}"; do
  [[ -f "${path}" ]] || fail "missing file: ${path}"
  [[ -s "${path}" ]] || fail "empty file: ${path}"
  if ! python3 -c 'import json,sys; json.load(open(sys.argv[1]));' "${path}" 2>/dev/null; then
    fail "not valid JSON: ${path}"
  fi
  echo "  OK $(basename "${path}") ($(wc -c < "${path}" | tr -d ' ') bytes)"
done

echo ""
echo "==> Deploying to Vercel production (includes local gitignored snapshots)…"
cd "${ROOT}"
npx vercel deploy --prod --yes

echo ""
echo "========================================================================"
echo "REMINDER: GitHub → Vercel deploys omit gitignored public/snapshots/latest/*.json."
echo "After every main deploy you must either:"
echo "  (a) re-run this script from a tree that has snapshots, or"
echo "  (b) host snapshots on R2 and set VITE_SNAPSHOT_BASE_URL there."
echo "See docs/permanent-free-ops-r2-oracle.md"
echo "========================================================================"
