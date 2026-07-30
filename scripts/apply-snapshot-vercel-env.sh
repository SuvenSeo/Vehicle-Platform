#!/usr/bin/env bash
# apply-snapshot-vercel-env.sh
#
# Idempotently sets VITE_SNAPSHOT_BASE_URL and VITE_SNAPSHOT_ONLY on the
# linked Vercel project for both Production and Preview environments.
#
# Usage: bash scripts/apply-snapshot-vercel-env.sh
#
# Requires: Vercel CLI logged in and project linked (npx vercel link already done).
# Does NOT echo or log secret values.

set -euo pipefail

SNAPSHOT_BASE_URL="https://motormila.vercel.app/snapshots/latest"
SNAPSHOT_ONLY="true"

# Environments to configure (Vercel target names)
TARGETS=("production" "preview")

# ---------------------------------------------------------------------------
# Helper: set one env var idempotently in a given target.
# Removes it first (ignoring "not found" errors), then adds it fresh.
# ---------------------------------------------------------------------------
set_env() {
  local var_name="$1"
  local var_value="$2"
  local target="$3"

  echo "  [${target}] Removing ${var_name} (if present)…"
  # vercel env rm exits non-zero when the var doesn't exist; suppress that.
  npx vercel env rm "${var_name}" "${target}" --yes 2>&1 | grep -v "^$" || true

  echo "  [${target}] Adding ${var_name}…"
  # Pass value via stdin so it never appears in the process list or shell history.
  printf '%s' "${var_value}" | npx vercel env add "${var_name}" "${target}" 2>&1

  echo "  [${target}] ${var_name} set."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo "==> Configuring VITE_SNAPSHOT_BASE_URL"
for target in "${TARGETS[@]}"; do
  set_env "VITE_SNAPSHOT_BASE_URL" "${SNAPSHOT_BASE_URL}" "${target}"
done

echo ""
echo "==> Configuring VITE_SNAPSHOT_ONLY"
for target in "${TARGETS[@]}"; do
  set_env "VITE_SNAPSHOT_ONLY" "${SNAPSHOT_ONLY}" "${target}"
done

echo ""
echo "==> Done. Verifying (names only, values are encrypted):"
npx vercel env ls 2>&1 | grep -E "^( name| VITE_SNAPSHOT)" || npx vercel env ls 2>&1 | tail -20
