// =============================================================================
// NutriNext ParivarSehat — Deterministic Budget Engine
// =============================================================================

import { MonthlyBudget, BudgetBreakdown, EatingOutFrequency, WeekdayCookingTime, WeekendCookingTime } from "./types";

const REGIONAL_PRICE_BASELINES: Record<string, number> = {
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
  default: 10000,
};

const EATING_OUT_PERISHABLE_MULTIPLIER: Record<EatingOutFrequency, number> = {
  none: 1.0,
  "1_to_2_times": 0.88,
  frequently: 0.72,
};

const MEAL_WEIGHT_SPLITS = {
  breakfast: 0.28,
  lunch: 0.36,
  dinner: 0.36,
} as const;

const MEAL_WEIGHT_SPLITS_WITH_SNACK = {
  breakfast: 0.20,
  snack: 0.08,
  lunch: 0.36,
  dinner: 0.36,
} as const;

const MEAL_WEIGHT_SPLITS_2_MEALS = {
  lunch: 0.50,
  dinner: 0.50,
} as const;

function getDaysInMonth(monthYear: string): number {
  const [year, month] = monthYear.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

export interface BudgetSplitInput {
  total_monthly_budget: number;
  month_year: string;
  state_region: string;
  meals_per_day: "2_meals" | "3_meals" | "3_meals_snacks";
  eating_out_frequency: EatingOutFrequency;
  family_id: string;
}

export interface BudgetSplitResult {
  staples_budget: number;
  perishables_budget: number;
  buffer_budget: number;
  daily_perishable_limit: number;
  effective_daily_perishable_limit: number;
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

  const buffer_budget = round2dp(total_monthly_budget * 0.10);
  const staples_budget = round2dp(total_monthly_budget * 0.40);
  const perishables_budget = round2dp(total_monthly_budget * 0.50);

  const days_in_month = getDaysInMonth(month_year);
  const daily_perishable_limit = round2dp(perishables_budget / days_in_month);

  const eating_out_multiplier = EATING_OUT_PERISHABLE_MULTIPLIER[eating_out_frequency];
  const effective_daily_perishable_limit = round2dp(
    daily_perishable_limit * eating_out_multiplier
  );

  const weekly_perishable_budget = round2dp(effective_daily_perishable_limit * 7);

  let weights: Record<string, number>;

  if (meals_per_day === "2_meals") {
    weights = { ...MEAL_WEIGHT_SPLITS_2_MEALS };
  } else if (meals_per_day === "3_meals_snacks") {
    weights = { ...MEAL_WEIGHT_SPLITS_WITH_SNACK };
  } else {
    weights = { ...MEAL_WEIGHT_SPLITS };
  }

  const splits = Object.fromEntries(
    Object.entries(weights).map(([meal, weight]) => [
      meal,
      round2dp(effective_daily_perishable_limit * weight),
    ])
  );

  const stateKey = state_region.toLowerCase().trim();
  const regional_price_suggestion =
    REGIONAL_PRICE_BASELINES[stateKey] ??
    Object.entries(REGIONAL_PRICE_BASELINES).find(([key]) =>
      stateKey.includes(key) || key.includes(stateKey)
    )?.[1] ??
    REGIONAL_PRICE_BASELINES.default;

  const budget_breakdown: BudgetBreakdown = {
    breakfast_weight: weights["breakfast"] ?? 0,
    lunch_weight: weights["lunch"] ?? 0,
    dinner_weight: weights["dinner"] ?? 0,
    snack_weight: weights["snack"] ?? 0,
    daily_limits: {
      breakfast: splits["breakfast"] ?? 0,
      lunch: splits["lunch"] ?? 0,
      dinner: splits["dinner"] ?? 0,
      snack: splits["snack"] ?? 0,
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

export interface RollingBudgetState {
  original_weekly_budget: number;
  days_elapsed: number;
  actual_spent: number;
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

export interface BudgetValidationResult {
  is_adequate: boolean;
  warnings: string[];
  adjusted_budget: number | null;
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

  const scaledBaseline = round2dp((baseline4Person / 4) * family_size);
  const minimum_viable = round2dp(scaledBaseline * 0.65);

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

function round2dp(val: number): number {
  return Math.round(val * 100) / 100;
}

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

  const effective_total = validation.adjusted_budget ?? input.total_monthly_budget;
  const finalSplit =
    effective_total !== input.total_monthly_budget
      ? calculateBudgetSplit({ ...input, total_monthly_budget: effective_total })
      : split;

  return {
    familyId: input.family_id,
    monthYear: input.month_year,
    totalMonthlyBudget: effective_total,
    staplesBudget: finalSplit.staples_budget,
    perishablesBudget: finalSplit.perishables_budget,
    bufferBudget: finalSplit.buffer_budget,
    dailyPerishableLimit: finalSplit.effective_daily_perishable_limit,
    regionalPriceSuggestion: finalSplit.regional_price_suggestion,
    budgetBreakdown: finalSplit.budget_breakdown,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COOKING TIME → CONSTRAINT STRING
// Returns an object with { weekday, weekend } constraint strings for prompt injection.
// ─────────────────────────────────────────────────────────────────────────────

const WEEKDAY_CONSTRAINTS: Record<WeekdayCookingTime, string> = {
  under_20_mins:
    "WEEKDAY COOKING TIME CONSTRAINT: Maximum 20 minutes total (prep + cook). " +
    "Use pressure cooker, one-pot meals, pre-soaked dals, instant dosa batter, poha, upma. " +
    "No elaborate preparations on weekdays.",
  "20_40_mins":
    "WEEKDAY COOKING TIME: 20–40 minutes total. Standard Indian home cooking — " +
    "roti + sabzi + dal is fine. Avoid slow-cooked dishes or elaborate garnishes.",
  no_limit:
    "WEEKDAY COOKING TIME: No limit — family can spend as long as needed. " +
    "Elaborate dishes like biryani, stuffed paratha, complex curries are fine on weekdays.",
};

const WEEKEND_CONSTRAINTS: Record<WeekendCookingTime, string> = {
  quick:
    "WEEKEND COOKING TIME: Keep it quick — similar to weekday constraints. " +
    "Family prefers simple meals on weekends too.",
  elaborate:
    "WEEKEND COOKING TIME: Elaborate cooking allowed on Saturday and Sunday. " +
    "Include one special/festive dish (e.g. biryani, chole bhature, paneer tikka, dosa spread). " +
    "Family enjoys weekend cooking.",
  no_preference:
    "WEEKEND COOKING TIME: No specific preference — use standard cooking times.",
};

export function cookingTimeToConstraintString(
  weekday: WeekdayCookingTime,
  weekend: WeekendCookingTime
): { weekday: string; weekend: string } {
  return {
    weekday: WEEKDAY_CONSTRAINTS[weekday] ?? WEEKDAY_CONSTRAINTS["20_40_mins"],
    weekend: WEEKEND_CONSTRAINTS[weekend] ?? WEEKEND_CONSTRAINTS["no_preference"],
  };
}
