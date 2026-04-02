# NutriNext ParivarSehat — Complete Database Blueprint
### Elite Schema Design for Supabase (PostgreSQL) + Drizzle ORM

---

## PART 1: ARCHITECTURE DECISIONS — What Is Strict vs. JSONB and Why

This is the most important decision you will make. Get this wrong and you will rewrite migrations every week.

**Rule of thumb used here:**
- **Strict column** → You will FILTER, SORT, or DO MATH on this value in SQL. (e.g., `WHERE dietary_type = 'jain_vegetarian'`, `ORDER BY display_order`, `SUM(total_monthly_budget)`)
- **JSONB column** → You will READ this as a blob and pass it to your backend / Gemini. You will never `WHERE` on its contents in a hot query path.

| Column | Table | Type | Reason |
|---|---|---|---|
| `id`, `family_id`, `user_id` | all | `UUID` | Foreign key joins — always strict |
| `age` | `family_members` | `INTEGER` | Auto-assignment rules run math on this (age < 5, age 60+) |
| `weight_kg`, `height_cm` | `family_members` | `NUMERIC` | ICMR-NIN calorie calculation runs math on these |
| `daily_calorie_target` | `family_members` | `INTEGER` | Backend calculation result, queried for display |
| `dietary_type` | `family_members` | `TEXT` | You may filter members by dietary type |
| `activity_level`, `primary_goal` | `family_members` | `TEXT` | Conflict engine reads these as hard enum signals |
| `harmony_score` | `meal_plans` | `INTEGER` | Dashboard may sort/filter plans by score |
| `total_monthly_budget`, all budget amounts | `monthly_budgets` | `NUMERIC` | The deterministic math guardrail does arithmetic on these |
| `generation_status` | `meal_plans` | `TEXT` | Frontend polls this column to update the waiting screen |
| `week_start_date` | `weekly_contexts` | `DATE` | Queried with WHERE to fetch the current week's context |
| `status` | `grocery_lists`, `weekly_contexts` | `TEXT` | Filtered to get only active records |
| `appliances` | `families` | `JSONB` | Multi-select display, never filtered in SQL |
| `health_conditions` | `family_members` | `JSONB` | Free-form multi-select + user-typed conditions |
| `allergies` | `family_members` | `JSONB` | Multi-select, passed as blob to Gemini |
| `ingredient_dislikes` | `family_members` | `JSONB` | Up to 5 free-text strings |
| `religious_cultural_rules` | `family_members` | `JSONB` | Complex object with type + details |
| `occasional_nonveg_config` | `family_members` | `JSONB` | `{ days: [], types: [] }` — nullable |
| `fasting_config` | `family_members` | `JSONB` | `{ type, weekly_days, ekadashi, festival_alerts }` |
| `pantry_snapshot` | `weekly_contexts` | `JSONB` | Dynamic ingredient list — read as blob |
| `active_medications` | `member_weekly_contexts` | `JSONB` | Free text array — passed directly to Gemini |
| `fasting_days_this_week` | `member_weekly_contexts` | `JSONB` | Day array — read as blob |
| `budget_breakdown` | `monthly_budgets` | `JSONB` | Meal weight splits — read as blob |
| `days` | `meal_plans` | `JSONB` | The full 7-day plan — massive blob, never SQL-filtered |
| `harmony_score_breakdown` | `meal_plans` | `JSONB` | Detailed score object — read for display |
| `items` | `grocery_lists` | `JSONB` | Dynamic item list with purchase status |
| `messages` | `ai_chat_logs` | `JSONB` | Full conversation history |
| `generation_log` | `meal_plans` | `JSONB` | Status update messages with timings for waiting screen |

---

## PART 2: RAW SQL DDL — Paste Directly into Supabase SQL Editor

Run these statements **in order**. Each statement is self-contained.

```sql
-- ═══════════════════════════════════════════════════════════════════
-- NUTRINEXT PARIVARSEEHAT — SUPABASE DDL
-- Run in Supabase SQL Editor. Order matters.
-- ═══════════════════════════════════════════════════════════════════

-- Enable UUID extension (already enabled in Supabase by default, but safe to re-run)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────────────────────────
-- TABLE 1: families
-- One row per registered family/household.
-- user_id references auth.users (Supabase Auth — do NOT add a FK here,
-- Supabase auth schema is separate and Drizzle cannot reference it).
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS families (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID        NOT NULL,                       -- FK to auth.users, enforced at app level
  name                       TEXT        NOT NULL,                       -- Family display name e.g. "Sharma Parivar"
  state_region               TEXT        NOT NULL,                       -- e.g. "Jharkhand", "Delhi"
  language_preference        TEXT        NOT NULL DEFAULT 'hindi',       -- 'hindi' | 'english'
  household_dietary_baseline TEXT        NOT NULL,                       -- 'strictly_veg' | 'veg_with_eggs' | 'non_veg' | 'mixed'
  meals_per_day              TEXT        NOT NULL DEFAULT '3_meals',     -- '2_meals' | '3_meals' | '3_meals_snacks'
  cooking_skill_level        TEXT        NOT NULL DEFAULT 'intermediate',-- 'beginner' | 'intermediate' | 'experienced'
  appliances                 JSONB       NOT NULL DEFAULT '[]',          -- ["gas_stove","pressure_cooker","mixer_grinder",...]
  pincode                    TEXT,                                        -- For grocery price lookup
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS families_user_id_idx ON families(user_id);


-- ─────────────────────────────────────────────────────────────────
-- TABLE 2: family_members
-- One row per person in the household.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS family_members (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id                UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name                     TEXT        NOT NULL,
  age                      INTEGER     NOT NULL,                              -- Used for auto-assignment rules
  gender                   TEXT        NOT NULL,                              -- 'male' | 'female' | 'other'
  height_cm                NUMERIC(5,1),                                      -- Optional
  weight_kg                NUMERIC(5,1),                                      -- Optional, used for calorie calc
  activity_level           TEXT        NOT NULL DEFAULT 'lightly_active',     -- 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active'
  primary_goal             TEXT        NOT NULL DEFAULT 'no_specific_goal',   -- 'weight_loss' | 'weight_gain' | 'maintain' | 'build_muscle' | 'manage_condition' | 'no_specific_goal' | 'early_childhood_nutrition' | 'healthy_growth' | 'senior_nutrition'
  goal_pace                TEXT,                                              -- 'slow_0.25kg' | 'moderate_0.5kg' | NULL
  daily_calorie_target     INTEGER,                                           -- Auto-calculated by backend, stored here
  dietary_type             TEXT        NOT NULL,                              -- 'strictly_vegetarian' | 'jain_vegetarian' | 'eggetarian' | 'non_vegetarian' | 'occasional_non_veg'
  spice_tolerance          TEXT        NOT NULL DEFAULT 'medium',             -- 'mild' | 'medium' | 'spicy'
  tiffin_needed            TEXT        NOT NULL DEFAULT 'no',                 -- 'no' | 'yes_school' | 'yes_office'
  festival_fasting_alerts  BOOLEAN     NOT NULL DEFAULT FALSE,
  display_order            INTEGER     NOT NULL DEFAULT 0,                    -- Controls display order in UI
  -- JSONB COLUMNS — Read as blobs, never SQL-filtered
  health_conditions        JSONB       NOT NULL DEFAULT '[]',                 -- ["diabetes_type_2","hypertension",...]
  allergies                JSONB       NOT NULL DEFAULT '[]',                 -- ["peanuts","dairy",...]
  ingredient_dislikes      JSONB       NOT NULL DEFAULT '[]',                 -- ["karela","brinjal"] — max 5
  religious_cultural_rules JSONB       NOT NULL DEFAULT '{}',                 -- {"type":"no_beef","details":[]}
  occasional_nonveg_config JSONB,                                             -- {"days":["monday","friday"],"types":["chicken","eggs"]} | NULL
  fasting_config           JSONB       NOT NULL DEFAULT '{}',                 -- {"type":"weekly","weekly_days":["monday"],"ekadashi":true,"festival_alerts":true}
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS family_members_family_id_idx ON family_members(family_id);


-- ─────────────────────────────────────────────────────────────────
-- TABLE 3: monthly_budgets
-- Set once per month per family. The 40/50/10 math is done in
-- backend and stored here. UNIQUE on (family_id, month_year).
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_budgets (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id                   UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  month_year                  TEXT        NOT NULL,                     -- Format: 'YYYY-MM' e.g. '2025-07'
  total_monthly_budget        NUMERIC(10,2) NOT NULL,                  -- User-entered total
  staples_budget              NUMERIC(10,2) NOT NULL,                  -- 40% of total
  perishables_budget          NUMERIC(10,2) NOT NULL,                  -- 50% of total
  buffer_budget               NUMERIC(10,2) NOT NULL,                  -- 10% of total (dry fruits + fruits)
  daily_perishable_limit      NUMERIC(10,2) NOT NULL,                  -- perishables_budget / days_in_month
  regional_price_suggestion   NUMERIC(10,2),                           -- Auto-suggested based on state_region
  -- JSONB: meal weight splits for budget distribution
  budget_breakdown            JSONB       NOT NULL DEFAULT '{}',       -- {"breakfast_weight":0.28,"lunch_weight":0.36,"dinner_weight":0.36,"daily_limits":{"breakfast":46,"lunch":60,"dinner":60}}
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT monthly_budgets_family_month_unique UNIQUE (family_id, month_year)
);


-- ─────────────────────────────────────────────────────────────────
-- TABLE 4: weekly_contexts
-- The "popup" filled before each week's meal generation.
-- Unique per family per week_start_date.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_contexts (
  id                                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id                           UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  week_start_date                     DATE        NOT NULL,            -- Always a Monday e.g. '2025-07-07'
  eating_out_frequency                TEXT        NOT NULL DEFAULT 'none', -- 'none' | '1_to_2_times' | 'frequently'
  weekday_cooking_time                TEXT        NOT NULL DEFAULT '20_40_mins', -- 'under_20_mins' | '20_40_mins' | 'no_limit'
  weekend_cooking_time                TEXT        NOT NULL DEFAULT 'no_preference', -- 'quick' | 'elaborate' | 'no_preference'
  weekly_perishable_budget_override   NUMERIC(10,2),                  -- User can override the calculated weekly limit
  special_request                     TEXT,                            -- Free text, passed directly to Gemini as priority-1 instruction
  status                              TEXT        NOT NULL DEFAULT 'draft', -- 'draft' | 'submitted' | 'meal_plan_generated'
  -- JSONB: pantry scan — dynamic ingredient list
  pantry_snapshot                     JSONB       NOT NULL DEFAULT '[]', -- [{"name":"spinach","quantity":200,"unit":"grams","is_perishable":true}]
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT weekly_contexts_family_week_unique UNIQUE (family_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS weekly_contexts_family_id_idx ON weekly_contexts(family_id);
CREATE INDEX IF NOT EXISTS weekly_contexts_week_start_idx ON weekly_contexts(week_start_date);


-- ─────────────────────────────────────────────────────────────────
-- TABLE 5: member_weekly_contexts
-- Per-member overrides for a specific week. Pre-filled from profile,
-- editable by the user in the weekly popup flow.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_weekly_contexts (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_context_id           UUID        NOT NULL REFERENCES weekly_contexts(id) ON DELETE CASCADE,
  family_member_id            UUID        NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  current_goal_override       TEXT,                                    -- NULL = use profile goal. Set if changed this week.
  current_weight_kg           NUMERIC(5,1),                            -- Weight update for this week
  feeling_this_week           TEXT,                                    -- Free text: "low energy, bloating" — passed to Gemini
  spice_tolerance_override    TEXT,                                    -- NULL = use profile. 'mild'|'medium'|'spicy'
  tiffin_needed_override      TEXT,                                    -- NULL = use profile.
  -- JSONB COLUMNS
  health_conditions_override  JSONB,                                   -- NULL = use profile. Set to modified array if changed.
  active_medications          JSONB       NOT NULL DEFAULT '[]',       -- [{"name":"Metformin","timing":"with_breakfast","notes":""}]
  fasting_days_this_week      JSONB       NOT NULL DEFAULT '[]',       -- ["monday","thursday"]
  ekadashi_this_week          BOOLEAN     NOT NULL DEFAULT FALSE,
  festival_fast_this_week     BOOLEAN     NOT NULL DEFAULT FALSE,
  nonveg_days_this_week       JSONB       NOT NULL DEFAULT '[]',       -- For occasional_non_veg members only
  nonveg_types_this_week      JSONB       NOT NULL DEFAULT '[]',       -- ["chicken","eggs"]
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT member_weekly_ctx_unique UNIQUE (weekly_context_id, family_member_id)
);

CREATE INDEX IF NOT EXISTS mwc_weekly_context_id_idx ON member_weekly_contexts(weekly_context_id);


-- ─────────────────────────────────────────────────────────────────
-- TABLE 6: meal_plans
-- The generated 7-day plan. The full plan lives in the `days` JSONB.
-- `generation_status` is polled by the frontend for the waiting screen.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_plans (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_context_id         UUID        NOT NULL REFERENCES weekly_contexts(id) ON DELETE CASCADE,
  family_id                 UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  harmony_score             INTEGER,                                    -- 0–100, deterministic formula
  generation_status         TEXT        NOT NULL DEFAULT 'pending',    -- 'pending' | 'processing' | 'completed' | 'failed'
  -- JSONB COLUMNS
  harmony_score_breakdown   JSONB       NOT NULL DEFAULT '{}',         -- {"base":100,"deductions":[{"reason":"...","points":-5}],"additions":[{"reason":"...","points":3}],"conflicts_detected":[],"conflicts_resolved":[]}
  generation_log            JSONB       NOT NULL DEFAULT '[]',         -- [{"message":"Calibrating regional prices...","duration_ms":800,"completed":true}]
  days                      JSONB       NOT NULL DEFAULT '[]',         -- SEE JSONB STRUCTURE DOCS BELOW
  nutritional_summary       JSONB       NOT NULL DEFAULT '{}',         -- Per-member daily calorie/macro summary
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meal_plans_family_id_idx ON meal_plans(family_id);
CREATE INDEX IF NOT EXISTS meal_plans_weekly_context_id_idx ON meal_plans(weekly_context_id);
CREATE INDEX IF NOT EXISTS meal_plans_generation_status_idx ON meal_plans(generation_status);


-- ─────────────────────────────────────────────────────────────────
-- TABLE 7: grocery_lists
-- Three types: monthly_staples (40%), weekly_perishables (50%),
-- buffer_fruits_dryfruit (10%). All item data lives in JSONB.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grocery_lists (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id             UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  meal_plan_id          UUID        REFERENCES meal_plans(id) ON DELETE SET NULL,
  list_type             TEXT        NOT NULL,                          -- 'monthly_staples' | 'weekly_perishables' | 'buffer_fruits_dryfruit'
  month_year            TEXT,                                          -- Set for monthly_staples: 'YYYY-MM'
  week_start_date       DATE,                                          -- Set for weekly_perishables
  total_estimated_cost  NUMERIC(10,2),
  status                TEXT        NOT NULL DEFAULT 'active',        -- 'active' | 'archived'
  -- JSONB COLUMNS
  items                 JSONB       NOT NULL DEFAULT '[]',             -- [{"name":"Basmati Rice","quantity":5,"unit":"kg","estimated_price":350,"category":"staple","purchased":false}]
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS grocery_lists_family_id_idx ON grocery_lists(family_id);
CREATE INDEX IF NOT EXISTS grocery_lists_meal_plan_id_idx ON grocery_lists(meal_plan_id);


-- ─────────────────────────────────────────────────────────────────
-- TABLE 8: ai_chat_logs
-- Stores all AI conversation sessions — onboarding, pantry scan,
-- meal logging, general chat. Extracted structured data is also stored.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_chat_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  session_type    TEXT        NOT NULL,                                -- 'profile_onboarding' | 'pantry_scan' | 'meal_log' | 'general'
  -- JSONB COLUMNS
  messages        JSONB       NOT NULL DEFAULT '[]',                   -- [{"role":"user","content":"Mujhe batao...","timestamp":"...","language":"hi"}]
  extracted_data  JSONB       NOT NULL DEFAULT '{}',                   -- Structured data parsed from conversation (member profiles, pantry items, etc.)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_chat_logs_family_id_idx ON ai_chat_logs(family_id);
CREATE INDEX IF NOT EXISTS ai_chat_logs_session_type_idx ON ai_chat_logs(session_type);


-- ─────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) — Critical for Supabase
-- Enable RLS on all tables so users can only see their own data.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE families              ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_budgets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_contexts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_weekly_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_logs          ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own family's data
CREATE POLICY "Users access own family" ON families
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own family members" ON family_members
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE user_id = auth.uid())
  );

CREATE POLICY "Users access own monthly budgets" ON monthly_budgets
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE user_id = auth.uid())
  );

CREATE POLICY "Users access own weekly contexts" ON weekly_contexts
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE user_id = auth.uid())
  );

CREATE POLICY "Users access own member weekly contexts" ON member_weekly_contexts
  FOR ALL USING (
    weekly_context_id IN (
      SELECT wc.id FROM weekly_contexts wc
      JOIN families f ON f.id = wc.family_id
      WHERE f.user_id = auth.uid()
    )
  );

CREATE POLICY "Users access own meal plans" ON meal_plans
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE user_id = auth.uid())
  );

CREATE POLICY "Users access own grocery lists" ON grocery_lists
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE user_id = auth.uid())
  );

CREATE POLICY "Users access own ai chat logs" ON ai_chat_logs
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE user_id = auth.uid())
  );
```

---

## PART 3: DRIZZLE ORM SCHEMA — `schema.ts`

Create this file at the root of your project or in a `/db` folder.
Install dependencies first: `npm install drizzle-orm pg` and `npm install -D drizzle-kit @types/pg`

```typescript
// schema.ts — NutriNext ParivarSehat — Complete Drizzle ORM Schema
// 100% copy-pasteable. Do not modify column names — they must match the SQL DDL above.

import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  jsonb,
  timestamp,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────
// Shared timestamp helper — reuse across all tables
// ─────────────────────────────────────────────────────────────────
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

// ═══════════════════════════════════════════════════════════════════
// TABLE 1: families
// ═══════════════════════════════════════════════════════════════════
export const families = pgTable(
  "families",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(), // auth.users FK — enforced at app level
    name: text("name").notNull(),
    stateRegion: text("state_region").notNull(),
    languagePreference: text("language_preference").notNull().default("hindi"),
    householdDietaryBaseline: text("household_dietary_baseline").notNull(),
    // Allowed values: 'strictly_veg' | 'veg_with_eggs' | 'non_veg' | 'mixed'
    mealsPerDay: text("meals_per_day").notNull().default("3_meals"),
    // Allowed values: '2_meals' | '3_meals' | '3_meals_snacks'
    cookingSkillLevel: text("cooking_skill_level")
      .notNull()
      .default("intermediate"),
    // Allowed values: 'beginner' | 'intermediate' | 'experienced'
    appliances: jsonb("appliances")
      .notNull()
      .default(sql`'[]'::jsonb`),
    // JSONB shape: string[] — ["gas_stove","pressure_cooker","mixer_grinder","oven_otg","microwave","air_fryer"]
    pincode: text("pincode"),
    ...timestamps,
  },
  (table) => ({
    userIdIdx: index("families_user_id_idx").on(table.userId),
  })
);

// ═══════════════════════════════════════════════════════════════════
// TABLE 2: family_members
// ═══════════════════════════════════════════════════════════════════
export const familyMembers = pgTable(
  "family_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    age: integer("age").notNull(),
    gender: text("gender").notNull(),
    // Allowed values: 'male' | 'female' | 'other'
    heightCm: numeric("height_cm", { precision: 5, scale: 1 }),
    weightKg: numeric("weight_kg", { precision: 5, scale: 1 }),
    activityLevel: text("activity_level").notNull().default("lightly_active"),
    // Allowed values: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active'
    primaryGoal: text("primary_goal").notNull().default("no_specific_goal"),
    // Allowed values: 'weight_loss' | 'weight_gain' | 'maintain' | 'build_muscle' |
    //                 'manage_condition' | 'no_specific_goal' |
    //                 'early_childhood_nutrition' | 'healthy_growth' | 'senior_nutrition'
    goalPace: text("goal_pace"),
    // Allowed values: 'slow_0.25kg' | 'moderate_0.5kg' | null
    dailyCalorieTarget: integer("daily_calorie_target"),
    // Calculated by backend ICMR-NIN logic and stored here
    dietaryType: text("dietary_type").notNull(),
    // Allowed values: 'strictly_vegetarian' | 'jain_vegetarian' | 'eggetarian' |
    //                 'non_vegetarian' | 'occasional_non_veg'
    spiceTolerance: text("spice_tolerance").notNull().default("medium"),
    // Allowed values: 'mild' | 'medium' | 'spicy'
    tiffinNeeded: text("tiffin_needed").notNull().default("no"),
    // Allowed values: 'no' | 'yes_school' | 'yes_office'
    festivalFastingAlerts: boolean("festival_fasting_alerts")
      .notNull()
      .default(false),
    displayOrder: integer("display_order").notNull().default(0),

    // ── JSONB columns ──────────────────────────────────────────────
    healthConditions: jsonb("health_conditions")
      .notNull()
      .default(sql`'[]'::jsonb`),
    // JSONB shape: string[]
    // Allowed values: "none" | "diabetes_type_2" | "hypertension" | "anaemia" |
    //                 "obesity" | "high_cholesterol" | "hypothyroid" | "pcos" |
    //                 "kidney_issues" | any user-typed string

    allergies: jsonb("allergies")
      .notNull()
      .default(sql`'[]'::jsonb`),
    // JSONB shape: string[]
    // Allowed values: "none" | "peanuts" | "dairy" | "gluten" | "tree_nuts" |
    //                 "shellfish" | "soy" | "sesame"

    ingredientDislikes: jsonb("ingredient_dislikes")
      .notNull()
      .default(sql`'[]'::jsonb`),
    // JSONB shape: string[] — max 5 items e.g. ["karela","brinjal","methi"]

    religiousCulturalRules: jsonb("religious_cultural_rules")
      .notNull()
      .default(sql`'{}'::jsonb`),
    // JSONB shape: { type: string, details: string[] }
    // type allowed values: "none" | "no_beef" | "no_pork" | "sattvic_no_onion_garlic" | "jain_rules"

    occasionalNonvegConfig: jsonb("occasional_nonveg_config"),
    // JSONB shape (nullable): { days: string[], types: string[] }
    // days: ["monday","friday"] — types: ["chicken","mutton","fish","eggs"]
    // NULL if dietary_type !== 'occasional_non_veg'

    fastingConfig: jsonb("fasting_config")
      .notNull()
      .default(sql`'{}'::jsonb`),
    // JSONB shape: { type: string, weekly_days: string[], ekadashi: boolean, festival_alerts: boolean }
    // type allowed values: "no_fasting" | "weekly" | "ekadashi"
    // weekly_days: ["monday","thursday"]

    ...timestamps,
  },
  (table) => ({
    familyIdIdx: index("family_members_family_id_idx").on(table.familyId),
  })
);

// ═══════════════════════════════════════════════════════════════════
// TABLE 3: monthly_budgets
// ═══════════════════════════════════════════════════════════════════
export const monthlyBudgets = pgTable(
  "monthly_budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    monthYear: text("month_year").notNull(),
    // Format: 'YYYY-MM' e.g. '2025-07'
    totalMonthlyBudget: numeric("total_monthly_budget", {
      precision: 10,
      scale: 2,
    }).notNull(),
    staplesBudget: numeric("staples_budget", {
      precision: 10,
      scale: 2,
    }).notNull(),
    // = totalMonthlyBudget * 0.40
    perishablesBudget: numeric("perishables_budget", {
      precision: 10,
      scale: 2,
    }).notNull(),
    // = totalMonthlyBudget * 0.50
    bufferBudget: numeric("buffer_budget", {
      precision: 10,
      scale: 2,
    }).notNull(),
    // = totalMonthlyBudget * 0.10
    dailyPerishableLimit: numeric("daily_perishable_limit", {
      precision: 10,
      scale: 2,
    }).notNull(),
    // = perishablesBudget / days_in_month
    regionalPriceSuggestion: numeric("regional_price_suggestion", {
      precision: 10,
      scale: 2,
    }),

    budgetBreakdown: jsonb("budget_breakdown")
      .notNull()
      .default(sql`'{}'::jsonb`),
    // JSONB shape: {
    //   breakfast_weight: number,  // e.g. 0.28
    //   lunch_weight: number,      // e.g. 0.36
    //   dinner_weight: number,     // e.g. 0.36
    //   daily_limits: { breakfast: number, lunch: number, dinner: number }
    // }

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniq: unique("monthly_budgets_family_month_unique").on(
      table.familyId,
      table.monthYear
    ),
  })
);

// ═══════════════════════════════════════════════════════════════════
// TABLE 4: weekly_contexts
// ═══════════════════════════════════════════════════════════════════
export const weeklyContexts = pgTable(
  "weekly_contexts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    weekStartDate: date("week_start_date").notNull(),
    // Always a Monday — e.g. '2025-07-07'
    eatingOutFrequency: text("eating_out_frequency")
      .notNull()
      .default("none"),
    // Allowed values: 'none' | '1_to_2_times' | 'frequently'
    weekdayCookingTime: text("weekday_cooking_time")
      .notNull()
      .default("20_40_mins"),
    // Allowed values: 'under_20_mins' | '20_40_mins' | 'no_limit'
    weekendCookingTime: text("weekend_cooking_time")
      .notNull()
      .default("no_preference"),
    // Allowed values: 'quick' | 'elaborate' | 'no_preference'
    weeklyPerishableBudgetOverride: numeric(
      "weekly_perishable_budget_override",
      { precision: 10, scale: 2 }
    ),
    specialRequest: text("special_request"),
    // Free text, high-priority instruction passed directly to Gemini
    status: text("status").notNull().default("draft"),
    // Allowed values: 'draft' | 'submitted' | 'meal_plan_generated'

    pantrySnapshot: jsonb("pantry_snapshot")
      .notNull()
      .default(sql`'[]'::jsonb`),
    // JSONB shape: Array<{
    //   name: string,          // e.g. "spinach"
    //   quantity: number,      // e.g. 200
    //   unit: string,          // e.g. "grams" | "pieces" | "kg" | "litres"
    //   is_perishable: boolean // true = must be used up this week (zero-waste)
    // }>

    ...timestamps,
  },
  (table) => ({
    familyIdIdx: index("weekly_contexts_family_id_idx").on(table.familyId),
    weekStartIdx: index("weekly_contexts_week_start_idx").on(
      table.weekStartDate
    ),
    uniq: unique("weekly_contexts_family_week_unique").on(
      table.familyId,
      table.weekStartDate
    ),
  })
);

// ═══════════════════════════════════════════════════════════════════
// TABLE 5: member_weekly_contexts
// ═══════════════════════════════════════════════════════════════════
export const memberWeeklyContexts = pgTable(
  "member_weekly_contexts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weeklyContextId: uuid("weekly_context_id")
      .notNull()
      .references(() => weeklyContexts.id, { onDelete: "cascade" }),
    familyMemberId: uuid("family_member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    currentGoalOverride: text("current_goal_override"),
    // NULL = use profile goal. Set if user changed it this week.
    currentWeightKg: numeric("current_weight_kg", { precision: 5, scale: 1 }),
    feelingThisWeek: text("feeling_this_week"),
    // Free text — e.g. "low energy, heavy cold" — passed to Gemini
    spiceToleranceOverride: text("spice_tolerance_override"),
    // NULL = use profile value
    tiffinNeededOverride: text("tiffin_needed_override"),
    // NULL = use profile value
    ekadashiThisWeek: boolean("ekadashi_this_week").notNull().default(false),
    festivalFastThisWeek: boolean("festival_fast_this_week")
      .notNull()
      .default(false),

    // ── JSONB columns ──────────────────────────────────────────────
    healthConditionsOverride: jsonb("health_conditions_override"),
    // NULL = use profile. Set to modified string[] if user added/removed conditions.

    activeMedications: jsonb("active_medications")
      .notNull()
      .default(sql`'[]'::jsonb`),
    // JSONB shape: Array<{
    //   name: string,    // e.g. "Metformin"
    //   timing: string,  // e.g. "with_breakfast" | "before_dinner" | "at_night"
    //   notes: string    // e.g. "avoid calcium-rich foods within 2hrs"
    // }>

    fastingDaysThisWeek: jsonb("fasting_days_this_week")
      .notNull()
      .default(sql`'[]'::jsonb`),
    // JSONB shape: string[] — ["monday","thursday"]

    nonvegDaysThisWeek: jsonb("nonveg_days_this_week")
      .notNull()
      .default(sql`'[]'::jsonb`),
    // Only relevant for occasional_non_veg members
    // JSONB shape: string[] — ["tuesday","saturday"]

    nonvegTypesThisWeek: jsonb("nonveg_types_this_week")
      .notNull()
      .default(sql`'[]'::jsonb`),
    // JSONB shape: string[] — ["chicken","eggs"]

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    weeklyContextIdIdx: index("mwc_weekly_context_id_idx").on(
      table.weeklyContextId
    ),
    uniq: unique("member_weekly_ctx_unique").on(
      table.weeklyContextId,
      table.familyMemberId
    ),
  })
);

// ═══════════════════════════════════════════════════════════════════
// TABLE 6: meal_plans
// ═══════════════════════════════════════════════════════════════════
export const mealPlans = pgTable(
  "meal_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weeklyContextId: uuid("weekly_context_id")
      .notNull()
      .references(() => weeklyContexts.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    harmonyScore: integer("harmony_score"),
    generationStatus: text("generation_status").notNull().default("pending"),
    // Allowed values: 'pending' | 'processing' | 'completed' | 'failed'
    // Frontend POLLS this field during the waiting screen.

    // ── JSONB columns ──────────────────────────────────────────────
    harmonyScoreBreakdown: jsonb("harmony_score_breakdown")
      .notNull()
      .default(sql`'{}'::jsonb`),
    // JSONB shape: {
    //   base: 100,
    //   deductions: Array<{ reason: string, points: number }>,
    //   additions: Array<{ reason: string, points: number }>,
    //   conflicts_detected: Array<{ member_ids: string[], description: string }>,
    //   conflicts_resolved: Array<{ description: string, resolution: string }>
    // }

    generationLog: jsonb("generation_log")
      .notNull()
      .default(sql`'[]'::jsonb`),
    // JSONB shape: Array<{
    //   message: string,      // e.g. "Calibrating regional food prices..."
    //   duration_ms: number,  // e.g. 800
    //   completed: boolean
    // }>
    // Rendered live on the waiting screen.

    days: jsonb("days").notNull().default(sql`'[]'::jsonb`),
    // JSONB shape: Array<{
    //   date: string,       // e.g. "2025-07-07"
    //   day_name: string,   // e.g. "Monday"
    //   meals: {
    //     breakfast?: MealSlot,
    //     lunch?: MealSlot,
    //     dinner?: MealSlot,
    //     snack?: MealSlot
    //   }
    // }>
    //
    // MealSlot shape: {
    //   name: string,               // e.g. "Palak Dal & Jowar Roti"
    //   is_base_dish: boolean,
    //   base_recipe: {
    //     ingredients: Array<{ name: string, quantity: string }>,
    //     steps: string[],
    //     prep_time_mins: number,
    //     cook_time_mins: number,
    //     image_search_query: string  // Used to fetch image from internet
    //   },
    //   member_plates: Array<{
    //     member_id: string,
    //     member_name: string,
    //     modifications: string[],    // e.g. ["Use Jowar roti instead of wheat","Add lemon, reduce salt by 50%"]
    //     fasting_replacement?: string // e.g. "Sabudana Khichdi" if fasting
    //   }>,
    //   pantry_items_used: string[],  // Zero-waste tracking
    //   estimated_cost: number,
    //   priority_flags: string[]      // e.g. ["medication_window_respected","allergy_compliant"]
    // }

    nutritionalSummary: jsonb("nutritional_summary")
      .notNull()
      .default(sql`'{}'::jsonb`),
    // JSONB shape: {
    //   [member_id: string]: {
    //     member_name: string,
    //     daily_avg_calories: number,
    //     daily_target_calories: number,
    //     weekly_protein_g: number,
    //     nutritional_debt: string[],   // e.g. ["Low Iron on Tuesday (fasting day)"]
    //     fasting_days_handled: string[]
    //   }
    // }

    ...timestamps,
  },
  (table) => ({
    familyIdIdx: index("meal_plans_family_id_idx").on(table.familyId),
    weeklyContextIdIdx: index("meal_plans_weekly_context_id_idx").on(
      table.weeklyContextId
    ),
    generationStatusIdx: index("meal_plans_generation_status_idx").on(
      table.generationStatus
    ),
  })
);

// ═══════════════════════════════════════════════════════════════════
// TABLE 7: grocery_lists
// ═══════════════════════════════════════════════════════════════════
export const groceryLists = pgTable(
  "grocery_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    mealPlanId: uuid("meal_plan_id").references(() => mealPlans.id, {
      onDelete: "set null",
    }),
    listType: text("list_type").notNull(),
    // Allowed values: 'monthly_staples' | 'weekly_perishables' | 'buffer_fruits_dryfruit'
    monthYear: text("month_year"),
    // Set for monthly_staples lists — format: 'YYYY-MM'
    weekStartDate: date("week_start_date"),
    // Set for weekly_perishables lists
    totalEstimatedCost: numeric("total_estimated_cost", {
      precision: 10,
      scale: 2,
    }),
    status: text("status").notNull().default("active"),
    // Allowed values: 'active' | 'archived'

    items: jsonb("items").notNull().default(sql`'[]'::jsonb`),
    // JSONB shape: Array<{
    //   name: string,              // e.g. "Basmati Rice"
    //   quantity: number,          // e.g. 5
    //   unit: string,              // e.g. "kg" | "litres" | "pieces" | "grams"
    //   estimated_price: number,   // e.g. 350
    //   category: string,          // e.g. "grain" | "dal" | "oil" | "vegetable" | "dairy" | "spice"
    //   purchased: boolean,        // User can tick off items
    //   notes?: string             // e.g. "Buy from local mandi for better price"
    // }>

    ...timestamps,
  },
  (table) => ({
    familyIdIdx: index("grocery_lists_family_id_idx").on(table.familyId),
    mealPlanIdIdx: index("grocery_lists_meal_plan_id_idx").on(
      table.mealPlanId
    ),
  })
);

// ═══════════════════════════════════════════════════════════════════
// TABLE 8: ai_chat_logs
// ═══════════════════════════════════════════════════════════════════
export const aiChatLogs = pgTable(
  "ai_chat_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    sessionType: text("session_type").notNull(),
    // Allowed values: 'profile_onboarding' | 'pantry_scan' | 'meal_log' | 'general'

    messages: jsonb("messages").notNull().default(sql`'[]'::jsonb`),
    // JSONB shape: Array<{
    //   role: "user" | "assistant",
    //   content: string,
    //   timestamp: string,   // ISO datetime
    //   language: string     // e.g. "hi" | "en" (detected by Sarvam)
    // }>

    extractedData: jsonb("extracted_data")
      .notNull()
      .default(sql`'{}'::jsonb`),
    // Structured data parsed from conversation.
    // Shape varies by session_type:
    // - profile_onboarding: { members: MemberProfile[] }
    // - pantry_scan: { pantry_items: PantryItem[] }
    // - meal_log: { logged_meals: LoggedMeal[], date: string }

    ...timestamps,
  },
  (table) => ({
    familyIdIdx: index("ai_chat_logs_family_id_idx").on(table.familyId),
    sessionTypeIdx: index("ai_chat_logs_session_type_idx").on(
      table.sessionType
    ),
  })
);

// ═══════════════════════════════════════════════════════════════════
// RELATIONS — Required for Drizzle's relational query API
// ═══════════════════════════════════════════════════════════════════
export const familiesRelations = relations(families, ({ many }) => ({
  members: many(familyMembers),
  weeklyContexts: many(weeklyContexts),
  monthlyBudgets: many(monthlyBudgets),
  mealPlans: many(mealPlans),
  groceryLists: many(groceryLists),
  aiChatLogs: many(aiChatLogs),
}));

export const familyMembersRelations = relations(
  familyMembers,
  ({ one, many }) => ({
    family: one(families, {
      fields: [familyMembers.familyId],
      references: [families.id],
    }),
    weeklyContexts: many(memberWeeklyContexts),
  })
);

export const weeklyContextsRelations = relations(
  weeklyContexts,
  ({ one, many }) => ({
    family: one(families, {
      fields: [weeklyContexts.familyId],
      references: [families.id],
    }),
    memberWeeklyContexts: many(memberWeeklyContexts),
    mealPlans: many(mealPlans),
  })
);

export const memberWeeklyContextsRelations = relations(
  memberWeeklyContexts,
  ({ one }) => ({
    weeklyContext: one(weeklyContexts, {
      fields: [memberWeeklyContexts.weeklyContextId],
      references: [weeklyContexts.id],
    }),
    familyMember: one(familyMembers, {
      fields: [memberWeeklyContexts.familyMemberId],
      references: [familyMembers.id],
    }),
  })
);

export const mealPlansRelations = relations(mealPlans, ({ one, many }) => ({
  weeklyContext: one(weeklyContexts, {
    fields: [mealPlans.weeklyContextId],
    references: [weeklyContexts.id],
  }),
  family: one(families, {
    fields: [mealPlans.familyId],
    references: [families.id],
  }),
  groceryLists: many(groceryLists),
}));

export const groceryListsRelations = relations(groceryLists, ({ one }) => ({
  family: one(families, {
    fields: [groceryLists.familyId],
    references: [families.id],
  }),
  mealPlan: one(mealPlans, {
    fields: [groceryLists.mealPlanId],
    references: [mealPlans.id],
  }),
}));

export const aiChatLogsRelations = relations(aiChatLogs, ({ one }) => ({
  family: one(families, {
    fields: [aiChatLogs.familyId],
    references: [families.id],
  }),
}));
```

---

## PART 4: THE MASTER FETCH QUERY

This is the single query your Data Access Layer calls. It returns one clean JSON payload that your backend passes to Gemini.

### Option A — Drizzle Relational Query (Recommended for TypeScript)

```typescript
// dataAccess.ts
import { db } from "./db"; // your drizzle db instance
import {
  families,
  familyMembers,
  weeklyContexts,
  memberWeeklyContexts,
  mealPlans,
  monthlyBudgets,
  groceryLists,
} from "./schema";
import { eq, and, desc, asc } from "drizzle-orm";

/**
 * THE MASTER FETCH — Returns a complete family payload for a given week.
 * Pass this entire object to your Gemini prompt chain.
 */
export async function getFamilyWeeklyPayload(
  userId: string,
  weekStartDate: string // Format: 'YYYY-MM-DD'
) {
  const payload = await db.query.families.findFirst({
    where: eq(families.userId, userId),
    with: {
      // All family members, ordered by display_order
      members: {
        orderBy: [asc(familyMembers.displayOrder)],
      },
      // The current month's budget
      monthlyBudgets: {
        orderBy: [desc(monthlyBudgets.createdAt)],
        limit: 1,
      },
      // This specific week's context + per-member overrides
      weeklyContexts: {
        where: eq(weeklyContexts.weekStartDate, weekStartDate),
        limit: 1,
        with: {
          memberWeeklyContexts: {
            with: {
              // Include the base member profile alongside the weekly override
              familyMember: true,
            },
          },
          // The meal plan for this week (if already generated)
          mealPlans: {
            orderBy: [desc(mealPlans.createdAt)],
            limit: 1,
          },
        },
      },
      // Active grocery lists for this week
      groceryLists: {
        where: and(
          eq(groceryLists.weekStartDate, weekStartDate),
          eq(groceryLists.status, "active")
        ),
      },
    },
  });

  return payload; // This is your complete JSON payload. Pass it to Gemini.
}
```

### Option B — Raw SQL with JSON Aggregation (Works Directly in Supabase SQL Editor)

```sql
-- THE MASTER FETCH QUERY — Single round trip, returns one JSON object
-- Replace 'YOUR_USER_ID' and 'YOUR_WEEK_START_DATE' with actual values.
-- e.g. week_start_date = '2025-07-07'

SELECT
  f.id                          AS family_id,
  f.name                        AS family_name,
  f.state_region,
  f.language_preference,
  f.household_dietary_baseline,
  f.meals_per_day,
  f.cooking_skill_level,
  f.appliances,
  f.pincode,

  -- All family members as a JSON array
  COALESCE(
    (
      SELECT json_agg(m ORDER BY m.display_order)
      FROM (
        SELECT
          fm.id,
          fm.name,
          fm.age,
          fm.gender,
          fm.height_cm,
          fm.weight_kg,
          fm.activity_level,
          fm.primary_goal,
          fm.goal_pace,
          fm.daily_calorie_target,
          fm.dietary_type,
          fm.spice_tolerance,
          fm.tiffin_needed,
          fm.festival_fasting_alerts,
          fm.display_order,
          fm.health_conditions,
          fm.allergies,
          fm.ingredient_dislikes,
          fm.religious_cultural_rules,
          fm.occasional_nonveg_config,
          fm.fasting_config
        FROM family_members fm
        WHERE fm.family_id = f.id
      ) m
    ),
    '[]'::json
  )                             AS members,

  -- Most recent monthly budget
  (
    SELECT row_to_json(b)
    FROM (
      SELECT
        mb.id,
        mb.month_year,
        mb.total_monthly_budget,
        mb.staples_budget,
        mb.perishables_budget,
        mb.buffer_budget,
        mb.daily_perishable_limit,
        mb.budget_breakdown
      FROM monthly_budgets mb
      WHERE mb.family_id = f.id
      ORDER BY mb.created_at DESC
      LIMIT 1
    ) b
  )                             AS current_budget,

  -- This week's context
  (
    SELECT row_to_json(wc_full)
    FROM (
      SELECT
        wc.id                           AS weekly_context_id,
        wc.week_start_date,
        wc.eating_out_frequency,
        wc.weekday_cooking_time,
        wc.weekend_cooking_time,
        wc.weekly_perishable_budget_override,
        wc.special_request,
        wc.status,
        wc.pantry_snapshot,

        -- Per-member weekly overrides for this week
        COALESCE(
          (
            SELECT json_agg(mwc_row)
            FROM (
              SELECT
                mwc.id,
                mwc.family_member_id,
                mwc.current_goal_override,
                mwc.current_weight_kg,
                mwc.feeling_this_week,
                mwc.spice_tolerance_override,
                mwc.tiffin_needed_override,
                mwc.ekadashi_this_week,
                mwc.festival_fast_this_week,
                mwc.health_conditions_override,
                mwc.active_medications,
                mwc.fasting_days_this_week,
                mwc.nonveg_days_this_week,
                mwc.nonveg_types_this_week
              FROM member_weekly_contexts mwc
              WHERE mwc.weekly_context_id = wc.id
            ) mwc_row
          ),
          '[]'::json
        )                               AS member_weekly_contexts,

        -- This week's meal plan (if generated)
        (
          SELECT row_to_json(mp)
          FROM (
            SELECT
              meal_plans.id,
              meal_plans.harmony_score,
              meal_plans.generation_status,
              meal_plans.harmony_score_breakdown,
              meal_plans.generation_log,
              meal_plans.days,
              meal_plans.nutritional_summary
            FROM meal_plans
            WHERE meal_plans.weekly_context_id = wc.id
            ORDER BY meal_plans.created_at DESC
            LIMIT 1
          ) mp
        )                               AS meal_plan

      FROM weekly_contexts wc
      WHERE wc.family_id = f.id
        AND wc.week_start_date = 'YOUR_WEEK_START_DATE'  -- e.g. '2025-07-07'
      LIMIT 1
    ) wc_full
  )                             AS this_week,

  -- Active grocery lists for this week
  COALESCE(
    (
      SELECT json_agg(gl)
      FROM (
        SELECT
          grocery_lists.id,
          grocery_lists.list_type,
          grocery_lists.total_estimated_cost,
          grocery_lists.items
        FROM grocery_lists
        WHERE grocery_lists.family_id = f.id
          AND grocery_lists.status = 'active'
          AND (
            grocery_lists.week_start_date = 'YOUR_WEEK_START_DATE'
            OR grocery_lists.list_type = 'monthly_staples'
          )
      ) gl
    ),
    '[]'::json
  )                             AS grocery_lists

FROM families f
WHERE f.user_id = 'YOUR_USER_ID'  -- Replace with auth.uid() in Supabase RPC
LIMIT 1;
```

---

## PART 5: SETUP CHECKLIST FOR REPLIT

Give this checklist to Replit. If you paste this verbatim, it cannot hallucinate a single step.

```
EXACT SETUP STEPS FOR REPLIT:

Step 1: Install packages
npm install drizzle-orm pg dotenv
npm install -D drizzle-kit @types/pg tsx

Step 2: Create /db/schema.ts
→ Paste the entire schema.ts from Part 3 above. Do not add or remove any lines.

Step 3: Create /db/index.ts with this exact content:
────────────────────────────────────
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
────────────────────────────────────

Step 4: Create drizzle.config.ts with this exact content:
────────────────────────────────────
import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config();

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
────────────────────────────────────

Step 5: Add to .env
DATABASE_URL=<your Supabase connection string from Supabase Dashboard → Settings → Database → Connection String → URI>

Step 6: Run in Replit shell
npx drizzle-kit push:pg

This pushes all tables to Supabase. You do NOT need to run the raw SQL separately if you use this step.
```

---

## APPENDIX: Priority Hierarchy — How to Use the Schema in Your Conflict Engine

Your backend conflict resolution engine should merge data from the payload in this order before building the Gemini prompt:

```
For each family member, the "effective profile" for this week is built as:

1. Start with: family_members (base profile — permanent truth)
2. Override with: member_weekly_contexts (this week's truth)
   - If current_goal_override IS NOT NULL → use it; else use primary_goal
   - If health_conditions_override IS NOT NULL → use it; else use health_conditions
   - If current_weight_kg IS NOT NULL → use it; else use weight_kg
   - Merge fasting_days_this_week ON TOP OF fasting_config.weekly_days (union, not replace)
   - active_medications always comes from member_weekly_contexts (fresh each week)

3. Apply auto-assignment rules (your backend, not DB):
   - age < 5  → primary_goal = 'early_childhood_nutrition'
   - 5 ≤ age ≤ 12 → primary_goal = 'healthy_growth'
   - 13 ≤ age ≤ 17 → hide 'weight_loss' option
   - age ≥ 60 → primary_goal = 'senior_nutrition' (unless overridden)

4. Apply priority hierarchy to detect conflicts:
   Level 1 — allergies (JSONB from family_members)
   Level 2 — religious_cultural_rules (JSONB from family_members)
   Level 3 — active_medications timing (JSONB from member_weekly_contexts)
   Level 4 — health_conditions / health_conditions_override
   Level 5 — primary_goal / current_goal_override
   Level 6 — spice_tolerance, ingredient_dislikes

5. Build harmony_score_breakdown JSONB and store it in meal_plans.
```
