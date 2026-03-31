#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FNLP="$SCRIPT_DIR/Family-Nutrition-Planner"

echo "[build] workspace root: $SCRIPT_DIR"
echo "[build] monorepo dir:   $FNLP"

cd "$FNLP"

echo "[build] step 1/3 — building nutrinext frontend..."
NODE_ENV=production pnpm --filter @workspace/nutrinext run build

NUTRI_OUT="$FNLP/artifacts/nutrinext/dist/public"
if [ ! -d "$NUTRI_OUT" ]; then
  echo "[build] ERROR: nutrinext output missing at $NUTRI_OUT"
  echo "[build] contents of artifacts/nutrinext/:"
  ls -la "$FNLP/artifacts/nutrinext/" 2>/dev/null || echo "(directory not found)"
  ls -la "$FNLP/artifacts/nutrinext/dist/" 2>/dev/null || echo "(dist/ not found)"
  exit 1
fi
echo "[build] nutrinext output confirmed at $NUTRI_OUT"

echo "[build] step 2/3 — building api-server bundle..."
pnpm --filter @workspace/api-server run build

API_DIST="$FNLP/artifacts/api-server/dist"
if [ ! -f "$API_DIST/index.mjs" ]; then
  echo "[build] ERROR: api-server bundle missing at $API_DIST/index.mjs"
  exit 1
fi
echo "[build] api-server bundle confirmed at $API_DIST/index.mjs"

echo "[build] step 3/3 — copying frontend into api-server dist..."
cp -r "$NUTRI_OUT" "$API_DIST/public"
echo "[build] frontend copied to $API_DIST/public"

echo "[build] done."
