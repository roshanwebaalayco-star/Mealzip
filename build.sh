#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FNLP="$SCRIPT_DIR/Family-Nutrition-Planner"
API_DIST="$FNLP/artifacts/api-server/dist"
CLIENT_DIR="$SCRIPT_DIR/client"

echo "[build] workspace root: $SCRIPT_DIR"
echo "[build] monorepo dir:   $FNLP"
echo "[build] api dist:       $API_DIST"
echo "[build] client dir:     $CLIENT_DIR"

# ── Fast path: use committed pre-built artifacts if present ─────────────────
if [ -f "$API_DIST/index.mjs" ] && [ -d "$CLIENT_DIR" ] && [ -f "$CLIENT_DIR/index.html" ]; then
  echo "[build] Pre-built artifacts found — skipping rebuild."
  echo "[build] Bundle: $(wc -c < "$API_DIST/index.mjs") bytes"
  echo "[build] Frontend files: $(find "$CLIENT_DIR" -type f | wc -l)"
  echo "[build] done."
  exit 0
fi

echo "[build] No pre-built artifacts found — will compile from source."

# ── Slow path: full compile (requires pnpm + node_modules) ──────────────────
if ! command -v pnpm &>/dev/null; then
  echo "[build] FATAL: pnpm not found and no pre-built artifacts at $API_DIST"
  exit 1
fi

set -e
cd "$FNLP"

echo "[build] Installing dependencies..."
pnpm install --frozen-lockfile

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

echo "[build] step 3/3 — copying frontend to workspace root client/..."
rm -rf "$CLIENT_DIR"
cp -r "$NUTRI_OUT" "$CLIENT_DIR"
cp -r "$NUTRI_OUT" "$API_DIST/public"
echo "[build] frontend copied to $CLIENT_DIR and $API_DIST/public"

echo "[build] done."
