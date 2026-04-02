// =============================================================================
// NutriNext ParivarSehat — ICMR-NIN Calorie Calculator
// Implements the Mifflin-St Jeor BMR formula (best validated for South Asians),
// ICMR-NIN 2020 RDA tables for children, and auto-assignment rules.
// =============================================================================

import { ActivityLevel, PrimaryGoal, GoalPace, EffectiveMemberProfile } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY MULTIPLIERS (PAL — Physical Activity Level, per ICMR-NIN 2020)
// ─────────────────────────────────────────────────────────────────────────────
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
};

// ─────────────────────────────────────────────────────────────────────────────
// ICMR-NIN 2020 PAEDIATRIC REFERENCE CALORIE RANGES
// Source: ICMR-NIN Dietary Reference Values for Indians (2020), Table 3
// Using the midpoint of recommended kcal/day by age group.
// ─────────────────────────────────────────────────────────────────────────────
const ICMR_CHILD_CALORIES: { minAge: number; maxAge: number; kcal: number }[] = [
  { minAge: 0, maxAge: 1,  kcal: 650  },  // Infants — formula/breastfed, app should not calc
  { minAge: 1, maxAge: 3,  kcal: 1060 },
  { minAge: 4, maxAge: 6,  kcal: 1350 },
  { minAge: 7, maxAge: 9,  kcal: 1690 },
  { minAge: 10, maxAge: 12, kcal: 2190 }, // mixed with moderate activity
  { minAge: 13, maxAge: 15, kcal: 2450 },
  { minAge: 16, maxAge: 17, kcal: 2640 },
];

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-ASSIGNMENT RULES
// Applied silently by backend. Never ask user. Per product spec.
// ─────────────────────────────────────────────────────────────────────────────

export interface AutoAssignmentResult {
  effective_goal: PrimaryGoal;
  is_child_under5: boolean;
  is_school_age: boolean;
  is_teen: boolean;
  is_senior: boolean;
  goal_locked: boolean;  // true = frontend should not allow editing
}

export function applyAutoAssignmentRules(
  age: number,
  profileGoal: PrimaryGoal
): AutoAssignmentResult {
  const result: AutoAssignmentResult = {
    effective_goal: profileGoal,
    is_child_under5: false,
    is_school_age: false,
    is_teen: false,
    is_senior: false,
    goal_locked: false,
  };

  if (age < 5) {
    result.effective_goal = "early_childhood_nutrition";
    result.is_child_under5 = true;
    result.goal_locked = true;
    return result;
  }

  if (age >= 5 && age <= 12) {
    result.effective_goal = "healthy_growth";
    result.is_school_age = true;
    result.goal_locked = true;
    return result;
  }

  if (age >= 13 && age <= 17) {
    result.is_teen = true;
    // Teens cannot have weight_loss — use maintain as fallback
    if (profileGoal === "weight_loss") {
      result.effective_goal = "maintain";
    }
    return result;
  }

  if (age >= 60) {
    result.is_senior = true;
    // Only auto-set if user has no specific override
    if (
      profileGoal === "no_specific_goal" ||
      profileGoal === "healthy_growth" ||
      profileGoal === "early_childhood_nutrition"
    ) {
      result.effective_goal = "senior_nutrition";
    }
    return result;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// BMR CALCULATION — Mifflin-St Jeor (proven accurate for South Asians)
// ─────────────────────────────────────────────────────────────────────────────

function calculateBMR(
  weight_kg: number,
  height_cm: number,
  age: number,
  gender: "male" | "female" | "other"
): number {
  // Mifflin-St Jeor formula
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  if (gender === "male") return base + 5;
  if (gender === "female") return base - 161;
  // 'other' — use unisex average
  return base - 78;
}

// ─────────────────────────────────────────────────────────────────────────────
// TDEE (Total Daily Energy Expenditure)
// ─────────────────────────────────────────────────────────────────────────────

function calculateTDEE(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activity]);
}

// ─────────────────────────────────────────────────────────────────────────────
// GOAL-BASED CALORIE ADJUSTMENT
// ─────────────────────────────────────────────────────────────────────────────

function applyGoalAdjustment(
  tdee: number,
  goal: PrimaryGoal,
  pace: GoalPace
): number {
  switch (goal) {
    case "weight_loss": {
      const deficit = pace === "slow_0.25kg" ? 275 : 550;
      return Math.max(tdee - deficit, 1200); // Never drop below 1200 kcal
    }
    case "weight_gain": {
      const surplus = pace === "slow_0.25kg" ? 275 : 550;
      return tdee + surplus;
    }
    case "build_muscle":
      return tdee + 300;
    case "senior_nutrition":
      // ICMR-NIN recommends ~10% reduction for 60+ sedentary due to reduced muscle mass
      return Math.round(tdee * 0.9);
    case "maintain":
    case "manage_condition":
    case "no_specific_goal":
    default:
      return tdee;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAEDIATRIC CALORIE LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

function getChildCalories(age: number, activity: ActivityLevel): number {
  const bracket = ICMR_CHILD_CALORIES.find(
    (b) => age >= b.minAge && age <= b.maxAge
  );
  if (!bracket) return 1500; // safe fallback

  // Scale by activity for children (gentler scaling than adult PAL)
  const childActivityScale: Record<ActivityLevel, number> = {
    sedentary: 0.9,
    lightly_active: 1.0,
    moderately_active: 1.1,
    very_active: 1.2,
  };
  return Math.round(bracket.kcal * childActivityScale[activity]);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: calculateDailyCalorieTarget
// Returns null if weight OR height are missing for adults (cannot compute).
// ─────────────────────────────────────────────────────────────────────────────

export interface CalorieTargetResult {
  daily_calorie_target: number | null;
  calculation_method: "mifflin_st_jeor" | "icmr_paediatric" | "insufficient_data";
  bmr?: number;
  tdee?: number;
  goal_adjustment?: number;
}

export function calculateDailyCalorieTarget(params: {
  age: number;
  gender: "male" | "female" | "other";
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel;
  primary_goal: PrimaryGoal;
  goal_pace: GoalPace;
}): CalorieTargetResult {
  const { age, gender, height_cm, weight_kg, activity_level, primary_goal, goal_pace } = params;

  // Children: use ICMR paediatric tables — no body metrics needed
  if (age < 18) {
    const kcal = getChildCalories(age, activity_level);
    return {
      daily_calorie_target: kcal,
      calculation_method: "icmr_paediatric",
    };
  }

  // Adults: need both weight and height
  if (!weight_kg || !height_cm) {
    return {
      daily_calorie_target: null,
      calculation_method: "insufficient_data",
    };
  }

  const bmr = calculateBMR(weight_kg, height_cm, age, gender);
  const tdee = calculateTDEE(bmr, activity_level);
  const adjusted = applyGoalAdjustment(tdee, primary_goal, goal_pace);
  const goal_adjustment = adjusted - tdee;

  return {
    daily_calorie_target: adjusted,
    calculation_method: "mifflin_st_jeor",
    bmr: Math.round(bmr),
    tdee,
    goal_adjustment,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FASTING PRE-LOAD INSTRUCTION BUILDER
// If a member fasts on day N, meals on days N-2 and N-1 must be tagged to
// pre-load Iron, B12, and complex carbohydrates.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function buildFastingPreloadInstructions(
  effectiveProfiles: EffectiveMemberProfile[]
): string[] {
  const instructions: string[] = [];

  for (const member of effectiveProfiles) {
    const fastingDays = member.fasting_days;
    if (!fastingDays || fastingDays.length === 0) continue;

    for (const fastDay of fastingDays) {
      const fastIndex = DAY_ORDER.indexOf(fastDay.toLowerCase());
      if (fastIndex === -1) continue;

      const preloadDay1Index = (fastIndex - 2 + 7) % 7;
      const preloadDay2Index = (fastIndex - 1 + 7) % 7;

      const preloadDay1 = DAY_ORDER[preloadDay1Index];
      const preloadDay2 = DAY_ORDER[preloadDay2Index];

      const conditions = member.health_conditions;
      const nutrients: string[] = ["Iron", "B12", "complex carbohydrates"];

      if (conditions.includes("anaemia")) nutrients.unshift("Iron (critical — anaemia profile)");
      if (member.age >= 60) nutrients.push("Calcium");

      instructions.push(
        `For ${member.name}: Fast on ${fastDay}. On ${preloadDay1} and ${preloadDay2}, ` +
        `boost the following nutrients in meals: ${nutrients.join(", ")}. ` +
        `Suggested additions: rajma, green leafy sabzi, til chutney, fortified dal.`
      );
    }

    if (member.ekadashi_this_week) {
      instructions.push(
        `For ${member.name}: Ekadashi fast this week. Ensure sabudana, sendha namak, ` +
        `fruit, makhana, and kuttu atta are available for fasting meal replacement. ` +
        `Two days before Ekadashi, increase protein and iron loading.`
      );
    }

    if (member.festival_fast_this_week) {
      instructions.push(
        `For ${member.name}: Festival fast this week. Prepare culturally appropriate ` +
        `fasting foods (sabudana khichdi, singhare ki puri, vrat wale aloo). ` +
        `Ensure caloric adequacy through dry fruits from the 10% buffer budget.`
      );
    }
  }

  return instructions;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDICATION INTERACTION MATRIX
// Pairs known food-drug interactions for the prompt chain to respect.
// Level 3 in the priority hierarchy — absolute for that specific meal slot.
// ─────────────────────────────────────────────────────────────────────────────

interface MedicationInteraction {
  drug_keywords: string[];    // case-insensitive match against Medication.name
  avoid_foods: string[];      // ingredient categories/names to avoid
  avoid_window: string;       // which meal slot is affected
  reason: string;
}

export const MEDICATION_INTERACTION_MATRIX: MedicationInteraction[] = [
  {
    drug_keywords: ["metformin", "glucophage"],
    avoid_foods: [],
    avoid_window: "with_breakfast",
    reason: "Metformin must be taken WITH food to reduce GI side effects. Ensure a substantial breakfast.",
  },
  {
    drug_keywords: ["iron", "ferrous", "ferric"],
    avoid_foods: ["milk", "dairy", "calcium", "tea", "coffee", "antacid"],
    avoid_window: "morning_empty_stomach",
    reason: "Iron absorption is blocked by calcium and tannins. Avoid dairy and tea within 2 hours of iron supplement.",
  },
  {
    drug_keywords: ["warfarin", "coumadin"],
    avoid_foods: ["spinach", "kale", "broccoli", "methi", "palak", "green leafy"],
    avoid_window: "all",
    reason: "Vitamin K-rich foods (green leafy vegetables) interfere with warfarin. Keep intake consistent, not absent.",
  },
  {
    drug_keywords: ["thyroid", "levothyroxine", "thyroxine", "eltroxin"],
    avoid_foods: ["soy", "calcium", "dairy", "coffee", "cabbage", "goitrogenic"],
    avoid_window: "morning_empty_stomach",
    reason: "Thyroid hormone absorption is severely blocked by soy, calcium, and fiber. Must be taken on empty stomach 30–60 mins before breakfast.",
  },
  {
    drug_keywords: ["statin", "atorvastatin", "rosuvastatin", "lipitor"],
    avoid_foods: ["grapefruit"],
    avoid_window: "all",
    reason: "Grapefruit inhibits statin metabolism. Avoid entirely while on statins.",
  },
  {
    drug_keywords: ["amlodipine", "felodipine", "calcium channel"],
    avoid_foods: ["grapefruit"],
    avoid_window: "all",
    reason: "Grapefruit juice increases plasma levels of calcium channel blockers unpredictably.",
  },
  {
    drug_keywords: ["antacid", "pantoprazole", "omeprazole", "rabeprazole", "ranitidine"],
    avoid_foods: [],
    avoid_window: "before_meals",
    reason: "PPIs should be taken 30–60 mins before meals for maximum effectiveness.",
  },
  {
    drug_keywords: ["monoamine oxidase", "maoi", "phenelzine"],
    avoid_foods: ["aged cheese", "paneer", "fermented", "pickles", "soy sauce"],
    avoid_window: "all",
    reason: "Tyramine-rich foods with MAOIs can cause hypertensive crisis. Critical interaction.",
  },
];

/**
 * Given a member's active medication list, returns a flat string list
 * of interaction warnings ready to be injected into the Gemini prompt.
 */
export function resolveMedicationInteractions(
  memberName: string,
  medications: import("./types").Medication[]
): string[] {
  const warnings: string[] = [];

  for (const med of medications) {
    const medLower = med.name.toLowerCase();

    for (const interaction of MEDICATION_INTERACTION_MATRIX) {
      const matched = interaction.drug_keywords.some((kw) =>
        medLower.includes(kw)
      );
      if (!matched) continue;

      if (interaction.avoid_foods.length > 0) {
        warnings.push(
          `[MEDICATION GUARDRAIL] ${memberName} takes ${med.name}. ` +
          `Do NOT include these ingredients in the same meal slot (${interaction.avoid_window}): ` +
          `${interaction.avoid_foods.join(", ")}. Reason: ${interaction.reason}`
        );
      } else {
        warnings.push(
          `[MEDICATION GUARDRAIL] ${memberName} takes ${med.name}. ` +
          `Scheduling note for ${interaction.avoid_window}: ${interaction.reason}`
        );
      }

      // Include user-supplied notes verbatim
      if (med.notes && med.notes.trim() !== "") {
        warnings.push(
          `[MEDICATION NOTE from user for ${memberName}/${med.name}]: ${med.notes}`
        );
      }
    }
  }

  return warnings;
}
