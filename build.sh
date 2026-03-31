#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FNLP="$SCRIPT_DIR/Family-Nutrition-Planner"
API_DIST="$FNLP/artifacts/api-server/dist"

echo "[build] workspace root: $SCRIPT_DIR"
echo "[build] monorepo dir:   $FNLP"

# If pre-built artifacts are already present and pnpm is not available, skip rebuild.
if ! command -v pnpm &>/dev/null; then
  echo "[build] pnpm not found — checking for pre-built artifacts..."
  if [ -f "$API_DIST/index.mjs" ] && [ -d "$API_DIST/public" ]; then
    echo "[build] pre-built artifacts found — skipping rebuild."
    echo "[build] done."
    exit 0
  fi
  echo "[build] FATAL: pnpm not found and no pre-built artifacts at $API_DIST"
  exit 1
fi

set -e
cd "$FNLP"

echo "[build] step 1/3 — building nutrinext frontend..."
NODE_ENV=production pnpm --filter @workspace/nutrinext run build

NUTRI_OUT="$FNLP/artifacts/nutrinext/dist/public"
if [ ! -d "$NUTRI_OUT" ]; then
  echo "[build] ERROR: nutrinext output missing at $NUTRI_OUT"
  ls -la "$FNLP/artifacts/nutrinext/" 2>/dev/null || echo "(directory not found)"
  exit 1
fi
echo "[build] nutrinext output confirmed at $NUTRI_OUT"

echo "[build] step 2/3 — building api-server bundle..."
pnpm --filter @workspace/api-server run build

if [ ! -f "$API_DIST/index.mjs" ]; then
  echo "[build] ERROR: api-server bundle missing at $API_DIST/index.mjs"
  exit 1
fi
echo "[build] api-server bundle confirmed at $API_DIST/index.mjs"

echo "[build] step 3/3 — copying frontend into api-server dist..."
cp -r "$NUTRI_OUT" "$API_DIST/public"
echo "[build] frontend copied to $API_DIST/public"

echo "[build] done."
