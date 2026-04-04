// =============================================================================
// NutriNext ParivarSehat — ICMR-NIN Calorie Calculator
// =============================================================================

import { ActivityLevel, PrimaryGoal, GoalPace, EffectiveMemberProfile, ActiveMedication } from "./types";
import { PREGNANCY_CALORIE_ADDITIONS, PREGNANCY_CONDITION_IDS, type PregnancyConditionId } from "./clinical/pregnancy";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
};

const ICMR_CHILD_CALORIES: { minAge: number; maxAge: number; kcal: number }[] = [
  { minAge: 0, maxAge: 1,  kcal: 650  },
  { minAge: 1, maxAge: 3,  kcal: 1060 },
  { minAge: 4, maxAge: 6,  kcal: 1350 },
  { minAge: 7, maxAge: 9,  kcal: 1690 },
  { minAge: 10, maxAge: 12, kcal: 2190 },
  { minAge: 13, maxAge: 15, kcal: 2450 },
  { minAge: 16, maxAge: 17, kcal: 2640 },
];

export interface AutoAssignmentResult {
  effective_goal: PrimaryGoal;
  is_child_under5: boolean;
  is_school_age: boolean;
  is_teen: boolean;
  is_senior: boolean;
  goal_locked: boolean;
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
    if (profileGoal === "weight_loss") {
      result.effective_goal = "maintain";
    }
    return result;
  }

  if (age >= 60) {
    result.is_senior = true;
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

function calculateBMR(
  weight_kg: number,
  height_cm: number,
  age: number,
  gender: "male" | "female" | "other"
): number {
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  if (gender === "male") return base + 5;
  if (gender === "female") return base - 161;
  return base - 78;
}

function calculateTDEE(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activity]);
}

function applyGoalAdjustment(
  tdee: number,
  goal: PrimaryGoal,
  pace: GoalPace
): number {
  switch (goal) {
    case "weight_loss": {
      const deficit = pace === "slow_0.25kg" ? 275 : 550;
      return Math.max(tdee - deficit, 1200);
    }
    case "weight_gain": {
      const surplus = pace === "slow_0.25kg" ? 275 : 550;
      return tdee + surplus;
    }
    case "build_muscle":
      return tdee + 300;
    case "senior_nutrition":
      return Math.round(tdee * 0.9);
    case "maintain":
    case "manage_condition":
    case "no_specific_goal":
    default:
      return tdee;
  }
}

function getChildCalories(age: number, activity: ActivityLevel): number {
  const bracket = ICMR_CHILD_CALORIES.find(
    (b) => age >= b.minAge && age <= b.maxAge
  );
  if (!bracket) return 1500;

  const childActivityScale: Record<ActivityLevel, number> = {
    sedentary: 0.9,
    lightly_active: 1.0,
    moderately_active: 1.1,
    very_active: 1.2,
  };
  return Math.round(bracket.kcal * childActivityScale[activity]);
}

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
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel;
  primaryGoal: PrimaryGoal;
  goalPace: GoalPace;
  health_conditions?: string[];
}): CalorieTargetResult {
  const { age, gender, heightCm, weightKg, activityLevel, primaryGoal, goalPace } = params;

  if (age < 18) {
    const kcal = getChildCalories(age, activityLevel);
    return {
      daily_calorie_target: kcal,
      calculation_method: "icmr_paediatric",
    };
  }

  if (!weightKg || !heightCm) {
    return {
      daily_calorie_target: null,
      calculation_method: "insufficient_data",
    };
  }

  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  const tdee = calculateTDEE(bmr, activityLevel);
  let adjusted = applyGoalAdjustment(tdee, primaryGoal, goalPace);

  const pregnancyCondition = params.health_conditions?.find(
    (c): c is PregnancyConditionId => PREGNANCY_CONDITION_IDS.includes(c as PregnancyConditionId)
  );
  if (pregnancyCondition) {
    const pregnancyAddition = PREGNANCY_CALORIE_ADDITIONS[pregnancyCondition];
    adjusted = adjusted + pregnancyAddition;
  }

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
// ─────────────────────────────────────────────────────────────────────────────

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function buildFastingPreloadInstructions(
  effectiveProfiles: EffectiveMemberProfile[]
): string[] {
  const instructions: string[] = [];

  for (const member of effectiveProfiles) {
    const fastingDays = member.effectiveFastingDays;
    if (!fastingDays || fastingDays.length === 0) continue;

    for (const fastDay of fastingDays) {
      const fastIndex = DAY_ORDER.indexOf(fastDay.toLowerCase());
      if (fastIndex === -1) continue;

      const preloadDay1Index = (fastIndex - 2 + 7) % 7;
      const preloadDay2Index = (fastIndex - 1 + 7) % 7;

      const preloadDay1 = DAY_ORDER[preloadDay1Index];
      const preloadDay2 = DAY_ORDER[preloadDay2Index];

      const conditions = member.effectiveHealthConditions;
      const nutrients: string[] = ["Iron", "B12", "complex carbohydrates"];

      if (conditions.includes("anaemia")) nutrients.unshift("Iron (critical — anaemia profile)");
      if (member.age >= 60) nutrients.push("Calcium");

      instructions.push(
        `For ${member.name}: Fast on ${fastDay}. On ${preloadDay1} and ${preloadDay2}, ` +
        `boost the following nutrients in meals: ${nutrients.join(", ")}. ` +
        `Suggested additions: rajma, green leafy sabzi, til chutney, fortified dal.`
      );
    }

    if (member.ekadashiThisWeek) {
      instructions.push(
        `For ${member.name}: Ekadashi fast this week. Ensure sabudana, sendha namak, ` +
        `fruit, makhana, and kuttu atta are available for fasting meal replacement. ` +
        `Two days before Ekadashi, increase protein and iron loading.`
      );
    }

    if (member.festivalFastThisWeek) {
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
// MEDICATION INTERACTION MATRIX (backward-compat, legacy)
// ─────────────────────────────────────────────────────────────────────────────

interface MedicationInteraction {
  drug_keywords: string[];
  avoid_foods: string[];
  avoid_window: string;
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

export function resolveMedicationInteractions(
  memberName: string,
  medications: ActiveMedication[]
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

      if (med.notes && med.notes.trim() !== "") {
        warnings.push(
          `[MEDICATION NOTE from user for ${memberName}/${med.name}]: ${med.notes}`
        );
      }
    }
  }

  return warnings;
}

// ─────────────────────────────────────────────────────────────────────────────
// MACRO GUIDANCE STUB
// Imported by conflict-engine but not used in the current pipeline.
// ─────────────────────────────────────────────────────────────────────────────

export function getMacroGuidanceString(
  _goal: PrimaryGoal,
  _conditions: string[]
): string {
  return "";
}
