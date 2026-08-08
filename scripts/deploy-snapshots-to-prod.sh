#!/usr/bin/env bash
# deploy-snapshots-to-prod.sh
#
# Deploy refreshed snapshot JSON to motormila.vercel.app from CI (or locally).
#
# Stats-only exports (daily scrapes, --skip-catalog) do not carry the listing
# catalog, so the current catalog is fetched from the live site first and the
# fresh stats are overlaid on top. Full exports (weekly catalog refresh,
# ikman backfill) are deployed as-is.
#
# Usage:
#   SNAPSHOT_SOURCE_DIR=<dir with fresh snapshot JSON> bash scripts/deploy-snapshots-to-prod.sh
#
# Requires (CI): VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID secrets.
# Local fallback: existing `vercel` login + linked project (.vercel/).

set -euo pipefail

if command -v python3 >/dev/null 2>&1; then PY=python3; else PY=python; fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SNAP_DIR="${ROOT}/public/snapshots/latest"
SOURCE_DIR="${SNAPSHOT_SOURCE_DIR:-${SNAP_DIR}}"
LIVE_BASE="${LIVE_SNAPSHOT_BASE:-https://motormila.vercel.app/snapshots/latest}"

mkdir -p "${SNAP_DIR}"

# ---------------------------------------------------------------------------
# 1) Ensure the listing catalog is present (fetch from live site if missing).
# ---------------------------------------------------------------------------
if [[ ! -s "${SNAP_DIR}/listing-catalog.json" ]]; then
  echo "==> Fetching current listing catalog from live site…"
  curl -fsSL --max-time 120 -o "${SNAP_DIR}/listing-catalog.json" \
    "${LIVE_BASE}/listing-catalog.json" || {
      echo "ERROR: could not fetch listing-catalog.json from ${LIVE_BASE}" >&2
      exit 1
    }
  "${PY}" - "${SNAP_DIR}" "${LIVE_BASE}" <<'PY'
import json, os, subprocess, sys
snap, base = sys.argv[1], sys.argv[2]
try:
    with open(os.path.join(snap, "listing-catalog.json"), encoding="utf-8") as fh:
        manifest = json.load(fh)
except Exception as exc:
    print(f"ERROR: bad catalog manifest: {exc}")
    sys.exit(1)
for part in manifest.get("parts", []):
    target = os.path.join(snap, part)
    if os.path.exists(target) and os.path.getsize(target) > 0:
        continue
    print(f"  fetching {part} …")
    subprocess.run(
        ["curl", "-fsSL", "--max-time", "300", "-o", target, f"{base}/{part}"],
        check=True,
    )
PY
fi

# ---------------------------------------------------------------------------
# 2) Overlay the fresh snapshot files from the export.
# ---------------------------------------------------------------------------
if [[ -d "${SOURCE_DIR}" ]]; then
  echo "==> Overlaying fresh snapshots from ${SOURCE_DIR}"
  cp -f "${SOURCE_DIR}"/*.json "${SNAP_DIR}/" 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# 3) Validate every JSON file parses.
# ---------------------------------------------------------------------------
"${PY}" - "${SNAP_DIR}" <<'PY'
import glob, json, sys
snap = sys.argv[1]
files = sorted(glob.glob(f"{snap}/*.json"))
if not files:
    print("ERROR: no snapshot JSON files to deploy"); sys.exit(1)
for f in files:
    json.load(open(f, encoding="utf-8"))
print(f"  OK {len(files)} JSON files valid")
PY

# ---------------------------------------------------------------------------
# 4) Deploy to Vercel production (gitignored snapshots included).
# ---------------------------------------------------------------------------
cd "${ROOT}"
echo "==> Deploying to Vercel production…"
if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  npx --yes vercel deploy --prod --yes --token "${VERCEL_TOKEN}"
else
  npx --yes vercel deploy --prod --yes
fi

# ---------------------------------------------------------------------------
# 5) Verify the production alias serves the fresh stats file.
# ---------------------------------------------------------------------------
sleep 10
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 \
  "${LIVE_BASE}/stats-summary.json")
echo "==> Production snapshot check: HTTP ${STATUS}"
if [[ "${STATUS}" != "200" ]]; then
  echo "ERROR: production snapshots did not come up (HTTP ${STATUS})" >&2
  exit 1
fi
echo "==> Done — motormila.vercel.app snapshots updated."
