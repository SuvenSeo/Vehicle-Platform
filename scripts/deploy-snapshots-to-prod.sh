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
  # A full export carries its own paginated catalog manifest. Remove only the
  # part files that the incoming manifest does NOT reference, so stale parts
  # from an earlier export with a different part count don't linger. This also
  # works when SOURCE_DIR is the same directory as SNAP_DIR (the outage
  # pipeline stages the artifact straight into public/snapshots/latest) — a
  # blanket rm there deleted the fresh parts before they were deployed.
  if [[ -f "${SOURCE_DIR}/listing-catalog.json" ]]; then
    "${PY}" - "${SNAP_DIR}" "${SOURCE_DIR}" <<'PY'
import glob, json, os, sys
snap, src = sys.argv[1], sys.argv[2]
try:
    with open(os.path.join(src, "listing-catalog.json"), encoding="utf-8") as fh:
        keep = set(json.load(fh).get("parts", []))
except Exception:
    keep = set()
for old in glob.glob(os.path.join(snap, "listing-catalog-part-*.json")):
    if os.path.basename(old) not in keep:
        os.remove(old)
PY
  fi
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
# 5) Verify the production alias serves the fresh stats file AND every catalog
#    part the manifest references (a missing part silently breaks listing
#    search while the stats check alone still passes).
# ---------------------------------------------------------------------------
sleep 10
# Vercel's SPA rewrite answers 200 with text/html for missing files, so check
# the content type, not just the status code.
STATUS=$(curl -s -o /dev/null -w "%{http_code}|%{content_type}" --max-time 30 \
  "${LIVE_BASE}/stats-summary.json")
CODE="${STATUS%%|*}"; CTYPE="${STATUS#*|}"
echo "==> Production stats check: HTTP ${CODE} (${CTYPE})"
if [[ "${CODE}" != "200" || "${CTYPE}" != *json* ]]; then
  echo "ERROR: production snapshots did not come up (HTTP ${STATUS})" >&2
  exit 1
fi
"${PY}" - "${LIVE_BASE}" <<'PY'
import json, subprocess, sys, urllib.request
base = sys.argv[1]
with urllib.request.urlopen(f"{base}/listing-catalog.json", timeout=30) as r:
    manifest = json.load(r)
for part in manifest.get("parts", []):
    probe = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}|%{content_type}",
         "--max-time", "30", f"{base}/{part}"],
        capture_output=True, text=True,
    ).stdout.strip()
    code, ctype = probe.split("|", 1)
    if code != "200" or "json" not in ctype.lower():
        print(f"ERROR: catalog part {part} came back HTTP {code} ({ctype}) — listing search will be empty")
        sys.exit(1)
    print(f"  OK part {part} HTTP {code} ({ctype})")
PY
echo "==> Done — motormila.vercel.app snapshots updated."
