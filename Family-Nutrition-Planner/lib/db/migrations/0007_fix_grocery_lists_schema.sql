ALTER TABLE grocery_lists DROP COLUMN IF EXISTS week_of;
ALTER TABLE grocery_lists DROP COLUMN IF EXISTS budget_status;
ALTER TABLE grocery_lists DROP COLUMN IF EXISTS accepted_swaps;

ALTER TABLE grocery_lists ADD COLUMN IF NOT EXISTS list_type text NOT NULL DEFAULT 'weekly_perishables';
ALTER TABLE grocery_lists ADD COLUMN IF NOT EXISTS month_year text;
ALTER TABLE grocery_lists ADD COLUMN IF NOT EXISTS week_start_date date;
ALTER TABLE grocery_lists ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE grocery_lists ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE grocery_lists ALTER COLUMN total_estimated_cost TYPE numeric(10,2) USING total_estimated_cost::numeric(10,2);
ALTER TABLE grocery_lists ALTER COLUMN items SET DEFAULT '[]'::jsonb;
ALTER TABLE grocery_lists ALTER COLUMN items SET NOT NULL;
ALTER TABLE grocery_lists ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

CREATE INDEX IF NOT EXISTS grocery_lists_meal_plan_id_idx ON grocery_lists(meal_plan_id);
