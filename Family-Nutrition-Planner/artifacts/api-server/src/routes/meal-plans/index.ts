import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq, and, or, gt, inArray, lte, sql, desc, ilike } from "drizzle-orm";
import { db, localDb } from "@workspace/db";
import {
  familiesTable, familyMembersTable, mealPlansTable, recipesTable, mealFeedbackTable,
  leftoverItemsTable,
} from "@workspace/db";
import {
  GenerateMealPlanBody,
  ListMealPlansQueryParams,
  GetMealPlanParams,
  UpdateMealPlanParams,
  UpdateMealPlanBody,
  DeleteMealPlanParams,
} from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";
import { getICMRNINTargets } from "../../lib/icmr-nin.js";
import { getFestivalFastingForWeek } from "../../lib/festival-fasting.js";
import { resolveDietPreference } from "../../lib/diet-tag.js";
import { applyArbitrageToPlan } from "../../lib/arbitrage-engine.js";
import { filterByAppliances, ALL_APPLIANCES, detectRequiredAppliances } from "../../lib/appliance-filter.js";
import { getSeasonalIngredients, type Region, type Month } from "../../lib/seasonal-ingredients.js";
import { validateMealForMembers, getSafeFallback, type MemberProfile, type Violation } from "../../lib/meal-plan-validator.js";
import { scoreThaliCompleteness } from "../../lib/thali-scorer.js";

const router: IRouter = Router();

const MAX_OUTPUT_TOKENS = 32768;

function tryParseJson(text: string): Record<string, unknown> | null {
  // Strategy 1: Direct parse
  try { return JSON.parse(text) as Record<string, unknown>; } catch { /* fall through */ }

  // Strategy 2: Extract from markdown fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()) as Record<string, unknown>; } catch { /* fall through */ }
  }

  // Strategy 3: Find outermost braces
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try { return JSON.parse(text.slice(braceStart, braceEnd + 1)) as Record<string, unknown>; } catch { /* fall through */ }
  }

  // Strategy 4: Fix common Gemini JSON formatting errors
  const slice = braceStart !== -1 && braceEnd > braceStart
    ? text.slice(braceStart, braceEnd + 1)
    : text;
  const cleaned = slice
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'\s*:/g, '"$1":')
    .replace(/([{,\[]\s*)(\w+)\s*:/g, '$1"$2":')
    .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"');
  try { return JSON.parse(cleaned) as Record<string, unknown>; } catch { /* fall through */ }

  // Strategy 5: More aggressive — replace all unescaped single quotes used as string delimiters
  const aggressive = slice
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/([{,\[]\s*)'([^']*)'\s*:/g, '$1"$2":')
    .replace(/([{,\[]\s*)(\w+)\s*:/g, '$1"$2":')
    .replace(/:\s*'([^']*)'/g, ': "$1"')
    .replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(aggressive) as Record<string, unknown>; } catch { /* fall through */ }

  return null;
}

const GEMINI_JSON_CRITICAL_SUFFIX = `

CRITICAL REMINDER: Return ONLY raw valid JSON. No markdown fences, no backticks, no prose before or after. The response must start with { and end with }.`;

// Strict week-plan output schema — validated before persisting to DB
// Canonical structured schemas for base_ingredients and member_adjustments
const BaseIngredientSchema = z.object({ ingredient: z.string(), qty_grams: z.number().optional() });
const MemberAdjustmentSchema = z.object({
  add: z.array(z.union([BaseIngredientSchema, z.string()])).optional().default([]),
  reduce: z.array(z.string()).optional().default([]),
  avoid: z.array(z.string()).optional().default([]),
});

// Accepts both legacy (recipeName/member_plates) and canonical (base_dish_name/member_adjustments) field names
const MealSlotSchema = z.object({
  recipeName: z.string().optional(),
  base_dish_name: z.string().optional(),
  recipeId: z.number().nullable().optional(),
  nameHindi: z.string().optional(),
  calories: z.number().optional(),
  estimatedCost: z.number().optional(),
  icmr_rationale: z.string().optional(),
  required_appliances: z.array(z.string()).default([]),
  member_plates: z.record(z.string(), z.unknown()).optional(),
  member_adjustments: z.record(z.string(), MemberAdjustmentSchema).optional(),
  // For AI-invented recipes: structured objects only (no plain strings)
  base_ingredients: z.array(BaseIngredientSchema).optional(),
  // Legacy plain-string ingredients list still accepted for DB recipes; also accept comma-string from AI
  ingredients: z.union([z.array(z.string()), z.string()]).optional(),
  _hfssRebalance: z.unknown().optional(),
  _arbitrageNote: z.unknown().optional(),
}).refine(
  data => (data.recipeName !== undefined || data.base_dish_name !== undefined),
  { message: "Either recipeName or base_dish_name must be present" },
).refine(
  data => {
    // Only enforce base_ingredients when Gemini explicitly marks slot as AI-invented (recipeId=null)
    if (data.recipeId === null) {
      return Array.isArray(data.base_ingredients) && data.base_ingredients.length > 0;
    }
    return true;
  },
  { message: "AI-invented slots (recipeId=null) must include base_ingredients as a non-empty structured array" },
);

const DayPlanSchema = z.object({
  day: z.string(),
  meals: z.object({
    breakfast: MealSlotSchema,
    mid_morning: MealSlotSchema,
    lunch: MealSlotSchema,
    evening_snack: MealSlotSchema,
    dinner: MealSlotSchema,
  }),
});

const WeekPlanSchema = z.object({
  days: z.array(DayPlanSchema).min(1),
  harmonyScore: z.number().optional(),
  totalBudgetEstimate: z.number().optional(),
  aiInsights: z.string().optional(),
});

const HalfMealSlotSchema = z.object({
  recipeName: z.string().optional(),
  base_dish_name: z.string().optional(),
}).refine(
  d => d.recipeName !== undefined || d.base_dish_name !== undefined,
  { message: "Either recipeName or base_dish_name required" },
);

const HalfPlanSchema = z.object({
  days: z.array(z.object({
    day: z.string(),
    meals: z.object({
      breakfast: HalfMealSlotSchema,
      mid_morning: HalfMealSlotSchema,
      lunch: HalfMealSlotSchema,
      evening_snack: HalfMealSlotSchema,
      dinner: HalfMealSlotSchema,
    }),
  })).min(1),
});

async function callGeminiWithJsonRetry(
  prompt: string,
  label: string,
  log: { info: (obj: Record<string, unknown>, msg: string) => void; error: (obj: Record<string, unknown>, msg: string) => void },
  signal?: AbortSignal,
  zodSchema?: z.ZodType<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const MAX_RETRIES = 5;
  const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];

  let lastErr: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error("AbortError: meal plan generation aborted");
    const activePrompt = attempt >= 2 ? prompt + GEMINI_JSON_CRITICAL_SUFFIX : prompt;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: activePrompt }] }],
        config: { maxOutputTokens: MAX_OUTPUT_TOKENS, responseMimeType: "application/json" },
        abortSignal: signal,
      });
      const text = response.text ?? "{}";
      const data = tryParseJson(text);
      if (data !== null) {
        // If a schema validator is provided, validate before accepting
        if (zodSchema) {
          const validation = zodSchema.safeParse(data);
          if (!validation.success) {
            const issues = validation.error.issues.slice(0, 3).map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
            lastErr = new Error(`Schema validation failed: ${issues}`);
            log.error({ label, attempt: attempt + 1, schemaErrors: issues }, `${label}: schema validation failed on attempt ${attempt + 1}`);
            continue;
          }
        }
        if (attempt > 0) log.info({ label, attempt: attempt + 1 }, `${label}: JSON parse + schema validation succeeded on attempt ${attempt + 1}`);
        return data;
      }
      lastErr = new Error(`JSON parse failed after 5 strategies — raw length: ${text.length}, preview: ${text.slice(0, 200)}`);
      log.error({ label, attempt: attempt + 1, rawText: text.slice(0, 500) }, `${label}: JSON parse failed on attempt ${attempt + 1}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      lastErr = err;
      log.error({ label, attempt: attempt + 1, err: errMsg }, `${label}: API error on attempt ${attempt + 1}: ${errMsg}`);
    }

    if (attempt < MAX_RETRIES - 1) {
      const delay = BACKOFF_MS[attempt];
      log.info({ label, nextRetryMs: delay }, `${label}: retrying in ${delay}ms (attempt ${attempt + 2}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`Meal plan generation failed after ${MAX_RETRIES} attempts — ${errMsg}`);
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
  rajasthan: "west",
  gujarat: "west", maharashtra: "west", goa: "west",
  karnataka: "south", kerala: "south", tamilnadu: "south",
  andhrapradesh: "south", telangana: "south",
  westbengal: "east", odisha: "east", jharkhand: "east",
  assam: "east", manipur: "east", meghalaya: "east",
  madhyapradesh: "central", chhattisgarh: "central",
  bihar: "north", uttarakhand2: "north",
};

function getZoneForState(state: string): string {
  const normalized = state.toLowerCase().replace(/\s+/g, "");
  return STATE_TO_ZONE[normalized] || "north";
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

  const conditions: Parameters<typeof and>[0][] = [];
  if (dietPref) {
    conditions.push(eq(recipesTable.diet, dietPref));
  }
  if (isFasting) {
    conditions.push(eq(recipesTable.course, "fasting"));
  }
  if (budgetPerServing > 0) {
    conditions.push(lte(recipesTable.costPerServing, budgetPerServing * 1.5));
  }
  if (maxCookTimeMin !== null && maxCookTimeMin > 0) {
    conditions.push(lte(recipesTable.totalTimeMin, maxCookTimeMin));
  }

  const RECIPE_SELECT = {
    id: recipesTable.id,
    name: recipesTable.name,
    nameHindi: recipesTable.nameHindi,
    cuisine: recipesTable.cuisine,
    category: recipesTable.category,
    diet: recipesTable.diet,
    calories: recipesTable.calories,
    protein: recipesTable.protein,
    carbs: recipesTable.carbs,
    fat: recipesTable.fat,
    fiber: recipesTable.fiber,
    costPerServing: recipesTable.costPerServing,
    course: recipesTable.course,
    zone: recipesTable.zone,
    totalTimeMin: recipesTable.totalTimeMin,
    ingredients: recipesTable.ingredients,
    instructions: recipesTable.instructions,
  } as const;

  let recipes = await localDb.select(RECIPE_SELECT)
    .from(recipesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit * 3);

  // Fasting ingredient-based fallback: if course-filter yields too few, supplement with
  // recipes containing known fasting-safe ingredients (sabudana, kuttu, singhara, etc.)
  if (isFasting && recipes.length < 20) {
    const fastingIngredients = ["sabudana", "kuttu", "singhara", "makhana", "samak", "rajgira", "sendha namak", "arrowroot", "water chestnut"];
    const baseConditions: Parameters<typeof and>[0][] = [];
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

  const combined = [...zoneMatching, ...fallback].slice(0, limit);
  return combined;
}

interface LeftoverChainStep {
  step: number;
  day: string;
  meal: string;
  dish: string;
  recipeId: number | null;
  source: "recipe_db" | "ai_generated";
}

/**
 * Build a 3-step leftover chain for a dinner recipe using DB recipes that share ingredients.
 * Returns recipe_db sourced steps where possible; falls back to ai_generated descriptions.
 */
async function buildDbLeftoverChain(
  dinnerRecipeId: number | null,
  nextDay: string,
  dayAfterNext: string,
  aiChain?: Array<{ step: number; day: string; meal: string; dish: string }>,
): Promise<LeftoverChainStep[]> {
  if (!dinnerRecipeId) {
    // No recipe ID — use AI-generated chain with source label
    return (aiChain ?? []).map(c => ({ ...c, recipeId: null, source: "ai_generated" as const }));
  }

  const [dinnerRecipe] = await localDb.select({
    id: recipesTable.id,
    name: recipesTable.name,
    ingredients: recipesTable.ingredients,
    diet: recipesTable.diet,
    course: recipesTable.course,
  }).from(recipesTable).where(eq(recipesTable.id, dinnerRecipeId));

  if (!dinnerRecipe?.ingredients) {
    return (aiChain ?? []).map(c => ({ ...c, recipeId: null, source: "ai_generated" as const }));
  }

  // Extract 2-3 key ingredient words from dinner
  const ingredientWords = dinnerRecipe.ingredients
    .split(/[,;\n]/)
    .map(w => w.trim().toLowerCase().split(/\s+/)[0])
    .filter(w => w.length > 3 && !["with", "some", "half", "fresh", "tbsp", "tsp", "cups", "salt", "water", "1/2", "1/4"].includes(w))
    .slice(0, 3);

  if (ingredientWords.length === 0) {
    return (aiChain ?? []).map(c => ({ ...c, recipeId: null, source: "ai_generated" as const }));
  }

  // Find related recipes that share ingredients with the dinner
  const relatedRecipes = await localDb.select({
    id: recipesTable.id,
    name: recipesTable.name,
    course: recipesTable.course,
    diet: recipesTable.diet,
  }).from(recipesTable)
    .where(
      and(
        eq(recipesTable.diet, dinnerRecipe.diet ?? "vegetarian"),
        ilike(recipesTable.ingredients, `%${ingredientWords[0]}%`),
      )
    )
    .limit(10);

  // Target: step 1 = lunch recipe, step 2 = breakfast recipe, step 3 = snack (use AI)
  const lunchRecipe = relatedRecipes.find(r => r.course === "lunch" || r.course === "main course") ?? relatedRecipes[0];
  const breakfastRecipe = relatedRecipes.find(r => r.course === "breakfast") ?? relatedRecipes[1];

  const chain: LeftoverChainStep[] = [
    {
      step: 1,
      day: nextDay,
      meal: "Lunch",
      dish: lunchRecipe
        ? `${lunchRecipe.name} (using leftover ${dinnerRecipe.name} base)`
        : (aiChain?.[0]?.dish ?? `Leftover ${dinnerRecipe.name} for lunch`),
      recipeId: lunchRecipe?.id ?? null,
      source: lunchRecipe ? "recipe_db" : "ai_generated",
    },
    {
      step: 2,
      day: dayAfterNext,
      meal: "Breakfast",
      dish: breakfastRecipe
        ? `${breakfastRecipe.name} (with ${ingredientWords[0]} from leftover)`
        : (aiChain?.[1]?.dish ?? `Quick ${ingredientWords[0]} breakfast from leftovers`),
      recipeId: breakfastRecipe?.id ?? null,
      source: breakfastRecipe ? "recipe_db" : "ai_generated",
    },
    {
      step: 3,
      day: dayAfterNext,
      meal: "Snack",
      dish: aiChain?.[2]?.dish ?? `${ingredientWords[0]} snack from pantry`,
      recipeId: null,
      source: "ai_generated",
    },
  ];

  return chain;
}

/**
 * Enrich the Gemini plan's dinner meals with DB-backed leftover chains.
 */
async function enrichPlanWithDbLeftoverChains(planData: Record<string, unknown>): Promise<Record<string, unknown>> {
  const days = planData.days as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(days)) return planData;

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const enrichedDays = await Promise.all(days.map(async (day, idx) => {
    const meals = day.meals as Record<string, unknown> | undefined;
    if (!meals) return day;

    const dinner = meals.dinner as Record<string, unknown> | undefined;
    if (!dinner) return day;

    const dinnerRecipeId = typeof dinner.recipeId === "number" ? dinner.recipeId : null;
    const aiChain = Array.isArray(dinner.leftoverChain)
      ? dinner.leftoverChain as Array<{ step: number; day: string; meal: string; dish: string }>
      : undefined;

    const nextDay = dayNames[(idx + 1) % 7];
    const dayAfterNext = dayNames[(idx + 2) % 7];

    const leftoverChain = await buildDbLeftoverChain(dinnerRecipeId, nextDay, dayAfterNext, aiChain);

    return {
      ...day,
      meals: {
        ...meals,
        dinner: {
          ...dinner,
          leftoverChain,
          leftoverChainSource: leftoverChain.some(s => s.source === "recipe_db") ? "recipe_db" : "ai_generated",
        },
      },
    };
  }));

  return { ...planData, days: enrichedDays };
}

router.get("/meal-plans", async (req, res): Promise<void> => {
  const query = ListMealPlansQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message, retryable: false });
    return;
  }
  try {
    const plans = await db.select().from(mealPlansTable)
      .where(eq(mealPlansTable.familyId, query.data.familyId))
      .orderBy(desc(mealPlansTable.createdAt));
    res.json(plans.map(p => ({ ...p, harmonyScore: Number(p.harmonyScore) })));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to fetch meal plans", details: msg, retryable: true });
  }
});

router.post("/meal-plans/generate", async (req, res): Promise<void> => {
  const parsed = GenerateMealPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, retryable: false });
    return;
  }

  const { familyId, weekStartDate, preferences, weeklyContext } = parsed.data;

  let family: typeof familiesTable.$inferSelect | undefined;
  let members: Array<typeof familyMembersTable.$inferSelect>;
  try {
    [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, familyId));
    if (!family) {
      res.status(404).json({ error: "Family not found", retryable: false });
      return;
    }
    if (family.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden: you do not own this family", retryable: false });
      return;
    }
    members = await db.select().from(familyMembersTable)
      .where(eq(familyMembersTable.familyId, familyId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to load family data", details: msg, retryable: true });
    return;
  }

  const zone = getZoneForState(family.state || "Delhi");
  const weeklyBudget = Math.round(Number(family.monthlyBudget) / 4);
  const budgetPerMeal = Math.round(weeklyBudget / (7 * 4));

  const allRestrictions = members.flatMap(m => m.dietaryRestrictions ?? []);

  // Auto-detect fasting: explicit preference overrides; otherwise derive from festival calendar + member prefs
  const explicitFasting = preferences?.isFasting;
  const memberFastingDays = allRestrictions.filter(r => r.startsWith("fasting:"));
  const hasMemberFastingPrefs = memberFastingDays.length > 0;

  const weekStart = new Date(weekStartDate);

  // Check festival calendar for any fasting days in target week
  const festivalFasting = getFestivalFastingForWeek(weekStart);

  // Check if any day in the target week matches a member's weekly fasting day
  const weekDays = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const daysInWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return weekDays[d.getDay()];
  });
  const weekHasMemberFastingDay = hasMemberFastingPrefs && daysInWeek.some(d =>
    memberFastingDays.some(f => f === `fasting:${d}` || f === `fasting:ekadashi`)
  );

  // Auto-fasting: festival calendar OR member weekly fasting days
  const autoFasting = festivalFasting.isFestivalFasting || weekHasMemberFastingDay;
  // Explicit preference wins; otherwise auto-enable from festival or member schedule
  const isFasting = explicitFasting !== undefined ? explicitFasting : autoFasting;

  const festivalContext = festivalFasting.isFestivalFasting
    ? `\n🎉 FESTIVAL WEEK: ${festivalFasting.festivals.map(f => `${f.name} (${f.fastingType} fast)`).join(", ")}. Recommended festival foods: ${festivalFasting.recommendedFoods.slice(0, 8).join(", ")}\n`
    : "";

  // Extract cooking time preference from family cuisinePreferences array (stored as "cooking_time:moderate")
  const cookingTimePref = (family.cuisinePreferences ?? []).find(p => p.startsWith("cooking_time:"));
  const maxCookTimeMin = cookingTimePref
    ? cookingTimePref.includes("quick") ? 30
      : cookingTimePref.includes("moderate") ? 60
      : null
    : null;

  if (members.length === 0) {
    res.status(422).json({ error: "Family must have at least one member before generating a meal plan.", retryable: false });
    return;
  }

  const ownedAppliances = family.appliances ?? ["tawa", "pressure_cooker", "kadai"];

  const currentMonth = (new Date().getMonth() + 1) as Month;
  const seasonalData = getSeasonalIngredients(zone as Region, currentMonth);

  let filteredRecipes: Awaited<ReturnType<typeof getFilteredRecipes>>;
  let previousFeedback: Array<typeof mealFeedbackTable.$inferSelect>;
  try {
    filteredRecipes = await getFilteredRecipes(zone, allRestrictions, budgetPerMeal, isFasting, maxCookTimeMin, 100);

    filteredRecipes = filterByAppliances(filteredRecipes, ownedAppliances);

    if (filteredRecipes.length < 10) {
      req.log.info({ familyId, zone, count: filteredRecipes.length }, "Too few recipes after appliance filter — relaxing budget constraint");
      let relaxed = await getFilteredRecipes(zone, allRestrictions, 0, isFasting, null, 150);
      filteredRecipes = filterByAppliances(relaxed, ownedAppliances);
    }
    if (filteredRecipes.length < 10) {
      req.log.info({ familyId, zone, count: filteredRecipes.length }, "Still too few — removing dietary filter but keeping appliance filter");
      let relaxed = await getFilteredRecipes(zone, [], 0, isFasting, null, 200);
      filteredRecipes = filterByAppliances(relaxed, ownedAppliances);
    }
    if (filteredRecipes.length === 0) {
      res.status(422).json({ error: "No recipes found matching your kitchen appliances. Try adding more appliances in your family profile.", retryable: false });
      return;
    }

    previousFeedback = await db.select().from(mealFeedbackTable)
      .where(and(eq(mealFeedbackTable.familyId, familyId)))
      .orderBy(mealFeedbackTable.createdAt)
      .limit(50);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to load recipe data", details: msg, retryable: true });
    return;
  }

  const dislikedMeals = previousFeedback.filter(f => !f.liked).map(f => `${f.mealType} on Day ${f.dayIndex + 1}: ${f.skipReason || "disliked"}`);
  const likedMeals = previousFeedback.filter(f => f.liked && (f.rating ?? 0) >= 4).map(f => `${f.mealType} on Day ${f.dayIndex + 1}`);

  let activeLeftovers: Array<{ ingredientName: string; quantityEstimate: string | null; hoursAge: number }> = [];
  try {
    const now = new Date();
    const rawLeftovers = await db.select().from(leftoverItemsTable)
      .where(and(
        eq(leftoverItemsTable.familyId, familyId),
        eq(leftoverItemsTable.usedUp, false),
        gt(leftoverItemsTable.expiresAt, now),
      ));
    activeLeftovers = rawLeftovers.map(l => ({
      ingredientName: l.ingredientName,
      quantityEstimate: l.quantityEstimate,
      hoursAge: Math.round((now.getTime() - l.loggedAt.getTime()) / (1000 * 60 * 60)),
    }));
  } catch { /* non-critical */ }

  const skippedMeals = previousFeedback
    .filter(f => f.skipReason === "skipped" || f.skipReason === "ate_out")
    .map(f => `${f.mealType} on Day ${f.dayIndex + 1} (${f.skipReason})`);

  let flavorFatigueNote = "";
  try {
    const [lastPlan] = await db.select({ plan: mealPlansTable.plan })
      .from(mealPlansTable)
      .where(eq(mealPlansTable.familyId, familyId))
      .orderBy(desc(mealPlansTable.createdAt))
      .limit(1);
    if (lastPlan?.plan) {
      const lastDays = (lastPlan.plan as { days?: Array<{ meals?: Record<string, { base_dish_name?: string; recipeName?: string }> }> }).days ?? [];
      const recentDishes = lastDays.slice(-3).flatMap(d => {
        const meals = d.meals ?? {};
        return Object.values(meals).map(m => m.base_dish_name || m.recipeName).filter(Boolean);
      });
      if (recentDishes.length > 0) {
        flavorFatigueNote = `\n🔄 FLAVOR FATIGUE — AVOID repeating these dishes from last week's final days: ${recentDishes.slice(0, 12).join(", ")}. Use different flavor profiles and spice combinations.\n`;
      }
    }
  } catch { /* non-critical */ }

  const memberSummaries = members.map(m => ({
    name: m.name, role: m.role, age: m.age, gender: m.gender,
    activityLevel: m.activityLevel,
    healthConditions: m.healthConditions ?? [],
    dietaryRestrictions: m.dietaryRestrictions ?? [],
    allergies: m.allergies ?? [],
    primaryGoal: m.primaryGoal ?? null,
    goalPace: m.goalPace ?? null,
    tiffinType: m.tiffinType ?? null,
    religiousRules: m.religiousRules ?? null,
    ingredientDislikes: m.ingredientDislikes ?? [],
    nonVegDays: m.nonVegDays ?? [],
    nonVegTypes: m.nonVegTypes ?? [],
    icmrCaloricTarget: m.icmrCaloricTarget ?? null,
    targets: getICMRNINTargets(m.age, m.gender, m.activityLevel, m.healthConditions ?? []),
  }));

  const pantryIngredients = [
    ...(preferences?.pantryIngredients ?? []),
    ...(weeklyContext?.pantry_items ?? []),
  ];
  const festivalType = preferences?.festivalType;

  const fastingNote = isFasting
    ? `\n🙏 FASTING MODE${festivalType ? ` (${festivalType})` : ""}: Include sabudana, kuttu, singhara, fruits, milk-based dishes, and sendha namak items. ${festivalFasting.recommendedFoods.length > 0 ? `Festival foods: ${festivalFasting.recommendedFoods.slice(0, 6).join(", ")}.` : ""}\n`
    : festivalType
      ? `\n🎉 FESTIVAL: ${festivalType}. Include traditional festive dishes and sweets where appropriate.\n`
      : "";

  const pantryNote = pantryIngredients.length > 0
    ? `\n🏠 PANTRY ITEMS (already at home): ${pantryIngredients.join(", ")}.\nPREFER recipes that use these ingredients to minimise shopping. Incorporate them into breakfast/lunch/dinner where nutritionally appropriate.\n`
    : "";

  const leftoverNote = activeLeftovers.length > 0
    ? `\n♻️ LEFTOVER PRIORITY (USE THESE FIRST): ${activeLeftovers.map(l => `${l.ingredientName}${l.quantityEstimate ? ` (${l.quantityEstimate})` : ""} — logged ${l.hoursAge}h ago`).join(", ")}.\nDesign Day 1 meals to creatively use ALL of these before introducing new ingredients. Examples: leftover rice → lemon rice/curd rice/fried rice; leftover dal → dal paratha/dal chawal; leftover sabzi → stuffed paratha/wrap.\n`
    : "";

  const skippedMealsNote = skippedMeals.length > 0
    ? `\n⏭️ SKIPPED/ATE-OUT MEALS last plan: ${skippedMeals.join(", ")}. Adjust nutrition targets to compensate for missed meals.\n`
    : "";

  const feedbackNote = dislikedMeals.length > 0
    ? `\nPREVIOUS FEEDBACK - AVOID these types:\n${dislikedMeals.slice(0, 10).join("\n")}\nCONTINUE these popular meals:\n${likedMeals.slice(0, 5).join("\n")}\n`
    : "";

  const seasonalNote = `\n🌿 SEASONAL PRODUCE (${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][currentMonth - 1]}, ${zone} India): Vegetables: ${seasonalData.vegetables.join(", ")}. Fruits: ${seasonalData.fruits.join(", ")}. Grains: ${seasonalData.grains.join(", ")}.\nPREFER seasonal ingredients — they are fresher, cheaper, and more nutritious.\n`;

  const missingAppliances = ALL_APPLIANCES.filter(a => !ownedAppliances.includes(a));
  const applianceNote = `\n🍳 KITCHEN APPLIANCES AVAILABLE: ${ownedAppliances.join(", ")}.\nNEVER suggest recipes requiring: ${missingAppliances.join(", ")}.\nFor each meal slot, include "required_appliances":["tawa"] (array of appliances needed from the available list).\n`;

  const memberListForPrompt = memberSummaries.map(m => ({
    name: m.name, role: m.role, age: m.age, gender: m.gender,
    conditions: m.healthConditions,
    diet: m.dietaryRestrictions,
    allergies: m.allergies,
    ...(m.primaryGoal ? { goal: m.primaryGoal } : {}),
    ...(m.goalPace && m.goalPace !== "none" ? { goalPace: `${m.goalPace}kg/week` } : {}),
    ...(m.tiffinType && m.tiffinType !== "none" ? { tiffin: m.tiffinType } : {}),
    ...(m.religiousRules && m.religiousRules !== "none" ? { religiousRules: m.religiousRules } : {}),
    ...(m.ingredientDislikes && m.ingredientDislikes.length > 0 ? { dislikes: m.ingredientDislikes } : {}),
    ...(m.nonVegDays && m.nonVegDays.length > 0 ? { nonVegDays: m.nonVegDays } : {}),
    ...(m.nonVegTypes && m.nonVegTypes.length > 0 ? { nonVegTypes: m.nonVegTypes } : {}),
    ...(m.icmrCaloricTarget ? { icmrKcalTarget: m.icmrCaloricTarget } : {}),
  }));

  const recipeListForPrompt = filteredRecipes.slice(0, 25).map(r => ({
    id: r.id, name: r.name, course: r.course, diet: r.diet, cal: r.calories, cost: r.costPerServing,
  }));

  // ── Master Prompt Architecture ─────────────────────────────────────────────────
  // Three explicit labeled sections as per ICMR-NIN 2024 guardrails design pattern.
  // Section priority order (highest→lowest): WEEKLY CONTEXT OVERRIDES > STATIC PROFILE > CLINICAL GUARDRAILS
  const baselineLines: string[] = [];
  if (family.mealsAreShared && (family.sharedTypicalBreakfast || family.sharedTypicalLunch || family.sharedTypicalDinner)) {
    baselineLines.push("CURRENT DIETARY BASELINE — shared by all members (IMPROVE upon this, keep familiar where possible):");
    if (family.sharedTypicalBreakfast) baselineLines.push(`  Breakfast: ${family.sharedTypicalBreakfast}`);
    if (family.sharedTypicalLunch) baselineLines.push(`  Lunch: ${family.sharedTypicalLunch}`);
    if (family.sharedTypicalDinner) baselineLines.push(`  Dinner: ${family.sharedTypicalDinner}`);
  } else if (!family.mealsAreShared) {
    const memberBaselines = members
      .filter(m => m.individualTypicalBreakfast || m.individualTypicalLunch || m.individualTypicalDinner)
      .map(m => {
        const parts: string[] = [];
        if (m.individualTypicalBreakfast) parts.push(`Breakfast: ${m.individualTypicalBreakfast}`);
        if (m.individualTypicalLunch) parts.push(`Lunch: ${m.individualTypicalLunch}`);
        if (m.individualTypicalDinner) parts.push(`Dinner: ${m.individualTypicalDinner}`);
        return parts.length > 0 ? `  ${m.name}: ${parts.join(" | ")}` : "";
      })
      .filter(Boolean);
    if (memberBaselines.length > 0) {
      baselineLines.push("CURRENT DIETARY BASELINE — per member (IMPROVE upon this, keep familiar where possible):");
      baselineLines.push(...memberBaselines);
    }
  }
  const baselineNote = baselineLines.length > 0 ? `\n${baselineLines.join("\n")}\n` : "";

  const masterPromptSection1 = `
══════════════════════════════════════════════════════════════════
SECTION 1 — STATIC FAMILY PROFILE (permanent dietary contract)
══════════════════════════════════════════════════════════════════
You are ParivarSehat AI — certified ICMR-NIN 2024 India family nutritionist.

Family: ${family.name} from ${family.state} (${zone.toUpperCase()} zone), ${members.length} members.
Weekly budget: ₹${weeklyBudget} (≤₹${budgetPerMeal * members.length}/meal)
Cuisine preference: ${(family.cuisinePreferences ?? []).join(", ") || "North Indian"}

FAMILY MEMBERS (permanent profile — always apply):
${JSON.stringify(memberListForPrompt)}
${baselineNote}
AVAILABLE RECIPES (prefer these IDs; recipeId:null = AI-invented):
${JSON.stringify(recipeListForPrompt)}
${festivalContext}${feedbackNote}`.trim();

  const masterPromptSection2 = weeklyContext ? `

══════════════════════════════════════════════════════════════════
SECTION 2 — WEEKLY CONTEXT OVERRIDES (highest priority this week)
══════════════════════════════════════════════════════════════════
These OVERRIDE the static profile above for THIS WEEK ONLY.
${weeklyContext.special_request ? `⭐ SPECIAL REQUEST (MUST satisfy — highest override priority): ${weeklyContext.special_request}` : ""}
${weeklyContext.budget_inr ? `• Weekly budget this week: ₹${weeklyContext.budget_inr} (overrides default ₹${weeklyBudget})` : ""}
${weeklyContext.dining_out_freq ? `• Eating out approximately ${weeklyContext.dining_out_freq} meal occasion(s) this week — plan ${Math.max(3, 7 - weeklyContext.dining_out_freq)} home-cooked days, fewer if eating out frequently` : ""}
${weeklyContext.weekday_prep_time ? `• Weekday cook time: ${weeklyContext.weekday_prep_time}` : ""}
${weeklyContext.weekend_prep_time ? `• Weekend cook time: ${weeklyContext.weekend_prep_time}` : ""}
${weeklyContext.member_overrides ? Object.entries(weeklyContext.member_overrides).map(([_key, ov]) => {
  const member = members.find(m => m.id === ov.memberId);
  const memberName = member?.name ?? `member#${ov.memberId}`;
  const parts: string[] = [];
  if (ov.feeling_this_week) parts.push(`feeling ${ov.feeling_this_week}`);
  if (ov.fasting_days?.length) parts.push(`fasting on ${ov.fasting_days.join(", ")}`);
  if (ov.tiffin_override) parts.push("tiffin needed");
  if (ov.spice_override) parts.push(`spice level: ${ov.spice_override}`);
  if (ov.weight_kg) parts.push(`current weight ${ov.weight_kg}kg — recalculate calorie target accordingly`);
  if (ov.nonveg_days_override?.length) parts.push(`non-veg allowed on ${ov.nonveg_days_override.join(", ")} (type: ${ov.nonveg_type_override ?? "any"})`);
  return parts.length ? `• ${memberName}: ${parts.join("; ")}` : "";
}).filter(Boolean).join("\n") : ""}
${fastingNote}${pantryNote}${leftoverNote}${skippedMealsNote}${seasonalNote}${applianceNote}${flavorFatigueNote}`.trim() : `

══════════════════════════════════════════════════════════════════
SECTION 2 — WEEKLY CONTEXT OVERRIDES (none this week)
══════════════════════════════════════════════════════════════════
No weekly context provided. Use defaults from Section 1.
${fastingNote}${pantryNote}${leftoverNote}${skippedMealsNote}${seasonalNote}${applianceNote}${flavorFatigueNote}`.trim();

  const masterPromptSection3 = `

══════════════════════════════════════════════════════════════════
SECTION 3 — ICMR-NIN 2024 CLINICAL GUARDRAILS (always enforce)
══════════════════════════════════════════════════════════════════
• ONE BASE MANY PLATES: Every dinner/lunch = one dish cooked once, portioned differently per member health need.
• HFSS AVOIDANCE: Never suggest High-Fat-Sugar-Salt foods (chips, cola, instant noodles, maida deep-fried items). If a member had HFSS today, their next meal must compensate with dal, greens, or high-fibre item.
• CALORIE TARGETS: Match each member's ICMR-NIN 2024 age/gender caloric target. Under-18 and over-60 must never have a calorie deficit.
• CEREAL:PULSE RATIO: Maintain a 3:1 cereal-to-pulse ratio across the day (e.g. 300g cereals: 100g pulses). Every lunch and dinner must include a pulse/legume source (dal, chana, rajma, sprouts).
• VEGETABLES: Plan must include ≥400g vegetables per day per adult (WHO/ICMR-NIN 2024). For members with anemia, ≥100g green leafy vegetables (GLV) daily — palak, methi, bathua, drumstick leaves.
• MICRONUTRIENTS: Ensure iron (women of child-bearing age ≥21mg), calcium (300mg/day minimum), vitamin C source daily (for non-haem iron absorption with meals).
• SODIUM: Meals must stay under 2000mg sodium per day per adult; children < 1200mg. Single meal sodium cap: 700mg adult, 400mg child.
• DIABETES/BP: Members with diabetes must have meals with GI < 55; hypertension < 1500mg sodium/day.
• ALLERGIES: Absolutely zero tolerance for declared allergens. Enforce strictly.

OUTPUT RULES — BE TERSE, minimize text length:
- 5 meals per day: breakfast, mid_morning, lunch, evening_snack, dinner
- ONE BASE MANY PLATES: base_dish_name is the single shared dish; member_adjustments shows per-member customisations
- base_dish_name: canonical dish name (also include as recipeName for backward compat)
- required_appliances: MANDATORY array of appliance keys needed (from: ${ownedAppliances.join(", ")}). Empty array [] if no appliance needed.
- For DB recipes (recipeId≠null): omit ingredients; include base_dish_name + recipeName
- For AI recipes (recipeId=null): include both base_ingredients (structured: [{ingredient, qty_grams}]) AND ingredients (plain strings); add instructions (3 steps, ≤10 words each)
- member_adjustments: per-member customisations as {MemberName:{add:[{ingredient,qty_grams}],reduce:[string],avoid:[string]}}; only for members with specific health needs; also include as member_plates for compat
- icmr_rationale: ≤8 words
- nameHindi: required
- aiInsights: ≤60 words in ${family.primaryLanguage === "hindi" ? "Hindi" : "English"}
- dinner: add leftoverChain array (3 steps: next-day lunch, breakfast, snack — dish name only)`.trim();

  const promptPreamble = `${masterPromptSection1}
${masterPromptSection2}
${masterPromptSection3}

EXACT JSON SCHEMA (return ONLY raw JSON, no fences):
{"harmonyScore":85,"totalBudgetEstimate":1400,"aiInsights":"<brief>","days":[
{"day":"Monday","isFastingDay":false,"dailyHarmonyScore":82,"dailyNutrition":{"calories":1900,"protein":65,"carbs":280,"fat":55,"fiber":28},"meals":{
"breakfast":{"recipeId":123,"base_dish_name":"Poha","recipeName":"Poha","nameHindi":"पोहा","calories":320,"estimatedCost":80,"required_appliances":["tawa"],"icmr_rationale":"Complex carbs, morning energy","member_adjustments":{"Ramesh":{"add":[{"ingredient":"egg","qty_grams":55}],"reduce":[],"avoid":[]}},"member_plates":{"Ramesh":{"add":["egg"],"reduce":[],"avoid":[]}}},
"mid_morning":{"recipeId":null,"base_dish_name":"Banana Peanut Chikki","recipeName":"Banana Peanut Chikki","nameHindi":"केला चिक्की","calories":180,"estimatedCost":40,"required_appliances":[],"icmr_rationale":"Potassium, sustained energy","base_ingredients":[{"ingredient":"banana","qty_grams":120},{"ingredient":"peanut chikki","qty_grams":50}],"ingredients":["2 bananas","50g peanut chikki"],"instructions":["Peel banana","Serve with chikki","Eat fresh"],"member_adjustments":{},"member_plates":{}},
"lunch":{"recipeId":456,"base_dish_name":"Dal Tadka Roti","recipeName":"Dal Tadka Roti","nameHindi":"दाल तड़का रोटी","calories":520,"estimatedCost":120,"required_appliances":["pressure_cooker","tawa"],"icmr_rationale":"Protein, iron, fiber","member_adjustments":{},"member_plates":{}},
"evening_snack":{"recipeId":null,"base_dish_name":"Masala Chaas","recipeName":"Masala Chaas","nameHindi":"मसाला छाछ","calories":80,"estimatedCost":30,"required_appliances":[],"icmr_rationale":"Probiotics, calcium","base_ingredients":[{"ingredient":"curd","qty_grams":200},{"ingredient":"cumin","qty_grams":2},{"ingredient":"water","qty_grams":100}],"ingredients":["200ml curd","pinch cumin","salt","water"],"instructions":["Blend curd with water","Add spices","Serve cold"],"member_adjustments":{},"member_plates":{}},
"dinner":{"recipeId":789,"base_dish_name":"Palak Paneer Jeera Rice","recipeName":"Palak Paneer Jeera Rice","nameHindi":"पालक पनीर जीरा चावल","calories":600,"estimatedCost":200,"required_appliances":["kadai","pressure_cooker"],"icmr_rationale":"Iron, calcium, protein","member_adjustments":{"Ramesh":{"add":[],"reduce":["ghee"],"avoid":[]}},"member_plates":{"Ramesh":{"add":[],"reduce":["ghee"],"avoid":[]}},"leftoverChain":[{"step":1,"day":"Tuesday","meal":"Lunch","dish":"Palak paratha wrap"},{"step":2,"day":"Wednesday","meal":"Breakfast","dish":"Palak paratha"},{"step":3,"day":"Wednesday","meal":"Snack","dish":"Paneer tikka"}]}
}}]}`;

  const promptHalf1 = promptPreamble + `

MANDATORY: Generate ONLY these 4 days: Monday, Tuesday, Wednesday, Thursday. Every day MUST have all 5 meal keys. No "..." placeholders. No missing days.`;

  const promptHalf2 = promptPreamble + `

MANDATORY: Generate ONLY these 3 days: Friday, Saturday, Sunday. Every day MUST have all 5 meal keys. No "..." placeholders. No missing days.`;

  req.log.info({ familyId, zone, recipesCount: filteredRecipes.length }, "Generating meal plan with parallel split (days 1-4 + days 5-7)");

  const PLAN_TIMEOUT_MS = 270000;
  const controller1 = new AbortController();
  const controller2 = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      controller1.abort();
      controller2.abort();
      reject(new Error("Meal plan generation timed out after 270 seconds"));
    }, PLAN_TIMEOUT_MS);
  });

  let planData: Record<string, unknown>;
  try {
    const [half1, half2] = await Promise.all([
      Promise.race([callGeminiWithJsonRetry(promptHalf1, "generate-meal-plan-days-1-4", req.log, controller1.signal, HalfPlanSchema as z.ZodType<Record<string, unknown>>), timeoutPromise]),
      Promise.race([callGeminiWithJsonRetry(promptHalf2, "generate-meal-plan-days-5-7", req.log, controller2.signal, HalfPlanSchema as z.ZodType<Record<string, unknown>>), timeoutPromise]),
    ]);
    clearTimeout(timeoutHandle);

    const days1 = Array.isArray(half1.days) ? half1.days as Array<Record<string, unknown>> : [];
    const days2 = Array.isArray(half2.days) ? half2.days as Array<Record<string, unknown>> : [];
    const allDays = [...days1, ...days2];

    const { optimizedPlan, totalSaved, planModifications } = applyArbitrageToPlan(allDays);
    const arbitrageNote = planModifications.length > 0
      ? ` 💡 Mandi-optimized: ${planModifications.map(m => `${m.original}→${m.substituted}`).slice(0, 3).join(", ")} — save ₹${Math.round(totalSaved)}/kg`
      : "";

    const mergedCandidate = {
      harmonyScore: Math.round((Number(half1.harmonyScore ?? 70) + Number(half2.harmonyScore ?? 70)) / 2),
      totalBudgetEstimate: Number(half1.totalBudgetEstimate ?? 0) + Number(half2.totalBudgetEstimate ?? 0),
      aiInsights: (half1.aiInsights ?? half2.aiInsights ?? "") + arbitrageNote,
      days: optimizedPlan,
      ...(planModifications.length > 0 ? { arbitrageMods: planModifications, arbitrageSaving: totalSaved } : {}),
    };

    // Validate full merged plan against strict schema before accepting
    const mergedValidation = WeekPlanSchema.safeParse(mergedCandidate);
    if (!mergedValidation.success) {
      const issues = mergedValidation.error.issues.slice(0, 3).map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
      req.log.error({ familyId, schemaErrors: issues }, "Merged plan failed WeekPlanSchema validation — rejecting");
      throw new Error(`Generated plan has structural issues after merge: ${issues}`);
    }

    // Post-generation appliance enforcement: strip meals requiring unavailable appliances
    let applianceViolations = 0;
    const candidateDays = mergedCandidate.days as Array<{ day?: string; meals?: Record<string, Record<string, unknown>> }>;
    for (const day of candidateDays) {
      if (!day.meals) continue;
      for (const [slotKey, meal] of Object.entries(day.meals)) {
        const declared = (meal.required_appliances as string[] | undefined) ?? [];
        const violations = declared.filter(a => !ownedAppliances.includes(a));
        if (violations.length > 0) {
          applianceViolations++;
          const dishName = (meal.base_dish_name ?? meal.recipeName ?? "unknown") as string;
          req.log.info({ dish: dishName, slot: slotKey, day: day.day, violations }, "Post-gen appliance violation — replacing with simple alternative");
          day.meals[slotKey] = {
            ...meal,
            base_dish_name: `Simple ${slotKey.replace("_", " ")} (${dishName} replaced — needs ${violations.join(", ")})`,
            recipeName: `Simple ${slotKey.replace("_", " ")}`,
            recipeId: null,
            required_appliances: [],
            icmr_rationale: `Original dish required unavailable appliance: ${violations.join(", ")}`,
            base_ingredients: [{ ingredient: "seasonal fruits", qty_grams: 200 }, { ingredient: "curd", qty_grams: 100 }],
            ingredients: ["seasonal fruits", "curd", "nuts"],
            instructions: ["Wash and cut fruits", "Mix with curd", "Serve fresh"],
          };
        }
      }
    }
    if (applianceViolations > 0) {
      req.log.info({ familyId, applianceViolations }, "Appliance violations replaced with simple alternatives");
    }

    const memberProfiles: MemberProfile[] = members.map(m => ({
      name: m.name,
      healthConditions: m.healthConditions ?? [],
      dietaryRestrictions: m.dietaryRestrictions ?? [],
      allergies: m.allergies ?? [],
    }));
    const dietPref = resolveDietPreference(allRestrictions) ?? "vegetarian";
    let validationWarnings: Violation[] = [];
    let validationFallbacks = 0;
    for (const day of candidateDays) {
      if (!day.meals) continue;
      for (const [slotKey, meal] of Object.entries(day.meals)) {
        const violations = validateMealForMembers(meal as Record<string, unknown>, memberProfiles);
        if (violations.length > 0) {
          const hardViolations = violations.filter(v => v.severity === "hard");
          if (hardViolations.length > 0) {
            const dishName = ((meal as Record<string, unknown>).base_dish_name ?? (meal as Record<string, unknown>).recipeName ?? "unknown") as string;
            req.log.info({ dish: dishName, slot: slotKey, day: day.day, violations: hardViolations.length }, "Validation sieve — hard violation, replacing with safe fallback");
            const fallback = getSafeFallback(slotKey, dietPref);
            const fallbackObj = {
              ...(fallback as unknown as Record<string, unknown>),
              _validationReplaced: true,
              _originalDish: dishName,
              _violations: hardViolations.map(v => v.message),
            };
            const recheck = validateMealForMembers(fallbackObj, memberProfiles);
            const recheckHard = recheck.filter(v => v.severity === "hard");
            if (recheckHard.length > 0) {
              req.log.info({ slot: slotKey, day: day.day }, "Fallback also violates — using minimal safe meal");
              fallbackObj.base_dish_name = "Seasonal Fruit Bowl";
              fallbackObj.recipeName = "Seasonal Fruit Bowl";
              (fallbackObj as Record<string, unknown>).nameHindi = "मौसमी फल कटोरी";
              (fallbackObj as Record<string, unknown>).recipeId = null;
              (fallbackObj as Record<string, unknown>).base_ingredients = [{ ingredient: "seasonal fruits", qty_grams: 200 }];
              (fallbackObj as Record<string, unknown>).ingredients = ["seasonal fruits"];
              (fallbackObj as Record<string, unknown>).instructions = ["Wash and cut fruits", "Serve fresh"];
            }
            day.meals[slotKey] = fallbackObj;
            validationFallbacks++;
          }
          validationWarnings.push(...violations);
        }

        const finalMeal = day.meals[slotKey];
        const thali = scoreThaliCompleteness(finalMeal as unknown as Parameters<typeof scoreThaliCompleteness>[0]);
        (finalMeal as Record<string, unknown>)._thaliScore = thali.score;
        (finalMeal as Record<string, unknown>)._thaliPresent = thali.present;
        (finalMeal as Record<string, unknown>)._thaliMissing = thali.missing;
      }
    }
    if (validationFallbacks > 0) {
      req.log.info({ familyId, validationFallbacks, totalWarnings: validationWarnings.length }, "Validation sieve applied — some meals replaced with safe fallbacks");
    }

    (mergedCandidate as Record<string, unknown>)._validationWarnings = validationWarnings.map(v => ({
      severity: v.severity,
      member: v.member,
      rule: v.rule,
      message: v.message,
    }));

    planData = mergedCandidate;

    req.log.info({ familyId, days1Count: days1.length, days2Count: days2.length, arbitrageSwaps: planModifications.length, applianceViolations }, "Parallel meal plan generation succeeded");
  } catch (err) {
    clearTimeout(timeoutHandle);
    req.log.error({ err }, "Meal plan generation failed after retry");
    res.status(422).json({ error: (err instanceof Error ? err.message : "Meal plan generation failed — please try again"), retryable: true });
    return;
  }

  const harmonyScore = Number(planData.harmonyScore ?? 70);
  const totalBudgetEstimate = Number(planData.totalBudgetEstimate ?? 0);
  const aiInsights = String(planData.aiInsights ?? "");

  try {
    // Enrich dinner meals with DB-backed leftover chains (recipe_db sourced where possible)
    const enrichedPlanData = await enrichPlanWithDbLeftoverChains(planData);

    const weekStartDateStr = weekStartDate.split("T")[0];

    req.log.info({
      familyId, isFasting, autoDetected: explicitFasting === undefined,
      memberFastingDays, festivalFasting: festivalFasting.festivals.map(f => f.name),
    }, "Fasting mode decision");

    const [mealPlan] = await db.insert(mealPlansTable).values({
      familyId,
      name: `Week of ${weekStartDateStr} — ${family.name} Family Plan`,
      weekStartDate: weekStartDateStr,
      harmonyScore,
      totalBudgetEstimate,
      plan: enrichedPlanData,
      nutritionSummary: {
        zone,
        members: memberSummaries.map(m => ({ name: m.name, targets: m.targets })),
        isFasting,
        fastingAutoDetected: explicitFasting === undefined,
        memberFastingDays,
        festivalFasting: festivalFasting.isFestivalFasting ? festivalFasting.festivals.map(f => f.name) : [],
        recipeSource: `recipe_db:${filteredRecipes.length}_filtered`,
        leftoverChainSource: "recipe_db_primary_ai_fallback",
      },
      aiInsights,
    }).returning();

    res.json({ ...mealPlan, harmonyScore: Number(mealPlan.harmonyScore) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "Failed to save meal plan to database");
    res.status(500).json({ error: "Failed to save meal plan", details: msg, retryable: true });
  }
});

router.get("/meal-plans/:id", async (req, res): Promise<void> => {
  const params = GetMealPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, retryable: false });
    return;
  }
  try {
    const [plan] = await db.select().from(mealPlansTable).where(eq(mealPlansTable.id, params.data.id));
    if (!plan) {
      res.status(404).json({ error: "Meal plan not found", retryable: false });
      return;
    }
    res.json({ ...plan, harmonyScore: Number(plan.harmonyScore) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to fetch meal plan", details: msg, retryable: true });
  }
});

router.post("/meal-plans/:id/regenerate", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid meal plan ID", retryable: false });
    return;
  }

  try {
    const [existingPlan] = await db.select().from(mealPlansTable).where(eq(mealPlansTable.id, id));
    if (!existingPlan) {
      res.status(404).json({ error: "Meal plan not found", retryable: false });
      return;
    }

    const familyId = existingPlan.familyId;
    const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, familyId));
    if (!family) {
      res.status(404).json({ error: "Family not found", retryable: false });
      return;
    }
    if (family.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden: you do not own this family", retryable: false });
      return;
    }

    const members = await db.select().from(familyMembersTable).where(eq(familyMembersTable.familyId, familyId));
    const allFeedback = await db.select().from(mealFeedbackTable)
      .where(eq(mealFeedbackTable.familyId, familyId))
      .orderBy(desc(mealFeedbackTable.createdAt))
      .limit(50);

    const zone = getZoneForState(family.state || "Delhi");
    const weeklyBudget = Math.round(Number(family.monthlyBudget) / 4);
    const budgetPerMeal = Math.round(weeklyBudget / (7 * 4));
    const allRestrictions = members.flatMap(m => m.dietaryRestrictions ?? []);
    const existingSummary = existingPlan.nutritionSummary as Record<string, unknown> | null;
    const isFasting = Boolean(existingSummary?.isFasting ?? false);
    const cookingTimePref = (family.cuisinePreferences ?? []).find(p => p.startsWith("cooking_time:"));
    const maxCookTimeMin = cookingTimePref
      ? cookingTimePref.includes("quick") ? 30 : cookingTimePref.includes("moderate") ? 60 : null
      : null;
    const ownedAppliancesRegen = family.appliances ?? ["tawa", "pressure_cooker", "kadai"];
    let freshRecipes = await getFilteredRecipes(zone, allRestrictions, budgetPerMeal, isFasting, maxCookTimeMin, 100);
    freshRecipes = filterByAppliances(freshRecipes, ownedAppliancesRegen);
    if (freshRecipes.length < 10) {
      let relaxed = await getFilteredRecipes(zone, [], 0, isFasting, null, 200);
      freshRecipes = filterByAppliances(relaxed, ownedAppliancesRegen);
    }

    const dislikedMeals = allFeedback.filter(f => !f.liked).map(f => f.mealType);

    const constrainedRecipes = freshRecipes.filter(r => {
      const course = (r.course ?? "").toLowerCase();
      return !dislikedMeals.some(dm => course.includes(dm.toLowerCase()));
    });

    const finalRecipes = constrainedRecipes.length >= 20 ? constrainedRecipes : freshRecipes;

    const memberSummaries = members.map(m => ({
      name: m.name, role: m.role, age: m.age, gender: m.gender,
      activityLevel: m.activityLevel,
      healthConditions: m.healthConditions ?? [],
      dietaryRestrictions: m.dietaryRestrictions ?? [],
      allergies: m.allergies ?? [],
      targets: getICMRNINTargets(m.age, m.gender, m.activityLevel, m.healthConditions ?? []),
    }));

    const dislikedList = allFeedback.filter(f => !f.liked)
      .map(f => `${f.mealType}: ${f.skipReason || "disliked"}`).join("\n");
    const likedList = allFeedback.filter(f => f.liked && (f.rating ?? 0) >= 4)
      .map(f => f.mealType).join(", ");

    const regenBaselineLines: string[] = [];
    if (family.mealsAreShared && (family.sharedTypicalBreakfast || family.sharedTypicalLunch || family.sharedTypicalDinner)) {
      regenBaselineLines.push("CURRENT DIETARY BASELINE — shared by all members (IMPROVE upon this, keep familiar where possible):");
      if (family.sharedTypicalBreakfast) regenBaselineLines.push(`  Breakfast: ${family.sharedTypicalBreakfast}`);
      if (family.sharedTypicalLunch) regenBaselineLines.push(`  Lunch: ${family.sharedTypicalLunch}`);
      if (family.sharedTypicalDinner) regenBaselineLines.push(`  Dinner: ${family.sharedTypicalDinner}`);
    } else if (!family.mealsAreShared) {
      const regenMemberBaselines = members
        .filter(m => m.individualTypicalBreakfast || m.individualTypicalLunch || m.individualTypicalDinner)
        .map(m => {
          const parts: string[] = [];
          if (m.individualTypicalBreakfast) parts.push(`Breakfast: ${m.individualTypicalBreakfast}`);
          if (m.individualTypicalLunch) parts.push(`Lunch: ${m.individualTypicalLunch}`);
          if (m.individualTypicalDinner) parts.push(`Dinner: ${m.individualTypicalDinner}`);
          return parts.length > 0 ? `  ${m.name}: ${parts.join(" | ")}` : "";
        })
        .filter(Boolean);
      if (regenMemberBaselines.length > 0) {
        regenBaselineLines.push("CURRENT DIETARY BASELINE — per member (IMPROVE upon this, keep familiar where possible):");
        regenBaselineLines.push(...regenMemberBaselines);
      }
    }
    const regenBaselineNote = regenBaselineLines.length > 0 ? `\n${regenBaselineLines.join("\n")}\n` : "";

    const regenPrompt = `You are NutriNext AI. Regenerate a 7-day meal plan for ${family.name} family from ${family.state}.
Zone: ${zone.toUpperCase()} India.

FAMILY MEMBERS:
${JSON.stringify(memberSummaries, null, 2)}

BUDGET: ₹${weeklyBudget}/week → ₹${budgetPerMeal * members.length}/meal
${isFasting ? "\n🙏 FASTING MODE: Use sabudana, kuttu, singhara, fruits, milk-based dishes.\n" : ""}${regenBaselineNote}
PREVIOUS FEEDBACK (apply strictly):
DISLIKED — avoid:\n${dislikedList || "None"}
LIKED — continue:\n${likedList || "None"}

FRESH RECIPE SET FROM DATABASE (feedback-filtered, ${finalRecipes.length} recipes):
${JSON.stringify(finalRecipes.slice(0, 60).map(r => ({
    id: r.id, name: r.name, cuisine: r.cuisine,
    diet: r.diet, calories: r.calories, protein: r.protein,
    costPerServing: r.costPerServing, course: r.course,
  })), null, 2)}

Return valid JSON:
{
  "harmonyScore": <0-100>,
  "totalBudgetEstimate": <weekly INR>,
  "aiInsights": "<insights>",
  "days": [
    {
      "day": "Monday",
      "isFastingDay": false,
      "meals": {
        "breakfast": { "recipeId": <id|null>, "recipeName": "<name>", "nameHindi": "<hindi>", "servings": <n>, "estimatedCost": <INR>, "isLeftover": false, "notes": "", "icmr_rationale": "<1-2 sentence ICMR-NIN 2024 justification>", "instructions": ["Step 1: ...", "Step 2: ...", "Step 3: ..."], "memberVariations": {}, "member_plates": {"<memberName>": {"add": [], "reduce": [], "avoid": []}} },
        "mid_morning": { "recipeId": <id|null>, "recipeName": "<name>", "nameHindi": "<hindi>", "servings": <n>, "estimatedCost": <INR>, "isLeftover": false, "notes": "", "icmr_rationale": "<rationale>", "instructions": ["Step 1: ..."], "memberVariations": {}, "member_plates": {} },
        "lunch": { "recipeId": <id|null>, "recipeName": "<name>", "nameHindi": "<hindi>", "servings": <n>, "estimatedCost": <INR>, "isLeftover": false, "notes": "", "icmr_rationale": "<rationale>", "instructions": ["Step 1: ...", "Step 2: ...", "Step 3: ..."], "memberVariations": {}, "member_plates": {} },
        "evening_snack": { "recipeId": <id|null>, "recipeName": "<name>", "nameHindi": "<hindi>", "servings": <n>, "estimatedCost": <INR>, "isLeftover": false, "notes": "", "icmr_rationale": "<rationale>", "instructions": ["Step 1: ..."], "memberVariations": {}, "member_plates": {} },
        "dinner": { "recipeId": <id|null>, "recipeName": "<name>", "nameHindi": "<hindi>", "servings": <n>, "estimatedCost": <INR>, "isLeftover": false, "notes": "", "icmr_rationale": "<rationale>", "instructions": ["Step 1: ...", "Step 2: ...", "Step 3: ..."], "memberVariations": {}, "member_plates": {}, "leftoverChain": [{"step": 1, "day": "<nextDay>", "meal": "Lunch", "dish": "<how dinner becomes next-day lunch>"}, {"step": 2, "day": "<dayAfterNext>", "meal": "Breakfast", "dish": "<how leftover becomes breakfast>"}, {"step": 3, "day": "<dayAfterNext>", "meal": "Snack", "dish": "<final use>"}] }
      },
      "dailyHarmonyScore": <0-100>,
      "dailyNutrition": {"calories": <n>, "protein": <n>, "carbs": <n>, "fat": <n>, "fiber": <n>, "iron": <n>}
    }
  ]
}`;

    let planData: Record<string, unknown>;
    try {
      planData = await callGeminiWithJsonRetry(regenPrompt, "regenerate-meal-plan", req.log, undefined, WeekPlanSchema as z.ZodType<Record<string, unknown>>);
    } catch (geminiErr) {
      req.log.error({ err: geminiErr }, "Meal plan regeneration failed after retry");
      res.status(422).json({ error: (geminiErr instanceof Error ? geminiErr.message : "Meal plan generation failed — please try again"), retryable: true });
      return;
    }

    const enrichedPlanData = await enrichPlanWithDbLeftoverChains(planData);

    const [updatedPlan] = await db.update(mealPlansTable).set({
      plan: enrichedPlanData,
      harmonyScore: Number(planData.harmonyScore ?? 70),
      totalBudgetEstimate: Number(planData.totalBudgetEstimate ?? 0),
      aiInsights: String(planData.aiInsights ?? ""),
      nutritionSummary: {
        ...(existingSummary ?? {}),
        regenerated: true,
        regeneratedAt: new Date().toISOString(),
        recipeSource: `recipe_db:${finalRecipes.length}_feedback_filtered`,
        leftoverChainSource: "recipe_db_primary_ai_fallback",
      },
    }).where(eq(mealPlansTable.id, id)).returning();

    req.log.info({ id, familyId, freshRecipes: finalRecipes.length, dislikedCount: dislikedMeals.length }, "Meal plan regenerated with DB-first pipeline");

    res.json({ ...updatedPlan, harmonyScore: Number(updatedPlan?.harmonyScore ?? 70) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "Meal plan regenerate route error");
    res.status(500).json({ error: "Failed to regenerate meal plan", details: msg, retryable: true });
  }
});

router.put("/meal-plans/:id", async (req, res): Promise<void> => {
  const params = UpdateMealPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, retryable: false });
    return;
  }
  const parsed = UpdateMealPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, retryable: false });
    return;
  }
  try {
    const updateData: Record<string, unknown> = {};
    if (parsed.data.name) updateData.name = parsed.data.name;
    if (parsed.data.plan) updateData.plan = parsed.data.plan;
    if (parsed.data.harmonyScore !== undefined) updateData.harmonyScore = String(parsed.data.harmonyScore);
    const [plan] = await db.update(mealPlansTable).set(updateData).where(eq(mealPlansTable.id, params.data.id)).returning();
    if (!plan) {
      res.status(404).json({ error: "Meal plan not found", retryable: false });
      return;
    }
    res.json({ ...plan, harmonyScore: Number(plan.harmonyScore) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to update meal plan", details: msg, retryable: true });
  }
});

router.delete("/meal-plans/:id", async (req, res): Promise<void> => {
  const params = DeleteMealPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, retryable: false });
    return;
  }
  try {
    await db.delete(mealPlansTable).where(eq(mealPlansTable.id, params.data.id));
    res.sendStatus(204);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to delete meal plan", details: msg, retryable: true });
  }
});

export default router;
