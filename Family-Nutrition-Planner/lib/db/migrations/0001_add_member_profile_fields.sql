-- Migration: 0001_add_member_profile_fields
-- Applied via: drizzle-kit push (run: pnpm --filter @workspace/db run push)
-- Date: 2026-03-28
-- Purpose: Add extended profile columns to family_members for RAI rules,
--          goal tracking, tiffin/non-veg preferences, and ICMR caloric targets.

-- NOTE: This file documents the ALTER TABLE changes made via drizzle push.
-- To apply on a fresh database run: pnpm --filter @workspace/db run push

ALTER TABLE family_members ADD COLUMN IF NOT EXISTS primary_goal text;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS goal_pace text;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS tiffin_type text;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS religious_rules text;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS ingredient_dislikes text[];
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS non_veg_days text[];
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS non_veg_types text[];
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS icmr_caloric_target integer;

-- primary_goal: RAI-governed health goal (weight_loss, muscle_gain, manage_diabetes,
--   heart_health, manage_thyroid, childhood_nutrition, general_wellness)
-- goal_pace: rate of progress override (aggressive, moderate, conservative, none)
-- tiffin_type: school | office (tiffin pack needed for this member)
-- religious_rules: hindu_veg | jain | halal | none
-- ingredient_dislikes: ingredients this member won't eat (e.g. ['bitter gourd', 'karela'])
-- non_veg_days: days of week when non-veg is acceptable (e.g. ['saturday', 'sunday'])
-- non_veg_types: types of non-veg allowed (e.g. ['chicken', 'fish', 'eggs'])
-- icmr_caloric_target: Mifflin-St Jeor TDEE adjusted to ICMR-NIN 2024 age/gender norms
