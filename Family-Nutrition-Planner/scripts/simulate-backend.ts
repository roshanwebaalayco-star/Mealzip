#!/usr/bin/env tsx
import { runConflictEngine } from "../artifacts/api-server/src/engine/conflict-engine.js";
import { runPromptChain } from "../artifacts/api-server/src/engine/prompt-chain.js";
import type {
  Family,
  FamilyMember,
  WeeklyContext,
  MemberWeeklyContext,
  MonthlyBudget,
  ConstraintPacket,
  DayPlan,
} from "../artifacts/api-server/src/engine/types.js";
import { localDb } from "@workspace/db";
import { recipesTable } from "@workspace/db";
import { eq, lte, and } from "drizzle-orm";

const SEP = "═".repeat(80);
const THIN = "─".repeat(80);

function uid(n: number): string {
  return `sim-member-${n}`;
}

const VARIATION_1_FAMILY: Family = {
  id: "sim-family-1",
  userId: "sim-user",
  name: "Sharma Parivar",
  stateRegion: "Delhi",
  languagePreference: "hindi",
  householdDietaryBaseline: "mixed",
  mealsPerDay: "3_meals",
  cookingSkillLevel: "intermediate",
  appliances: ["gas_stove", "pressure_cooker", "mixer_grinder"],
  pincode: null,
};

const VARIATION_1_MEMBERS: FamilyMember[] = [
  {
    id: uid(1),
    familyId: "sim-family-1",
    name: "Papa",
    age: 52,
    gender: "male",
    heightCm: 170,
    weightKg: 82,
    activityLevel: "sedentary",
    primaryGoal: "manage_condition",
    goalPace: null,
    dailyCalorieTarget: null,
    dietaryType: "non_vegetarian",
    spiceTolerance: "medium",
    tiffinNeeded: "no",
    festivalFastingAlerts: false,
    displayOrder: 0,
    healthConditions: ["diabetes_type_2"],
    allergies: ["none"],
    ingredientDislikes: [],
    religiousCulturalRules: { type: "no_beef", details: [] },
    occasionalNonvegConfig: null,
    fastingConfig: { type: "no_fasting", weekly_days: [], ekadashi: false, festival_alerts: false },
  },
  {
    id: uid(2),
    familyId: "sim-family-1",
    name: "Mama",
    age: 48,
    gender: "female",
    heightCm: 158,
    weightKg: 60,
    activityLevel: "lightly_active",
    primaryGoal: "manage_condition",
    goalPace: null,
    dailyCalorieTarget: null,
    dietaryType: "strictly_vegetarian",
    spiceTolerance: "medium",
    tiffinNeeded: "no",
    festivalFastingAlerts: false,
    displayOrder: 1,
    healthConditions: ["anaemia"],
    allergies: ["none"],
    ingredientDislikes: [],
    religiousCulturalRules: { type: "no_beef", details: [] },
    occasionalNonvegConfig: null,
    fastingConfig: { type: "no_fasting", weekly_days: [], ekadashi: false, festival_alerts: false },
  },
  {
    id: uid(3),
    familyId: "sim-family-1",
    name: "Dadi",
    age: 74,
    gender: "female",
    heightCm: 150,
    weightKg: 55,
    activityLevel: "sedentary",
    primaryGoal: "senior_nutrition",
    goalPace: null,
    dailyCalorieTarget: null,
    dietaryType: "jain_vegetarian",
    spiceTolerance: "mild",
    tiffinNeeded: "no",
    festivalFastingAlerts: true,
    displayOrder: 2,
    healthConditions: ["none"],
    allergies: ["none"],
    ingredientDislikes: [],
    religiousCulturalRules: { type: "jain_rules", details: [] },
    occasionalNonvegConfig: null,
    fastingConfig: { type: "no_fasting", weekly_days: [], ekadashi: false, festival_alerts: false },
  },
];

const VARIATION_1_WEEKLY_CTX: WeeklyContext = {
  id: "sim-wc-1",
  familyId: "sim-family-1",
  weekStartDate: "2026-04-06",
  eatingOutFrequency: "none",
  weekdayCookingTime: "20_40_mins",
  weekendCookingTime: "elaborate",
  weeklyPerishableBudgetOverride: null,
  specialRequest: null,
  status: "submitted",
  pantrySnapshot: [],
};

const VARIATION_1_MEMBER_CTX: MemberWeeklyContext[] = [
  {
    id: "sim-mwc-1",
    weeklyContextId: "sim-wc-1",
    familyMemberId: uid(1),
    currentGoalOverride: null,
    currentWeightKg: 82,
    feelingThisWeek: null,
    spiceToleranceOverride: null,
    tiffinNeededOverride: null,
    healthConditionsOverride: null,
    activeMedications: [{ name: "Metformin 500mg", timing: "morning with breakfast", notes: "" }],
    fastingDaysThisWeek: [],
    ekadashiThisWeek: false,
    festivalFastThisWeek: false,
    nonvegDaysThisWeek: [],
    nonvegTypesThisWeek: [],
  },
  {
    id: "sim-mwc-2",
    weeklyContextId: "sim-wc-1",
    familyMemberId: uid(2),
    currentGoalOverride: null,
    currentWeightKg: 60,
    feelingThisWeek: null,
    spiceToleranceOverride: null,
    tiffinNeededOverride: null,
    healthConditionsOverride: null,
    activeMedications: [{ name: "Ferrous Sulphate (Iron)", timing: "night after dinner", notes: "" }],
    fastingDaysThisWeek: [],
    ekadashiThisWeek: false,
    festivalFastThisWeek: false,
    nonvegDaysThisWeek: [],
    nonvegTypesThisWeek: [],
  },
  {
    id: "sim-mwc-3",
    weeklyContextId: "sim-wc-1",
    familyMemberId: uid(3),
    currentGoalOverride: null,
    currentWeightKg: 55,
    feelingThisWeek: null,
    spiceToleranceOverride: null,
    tiffinNeededOverride: null,
    healthConditionsOverride: null,
    activeMedications: [],
    fastingDaysThisWeek: [],
    ekadashiThisWeek: false,
    festivalFastThisWeek: false,
    nonvegDaysThisWeek: [],
    nonvegTypesThisWeek: [],
  },
];

const VARIATION_1_BUDGET: MonthlyBudget = {
  id: "sim-budget-1",
  familyId: "sim-family-1",
  monthYear: "2026-04",
  totalMonthlyBudget: 12000,
  staplesBudget: 4000,
  perishablesBudget: 6000,
  bufferBudget: 2000,
  dailyPerishableLimit: 200,
  regionalPriceSuggestion: null,
  budgetBreakdown: {
    breakfast_weight: 0.2,
    lunch_weight: 0.35,
    dinner_weight: 0.35,
    snack_weight: 0.1,
    daily_limits: { breakfast: 40, lunch: 70, dinner: 70, snack: 20 },
  },
};

const VARIATION_2_FAMILY: Family = {
  id: "sim-family-2",
  userId: "sim-user",
  name: "Iyer Family",
  stateRegion: "Tamil Nadu",
  languagePreference: "english",
  householdDietaryBaseline: "strictly_veg",
  mealsPerDay: "3_meals_snacks",
  cookingSkillLevel: "beginner",
  appliances: ["gas_stove", "pressure_cooker", "mixer_grinder", "microwave"],
  pincode: null,
};

const VARIATION_2_MEMBERS: FamilyMember[] = [
  {
    id: uid(4),
    familyId: "sim-family-2",
    name: "Amma",
    age: 34,
    gender: "female",
    heightCm: 160,
    weightKg: 62,
    activityLevel: "moderately_active",
    primaryGoal: "maintain",
    goalPace: null,
    dailyCalorieTarget: null,
    dietaryType: "strictly_vegetarian",
    spiceTolerance: "spicy",
    tiffinNeeded: "yes_office",
    festivalFastingAlerts: false,
    displayOrder: 0,
    healthConditions: ["none"],
    allergies: ["none"],
    ingredientDislikes: [],
    religiousCulturalRules: { type: "none", details: [] },
    occasionalNonvegConfig: null,
    fastingConfig: { type: "no_fasting", weekly_days: [], ekadashi: false, festival_alerts: false },
  },
  {
    id: uid(5),
    familyId: "sim-family-2",
    name: "Appa",
    age: 36,
    gender: "male",
    heightCm: 175,
    weightKg: 78,
    activityLevel: "moderately_active",
    primaryGoal: "maintain",
    goalPace: null,
    dailyCalorieTarget: null,
    dietaryType: "strictly_vegetarian",
    spiceTolerance: "spicy",
    tiffinNeeded: "yes_office",
    festivalFastingAlerts: false,
    displayOrder: 1,
    healthConditions: ["none"],
    allergies: ["none"],
    ingredientDislikes: [],
    religiousCulturalRules: { type: "none", details: [] },
    occasionalNonvegConfig: null,
    fastingConfig: { type: "no_fasting", weekly_days: [], ekadashi: false, festival_alerts: false },
  },
  {
    id: uid(6),
    familyId: "sim-family-2",
    name: "Arjun",
    age: 7,
    gender: "male",
    heightCm: 120,
    weightKg: 22,
    activityLevel: "very_active",
    primaryGoal: "healthy_growth",
    goalPace: null,
    dailyCalorieTarget: null,
    dietaryType: "strictly_vegetarian",
    spiceTolerance: "mild",
    tiffinNeeded: "yes_school",
    festivalFastingAlerts: false,
    displayOrder: 2,
    healthConditions: ["none"],
    allergies: ["peanuts"],
    ingredientDislikes: ["bitter gourd"],
    religiousCulturalRules: { type: "none", details: [] },
    occasionalNonvegConfig: null,
    fastingConfig: { type: "no_fasting", weekly_days: [], ekadashi: false, festival_alerts: false },
  },
];

const VARIATION_2_WEEKLY_CTX: WeeklyContext = {
  id: "sim-wc-2",
  familyId: "sim-family-2",
  weekStartDate: "2026-04-06",
  eatingOutFrequency: "none",
  weekdayCookingTime: "under_20_mins",
  weekendCookingTime: "no_preference",
  weeklyPerishableBudgetOverride: null,
  specialRequest: null,
  status: "submitted",
  pantrySnapshot: [],
};

const VARIATION_2_MEMBER_CTX: MemberWeeklyContext[] = [
  {
    id: "sim-mwc-4",
    weeklyContextId: "sim-wc-2",
    familyMemberId: uid(4),
    currentGoalOverride: null, currentWeightKg: 62, feelingThisWeek: null,
    spiceToleranceOverride: null, tiffinNeededOverride: null,
    healthConditionsOverride: null, activeMedications: [],
    fastingDaysThisWeek: [], ekadashiThisWeek: false, festivalFastThisWeek: false,
    nonvegDaysThisWeek: [], nonvegTypesThisWeek: [],
  },
  {
    id: "sim-mwc-5",
    weeklyContextId: "sim-wc-2",
    familyMemberId: uid(5),
    currentGoalOverride: null, currentWeightKg: 78, feelingThisWeek: null,
    spiceToleranceOverride: null, tiffinNeededOverride: null,
    healthConditionsOverride: null, activeMedications: [],
    fastingDaysThisWeek: [], ekadashiThisWeek: false, festivalFastThisWeek: false,
    nonvegDaysThisWeek: [], nonvegTypesThisWeek: [],
  },
  {
    id: "sim-mwc-6",
    weeklyContextId: "sim-wc-2",
    familyMemberId: uid(6),
    currentGoalOverride: null, currentWeightKg: 22, feelingThisWeek: null,
    spiceToleranceOverride: null, tiffinNeededOverride: null,
    healthConditionsOverride: null, activeMedications: [],
    fastingDaysThisWeek: [], ekadashiThisWeek: false, festivalFastThisWeek: false,
    nonvegDaysThisWeek: [], nonvegTypesThisWeek: [],
  },
];

const VARIATION_2_BUDGET: MonthlyBudget = {
  id: "sim-budget-2",
  familyId: "sim-family-2",
  monthYear: "2026-04",
  totalMonthlyBudget: 15000,
  staplesBudget: 5000,
  perishablesBudget: 7500,
  bufferBudget: 2500,
  dailyPerishableLimit: 250,
  regionalPriceSuggestion: null,
  budgetBreakdown: {
    breakfast_weight: 0.2,
    lunch_weight: 0.3,
    dinner_weight: 0.35,
    snack_weight: 0.15,
    daily_limits: { breakfast: 50, lunch: 75, dinner: 88, snack: 37 },
  },
};

const VARIATION_3_FAMILY: Family = {
  id: "sim-family-3",
  userId: "sim-user",
  name: "Desai Kutumb",
  stateRegion: "Maharashtra",
  languagePreference: "english",
  householdDietaryBaseline: "non_veg",
  mealsPerDay: "3_meals_snacks",
  cookingSkillLevel: "experienced",
  appliances: ["gas_stove", "pressure_cooker", "mixer_grinder", "oven", "air_fryer"],
  pincode: null,
};

const VARIATION_3_MEMBERS: FamilyMember[] = [
  {
    id: uid(7),
    familyId: "sim-family-3",
    name: "Rahul",
    age: 40,
    gender: "male",
    heightCm: 178,
    weightKg: 85,
    activityLevel: "moderately_active",
    primaryGoal: "weight_loss",
    goalPace: "moderate_0.5kg",
    dailyCalorieTarget: null,
    dietaryType: "non_vegetarian",
    spiceTolerance: "spicy",
    tiffinNeeded: "no",
    festivalFastingAlerts: false,
    displayOrder: 0,
    healthConditions: ["high_cholesterol"],
    allergies: ["none"],
    ingredientDislikes: [],
    religiousCulturalRules: { type: "no_beef", details: [] },
    occasionalNonvegConfig: null,
    fastingConfig: { type: "no_fasting", weekly_days: [], ekadashi: false, festival_alerts: false },
  },
  {
    id: uid(8),
    familyId: "sim-family-3",
    name: "Priya",
    age: 38,
    gender: "female",
    heightCm: 162,
    weightKg: 65,
    activityLevel: "lightly_active",
    primaryGoal: "maintain",
    goalPace: null,
    dailyCalorieTarget: null,
    dietaryType: "occasional_non_veg",
    spiceTolerance: "medium",
    tiffinNeeded: "yes_office",
    festivalFastingAlerts: false,
    displayOrder: 1,
    healthConditions: ["none"],
    allergies: ["none"],
    ingredientDislikes: [],
    religiousCulturalRules: { type: "no_beef", details: [] },
    occasionalNonvegConfig: { days: ["saturday", "sunday"], types: ["chicken", "fish"] },
    fastingConfig: { type: "no_fasting", weekly_days: [], ekadashi: false, festival_alerts: false },
  },
  {
    id: uid(9),
    familyId: "sim-family-3",
    name: "Veer",
    age: 14,
    gender: "male",
    heightCm: 165,
    weightKg: 50,
    activityLevel: "very_active",
    primaryGoal: "healthy_growth",
    goalPace: null,
    dailyCalorieTarget: null,
    dietaryType: "non_vegetarian",
    spiceTolerance: "spicy",
    tiffinNeeded: "yes_school",
    festivalFastingAlerts: false,
    displayOrder: 2,
    healthConditions: ["none"],
    allergies: ["none"],
    ingredientDislikes: ["lauki"],
    religiousCulturalRules: { type: "no_beef", details: [] },
    occasionalNonvegConfig: null,
    fastingConfig: { type: "no_fasting", weekly_days: [], ekadashi: false, festival_alerts: false },
  },
];

const VARIATION_3_WEEKLY_CTX: WeeklyContext = {
  id: "sim-wc-3",
  familyId: "sim-family-3",
  weekStartDate: "2026-04-06",
  eatingOutFrequency: "1_to_2_times",
  weekdayCookingTime: "20_40_mins",
  weekendCookingTime: "elaborate",
  weeklyPerishableBudgetOverride: null,
  specialRequest: "We are eating out Saturday dinner and Sunday lunch — skip those meal slots.",
  status: "submitted",
  pantrySnapshot: [
    { name: "Paneer", quantity: 200, unit: "grams", is_perishable: true },
    { name: "Spinach", quantity: 250, unit: "grams", is_perishable: true },
  ],
};

const VARIATION_3_MEMBER_CTX: MemberWeeklyContext[] = [
  {
    id: "sim-mwc-7",
    weeklyContextId: "sim-wc-3",
    familyMemberId: uid(7),
    currentGoalOverride: null, currentWeightKg: 85, feelingThisWeek: null,
    spiceToleranceOverride: null, tiffinNeededOverride: null,
    healthConditionsOverride: null, activeMedications: [],
    fastingDaysThisWeek: [], ekadashiThisWeek: false, festivalFastThisWeek: false,
    nonvegDaysThisWeek: ["saturday", "sunday", "wednesday"],
    nonvegTypesThisWeek: ["chicken", "fish"],
  },
  {
    id: "sim-mwc-8",
    weeklyContextId: "sim-wc-3",
    familyMemberId: uid(8),
    currentGoalOverride: null, currentWeightKg: 65, feelingThisWeek: null,
    spiceToleranceOverride: null, tiffinNeededOverride: null,
    healthConditionsOverride: null, activeMedications: [],
    fastingDaysThisWeek: [], ekadashiThisWeek: false, festivalFastThisWeek: false,
    nonvegDaysThisWeek: ["saturday", "sunday"],
    nonvegTypesThisWeek: ["chicken", "fish"],
  },
  {
    id: "sim-mwc-9",
    weeklyContextId: "sim-wc-3",
    familyMemberId: uid(9),
    currentGoalOverride: null, currentWeightKg: 50, feelingThisWeek: null,
    spiceToleranceOverride: null, tiffinNeededOverride: null,
    healthConditionsOverride: null, activeMedications: [],
    fastingDaysThisWeek: [], ekadashiThisWeek: false, festivalFastThisWeek: false,
    nonvegDaysThisWeek: ["saturday", "sunday", "wednesday"],
    nonvegTypesThisWeek: ["chicken", "fish", "eggs"],
  },
];

const VARIATION_3_BUDGET: MonthlyBudget = {
  id: "sim-budget-3",
  familyId: "sim-family-3",
  monthYear: "2026-04",
  totalMonthlyBudget: 18000,
  staplesBudget: 5500,
  perishablesBudget: 9000,
  bufferBudget: 3500,
  dailyPerishableLimit: 300,
  regionalPriceSuggestion: null,
  budgetBreakdown: {
    breakfast_weight: 0.2,
    lunch_weight: 0.3,
    dinner_weight: 0.35,
    snack_weight: 0.15,
    daily_limits: { breakfast: 60, lunch: 90, dinner: 105, snack: 45 },
  },
};

const STATE_TO_ZONE: Record<string, string> = {
  punjab: "north", haryana: "north", himachalpradesh: "north",
  uttarakhand: "north", up: "north", uttarpradesh: "north",
  delhi: "north", jammuandkashmir: "north",
  rajasthan: "west",
  gujarat: "west", maharashtra: "west", goa: "west",
  karnataka: "south", kerala: "south", tamilnadu: "south",
  andhrapradesh: "south", telangana: "south",
  westbengal: "east", odisha: "east", jharkhand: "east",
  assam: "east", manipur: "east", meghalaya: "east",
  madhyapradesh: "central", chhattisgarh: "central",
  bihar: "north",
};

function getZone(state: string): string {
  return STATE_TO_ZONE[state.toLowerCase().replace(/\s+/g, "")] || "north";
}

async function fetchCandidateRecipes(
  zone: string,
  dietBaseline: string,
  budgetPerServing: number,
  maxCookTimeMin: number | null,
): Promise<{ count: number; sampleNames: string[] }> {
  const conditions: Parameters<typeof and>[0][] = [];

  const dietMap: Record<string, string> = {
    strictly_veg: "vegetarian",
    veg_with_eggs: "eggetarian",
  };
  const dietFilter = dietMap[dietBaseline];
  if (dietFilter) {
    conditions.push(eq(recipesTable.diet, dietFilter));
  }
  if (budgetPerServing > 0) {
    conditions.push(lte(recipesTable.costPerServing, budgetPerServing * 1.5));
  }
  if (maxCookTimeMin !== null && maxCookTimeMin > 0) {
    conditions.push(lte(recipesTable.totalTimeMin, maxCookTimeMin));
  }

  const rows = await localDb
    .select({ id: recipesTable.id, name: recipesTable.name })
    .from(recipesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(120);

  return {
    count: rows.length,
    sampleNames: rows.slice(0, 10).map((r) => r.name),
  };
}

interface Variation {
  label: string;
  family: Family;
  members: FamilyMember[];
  weeklyContext: WeeklyContext;
  memberContexts: MemberWeeklyContext[];
  budget: MonthlyBudget;
}

const VARIATIONS: Variation[] = [
  {
    label: "VARIATION 1: The Clinical Nightmare (North Indian — Diabetes + Anaemia + Jain)",
    family: VARIATION_1_FAMILY,
    members: VARIATION_1_MEMBERS,
    weeklyContext: VARIATION_1_WEEKLY_CTX,
    memberContexts: VARIATION_1_MEMBER_CTX,
    budget: VARIATION_1_BUDGET,
  },
  {
    label: "VARIATION 2: The Working Parents (South Indian — Child Peanut Allergy, Quick Cooking)",
    family: VARIATION_2_FAMILY,
    members: VARIATION_2_MEMBERS,
    weeklyContext: VARIATION_2_WEEKLY_CTX,
    memberContexts: VARIATION_2_MEMBER_CTX,
    budget: VARIATION_2_BUDGET,
  },
  {
    label: "VARIATION 3: The Weekend Flex (West Indian/Pan-Indian — Eating Out + Elaborate Weekend)",
    family: VARIATION_3_FAMILY,
    members: VARIATION_3_MEMBERS,
    weeklyContext: VARIATION_3_WEEKLY_CTX,
    memberContexts: VARIATION_3_MEMBER_CTX,
    budget: VARIATION_3_BUDGET,
  },
];

function printConstraintPacket(packet: ConstraintPacket): void {
  const hs = packet.harmonyScore;
  console.log(`\n  ▸ Harmony Score: ${hs.final_score} / 100`);
  console.log(`    Base: ${hs.base}`);

  if (hs.deductions.length > 0) {
    console.log(`    Deductions (${hs.deductions.reduce((s, d) => s + d.points, 0)} pts):`);
    for (const d of hs.deductions) {
      console.log(`      ${d.points}  ${d.reason}`);
    }
  }
  if (hs.additions.length > 0) {
    console.log(`    Additions (+${hs.additions.reduce((s, a) => s + a.points, 0)} pts):`);
    for (const a of hs.additions) {
      console.log(`      +${a.points}  ${a.reason}`);
    }
  }

  console.log(`\n  ▸ Medical Laws / Guardrails Produced:`);
  if (packet.medicationGuardrailBundles.length > 0) {
    for (const b of packet.medicationGuardrailBundles) {
      console.log(`    [${b.member_name} — ${b.drug_id}]`);
      for (const d of b.directives) console.log(`      • ${d}`);
      for (const wm of b.weekly_monitor_directives) console.log(`      ⚠ Weekly: ${wm}`);
    }
  } else if (packet.medicationWarnings.length > 0) {
    for (const w of packet.medicationWarnings) console.log(`    • ${w}`);
  } else {
    console.log(`    (none — no active medications)`);
  }

  if (packet.conflicts.length > 0) {
    console.log(`\n  ▸ Detected Conflicts (${packet.conflicts.length}):`);
    for (const c of packet.conflicts) {
      console.log(`    [Level ${c.priority_level}] ${c.description.slice(0, 120)}${c.description.length > 120 ? "…" : ""}`);
    }
  }

  console.log(`\n  ▸ Effective Calorie Targets:`);
  for (const p of packet.effectiveProfiles) {
    console.log(`    ${p.name} (${p.age}y, ${p.gender}): ${p.dailyCalorieTarget} kcal/day — goal: ${p.effectiveGoal}`);
  }
}

function printMealSample(days: DayPlan[]): void {
  if (!days || days.length === 0) {
    console.log("  (no days returned)");
    return;
  }
  const day = days[0];
  console.log(`\n  ▸ Sample Day — ${day.day_name} (${day.date}):`);
  const slots = ["breakfast", "lunch", "dinner", "snack"] as const;
  for (const slot of slots) {
    const meal = day.meals[slot];
    if (!meal) continue;
    console.log(`    [${slot.toUpperCase()}] ${meal.name}  (₹${meal.estimated_cost})`);
    if (meal.member_plates && meal.member_plates.length > 0) {
      for (const plate of meal.member_plates) {
        const mods = plate.modifications?.length > 0 ? plate.modifications.join("; ") : "standard";
        const fasting = plate.fasting_replacement ? ` [FASTING: ${plate.fasting_replacement}]` : "";
        const tiffin = plate.tiffin_instructions ? ` [TIFFIN: ${plate.tiffin_instructions}]` : "";
        console.log(`      → ${plate.member_name}: ${mods}${fasting}${tiffin}`);
      }
    }
    if (meal.priority_flags?.length > 0) {
      console.log(`      flags: ${meal.priority_flags.join(", ")}`);
    }
  }
}

async function runVariation(v: Variation): Promise<void> {
  console.log(`\n${SEP}`);
  console.log(`  ${v.label}`);
  console.log(SEP);

  console.log(`\n${THIN}`);
  console.log("  STEP 1: Conflict Engine");
  console.log(THIN);

  const t1 = Date.now();
  const packet = runConflictEngine({
    family: v.family,
    members: v.members,
    memberWeeklyContexts: v.memberContexts,
    weeklyContext: v.weeklyContext,
    budget: v.budget,
  });
  const conflictMs = Date.now() - t1;
  console.log(`  ⏱ Conflict engine completed in ${conflictMs}ms`);
  printConstraintPacket(packet);

  console.log(`\n${THIN}`);
  console.log("  STEP 2: Candidate Recipes from Supabase");
  console.log(THIN);

  const zone = getZone(v.family.stateRegion);
  const maxCookTime = v.weeklyContext.weekdayCookingTime === "under_20_mins" ? 20 : null;
  const budgetPerServing = v.budget.dailyPerishableLimit / 3;

  const t2 = Date.now();
  const candidates = await fetchCandidateRecipes(
    zone,
    v.family.householdDietaryBaseline,
    budgetPerServing,
    maxCookTime,
  );
  const recipeMs = Date.now() - t2;

  console.log(`  ⏱ Recipe query completed in ${recipeMs}ms`);
  console.log(`  ▸ Candidate recipes returned: ${candidates.count}`);
  console.log(`  ▸ Sample names: ${candidates.sampleNames.join(", ")}`);

  console.log(`\n${THIN}`);
  console.log("  STEP 3: Gemini Prompt Chain (staples + 21-meal plan + buffer)");
  console.log(THIN);
  console.log("  ⏳ Calling Gemini (this takes 30-90 seconds)...");

  const t3 = Date.now();
  const { result, timings } = await runPromptChain(packet, v.weeklyContext.weekStartDate);
  const totalMs = Date.now() - t3;

  console.log(`  ⏱ Prompt chain completed in ${totalMs}ms`);
  console.log(`    Staples:  ${timings.staples_ms}ms — ${result.staples.length} items, ₹${result.staples_total_cost}`);
  console.log(`    Meals:    ${timings.meals_ms}ms — ${result.weeklyMealPlan.length} days`);
  console.log(`    Buffer:   ${timings.buffer_ms}ms — ${result.bufferItems.length} items, ₹${result.buffer_total_cost}`);
  console.log(`    Perishables: ${result.weeklyPerishables.length} items, ₹${result.weeklyPerishables_total_cost}`);

  printMealSample(result.weeklyMealPlan);

  console.log(`\n  ▸ Full 21-Meal Summary:`);
  for (const day of result.weeklyMealPlan) {
    const mealNames = (["breakfast", "lunch", "dinner", "snack"] as const)
      .map((s) => day.meals[s]?.name)
      .filter(Boolean)
      .join(" | ");
    console.log(`    ${day.day_name} (${day.date}): ${mealNames}`);
  }

  if (result.nutritional_summary && Object.keys(result.nutritional_summary).length > 0) {
    console.log(`\n  ▸ Nutritional Summary:`);
    for (const [id, ns] of Object.entries(result.nutritional_summary)) {
      console.log(`    ${ns.member_name}: avg ${ns.daily_avg_calories} kcal/day (target: ${ns.daily_target_calories}), protein: ${ns.weekly_protein_g}g/week`);
      if (ns.nutritional_debt?.length > 0) {
        console.log(`      debts: ${ns.nutritional_debt.join(", ")}`);
      }
    }
  }
}

async function main(): Promise<void> {
  console.log(SEP);
  console.log("  NutriNext ParivarSehat — Backend Pipeline Simulation");
  console.log("  Running 3 variations through the REAL engine");
  console.log(SEP);

  for (const v of VARIATIONS) {
    try {
      await runVariation(v);
    } catch (err) {
      console.error(`\n❌ VARIATION FAILED: ${v.label}`);
      console.error(err);
    }
  }

  console.log(`\n${SEP}`);
  console.log("  SIMULATION COMPLETE");
  console.log(SEP);

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
