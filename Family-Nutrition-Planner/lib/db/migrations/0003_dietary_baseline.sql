-- Migration: 0003_dietary_baseline
-- Applied via: pnpm --filter @workspace/db run push
-- Date: 2026-03-29
-- Purpose: Add Current Dietary Baseline columns for meal plan personalization.
--   families: meals_are_shared (shared vs per-member baseline toggle),
--             shared_typical_breakfast/lunch/dinner (what the family currently eats)
--   family_members: individual_typical_breakfast/lunch/dinner (per-member current diet)

-- families table additions
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS meals_are_shared BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS shared_typical_breakfast TEXT,
  ADD COLUMN IF NOT EXISTS shared_typical_lunch TEXT,
  ADD COLUMN IF NOT EXISTS shared_typical_dinner TEXT;

-- family_members table additions
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS individual_typical_breakfast TEXT,
  ADD COLUMN IF NOT EXISTS individual_typical_lunch TEXT,
  ADD COLUMN IF NOT EXISTS individual_typical_dinner TEXT;
