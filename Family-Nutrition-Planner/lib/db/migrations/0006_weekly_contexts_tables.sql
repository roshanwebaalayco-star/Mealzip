CREATE TABLE IF NOT EXISTS weekly_contexts (
  id serial PRIMARY KEY,
  family_id integer NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  eating_out_frequency text NOT NULL DEFAULT 'none',
  weekday_cooking_time text NOT NULL DEFAULT '20_40_mins',
  weekend_cooking_time text NOT NULL DEFAULT 'no_preference',
  weekly_perishable_budget_override numeric(10,2),
  special_request text,
  status text NOT NULL DEFAULT 'draft',
  pantry_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS weekly_contexts_family_id_idx ON weekly_contexts(family_id);
CREATE INDEX IF NOT EXISTS weekly_contexts_week_start_idx ON weekly_contexts(week_start_date);
CREATE UNIQUE INDEX IF NOT EXISTS weekly_contexts_family_week_unique ON weekly_contexts(family_id, week_start_date);

CREATE TABLE IF NOT EXISTS member_weekly_contexts (
  id serial PRIMARY KEY,
  weekly_context_id integer NOT NULL REFERENCES weekly_contexts(id) ON DELETE CASCADE,
  family_member_id integer NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  current_goal_override text,
  current_weight_kg numeric(5,1),
  feeling_this_week text,
  spice_tolerance_override text,
  tiffin_needed_override text,
  ekadashi_this_week boolean NOT NULL DEFAULT false,
  festival_fast_this_week boolean NOT NULL DEFAULT false,
  health_conditions_override jsonb,
  active_medications jsonb NOT NULL DEFAULT '[]'::jsonb,
  fasting_days_this_week jsonb NOT NULL DEFAULT '[]'::jsonb,
  nonveg_days_this_week jsonb NOT NULL DEFAULT '[]'::jsonb,
  nonveg_types_this_week jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mwc_weekly_context_id_idx ON member_weekly_contexts(weekly_context_id);
CREATE UNIQUE INDEX IF NOT EXISTS member_weekly_ctx_unique ON member_weekly_contexts(weekly_context_id, family_member_id);
