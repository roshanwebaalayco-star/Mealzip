// =============================================================================
// NutriNext ParivarSehat — Type 1 Diabetes Clinical Module
// src/engine/clinical/type1Diabetes.ts
//
// Type 1 diabetes is an entirely different disease from Type 2.
// Type 2: insulin resistance — diet can meaningfully improve outcomes.
// Type 1: autoimmune destruction of beta cells — insulin is mandatory.
//         Diet manages glucose variability, not the disease itself.
//
// CRITICAL DISTINCTION:
//   T2D patient: Reduce carbs → less glucose → less demand on impaired insulin
//   T1D patient: Must eat ENOUGH carbs → too little = hypoglycemia = emergency
//
// The meal engine must:
//   1. Enforce minimum carb FLOORS per meal (not just ceilings)
//   2. Inject insulin timing windows into the schedule
//   3. Block meals that create rapid glucose spikes (high GI without fat/protein)
//   4. Add hypo-rescue food requirements to the constraint packet
//   5. Handle post-exercise carb loading differently from weight-loss patients
//
// Sources:
//   ICMR-NIN 2020, Diabetes India Clinical Guidelines 2022,
//   IDF Atlas India Chapter, ADA Standards of Medical Care 2024 (adapted)
// =============================================================================

import type {
  EffectiveMemberProfile,
  MedicationSlotConstraint,
  MedicationWeeklyMonitor,
} from "../types";

// =============================================================================
// SECTION 1: INSULIN TYPES — Timing lookup table
// Maps user-entered insulin brand names to timing windows.
// =============================================================================

interface InsulinTimingRule {
  type: "rapid_acting" | "short_acting" | "intermediate" | "long_acting" | "mixed";
  onset_mins: number;
  peak_mins: number;
  duration_hrs: number;
  must_eat_within_mins: number;  // How soon AFTER injection must a meal be eaten
  carb_minimum_per_meal_g: number;  // Minimum carbs required when this insulin is active
  hypo_risk_window: string;  // Human-readable window description
  meal_pairing_instruction: string;
}

export const INSULIN_TIMING_RULES: Record<string, InsulinTimingRule> = {
  // ── Rapid-acting (bolus) ──────────────────────────────────────────────────
  novorapid: {
    type: "rapid_acting", onset_mins: 10, peak_mins: 60, duration_hrs: 3,
    must_eat_within_mins: 15,
    carb_minimum_per_meal_g: 30,
    hypo_risk_window: "1–3 hours after injection",
    meal_pairing_instruction:
      "NovoRapid (NovoLog): Inject 0–15 minutes BEFORE the meal. Meal MUST contain ≥30g carbohydrates. Do NOT inject and then delay or skip the meal.",
  },
  humalog: {
    type: "rapid_acting", onset_mins: 15, peak_mins: 60, duration_hrs: 3.5,
    must_eat_within_mins: 15,
    carb_minimum_per_meal_g: 30,
    hypo_risk_window: "1–3 hours after injection",
    meal_pairing_instruction:
      "Humalog (Lispro): Inject 0–15 minutes BEFORE the meal. Meal MUST contain ≥30g carbohydrates.",
  },
  apidra: {
    type: "rapid_acting", onset_mins: 10, peak_mins: 45, duration_hrs: 3,
    must_eat_within_mins: 10,
    carb_minimum_per_meal_g: 30,
    hypo_risk_window: "45 minutes to 3 hours after injection",
    meal_pairing_instruction:
      "Apidra (Glulisine): Inject within 0–10 minutes BEFORE the meal. Meal MUST contain ≥30g carbohydrates.",
  },
  // ── Short-acting (regular/soluble) ────────────────────────────────────────
  actrapid: {
    type: "short_acting", onset_mins: 30, peak_mins: 90, duration_hrs: 6,
    must_eat_within_mins: 30,
    carb_minimum_per_meal_g: 40,
    hypo_risk_window: "1.5–4 hours after injection",
    meal_pairing_instruction:
      "Actrapid (Regular insulin): Inject 30 minutes BEFORE the meal. Meal MUST contain ≥40g carbohydrates.",
  },
  // ── Long-acting (basal) ───────────────────────────────────────────────────
  lantus: {
    type: "long_acting", onset_mins: 60, peak_mins: 0 /* peakless */, duration_hrs: 24,
    must_eat_within_mins: 0,  // Basal — no immediate meal pairing required
    carb_minimum_per_meal_g: 25,  // Consistent carb intake across the day
    hypo_risk_window: "Night if over-dosed. Consistent daily carb intake essential.",
    meal_pairing_instruction:
      "Lantus (Glargine): Once daily injection — typically at bedtime. No meal pairing required. However, daily carb intake MUST be consistent (±20%) to prevent basal hypo/hyperglycemia.",
  },
  tresiba: {
    type: "long_acting", onset_mins: 60, peak_mins: 0, duration_hrs: 42,
    must_eat_within_mins: 0,
    carb_minimum_per_meal_g: 25,
    hypo_risk_window: "Minimal — ultralong with lower hypo risk than Lantus",
    meal_pairing_instruction:
      "Tresiba (Degludec): Once daily. Flexible timing ±8 hours. Consistent daily carb intake required.",
  },
  levemir: {
    type: "long_acting", onset_mins: 60, peak_mins: 480, duration_hrs: 20,
    must_eat_within_mins: 0,
    carb_minimum_per_meal_g: 25,
    hypo_risk_window: "6–12 hours after injection — slight peak unlike Lantus",
    meal_pairing_instruction:
      "Levemir (Detemir): Once or twice daily. Slight peak around 6–12 hours post-injection — avoid prolonged fasting during this window.",
  },
  // ── Pre-mixed ─────────────────────────────────────────────────────────────
  mixtard: {
    type: "mixed", onset_mins: 30, peak_mins: 120, duration_hrs: 14,
    must_eat_within_mins: 30,
    carb_minimum_per_meal_g: 45,
    hypo_risk_window: "2–5 hours after injection AND before next meal",
    meal_pairing_instruction:
      "Mixtard 30/70: Inject 30 minutes BEFORE meal. Meal MUST contain ≥45g carbohydrates. Mid-morning and mid-afternoon snacks required to prevent inter-meal hypoglycemia.",
  },
};

// =============================================================================
// SECTION 2: T1D CARB TARGETS PER MEAL
// Type 1 patients must carb-count. These are minimum floors, not ceilings.
// The engine must PREVENT going below these — not just cap them from above.
// =============================================================================

export interface T1DCarbohydrateFloors {
  breakfast_min_g: number;
  lunch_min_g: number;
  dinner_min_g: number;
  snack_min_g: number;
  mid_morning_min_g: number;
  bedtime_snack_min_g: number;  // Critical for overnight hypo prevention
  daily_total_min_g: number;
  daily_total_max_g: number;
  consistency_variance_percent: number;  // Max daily variation — Warfarin-like rule
}

export const T1D_CARB_FLOORS: T1DCarbohydrateFloors = {
  breakfast_min_g: 30,        // Rapid-acting insulin requires this
  lunch_min_g: 45,
  dinner_min_g: 45,
  snack_min_g: 15,
  mid_morning_min_g: 15,
  bedtime_snack_min_g: 15,    // Prevents nocturnal hypoglycemia
  daily_total_min_g: 150,     // ICMR minimum for T1D — below this = DKA risk
  daily_total_max_g: 250,     // Reasonable upper bound for glycemic control
  consistency_variance_percent: 20, // Day-to-day carb variation should be <20%
};

// =============================================================================
// SECTION 3: T1D FORBIDDEN AND REQUIRED FOODS
// =============================================================================

export const T1D_DIETARY_RULES = {
  // Foods that cause unpredictable glucose spikes (high GI + no fat/protein buffer)
  forbidden_high_risk: [
    "white sugar (unaccompanied)",
    "glucose powder",
    "fruit juice in large quantities",
    "cold drinks / sweetened beverages",
    "candy / toffee (except as hypo treatment)",
    "rice paper / puffed rice in excess",
    "very ripe banana alone (without protein)",
  ],

  // Foods to always limit but not eliminate
  limit_foods: [
    "white rice (replace with brown rice or limit to 100g cooked)",
    "white bread (prefer whole wheat or multigrain)",
    "potato (limit to 100g — high GI)",
    "sweet fruits alone without protein/fat pairing",
    "honey (highly concentrated glucose)",
    "maida-based preparations",
  ],

  // Required inclusions for glycemic stability
  required_inclusions: [
    "protein source at every meal (dal, paneer, eggs, curd, lean meat)",
    "healthy fat at every meal (ghee: 1 tsp, nuts, seeds) to slow glucose absorption",
    "fibre-rich vegetables at every meal (sabzi) to flatten glucose curve",
    "complex carbohydrates only (jowar, bajra, oats, whole wheat, brown rice, rajma, chana)",
  ],

  // Hypo rescue foods — must ALWAYS be available in the pantry
  // The engine should add these to the grocery list automatically
  hypo_rescue_mandatory_pantry: [
    "glucose tablets or glucose powder (15g portions)",
    "sugar cubes (15g portions — equivalent to 3–4 cubes)",
    "fruit juice (100ml tetra packs — for emergency only)",
    "regular cold drink / nimbu paani (not diet — for emergency only)",
    "biscuits / glucose biscuits (2–3 pieces = 15g carb)",
  ],

  // Bedtime snack — MANDATORY for T1D on basal insulin
  bedtime_snack_required: true,
  bedtime_snack_examples: [
    "1 glass milk (250ml) + 2 whole wheat biscuits",
    "1 bowl curd (100g) + 1 small roti",
    "banana (small) + 5 almonds",
    "handful of roasted chana",
  ],
};

// =============================================================================
// SECTION 4: HYPOGLYCEMIA PREVENTION RULES
// This is what the 0% test score was about.
// The engine must actively prevent LOW blood sugar, not just HIGH.
// =============================================================================

export interface HypoglycemiaPreventionRule {
  trigger: string;
  risk_level: "emergency" | "high" | "moderate";
  prevention: string;
  meal_plan_instruction: string;
}

export const HYPOGLYCEMIA_PREVENTION_RULES: HypoglycemiaPreventionRule[] = [
  {
    trigger: "Skipping a meal after bolus insulin injection",
    risk_level: "emergency",
    prevention: "MEAL MUST NEVER BE SKIPPED for T1D members on rapid-acting insulin",
    meal_plan_instruction:
      "T1D SAFETY RULE: For [MEMBER_NAME], the meal plan MUST include a substantial meal for every slot where rapid-acting insulin is noted. If the family eats out or skips a meal, [MEMBER_NAME] STILL needs ≥30g carbohydrates. The nutritional bandaid for a skipped meal is NOT almonds — it must be a carb-containing food (bread, banana, glucose tablets).",
  },
  {
    trigger: "Delaying a meal by >30 minutes after rapid-acting injection",
    risk_level: "emergency",
    prevention: "Always have 15g fast-acting carbs as immediate rescue",
    meal_plan_instruction:
      "DELAY PREVENTION: If [MEMBER_NAME]'s meal is delayed, they must consume 15g fast-acting carbohydrates immediately (glucose tablets, fruit juice, or 3 glucose biscuits). This is NOT optional.",
  },
  {
    trigger: "Post-exercise without carb adjustment",
    risk_level: "high",
    prevention: "Post-exercise snack of 15–30g carbs mandatory",
    meal_plan_instruction:
      "POST-EXERCISE: If [MEMBER_NAME] exercises (activity_level: very_active or moderately_active), add a 15–30g carbohydrate snack within 30 minutes of exercise completion. Roasted chana, banana, or milk are suitable options.",
  },
  {
    trigger: "Fasting day (if T1D member attempts to fast)",
    risk_level: "emergency",
    prevention: "T1D members should NOT fast without medical supervision",
    meal_plan_instruction:
      "FASTING WARNING: [MEMBER_NAME] has Type 1 Diabetes. Religious fasting is DANGEROUS without adjusting insulin doses, which requires medical supervision. The meal plan should FLAG this for medical review. If fasting is insisted upon, minimum 15g carbs every 2–3 hours from fruit/milk is mandatory. Inform the user that insulin dose adjustment is required from their endocrinologist.",
  },
  {
    trigger: "Night-time (nocturnal hypoglycemia)",
    risk_level: "high",
    prevention: "Bedtime snack is mandatory for all T1D members on basal insulin",
    meal_plan_instruction:
      "BEDTIME SNACK MANDATORY: [MEMBER_NAME] must have a bedtime snack of 15–20g slow-release carbohydrates (milk + biscuit, curd + roti) to prevent nocturnal hypoglycemia. This must appear as a 4th meal slot in the plan.",
  },
];

// =============================================================================
// SECTION 5: T1D CONDITION DIETARY RULE
// This integrates with CONDITION_DIETARY_RULES in conflict-engine.ts.
// COPY THIS OBJECT into CONDITION_DIETARY_RULES["diabetes_type_1"] in conflict-engine.ts
// =============================================================================

export const DIABETES_TYPE_1_CLINICAL_RULE = {
  forbidden_ingredients: [
    ...T1D_DIETARY_RULES.forbidden_high_risk,
  ],
  limit_ingredients: [
    ...T1D_DIETARY_RULES.limit_foods,
  ],
  mandatory_nutrients: [
    "consistent daily carbohydrates (150–250g/day)",
    "protein at every meal (slows glucose absorption)",
    "dietary fibre (flattens glucose spike)",
    "healthy fats at every meal (slows carb absorption)",
  ],
  special_instructions:
    `TYPE 1 DIABETES — CRITICAL RULES (different from Type 2):
    
    1. MINIMUM CARB FLOORS: Breakfast ≥30g, Lunch ≥45g, Dinner ≥45g, Snack ≥15g. NEVER go below these.
    2. BEDTIME SNACK MANDATORY: Include a 15–20g slow-carb bedtime snack in all 7 days.
    3. CONSISTENT CARBS: Daily carb total must be within ±20% across all 7 days (like Warfarin's vitamin K consistency rule).
    4. NEVER SKIP MEALS: For T1D members, a skipped meal after insulin = hypoglycemic emergency. The "nutritional bandaid" for skipped meals must include carbs, not just almonds/walnuts.
    5. BALANCED PLATE: Every meal must include carb + protein + fat + fibre. Never carbs alone.
    6. HYPO RESCUE: Add glucose tablets/glucose biscuits to the weekly grocery list as a mandatory item.
    7. FASTING ALERT: If T1D member has fasting_config set, flag it as requiring medical supervision. Suggest "minimum carb modified fast" and recommend endocrinologist consultation.
    8. MEAL TIMING: If user has noted rapid-acting insulin (NovoRapid, Humalog), the meal MUST be ready and eaten within 15 minutes of injection. The plan should note this in cooking steps.`,
};

// =============================================================================
// SECTION 6: T1D HARMONY SCORE RULES
// T1D conflicts earn special harmony additions when handled correctly.
// =============================================================================

export const T1D_HARMONY_RULES = {
  fasting_day_correctly_flagged_addition: 5,  // +5 for correctly flagging fasting danger
  bedtime_snack_included_addition: 2,         // +2 for including bedtime snack
  hypo_rescue_grocery_added_addition: 2,      // +2 for adding glucose tablets to grocery list
  carb_floor_maintained_addition: 3,          // +3 for maintaining minimum carb floors
  meal_skipped_without_carb_rescue_deduction: -10,  // -10 for allowing a skipped meal without carb rescue
};

// =============================================================================
// SECTION 7: DETECTOR FUNCTION
// Call this in conflict-engine.ts to detect T1D-specific conflicts.
// =============================================================================

export interface T1DConflictCheck {
  memberName: string;
  hasT1D: boolean;
  fastingDaysDetected: string[];
  fastingConflictSeverity: "none" | "warning" | "critical";
  insulinTypeDetected: string | null;
  insulinTimingRule: InsulinTimingRule | null;
  carbFloorsMet: boolean;
  bedtimeSnackRequired: boolean;
  hypoRescueGroceryRequired: boolean;
  conflictDescriptions: string[];
  instructionStrings: string[];
}

export function detectT1DConflicts(
  profile: EffectiveMemberProfile
): T1DConflictCheck {
  const hasT1D = profile.effectiveHealthConditions.includes("diabetes_type_1");

  if (!hasT1D) {
    return {
      memberName: profile.name,
      hasT1D: false,
      fastingDaysDetected: [],
      fastingConflictSeverity: "none",
      insulinTypeDetected: null,
      insulinTimingRule: null,
      carbFloorsMet: true,
      bedtimeSnackRequired: false,
      hypoRescueGroceryRequired: false,
      conflictDescriptions: [],
      instructionStrings: [],
    };
  }

  const conflictDescriptions: string[] = [];
  const instructionStrings: string[] = [];

  // Check for fasting days
  const fastingDays = profile.effectiveFastingDays ?? [];
  let fastingConflictSeverity: "none" | "warning" | "critical" = "none";

  if (fastingDays.length > 0 || profile.ekadashiThisWeek || profile.festivalFastThisWeek) {
    fastingConflictSeverity = "critical";
    conflictDescriptions.push(
      `${profile.name} has Type 1 Diabetes and has fasting days set (${fastingDays.join(", ")}). ` +
      `CRITICAL: Fasting with T1D requires insulin dose adjustment from an endocrinologist. ` +
      `The meal plan will use a "minimum carb modified fast" (≥15g carbs every 2 hours) ` +
      `instead of a true fast. Strongly recommend consulting a doctor before any fasting.`
    );
  }

  // Detect insulin from active medications
  let insulinTypeDetected: string | null = null;
  let insulinTimingRule: InsulinTimingRule | null = null;

  for (const med of profile.activeMedications) {
    const medLower = med.name.toLowerCase();
    for (const [key, rule] of Object.entries(INSULIN_TIMING_RULES)) {
      if (medLower.includes(key) || key.includes(medLower.split(" ")[0].toLowerCase())) {
        insulinTypeDetected = med.name;
        insulinTimingRule = rule;
        if (rule.must_eat_within_mins > 0) {
          instructionStrings.push(
            `[T1D INSULIN TIMING] ${profile.name} takes ${med.name}. ` +
            rule.meal_pairing_instruction +
            ` Hypo risk window: ${rule.hypo_risk_window}.`
          );
        }
        break;
      }
    }
    if (insulinTimingRule) break;
  }

  // Build all instruction strings
  for (const rule of HYPOGLYCEMIA_PREVENTION_RULES) {
    const instruction = rule.meal_plan_instruction.replace(/\[MEMBER_NAME\]/g, profile.name);
    instructionStrings.push(
      `[T1D HYPO PREVENTION - ${rule.risk_level.toUpperCase()}] ${instruction}`
    );
  }

  return {
    memberName: profile.name,
    hasT1D: true,
    fastingDaysDetected: fastingDays,
    fastingConflictSeverity,
    insulinTypeDetected,
    insulinTimingRule,
    carbFloorsMet: true,  // Assumed true — enforced by the OBMP engine
    bedtimeSnackRequired: true,
    hypoRescueGroceryRequired: true,
    conflictDescriptions,
    instructionStrings,
  };
}

// =============================================================================
// SECTION 8: GROCERY LIST ADDITIONS FOR T1D
// These items MUST be added to every weekly grocery list for T1D families.
// =============================================================================

export const T1D_MANDATORY_GROCERY_ITEMS = [
  {
    name: "Glucose tablets (Glucon-D or equivalent)",
    quantity: 1,
    unit: "pack",
    estimated_price: 60,
    category: "medical_essential",
    purchased: false,
    notes: "MANDATORY for T1D emergency: 15g fast-acting carbs = 4–5 tablets. Keep accessible at all times.",
  },
  {
    name: "Glucose biscuits (Parle-G or Britannia Glucose)",
    quantity: 1,
    unit: "packet (200g)",
    estimated_price: 25,
    category: "medical_essential",
    purchased: false,
    notes: "Hypo rescue option: 2–3 biscuits = ~15g fast-acting carbs",
  },
  {
    name: "Fruit juice tetra packs (Maaza / Real, NOT diet)",
    quantity: 4,
    unit: "packs (100ml each)",
    estimated_price: 80,
    category: "medical_essential",
    purchased: false,
    notes: "EMERGENCY hypo rescue only. 100ml = ~10–12g fast-acting carbs. Keep in fridge at all times.",
  },
];
