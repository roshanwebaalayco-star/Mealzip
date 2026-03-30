export interface IMemberProfile {
  age?: number;
  gender?: string;
  weightKg?: number;
  heightCm?: number;
  activityLevel?: string;
  primary_goal?: string;
  goalPace?: string;
  healthConditions?: string[];
  ingredientDislikes?: string[];
  nonVegDays?: string[];
  tiffinType?: string;
  religiousRules?: string;
}

/** @deprecated use IMemberProfile */
export type MemberProfileInput = IMemberProfile;

export interface MemberProfileOutput {
  primary_goal?: string;
  goalPace: string;
  icmrCaloricTarget?: number;
  /** @deprecated use icmrCaloricTarget — kept for back-compat during transition */
  calorieTarget?: number;
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  lightly_active: 1.375,
  moderate: 1.55,
  moderately_active: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Normalize UI-facing goal aliases to canonical DB / RAI values.
// This is the single source of truth for goal taxonomy. Any new UI value
// must be mapped here to prevent CHECK constraint failures on DB write.
const GOAL_ALIAS_MAP: Record<string, string> = {
  muscle_gain:      "build_muscle",     // UI label → DB canonical
  child_growth:     "healthy_growth",   // UI label → DB canonical
  anemia_recovery:  "anemia_recovery",  // already in DB CHECK — pass through
};

export function normalizeGoal(goal: string | undefined | null): string | undefined {
  if (!goal) return undefined;
  return GOAL_ALIAS_MAP[goal] ?? goal;
}

export function applyResponsibleAIRules(member: MemberProfileInput): MemberProfileOutput {
  const result: MemberProfileOutput = {
    primary_goal: member.primary_goal,
    goalPace: member.goalPace ?? "none",
    calorieTarget: undefined,
  };

  const age = member.age ?? 0;

  if (age < 5) {
    result.primary_goal = "childhood_nutrition";
    result.goalPace = "none";
  } else if (age >= 5 && age <= 12) {
    result.primary_goal = "healthy_growth";
    result.goalPace = "none";
  } else if (age >= 13 && age <= 17) {
    if (result.primary_goal === "weight_loss") {
      result.primary_goal = "maintain";
    }
    result.goalPace = "none";
  } else if (age >= 60 && !result.primary_goal) {
    result.primary_goal = "senior_nutrition";
  }

  if (member.weightKg && member.heightCm && member.age && member.gender) {
    const gender = member.gender.toLowerCase();
    let bmr = 10 * member.weightKg + 6.25 * member.heightCm - 5 * member.age;
    bmr += gender === "male" || gender === "m" ? 5 : -161;

    const multiplier = ACTIVITY_MULTIPLIERS[member.activityLevel ?? "moderately_active"] ?? 1.55;
    let tdee = bmr * multiplier;

    const pace = result.goalPace;
    if (result.primary_goal === "weight_loss" && (pace === "0.25" || pace === "0.5")) {
      tdee -= pace === "0.5" ? 500 : 250;
    } else if ((result.primary_goal === "weight_gain" || result.primary_goal === "build_muscle") && (pace === "0.25" || pace === "0.5")) {
      tdee += pace === "0.5" ? 500 : 250;
    }

    const computed = Math.max(1000, Math.round(tdee));
    result.icmrCaloricTarget = computed;
    result.calorieTarget = computed;
  }

  return result;
}
