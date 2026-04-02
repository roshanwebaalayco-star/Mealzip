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
  | string;

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
  days: string[];
  types: ("chicken" | "mutton" | "fish" | "eggs")[];
}

export interface FastingConfig {
  type: "no_fasting" | "weekly" | "ekadashi";
  weekly_days: string[];
  ekadashi: boolean;
  festival_alerts: boolean;
}

export interface ActiveMedication {
  name: string;
  timing: string;
  notes: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDICATION ABSORPTION WINDOW TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MedicationSlotConstraint {
  slot: "breakfast" | "lunch" | "dinner" | "snack" | "all";
  must_have_food: boolean;
  must_have_solid_food: boolean;
  forbidden_ingredients: string[];
  forbidden_categories: string[];
  positive_requirements: string[];
  timing_instruction: string;
}

export interface MedicationWeeklyMonitor {
  ingredient_category: string;
  ingredients: string[];
  rule: "keep_consistent" | "limit_frequency" | "avoid_entirely";
  max_meals_per_week?: number;
  directive: string;
}

export interface ParsedMedicationTiming {
  raw: string;
  resolved_slot: "breakfast" | "lunch" | "dinner" | "snack" | "empty_stomach" | "morning" | "night";
  relation: "with" | "before" | "after" | "at";
  is_empty_stomach: boolean;
  is_night: boolean;
}

export interface MedicationRule {
  drug_id: string;
  display_name: string;
  match_keywords: string[];
  match_regex?: RegExp;
  slot_constraints: MedicationSlotConstraint[];
  dynamic_slot_rule?: {
    forbidden_ingredients?: string[];
    must_have_solid_food: boolean;
    timing_instruction: string;
  };
  weekly_monitor: MedicationWeeklyMonitor | null;
  scheduling_note?: string;
  clinical_reason: string;
  harmony_score_addition: number;
}

export interface MedicationGuardrailBundle {
  drug_id: string;
  member_name: string;
  directives: string[];
  weekly_monitor_directives: string[];
  scheduling_notes: string[];
  harmony_score_addition: number;
}

export interface PantryItem {
  name: string;
  quantity: number;
  unit: string;
  is_perishable: boolean;
}

export interface BudgetBreakdown {
  breakfast_weight: number;
  lunch_weight: number;
  dinner_weight: number;
  snack_weight: number;
  daily_limits: {
    breakfast: number;
    lunch: number;
    dinner: number;
    snack: number;
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
  monthYear: string;
  totalMonthlyBudget: number;
  staplesBudget: number;
  perishablesBudget: number;
  bufferBudget: number;
  dailyPerishableLimit: number;
  regionalPriceSuggestion: number | null;
  budgetBreakdown: BudgetBreakdown;
  createdAt?: string;
}

export interface WeeklyContext {
  id: string;
  familyId: string;
  weekStartDate: string;
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
  image_search_query: string;
}

export interface MemberPlate {
  member_id: string;
  member_name: string;
  modifications: string[];
  fasting_replacement?: string;
  tiffin_instructions?: string;
}

export interface MealSlot {
  name: string;
  is_base_dish: boolean;
  base_recipe: BaseRecipe;
  member_plates: MemberPlate[];
  pantry_items_used: string[];
  estimated_cost: number;
  priority_flags: string[];
  skipped?: boolean;
  skip_reason?: string;
  nutritional_bandaid?: string;
}

export interface DayPlan {
  date: string;
  day_name: string;
  meals: {
    breakfast?: MealSlot;
    lunch?: MealSlot;
    dinner?: MealSlot;
    snack?: MealSlot;
  };
  carry_forward_ingredients?: string[];
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
  points: number;
}

export interface HarmonyScoreAddition {
  reason: string;
  points: number;
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
  step_index: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITIONAL SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

export type NutritionalSummary = Record<
  string,
  {
    member_name: string;
    daily_avg_calories: number;
    daily_target_calories: number;
    weekly_protein_g: number;
    nutritional_debt: string[];
    fasting_days_handled: string[];
  }
>;

// ─────────────────────────────────────────────────────────────────────────────
// CONFLICT ENGINE INTERNAL TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface EffectiveMemberProfile {
  id: string;
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  heightCm: number | null;
  effectiveWeightKg: number;
  activityLevel: ActivityLevel;
  displayOrder: number;
  dietaryType: DietaryType;
  religiousCulturalRules: ReligiousCulturalRules;
  allergies: AllergyType[];
  ingredientDislikes: string[];
  occasionalNonvegConfig: OccasionalNonvegConfig | null;
  effectiveGoal: PrimaryGoal;
  goalPace: GoalPace;
  effectiveHealthConditions: HealthCondition[];
  effectiveSpiceTolerance: SpiceTolerance;
  effectiveFastingDays: string[];
  ekadashiThisWeek: boolean;
  festivalFastThisWeek: boolean;
  activeMedications: ActiveMedication[];
  feelingThisWeek: string | null;
  nonvegDaysThisWeek: string[];
  nonvegTypesThisWeek: string[];
  tiffinNeeded: "no" | "yes_school" | "yes_office";
  dailyCalorieTarget: number;
  isChildUnder5: boolean;
  isSchoolAge: boolean;
  isTeen: boolean;
  isSenior: boolean;
}

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
  medicationWarnings: string[];
  medicationGuardrailBundles: MedicationGuardrailBundle[];
  medicationWeeklyMonitorDirectives: string[];
  medicationSchedulingNotes: string[];
  medicationHarmonyAddition: number;
  effectiveDailyBudget: number;
  nonvegDaysByMember: Record<string, string[]>;
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
