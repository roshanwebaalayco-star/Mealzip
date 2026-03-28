-- Migration: 0001_add_member_profile_fields
-- Applied via: pnpm --filter @workspace/db run push
-- Date: 2026-03-28
-- Column names here EXACTLY match the Drizzle ORM column() names in family_members.ts
-- CHECK enum values EXACTLY match Zod runtime enums in api-zod/api.ts and profile-rules.ts

ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS primary_goal_override text
    CHECK (primary_goal_override IS NULL OR primary_goal_override IN (
      'weight_loss','weight_gain','build_muscle',
      'manage_diabetes','heart_health','manage_thyroid',
      'childhood_nutrition','general_wellness','anemia_recovery',
      'maintain','healthy_growth','senior_nutrition'
    )),
  ADD COLUMN IF NOT EXISTS icmr_caloric_target integer
    CHECK (icmr_caloric_target IS NULL OR (icmr_caloric_target >= 800 AND icmr_caloric_target <= 5000)),
  ADD COLUMN IF NOT EXISTS goal_pace text NOT NULL DEFAULT 'none'
    CHECK (goal_pace IN ('none','0.25','0.5')),
  ADD COLUMN IF NOT EXISTS tiffin_type text NOT NULL DEFAULT 'none'
    CHECK (tiffin_type IN ('school','office','none')),
  ADD COLUMN IF NOT EXISTS religious_rules text NOT NULL DEFAULT 'none'
    CHECK (religious_rules IN ('none','no_beef','no_pork','sattvic','jain')),
  ADD COLUMN IF NOT EXISTS ingredient_dislikes text[],
  ADD COLUMN IF NOT EXISTS non_veg_days text[],
  ADD COLUMN IF NOT EXISTS non_veg_types text[];

-- Indexes for RAI and profile queries
CREATE INDEX IF NOT EXISTS family_members_primary_goal_idx ON family_members (primary_goal_override);
CREATE INDEX IF NOT EXISTS family_members_goal_pace_idx ON family_members (goal_pace);

-- Column reference (enums match Zod api-zod/api.ts + profile-rules.ts exactly):
-- primary_goal_override: RAI-governed goal; RAI may produce maintain/healthy_growth/senior_nutrition overrides
-- icmr_caloric_target: Mifflin-St Jeor TDEE adjusted to ICMR-NIN 2024 norms (800-5000 kcal range)
-- goal_pace: kg/week pace for weight goals ('none'=no deficit/surplus; '0.25'=250kcal; '0.5'=500kcal)
-- tiffin_type: tiffin pack needed (school | office | none)
-- religious_rules: dietary rule set ('none'|'no_beef'|'no_pork'|'sattvic'|'jain')
-- ingredient_dislikes: array of ingredients this member will not eat
-- non_veg_days: days of week when non-veg is acceptable (e.g. ['saturday','sunday'])
-- non_veg_types: types of non-veg allowed (e.g. ['chicken','fish','eggs','mutton'])
