import type {
  Family,
  FamilyMember,
  MemberWeeklyContext,
  WeeklyContext,
  MonthlyBudget,
  EffectiveMemberProfile,
  ConstraintPacket,
  DetectedConflict,
  ResolvedConflict,
  HarmonyScoreBreakdown,
  HarmonyScoreDeduction,
  HarmonyScoreAddition,
  PantryItem,
  ConflictPriorityLevel,
  AllergyType,
  ActiveMedication,
  MedicationGuardrailBundle,
} from "./types";

import {
  applyAutoAssignmentRules,
  calculateDailyCalorieTarget,
  getMacroGuidanceString,
  buildFastingPreloadInstructions,
  resolveMedicationInteractions,
} from "./calorie-calculator";

import { resolveAllMedicationGuardrails } from "./lib/medicationRules";

const ALLERGY_INGREDIENT_MAP: Record<AllergyType, string[]> = {
  none: [],
  peanuts: [
    "peanuts", "groundnuts", "mungfali", "moongphali", "peanut oil",
    "groundnut oil", "peanut chutney", "sattu (if peanut-based)",
    "chikki (groundnut)", "peanut butter",
  ],
  dairy: [
    "milk", "doodh", "paneer", "curd", "dahi", "ghee", "butter", "cream",
    "malai", "khoya", "mawa", "cheese", "lassi", "raita", "rabri",
    "kheer", "shrikhand", "condensed milk", "buttermilk", "chaas",
  ],
  gluten: [
    "wheat", "atta", "maida", "suji", "semolina", "roti", "chapati",
    "paratha", "naan", "bread", "pasta", "noodles", "seviyan",
    "besan (trace gluten risk for celiac)", "daliya", "sooji halwa",
    "wheat bran", "whole wheat flour",
  ],
  tree_nuts: [
    "almonds", "badam", "cashews", "kaju", "walnuts", "akhrot",
    "pistachios", "pista", "hazelnuts", "pine nuts", "chestnut",
    "mixed dry fruits", "makhana (if co-processed)",
  ],
  shellfish: [
    "prawns", "jhinga", "shrimp", "crab", "lobster", "crayfish",
    "scallops", "oysters", "mussels", "kolambi",
  ],
  soy: [
    "soya chunks", "nutrela", "soya milk", "tofu", "soy sauce",
    "soya flour", "edamame", "tempeh", "miso", "soy protein",
  ],
  sesame: [
    "til", "sesame seeds", "tahini", "til chutney", "til ladoo",
    "gingelly oil", "til gajak", "til oil",
  ],
};

const RELIGIOUS_FORBIDDEN_MAP: Record<string, string[]> = {
  none: [],
  no_beef: ["beef", "veal", "beef broth", "ox tail", "beef tallow"],
  no_pork: ["pork", "bacon", "ham", "lard", "pork rinds", "prosciutto"],
  sattvic_no_onion_garlic: [
    "onion", "pyaz", "kanda", "garlic", "lehsun", "leek",
    "spring onion", "chives", "shallots",
  ],
  jain_rules: [
    "onion", "pyaz", "kanda", "garlic", "lehsun", "potato", "aloo",
    "carrot", "gajar", "radish", "mooli", "beetroot", "turnip", "shalgam",
    "spring onion", "leek", "shallots", "celeriac", "parsnip",
    "sweet potato", "shakarkand", "yam", "suran", "taro", "arbi",
    "eggplant", "brinjal", "baingan",
  ],
};

interface ConditionDietaryRule {
  forbidden_ingredients: string[];
  limit_ingredients: string[];
  mandatory_nutrients: string[];
  max_sodium_mg_per_day?: number;
  special_instructions: string;
}

const CONDITION_DIETARY_RULES: Record<string, ConditionDietaryRule> = {
  diabetes_type_2: {
    forbidden_ingredients: ["white sugar", "refined sugar", "maida", "packaged fruit juice"],
    limit_ingredients: [
      "white rice", "potato", "bread", "sweet fruits (mango, banana in excess)",
      "honey", "jaggery (small amounts only)", "mithai", "fried foods",
    ],
    mandatory_nutrients: ["fibre", "complex carbohydrates", "lean protein"],
    special_instructions:
      "LOW-GI MANDATE: Replace white rice with brown rice, jowar, or bajra. Replace maida with whole wheat atta. Include dal at every meal. Spread carbs across all meals — no single high-carb meals. No added sugar. Monitor glycaemic load.",
  },
  hypertension: {
    forbidden_ingredients: [
      "high-sodium pickles (achar)", "papads (high sodium)", "processed snacks",
      "readymade masala mixes", "salt substitutes (KCl)",
    ],
    limit_ingredients: [
      "salt", "namak", "sodium", "cheese", "canned foods",
      "salty snacks", "baking soda (bicarbonate of soda)",
    ],
    mandatory_nutrients: ["potassium", "magnesium", "calcium"],
    max_sodium_mg_per_day: 1500,
    special_instructions:
      "SODIUM LIMIT: ≤1500mg/day. Cook base dish with minimal salt. Use lemon juice, amchur, fresh coriander, and pudina for flavour. Include potassium-rich foods: banana, tomato, spinach, sweet potato. DASH-diet principles. Family adds their own salt at table.",
  },
  anaemia: {
    forbidden_ingredients: [],
    limit_ingredients: [
      "tea (at mealtimes)", "coffee (at mealtimes)",
      "calcium-rich foods within 2 hours of iron-rich meals",
    ],
    mandatory_nutrients: ["iron", "vitamin C", "folate", "vitamin B12"],
    special_instructions:
      "IRON ABSORPTION BOOST: Always pair iron-rich foods (palak, rajma, chana, green leafy sabzi) with Vitamin C sources (lemon juice, raw tomato, amla). Schedule tea/coffee at least 1 hour AFTER iron-rich meals. Include beetroot, dates, jaggery (small quantities). Fortified cereals where available.",
  },
  obesity: {
    forbidden_ingredients: ["deep fried foods", "mithai", "packaged snacks", "cold drinks"],
    limit_ingredients: [
      "ghee", "butter", "cooking oil", "rice (1 cup max)", "bread",
      "sugar", "maida", "full-fat dairy", "namkeen",
    ],
    mandatory_nutrients: ["fibre", "lean protein", "water-rich vegetables"],
    special_instructions:
      "CALORIE DENSITY: Steam, grill, or pressure-cook instead of frying. Minimal oil. Use moong dal, sprouted grains, cucumber, lauki, tinda as bulk foods. Large salad before lunch/dinner. Limit rice to one serving per meal.",
  },
  high_cholesterol: {
    forbidden_ingredients: [
      "vanaspati", "dalda", "margarine", "trans fats", "hydrogenated oil",
    ],
    limit_ingredients: [
      "ghee (≤1 tsp/day)", "butter", "full-fat dairy",
      "egg yolks (max 3/week)", "red meat", "coconut oil", "palm oil", "fried foods",
    ],
    mandatory_nutrients: ["soluble fibre", "omega-3 fatty acids", "plant sterols"],
    special_instructions:
      "CHOLESTEROL MANAGEMENT: Include oats, barley, rajma, and flaxseeds (alsi) for soluble fibre. Use mustard oil (small quantity) or olive oil. Avoid vanaspati entirely. For non-veg members: include fatty fish (rohu, surmai) or use flaxseeds for omega-3.",
  },
  hypothyroid: {
    forbidden_ingredients: [],
    limit_ingredients: [
      "raw cruciferous vegetables (cabbage, broccoli, cauliflower) in large amounts",
      "soy in excess", "millet in large excess",
    ],
    mandatory_nutrients: ["iodine", "selenium", "zinc"],
    special_instructions:
      "THYROID SUPPORT: Cook cruciferous vegetables — never serve raw. Iodised salt is mandatory. Include Brazil nuts (selenium) or pumpkin seeds (zinc). Avoid soy-heavy meals. If on Levothyroxine, calcium-rich meals must be spaced ≥4 hours from medication.",
  },
  pcos: {
    forbidden_ingredients: ["white sugar", "refined sugar", "maida"],
    limit_ingredients: [
      "white rice", "bread", "potato", "sweet fruits in excess",
      "full-fat dairy", "fried foods", "packaged foods",
    ],
    mandatory_nutrients: ["fibre", "omega-3 fatty acids", "magnesium", "antioxidants"],
    special_instructions:
      "PCOS ANTI-INFLAMMATORY DIET: Strict low-GI. Include flaxseeds, berries (when seasonal), turmeric, green leafy vegetables. Avoid inflammatory refined carbs and added sugar. Include spearmint (pudina) — 2 cups/day may support hormonal balance.",
  },
  kidney_issues: {
    forbidden_ingredients: [],
    limit_ingredients: [
      "high-potassium foods (banana, potato, tomato, orange juice, coconut water)",
      "high-phosphorus foods (dairy in excess, nuts, whole grains, dark colas)",
      "high-protein foods (if in later-stage renal disease)",
      "salt", "sodium", "potassium supplements",
    ],
    mandatory_nutrients: ["controlled protein", "low potassium", "low phosphorus"],
    special_instructions:
      "CRITICAL KIDNEY PROTOCOL: Protein limit 0.6–0.8g/kg body weight/day. Avoid high-potassium vegetables unless boiled and water discarded. Limit phosphorus: reduce dairy, nuts, and whole-grain excess. Strict sodium control. NEVER use potassium-chloride salt substitutes.",
  },
};

export function buildEffectiveProfiles(
  members: FamilyMember[],
  weeklyContexts: MemberWeeklyContext[]
): EffectiveMemberProfile[] {
  const weeklyCtxMap = new Map<string, MemberWeeklyContext>(
    weeklyContexts.map((wc) => [wc.familyMemberId, wc])
  );

  return members.map((member): EffectiveMemberProfile => {
    const weekly = weeklyCtxMap.get(member.id);
    const autoAssign = applyAutoAssignmentRules(member.age, member.primaryGoal);

    let effectiveGoal = autoAssign.effective_goal;
    if (weekly?.currentGoalOverride && !autoAssign.goal_locked) {
      effectiveGoal = weekly.currentGoalOverride;
    }

    const effectiveWeightKg =
      weekly?.currentWeightKg ?? member.weightKg ?? 0;

    const effectiveHealthConditions: string[] =
      weekly?.healthConditionsOverride ?? member.healthConditions ?? [];

    const effectiveSpiceTolerance =
      weekly?.spiceToleranceOverride ?? member.spiceTolerance;

    const profileFastingDays = (member.fastingConfig?.weekly_days ?? []).map((d) =>
      d.toLowerCase()
    );
    const weeklyFastingDays = (weekly?.fastingDaysThisWeek ?? []).map((d) =>
      d.toLowerCase()
    );
    const effectiveFastingDays = [
      ...new Set([...profileFastingDays, ...weeklyFastingDays]),
    ];

    const tiffinNeeded =
      (weekly?.tiffinNeededOverride as any) ?? member.tiffinNeeded ?? "no";

    const calorieResult = calculateDailyCalorieTarget({
      age: member.age,
      gender: member.gender,
      heightCm: member.heightCm,
      weightKg: effectiveWeightKg > 0 ? effectiveWeightKg : null,
      activityLevel: member.activityLevel,
      primaryGoal: effectiveGoal,
      goalPace: member.goalPace,
    });
    const dailyCalorieTarget = calorieResult.daily_calorie_target;

    return {
      id: member.id,
      name: member.name,
      age: member.age,
      gender: member.gender,
      heightCm: member.heightCm,
      effectiveWeightKg,
      activityLevel: member.activityLevel,
      displayOrder: member.displayOrder,
      dietaryType: member.dietaryType,
      religiousCulturalRules: member.religiousCulturalRules ?? { type: "none", details: [] },
      allergies: (member.allergies ?? []) as AllergyType[],
      ingredientDislikes: member.ingredientDislikes ?? [],
      occasionalNonvegConfig: member.occasionalNonvegConfig,
      effectiveGoal,
      goalPace: member.goalPace,
      effectiveHealthConditions,
      effectiveSpiceTolerance,
      effectiveFastingDays,
      ekadashiThisWeek: weekly?.ekadashiThisWeek ?? false,
      festivalFastThisWeek: weekly?.festivalFastThisWeek ?? false,
      activeMedications: (weekly?.activeMedications ?? []) as ActiveMedication[],
      feelingThisWeek: weekly?.feelingThisWeek ?? null,
      nonvegDaysThisWeek: weekly?.nonvegDaysThisWeek ?? [],
      nonvegTypesThisWeek: weekly?.nonvegTypesThisWeek ?? [],
      tiffinNeeded,
      dailyCalorieTarget,
      isChildUnder5: autoAssign.is_child_under5,
      isSchoolAge: autoAssign.is_school_age,
      isTeen: autoAssign.is_teen,
      isSenior: autoAssign.is_senior,
    };
  });
}

interface ConflictDetectorResult {
  conflicts: DetectedConflict[];
  deductions: HarmonyScoreDeduction[];
}

function detectConflicts(profiles: EffectiveMemberProfile[]): ConflictDetectorResult {
  const conflicts: DetectedConflict[] = [];
  const deductions: HarmonyScoreDeduction[] = [];

  for (const p of profiles) {
    for (const allergy of p.allergies) {
      if (allergy === "none") continue;

      if (allergy === "dairy") {
        const vegMembers = profiles.filter(
          (o) =>
            o.id !== p.id &&
            (o.dietaryType === "strictly_vegetarian" || o.dietaryType === "jain_vegetarian")
        );
        if (vegMembers.length > 0) {
          conflicts.push({
            member_ids: [p.id, ...vegMembers.map((v) => v.id)],
            member_names: [p.name, ...vegMembers.map((v) => v.name)],
            description:
              `${p.name} has a dairy allergy, but ${vegMembers.map((v) => v.name).join(", ")} ` +
              `follow vegetarian diets relying heavily on dairy (paneer, curd, ghee). ` +
              `Base dishes must be completely dairy-free.`,
            priority_level: 1,
          });
          deductions.push({
            reason: `${p.name}: Dairy allergy — restricts majority of Indian vegetarian staples`,
            points: -5,
          });
        } else {
          conflicts.push({
            member_ids: [p.id],
            member_names: [p.name],
            description: `${p.name} has a dairy allergy. All milk, paneer, ghee, curd, and butter must be removed.`,
            priority_level: 1,
          });
          deductions.push({ reason: `${p.name}: Dairy allergy`, points: -5 });
        }
      }

      if (allergy === "gluten") {
        conflicts.push({
          member_ids: [p.id],
          member_names: [p.name],
          description:
            `${p.name} has a gluten allergy. All wheat-based items (roti, paratha, maida, naan) ` +
            `must be replaced with jowar, bajra, or rice-based alternatives.`,
          priority_level: 1,
        });
        deductions.push({ reason: `${p.name}: Gluten allergy — eliminates wheat roti`, points: -5 });
      }

      if (allergy === "peanuts") {
        conflicts.push({
          member_ids: [p.id],
          member_names: [p.name],
          description: `${p.name} has a peanut allergy. No peanuts, groundnut oil, or peanut-based chutneys.`,
          priority_level: 1,
        });
        deductions.push({ reason: `${p.name}: Peanut allergy`, points: -3 });
      }

      if (allergy === "soy") {
        conflicts.push({
          member_ids: [p.id],
          member_names: [p.name],
          description: `${p.name} has a soy allergy. No soya chunks, tofu, or soy-based protein.`,
          priority_level: 1,
        });
        deductions.push({ reason: `${p.name}: Soy allergy`, points: -3 });
      }

      if (allergy === "tree_nuts") {
        conflicts.push({
          member_ids: [p.id],
          member_names: [p.name],
          description: `${p.name} has a tree nut allergy. No almonds, cashews, walnuts, or pistachios in any form.`,
          priority_level: 1,
        });
        deductions.push({ reason: `${p.name}: Tree nut allergy`, points: -3 });
      }
    }
  }

  const jainMembers = profiles.filter((p) => p.dietaryType === "jain_vegetarian");
  const nonVegMembers = profiles.filter(
    (p) => p.dietaryType === "non_vegetarian" || p.dietaryType === "occasional_non_veg"
  );
  const sattvicMembers = profiles.filter(
    (p) => p.religiousCulturalRules?.type === "sattvic_no_onion_garlic"
  );

  if (jainMembers.length > 0 && nonVegMembers.length > 0) {
    conflicts.push({
      member_ids: [...jainMembers.map((p) => p.id), ...nonVegMembers.map((p) => p.id)],
      member_names: [...jainMembers.map((p) => p.name), ...nonVegMembers.map((p) => p.name)],
      description:
        `Jain member(s) (${jainMembers.map((p) => p.name).join(", ")}) cannot share base dishes ` +
        `with non-veg cooking (${nonVegMembers.map((p) => p.name).join(", ")}). ` +
        `Base dish must be fully Jain-compliant (no root vegetables). Non-veg served as a completely separate preparation.`,
      priority_level: 2,
    });
    deductions.push({ reason: "Jain-NonVeg household conflict — base dish restricted to Jain standards", points: -5 });
  }

  if (sattvicMembers.length > 0 && sattvicMembers.length < profiles.length) {
    const nonSattvic = profiles.filter(
      (p) => p.religiousCulturalRules?.type !== "sattvic_no_onion_garlic"
    );
    conflicts.push({
      member_ids: [...sattvicMembers.map((p) => p.id), ...nonSattvic.map((p) => p.id)],
      member_names: [...sattvicMembers.map((p) => p.name), ...nonSattvic.map((p) => p.name)],
      description:
        `${sattvicMembers.map((p) => p.name).join(", ")} follow sattvic diet (no onion/garlic). ` +
        `Base dish must be cooked WITHOUT onion or garlic. ` +
        `Other members may have onion/garlic added as a separate tadka on their plate.`,
      priority_level: 2,
    });
    deductions.push({ reason: "Sattvic member — onion/garlic removed from base dish", points: -3 });
  }

  for (const p of profiles) {
    const ruleType = p.religiousCulturalRules?.type;
    if (ruleType !== "no_beef" && ruleType !== "no_pork") continue;
    const forbidden = ruleType === "no_beef" ? "beef" : "pork";
    const conflicting = profiles.filter(
      (o) => o.id !== p.id && o.nonvegTypesThisWeek.includes(forbidden)
    );
    if (conflicting.length > 0) {
      conflicts.push({
        member_ids: [p.id, ...conflicting.map((c) => c.id)],
        member_names: [p.name, ...conflicting.map((c) => c.name)],
        description:
          `Religious conflict: ${p.name} follows a ${ruleType} rule, but ${conflicting.map((c) => c.name).join(", ")} ` +
          `has requested ${forbidden}. ${forbidden.charAt(0).toUpperCase() + forbidden.slice(1)} is absolutely ` +
          `prohibited and will be removed from all meal options.`,
        priority_level: 2,
      });
      deductions.push({ reason: `${ruleType} conflict — ${forbidden} removed from all options`, points: -5 });
    }
  }

  for (const p of profiles) {
    if (p.activeMedications.length > 0) {
      for (const med of p.activeMedications) {
        conflicts.push({
          member_ids: [p.id],
          member_names: [p.name],
          description:
            `${p.name} is on ${med.name} (timing: ${med.timing}). ` +
            `Food-drug interactions resolved and injected into meal prompt.`,
          priority_level: 3,
        });
      }
    }
  }

  const diabeticMembers = profiles.filter((p) =>
    p.effectiveHealthConditions.includes("diabetes_type_2")
  );
  const highCalNeedMembers = profiles.filter(
    (p) =>
      p.effectiveGoal === "weight_gain" ||
      p.effectiveGoal === "build_muscle" ||
      p.isSchoolAge ||
      p.isChildUnder5
  );
  const kidneyMembers = profiles.filter((p) =>
    p.effectiveHealthConditions.includes("kidney_issues")
  );
  const hypertensionMembers = profiles.filter((p) =>
    p.effectiveHealthConditions.includes("hypertension")
  );
  const highProteinGoalMembers = profiles.filter(
    (p) => p.effectiveGoal === "build_muscle" || p.effectiveGoal === "weight_gain"
  );

  if (diabeticMembers.length > 0 && highCalNeedMembers.length > 0) {
    const dNames = diabeticMembers.map((p) => p.name);
    const hNames = highCalNeedMembers.map((p) => p.name);
    const dedupedHNames = hNames.filter((n) => !dNames.includes(n));
    if (dedupedHNames.length > 0) {
      conflicts.push({
        member_ids: [
          ...diabeticMembers.map((p) => p.id),
          ...highCalNeedMembers.filter((p) => !dNames.includes(p.name)).map((p) => p.id),
        ],
        member_names: [...dNames, ...dedupedHNames],
        description:
          `Clinical conflict: ${dNames.join(", ")} require low-GI, low-carb meals. ` +
          `${dedupedHNames.join(", ")} need high-calorie, energy-dense food. ` +
          `Resolution: Low-GI base dish + calorie-dense sides (ghee roti, sweet potato, nuts) ` +
          `served exclusively on ${dedupedHNames.join(", ")}'s plate.`,
        priority_level: 4,
      });
      deductions.push({ reason: "Diabetic/High-calorie conflict — low-GI base dish required", points: -2 });
    }
  }

  if (kidneyMembers.length > 0 && highProteinGoalMembers.length > 0) {
    const kNames = kidneyMembers.map((p) => p.name);
    const hpNames = highProteinGoalMembers.map((p) => p.name).filter((n) => !kNames.includes(n));
    if (hpNames.length > 0) {
      conflicts.push({
        member_ids: [
          ...kidneyMembers.map((p) => p.id),
          ...highProteinGoalMembers.filter((p) => !kNames.includes(p.name)).map((p) => p.id),
        ],
        member_names: [...kNames, ...hpNames],
        description:
          `Critical clinical conflict: ${kNames.join(", ")} have kidney disease requiring strict low-protein diet. ` +
          `${hpNames.join(", ")} need high protein for muscle/weight goals. ` +
          `Base dish must be low-protein. High-protein additions (paneer, extra dal, egg) ` +
          `added only to ${hpNames.join(", ")}'s plate.`,
        priority_level: 4,
      });
      deductions.push({ reason: "Kidney disease vs. muscle-build conflict — protein-restricted base", points: -5 });
    }
  }

  if (hypertensionMembers.length > 0) {
    const htnNames = hypertensionMembers.map((p) => p.name);
    if (hypertensionMembers.length < profiles.length) {
      conflicts.push({
        member_ids: hypertensionMembers.map((p) => p.id),
        member_names: htnNames,
        description:
          `${htnNames.join(", ")} require meals with ≤1500mg sodium/day. ` +
          `Base dish cooked with MINIMAL salt. Salt, papad, and pickle served SEPARATELY for other members.`,
        priority_level: 4,
      });
      deductions.push({ reason: `${htnNames.join(", ")}: Hypertension — low-sodium base dish`, points: -2 });
    }
  }

  const weightLossMembers = profiles.filter((p) => p.effectiveGoal === "weight_loss");
  const weightGainMembers = profiles.filter(
    (p) => p.effectiveGoal === "weight_gain" || p.effectiveGoal === "build_muscle"
  );

  if (weightLossMembers.length > 0 && weightGainMembers.length > 0) {
    const wlNames = weightLossMembers.map((p) => p.name);
    const wgNames = weightGainMembers.map((p) => p.name);
    const calSpread =
      Math.max(...profiles.map((p) => p.dailyCalorieTarget)) -
      Math.min(...profiles.map((p) => p.dailyCalorieTarget));
    conflicts.push({
      member_ids: [
        ...weightLossMembers.map((p) => p.id),
        ...weightGainMembers.map((p) => p.id),
      ],
      member_names: [...wlNames, ...wgNames],
      description:
        `Goal conflict: ${wlNames.join(", ")} are on a caloric deficit (weight loss), ` +
        `while ${wgNames.join(", ")} need a caloric surplus. ` +
        `Calorie spread: ${calSpread} kcal/day. ` +
        `Resolution: Calorie-moderate base dish. Dense additions (ghee, nuts, extra roti) ` +
        `served only to ${wgNames.join(", ")}.`,
      priority_level: 5,
    });
    deductions.push({ reason: "Weight-loss vs. weight-gain goal conflict", points: -2 });
  } else if (profiles.length > 1) {
    const calSpread =
      Math.max(...profiles.map((p) => p.dailyCalorieTarget)) -
      Math.min(...profiles.map((p) => p.dailyCalorieTarget));
    if (calSpread > 800) {
      const highCalMember = profiles.reduce((a, b) =>
        a.dailyCalorieTarget > b.dailyCalorieTarget ? a : b
      );
      const lowCalMember = profiles.reduce((a, b) =>
        a.dailyCalorieTarget < b.dailyCalorieTarget ? a : b
      );
      conflicts.push({
        member_ids: [highCalMember.id, lowCalMember.id],
        member_names: [highCalMember.name, lowCalMember.name],
        description:
          `Calorie spread of ${calSpread} kcal/day: ${highCalMember.name} (${highCalMember.dailyCalorieTarget} kcal) ` +
          `vs ${lowCalMember.name} (${lowCalMember.dailyCalorieTarget} kcal). ` +
          `Shared base dish with controlled portions. Calorie-dense additions only for ${highCalMember.name}.`,
        priority_level: 5,
      });
      deductions.push({ reason: `Calorie spread of ${calSpread} kcal — plate-level adjustment required`, points: -2 });
    }
  }

  const mildMembers = profiles.filter((p) => p.effectiveSpiceTolerance === "mild");
  const spicyMembers = profiles.filter((p) => p.effectiveSpiceTolerance === "spicy");

  if (mildMembers.length > 0 && spicyMembers.length > 0) {
    conflicts.push({
      member_ids: [...mildMembers.map((p) => p.id), ...spicyMembers.map((p) => p.id)],
      member_names: [...mildMembers.map((p) => p.name), ...spicyMembers.map((p) => p.name)],
      description:
        `Spice conflict: Base dish cooked MILD for ${mildMembers.map((p) => p.name).join(", ")}. ` +
        `${spicyMembers.map((p) => p.name).join(", ")} receive green chilli tadka / mirchi pickle as a separate side.`,
      priority_level: 6,
    });
    deductions.push({ reason: "Spice tolerance conflict — mild base dish required", points: -2 });
  }

  const allDislikes = profiles.flatMap((p) =>
    (p.ingredientDislikes ?? []).map((d) => d.toLowerCase())
  );
  const dislikeFreq = allDislikes.reduce<Record<string, number>>((acc, d) => {
    acc[d] = (acc[d] ?? 0) + 1;
    return acc;
  }, {});
  for (const [ingredient, count] of Object.entries(dislikeFreq)) {
    if (count >= Math.ceil(profiles.length * 0.6)) {
      deductions.push({
        reason: `Household dislike: "${ingredient}" excluded from all base dishes`,
        points: -1,
      });
    }
  }

  return { conflicts, deductions };
}

function resolveConflicts(
  conflicts: DetectedConflict[],
  profiles: EffectiveMemberProfile[]
): { resolutions: ResolvedConflict[]; additions: HarmonyScoreAddition[] } {
  const resolutions: ResolvedConflict[] = [];
  const additions: HarmonyScoreAddition[] = [];

  for (const conflict of conflicts) {
    switch (conflict.priority_level) {
      case 1:
        resolutions.push({
          description: conflict.description,
          resolution:
            "ABSOLUTE ALLERGY RULE ENFORCED: Allergen(s) completely eliminated from all shared base dishes and shared preparation surfaces. Separate preparation provided where applicable.",
          resolution_type: "base_dish_change",
        });
        break;

      case 2:
        resolutions.push({
          description: conflict.description,
          resolution:
            "ABSOLUTE RELIGIOUS/DIETARY RULE ENFORCED: Base dish cooked to the strictest dietary requirement (Jain / Sattvic / No-beef / No-pork). Other members' dietary additions served as separate plate-level modifications.",
          resolution_type: "base_dish_change",
        });
        break;

      case 3:
        resolutions.push({
          description: conflict.description,
          resolution:
            "MEDICATION WINDOW RESPECTED: Food-drug incompatible ingredients scheduled away from the affected meal slot. Medication timing tagged in plate instructions for the affected member.",
          resolution_type: "plate_modification",
        });
        additions.push({
          reason: `Medication absorption window correctly scheduled for ${conflict.member_names.join(", ")}`,
          points: 3,
        });
        break;

      case 4:
        resolutions.push({
          description: conflict.description,
          resolution:
            "CLINICAL CONSTRAINT RESOLVED via plate-level modification: One affordable base dish satisfies the most restrictive clinical requirement. Calorie-dense, high-protein, or high-sodium additions served exclusively on non-restricted member plates.",
          resolution_type: "plate_modification",
        });
        break;

      case 5:
        resolutions.push({
          description: conflict.description,
          resolution:
            "GOAL CONFLICT RESOLVED via portion and side-dish control: Base meal portion adjusted per-member. Calorie-modulating sides (extra roti, fortified milk, ghee, dry fruits) assigned exclusively to members who need them.",
          resolution_type: "plate_modification",
        });
        break;

      case 6:
        resolutions.push({
          description: conflict.description,
          resolution:
            "PREFERENCE CONFLICT RESOLVED: Base dish cooked at mild spice level. Spice-seeking members receive green chilli/tadka/pickle as a separate side. Majority-disliked ingredients avoided as primary components.",
          resolution_type: "plate_modification",
        });
        break;
    }
  }

  return { resolutions, additions };
}

function calculateHarmonyScore(
  deductions: HarmonyScoreDeduction[],
  additions: HarmonyScoreAddition[],
  conflicts: DetectedConflict[],
  resolutions: ResolvedConflict[],
  profiles: EffectiveMemberProfile[],
  pantryItems: PantryItem[],
  medicationBonus: number = 0
): HarmonyScoreBreakdown {
  let score = 100;

  const totalDeducted = deductions.reduce((sum, d) => sum + d.points, 0);
  score += totalDeducted;

  const perishableItems = pantryItems.filter((i) => i.is_perishable);
  const pantryAdditions: HarmonyScoreAddition[] = perishableItems
    .slice(0, 5)
    .map((item) => ({
      reason: `Pantry item "${item.name}" queued for zero-waste priority use this week`,
      points: 2,
    }));

  const medAdditions: HarmonyScoreAddition[] =
    medicationBonus > 0
      ? [
          {
            reason: `Food-drug absorption windows correctly scheduled for all active medications (+${medicationBonus} pts from medication rule engine)`,
            points: medicationBonus,
          },
        ]
      : [];

  const allAdditions = [...additions, ...pantryAdditions, ...medAdditions];
  const totalAdded = allAdditions.reduce((sum, a) => sum + a.points, 0);
  score += totalAdded;

  return {
    base: 100,
    deductions,
    additions: allAdditions,
    conflicts_detected: conflicts,
    conflicts_resolved: resolutions,
    final_score: Math.min(100, Math.max(0, score)),
  };
}

function buildNonvegDayMap(
  profiles: EffectiveMemberProfile[]
): Record<string, string[]> {
  const ALL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const result: Record<string, string[]> = {};

  for (const p of profiles) {
    if (p.dietaryType === "non_vegetarian") {
      result[p.id] =
        p.nonvegDaysThisWeek.length > 0 ? p.nonvegDaysThisWeek : ALL_DAYS;
    } else if (p.dietaryType === "occasional_non_veg") {
      if (p.nonvegDaysThisWeek.length > 0) {
        result[p.id] = p.nonvegDaysThisWeek;
      } else if (p.occasionalNonvegConfig?.days?.length) {
        result[p.id] = p.occasionalNonvegConfig.days;
      }
    }
  }
  return result;
}

interface MedicationResolutionResult {
  bundles: MedicationGuardrailBundle[];
  flatWarnings: string[];
  weeklyMonitorDirectives: string[];
  schedulingNotes: string[];
  totalHarmonyAddition: number;
}

function buildMedicationWarnings(
  profiles: EffectiveMemberProfile[]
): MedicationResolutionResult {
  const bundles: MedicationGuardrailBundle[] = [];
  const flatWarnings: string[] = [];
  const weeklyMonitorDirectives: string[] = [];
  const schedulingNotes: string[] = [];
  let totalHarmonyAddition = 0;

  for (const profile of profiles) {
    if (profile.activeMedications.length === 0) continue;

    const memberBundles = resolveAllMedicationGuardrails(
      profile.name,
      profile.activeMedications.map((m) => ({
        name: m.name,
        timing: m.timing,
        notes: m.notes,
      }))
    );

    for (const bundle of memberBundles) {
      bundles.push(bundle);
      flatWarnings.push(...bundle.directives);
      weeklyMonitorDirectives.push(...bundle.weekly_monitor_directives);
      schedulingNotes.push(...bundle.scheduling_notes);
      totalHarmonyAddition += bundle.harmony_score_addition;
    }
  }

  return {
    bundles,
    flatWarnings,
    weeklyMonitorDirectives,
    schedulingNotes,
    totalHarmonyAddition,
  };
}

export function runConflictEngine(params: {
  family: Family;
  members: FamilyMember[];
  memberWeeklyContexts: MemberWeeklyContext[];
  weeklyContext: WeeklyContext;
  budget: MonthlyBudget;
}): ConstraintPacket {
  const { family, members, memberWeeklyContexts, weeklyContext, budget } = params;

  const effectiveProfiles = buildEffectiveProfiles(members, memberWeeklyContexts);
  const { conflicts, deductions } = detectConflicts(effectiveProfiles);
  const { resolutions, additions } = resolveConflicts(conflicts, effectiveProfiles);

  const pantryZeroWasteItems = (weeklyContext.pantrySnapshot as PantryItem[]).filter(
    (i) => i.is_perishable
  );

  const fastingPreloadInstructions = buildFastingPreloadInstructions(effectiveProfiles);

  const medResult = buildMedicationWarnings(effectiveProfiles);

  const harmonyScore = calculateHarmonyScore(
    deductions,
    additions,
    conflicts,
    resolutions,
    effectiveProfiles,
    pantryZeroWasteItems,
    medResult.totalHarmonyAddition
  );

  const overrideBudget = weeklyContext.weeklyPerishableBudgetOverride;
  const effectiveDailyBudget = overrideBudget
    ? round2(overrideBudget / 7)
    : budget.dailyPerishableLimit;

  const nonvegDaysByMember = buildNonvegDayMap(effectiveProfiles);

  return {
    family,
    effectiveProfiles,
    budget,
    weeklyContext,
    harmonyScore,
    conflicts,
    resolutions,
    pantryZeroWasteItems,
    fastingPreloadInstructions,
    medicationWarnings: medResult.flatWarnings,
    medicationGuardrailBundles: medResult.bundles,
    medicationWeeklyMonitorDirectives: medResult.weeklyMonitorDirectives,
    medicationSchedulingNotes: medResult.schedulingNotes,
    medicationHarmonyAddition: medResult.totalHarmonyAddition,
    effectiveDailyBudget,
    nonvegDaysByMember,
  };
}

export { formatConflictSummaryForUI } from "./lib/harmonyScore";
export type { ConflictSummaryForUI } from "./lib/harmonyScore";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
