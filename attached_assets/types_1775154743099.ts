// =============================================================================
// NutriNext ParivarSehat — Shared TypeScript Types
// Single source of truth for all engine modules.
// DB row types use camelCase (Drizzle ORM convention).
// JSON/JSONB sub-shapes use snake_case where spec defines them that way.
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// ENUM / LITERAL TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type DietaryType =
  | "strictly_vegetarian"
  | "jain_vegetarian"
  | "eggetarian"
  | "non_vegetarian"
  | "occasional_non_veg";

export type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active";

export type PrimaryGoal =
  | "weight_loss"
  | "weight_gain"
  | "maintain"
  | "build_muscle"
  | "manage_condition"
  | "no_specific_goal"
  | "early_childhood_nutrition"
  | "healthy_growth"
  | "senior_nutrition";

export type GoalPace = "slow_0.25kg" | "moderate_0.5kg" | null;

export type HealthCondition =
  | "none"
  | "diabetes_type_2"
  | "hypertension"
  | "anaemia"
  | "obesity"
  | "high_cholesterol"
  | "hypothyroid"
  | "pcos"
  | "kidney_issues"
  | string; // user-typed conditions are also valid

export type AllergyType =
  | "none"
  | "peanuts"
  | "dairy"
  | "gluten"
  | "tree_nuts"
  | "shellfish"
  | "soy"
  | "sesame";

export type ReligiousCulturalRuleType =
  | "none"
  | "no_beef"
  | "no_pork"
  | "sattvic_no_onion_garlic"
  | "jain_rules";

export type SpiceTolerance = "mild" | "medium" | "spicy";
export type MealsPerDay = "2_meals" | "3_meals" | "3_meals_snacks";
export type CookingSkillLevel = "beginner" | "intermediate" | "experienced";
export type EatingOutFrequency = "none" | "1_to_2_times" | "frequently";
export type WeekdayCookingTime = "under_20_mins" | "20_40_mins" | "no_limit";
export type WeekendCookingTime = "quick" | "elaborate" | "no_preference";
export type GenerationStatus = "pending" | "processing" | "completed" | "failed";
export type GroceryListType = "monthly_staples" | "weekly_perishables" | "buffer_fruits_dryfruit";
export type ConflictPriorityLevel = 1 | 2 | 3 | 4 | 5 | 6;

// ─────────────────────────────────────────────────────────────────────────────
// JSONB SHAPES — Sub-documents stored in JSONB columns
// ─────────────────────────────────────────────────────────────────────────────

export interface ReligiousCulturalRules {
  type: ReligiousCulturalRuleType;
  details: string[];
}

export interface OccasionalNonvegConfig {
  days: string[]; // ["monday", "friday"]
  types: ("chicken" | "mutton" | "fish" | "eggs")[];
}

export interface FastingConfig {
  type: "no_fasting" | "weekly" | "ekadashi";
  weekly_days: string[];
  ekadashi: boolean;
  festival_alerts: boolean;
}

export interface ActiveMedication {
  name: string;   // "Metformin 500mg"
  timing: string; // "with_breakfast" | "before_breakfast" | "at_night" | "morning_empty_stomach"
  notes: string;  // user-supplied note e.g. "avoid calcium-rich foods within 2hrs"
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDICATION ABSORPTION WINDOW TYPES
// Used by src/lib/medicationRules.ts — the static pharmacology lookup table.
// These types define the shape of every medication rule and every guardrail
// string that gets injected into the Gemini prompt.
// ─────────────────────────────────────────────────────────────────────────────

/** Per-meal-slot constraint defined by a MedicationRule */
export interface MedicationSlotConstraint {
  /** Which meal slot this constraint applies to. "all" = every slot this week. */
  slot: "breakfast" | "lunch" | "dinner" | "snack" | "all";
  /** True = medication requires a substantial meal to accompany it (e.g. Metformin) */
  must_have_food: boolean;
  /** True = liquid-only meals (tea, juice) are insufficient — a solid meal is required */
  must_have_solid_food: boolean;
  /** Specific ingredient names to exclude from this member's plate in this slot */
  forbidden_ingredients: string[];
  /** Broad categories to exclude (used as hints to Gemini alongside specific items) */
  forbidden_categories: string[];
  /** Ingredients that SHOULD be present (e.g. Vitamin C with iron) */
  positive_requirements: string[];
  /** Human-readable timing instruction injected verbatim into the Gemini prompt */
  timing_instruction: string;
}

/** Week-level dietary consistency monitor (e.g. Warfarin + leafy greens) */
export interface MedicationWeeklyMonitor {
  /** Human-readable category name for UI display */
  ingredient_category: string;
  /** The specific ingredients covered by this monitor */
  ingredients: string[];
  /**
   * keep_consistent: Must appear same frequency as usual (Warfarin)
   * limit_frequency: Must appear ≤ max_meals_per_week times (ACE inhibitors + potassium)
   * avoid_entirely: Must appear zero times (grapefruit with statins/amlodipine)
   */
  rule: "keep_consistent" | "limit_frequency" | "avoid_entirely";
  /** Max occurrences per week — required for limit_frequency and keep_consistent */
  max_meals_per_week?: number;
  /**
   * Ready-to-inject Gemini directive. Use {memberName} as a placeholder.
   * buildGuardrailStrings() will substitute the actual member name before injection.
   */
  directive: string;
}

/** Parsed output from parseMedicationTiming() */
export interface ParsedMedicationTiming {
  /** The original raw string from the user e.g. "at night" */
  raw: string;
  /** The resolved meal slot from regex pattern matching */
  resolved_slot: "breakfast" | "lunch" | "dinner" | "snack" | "empty_stomach" | "morning" | "night";
  /** Temporal relation to the meal slot */
  relation: "with" | "before" | "after" | "at";
  /** True if drug must be taken before any food (e.g. Levothyroxine, PPIs) */
  is_empty_stomach: boolean;
  /** True if drug is taken at night / bedtime */
  is_night: boolean;
}

/**
 * The full static medication rule.
 * One entry exists per drug class in MEDICATION_RULES in medicationRules.ts.
 */
export interface MedicationRule {
  /** Canonical snake_case identifier for this drug class */
  drug_id: string;
  /** Human-readable name shown in UI conflict cards */
  display_name: string;
  /** Case-insensitive keyword list — medication name is checked against these */
  match_keywords: string[];
  /** Optional regex for matching brand names and abbreviations */
  match_regex?: RegExp;
  /** Array of per-slot dietary constraints */
  slot_constraints: MedicationSlotConstraint[];
  /**
   * Optional: if user takes this drug at a non-default slot,
   * these rules are applied to the user-specified slot dynamically.
   * E.g. Metformin at dinner instead of breakfast.
   */
  dynamic_slot_rule?: {
    forbidden_ingredients?: string[];
    must_have_solid_food: boolean;
    timing_instruction: string;
  };
  /** Optional week-level dietary consistency monitor */
  weekly_monitor: MedicationWeeklyMonitor | null;
  /** Optional: scheduling notes surfaced in the waiting screen and UI */
  scheduling_note?: string;
  /** Clinical pharmacology explanation (shown in conflict card) */
  clinical_reason: string;
  /** Points added to Harmony Score when this constraint is correctly handled */
  harmony_score_addition: number;
}

/**
 * The final output of buildGuardrailStrings().
 * Contains all ready-to-inject Gemini prompt strings for one medication.
 */
export interface MedicationGuardrailBundle {
  drug_id: string;
  member_name: string;
  /** Per-slot absolute directives — injected under MEDICATION GUARDRAILS in Call 2 */
  directives: string[];
  /** Week-level monitor directives — injected at the top of the Call 2 prompt */
  weekly_monitor_directives: string[];
  /** Scheduling notes — surfaced in the waiting screen generation log */
  scheduling_notes: string[];
  /** Points to add to Harmony Score (0 if drug not recognised) */
  harmony_score_addition: number;
}

export interface PantryItem {
  name: string;
  quantity: number;
  unit: string;
  is_perishable: boolean; // true → must be burned down this week
}

export interface BudgetBreakdown {
  breakfast_weight: number;
  lunch_weight: number;
  dinner_weight: number;
  snack_weight: number; // 0 if no snacks
  daily_limits: {
    breakfast: number; // INR
    lunch: number;
    dinner: number;
    snack: number; // 0 if no snacks
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DB ROW TYPES — Mirror Drizzle schema exactly (camelCase)
// ─────────────────────────────────────────────────────────────────────────────

export interface Family {
  id: string;
  userId: string;
  name: string;
  stateRegion: string;
  languagePreference: "hindi" | "english";
  householdDietaryBaseline: "strictly_veg" | "veg_with_eggs" | "non_veg" | "mixed";
  mealsPerDay: MealsPerDay;
  cookingSkillLevel: CookingSkillLevel;
  appliances: string[];
  pincode: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FamilyMember {
  id: string;
  familyId: string;
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel;
  primaryGoal: PrimaryGoal;
  goalPace: GoalPace;
  dailyCalorieTarget: number | null;
  dietaryType: DietaryType;
  spiceTolerance: SpiceTolerance;
  tiffinNeeded: "no" | "yes_school" | "yes_office";
  festivalFastingAlerts: boolean;
  displayOrder: number;
  healthConditions: HealthCondition[];
  allergies: AllergyType[];
  ingredientDislikes: string[];
  religiousCulturalRules: ReligiousCulturalRules;
  occasionalNonvegConfig: OccasionalNonvegConfig | null;
  fastingConfig: FastingConfig;
}

export interface MonthlyBudget {
  id: string;
  familyId: string;
  monthYear: string; // "YYYY-MM"
  totalMonthlyBudget: number;
  staplesBudget: number;   // 40%
  perishablesBudget: number; // 50%
  bufferBudget: number;    // 10%
  dailyPerishableLimit: number;
  regionalPriceSuggestion: number | null;
  budgetBreakdown: BudgetBreakdown;
  createdAt?: string;
}

export interface WeeklyContext {
  id: string;
  familyId: string;
  weekStartDate: string; // "YYYY-MM-DD" — always Monday
  eatingOutFrequency: EatingOutFrequency;
  weekdayCookingTime: WeekdayCookingTime;
  weekendCookingTime: WeekendCookingTime;
  weeklyPerishableBudgetOverride: number | null;
  specialRequest: string | null;
  status: "draft" | "submitted" | "meal_plan_generated";
  pantrySnapshot: PantryItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MemberWeeklyContext {
  id: string;
  weeklyContextId: string;
  familyMemberId: string;
  currentGoalOverride: PrimaryGoal | null;
  currentWeightKg: number | null;
  feelingThisWeek: string | null;
  spiceToleranceOverride: SpiceTolerance | null;
  tiffinNeededOverride: string | null;
  healthConditionsOverride: HealthCondition[] | null;
  activeMedications: ActiveMedication[];
  fastingDaysThisWeek: string[];
  ekadashiThisWeek: boolean;
  festivalFastThisWeek: boolean;
  nonvegDaysThisWeek: string[];
  nonvegTypesThisWeek: string[];
  createdAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEAL PLAN JSONB SHAPES
// ─────────────────────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  name: string;
  quantity: string;
}

export interface BaseRecipe {
  ingredients: RecipeIngredient[];
  steps: string[];
  prep_time_mins: number;
  cook_time_mins: number;
  image_search_query: string; // English dish name for Google image search
}

export interface MemberPlate {
  member_id: string;
  member_name: string;
  modifications: string[];      // e.g. ["Use jowar roti", "Half salt"]
  fasting_replacement?: string; // e.g. "Sabudana khichdi"
  tiffin_instructions?: string; // packing instructions if tiffin_needed
}

export interface MealSlot {
  name: string;
  is_base_dish: boolean;
  base_recipe: BaseRecipe;
  member_plates: MemberPlate[];
  pantry_items_used: string[];
  estimated_cost: number;       // INR — base dish ingredients only
  priority_flags: string[];     // e.g. ["allergy_compliant", "low_sodium", "zero_waste_item_used"]
  skipped?: boolean;
  skip_reason?: string;
  nutritional_bandaid?: string;
}

export interface DayPlan {
  date: string;      // "YYYY-MM-DD"
  day_name: string;  // "Monday"
  meals: {
    breakfast?: MealSlot;
    lunch?: MealSlot;
    dinner?: MealSlot;
    snack?: MealSlot;
  };
  carry_forward_ingredients?: string[]; // from skipped meal of previous day
}

export interface GroceryItem {
  name: string;
  quantity: number;
  unit: string;
  estimated_price: number;
  category: string;
  purchased: boolean;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HARMONY SCORE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface HarmonyScoreDeduction {
  reason: string;
  points: number; // NEGATIVE e.g. -5
}

export interface HarmonyScoreAddition {
  reason: string;
  points: number; // POSITIVE e.g. +3
}

export interface DetectedConflict {
  member_ids: string[];
  member_names: string[];
  description: string;
  priority_level: ConflictPriorityLevel;
}

export interface ResolvedConflict {
  description: string;
  resolution: string;
  resolution_type: "base_dish_change" | "plate_modification" | "meal_replacement";
}

export interface HarmonyScoreBreakdown {
  base: 100;
  deductions: HarmonyScoreDeduction[];
  additions: HarmonyScoreAddition[];
  conflicts_detected: DetectedConflict[];
  conflicts_resolved: ResolvedConflict[];
  final_score: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATION LOG
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerationLogEntry {
  message: string;
  duration_ms: number;
  completed: boolean;
  step_index: number; // for frontend progress bar
}

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITIONAL SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberNutritionalSummary {
  member_name: string;
  daily_avg_calories: number;
  daily_target_calories: number;
  weekly_protein_g: number;
  nutritional_debt: string[]; // e.g. ["Low Iron on Tuesday fasting day"]
  fasting_days_handled: string[];
}

export type NutritionalSummary = Record<string, MemberNutritionalSummary>;

// ─────────────────────────────────────────────────────────────────────────────
// CONFLICT ENGINE INTERNAL TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The merged effective profile for ONE member for THIS week.
 * Combines base FamilyMember profile + MemberWeeklyContext overrides.
 */
export interface EffectiveMemberProfile {
  // Identity
  id: string;
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  heightCm: number | null;
  effectiveWeightKg: number;      // weekly update takes precedence over profile
  activityLevel: ActivityLevel;
  displayOrder: number;

  // Diet
  dietaryType: DietaryType;
  religiousCulturalRules: ReligiousCulturalRules;
  allergies: AllergyType[];
  ingredientDislikes: string[];
  occasionalNonvegConfig: OccasionalNonvegConfig | null;

  // Resolved (weekly override > auto-assign > profile)
  effectiveGoal: PrimaryGoal;
  goalPace: GoalPace;
  effectiveHealthConditions: HealthCondition[];
  effectiveSpiceTolerance: SpiceTolerance;

  // Fasting
  effectiveFastingDays: string[];   // UNION of profile + weekly
  ekadashiThisWeek: boolean;
  festivalFastThisWeek: boolean;

  // Weekly-only
  activeMedications: ActiveMedication[];
  feelingThisWeek: string | null;
  nonvegDaysThisWeek: string[];
  nonvegTypesThisWeek: string[];
  tiffinNeeded: "no" | "yes_school" | "yes_office";

  // Computed
  dailyCalorieTarget: number;       // always a number — ICMR table fallback if no metrics

  // Auto-assignment flags (never from DB)
  isChildUnder5: boolean;
  isSchoolAge: boolean;   // 5–12
  isTeen: boolean;        // 13–17
  isSenior: boolean;      // 60+
}

/**
 * The full constraint packet assembled by the conflict engine.
 * This is the single object passed to the prompt chain.
 */
export interface ConstraintPacket {
  family: Family;
  effectiveProfiles: EffectiveMemberProfile[];
  budget: MonthlyBudget;
  weeklyContext: WeeklyContext;
  harmonyScore: HarmonyScoreBreakdown;
  conflicts: DetectedConflict[];
  resolutions: ResolvedConflict[];
  pantryZeroWasteItems: PantryItem[];
  fastingPreloadInstructions: string[];

  // ── MEDICATION FIELDS (updated by new medicationRules.ts system) ───────────
  /**
   * @deprecated Use medicationGuardrailBundles instead.
   * Kept for backward-compat — still populated by flatMap of bundle.directives.
   */
  medicationWarnings: string[];

  /**
   * NEW: Structured guardrail bundles from resolveAllMedicationGuardrails().
   * Each bundle contains per-slot directives, weekly monitor directives,
   * and scheduling notes, all ready to be injected into Call 2 prompt.
   */
  medicationGuardrailBundles: MedicationGuardrailBundle[];

  /**
   * NEW: Week-level monitor directives extracted from all bundles.
   * Injected at the TOP of the Call 2 prompt before individual slot directives.
   * These govern weekly consistency (Warfarin) and frequency limits (ACE inhibitors).
   */
  medicationWeeklyMonitorDirectives: string[];

  /**
   * NEW: Scheduling notes shown in the waiting screen generation log.
   * e.g. "Levothyroxine: breakfast delayed 30–60 min after medication."
   */
  medicationSchedulingNotes: string[];

  /**
   * NEW: Total Harmony Score additions from correctly handled medication windows.
   * Summed from all MedicationGuardrailBundle.harmony_score_addition values.
   */
  medicationHarmonyAddition: number;
  // ───────────────────────────────────────────────────────────────────────────

  effectiveDailyBudget: number;          // weekly override / 7, or budget.dailyPerishableLimit
  nonvegDaysByMember: Record<string, string[]>; // memberId → allowed day names
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT CHAIN RESULT
// ─────────────────────────────────────────────────────────────────────────────

export interface PromptChainResult {
  staples: GroceryItem[];
  staples_total_cost: number;
  weeklyMealPlan: DayPlan[];
  weeklyPerishables: GroceryItem[];
  weeklyPerishables_total_cost: number;
  bufferItems: GroceryItem[];
  buffer_total_cost: number;
  nutritional_summary: NutritionalSummary;
}

export interface PromptChainTimings {
  staples_ms: number;
  meals_ms: number;
  buffer_ms: number;
  total_ms: number;
}
