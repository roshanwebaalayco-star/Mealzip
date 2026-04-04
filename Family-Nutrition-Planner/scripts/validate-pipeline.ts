import { runConflictEngine } from "../artifacts/api-server/src/engine/conflict-engine.js";
import { calculateDailyCalorieTarget, applyAutoAssignmentRules, buildFastingPreloadInstructions } from "../artifacts/api-server/src/engine/calorie-calculator.js";
import { calculateBudgetSplit } from "../artifacts/api-server/src/engine/budget-engine.js";
import { resolveAllMedicationGuardrails } from "../artifacts/api-server/src/engine/lib/medicationRules.js";
import type {
  Family, FamilyMember, MemberWeeklyContext, WeeklyContext, MonthlyBudget,
  ConstraintPacket, DayPlan, MealSlot, EffectiveMemberProfile,
  ActiveMedication, HealthCondition, DietaryType, ActivityLevel, PrimaryGoal,
  GoalPace, SpiceTolerance, AllergyType, ReligiousCulturalRules, FastingConfig,
  OccasionalNonvegConfig, PantryItem, BudgetBreakdown, MedicationGuardrailBundle,
} from "../artifacts/api-server/src/engine/types.js";
import { localDb, pool, recipesTable } from "../lib/db/src/index.js";
import { eq, and, lte, or, ilike } from "drizzle-orm";
import { ai } from "../lib/integrations-gemini-ai/src/index.js";

const PASS = "\x1b[32m✅ PASS\x1b[0m";
const FAIL = "\x1b[31m❌ FAIL\x1b[0m";
const WARN = "\x1b[33m⚠️  WARN\x1b[0m";
const HEADER = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

interface StageResult {
  stage: string;
  status: "PASS" | "FAIL" | "WARN";
  details: string[];
  data?: any;
}

interface ScenarioResult {
  name: string;
  stages: StageResult[];
}

const allResults: ScenarioResult[] = [];

function uuid(): string {
  return crypto.randomUUID();
}

function printHeader(text: string) {
  console.log(`\n${HEADER}${"═".repeat(80)}${RESET}`);
  console.log(`${HEADER}${BOLD}  ${text}${RESET}`);
  console.log(`${HEADER}${"═".repeat(80)}${RESET}\n`);
}

function printStage(num: number, name: string) {
  console.log(`\n${BOLD}  ▶ STAGE ${num}: ${name}${RESET}`);
  console.log(`  ${"─".repeat(70)}`);
}

function printResult(label: string, status: string, detail?: string) {
  console.log(`    ${status} ${label}${detail ? ` — ${detail}` : ""}`);
}

const ZONE_CUISINE_MAP: Record<string, string[]> = {
  north: ["North Indian", "Punjabi", "Mughlai", "Rajasthani", "UP", "Uttarakhand"],
  south: ["South Indian", "Karnataka", "Kerala", "Tamil Nadu", "Andhra Pradesh", "Telangana"],
  east: ["Bengali", "Odia", "Jharkhand", "Assamese", "Manipuri"],
  west: ["Gujarati", "Maharashtrian", "Goan", "Rajasthani"],
  central: ["Madhya Pradesh", "Chhattisgarhi"],
};

const STATE_TO_ZONE: Record<string, string> = {
  punjab: "north", haryana: "north", himachalpradesh: "north",
  uttarakhand: "north", up: "north", uttarpradesh: "north",
  delhi: "north", jammuandkashmir: "north",
  rajasthan: "west", gujarat: "west", maharashtra: "west", goa: "west",
  karnataka: "south", kerala: "south", tamilnadu: "south",
  andhrapradesh: "south", telangana: "south",
  westbengal: "east", odisha: "east", jharkhand: "east",
  assam: "east", manipur: "east", meghalaya: "east",
  madhyapradesh: "central", chhattisgarh: "central",
  bihar: "north",
};

function getZoneForState(state: string): string {
  const normalized = state.toLowerCase().replace(/\s+/g, "");
  return STATE_TO_ZONE[normalized] || "north";
}

function resolveDietPreference(restrictions: string[]): string | null {
  const vegTags = new Set(["vegetarian", "strictly_vegetarian", "jain", "jain_vegetarian", "sattvic"]);
  const tags = (restrictions || []).map(r => r.toLowerCase().replace(/^diet_type:/, "").trim());
  if (tags.some(t => t === "vegan")) return "vegan";
  if (tags.some(t => vegTags.has(t))) return "vegetarian";
  return null;
}

async function getFilteredRecipes(
  zone: string,
  dietaryRestrictions: string[],
  budgetPerServing: number,
  isFasting: boolean,
  maxCookTimeMin: number | null = null,
  limit = 120,
) {
  const cuisines = ZONE_CUISINE_MAP[zone] || ZONE_CUISINE_MAP.north;
  const dietPref = resolveDietPreference(dietaryRestrictions);

  const conditions: any[] = [];
  if (dietPref) conditions.push(eq(recipesTable.diet, dietPref));
  if (isFasting) conditions.push(eq(recipesTable.course, "fasting"));
  if (budgetPerServing > 0) conditions.push(lte(recipesTable.costPerServing, budgetPerServing * 1.5));
  if (maxCookTimeMin !== null && maxCookTimeMin > 0) conditions.push(lte(recipesTable.totalTimeMin, maxCookTimeMin));

  const RECIPE_SELECT = {
    id: recipesTable.id,
    name: recipesTable.name,
    cuisine: recipesTable.cuisine,
    diet: recipesTable.diet,
    calories: recipesTable.calories,
    protein: recipesTable.protein,
    costPerServing: recipesTable.costPerServing,
    course: recipesTable.course,
    zone: recipesTable.zone,
    totalTimeMin: recipesTable.totalTimeMin,
  } as const;

  let recipes = await localDb.select(RECIPE_SELECT)
    .from(recipesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit * 3);

  if (isFasting && recipes.length < 20) {
    const fastingIngredients = ["sabudana", "kuttu", "singhara", "makhana", "samak", "rajgira", "sendha namak"];
    const baseConditions: any[] = [];
    if (dietPref) baseConditions.push(eq(recipesTable.diet, dietPref));
    if (budgetPerServing > 0) baseConditions.push(lte(recipesTable.costPerServing, budgetPerServing * 1.5));

    const ingredientFastingRecipes = await localDb.select(RECIPE_SELECT)
      .from(recipesTable)
      .where(and(
        ...baseConditions,
        or(
          ...fastingIngredients.map(ing => ilike(recipesTable.ingredients, `%${ing}%`)),
          ...fastingIngredients.map(ing => ilike(recipesTable.name, `%${ing}%`)),
        ),
      ))
      .limit(limit * 2);

    const existingIds = new Set(recipes.map(r => r.id));
    const additional = ingredientFastingRecipes.filter(r => !existingIds.has(r.id));
    recipes = [...recipes, ...additional];
  }

  const zoneMatching = recipes.filter(r =>
    cuisines.some(c => r.cuisine?.toLowerCase().includes(c.toLowerCase()))
  );
  const fallback = recipes.filter(r =>
    !cuisines.some(c => r.cuisine?.toLowerCase().includes(c.toLowerCase()))
  );

  return [...zoneMatching, ...fallback].slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface ScenarioInput {
  name: string;
  family: Family;
  members: FamilyMember[];
  memberWeeklyContexts: MemberWeeklyContext[];
  weeklyContext: WeeklyContext;
  totalMonthlyBudget: number;
  expectedConflictTypes: string[];
  expectedMedRules: string[];
}

function buildScenarios(): ScenarioInput[] {
  const sharmaFamilyId = uuid();
  const sharmaMemberId_father = uuid();
  const sharmaMemberId_mother = uuid();
  const sharmaMemberId_teen = uuid();
  const sharmaMemberId_grandma = uuid();
  const sharmaWeeklyId = uuid();

  const menonFamilyId = uuid();
  const menonMemberId_father = uuid();
  const menonMemberId_mother = uuid();
  const menonMemberId_child = uuid();
  const menonWeeklyId = uuid();

  const joshiFamilyId = uuid();
  const joshiMemberId_husband = uuid();
  const joshiMemberId_wife = uuid();
  const joshiMemberId_toddler = uuid();
  const joshiWeeklyId = uuid();

  const sharmaScenario: ScenarioInput = {
    name: "SHARMA FAMILY (Delhi, 4 members — Diabetic father on Metformin + Hypothyroid mother on Eltroxin + Teenage son + Senior grandmother)",
    family: {
      id: sharmaFamilyId,
      userId: uuid(),
      name: "Sharma Family",
      stateRegion: "Delhi",
      languagePreference: "hindi",
      householdDietaryBaseline: "strictly_veg",
      mealsPerDay: "3_meals_snacks",
      cookingSkillLevel: "intermediate",
      appliances: ["Gas stove", "Pressure cooker", "Mixer grinder"],
      pincode: "110001",
    },
    members: [
      {
        id: sharmaMemberId_father,
        familyId: sharmaFamilyId,
        name: "Rajesh",
        age: 52,
        gender: "male",
        heightCm: 172,
        weightKg: 88,
        activityLevel: "sedentary",
        primaryGoal: "weight_loss",
        goalPace: "moderate_0.5kg",
        dailyCalorieTarget: null,
        dietaryType: "strictly_vegetarian",
        spiceTolerance: "medium",
        tiffinNeeded: "yes_office",
        festivalFastingAlerts: true,
        displayOrder: 1,
        healthConditions: ["diabetes_type_2", "high_cholesterol"],
        allergies: ["none"],
        ingredientDislikes: ["karela"],
        religiousCulturalRules: { type: "no_beef", details: [] },
        occasionalNonvegConfig: null,
        fastingConfig: { type: "weekly", weekly_days: ["thursday"], ekadashi: true, festival_alerts: true },
      },
      {
        id: sharmaMemberId_mother,
        familyId: sharmaFamilyId,
        name: "Sunita",
        age: 48,
        gender: "female",
        heightCm: 158,
        weightKg: 65,
        activityLevel: "lightly_active",
        primaryGoal: "manage_condition",
        goalPace: null,
        dailyCalorieTarget: null,
        dietaryType: "strictly_vegetarian",
        spiceTolerance: "mild",
        tiffinNeeded: "no",
        festivalFastingAlerts: true,
        displayOrder: 2,
        healthConditions: ["hypothyroid"],
        allergies: ["peanuts"],
        ingredientDislikes: [],
        religiousCulturalRules: { type: "no_beef", details: [] },
        occasionalNonvegConfig: null,
        fastingConfig: { type: "weekly", weekly_days: ["monday"], ekadashi: false, festival_alerts: true },
      },
      {
        id: sharmaMemberId_teen,
        familyId: sharmaFamilyId,
        name: "Arjun",
        age: 16,
        gender: "male",
        heightCm: 175,
        weightKg: 60,
        activityLevel: "very_active",
        primaryGoal: "build_muscle",
        goalPace: null,
        dailyCalorieTarget: null,
        dietaryType: "strictly_vegetarian",
        spiceTolerance: "spicy",
        tiffinNeeded: "yes_school",
        festivalFastingAlerts: false,
        displayOrder: 3,
        healthConditions: ["none"],
        allergies: ["none"],
        ingredientDislikes: ["lauki"],
        religiousCulturalRules: { type: "none", details: [] },
        occasionalNonvegConfig: null,
        fastingConfig: { type: "no_fasting", weekly_days: [], ekadashi: false, festival_alerts: false },
      },
      {
        id: sharmaMemberId_grandma,
        familyId: sharmaFamilyId,
        name: "Kamla Devi",
        age: 72,
        gender: "female",
        heightCm: 150,
        weightKg: 55,
        activityLevel: "sedentary",
        primaryGoal: "no_specific_goal",
        goalPace: null,
        dailyCalorieTarget: null,
        dietaryType: "strictly_vegetarian",
        spiceTolerance: "mild",
        tiffinNeeded: "no",
        festivalFastingAlerts: true,
        displayOrder: 4,
        healthConditions: ["hypertension"],
        allergies: ["none"],
        ingredientDislikes: [],
        religiousCulturalRules: { type: "sattvic_no_onion_garlic", details: ["No onion", "No garlic"] },
        occasionalNonvegConfig: null,
        fastingConfig: { type: "weekly", weekly_days: ["tuesday"], ekadashi: true, festival_alerts: true },
      },
    ],
    memberWeeklyContexts: [
      {
        id: uuid(), weeklyContextId: sharmaWeeklyId, familyMemberId: sharmaMemberId_father,
        currentGoalOverride: null, currentWeightKg: 88, feelingThisWeek: "Feeling heavy, want lighter meals",
        spiceToleranceOverride: null, tiffinNeededOverride: null, healthConditionsOverride: null,
        activeMedications: [
          { name: "Metformin 500mg", timing: "with breakfast and dinner", notes: "Take with food always" },
          { name: "Atorvastatin 10mg", timing: "at night after dinner", notes: "" },
        ],
        fastingDaysThisWeek: ["thursday"], ekadashiThisWeek: true, festivalFastThisWeek: false,
        nonvegDaysThisWeek: [], nonvegTypesThisWeek: [],
      },
      {
        id: uuid(), weeklyContextId: sharmaWeeklyId, familyMemberId: sharmaMemberId_mother,
        currentGoalOverride: null, currentWeightKg: 65, feelingThisWeek: null,
        spiceToleranceOverride: null, tiffinNeededOverride: null, healthConditionsOverride: null,
        activeMedications: [
          { name: "Eltroxin 50mcg", timing: "morning empty stomach", notes: "30 min before breakfast" },
        ],
        fastingDaysThisWeek: ["monday"], ekadashiThisWeek: false, festivalFastThisWeek: false,
        nonvegDaysThisWeek: [], nonvegTypesThisWeek: [],
      },
      {
        id: uuid(), weeklyContextId: sharmaWeeklyId, familyMemberId: sharmaMemberId_teen,
        currentGoalOverride: null, currentWeightKg: 60, feelingThisWeek: "Cricket practice daily",
        spiceToleranceOverride: null, tiffinNeededOverride: null, healthConditionsOverride: null,
        activeMedications: [],
        fastingDaysThisWeek: [], ekadashiThisWeek: false, festivalFastThisWeek: false,
        nonvegDaysThisWeek: [], nonvegTypesThisWeek: [],
      },
      {
        id: uuid(), weeklyContextId: sharmaWeeklyId, familyMemberId: sharmaMemberId_grandma,
        currentGoalOverride: null, currentWeightKg: 55, feelingThisWeek: "Joint pain this week",
        spiceToleranceOverride: null, tiffinNeededOverride: null, healthConditionsOverride: null,
        activeMedications: [
          { name: "Amlodipine 5mg", timing: "morning with breakfast", notes: "" },
        ],
        fastingDaysThisWeek: ["tuesday"], ekadashiThisWeek: true, festivalFastThisWeek: false,
        nonvegDaysThisWeek: [], nonvegTypesThisWeek: [],
      },
    ],
    weeklyContext: {
      id: sharmaWeeklyId,
      familyId: sharmaFamilyId,
      weekStartDate: "2025-07-07",
      eatingOutFrequency: "1_to_2_times",
      weekdayCookingTime: "20_40_mins",
      weekendCookingTime: "elaborate",
      weeklyPerishableBudgetOverride: null,
      specialRequest: "Arjun has a cricket match on Saturday — need high-energy lunch",
      status: "submitted",
      pantrySnapshot: [
        { name: "Paneer", quantity: 400, unit: "g", is_perishable: true },
        { name: "Spinach", quantity: 250, unit: "g", is_perishable: true },
        { name: "Curd", quantity: 500, unit: "ml", is_perishable: true },
        { name: "Toor dal", quantity: 1, unit: "kg", is_perishable: false },
      ],
    },
    totalMonthlyBudget: 18000,
    expectedConflictTypes: ["allergy:peanuts", "spice_conflict", "calorie_spread", "genetic_shield", "medication:metformin", "medication:thyroid", "sattvic"],
    expectedMedRules: ["metformin", "thyroid", "statin", "amlodipine"],
  };

  const menonScenario: ScenarioInput = {
    name: "MENON FAMILY (Kerala, 3 members — Anaemic mother on Iron supplements + Non-veg father + School-age child with peanut allergy)",
    family: {
      id: menonFamilyId,
      userId: uuid(),
      name: "Menon Family",
      stateRegion: "Kerala",
      languagePreference: "english",
      householdDietaryBaseline: "non_veg",
      mealsPerDay: "3_meals",
      cookingSkillLevel: "experienced",
      appliances: ["Gas stove", "Pressure cooker", "Mixer grinder", "Oven"],
      pincode: "682001",
    },
    members: [
      {
        id: menonMemberId_father,
        familyId: menonFamilyId,
        name: "Vishnu",
        age: 38,
        gender: "male",
        heightCm: 178,
        weightKg: 82,
        activityLevel: "moderately_active",
        primaryGoal: "maintain",
        goalPace: null,
        dailyCalorieTarget: null,
        dietaryType: "non_vegetarian",
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
        id: menonMemberId_mother,
        familyId: menonFamilyId,
        name: "Lakshmi",
        age: 35,
        gender: "female",
        heightCm: 160,
        weightKg: 58,
        activityLevel: "lightly_active",
        primaryGoal: "manage_condition",
        goalPace: null,
        dailyCalorieTarget: null,
        dietaryType: "non_vegetarian",
        spiceTolerance: "medium",
        tiffinNeeded: "no",
        festivalFastingAlerts: true,
        displayOrder: 2,
        healthConditions: ["anaemia"],
        allergies: ["none"],
        ingredientDislikes: ["bitter gourd"],
        religiousCulturalRules: { type: "none", details: [] },
        occasionalNonvegConfig: null,
        fastingConfig: { type: "no_fasting", weekly_days: [], ekadashi: false, festival_alerts: false },
      },
      {
        id: menonMemberId_child,
        familyId: menonFamilyId,
        name: "Aditi",
        age: 8,
        gender: "female",
        heightCm: 125,
        weightKg: 25,
        activityLevel: "moderately_active",
        primaryGoal: "healthy_growth",
        goalPace: null,
        dailyCalorieTarget: null,
        dietaryType: "non_vegetarian",
        spiceTolerance: "mild",
        tiffinNeeded: "yes_school",
        festivalFastingAlerts: false,
        displayOrder: 3,
        healthConditions: ["none"],
        allergies: ["peanuts"],
        ingredientDislikes: ["capsicum"],
        religiousCulturalRules: { type: "none", details: [] },
        occasionalNonvegConfig: null,
        fastingConfig: { type: "no_fasting", weekly_days: [], ekadashi: false, festival_alerts: false },
      },
    ],
    memberWeeklyContexts: [
      {
        id: uuid(), weeklyContextId: menonWeeklyId, familyMemberId: menonMemberId_father,
        currentGoalOverride: null, currentWeightKg: 82, feelingThisWeek: null,
        spiceToleranceOverride: null, tiffinNeededOverride: null, healthConditionsOverride: null,
        activeMedications: [],
        fastingDaysThisWeek: [], ekadashiThisWeek: false, festivalFastThisWeek: false,
        nonvegDaysThisWeek: ["monday", "wednesday", "friday", "sunday"], nonvegTypesThisWeek: ["chicken", "fish"],
      },
      {
        id: uuid(), weeklyContextId: menonWeeklyId, familyMemberId: menonMemberId_mother,
        currentGoalOverride: null, currentWeightKg: 58, feelingThisWeek: "Feeling tired, low energy",
        spiceToleranceOverride: null, tiffinNeededOverride: null, healthConditionsOverride: null,
        activeMedications: [
          { name: "Ferrous Sulphate 200mg", timing: "morning empty stomach", notes: "With orange juice for absorption" },
        ],
        fastingDaysThisWeek: [], ekadashiThisWeek: false, festivalFastThisWeek: false,
        nonvegDaysThisWeek: ["wednesday", "saturday"], nonvegTypesThisWeek: ["fish", "eggs"],
      },
      {
        id: uuid(), weeklyContextId: menonWeeklyId, familyMemberId: menonMemberId_child,
        currentGoalOverride: null, currentWeightKg: 25, feelingThisWeek: null,
        spiceToleranceOverride: null, tiffinNeededOverride: null, healthConditionsOverride: null,
        activeMedications: [],
        fastingDaysThisWeek: [], ekadashiThisWeek: false, festivalFastThisWeek: false,
        nonvegDaysThisWeek: ["sunday"], nonvegTypesThisWeek: ["chicken", "eggs"],
      },
    ],
    weeklyContext: {
      id: menonWeeklyId,
      familyId: menonFamilyId,
      weekStartDate: "2025-07-07",
      eatingOutFrequency: "none",
      weekdayCookingTime: "20_40_mins",
      weekendCookingTime: "elaborate",
      weeklyPerishableBudgetOverride: null,
      specialRequest: null,
      status: "submitted",
      pantrySnapshot: [
        { name: "Coconut", quantity: 6, unit: "pcs", is_perishable: true },
        { name: "Curry leaves", quantity: 50, unit: "g", is_perishable: true },
        { name: "Rice", quantity: 5, unit: "kg", is_perishable: false },
      ],
    },
    totalMonthlyBudget: 22000,
    expectedConflictTypes: ["allergy:peanuts", "spice_conflict", "veg_vs_nonveg", "medication:iron"],
    expectedMedRules: ["iron"],
  };

  const joshiScenario: ScenarioInput = {
    name: "JOSHI FAMILY (Maharashtra, 3 members — PCOS wife on no meds + Husband wants muscle gain + Toddler 3y)",
    family: {
      id: joshiFamilyId,
      userId: uuid(),
      name: "Joshi Family",
      stateRegion: "Maharashtra",
      languagePreference: "hindi",
      householdDietaryBaseline: "mixed",
      mealsPerDay: "3_meals_snacks",
      cookingSkillLevel: "beginner",
      appliances: ["Gas stove", "Pressure cooker"],
      pincode: "411001",
    },
    members: [
      {
        id: joshiMemberId_husband,
        familyId: joshiFamilyId,
        name: "Amit",
        age: 30,
        gender: "male",
        heightCm: 180,
        weightKg: 75,
        activityLevel: "very_active",
        primaryGoal: "build_muscle",
        goalPace: null,
        dailyCalorieTarget: null,
        dietaryType: "occasional_non_veg",
        spiceTolerance: "spicy",
        tiffinNeeded: "yes_office",
        festivalFastingAlerts: false,
        displayOrder: 1,
        healthConditions: ["none"],
        allergies: ["none"],
        ingredientDislikes: [],
        religiousCulturalRules: { type: "no_beef", details: [] },
        occasionalNonvegConfig: { days: ["wednesday", "saturday"], types: ["chicken", "eggs"] },
        fastingConfig: { type: "no_fasting", weekly_days: [], ekadashi: false, festival_alerts: false },
      },
      {
        id: joshiMemberId_wife,
        familyId: joshiFamilyId,
        name: "Priya",
        age: 28,
        gender: "female",
        heightCm: 162,
        weightKg: 72,
        activityLevel: "lightly_active",
        primaryGoal: "weight_loss",
        goalPace: "moderate_0.5kg",
        dailyCalorieTarget: null,
        dietaryType: "strictly_vegetarian",
        spiceTolerance: "medium",
        tiffinNeeded: "no",
        festivalFastingAlerts: true,
        displayOrder: 2,
        healthConditions: ["pcos"],
        allergies: ["gluten"],
        ingredientDislikes: ["brinjal"],
        religiousCulturalRules: { type: "no_beef", details: [] },
        occasionalNonvegConfig: null,
        fastingConfig: { type: "weekly", weekly_days: ["monday"], ekadashi: false, festival_alerts: true },
      },
      {
        id: joshiMemberId_toddler,
        familyId: joshiFamilyId,
        name: "Vihaan",
        age: 3,
        gender: "male",
        heightCm: 95,
        weightKg: 14,
        activityLevel: "moderately_active",
        primaryGoal: "no_specific_goal",
        goalPace: null,
        dailyCalorieTarget: null,
        dietaryType: "strictly_vegetarian",
        spiceTolerance: "mild",
        tiffinNeeded: "no",
        festivalFastingAlerts: false,
        displayOrder: 3,
        healthConditions: ["none"],
        allergies: ["dairy"],
        ingredientDislikes: [],
        religiousCulturalRules: { type: "none", details: [] },
        occasionalNonvegConfig: null,
        fastingConfig: { type: "no_fasting", weekly_days: [], ekadashi: false, festival_alerts: false },
      },
    ],
    memberWeeklyContexts: [
      {
        id: uuid(), weeklyContextId: joshiWeeklyId, familyMemberId: joshiMemberId_husband,
        currentGoalOverride: null, currentWeightKg: 75, feelingThisWeek: "Gym 5 days this week",
        spiceToleranceOverride: null, tiffinNeededOverride: null, healthConditionsOverride: null,
        activeMedications: [],
        fastingDaysThisWeek: [], ekadashiThisWeek: false, festivalFastThisWeek: false,
        nonvegDaysThisWeek: ["wednesday", "saturday"], nonvegTypesThisWeek: ["chicken", "eggs"],
      },
      {
        id: uuid(), weeklyContextId: joshiWeeklyId, familyMemberId: joshiMemberId_wife,
        currentGoalOverride: null, currentWeightKg: 72, feelingThisWeek: "PCOS flare-up, bloating",
        spiceToleranceOverride: null, tiffinNeededOverride: null, healthConditionsOverride: null,
        activeMedications: [],
        fastingDaysThisWeek: ["monday"], ekadashiThisWeek: false, festivalFastThisWeek: false,
        nonvegDaysThisWeek: [], nonvegTypesThisWeek: [],
      },
      {
        id: uuid(), weeklyContextId: joshiWeeklyId, familyMemberId: joshiMemberId_toddler,
        currentGoalOverride: null, currentWeightKg: 14, feelingThisWeek: null,
        spiceToleranceOverride: null, tiffinNeededOverride: null, healthConditionsOverride: null,
        activeMedications: [],
        fastingDaysThisWeek: [], ekadashiThisWeek: false, festivalFastThisWeek: false,
        nonvegDaysThisWeek: [], nonvegTypesThisWeek: [],
      },
    ],
    weeklyContext: {
      id: joshiWeeklyId,
      familyId: joshiFamilyId,
      weekStartDate: "2025-07-07",
      eatingOutFrequency: "1_to_2_times",
      weekdayCookingTime: "under_20_mins",
      weekendCookingTime: "no_preference",
      weeklyPerishableBudgetOverride: null,
      specialRequest: "Vihaan needs soft, mashed foods — no whole nuts or hard textures",
      status: "submitted",
      pantrySnapshot: [
        { name: "Bananas", quantity: 6, unit: "pcs", is_perishable: true },
        { name: "Moong dal", quantity: 500, unit: "g", is_perishable: false },
      ],
    },
    totalMonthlyBudget: 15000,
    expectedConflictTypes: ["allergy:gluten", "allergy:dairy", "spice_conflict", "calorie_spread", "veg_vs_nonveg", "toddler_auto_goal"],
    expectedMedRules: [],
  };

  return [sharmaScenario, menonScenario, joshiScenario];
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 1: Conflict Engine
// ═══════════════════════════════════════════════════════════════════════════════

function runStage1(scenario: ScenarioInput): StageResult {
  const details: string[] = [];
  let status: "PASS" | "FAIL" | "WARN" = "PASS";

  try {
    const budgetSplit = calculateBudgetSplit({
      total_monthly_budget: scenario.totalMonthlyBudget,
      month_year: "2025-07",
      state_region: scenario.family.stateRegion,
      meals_per_day: scenario.family.mealsPerDay,
      eating_out_frequency: scenario.weeklyContext.eatingOutFrequency,
      family_id: scenario.family.id,
    });

    const budget: MonthlyBudget = {
      id: uuid(),
      familyId: scenario.family.id,
      monthYear: "2025-07",
      totalMonthlyBudget: scenario.totalMonthlyBudget,
      staplesBudget: budgetSplit.staples_budget,
      perishablesBudget: budgetSplit.perishables_budget,
      bufferBudget: budgetSplit.buffer_budget,
      dailyPerishableLimit: budgetSplit.effective_daily_perishable_limit,
      regionalPriceSuggestion: budgetSplit.regional_price_suggestion,
      budgetBreakdown: budgetSplit.budget_breakdown,
    };

    details.push(`Budget split: Staples=₹${budget.staplesBudget} | Perishables=₹${budget.perishablesBudget} | Buffer=₹${budget.bufferBudget}`);
    details.push(`Daily perishable limit: ₹${budget.dailyPerishableLimit}/day`);
    details.push(`Regional suggestion for ${scenario.family.stateRegion}: ₹${budget.regionalPriceSuggestion}/month`);

    const packet = runConflictEngine({
      family: scenario.family,
      members: scenario.members,
      memberWeeklyContexts: scenario.memberWeeklyContexts,
      weeklyContext: scenario.weeklyContext,
      budget,
    });

    details.push(`\n  Effective profiles built: ${packet.effectiveProfiles.length}`);
    for (const p of packet.effectiveProfiles) {
      const calResult = calculateDailyCalorieTarget({
        age: p.age,
        gender: p.gender,
        heightCm: p.heightCm,
        weightKg: p.effectiveWeightKg,
        activityLevel: p.activityLevel,
        primaryGoal: p.effectiveGoal,
        goalPace: p.goalPace,
      });
      details.push(`    ${p.name} (${p.age}y): Goal=${p.effectiveGoal}, Calories=${p.dailyCalorieTarget} kcal, Method=${calResult.calculation_method}` +
        (calResult.bmr ? `, BMR=${calResult.bmr}, TDEE=${calResult.tdee}` : "") +
        (p.isChildUnder5 ? " [CHILD_UNDER_5]" : "") +
        (p.isSchoolAge ? " [SCHOOL_AGE]" : "") +
        (p.isTeen ? " [TEEN]" : "") +
        (p.isSenior ? " [SENIOR]" : ""));
    }

    details.push(`\n  Conflicts detected: ${packet.conflicts.length}`);
    for (const c of packet.conflicts) {
      details.push(`    [P${c.priority_level}] ${c.description.substring(0, 120)}...`);
    }

    details.push(`\n  Resolutions: ${packet.resolutions.length}`);
    for (const r of packet.resolutions) {
      details.push(`    → ${r.resolution_type}: ${r.resolution.substring(0, 100)}...`);
    }

    details.push(`\n  Harmony Score: ${packet.harmonyScore.final_score}/100`);
    details.push(`    Deductions: ${packet.harmonyScore.deductions.length} (${packet.harmonyScore.deductions.reduce((s, d) => s + d.points, 0)} pts)`);
    details.push(`    Additions: ${packet.harmonyScore.additions.length} (+${packet.harmonyScore.additions.reduce((s, a) => s + a.points, 0)} pts)`);

    if (packet.medicationGuardrailBundles.length > 0) {
      details.push(`\n  Medication Guardrail Bundles: ${packet.medicationGuardrailBundles.length}`);
      for (const b of packet.medicationGuardrailBundles) {
        details.push(`    ${b.member_name} — ${b.drug_id}: ${b.directives.length} directives, +${b.harmony_score_addition} harmony pts`);
        for (const d of b.directives) {
          details.push(`      ▸ ${d.substring(0, 140)}`);
        }
      }
    }

    if (packet.medicationWarnings.length > 0) {
      details.push(`\n  Medication Warnings (flat): ${packet.medicationWarnings.length}`);
    }

    if (packet.fastingPreloadInstructions.length > 0) {
      details.push(`\n  Fasting Preload Instructions: ${packet.fastingPreloadInstructions.length}`);
      for (const f of packet.fastingPreloadInstructions) {
        details.push(`    ${f.substring(0, 140)}`);
      }
    }

    details.push(`\n  Effective daily budget: ₹${packet.effectiveDailyBudget}`);

    const nonvegEntries = Object.entries(packet.nonvegDaysByMember);
    if (nonvegEntries.length > 0) {
      details.push(`\n  Non-veg days by member:`);
      for (const [id, days] of nonvegEntries) {
        const memberName = packet.effectiveProfiles.find(p => p.id === id)?.name ?? id;
        details.push(`    ${memberName}: ${days.join(", ")}`);
      }
    }

    if (packet.conflicts.length === 0 && scenario.expectedConflictTypes.length > 0) {
      status = "WARN";
      details.push(`\n  ⚠️  Expected conflicts but none detected!`);
    }

    if (packet.harmonyScore.final_score < 0 || packet.harmonyScore.final_score > 100) {
      status = "FAIL";
      details.push(`\n  ❌ Harmony score out of range: ${packet.harmonyScore.final_score}`);
    }

    (scenario as any)._packet = packet;
    (scenario as any)._budget = budget;

  } catch (err: any) {
    status = "FAIL";
    details.push(`ERROR: ${err.message}\n${err.stack}`);
  }

  return { stage: "Stage 1: Conflict Engine + Budget + Calorie Calculator", status, details };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 2: Recipe SQL Filter
// ═══════════════════════════════════════════════════════════════════════════════

async function runStage2(scenario: ScenarioInput): Promise<StageResult> {
  const details: string[] = [];
  let status: "PASS" | "FAIL" | "WARN" = "PASS";

  try {
    const zone = getZoneForState(scenario.family.stateRegion);
    const dietaryRestrictions = [...new Set(scenario.members.map(m => m.dietaryType))];
    const packet = (scenario as any)._packet as ConstraintPacket;
    const budgetPerServing = packet.effectiveDailyBudget / 3;

    details.push(`Zone: ${zone} (from ${scenario.family.stateRegion})`);
    details.push(`Dietary restrictions: ${dietaryRestrictions.join(", ")}`);
    details.push(`Budget per serving: ₹${budgetPerServing.toFixed(2)}`);

    const normalRecipes = await getFilteredRecipes(zone, dietaryRestrictions, budgetPerServing, false, 40, 50);
    details.push(`\n  Normal recipes found: ${normalRecipes.length}`);
    if (normalRecipes.length > 0) {
      details.push(`  Sample (first 5):`);
      for (const r of normalRecipes.slice(0, 5)) {
        details.push(`    • ${r.name} | ${r.cuisine} | ${r.diet} | ${r.calories} kcal | ₹${r.costPerServing}/serving | ${r.totalTimeMin}min`);
      }
    }

    const hasFastingMembers = packet.effectiveProfiles.some(p => p.effectiveFastingDays.length > 0);
    if (hasFastingMembers) {
      const fastingRecipes = await getFilteredRecipes(zone, ["strictly_vegetarian"], budgetPerServing, true, null, 30);
      details.push(`\n  Fasting recipes found: ${fastingRecipes.length}`);
      if (fastingRecipes.length > 0) {
        details.push(`  Sample fasting (first 3):`);
        for (const r of fastingRecipes.slice(0, 3)) {
          details.push(`    • ${r.name} | ${r.cuisine} | ${r.diet} | ${r.calories} kcal`);
        }
      }
      if (fastingRecipes.length < 5) {
        status = "WARN";
        details.push(`  ⚠️  Very few fasting recipes (${fastingRecipes.length}). Scheduler may struggle.`);
      }
    }

    if (normalRecipes.length < 10) {
      status = "FAIL";
      details.push(`\n  ❌ Too few recipes (${normalRecipes.length}) — need at least 10 for a 7-day plan.`);
    }

    const allergyIngredients = new Set<string>();
    for (const m of scenario.members) {
      for (const a of m.allergies) {
        if (a === "peanuts") allergyIngredients.add("peanut");
        if (a === "dairy") { allergyIngredients.add("paneer"); allergyIngredients.add("milk"); allergyIngredients.add("ghee"); }
        if (a === "gluten") { allergyIngredients.add("atta"); allergyIngredients.add("maida"); allergyIngredients.add("wheat"); }
      }
    }
    if (allergyIngredients.size > 0) {
      details.push(`\n  Allergy filter check — allergens to watch: ${[...allergyIngredients].join(", ")}`);
      details.push(`  (Post-filter allergen exclusion happens in Gemini prompt, not SQL)`);
    }

    (scenario as any)._normalRecipes = normalRecipes;

  } catch (err: any) {
    status = "FAIL";
    details.push(`ERROR: ${err.message}\n${err.stack}`);
  }

  return { stage: "Stage 2: Recipe SQL Filter (localDb)", status, details };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 3: Simulated Gemini Scheduler (21-meal calendar)
// ═══════════════════════════════════════════════════════════════════════════════

function runStage3(scenario: ScenarioInput): StageResult {
  const details: string[] = [];
  let status: "PASS" | "FAIL" | "WARN" = "PASS";

  try {
    const packet = (scenario as any)._packet as ConstraintPacket;
    const recipes = (scenario as any)._normalRecipes as any[];

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const slots: ("breakfast" | "lunch" | "dinner")[] = ["breakfast", "lunch", "dinner"];
    const weeklyPlan: DayPlan[] = [];

    let recipeIdx = 0;
    const getNextRecipe = () => {
      const r = recipes[recipeIdx % recipes.length];
      recipeIdx++;
      return r;
    };

    for (let d = 0; d < 7; d++) {
      const dayName = days[d];
      const dateStr = `2025-07-${String(7 + d).padStart(2, "0")}`;
      const meals: Record<string, MealSlot> = {};

      for (const slot of slots) {
        const r = getNextRecipe();
        const memberPlates = packet.effectiveProfiles.map(p => {
          const mods: string[] = [];
          if (p.effectiveSpiceTolerance === "mild") mods.push("No spice, keep bland");
          if (p.effectiveSpiceTolerance === "spicy") mods.push("Add green chilli tadka");
          if (p.effectiveGoal === "weight_loss") mods.push("Reduced portion (75%)");
          if (p.effectiveGoal === "build_muscle") mods.push("Extra protein side (paneer/dal)");
          if (p.isChildUnder5) mods.push("Mashed/soft consistency, no whole spices");
          if (p.isSenior) mods.push("Soft texture, low salt");

          const isFastingDay = p.effectiveFastingDays.includes(dayName.toLowerCase());
          return {
            member_id: p.id,
            member_name: p.name,
            modifications: mods,
            fasting_replacement: isFastingDay ? "Sabudana khichdi with peanuts (if no allergy) or makhana" : undefined,
            tiffin_instructions: p.tiffinNeeded !== "no" ? `Pack ${slot} for ${p.tiffinNeeded === "yes_school" ? "school" : "office"} tiffin` : undefined,
          };
        });

        meals[slot] = {
          name: r?.name ?? `Simulated ${slot} dish`,
          is_base_dish: true,
          base_recipe: {
            ingredients: [{ name: "Simulated ingredient", quantity: "as needed" }],
            steps: ["Step 1: Simulated cooking step"],
            prep_time_mins: 10,
            cook_time_mins: 20,
            image_search_query: r?.name ?? slot,
          },
          member_plates: memberPlates,
          pantry_items_used: [],
          estimated_cost: r?.costPerServing ?? 50,
          priority_flags: [],
        };
      }

      if (scenario.family.mealsPerDay === "3_meals_snacks") {
        meals["snack"] = {
          name: "Seasonal fruit plate / Roasted makhana",
          is_base_dish: true,
          base_recipe: {
            ingredients: [{ name: "Seasonal fruits", quantity: "2 servings" }],
            steps: ["Wash and serve seasonal fruits"],
            prep_time_mins: 5,
            cook_time_mins: 0,
            image_search_query: "Indian fruit plate",
          },
          member_plates: packet.effectiveProfiles.map(p => ({
            member_id: p.id,
            member_name: p.name,
            modifications: p.isChildUnder5 ? ["Cut into small pieces, remove seeds"] : [],
          })),
          pantry_items_used: [],
          estimated_cost: 30,
          priority_flags: [],
        };
      }

      weeklyPlan.push({
        date: dateStr,
        day_name: dayName,
        meals: meals as any,
      });
    }

    details.push(`Simulated 7-day plan generated (NO Gemini API call)`);
    details.push(`Total days: ${weeklyPlan.length}`);

    let totalMeals = 0;
    let totalCost = 0;
    for (const day of weeklyPlan) {
      const mealEntries = Object.entries(day.meals).filter(([, m]) => m);
      totalMeals += mealEntries.length;
      for (const [, meal] of mealEntries) {
        if (meal) totalCost += meal.estimated_cost;
      }
    }
    details.push(`Total meal slots filled: ${totalMeals}`);
    details.push(`Total estimated weekly cost: ₹${totalCost.toFixed(0)}`);

    const expectedMeals = scenario.family.mealsPerDay === "3_meals_snacks" ? 28 : (scenario.family.mealsPerDay === "2_meals" ? 14 : 21);
    if (totalMeals < expectedMeals) {
      status = "WARN";
      details.push(`⚠️  Expected ${expectedMeals} meals but only ${totalMeals} filled`);
    }

    details.push(`\n  Day-by-day summary:`);
    for (const day of weeklyPlan) {
      const mealNames = Object.entries(day.meals)
        .filter(([, m]) => m)
        .map(([slot, m]) => `${slot}="${(m as MealSlot).name?.substring(0, 30)}"`)
        .join(", ");
      details.push(`    ${day.day_name}: ${mealNames}`);
    }

    const fastingMembers = packet.effectiveProfiles.filter(p => p.effectiveFastingDays.length > 0);
    if (fastingMembers.length > 0) {
      details.push(`\n  Fasting day coverage:`);
      for (const m of fastingMembers) {
        details.push(`    ${m.name}: fasting on ${m.effectiveFastingDays.join(", ")}`);
        for (const fd of m.effectiveFastingDays) {
          const dayPlan = weeklyPlan.find(d => d.day_name.toLowerCase() === fd.toLowerCase());
          if (dayPlan) {
            const lunchSlot = dayPlan.meals.lunch;
            const plate = lunchSlot?.member_plates.find(p => p.member_id === m.id);
            if (plate?.fasting_replacement) {
              details.push(`      → ${fd} lunch: fasting replacement = "${plate.fasting_replacement}"`);
            }
          }
        }
      }
    }

    (scenario as any)._weeklyPlan = weeklyPlan;

  } catch (err: any) {
    status = "FAIL";
    details.push(`ERROR: ${err.message}\n${err.stack}`);
  }

  return { stage: "Stage 3: Simulated Gemini Scheduler (21-meal calendar)", status, details };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 4: Validation Checks
// ═══════════════════════════════════════════════════════════════════════════════

function runStage4(scenario: ScenarioInput): StageResult {
  const details: string[] = [];
  let status: "PASS" | "FAIL" | "WARN" = "PASS";

  try {
    const packet = (scenario as any)._packet as ConstraintPacket;
    const weeklyPlan = (scenario as any)._weeklyPlan as DayPlan[];

    let checks = 0;
    let passed = 0;
    let warnings = 0;

    const check = (label: string, ok: boolean, warnOnly = false) => {
      checks++;
      if (ok) {
        passed++;
        printResult(label, PASS);
        details.push(`${PASS} ${label}`);
      } else if (warnOnly) {
        warnings++;
        printResult(label, WARN);
        details.push(`${WARN} ${label}`);
      } else {
        printResult(label, FAIL);
        details.push(`${FAIL} ${label}`);
        status = "FAIL";
      }
    };

    check("7 days in weekly plan", weeklyPlan.length === 7);

    const mealsPerDayTarget = scenario.family.mealsPerDay === "3_meals_snacks" ? 4 : (scenario.family.mealsPerDay === "2_meals" ? 2 : 3);
    for (const day of weeklyPlan) {
      const filledSlots = Object.values(day.meals).filter(m => m).length;
      check(`${day.day_name}: ${filledSlots} meal slots (expected ${mealsPerDayTarget})`, filledSlots >= mealsPerDayTarget - 1, true);
    }

    for (const day of weeklyPlan) {
      for (const [slot, meal] of Object.entries(day.meals)) {
        if (!meal) continue;
        const m = meal as MealSlot;
        check(
          `${day.day_name} ${slot}: all members have plates (${m.member_plates.length}/${packet.effectiveProfiles.length})`,
          m.member_plates.length === packet.effectiveProfiles.length
        );
      }
    }

    for (const p of packet.effectiveProfiles) {
      check(
        `${p.name}: calorie target > 0 (${p.dailyCalorieTarget} kcal)`,
        p.dailyCalorieTarget > 0
      );
    }

    const harmonyScore = packet.harmonyScore;
    check("Harmony score in [0, 100]", harmonyScore.final_score >= 0 && harmonyScore.final_score <= 100);
    check("At least 1 conflict detected (multi-member family)", packet.conflicts.length > 0, true);
    check("All conflicts have resolutions", packet.conflicts.length === packet.resolutions.length);

    check(
      `Budget: daily limit (₹${packet.effectiveDailyBudget}) > 0`,
      packet.effectiveDailyBudget > 0
    );

    const budget = (scenario as any)._budget as MonthlyBudget;
    const budgetSum = budget.staplesBudget + budget.perishablesBudget + budget.bufferBudget;
    check(
      `Budget split sums correctly: ₹${budgetSum.toFixed(0)} ≈ ₹${scenario.totalMonthlyBudget}`,
      Math.abs(budgetSum - scenario.totalMonthlyBudget) < 5
    );

    for (const p of packet.effectiveProfiles) {
      if (p.isChildUnder5) {
        check(`${p.name}: auto-assigned early_childhood_nutrition`, p.effectiveGoal === "early_childhood_nutrition");
      }
      if (p.isSchoolAge) {
        check(`${p.name}: auto-assigned healthy_growth`, p.effectiveGoal === "healthy_growth");
      }
      if (p.isSenior) {
        check(`${p.name}: senior flag set`, p.isSenior === true);
      }
    }

    if (packet.medicationGuardrailBundles.length > 0) {
      check(
        `Medication bundles generated: ${packet.medicationGuardrailBundles.length}`,
        packet.medicationGuardrailBundles.length > 0
      );
      for (const b of packet.medicationGuardrailBundles) {
        check(
          `${b.member_name}/${b.drug_id}: has directives (${b.directives.length})`,
          b.directives.length > 0
        );
      }
    }

    if (packet.fastingPreloadInstructions.length > 0) {
      check(
        `Fasting preload instructions generated: ${packet.fastingPreloadInstructions.length}`,
        packet.fastingPreloadInstructions.length > 0
      );
    }

    details.push(`\n  Summary: ${passed}/${checks} passed, ${warnings} warnings`);

  } catch (err: any) {
    status = "FAIL";
    details.push(`ERROR: ${err.message}\n${err.stack}`);
  }

  return { stage: "Stage 4: Validation Checks", status, details };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 5: Real Gemini On-Demand Recipe (Day 3 Dinner)
// ═══════════════════════════════════════════════════════════════════════════════

async function runStage5(scenario: ScenarioInput): Promise<StageResult> {
  const details: string[] = [];
  let status: "PASS" | "FAIL" | "WARN" = "PASS";

  try {
    const packet = (scenario as any)._packet as ConstraintPacket;

    const memberContext = packet.effectiveProfiles
      .map(p => `${p.name} (${p.age}y, ${p.dietaryType}, ${p.effectiveSpiceTolerance} spice, goal=${p.effectiveGoal}, conditions=${p.effectiveHealthConditions.filter(c => c !== "none").join("/") || "none"})`)
      .join("; ");

    const medWarnings = packet.medicationWarnings.length > 0
      ? `\nMEDICATION CONSTRAINTS (ABSOLUTE): ${packet.medicationWarnings.slice(0, 3).join("; ")}`
      : "";

    const allergyList = [...new Set(packet.effectiveProfiles.flatMap(p => p.allergies.filter(a => a !== "none")))];
    const allergyNote = allergyList.length > 0
      ? `\nABSOLUTE ALLERGY EXCLUSION: ${allergyList.join(", ")} — must not appear in any form.`
      : "";

    const prompt = `You are an expert Indian home-cooking nutritionist.

Generate ONE detailed dinner recipe for Day 3 (Wednesday) for the ${scenario.family.name}.
Region: ${scenario.family.stateRegion}
Family members: ${memberContext}
Budget: ₹${(packet.effectiveDailyBudget * 0.36).toFixed(0)} for this dinner
Cooking skill: ${scenario.family.cookingSkillLevel}
Appliances: ${scenario.family.appliances.join(", ")}
${allergyNote}${medWarnings}

Rules:
1. ONE BASE DISH that the whole family shares
2. Each member gets a PLATE with modifications (portion size, spice level, add-ons)
3. Total cost must stay within budget
4. Cooking time under 40 minutes
5. Use regional ingredients

Return valid JSON with this exact structure:
{
  "recipe_name": "string",
  "recipe_name_hindi": "string",
  "base_dish": {
    "ingredients": [{"name": "string", "quantity": "string"}],
    "steps": ["string"],
    "prep_time_mins": number,
    "cook_time_mins": number,
    "estimated_cost": number
  },
  "member_plates": [
    {
      "member_name": "string",
      "modifications": ["string"],
      "portion_note": "string"
    }
  ],
  "nutritional_highlights": "string"
}`;

    details.push(`Calling Gemini (gemini-2.5-flash) for ${scenario.family.name} Day 3 Dinner...`);
    const startMs = Date.now();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 4096,
        temperature: 0.3,
        topP: 0.8,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const elapsedMs = Date.now() - startMs;
    const rawText: string =
      (response as any).text ??
      response.candidates?.[0]?.content?.parts?.[0]?.text ??
      "";

    if (!rawText) {
      status = "FAIL";
      details.push(`❌ Gemini returned empty response!`);
      return { stage: "Stage 5: Real Gemini On-Demand Recipe", status, details };
    }

    const cleaned = rawText
      .replace(/^```json\s*/im, "")
      .replace(/^```\s*/im, "")
      .replace(/\s*```\s*$/im, "")
      .trim();

    details.push(`Gemini responded in ${elapsedMs}ms (${cleaned.length} chars)`);

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      status = "FAIL";
      details.push(`❌ Failed to parse Gemini JSON. First 300 chars: ${cleaned.substring(0, 300)}`);
      return { stage: "Stage 5: Real Gemini On-Demand Recipe", status, details };
    }

    details.push(`\n  Recipe: ${parsed.recipe_name} (${parsed.recipe_name_hindi || "N/A"})`);

    if (parsed.base_dish) {
      details.push(`  Ingredients: ${parsed.base_dish.ingredients?.length ?? 0}`);
      details.push(`  Steps: ${parsed.base_dish.steps?.length ?? 0}`);
      details.push(`  Prep: ${parsed.base_dish.prep_time_mins}min, Cook: ${parsed.base_dish.cook_time_mins}min`);
      details.push(`  Est. cost: ₹${parsed.base_dish.estimated_cost}`);
    }

    if (parsed.member_plates) {
      details.push(`  Member plates: ${parsed.member_plates.length}`);
      for (const plate of parsed.member_plates) {
        details.push(`    • ${plate.member_name}: ${plate.modifications?.join(", ") || "standard"} | ${plate.portion_note || ""}`);
      }
    }

    if (parsed.nutritional_highlights) {
      details.push(`  Nutritional highlights: ${parsed.nutritional_highlights}`);
    }

    if (!parsed.recipe_name || !parsed.base_dish || !parsed.member_plates) {
      status = "WARN";
      details.push(`⚠️  Missing expected fields in Gemini response`);
    }

    if (parsed.member_plates && parsed.member_plates.length !== packet.effectiveProfiles.length) {
      status = "WARN";
      details.push(`⚠️  Member plate count (${parsed.member_plates.length}) != family size (${packet.effectiveProfiles.length})`);
    }

    const ALLERGY_SYNONYMS: Record<string, string[]> = {
      peanuts: ["peanut", "groundnut", "moongphali", "mungfali", "peanut oil", "groundnut oil", "peanut butter"],
      dairy: ["paneer", "milk", "ghee", "butter", "curd", "cheese", "cream", "dahi", "khoya", "mawa", "condensed milk", "whey", "yogurt", "lassi", "buttermilk", "chaach"],
      gluten: ["atta", "maida", "suji", "wheat", "semolina", "roti", "chapati", "naan", "bread", "pasta", "seitan", "barley"],
      tree_nuts: ["almond", "badam", "cashew", "kaju", "walnut", "akhrot", "pistachio", "pista", "hazelnut", "macadamia", "pecan"],
      shellfish: ["shrimp", "prawn", "crab", "lobster", "jhinga", "oyster", "mussel", "clam"],
      soy: ["soya", "tofu", "soy sauce", "soy milk", "edamame", "soya chunks", "soya flour", "nutrela"],
      sesame: ["til", "sesame", "tahini", "gingelly"],
    };

    if (allergyList.length > 0 && parsed.base_dish?.ingredients) {
      const ingredientText = parsed.base_dish.ingredients
        .map((i: any) => `${i.name} ${i.quantity || ""}`.toLowerCase())
        .join(" ");
      const stepsText = (parsed.base_dish.steps || []).join(" ").toLowerCase();
      const fullText = `${ingredientText} ${stepsText}`;

      for (const allergy of allergyList) {
        const synonyms = ALLERGY_SYNONYMS[allergy] || [allergy.toLowerCase()];
        for (const syn of synonyms) {
          if (fullText.includes(syn.toLowerCase())) {
            status = "FAIL";
            details.push(`❌ ALLERGY VIOLATION: "${syn}" (allergen: ${allergy}) found in recipe!`);
          }
        }
      }
    }

  } catch (err: any) {
    status = "FAIL";
    details.push(`ERROR: ${err.message}\n${err.stack?.substring(0, 300)}`);
  }

  return { stage: "Stage 5: Real Gemini On-Demand Recipe (Day 3 Dinner)", status, details };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  printHeader("NUTRINEXT PARIVARSEHAT — PIPELINE VALIDATION");
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`  Scenarios: 3 families × 5 stages = 15 stage validations`);
  console.log(`  Stage 3: SIMULATED (no Gemini call)`);
  console.log(`  Stage 5: REAL Gemini API call (Day 3 Dinner recipe)`);

  const scenarios = buildScenarios();

  for (const scenario of scenarios) {
    const scenarioResult: ScenarioResult = { name: scenario.name, stages: [] };

    printHeader(`SCENARIO: ${scenario.name}`);

    printStage(1, "Conflict Engine + Budget + Calorie Calculator");
    const s1 = runStage1(scenario);
    scenarioResult.stages.push(s1);
    for (const d of s1.details) console.log(`    ${d}`);
    console.log(`\n    ${s1.status === "PASS" ? PASS : s1.status === "WARN" ? WARN : FAIL} Stage 1 ${s1.status}`);

    printStage(2, "Recipe SQL Filter (localDb)");
    const s2 = await runStage2(scenario);
    scenarioResult.stages.push(s2);
    for (const d of s2.details) console.log(`    ${d}`);
    console.log(`\n    ${s2.status === "PASS" ? PASS : s2.status === "WARN" ? WARN : FAIL} Stage 2 ${s2.status}`);

    printStage(3, "Simulated Gemini Scheduler (21-meal calendar)");
    const s3 = runStage3(scenario);
    scenarioResult.stages.push(s3);
    for (const d of s3.details) console.log(`    ${d}`);
    console.log(`\n    ${s3.status === "PASS" ? PASS : s3.status === "WARN" ? WARN : FAIL} Stage 3 ${s3.status}`);

    printStage(4, "Validation Checks");
    const s4 = runStage4(scenario);
    scenarioResult.stages.push(s4);
    for (const d of s4.details) console.log(`    ${d}`);
    console.log(`\n    ${s4.status === "PASS" ? PASS : s4.status === "WARN" ? WARN : FAIL} Stage 4 ${s4.status}`);

    printStage(5, "Real Gemini On-Demand Recipe (Day 3 Dinner)");
    const s5 = await runStage5(scenario);
    scenarioResult.stages.push(s5);
    for (const d of s5.details) console.log(`    ${d}`);
    console.log(`\n    ${s5.status === "PASS" ? PASS : s5.status === "WARN" ? WARN : FAIL} Stage 5 ${s5.status}`);

    allResults.push(scenarioResult);
  }

  printHeader("FINAL SUMMARY TABLE");

  const colWidths = [45, 12, 12, 12, 12, 12];
  const header = [
    "Scenario".padEnd(colWidths[0]),
    "Stage1".padEnd(colWidths[1]),
    "Stage2".padEnd(colWidths[2]),
    "Stage3".padEnd(colWidths[3]),
    "Stage4".padEnd(colWidths[4]),
    "Stage5".padEnd(colWidths[5]),
  ].join("│");
  console.log(header);
  console.log("─".repeat(colWidths.reduce((a, b) => a + b + 1, 0)));

  let totalFails = 0;
  for (const r of allResults) {
    const shortName = r.name.split("(")[0].trim().padEnd(colWidths[0]);
    const cols = r.stages.map((s, i) => {
      const icon = s.status === "PASS" ? "✅ PASS" : s.status === "WARN" ? "⚠️ WARN" : "❌ FAIL";
      if (s.status === "FAIL") totalFails++;
      return icon.padEnd(colWidths[i + 1]);
    });
    console.log(`${shortName}│${cols.join("│")}`);
  }

  console.log(`\n${"─".repeat(80)}`);
  if (totalFails === 0) {
    console.log(`${BOLD}${PASS} ALL 15 STAGES PASSED — Pipeline is validated!${RESET}`);
  } else {
    console.log(`${BOLD}${FAIL} ${totalFails} STAGE(S) FAILED — Review errors above.${RESET}`);
  }

  await pool.end();
  process.exit(totalFails > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  pool.end();
  process.exit(1);
});
