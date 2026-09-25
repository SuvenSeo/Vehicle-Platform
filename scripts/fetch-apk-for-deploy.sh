#!/usr/bin/env bash
# fetch-apk-for-deploy.sh
#
# Copy the current sideload APK + release manifest into public/app/ so the next
# CLI deploy (deploy-snapshots-to-prod.sh) publishes them at
# https://motormila.vercel.app/app/*.
#
# Why: the source repo is private, so the APK can no longer be downloaded
# anonymously from GitHub Releases, and the binary is gitignored (too large for
# git history). CI runners therefore fetch it here, authenticated with GH_TOKEN,
# right before the deploy.
#
# Usage:  GH_TOKEN=… bash scripts/fetch-apk-for-deploy.sh
# Requires: gh CLI (present on GitHub runners), android/latest-release.json in
# the checkout. No-ops with a warning when the manifest or release is missing,
# so deploys never fail just because no APK was published yet.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${ROOT}/android/latest-release.json"
APP_DIR="${ROOT}/public/app"

mkdir -p "${APP_DIR}"

if [[ ! -s "${MANIFEST}" ]]; then
  echo "WARN: ${MANIFEST} missing; skipping APK publish" >&2
  exit 0
fi

cp -f "${MANIFEST}" "${APP_DIR}/latest-release.json"

TAG="$(sed -n 's/.*"tag"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${MANIFEST}" | head -1)"
if [[ -z "${TAG}" ]]; then
  VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${MANIFEST}" | head -1)"
  if [[ -n "${VERSION}" ]]; then
    TAG="android-v${VERSION}"
  fi
fi
if [[ -z "${TAG}" ]]; then
  echo "WARN: no release tag in ${MANIFEST}; skipping APK fetch" >&2
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "WARN: gh CLI unavailable; skipping APK fetch (manifest still deployed)" >&2
  exit 0
fi

echo "==> Fetching APK from release ${TAG}"
if gh release download "${TAG}" --pattern "*.apk" --dir "${APP_DIR}" --clobber; then
  ls -lh "${APP_DIR}"
else
  echo "WARN: could not download APK for ${TAG}; manifest-only deploy" >&2
fi
