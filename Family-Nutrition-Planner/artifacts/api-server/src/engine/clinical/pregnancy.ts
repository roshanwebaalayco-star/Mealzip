// =============================================================================
// NutriNext ParivarSehat — Pregnancy Clinical Module
// src/engine/clinical/pregnancy.ts
//
// Pregnancy is not a "health condition" in the traditional sense —
// it is a physiological state that transforms ALL nutritional requirements.
// It requires its own condition enum and trimester-aware calorie calculator.
//
// Three trimesters = three different requirement profiles:
//   T1 (weeks 1–13): Nausea management, folate priority, minimal extra calories
//   T2 (weeks 14–26): Iron surge, calcium loading, +350 kcal/day
//   T3 (weeks 27–40): Maximum calorie need, protein surge, DHA priority
//
// Sources:
//   ICMR-NIN 2020 Table 1.6 (Pregnant Women row)
//   WHO Recommendations on Antenatal Care 2016
//   FOGSI (Federation of Obstetric and Gynaecological Societies of India)
//   Dietary Guidelines for Indians 2024, Guideline 2 (Pregnancy & Lactation)
// =============================================================================

import type { EffectiveMemberProfile } from "../types";

// =============================================================================
// SECTION 1: PREGNANCY STAGE ENUM AND TYPE
// =============================================================================

export type PregnancyStage =
  | "trying_to_conceive"
  | "trimester_1"       // Weeks 1–13
  | "trimester_2"       // Weeks 14–26
  | "trimester_3"       // Weeks 27–40
  | "postpartum_0_6m"   // Lactating — first 6 months
  | "postpartum_7_12m"; // Lactating — 7–12 months

// Added to member profile as health condition:
// "pregnancy_t1" | "pregnancy_t2" | "pregnancy_t3"
// "lactating_0_6m" | "lactating_7_12m"
// These are recognized as special conditions by the conflict engine.

export const PREGNANCY_CONDITION_IDS = [
  "pregnancy_t1",
  "pregnancy_t2",
  "pregnancy_t3",
  "lactating_0_6m",
  "lactating_7_12m",
] as const;

export type PregnancyConditionId = typeof PREGNANCY_CONDITION_IDS[number];

// =============================================================================
// SECTION 2: CALORIE ADDITIONS PER STAGE
// ICMR-NIN 2020, Table 1.6: "Pregnant Women" and "Lactating Women" rows
// These are ADDITIONS on top of the member's pre-pregnancy TDEE.
// =============================================================================

export const PREGNANCY_CALORIE_ADDITIONS: Record<PregnancyConditionId, number> = {
  pregnancy_t1: 0,     // ICMR-NIN: No additional calories in T1 (nausea usually reduces intake anyway)
  pregnancy_t2: 350,   // ICMR-NIN: +350 kcal/day from T2 onwards
  pregnancy_t3: 350,   // ICMR-NIN: +350 kcal/day (same as T2 in ICMR-NIN 2020)
  lactating_0_6m: 600, // ICMR-NIN: +600 kcal/day for exclusive breastfeeding
  lactating_7_12m: 520, // ICMR-NIN: +520 kcal/day for partial breastfeeding
};

// =============================================================================
// SECTION 3: NUTRIENT TARGETS PER STAGE
// Source: ICMR-NIN 2020 DRI Tables + FOGSI India guidelines
// =============================================================================

export interface PregnancyNutrientTargets {
  protein_g_per_day: number;
  iron_mg_per_day: number;     // ICMR: 35mg (non-pregnant) → dramatically higher in pregnancy
  folate_mcg_per_day: number;  // CRITICAL in T1 for neural tube defect prevention
  calcium_mg_per_day: number;
  vitamin_d_iu_per_day: number;
  dha_omega3_mg_per_day: number;  // Fetal brain development
  iodine_mcg_per_day: number;
  zinc_mg_per_day: number;
  vitamin_c_mg_per_day: number;   // Enhances iron absorption — critical
  vitamin_b12_mcg_per_day: number;
  fiber_g_per_day: number;
  water_ml_per_day: number;
  weight_gain_target_kg: { min: number; max: number } | null;
}

export const PREGNANCY_NUTRIENT_TARGETS: Record<PregnancyConditionId, PregnancyNutrientTargets> = {
  pregnancy_t1: {
    protein_g_per_day: 60,        // DGI 2024: "8g additional protein" → ~68g total, T1 slightly lower
    iron_mg_per_day: 27,          // ICMR: significantly higher than 21mg non-pregnant
    folate_mcg_per_day: 600,      // ICMR: Critical for neural tube defect prevention. 400mcg supplement + 200mcg food
    calcium_mg_per_day: 1000,     // ICMR: Unchanged from non-pregnant but critical
    vitamin_d_iu_per_day: 600,
    dha_omega3_mg_per_day: 200,   // IDF recommendation for fetal brain
    iodine_mcg_per_day: 220,      // ICMR: Elevated for fetal thyroid development
    zinc_mg_per_day: 12,
    vitamin_c_mg_per_day: 80,     // Increased to enhance iron absorption
    vitamin_b12_mcg_per_day: 2.5,
    fiber_g_per_day: 25,          // Prevents constipation (common in T1)
    water_ml_per_day: 2500,
    weight_gain_target_kg: { min: 1, max: 2 }, // T1: 1–2 kg total (mostly fluid/placenta)
  },
  pregnancy_t2: {
    protein_g_per_day: 78,        // DGI 2024 Table 1.6: "Crude protein 72g" + ~6g addition
    iron_mg_per_day: 35,          // ICMR: Peak iron need — fetal storage begins
    folate_mcg_per_day: 500,      // Still elevated but neural tube risk window has passed
    calcium_mg_per_day: 1000,
    vitamin_d_iu_per_day: 600,
    dha_omega3_mg_per_day: 200,
    iodine_mcg_per_day: 220,
    zinc_mg_per_day: 13,
    vitamin_c_mg_per_day: 85,
    vitamin_b12_mcg_per_day: 2.6,
    fiber_g_per_day: 28,          // Constipation more common in T2
    water_ml_per_day: 2700,
    weight_gain_target_kg: { min: 5, max: 7 }, // T2: target 5–7 kg gain
  },
  pregnancy_t3: {
    protein_g_per_day: 83,        // DGI 2024: "8g additional protein" in T3 — highest need
    iron_mg_per_day: 35,          // Same peak — fetal iron storage continues
    folate_mcg_per_day: 500,
    calcium_mg_per_day: 1000,
    vitamin_d_iu_per_day: 600,
    dha_omega3_mg_per_day: 300,   // DHA peaks in T3 — fetal brain growth surge
    iodine_mcg_per_day: 220,
    zinc_mg_per_day: 13,
    vitamin_c_mg_per_day: 85,
    vitamin_b12_mcg_per_day: 2.6,
    fiber_g_per_day: 30,
    water_ml_per_day: 2800,
    weight_gain_target_kg: { min: 3, max: 4 }, // T3: remaining 3–4 kg gain
  },
  lactating_0_6m: {
    protein_g_per_day: 77,        // DGI 2024 Table 1.6: Lactating 0–6mo, Protein 77g
    iron_mg_per_day: 21,          // ICMR: Returns to elevated non-pregnant level (menstruation not yet resumed)
    folate_mcg_per_day: 500,      // Passes into breast milk
    calcium_mg_per_day: 1000,     // Critical to prevent maternal bone loss
    vitamin_d_iu_per_day: 600,
    dha_omega3_mg_per_day: 200,   // Passes into breast milk — essential for infant brain
    iodine_mcg_per_day: 290,      // ICMR: Highest iodine need — passes into breast milk
    zinc_mg_per_day: 12,
    vitamin_c_mg_per_day: 120,    // Highest ever — passes into breast milk
    vitamin_b12_mcg_per_day: 2.8, // Passes into breast milk — critical for infant neurological development
    fiber_g_per_day: 25,
    water_ml_per_day: 3000,       // Hydration critical for milk production
    weight_gain_target_kg: null,  // Weight loss phase, not gain
  },
  lactating_7_12m: {
    protein_g_per_day: 78,
    iron_mg_per_day: 21,
    folate_mcg_per_day: 400,
    calcium_mg_per_day: 1000,
    vitamin_d_iu_per_day: 600,
    dha_omega3_mg_per_day: 200,
    iodine_mcg_per_day: 290,
    zinc_mg_per_day: 12,
    vitamin_c_mg_per_day: 100,
    vitamin_b12_mcg_per_day: 2.8,
    fiber_g_per_day: 25,
    water_ml_per_day: 2800,
    weight_gain_target_kg: null,
  },
};

// =============================================================================
// SECTION 4: FORBIDDEN FOODS IN PREGNANCY
// Source: FOGSI India, ICMR-NIN 2024 Guideline 2
// These are ABSOLUTE — never appear in the pregnant member's plate.
// =============================================================================

export const PREGNANCY_FORBIDDEN_FOODS = {
  // Foods that can cause miscarriage, listeria, or fetal harm
  absolute_forbidden: [
    // Raw / undercooked proteins — listeria, salmonella risk
    "raw meat", "raw chicken", "raw fish", "raw eggs",
    "undercooked eggs (runny yolk)", "half-boiled egg",
    "raw sprouts (can carry bacteria)", "raw milk (unpasteurised)",
    "unpasteurised cheese", "soft cheese (brie, camembert, blue cheese)",
    "pate and deli meats (listeria risk)",

    // High mercury fish — fetal neurotoxicity
    "shark", "swordfish", "king mackerel", "tilefish",
    "large tuna portions (limit to 170g/week)",

    // Traditional Indian forbidden in pregnancy
    "raw papaya (contains papain — can trigger uterine contractions)",
    "unripe papaya", "papaya seeds", "papaya leaf",
    "excess pineapple (bromelain — similar concern to papain)",
    "herbal teas in excess (many are contraindicated)",

    // Alcohol — fetal alcohol syndrome
    "alcohol", "wine", "beer", "spirits", "cough syrup with alcohol",
  ],

  // Foods to strictly limit but not eliminate
  limit_foods: [
    "caffeine — max 200mg/day (1 cup of filter coffee or 2 cups of tea)",
    "liver (excess Vitamin A → teratogenic in large amounts)",
    "high-mercury fish (canned tuna — max 2 servings/week)",
    "added salt — sodium restriction for hypertensive pregnancies",
    "fried and processed foods (gestational diabetes risk)",
  ],

  // Indian-specific foods commonly consumed but risky in pregnancy
  cultural_caution: [
    "papaya (kacha / raw) — very commonly eaten in India, very risky in pregnancy",
    "pineapple in large quantities",
    "excess sesame seeds (til) in early pregnancy — traditional miscarriage concern, though evidence is mixed",
    "aloe vera juice — laxative, may stimulate uterus",
    "fenugreek seeds (methi) in large quantities — uterine stimulant",
  ],
};

// =============================================================================
// SECTION 5: REQUIRED FOODS IN PREGNANCY
// Foods the engine MUST include for the pregnant member.
// =============================================================================

export const PREGNANCY_REQUIRED_FOODS = {
  // High-iron foods — at every meal ideally (iron need doubles in pregnancy)
  iron_rich: [
    "palak (spinach)", "methi (fenugreek leaves)", "chaulai (amaranth greens)",
    "rajma", "chana", "moong", "masoor dal", "ragi (finger millet)",
    "jaggery (small amounts)", "dates (khajur)", "figs (anjeer)",
    "til (sesame) — in moderation", "watermelon seeds (roasted)",
  ],

  // Always pair iron with Vitamin C — ICMR rule
  vitamin_c_iron_enhancers: [
    "lemon juice (squeeze on every sabzi)", "tomato", "amla (Indian gooseberry)",
    "guava", "capsicum (bell pepper)", "orange", "nimbu (lime)",
  ],

  // Calcium sources — separate from iron by 2 hours
  calcium_rich: [
    "milk (pasteurised)", "curd / dahi", "paneer (small amounts — sodium check for HTN)",
    "ragi (finger millet — highest calcium grain in India)",
    "til (sesame seeds)", "rajma", "green leafy vegetables",
    "small dried fish (if non-veg, bones included)",
  ],

  // Folate — critical first trimester
  folate_rich: [
    "palak", "methi", "bathua (lamb's quarters)", "chana dal",
    "moong dal", "rajma", "avocado (if available)",
    "fortified breakfast cereals", "orange", "banana",
  ],

  // DHA (Omega-3) — fetal brain development
  dha_sources: [
    "walnuts (akhrot) — 5/day", "flaxseeds (alsi) — 1 tbsp/day",
    "chia seeds", "fatty fish (rohu, surmai, hilsa) — if non-veg",
    "DHA-fortified eggs", "mustard oil (contains ALA which converts to DHA)",
  ],

  // Hydration — critical for amniotic fluid
  hydration: [
    "coconut water (nariyal pani) — natural electrolytes",
    "dal water / aachar-free rice water",
    "nimbu pani without excess salt",
    "plain warm water — minimum 8–10 glasses/day",
    "milk — contributes to fluid intake",
  ],
};

// =============================================================================
// SECTION 6: TRIMESTER-SPECIFIC NAUSEA MANAGEMENT
// First trimester nausea affects 70–80% of Indian pregnant women.
// The meal plan must accommodate this.
// =============================================================================

export const T1_NAUSEA_MANAGEMENT_RULES = {
  meal_frequency: "5–6 small meals instead of 3 large meals",
  meal_timing: "Never let stomach be completely empty. Small snack every 2–3 hours.",
  avoid_triggers: [
    "strong-smelling spices (hing, heeng) — common nausea trigger",
    "very oily foods",
    "very spicy food",
    "large portions",
    "eating lying down",
  ],
  helpful_foods: [
    "dry toast or plain roti (without ghee) — first thing in morning",
    "ginger tea (adrak chai) in small amounts — helps with nausea",
    "crackers / khakhra (plain)",
    "cold foods rather than hot (smell is less intense)",
    "lemon (sucking a wedge helps nausea)",
    "curd (cooling, easily digestible)",
    "small portions of starchy foods: poha, upma, khichdi",
  ],
  gemini_instruction:
    "FIRST TRIMESTER NAUSEA: For [MEMBER_NAME] in T1, generate 5–6 small meals instead of 3 large ones. Breakfasts should be dry and bland (plain roti, toast). Avoid heeng (hing) and heavy spices. Include ginger in some preparations. Protein should come from curd and dal — not heavy curries.",
};

// =============================================================================
// SECTION 7: IRON-CALCIUM TIMING ENFORCEMENT IN PREGNANCY
// This is the most important interaction in Indian pregnancy nutrition.
// Most Indian meals combine dairy (calcium) with dal (iron) in the same plate.
// This blocks up to 60% of iron absorption — critical when iron need has DOUBLED.
// =============================================================================

export const PREGNANCY_IRON_CALCIUM_RULE = {
  rule: "SEPARATE iron-rich meals and calcium-rich meals by AT LEAST 2 HOURS",
  practical_implementation: [
    "Iron-rich lunch (palak dal, rajma) → Curd / glass of milk only as BEDTIME snack (4+ hours later)",
    "Calcium-rich breakfast (milk, dahi) → Iron-rich lunch only after 2 hours",
    "NEVER: Dal-chawal with milk on the side in the same meal",
    "NEVER: Rajma with curd in the same meal",
    "Green leafy sabzi (iron) → squeeze lemon juice on it (Vitamin C enhances iron)",
    "Tea / coffee: Avoid within 1 hour of iron-rich meals (tannins block iron)",
  ],
  gemini_instruction:
    "PREGNANCY IRON-CALCIUM SEPARATION: For [MEMBER_NAME] (pregnant), dairy products (milk, curd, paneer) MUST NOT appear in the same meal as high-iron foods (palak, rajma, dal). Schedule milk/curd as a bedtime snack or mid-morning snack at least 2 hours away from iron-rich main meals. Add a squeeze of lemon to all iron-rich dishes to enhance absorption.",
};

// =============================================================================
// SECTION 8: CONDITION DIETARY RULE OBJECTS
// These integrate directly into CONDITION_DIETARY_RULES in conflict-engine.ts.
// Each stage needs its own rule because the requirements are different.
// =============================================================================

export const PREGNANCY_CLINICAL_RULES: Record<string, {
  forbidden_ingredients: string[];
  limit_ingredients: string[];
  mandatory_nutrients: string[];
  special_instructions: string;
}> = {
  pregnancy_t1: {
    forbidden_ingredients: PREGNANCY_FORBIDDEN_FOODS.absolute_forbidden,
    limit_ingredients: PREGNANCY_FORBIDDEN_FOODS.limit_foods,
    mandatory_nutrients: [
      "folate 600mcg/day (CRITICAL — neural tube development window)",
      "iron 27mg/day (pair every iron-rich meal with Vitamin C)",
      "calcium 1000mg/day (separate from iron meals by 2+ hours)",
      "protein 60g/day",
      "adequate water — 2500ml/day",
    ],
    special_instructions:
      `PREGNANCY FIRST TRIMESTER (Weeks 1–13):
      FOLATE PRIORITY: Folate is critical NOW. Include: palak, chana dal, moong dal, orange daily.
      NAUSEA MANAGEMENT: 5–6 small meals. Dry bland breakfast. No hing/heeng. Ginger is helpful.
      IRON-CALCIUM SEPARATION: Never combine dairy and iron-rich foods in the same meal.
      FORBIDDEN: raw papaya, raw eggs, unpasteurised dairy, alcohol, high-mercury fish.
      BEDTIME SNACK: Warm milk + 2 whole wheat biscuits (gentle and calcium-providing).
      NO EXTRA CALORIES YET: +0 kcal in T1. Quality over quantity.`,
  },
  pregnancy_t2: {
    forbidden_ingredients: PREGNANCY_FORBIDDEN_FOODS.absolute_forbidden,
    limit_ingredients: PREGNANCY_FORBIDDEN_FOODS.limit_foods,
    mandatory_nutrients: [
      "iron 35mg/day (PEAK need — include iron at every meal + Vitamin C)",
      "calcium 1000mg/day (bone formation surges in T2)",
      "protein 78g/day (fetal tissue building)",
      "DHA omega-3 200mg/day (walnut or flaxseed daily)",
      "calories +350 kcal/day above pre-pregnancy TDEE",
      "water 2700ml/day",
    ],
    special_instructions:
      `PREGNANCY SECOND TRIMESTER (Weeks 14–26):
      IRON PEAK: Iron need is now 35mg/day. Include rajma, palak, or chana at EVERY lunch and dinner.
      PAIR WITH VIT C: Lemon squeeze on every iron-rich dish. Include tomato or capsicum.
      IRON-CALCIUM SEPARATION: Dairy only at breakfast or bedtime — NOT at lunch/dinner when iron foods are served.
      PROTEIN SURGE: Add an extra dal serving or 50g paneer to daily intake.
      EXTRA CALORIES: +350 kcal/day. Add: 1 extra roti, handful of nuts, 1 glass extra milk, or fruit.
      AVOID: raw papaya, alcohol, high-mercury fish, excess caffeine.`,
  },
  pregnancy_t3: {
    forbidden_ingredients: PREGNANCY_FORBIDDEN_FOODS.absolute_forbidden,
    limit_ingredients: [
      ...PREGNANCY_FORBIDDEN_FOODS.limit_foods,
      "very large meals (baby compresses stomach — smaller, more frequent meals needed)",
      "raw salt in excess (oedema common in T3 — sodium restriction helps)",
    ],
    mandatory_nutrients: [
      "protein 83g/day (highest — fetal growth peaks in T3)",
      "iron 35mg/day (fetal iron storage)",
      "calcium 1000mg/day",
      "DHA omega-3 300mg/day (brain development peaks in T3 — walnuts, flaxseed, fatty fish)",
      "calories +350 kcal/day",
      "vitamin K (supports fetal clotting factor development)",
      "water 2800ml/day",
    ],
    special_instructions:
      `PREGNANCY THIRD TRIMESTER (Weeks 27–40):
      SMALLER MEALS: Fetus pressing stomach — 5–6 small meals instead of 3 large.
      DHA PEAK: Fetal brain develops fastest in T3. Include walnuts daily (5 halves) + 1 tbsp flaxseeds in dal or roti.
      PROTEIN MAXIMUM: Highest protein need (83g/day). Every meal must have dal + another protein (curd, paneer, or egg if applicable).
      OEDEMA MANAGEMENT: Reduce added salt. Increase potassium (banana, sweet potato, coconut water).
      CONSTIPATION PREVENTION: High fibre (30g/day). Include leafy vegetables and whole grains at every meal.
      HEARTBURN: Avoid spicy and oily foods. Small meals. Sit upright for 30 mins after eating.`,
  },
  lactating_0_6m: {
    forbidden_ingredients: [
      "alcohol", "excess caffeine (max 200mg/day — less than non-pregnant)",
    ],
    limit_ingredients: [
      "very spicy foods (may affect breast milk taste)",
      "foods that cause gas (can pass to baby) — cabbage, beans in excess",
      "added salt (mild restriction)",
    ],
    mandatory_nutrients: [
      "calories +600 kcal/day (HIGHEST calorie need — exclusive breastfeeding)",
      "protein 77g/day",
      "iodine 290mcg/day (HIGHEST — passes into breast milk for infant thyroid)",
      "vitamin B12 2.8mcg/day (CRITICAL — infant gets no other source if vegetarian mother)",
      "calcium 1000mg/day (prevent maternal bone loss)",
      "DHA 200mg/day (infant brain development via breast milk)",
      "water 3000ml/day (hydration = milk production)",
      "vitamin C 120mg/day",
    ],
    special_instructions:
      `LACTATING (0–6 months exclusive breastfeeding):
      HYDRATION FIRST: Drink a glass of water every time baby feeds. 3L/day minimum.
      CALORIE PRIORITY: +600 kcal/day. This is the HIGHEST calorie need of the entire reproductive cycle. Do not restrict.
      VITAMIN B12 CRITICAL: Vegetarian mothers MUST supplement B12 or include fortified foods daily — infant exclusively breastfed gets NO other B12.
      IODINE: Iodised salt mandatory. Include dairy, eggs (if applicable), seafood (if non-veg).
      AVOID: Alcohol passes directly into breast milk. No alcohol at all.
      MILK SUPPLY: Include: fennel seeds (saunf tea), fenugreek seeds (methi tea), oats, and adequate calories.
      IRON: Menstruation has not resumed — iron need is lower than pregnancy. Focus on general iron-rich foods.`,
  },
  lactating_7_12m: {
    forbidden_ingredients: ["alcohol"],
    limit_ingredients: ["excess caffeine"],
    mandatory_nutrients: [
      "calories +520 kcal/day (partial breastfeeding — baby now eating solid foods too)",
      "protein 78g/day",
      "iodine 290mcg/day",
      "vitamin B12 2.8mcg/day",
      "calcium 1000mg/day",
      "water 2800ml/day",
    ],
    special_instructions:
      `LACTATING (7–12 months partial breastfeeding):
      Similar to 0–6 months but slightly lower calorie addition as baby eats solid foods.
      B12 STILL CRITICAL for vegetarian/vegan mothers.
      CALCIUM: Continue high calcium — maternal bone density risk continues.
      GRADUAL WEANING NUTRITION: As baby transitions to solids, mother's nutritional needs gradually approach pre-pregnancy levels.`,
  },
};

// =============================================================================
// SECTION 9: PREGNANCY CONFLICT DETECTOR
// Call this in conflict-engine.ts to check for pregnancy-specific conflicts.
// =============================================================================

export interface PregnancyConflictCheck {
  memberName: string;
  isPregnant: boolean;
  pregnancyStage: PregnancyConditionId | null;
  hasConflictingConditions: boolean;
  conflictDescriptions: string[];
  instructionStrings: string[];
  groceryAdditions: { name: string; reason: string }[];
}

export function detectPregnancyConflicts(
  profile: EffectiveMemberProfile
): PregnancyConflictCheck {
  // Detect pregnancy stage from effective health conditions
  const pregnancyCondition = profile.effectiveHealthConditions.find(
    (c): c is PregnancyConditionId =>
      PREGNANCY_CONDITION_IDS.includes(c as PregnancyConditionId)
  );

  if (!pregnancyCondition) {
    return {
      memberName: profile.name,
      isPregnant: false,
      pregnancyStage: null,
      hasConflictingConditions: false,
      conflictDescriptions: [],
      instructionStrings: [],
      groceryAdditions: [],
    };
  }

  const conflictDescriptions: string[] = [];
  const instructionStrings: string[] = [];
  const groceryAdditions: { name: string; reason: string }[] = [];

  // T1D + Pregnancy = extremely high-risk combination
  if (profile.effectiveHealthConditions.includes("diabetes_type_1")) {
    conflictDescriptions.push(
      `CRITICAL: ${profile.name} has both Type 1 Diabetes and Pregnancy (${pregnancyCondition}). ` +
      `This is a high-risk pregnancy requiring specialist endocrinological and obstetric care. ` +
      `The meal plan will provide T1D + pregnancy combined rules. STRONGLY recommend dedicated ` +
      `medical supervision for this combination.`
    );
  }

  // Hypertension + Pregnancy = gestational hypertension risk
  if (profile.effectiveHealthConditions.includes("hypertension")) {
    conflictDescriptions.push(
      `${profile.name} has hypertension + pregnancy (${pregnancyCondition}). ` +
      `Gestational hypertension increases preeclampsia risk. Sodium limit: 1500mg/day strictly. ` +
      `High potassium foods (banana, sweet potato, coconut water) are important.`
    );
  }

  // Anaemia + Pregnancy = high risk for low birth weight
  if (profile.effectiveHealthConditions.includes("anaemia")) {
    conflictDescriptions.push(
      `${profile.name} has anaemia + pregnancy (${pregnancyCondition}). ` +
      `Iron deficiency anaemia in pregnancy increases risk of low birth weight and preterm birth. ` +
      `Iron-rich foods must appear at EVERY meal. Iron-calcium separation is mandatory. ` +
      `Medical iron supplementation should be confirmed with the healthcare provider.`
    );
    instructionStrings.push(
      `PREGNANCY + ANAEMIA (${profile.name}): Iron-rich food at EVERY meal. Vitamin C pairing mandatory. ` +
      `Iron-calcium separation is CRITICAL. Include: rajma, palak, chana at lunch AND dinner. ` +
      `Bedtime snack: warm milk (calcium) — 4 hours after last iron-rich meal.`
    );
  }

  // Iron-calcium separation instruction (applies to all pregnant members)
  instructionStrings.push(
    PREGNANCY_IRON_CALCIUM_RULE.gemini_instruction.replace(/\[MEMBER_NAME\]/g, profile.name)
  );

  // First trimester nausea instruction
  if (pregnancyCondition === "pregnancy_t1") {
    instructionStrings.push(
      T1_NAUSEA_MANAGEMENT_RULES.gemini_instruction.replace(/\[MEMBER_NAME\]/g, profile.name)
    );
  }

  // Forbidden foods instruction
  instructionStrings.push(
    `PREGNANCY FORBIDDEN FOODS (${profile.name}): The following MUST NOT appear in ${profile.name}'s plate: ` +
    `${PREGNANCY_FORBIDDEN_FOODS.absolute_forbidden.slice(0, 8).join(", ")}. ` +
    `Raw papaya and raw eggs are especially common in Indian cooking — flag these.`
  );

  // Grocery additions
  groceryAdditions.push(
    { name: "Folate-rich foods (palak, chana dal, orange)", reason: "Critical for fetal neural tube development" },
    { name: "Lemon (nimbu)", reason: "Vitamin C for iron absorption — essential pairing in pregnancy" },
    { name: "Walnuts (akhrot) — 5/day for DHA", reason: "Fetal brain development" },
    { name: "Ragi (finger millet)", reason: "Calcium + iron in one grain — ideal for Indian pregnancy diet" },
  );

  if (pregnancyCondition === "lactating_0_6m" || pregnancyCondition === "lactating_7_12m") {
    groceryAdditions.push(
      { name: "Saunf (fennel seeds)", reason: "Traditional galactagogue — supports breast milk production" },
      { name: "Flaxseeds (alsi)", reason: "DHA for infant brain development via breast milk" },
    );
  }

  return {
    memberName: profile.name,
    isPregnant: true,
    pregnancyStage: pregnancyCondition,
    hasConflictingConditions: conflictDescriptions.length > 0,
    conflictDescriptions,
    instructionStrings,
    groceryAdditions,
  };
}
