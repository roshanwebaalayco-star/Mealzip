import { Router, type IRouter } from "express";
import { eq, and, or, inArray, lte, sql, desc, ilike } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  familiesTable, familyMembersTable, mealPlansTable, recipesTable, mealFeedbackTable,
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

const router: IRouter = Router();

const MAX_OUTPUT_TOKENS = 16000;

function tryParseJson(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text) as Record<string, unknown>; } catch { /* fall through */ }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()) as Record<string, unknown>; } catch { /* fall through */ }
  }
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try { return JSON.parse(text.slice(braceStart, braceEnd + 1)) as Record<string, unknown>; } catch { /* fall through */ }
  }
  return null;
}

async function callGeminiWithJsonRetry(
  prompt: string,
  label: string,
  log: { info: (obj: Record<string, unknown>, msg: string) => void; error: (obj: Record<string, unknown>, msg: string) => void },
): Promise<Record<string, unknown>> {
  const MAX_RETRIES = 3;
  const BACKOFF_MS = [1000, 2000, 4000];

  let lastErr: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { maxOutputTokens: MAX_OUTPUT_TOKENS, responseMimeType: "application/json" },
      });
      const text = response.text ?? "{}";
      const data = tryParseJson(text);
      if (data !== null) {
        if (attempt > 0) log.info({ label, attempt: attempt + 1 }, `${label}: JSON parse succeeded on attempt ${attempt + 1}`);
        return data;
      }
      lastErr = new Error(`JSON parse failed — raw: ${text.slice(0, 200)}`);
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
  } as const;

  let recipes = await db.select(RECIPE_SELECT)
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

    const ingredientFastingRecipes = await db.select(RECIPE_SELECT)
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

  const [dinnerRecipe] = await db.select({
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
  const relatedRecipes = await db.select({
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
    res.status(400).json({ error: query.error.message });
    return;
  }
  const plans = await db.select().from(mealPlansTable)
    .where(eq(mealPlansTable.familyId, query.data.familyId))
    .orderBy(desc(mealPlansTable.createdAt));
  res.json(plans.map(p => ({ ...p, harmonyScore: Number(p.harmonyScore) })));
});

router.post("/meal-plans/generate", async (req, res): Promise<void> => {
  const parsed = GenerateMealPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { familyId, weekStartDate, preferences } = parsed.data;

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, familyId));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }

  const members = await db.select().from(familyMembersTable)
    .where(eq(familyMembersTable.familyId, familyId));

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
    res.status(422).json({ error: "Family must have at least one member before generating a meal plan." });
    return;
  }

  let filteredRecipes = await getFilteredRecipes(zone, allRestrictions, budgetPerMeal, isFasting, maxCookTimeMin, 100);

  // 5d: Progressive fallback when recipe filter is too restrictive
  if (filteredRecipes.length < 10) {
    req.log.info({ familyId, zone, count: filteredRecipes.length }, "Too few recipes — relaxing budget constraint");
    filteredRecipes = await getFilteredRecipes(zone, allRestrictions, 0, isFasting, null, 100);
  }
  if (filteredRecipes.length < 10) {
    req.log.info({ familyId, zone, count: filteredRecipes.length }, "Still too few — removing dietary filter");
    filteredRecipes = await getFilteredRecipes(zone, [], 0, isFasting, null, 120);
  }
  if (filteredRecipes.length === 0) {
    res.status(422).json({ error: "No recipes found in the database. Please seed the recipe database first." });
    return;
  }

  const previousFeedback = await db.select().from(mealFeedbackTable)
    .where(and(eq(mealFeedbackTable.familyId, familyId)))
    .orderBy(mealFeedbackTable.createdAt)
    .limit(50);

  const dislikedMeals = previousFeedback.filter(f => !f.liked).map(f => `${f.mealType} on Day ${f.dayIndex + 1}: ${f.skipReason || "disliked"}`);
  const likedMeals = previousFeedback.filter(f => f.liked && (f.rating ?? 0) >= 4).map(f => `${f.mealType} on Day ${f.dayIndex + 1}`);

  const memberSummaries = members.map(m => ({
    name: m.name, role: m.role, age: m.age, gender: m.gender,
    activityLevel: m.activityLevel,
    healthConditions: m.healthConditions ?? [],
    dietaryRestrictions: m.dietaryRestrictions ?? [],
    allergies: m.allergies ?? [],
    targets: getICMRNINTargets(m.age, m.gender, m.activityLevel, m.healthConditions ?? []),
  }));

  const pantryIngredients = preferences?.pantryIngredients ?? [];
  const festivalType = preferences?.festivalType;

  const fastingNote = isFasting
    ? `\n🙏 FASTING MODE${festivalType ? ` (${festivalType})` : ""}: Include sabudana, kuttu, singhara, fruits, milk-based dishes, and sendha namak items. ${festivalFasting.recommendedFoods.length > 0 ? `Festival foods: ${festivalFasting.recommendedFoods.slice(0, 6).join(", ")}.` : ""}\n`
    : festivalType
      ? `\n🎉 FESTIVAL: ${festivalType}. Include traditional festive dishes and sweets where appropriate.\n`
      : "";

  const pantryNote = pantryIngredients.length > 0
    ? `\n🏠 PANTRY ITEMS (already at home): ${pantryIngredients.join(", ")}.\nPREFER recipes that use these ingredients to minimise shopping. Incorporate them into breakfast/lunch/dinner where nutritionally appropriate.\n`
    : "";

  const feedbackNote = dislikedMeals.length > 0
    ? `\nPREVIOUS FEEDBACK - AVOID these types:\n${dislikedMeals.slice(0, 10).join("\n")}\nCONTINUE these popular meals:\n${likedMeals.slice(0, 5).join("\n")}\n`
    : "";

  const memberListForPrompt = memberSummaries.map(m => ({
    name: m.name, role: m.role, age: m.age, gender: m.gender,
    conditions: m.healthConditions,
    diet: m.dietaryRestrictions,
    allergies: m.allergies,
  }));

  const recipeListForPrompt = filteredRecipes.slice(0, 30).map(r => ({
    id: r.id, name: r.name, course: r.course, diet: r.diet, cal: r.calories, cost: r.costPerServing,
  }));

  const prompt = `You are ParivarSehat AI — India's expert family nutritionist (ICMR-NIN 2024).

Generate a 7-day family meal plan for the ${family.name} family from ${family.state} (${zone.toUpperCase()} India zone).

FAMILY (${members.length} members):
${JSON.stringify(memberListForPrompt)}

BUDGET: ₹${weeklyBudget}/week → max ₹${budgetPerMeal * members.length} per meal
CUISINE: ${(family.cuisinePreferences ?? []).join(", ") || "North Indian"}
${festivalContext}${fastingNote}${pantryNote}${feedbackNote}

"ONE BASE, MANY PLATES" PHILOSOPHY (MANDATORY):
Every dinner = ONE base dish cooked once, plated differently per family member based on their health conditions.
Example: Base = Dal Tadka + Chapati
- Papa (Diabetes): smaller rice portion, extra dal, no ghee
- Dadi (Hypertension): sendha namak or no added salt, light tadka
- Beti (Anaemia): add lemon squeeze + peanut chutney for iron absorption
- Baby (3yr): mashed dal + 1 chapati with ghee
This saves time, money, and effort. Apply to ALL dinners and lunches.

AVAILABLE RECIPES FROM DATABASE (use these recipeIds in your plan):
${JSON.stringify(recipeListForPrompt)}

RULES:
1. 7 days (Monday–Sunday), 5 meals each: breakfast, mid_morning, lunch, evening_snack, dinner
2. Prefer recipe IDs from the list above; use recipeId: null for AI-invented dishes
3. ICMR-NIN 2024 targets: Protein 10–15% cal, Carbs 60–65%, Fat 20–25%, Fiber ≥25g/day
4. For EACH health condition: diabetes→low GI; hypertension→low sodium; obesity→reduced portion; anaemia→iron-rich
5. For EVERY dinner include a 3-step leftover chain (how dinner becomes next-day lunch, then breakfast/snack)
6. Harmony Score = % of members whose nutritional/preference needs are met
7. Write aiInsights in ${family.primaryLanguage === "hindi" ? "Hindi" : "English"}, under 150 words

For each meal slot return this exact JSON structure:
{
  "recipeId": <number|null>,
  "recipeName": "<English name>",
  "nameHindi": "<Hindi name>",
  "description": "<1-sentence visual description so cook can picture the dish>",
  "servings": <number>,
  "estimatedCost": <INR total for family>,
  "isLeftover": false,
  "notes": "",
  "icmr_rationale": "<1-sentence ICMR-NIN 2024 justification>",
  "instructions": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "memberVariations": {"<name>": "<short adaptation note>"},
  "member_plates": {"<name>": {"add": ["<item>"], "reduce": ["<item>"], "avoid": ["<item>"]}}
}
For dinner add: "leftoverChain": [{"step":1,"day":"<nextDay>","meal":"Lunch","dish":"<description>"},{"step":2,"day":"<dayAfterNext>","meal":"Breakfast","dish":"<description>"},{"step":3,"day":"<dayAfterNext>","meal":"Snack","dish":"<description>"}]

Return ONLY valid JSON (no markdown, no explanation):
{
  "harmonyScore": <0-100>,
  "totalBudgetEstimate": <weekly INR>,
  "aiInsights": "<string>",
  "days": [
    {
      "day": "Monday",
      "isFastingDay": false,
      "meals": { "breakfast": {...}, "mid_morning": {...}, "lunch": {...}, "evening_snack": {...}, "dinner": {...} },
      "dailyHarmonyScore": <0-100>,
      "dailyNutrition": {"calories": <n>, "protein": <n>, "carbs": <n>, "fat": <n>, "fiber": <n>, "iron": <n>}
    }
  ]
}`;

  req.log.info({ familyId, zone, recipesCount: filteredRecipes.length }, "Generating meal plan with enhanced engine");

  let planData: Record<string, unknown>;
  try {
    planData = await callGeminiWithJsonRetry(prompt, "generate-meal-plan", req.log);
  } catch (err) {
    req.log.error({ err }, "Meal plan generation failed after retry");
    res.status(422).json({ error: (err instanceof Error ? err.message : "Meal plan generation failed — please try again") });
    return;
  }

  const harmonyScore = Number(planData.harmonyScore ?? 70);
  const totalBudgetEstimate = Number(planData.totalBudgetEstimate ?? 0);
  const aiInsights = String(planData.aiInsights ?? "");

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
});

router.get("/meal-plans/:id", async (req, res): Promise<void> => {
  const params = GetMealPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [plan] = await db.select().from(mealPlansTable).where(eq(mealPlansTable.id, params.data.id));
  if (!plan) {
    res.status(404).json({ error: "Meal plan not found" });
    return;
  }
  res.json({ ...plan, harmonyScore: Number(plan.harmonyScore) });
});

router.post("/meal-plans/:id/regenerate", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid meal plan ID" });
    return;
  }

  const [existingPlan] = await db.select().from(mealPlansTable).where(eq(mealPlansTable.id, id));
  if (!existingPlan) {
    res.status(404).json({ error: "Meal plan not found" });
    return;
  }

  const familyId = existingPlan.familyId;
  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, familyId));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }

  const members = await db.select().from(familyMembersTable).where(eq(familyMembersTable.familyId, familyId));

  const zone = getZoneForState(family.state || "Delhi");
  const weeklyBudget = Math.round(Number(family.monthlyBudget) / 4);
  const budgetPerMeal = Math.round(weeklyBudget / (7 * 4));
  const allRestrictions = members.flatMap(m => m.dietaryRestrictions ?? []);

  // Re-apply fasting detection using the same week
  const existingSummary = existingPlan.nutritionSummary as Record<string, unknown> | null;
  const isFasting = Boolean(existingSummary?.isFasting ?? false);

  const cookingTimePref = (family.cuisinePreferences ?? []).find(p => p.startsWith("cooking_time:"));
  const maxCookTimeMin = cookingTimePref
    ? cookingTimePref.includes("quick") ? 30 : cookingTimePref.includes("moderate") ? 60 : null
    : null;

  // Get all feedback since this plan was created for constraint application
  const allFeedback = await db.select().from(mealFeedbackTable)
    .where(eq(mealFeedbackTable.familyId, familyId))
    .orderBy(desc(mealFeedbackTable.createdAt))
    .limit(50);

  const dislikedMeals = allFeedback.filter(f => !f.liked).map(f => f.mealType);

  // Re-run constrained recipe DB search — same pipeline as initial generation but excludes disliked
  const freshRecipes = await getFilteredRecipes(zone, allRestrictions, budgetPerMeal, isFasting, maxCookTimeMin, 100);

  // Further filter out recipes matching disliked meal types
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

  const regenPrompt = `You are NutriNext AI. Regenerate a 7-day meal plan for ${family.name} family from ${family.state}.
Zone: ${zone.toUpperCase()} India.

FAMILY MEMBERS:
${JSON.stringify(memberSummaries, null, 2)}

BUDGET: ₹${weeklyBudget}/week → ₹${budgetPerMeal * members.length}/meal
${isFasting ? "\n🙏 FASTING MODE: Use sabudana, kuttu, singhara, fruits, milk-based dishes.\n" : ""}
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
    planData = await callGeminiWithJsonRetry(regenPrompt, "regenerate-meal-plan", req.log);
  } catch (err) {
    req.log.error({ err }, "Meal plan regeneration failed after retry");
    res.status(422).json({ error: (err instanceof Error ? err.message : "Meal plan generation failed — please try again") });
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
});

router.put("/meal-plans/:id", async (req, res): Promise<void> => {
  const params = UpdateMealPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMealPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.name) updateData.name = parsed.data.name;
  if (parsed.data.plan) updateData.plan = parsed.data.plan;
  if (parsed.data.harmonyScore !== undefined) updateData.harmonyScore = String(parsed.data.harmonyScore);
  const [plan] = await db.update(mealPlansTable).set(updateData).where(eq(mealPlansTable.id, params.data.id)).returning();
  if (!plan) {
    res.status(404).json({ error: "Meal plan not found" });
    return;
  }
  res.json({ ...plan, harmonyScore: Number(plan.harmonyScore) });
});

router.delete("/meal-plans/:id", async (req, res): Promise<void> => {
  const params = DeleteMealPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(mealPlansTable).where(eq(mealPlansTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
