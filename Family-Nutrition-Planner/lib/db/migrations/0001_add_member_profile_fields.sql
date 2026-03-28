-- Migration: 0001_add_member_profile_fields
-- Applied via: pnpm --filter @workspace/db run push
-- Date: 2026-03-28
-- Column names here EXACTLY match the Drizzle ORM column() names in family_members.ts
-- To apply on a fresh database run: pnpm --filter @workspace/db run push

ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS primary_goal_override text
    CHECK (primary_goal_override IS NULL OR primary_goal_override IN (
      'weight_loss','muscle_gain','manage_diabetes','heart_health',
      'manage_thyroid','childhood_nutrition','general_wellness'
    )),
  ADD COLUMN IF NOT EXISTS icmr_caloric_target integer
    CHECK (icmr_caloric_target IS NULL OR (icmr_caloric_target >= 800 AND icmr_caloric_target <= 5000)),
  ADD COLUMN IF NOT EXISTS goal_pace text NOT NULL DEFAULT 'none'
    CHECK (goal_pace IN ('aggressive','moderate','conservative','none')),
  ADD COLUMN IF NOT EXISTS tiffin_type text NOT NULL DEFAULT 'none'
    CHECK (tiffin_type IN ('school','office','none')),
  ADD COLUMN IF NOT EXISTS religious_rules text NOT NULL DEFAULT 'none'
    CHECK (religious_rules IN ('hindu_veg','jain','halal','none')),
  ADD COLUMN IF NOT EXISTS ingredient_dislikes text[],
  ADD COLUMN IF NOT EXISTS non_veg_days text[],
  ADD COLUMN IF NOT EXISTS non_veg_types text[];

-- Indexes for RAI and profile queries
CREATE INDEX IF NOT EXISTS family_members_primary_goal_idx ON family_members (primary_goal_override);
CREATE INDEX IF NOT EXISTS family_members_goal_pace_idx ON family_members (goal_pace);

-- Column reference:
-- primary_goal_override: RAI-governed health goal enum
-- icmr_caloric_target: Mifflin-St Jeor TDEE adjusted to ICMR-NIN 2024 norms (800-5000 kcal)
-- goal_pace: rate of progress (aggressive|moderate|conservative|none)
-- tiffin_type: tiffin pack needed (school|office|none)
-- religious_rules: dietary rule set (hindu_veg|jain|halal|none)
-- ingredient_dislikes: ingredients this member won't eat
-- non_veg_days: days of week when non-veg is acceptable
-- non_veg_types: types of non-veg allowed (chicken|fish|eggs|mutton)
