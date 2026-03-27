#!/bin/bash
set -e

# Move to the monorepo root (the Family-Nutrition-Planner directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$MONOREPO_ROOT"
echo "==> Working in: $MONOREPO_ROOT"

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Pushing Drizzle schema (creates/updates all tables)..."
pnpm --filter @workspace/db push-force

echo "==> Seeding ICMR-NIN 2024 RDA reference data (skips if already seeded)..."
pnpm --filter @workspace/scripts seed-icmr-nin

echo "==> Seeding recipe library from CSV (skips if already seeded)..."
pnpm --filter @workspace/scripts seed-recipes

echo "==> Verifying minimum data thresholds..."
pnpm --filter @workspace/scripts verify-db

echo "==> Post-merge setup complete."
