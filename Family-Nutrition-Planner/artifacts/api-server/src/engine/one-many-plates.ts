import type {
  ConstraintPacket,
  EffectiveMemberProfile,
  MedicationGuardrailBundle,
  PantryItem,
} from "./types";

export interface ComputedMemberPlate {
  member_id: string;
  member_name: string;
  modifications: string[];
  pull_before_step: number | null;
  pull_before_reason: string | null;
  pull_before_urgency: "CRITICAL" | "RECOMMENDED" | null;
  additives: string[];
  withheld: string[];
  modified: string[];
  macro_targets: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    sodium_mg_max: number | null;
    iron_mg?: number;
  };
  estimated_macros: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    sodiumMg: number;
    ironMg?: number;
  };
  clinical_flags: string[];
  warning_flags: string[];
  harmony_deduction_points: number;
  harmony_deduction_reason: string | null;
}

export interface PullEvent {
  beforeStep: number;
  memberNames: string[];
  reason: string;
  urgency: "CRITICAL" | "RECOMMENDED";
}

export interface ConflictEscalation {
  reason: string;
  affectedMembers: string[];
  proposedSolution: string;
  parallelDishesNeeded: number;
}

export interface HarmonyDeduction {
  reason: string;
  points: number;
}

export interface CookingStep {
  stepNumber: number;
  instruction: string;
  pullBefore?: string[];
  memberAnnotations?: {
    memberName: string;
    modification: string;
  }[];
  timerSeconds?: number;
}

export interface OneManyPlatesOutput {
  slot: string;
  base_dish_is_valid: boolean;
  parallel_dishes_needed: number;
  escalation_reason: string | null;
  escalation_solution: string | null;
  escalation?: ConflictEscalation;
  member_plates: ComputedMemberPlate[];
  pull_events: PullEvent[];
  harmony_deductions: HarmonyDeduction[];
  total_harmony_deduction: number;
  total_harmony_addition: number;
}

export type MemberModifierMap = Map<string, OneManyPlatesOutput>;

const ALLERGY_INGREDIENT_MAP: Record<string, string[]> = {
  peanuts: ["peanuts", "groundnut", "groundnut oil", "moongphali", "peanut butter", "peanut oil"],
  dairy: ["paneer", "ghee", "butter", "curd", "milk", "cheese", "cream", "dahi", "khoya", "mawa", "yogurt", "lassi", "buttermilk", "chaach", "whey"],
  gluten: ["atta", "maida", "suji", "wheat", "semolina", "roti", "chapati", "naan", "bread", "pasta", "seitan", "barley"],
  tree_nuts: ["almonds", "badam", "cashews", "kaju", "walnuts", "akhrot", "pistachios", "pista", "hazelnuts"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "jhinga", "oyster", "mussel"],
  soy: ["soya", "tofu", "soy sauce", "soy milk", "edamame", "soya chunks", "nutrela"],
  sesame: ["til", "sesame", "tahini", "gingelly"],
  none: [],
};

const RELIGIOUS_FORBIDDEN_MAP: Record<string, string[]> = {
  no_beef: ["beef", "buffalo meat"],
  no_pork: ["pork", "ham", "bacon"],
  sattvic_no_onion_garlic: ["onion", "garlic", "leek", "shallot", "chives"],
  jain_rules: ["onion", "garlic", "potato", "carrot", "beetroot", "radish", "turnip", "sweet potato", "yam", "ginger", "turmeric root"],
  none: [],
};

const JAIN_ROOT_VEGETABLES = ["potato", "carrot", "beetroot", "radish", "turnip", "sweet potato", "yam", "ginger", "turmeric root", "onion", "garlic"];

const HIGH_POTASSIUM_FOODS = ["rajma", "kidney beans", "banana", "potato", "sweet potato", "tomato", "spinach", "palak", "orange", "coconut water", "dates", "raisins"];
const HIGH_PHOSPHORUS_FOODS = ["rajma", "kidney beans", "paneer", "cheese", "cola", "processed meat", "organ meat"];
const HIGH_GI_FOODS = ["white rice", "basmati rice", "potato", "maida", "bread", "sugar", "sabudana", "corn flakes"];
const NON_VEG_INGREDIENTS = ["chicken", "mutton", "fish", "prawn", "shrimp", "egg", "meat", "pork", "beef", "lamb", "crab", "lobster", "keema"];

interface TestRecipeInput {
  name: string;
  region?: string;
  ingredients?: string[];
  isNonVeg?: boolean;
  containsDairy?: boolean;
  containsGluten?: boolean;
  containsOnionGarlic?: boolean;
  containsRootVegetables?: boolean;
  highGI?: boolean;
  highPotassium?: boolean;
  highPhosphorus?: boolean;
  highSodium?: boolean;
  estimatedSodiumMg?: number;
  estimatedCalories?: number;
  estimatedProteinG?: number;
  estimatedCarbsG?: number;
  estimatedFatG?: number;
  estimatedIronMg?: number;
}

interface TestMemberInput {
  name: string;
  age: number;
  gender?: "male" | "female" | "other";
  conditions?: string[];
  medications?: { drug: string; timing: string; notes?: string }[];
  dietaryType?: string;
  allergies?: string[];
  religiousRules?: string;
  goal?: string;
  goalPace?: string | null;
  fastingType?: string;
  ingredientDislikes?: string[];
  spiceTolerance?: string;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: string;
  dailyCalorieTarget?: number;
}

function inferRecipeProperties(recipe: TestRecipeInput): TestRecipeInput {
  const nameLower = recipe.name.toLowerCase();
  const ingredients = (recipe.ingredients || []).map(i => i.toLowerCase());
  const allText = `${nameLower} ${ingredients.join(" ")}`;

  if (recipe.isNonVeg === undefined) {
    recipe.isNonVeg = NON_VEG_INGREDIENTS.some(nv => allText.includes(nv));
  }
  if (recipe.containsDairy === undefined) {
    recipe.containsDairy = ["paneer", "ghee", "butter", "curd", "milk", "cream", "raita", "dahi", "lassi", "makhani"].some(d => allText.includes(d));
  }
  if (recipe.containsGluten === undefined) {
    recipe.containsGluten = ["roti", "chapati", "naan", "paratha", "bread", "atta", "maida", "suji"].some(g => allText.includes(g));
  }
  if (recipe.containsOnionGarlic === undefined) {
    recipe.containsOnionGarlic = ["onion", "garlic", "pyaz", "lehsun"].some(o => allText.includes(o));
  }
  if (recipe.containsRootVegetables === undefined) {
    recipe.containsRootVegetables = JAIN_ROOT_VEGETABLES.some(r => allText.includes(r));
  }
  if (recipe.highGI === undefined) {
    recipe.highGI = HIGH_GI_FOODS.some(g => allText.includes(g));
  }
  if (recipe.highPotassium === undefined) {
    recipe.highPotassium = HIGH_POTASSIUM_FOODS.some(k => allText.includes(k));
  }
  if (recipe.highPhosphorus === undefined) {
    recipe.highPhosphorus = HIGH_PHOSPHORUS_FOODS.some(p => allText.includes(p));
  }
  if (recipe.highSodium === undefined) {
    recipe.highSodium = ["papad", "pickle", "achaar", "biryani"].some(s => allText.includes(s));
  }

  return recipe;
}

function getDefaultCalorieTarget(member: TestMemberInput): number {
  if (member.dailyCalorieTarget) return member.dailyCalorieTarget;
  const age = member.age;
  const gender = member.gender || "male";

  if (age < 1) return 650;
  if (age < 4) return 1060;
  if (age < 7) return 1350;
  if (age < 10) return 1690;
  if (age < 13) return 2190;
  if (age < 16) return 2450;
  if (age < 18) return 2640;

  const weight = member.weightKg || (gender === "male" ? 70 : 55);
  const height = member.heightCm || (gender === "male" ? 170 : 160);
  const bmr = gender === "male"
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const actMultiplier: Record<string, number> = {
    sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55, very_active: 1.725,
  };
  const tdee = Math.round(bmr * (actMultiplier[member.activityLevel || "lightly_active"] || 1.375));

  const goal = member.goal || "maintain";
  if (goal === "weight_loss") return Math.max(tdee - 550, 1200);
  if (goal === "weight_gain" || goal === "build_muscle") return tdee + 300;
  if (goal === "senior_nutrition") return Math.round(tdee * 0.9);
  return tdee;
}

export function oneManyPlates(
  mealSlot: "breakfast" | "lunch" | "dinner",
  baseRecipe: TestRecipeInput,
  members: TestMemberInput[],
  medicalLaws?: any[],
  pantryInventory?: PantryItem[],
  customSlotWeights?: { breakfast: number; lunch: number; dinner: number },
): OneManyPlatesOutput {
  const recipe = inferRecipeProperties({ ...baseRecipe });

  const defaultWeights: Record<string, number> = { breakfast: 0.28, lunch: 0.36, dinner: 0.36 };
  const slotWeights = customSlotWeights || defaultWeights;
  const slotWeight = slotWeights[mealSlot] || defaultWeights[mealSlot];

  const memberPlates: ComputedMemberPlate[] = [];
  const pullEvents: PullEvent[] = [];
  const harmonyDeductions: HarmonyDeduction[] = [];
  let totalHarmonyDeduction = 0;
  let totalHarmonyAddition = 0;
  let baseDishIsValid = true;
  let escalationReason: string | null = null;
  let escalationSolution: string | null = null;
  let escalation: ConflictEscalation | undefined;
  let parallelDishesNeeded = 1;

  const hasNonVegMembers = members.some(m => (m.dietaryType || "").includes("non_veg"));
  const hasStrictVegMembers = members.some(m =>
    (m.dietaryType || "").includes("strictly_vegetarian") ||
    (m.dietaryType || "").includes("jain") ||
    (m.dietaryType || "").includes("Jain")
  );

  if (recipe.isNonVeg && hasStrictVegMembers) {
    baseDishIsValid = false;
    parallelDishesNeeded = 2;
    const vegMembers = members.filter(m =>
      (m.dietaryType || "").includes("strictly_vegetarian") ||
      (m.dietaryType || "").includes("jain") ||
      (m.dietaryType || "").includes("Jain")
    );
    const nonVegMembers = members.filter(m => !vegMembers.includes(m));
    escalationReason = `Non-vegetarian base dish (${recipe.name}) cannot be served to strictly vegetarian member(s): ${vegMembers.map(m => m.name).join(", ")}. Dietary conflict is unresolvable at base dish level.`;
    escalationSolution = `Two parallel preparations needed: (1) ${recipe.name} for ${nonVegMembers.map(m => m.name).join(", ")}, (2) Vegetable curry/dal using the same gravy base (before meat is added) for ${vegMembers.map(m => m.name).join(", ")}`;
    escalation = {
      reason: escalationReason,
      affectedMembers: vegMembers.map(m => m.name),
      proposedSolution: escalationSolution,
      parallelDishesNeeded: 2,
    };
    harmonyDeductions.push({ reason: "ConflictEscalation: non-veg vs strict-veg requires parallel dish", points: -5 });
    totalHarmonyDeduction += 5;
  }

  for (const member of members) {
    const conditions = member.conditions || [];
    const allergies = member.allergies || [];
    const medications = member.medications || [];
    const dietaryType = (member.dietaryType || "strictly_vegetarian").toLowerCase();
    const religiousRules = (member.religiousRules || "none").toLowerCase();
    const goal = member.goal || "maintain";
    const age = member.age;
    const gender = (member.gender || "male") as "male" | "female" | "other";
    const spiceTolerance = member.spiceTolerance || "medium";
    const weight = member.weightKg || (gender === "male" ? 70 : 55);

    const modifications: string[] = [];
    const additives: string[] = [];
    const withheld: string[] = [];
    const modified: string[] = [];
    const clinicalFlags: string[] = [];
    const warningFlags: string[] = [];
    let pullBeforeStep: number | null = null;
    let pullBeforeReason: string | null = null;
    let pullBeforeUrgency: "CRITICAL" | "RECOMMENDED" | null = null;
    let harmonyDeductionPoints = 0;
    let harmonyDeductionReason: string | null = null;

    const hardBlockedIngredients = new Set<string>();
    for (const allergy of allergies) {
      const blocked = ALLERGY_INGREDIENT_MAP[allergy] || [];
      blocked.forEach(i => hardBlockedIngredients.add(i));
    }

    const religiousKey = religiousRules.includes("jain") ? "jain_rules"
      : religiousRules.includes("sattvic") ? "sattvic_no_onion_garlic"
      : religiousRules.includes("no_beef") && religiousRules.includes("no_pork") ? "no_beef"
      : religiousRules.includes("no_beef") ? "no_beef"
      : religiousRules.includes("no_pork") ? "no_pork"
      : "none";
    const religiousForbidden = RELIGIOUS_FORBIDDEN_MAP[religiousKey] || [];
    religiousForbidden.forEach(i => hardBlockedIngredients.add(i));

    for (const med of medications) {
      const drugLower = med.drug.toLowerCase();
      if (drugLower.includes("iron") || drugLower.includes("ferrous")) {
        ["milk", "dairy", "calcium", "tea", "coffee", "antacid"].forEach(i => hardBlockedIngredients.add(i + " (within 2hr of iron)"));
      }
      if (drugLower.includes("warfarin")) {
        clinicalFlags.push(`WARFARIN: ${member.name} — keep Vitamin K intake consistent (spinach, methi, palak). Do not eliminate but do not suddenly increase.`);
      }
    }

    // ── STEP 1: HARD BLOCK DETECTION ──

    for (const allergy of allergies) {
      if (allergy === "none" || !allergy) continue;
      const blocked = ALLERGY_INGREDIENT_MAP[allergy] || [allergy];
      const recipeName = recipe.name.toLowerCase();

      if (allergy === "dairy" && recipe.containsDairy) {
        modifications.push(`ALLERGY CRITICAL: Pull ${member.name}'s portion BEFORE any dairy (ghee/paneer/curd/butter) is added. Serve dairy-free version.`);
        withheld.push(...blocked.filter(b => !withheld.includes(b)));
        if (pullBeforeStep === null || pullBeforeStep > 3) {
          pullBeforeStep = 3;
          pullBeforeReason = `${member.name} has dairy allergy — portion must be removed before ghee/paneer/butter is added`;
          pullBeforeUrgency = "CRITICAL";
        }
      } else if (allergy === "gluten" && recipe.containsGluten) {
        modifications.push(`ALLERGY CRITICAL: ${member.name} is gluten-free. Replace roti/atta with gluten-free alternative (jowar bhakri, rice, kuttu roti).`);
        withheld.push("atta", "maida", "suji", "wheat");
      } else if (allergy === "peanuts") {
        modifications.push(`ALLERGY CRITICAL: ${member.name} — absolutely NO peanuts/groundnut in any form. If raita/chutney contains peanuts, serve plain curd instead.`);
        withheld.push(...blocked.filter(b => !withheld.includes(b)));
      } else if (allergy === "shellfish") {
        modifications.push(`ALLERGY CRITICAL: ${member.name} — absolutely NO shellfish (prawn/shrimp/crab/lobster).`);
        withheld.push(...blocked.filter(b => !withheld.includes(b)));
      } else if (allergy !== "none") {
        modifications.push(`ALLERGY CRITICAL: ${member.name} — NO ${allergy} in any form.`);
        withheld.push(...blocked.filter(b => !withheld.includes(b)));
      }
    }

    const isJain = religiousKey === "jain_rules";
    const isSattvic = religiousKey === "sattvic_no_onion_garlic";

    if ((isJain || isSattvic) && recipe.containsOnionGarlic) {
      const ruleLabel = isJain ? "JAIN RULE" : "SATTVIC RULE";
      modifications.push(`${ruleLabel}: Pull ${member.name}'s portion BEFORE onion and garlic tempering step. Serve without any onion/garlic.`);
      withheld.push("onion", "garlic");
      if (pullBeforeStep === null || pullBeforeStep > 2) {
        pullBeforeStep = 2;
        pullBeforeReason = `${member.name} follows ${isJain ? "Jain" : "Sattvic"} diet — portion must be removed before onion/garlic tempering`;
        pullBeforeUrgency = "CRITICAL";
      }
      harmonyDeductionPoints += 2;
      harmonyDeductionReason = `${member.name}: ${ruleLabel} requires base dish restriction (pull-before at tempering)`;
      harmonyDeductions.push({ reason: `${ruleLabel} for ${member.name} — base dish restriction`, points: -2 });
      totalHarmonyDeduction += 2;
    }

    if (isJain && recipe.containsRootVegetables) {
      modifications.push(`JAIN RULE: ${member.name} — NO root vegetables (potato, carrot, beetroot, radish, ginger). Remove from their portion or substitute with gourd/pumpkin.`);
      JAIN_ROOT_VEGETABLES.forEach(v => { if (!withheld.includes(v)) withheld.push(v); });
    }

    if (dietaryType.includes("strictly_vegetarian") && recipe.isNonVeg) {
      modifications.push(`RELIGIOUS: Ensure no non-veg in ${member.name}'s plate — serve from the vegetarian preparation.`);
    }

    if (religiousKey === "no_beef") {
      modifications.push(`RELIGIOUS: ${member.name} — no beef in any form.`);
    }

    // ── STEP 2: PULL-BEFORE EVENTS ──

    if (pullBeforeStep !== null) {
      pullEvents.push({
        beforeStep: pullBeforeStep,
        memberNames: [member.name],
        reason: pullBeforeReason!,
        urgency: pullBeforeUrgency!,
      });
      modifications.push(`⏱️ PULL BEFORE STEP ${pullBeforeStep}: ${pullBeforeReason}`);
    }

    // ── STEP 3: QUANTITY MODIFIERS ──

    const hasDiabetes = conditions.some(c => c.toLowerCase().includes("diabetes") || c.toLowerCase().includes("type-2") || c.toLowerCase().includes("type_2"));
    const hasHypertension = conditions.some(c => c.toLowerCase().includes("hypertension"));
    const hasAnaemia = conditions.some(c => c.toLowerCase().includes("anaemia") || c.toLowerCase().includes("anemia"));
    const hasHighCholesterol = conditions.some(c => c.toLowerCase().includes("cholesterol"));
    const hasPCOS = conditions.some(c => c.toLowerCase().includes("pcos"));
    const hasKidneyIssues = conditions.some(c => c.toLowerCase().includes("kidney"));
    const hasObesity = conditions.some(c => c.toLowerCase().includes("obesity"));
    const hasHypothyroid = conditions.some(c => c.toLowerCase().includes("hypothyroid"));

    if (hasDiabetes) {
      if (recipe.highGI) {
        const recipeName = recipe.name.toLowerCase();
        if (recipeName.includes("rice") || recipeName.includes("chawal") || recipeName.includes("biryani")) {
          modifications.push(`DIABETES: Reduce ${member.name}'s rice to 100-150g (60% of standard portion). Prefer brown rice or substitute with jowar roti if available.`);
          modified.push("rice portion reduced to 60%");
        }
        if (recipeName.includes("sabudana")) {
          modifications.push(`⚠️ DIABETES + HIGH GI: Sabudana is high GI (~70). Limit ${member.name}'s portion to maximum 100g cooked. Add peanuts/kuttu roti on side to slow glucose absorption.`);
          warningFlags.push(`CRITICAL: Sabudana is HIGH GI (~70) — diabetic member ${member.name} must have limited portion (max 100g). Consider kuttu roti as lower-GI substitute.`);
          modified.push("sabudana portion limited to 100g");
        }
        if (recipeName.includes("potato") || recipeName.includes("aloo")) {
          modifications.push(`DIABETES: Reduce ${member.name}'s potato portion by 50%. Replace with cauliflower or lauki.`);
          modified.push("potato portion reduced 50%");
        }
      }
      modifications.push(`DIABETES: ${member.name} — use low-GI grains where possible. Avoid refined carbs (maida, white bread). Ensure protein at every meal.`);
      clinicalFlags.push(`DIABETES: ${member.name}'s plate must be low-GI. Limit total carbs to ${Math.round(getDefaultCalorieTarget(member) * slotWeight * 0.40 / 4)}g this meal.`);
    }

    if (hasHypertension) {
      modifications.push(`HYPERTENSION: ${member.name}'s portion — use HALF the salt called for in base recipe. Add lemon juice to compensate for flavour.`);
      modified.push("salt reduced to 50%");
      if (recipe.highSodium) {
        const recipeName = recipe.name.toLowerCase();
        if (recipeName.includes("papad")) {
          modifications.push(`HYPERTENSION: Remove papad from ${member.name}'s plate entirely (400-600mg sodium per piece).`);
          withheld.push("papad");
        }
        if (recipeName.includes("biryani")) {
          warningFlags.push(`SODIUM WARNING: Standard biryani serving contains ~900-1200mg sodium. ${member.name}'s daily cap is 1500mg. This single meal may exceed 50% of daily sodium allowance.`);
        }
      }
      if (pullBeforeStep === null && (recipe.estimatedSodiumMg || 0) > 500) {
        pullBeforeStep = 6;
        pullBeforeReason = `${member.name} has hypertension — portion should receive reduced salt`;
        pullBeforeUrgency = "RECOMMENDED";
      }
    }

    if (hasKidneyIssues) {
      if (recipe.highPotassium) {
        const recipeName = recipe.name.toLowerCase();
        if (recipeName.includes("rajma") || recipeName.includes("kidney bean")) {
          modifications.push(`⚠️ KIDNEY CRITICAL: Rajma (kidney beans) is HIGH in potassium and phosphorus — dangerous for kidney disease. Severely restrict ${member.name}'s rajma portion to maximum 50g cooked, or substitute with moong dal.`);
          warningFlags.push(`CRITICAL: Rajma is high potassium + phosphorus — kidney patient ${member.name} must have severely restricted portion (max 50g) or alternative protein.`);
          modified.push("rajma portion restricted to 50g max");
          harmonyDeductions.push({ reason: `Kidney-rajma conflict for ${member.name} — significant plate restriction`, points: -3 });
          totalHarmonyDeduction += 3;
        } else {
          modifications.push(`KIDNEY: Limit ${member.name}'s intake of high-potassium foods (potato, spinach, banana, tomato). Use low-potassium vegetables.`);
        }
      }
      modifications.push(`KIDNEY: ${member.name} — low sodium (max 400mg/meal), low phosphorus, controlled potassium. Avoid processed foods.`);
      withheld.push("papad");
      clinicalFlags.push(`KIDNEY DIET: ${member.name}'s plate must not exceed 400mg sodium, limited potassium and phosphorus.`);
    }

    if (hasHighCholesterol) {
      const recipeName = recipe.name.toLowerCase();
      if (recipeName.includes("chicken") || recipeName.includes("mutton")) {
        modifications.push(`CHOLESTEROL: ${member.name} — remove chicken skin before cooking. Use breast meat only. Trim all visible fat from mutton.`);
        modified.push("skin removed, lean cuts only");
      }
      if (recipeName.includes("papad") || recipeName.includes("fried")) {
        modifications.push(`CHOLESTEROL: ${member.name} — remove fried papad. Replace with roasted version if available.`);
        withheld.push("fried papad");
        additives.push("Roasted papad (instead of fried) for " + member.name);
      }
      modifications.push(`CHOLESTEROL: ${member.name} — minimize ghee/butter, prefer mustard oil. No fried accompaniments.`);
      if (recipeName.includes("rajma") || recipeName.includes("dal") || recipeName.includes("oats")) {
        clinicalFlags.push(`POSITIVE: ${recipe.name} is high-fibre — beneficial for ${member.name}'s cholesterol management.`);
      }
    }

    if (hasPCOS) {
      modifications.push(`PCOS: ${member.name} — no refined ingredients (maida, white sugar). Use whole grains. Anti-inflammatory spices (turmeric, cumin) encouraged.`);
      additives.push(`Half tsp ground flaxseed (alsi) sprinkled on ${member.name}'s plate for omega-3`);
      additives.push(`Extra turmeric and cumin in ${member.name}'s portion (anti-inflammatory for PCOS)`);
    }

    if (hasAnaemia) {
      additives.push(`Squeeze of lemon on ${member.name}'s plate (Vitamin C enhances iron absorption from the dal/sabzi)`);
      additives.push(`Sprinkle of til (sesame seeds) on ${member.name}'s plate if dish permits — iron source`);
      if (recipe.name.toLowerCase().includes("palak") || recipe.name.toLowerCase().includes("spinach")) {
        warningFlags.push(`IRON NOTE: Spinach/palak is high in iron BUT also contains oxalates that reduce iron absorption. Lemon juice squeeze (Vitamin C) on ${member.name}'s plate is essential to enhance bioavailability.`);
        clinicalFlags.push(`OXALATE WARNING: Palak contains oxalates that reduce iron absorption. Ensure lemon juice on ${member.name}'s plate.`);
      }
      if (recipe.name.toLowerCase().includes("rajma")) {
        clinicalFlags.push(`POSITIVE: Rajma is a good plant-based iron source — beneficial for ${member.name}'s anaemia. Pair with Vitamin C (lemon/tomato) for better absorption.`);
      }
    }

    if (hasObesity) {
      modifications.push(`OBESITY: ${member.name}'s portion — no ghee, no extra oil. Steam/grill separately if base is fried. Reduce portion to 75%.`);
      modified.push("portion reduced to 75%, no added fat");
    }

    for (const med of medications) {
      const drugLower = med.drug.toLowerCase();
      const timingLower = med.timing.toLowerCase();

      if (drugLower.includes("metformin")) {
        const timingHour = parseTimingHour(med.timing);
        if (mealSlot === "dinner" && timingHour !== null && timingHour >= 19 && timingHour <= 21) {
          modifications.push(`METFORMIN: ${member.name} takes Metformin at ${med.timing}. Dinner must contain substantial food (not light snack). Must be eaten WITH the medication.`);
          clinicalFlags.push(`METFORMIN TIMING: ${member.name}'s dinner must be timed to coincide with ${med.timing} medication. Meal must contain solid food.`);
        }
        if (mealSlot === "breakfast" && timingLower.includes("breakfast")) {
          modifications.push(`METFORMIN: ${member.name} takes Metformin with breakfast. Ensure substantial breakfast with solid food.`);
        }
        if (mealSlot === "lunch" && timingHour !== null && timingHour >= 12 && timingHour <= 14) {
          modifications.push(`METFORMIN: ${member.name} takes Metformin at ${med.timing}. Lunch must contain solid food and not be delayed past ${timingHour}:30.`);
          clinicalFlags.push(`METFORMIN TIMING: Lunch must not be delayed past ${timingHour}:30 for ${member.name}.`);
        }
      }

      if (drugLower.includes("iron") || drugLower.includes("ferrous")) {
        const timingHour = parseTimingHour(med.timing);
        if (timingHour !== null) {
          if (mealSlot === "dinner" && timingHour >= 20) {
            const latestDinner = timingHour - 1;
            warningFlags.push(`IRON TIMING: ${member.name}'s iron supplement at ${med.timing} — dinner must end by ${latestDinner}:00 (1-hour buffer for iron absorption on empty stomach).`);
            clinicalFlags.push(`MEAL TIMING RULE: ${member.name}'s dinner must end by ${latestDinner}:00 — iron supplement at ${med.timing} requires empty stomach.`);
          }
          if (mealSlot === "dinner" && timingHour >= 21) {
            warningFlags.push(`IRON TIMING: ${member.name}'s iron supplement at ${med.timing} — dinner must end by 20:00 (1-hour buffer).`);
          }
          if (recipe.containsDairy) {
            warningFlags.push(`IRON-DAIRY CONFLICT: Dairy (raita/paneer/curd) in ${member.name}'s meal may slightly interfere with iron absorption. Consider separating dairy intake from iron-rich foods.`);
          }
        }
      }

      if (drugLower.includes("amlodipine") || drugLower.includes("calcium channel")) {
        clinicalFlags.push(`AMLODIPINE: ${member.name} — no grapefruit in any form (juice, fruit, flavouring). Grapefruit increases plasma levels unpredictably.`);
        if (recipe.name.toLowerCase().includes("grapefruit")) {
          warningFlags.push(`CRITICAL DRUG INTERACTION: Grapefruit in recipe conflicts with ${member.name}'s Amlodipine medication.`);
          withheld.push("grapefruit");
        }
      }

      if (drugLower.includes("statin") || drugLower.includes("atorvastatin") || drugLower.includes("rosuvastatin")) {
        clinicalFlags.push(`STATIN: ${member.name} — no grapefruit in any form.`);
      }

      if (drugLower.includes("thyroid") || drugLower.includes("levothyroxine") || drugLower.includes("eltroxin") || drugLower.includes("thyroxine")) {
        if (mealSlot === "breakfast") {
          modifications.push(`THYROID: ${member.name}'s thyroid medication must be taken on empty stomach 30-60 min before breakfast. No soy, calcium, dairy, or coffee with breakfast.`);
          clinicalFlags.push(`THYROID TIMING: ${member.name} must take thyroid medication 30-60 min before breakfast. Avoid soy/calcium/dairy at breakfast.`);
        }
      }
    }

    // ── STEP 4: ADDITIVES ──

    if (goal === "build_muscle") {
      additives.push(`Extra dal/protein scoop on ${member.name}'s plate (protein boost for muscle building)`);
      if (!dietaryType.includes("vegetarian") && !dietaryType.includes("jain")) {
        additives.push(`Grilled chicken/egg on the side for ${member.name} if available (muscle building)`);
      }
      clinicalFlags.push(`HIGH PROTEIN: ${member.name} needs ${Math.round(weight * 2 * slotWeight)}g+ protein at this meal to meet muscle-building target.`);
    }

    if (goal === "weight_loss") {
      modifications.push(`WEIGHT LOSS: ${member.name} — reduced portion (75% of standard). No extra ghee/oil. Full protein, reduced carbs.`);
      modified.push("portion reduced to 75%, reduced carbs");
      const mealCals = Math.round(getDefaultCalorieTarget(member) * slotWeight);
      clinicalFlags.push(`CALORIE CONTROL: ${member.name}'s plate target ~${mealCals} kcal. This meal contributes to ${member.goalPace === "moderate_0.5kg" ? "550" : "275"} kcal/day deficit.`);
    }

    if (goal === "healthy_growth" && age >= 5 && age <= 12) {
      clinicalFlags.push(`GROWING CHILD: ${member.name} needs adequate protein and calcium for growth. Full portion of protein source.`);
    }

    if (age < 5) {
      modifications.push(`TEXTURE: Mash/blend ${member.name}'s portion separately. Reduce spice to zero. No whole nuts (choking hazard). Cut into small pieces.`);
      additives.push(`Ensure ${member.name}'s portion is soft, mashed consistency with no whole spices`);
      clinicalFlags.push(`INFANT/TODDLER SAFETY: ${member.name} (${age}y) — mashed/pureed texture, zero spice, no whole nuts.`);
    }

    if (age >= 60) {
      modifications.push(`SENIOR: ${member.name} — soft texture, low salt. Easily digestible portions.`);
      if (goal === "senior_nutrition" || goal === "no_specific_goal") {
        const calTarget = getDefaultCalorieTarget(member);
        if (calTarget < 1600) {
          additives.push(`Small portion of makhana or fortified cereal on side to help ${member.name} meet minimum calorie threshold`);
        }
      }
    }

    if (spiceTolerance === "mild") {
      modifications.push(`SPICE: ${member.name} — keep bland, no green chilli, minimal red chilli. Serve spicy condiments separately.`);
    } else if (spiceTolerance === "spicy") {
      additives.push(`Green chilli tadka / mirchi pickle on the side for ${member.name}`);
    }

    // ── STEP 5: MACRO TARGETS & ESTIMATED MACROS ──

    const dailyCal = getDefaultCalorieTarget(member);
    const mealCalories = Math.round(dailyCal * slotWeight);

    const isMuscle = goal === "build_muscle";
    const proteinPerKg = isMuscle ? 2.0 : 0.8;
    const dailyProtein = Math.round(weight * proteinPerKg);
    const mealProtein = Math.round(dailyProtein * slotWeight);

    const carbRatio = hasDiabetes ? 0.40 : 0.55;
    const mealCarbs = Math.round((mealCalories * carbRatio) / 4);
    const mealFat = Math.round((mealCalories * 0.25) / 9);

    let sodiumMax: number | null = null;
    if (hasHypertension) sodiumMax = 500;
    if (hasKidneyIssues) sodiumMax = sodiumMax !== null ? Math.min(sodiumMax, 400) : 400;
    if (sodiumMax === null && !hasHypertension && !hasKidneyIssues) sodiumMax = 667;

    if (sodiumMax !== null && sodiumMax <= 500) {
      clinicalFlags.push(`SODIUM CAP: ${member.name}'s plate must not exceed ${sodiumMax}mg sodium in this meal.`);
    }

    const recipeCalories = recipe.estimatedCalories || mealCalories;
    const recipeProtein = recipe.estimatedProteinG || mealProtein;
    const recipeCarbs = recipe.estimatedCarbsG || mealCarbs;
    const recipeFat = recipe.estimatedFatG || mealFat;
    const recipeSodium = recipe.estimatedSodiumMg || (hasHypertension ? 400 : 600);
    const recipeIron = recipe.estimatedIronMg;

    let adjustedCalories = recipeCalories;
    let adjustedProtein = recipeProtein;
    let adjustedCarbs = recipeCarbs;
    let adjustedFat = recipeFat;
    let adjustedSodium = recipeSodium;

    if (goal === "weight_loss") {
      adjustedCalories = Math.round(adjustedCalories * 0.75);
      adjustedCarbs = Math.round(adjustedCarbs * 0.70);
    }
    if (goal === "build_muscle") {
      adjustedProtein = Math.round(adjustedProtein * 1.3);
      adjustedCalories = Math.round(adjustedCalories * 1.1);
    }
    if (hasHypertension) {
      adjustedSodium = Math.round(adjustedSodium * 0.5);
    }
    if (hasKidneyIssues) {
      adjustedSodium = Math.min(adjustedSodium, 400);
    }
    if (age < 5) {
      adjustedCalories = Math.round(adjustedCalories * 0.5);
      adjustedProtein = Math.round(adjustedProtein * 0.5);
      adjustedCarbs = Math.round(adjustedCarbs * 0.5);
    }
    if (age >= 60 && goal !== "build_muscle") {
      adjustedCalories = Math.round(adjustedCalories * 0.85);
    }

    // ── STEP 6: FASTING REPLACEMENT ──

    const isFasting = (member.fastingType || "none").toLowerCase() !== "none";
    if (isFasting) {
      const festivalType = (member.fastingType || "").replace(/_/g, " ");
      modifications.push(`FASTING DAY: ${member.name} is observing ${festivalType}. Serve approved fasting foods only (sabudana, kuttu, singhara, sendha namak, fruits, makhana).`);
      clinicalFlags.push(`FASTING: ${member.name} — only ${festivalType} approved ingredients. No regular grains, onion, garlic.`);
    }

    if (!isFasting && members.some(m => (m.fastingType || "none").toLowerCase() !== "none")) {
      if (age < 12) {
        modifications.push(`NON-FASTING CHILD: ${member.name} is NOT fasting — provide regular child-appropriate dinner with adequate nutrition. Portion may be larger than fasting adults.`);
      }
    }

    // ── Build plate description ──

    let receives = `Standard portion of ${recipe.name}`;
    if (withheld.length > 0) {
      receives += ` WITHOUT ${[...new Set(withheld)].join(", ")}`;
    }
    if (additives.length > 0) {
      receives += `. PLUS: ${additives.join("; ")}`;
    }
    if (modified.length > 0) {
      receives += `. MODIFIED: ${modified.join("; ")}`;
    }

    memberPlates.push({
      member_id: member.name.toLowerCase().replace(/\s+/g, "_"),
      member_name: member.name,
      modifications,
      pull_before_step: pullBeforeStep,
      pull_before_reason: pullBeforeReason,
      pull_before_urgency: pullBeforeUrgency,
      additives,
      withheld: [...new Set(withheld)],
      modified,
      macro_targets: {
        calories: mealCalories,
        protein_g: mealProtein,
        carbs_g: mealCarbs,
        fat_g: mealFat,
        sodium_mg_max: sodiumMax,
        iron_mg: hasAnaemia ? Math.round(18 * slotWeight) : undefined,
      },
      estimated_macros: {
        calories: adjustedCalories,
        proteinG: adjustedProtein,
        carbsG: adjustedCarbs,
        fatG: adjustedFat,
        sodiumMg: adjustedSodium,
        ironMg: recipeIron,
      },
      clinical_flags: clinicalFlags,
      warning_flags: warningFlags,
      harmony_deduction_points: harmonyDeductionPoints,
      harmony_deduction_reason: harmonyDeductionReason,
    });
  }

  const mergedPullEvents: PullEvent[] = [];
  const pullMap = new Map<number, PullEvent>();
  for (const pe of pullEvents) {
    const existing = pullMap.get(pe.beforeStep);
    if (existing) {
      existing.memberNames.push(...pe.memberNames);
      existing.reason += ` | ${pe.reason}`;
      if (pe.urgency === "CRITICAL") existing.urgency = "CRITICAL";
    } else {
      pullMap.set(pe.beforeStep, { ...pe });
    }
  }
  for (const pe of pullMap.values()) {
    mergedPullEvents.push(pe);
  }
  mergedPullEvents.sort((a, b) => a.beforeStep - b.beforeStep);

  return {
    slot: mealSlot,
    base_dish_is_valid: baseDishIsValid,
    parallel_dishes_needed: parallelDishesNeeded,
    escalation_reason: escalationReason,
    escalation_solution: escalationSolution,
    escalation,
    member_plates: memberPlates,
    pull_events: mergedPullEvents,
    harmony_deductions: harmonyDeductions,
    total_harmony_deduction: totalHarmonyDeduction,
    total_harmony_addition: totalHarmonyAddition,
  };
}

export function buildMemberModifierMap(
  packet: ConstraintPacket,
  mealSlotWeight: { breakfast: number; lunch: number; dinner: number }
): MemberModifierMap {
  const map: MemberModifierMap = new Map();
  const slots: ("breakfast" | "lunch" | "dinner")[] = ["breakfast", "lunch", "dinner"];
  const days = 7;

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const activeFestival = packet.weeklyContext?.activeFestival || null;

  for (let day = 0; day < days; day++) {
    const dayName = dayNames[day];

    for (const slot of slots) {
      const key = `day${day}_${slot}`;
      const members: TestMemberInput[] = packet.effectiveProfiles.map(p => {
        const isFastingToday = p.effectiveFastingDays.includes(dayName.toLowerCase()) ||
          p.ekadashiThisWeek && dayName.toLowerCase() === "thursday" ||
          p.festivalFastThisWeek;

        let fastingType = "none";
        if (isFastingToday && activeFestival) {
          fastingType = activeFestival.replace(/\s+/g, "_") + "_full";
        } else if (isFastingToday) {
          fastingType = "regular_fast";
        }

        const medBundles = packet.medicationGuardrailBundles?.filter(
          b => b.memberId === p.id
        ) || [];
        const medications = p.activeMedications.map(m => {
          const bundle = medBundles.find(b =>
            b.medication.toLowerCase().includes(m.name.toLowerCase()) ||
            m.name.toLowerCase().includes(b.medication.toLowerCase())
          );
          return {
            drug: m.name,
            timing: m.timing,
            notes: bundle ? `${m.notes || ""} | Guardrail: ${JSON.stringify(bundle.slot_constraints || {})}` : m.notes,
          };
        });

        return {
          name: p.name,
          age: p.age,
          gender: p.gender,
          conditions: p.effectiveHealthConditions.filter(c => c !== "none"),
          medications,
          dietaryType: p.dietaryType,
          allergies: p.allergies.filter(a => a !== "none"),
          religiousRules: p.religiousCulturalRules?.type || "none",
          goal: p.effectiveGoal,
          goalPace: p.goalPace,
          fastingType,
          spiceTolerance: p.effectiveSpiceTolerance,
          ingredientDislikes: p.ingredientDislikes,
          heightCm: p.heightCm || undefined,
          weightKg: p.effectiveWeightKg,
          activityLevel: p.activityLevel,
          dailyCalorieTarget: p.dailyCalorieTarget
            ? Math.round(p.dailyCalorieTarget * mealSlotWeight[slot] / (slot === "breakfast" ? 0.28 : 0.36) * (slot === "breakfast" ? mealSlotWeight.breakfast / mealSlotWeight.breakfast : 1))
            : undefined,
        };
      });

      const hasNonVeg = members.some(m => m.dietaryType?.includes("non_veg"));
      const hasVeg = members.some(m =>
        m.dietaryType?.includes("strictly_vegetarian") ||
        m.dietaryType?.includes("jain") ||
        m.dietaryType?.includes("Jain")
      );
      const householdBaseline = packet.family.householdDietaryBaseline;
      const isNonVegBase = householdBaseline === "non_veg" && hasNonVeg;

      const genericRecipe: TestRecipeInput = {
        name: `Generic ${slot} dish`,
        containsOnionGarlic: true,
        containsDairy: true,
        isNonVeg: isNonVegBase && !hasVeg,
      };

      const output = oneManyPlates(slot, genericRecipe, members);
      map.set(key, output);
    }
  }

  return map;
}

export function buildModifierInjectionSection(
  modifierMap: MemberModifierMap,
): string {
  const lines: string[] = [
    "PRE-COMPUTED PLATE MODIFICATIONS — YOU MUST USE THESE EXACTLY.",
    "These modifications were computed deterministically by the clinical engine.",
    "Do NOT change, omit, or add clinical modifications of your own.",
    "Your job is to assign recipes and format these into the member_plates array.",
    "",
  ];

  for (const [key, output] of modifierMap.entries()) {
    lines.push(`[${key.toUpperCase()}]`);
    if (!output.base_dish_is_valid) {
      lines.push(
        `  ⚠️ CONFLICT ESCALATION: ${output.escalation_reason}`,
        `  SOLUTION: ${output.escalation_solution}`,
        `  Assign two parallel preparations. Use parallel_dish: true on the conflicted member's plate.`
      );
    }
    for (const plate of output.member_plates) {
      lines.push(`  ${plate.member_name} (${plate.member_id}):`);
      plate.modifications.forEach((m) => lines.push(`    - ${m}`));
      if (plate.additives.length > 0) {
        lines.push(`    ADDITIVES: ${plate.additives.join(" | ")}`);
      }
      if (plate.pull_before_step !== null) {
        lines.push(`    ⏱️ PULL BEFORE STEP ${plate.pull_before_step}: ${plate.pull_before_reason}`);
      }
      if (plate.clinical_flags.length > 0) {
        lines.push(`    ⚠️ FLAGS: ${plate.clinical_flags.join(" | ")}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function parseTimingHour(timing: string): number | null {
  const match24 = timing.match(/(\d{1,2}):(\d{2})/);
  if (match24) return parseInt(match24[1]);

  const matchPM = timing.match(/(\d{1,2})\s*(pm|PM)/);
  if (matchPM) {
    const h = parseInt(matchPM[1]);
    return h === 12 ? 12 : h + 12;
  }
  const matchAM = timing.match(/(\d{1,2})\s*(am|AM)/);
  if (matchAM) return parseInt(matchAM[1]);

  if (timing.toLowerCase().includes("night") || timing.toLowerCase().includes("dinner")) return 20;
  if (timing.toLowerCase().includes("morning") || timing.toLowerCase().includes("breakfast")) return 8;
  if (timing.toLowerCase().includes("afternoon") || timing.toLowerCase().includes("lunch")) return 13;

  return null;
}
