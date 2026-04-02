// =============================================================================
// NutriNext ParivarSehat — Deterministic Budget Engine
// Runs the 40/50/10 split and all downstream meal-weight calculations
// in pure synchronous math BEFORE any AI call is made.
// =============================================================================

import { MonthlyBudget, BudgetBreakdown, EatingOutFrequency } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// REGIONAL PRICE BASELINE TABLE
// Based on state-level retail food price indices and average family spend data.
// 4-member household, 3 meals/day reference.
// Source: MOSPI Consumer Price Index (CPI) state-level food data, 2024.
// ─────────────────────────────────────────────────────────────────────────────

const REGIONAL_PRICE_BASELINES: Record<string, number> = {
  // Metro / High cost
  delhi: 14850,
  "new delhi": 14850,
  mumbai: 15200,
  maharashtra: 13500,
  bangalore: 14000,
  bengaluru: 14000,
  karnataka: 12800,
  chennai: 13200,
  "tamil nadu": 12500,
  hyderabad: 13000,
  telangana: 12800,
  kolkata: 12200,
  "west bengal": 11500,
  pune: 13800,
  ahmedabad: 12600,
  gujarat: 12000,
  kerala: 13500,

  // Tier 2 / Mid cost
  lucknow: 10500,
  "uttar pradesh": 10200,
  jaipur: 10800,
  rajasthan: 9800,
  bhopal: 10000,
  "madhya pradesh": 9600,
  chandigarh: 11500,
  punjab: 11000,
  haryana: 10800,
  indore: 10200,
  surat: 11500,
  nagpur: 11000,
  patna: 9400,
  bihar: 8900,
  raipur: 9200,
  chhattisgarh: 8800,
  bhubaneswar: 9800,
  odisha: 9200,
  guwahati: 9500,
  assam: 9000,

  // Tier 3 / Lower cost
  jharkhand: 8200,
  ranchi: 8500,
  bokaro: 7260,
  dhanbad: 7500,
  jamshedpur: 8000,
  uttarakhand: 9000,
  dehradun: 9200,
  himachal: 9500,
  "himachal pradesh": 9500,
  jammu: 9800,
  "jammu and kashmir": 10000,
  tripura: 8500,
  manipur: 8800,
  meghalaya: 9000,
  nagaland: 9200,
  mizoram: 9500,
  "arunachal pradesh": 9800,
  sikkim: 10000,
  goa: 13500,

  // Default fallback — used if state not found
  default: 10000,
};

// ─────────────────────────────────────────────────────────────────────────────
// EATING OUT ADJUSTMENTS
// If family eats out, perishable budget is proportionally reduced.
// ─────────────────────────────────────────────────────────────────────────────

const EATING_OUT_PERISHABLE_MULTIPLIER: Record<EatingOutFrequency, number> = {
  none: 1.0,
  "1_to_2_times": 0.88,  // ~2 meals eaten out per week ≈ 12% less home perishable cost
  frequently: 0.72,       // ~5 meals out ≈ 28% less home perishable cost
};

// ─────────────────────────────────────────────────────────────────────────────
// MEAL WEIGHT SPLITS
// Breakfast is smaller (28%), lunch and dinner are equal (36% each).
// This reflects real-world Indian household meal economics.
// ─────────────────────────────────────────────────────────────────────────────

const MEAL_WEIGHT_SPLITS = {
  breakfast: 0.28,
  lunch: 0.36,
  dinner: 0.36,
} as const;

// For 3_meals_snacks — snack carved out of breakfast allocation
const MEAL_WEIGHT_SPLITS_WITH_SNACK = {
  breakfast: 0.20,
  snack: 0.08,
  lunch: 0.36,
  dinner: 0.36,
} as const;

// For 2_meals (lunch + dinner only)
const MEAL_WEIGHT_SPLITS_2_MEALS = {
  lunch: 0.50,
  dinner: 0.50,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Days in a given month
// ─────────────────────────────────────────────────────────────────────────────

function getDaysInMonth(monthYear: string): number {
  const [year, month] = monthYear.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: calculateBudgetSplit
// Takes raw user input (monthly budget + context) and returns the fully
// deterministic budget object ready to be stored in monthly_budgets table.
// ─────────────────────────────────────────────────────────────────────────────

export interface BudgetSplitInput {
  total_monthly_budget: number;
  month_year: string;         // "YYYY-MM"
  state_region: string;       // for regional suggestion
  meals_per_day: "2_meals" | "3_meals" | "3_meals_snacks";
  eating_out_frequency: EatingOutFrequency;
  family_id: string;
}

export interface BudgetSplitResult {
  staples_budget: number;
  perishables_budget: number;
  buffer_budget: number;
  daily_perishable_limit: number;
  effective_daily_perishable_limit: number;   // after eating-out adjustment
  weekly_perishable_budget: number;
  regional_price_suggestion: number;
  budget_breakdown: BudgetBreakdown;
  days_in_month: number;
}

export function calculateBudgetSplit(input: BudgetSplitInput): BudgetSplitResult {
  const {
    total_monthly_budget,
    month_year,
    state_region,
    meals_per_day,
    eating_out_frequency,
  } = input;

  // Step 1: The 10 / 40 / 50 split (deterministic, runs in < 1ms)
  const buffer_budget = round2dp(total_monthly_budget * 0.10);   // Dry fruits + seasonal fruits
  const staples_budget = round2dp(total_monthly_budget * 0.40);  // Bulk monthly dry goods
  const perishables_budget = round2dp(total_monthly_budget * 0.50); // Daily fresh produce

  // Step 2: Daily perishable limit
  const days_in_month = getDaysInMonth(month_year);
  const daily_perishable_limit = round2dp(perishables_budget / days_in_month);

  // Step 3: Apply eating-out adjustment to effective limit
  const eating_out_multiplier = EATING_OUT_PERISHABLE_MULTIPLIER[eating_out_frequency];
  const effective_daily_perishable_limit = round2dp(
    daily_perishable_limit * eating_out_multiplier
  );

  // Step 4: Weekly perishable budget (7 days × effective daily)
  const weekly_perishable_budget = round2dp(effective_daily_perishable_limit * 7);

  // Step 5: Per-meal daily limits using weighted splits
  let splits: Record<string, number>;
  let weights: Record<string, number>;

  if (meals_per_day === "2_meals") {
    weights = { ...MEAL_WEIGHT_SPLITS_2_MEALS };
  } else if (meals_per_day === "3_meals_snacks") {
    weights = { ...MEAL_WEIGHT_SPLITS_WITH_SNACK };
  } else {
    weights = { ...MEAL_WEIGHT_SPLITS };
  }

  splits = Object.fromEntries(
    Object.entries(weights).map(([meal, weight]) => [
      meal,
      round2dp(effective_daily_perishable_limit * weight),
    ])
  );

  // Step 6: Regional suggestion
  const stateKey = state_region.toLowerCase().trim();
  const regional_price_suggestion =
    REGIONAL_PRICE_BASELINES[stateKey] ??
    // Try partial match (e.g. "Jharkhand" → "jharkhand")
    Object.entries(REGIONAL_PRICE_BASELINES).find(([key]) =>
      stateKey.includes(key) || key.includes(stateKey)
    )?.[1] ??
    REGIONAL_PRICE_BASELINES.default;

  // Step 7: Assemble BudgetBreakdown JSONB
  const budget_breakdown: BudgetBreakdown = {
    breakfast_weight: weights["breakfast"] ?? 0,
    lunch_weight: weights["lunch"] ?? 0,
    dinner_weight: weights["dinner"] ?? 0,
    daily_limits: {
      breakfast: splits["breakfast"] ?? 0,
      lunch: splits["lunch"] ?? 0,
      dinner: splits["dinner"] ?? 0,
    },
  };

  return {
    staples_budget,
    perishables_budget,
    buffer_budget,
    daily_perishable_limit,
    effective_daily_perishable_limit,
    weekly_perishable_budget,
    regional_price_suggestion,
    budget_breakdown,
    days_in_month,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLLED-OVER BUDGET CALCULATION
// When a meal is skipped/eaten out, unused ingredient budget rolls forward.
// This function calculates the adjusted daily limit for remaining days.
// ─────────────────────────────────────────────────────────────────────────────

export interface RollingBudgetState {
  original_weekly_budget: number;
  days_elapsed: number;          // 0–6 (days into the week that have completed)
  actual_spent: number;          // sum of estimated_cost of completed meal slots
}

export function calculateRollingDailyLimit(state: RollingBudgetState): {
  remaining_budget: number;
  remaining_days: number;
  adjusted_daily_limit: number;
} {
  const remaining_budget = round2dp(
    state.original_weekly_budget - state.actual_spent
  );
  const remaining_days = Math.max(7 - state.days_elapsed, 1);
  const adjusted_daily_limit = round2dp(remaining_budget / remaining_days);

  return { remaining_budget, remaining_days, adjusted_daily_limit };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATE BUDGET AGAINST REGIONAL SUGGESTION
// Returns warnings if user budget is significantly below regional minimum.
// ─────────────────────────────────────────────────────────────────────────────

export interface BudgetValidationResult {
  is_adequate: boolean;
  warnings: string[];
  adjusted_budget: number | null; // null = use as-is; set to suggestion if too low
}

export function validateBudgetAdequacy(
  total_monthly_budget: number,
  state_region: string,
  family_size: number
): BudgetValidationResult {
  const stateKey = state_region.toLowerCase().trim();
  const baseline4Person =
    REGIONAL_PRICE_BASELINES[stateKey] ??
    Object.entries(REGIONAL_PRICE_BASELINES).find(([key]) =>
      stateKey.includes(key) || key.includes(stateKey)
    )?.[1] ??
    REGIONAL_PRICE_BASELINES.default;

  // Scale baseline by family size (baseline is for 4 members)
  const scaledBaseline = round2dp((baseline4Person / 4) * family_size);
  const minimum_viable = round2dp(scaledBaseline * 0.65); // 65% of avg is bare minimum

  const warnings: string[] = [];

  if (total_monthly_budget < minimum_viable) {
    warnings.push(
      `Budget of ₹${total_monthly_budget} is critically low for a family of ${family_size} ` +
      `in ${state_region}. Minimum viable estimate: ₹${minimum_viable}. ` +
      `Meals will be nutritionally compromised.`
    );
    return {
      is_adequate: false,
      warnings,
      adjusted_budget: minimum_viable,
    };
  }

  if (total_monthly_budget < scaledBaseline * 0.80) {
    warnings.push(
      `Budget of ₹${total_monthly_budget} is below the regional average of ` +
      `₹${scaledBaseline} for a family of ${family_size} in ${state_region}. ` +
      `Meals will be simple but nutritionally adequate.`
    );
  }

  return {
    is_adequate: true,
    warnings,
    adjusted_budget: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Round to 2 decimal places
// ─────────────────────────────────────────────────────────────────────────────
function round2dp(val: number): number {
  return Math.round(val * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT: Build a complete MonthlyBudget row ready for DB insertion
// ─────────────────────────────────────────────────────────────────────────────

export function buildMonthlyBudgetRow(
  input: BudgetSplitInput,
  family_size: number
): Omit<MonthlyBudget, "id" | "created_at"> {
  const split = calculateBudgetSplit(input);
  const validation = validateBudgetAdequacy(
    input.total_monthly_budget,
    input.state_region,
    family_size
  );

  // If budget is critically low, use the minimum viable adjusted value
  const effective_total = validation.adjusted_budget ?? input.total_monthly_budget;
  const finalSplit =
    effective_total !== input.total_monthly_budget
      ? calculateBudgetSplit({ ...input, total_monthly_budget: effective_total })
      : split;

  return {
    family_id: input.family_id,
    month_year: input.month_year,
    total_monthly_budget: effective_total,
    staples_budget: finalSplit.staples_budget,
    perishables_budget: finalSplit.perishables_budget,
    buffer_budget: finalSplit.buffer_budget,
    daily_perishable_limit: finalSplit.effective_daily_perishable_limit,
    regional_price_suggestion: finalSplit.regional_price_suggestion,
    budget_breakdown: finalSplit.budget_breakdown,
  };
}
