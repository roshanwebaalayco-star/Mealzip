import { Router, type IRouter } from "express";
import { eq, and, lte, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db, localDb } from "@workspace/db";
import { assertFamilyOwnership } from "../../middlewares/assertFamilyOwnership.js";
import { groceryListsTable, mealPlansTable, familiesTable, recipesTable, monthlyBudgetsTable } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";

const router: IRouter = Router();

const GenerateGrocerySchema = z.object({
  familyId: z.number({ required_error: "familyId is required" }).int().positive(),
  mealPlanId: z.number().int().positive().optional(),
  pantryIngredients: z.array(z.string()).optional(),
  updateMode: z.enum(["add", "subtract"]).optional().default("add"),
});

router.get("/grocery-lists", assertFamilyOwnership, async (req, res): Promise<void> => {
  const familyId = parseInt(req.query.familyId as string);
  if (isNaN(familyId)) {
    res.status(400).json({ error: "familyId is required", retryable: false });
    return;
  }
  try {
    const lists = await db.select().from(groceryListsTable)
      .where(eq(groceryListsTable.familyId, familyId))
      .orderBy(groceryListsTable.createdAt);

    // Fetch the latest monthly budget for this family to compute budget status
    const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const budgets = await db.select().from(monthlyBudgetsTable)
      .where(eq(monthlyBudgetsTable.familyId, familyId))
      .orderBy(monthlyBudgetsTable.createdAt);

    // Use latest budget, prefer current month
    const budget = budgets.find(b => b.monthYear === currentMonth) ?? budgets[budgets.length - 1];
    // Weekly perishables budget = monthly perishables budget / 4
    const weeklyBudget = budget ? parseFloat(budget.perishablesBudget) / 4 : null;

    const listsWithStatus = lists.map(list => {
      const cost = parseFloat(list.totalEstimatedCost ?? "0");
      let budgetStatus = "within";
      if (weeklyBudget !== null) {
        if (cost > weeklyBudget * 1.05) budgetStatus = "over";
        else if (cost < weeklyBudget * 0.9) budgetStatus = "under";
        else budgetStatus = "within";
      }
      return { ...list, budgetStatus };
    });

    res.json(listsWithStatus);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to fetch grocery lists", details: msg, retryable: true });
  }
});

router.post("/grocery-lists/generate", assertFamilyOwnership, async (req, res): Promise<void> => {
  const parsed = GenerateGrocerySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten(), retryable: false });
    return;
  }
  const { familyId, mealPlanId, pantryIngredients, updateMode } = parsed.data;

  let family: typeof familiesTable.$inferSelect | undefined;
  let mealPlan: typeof mealPlansTable.$inferSelect | undefined;
  try {
    [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, familyId));
    if (!family) {
      res.status(404).json({ error: "Family not found", retryable: false });
      return;
    }

    if (mealPlanId) {
      [mealPlan] = await db.select().from(mealPlansTable).where(eq(mealPlansTable.id, mealPlanId));
    } else {
      const plans = await db.select().from(mealPlansTable)
        .where(eq(mealPlansTable.familyId, familyId))
        .orderBy(mealPlansTable.createdAt);
      mealPlan = plans[plans.length - 1];
    }

    if (!mealPlan) {
      res.status(404).json({ error: "No meal plan found", retryable: false });
      return;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to load family/meal-plan data", details: msg, retryable: true });
    return;
  }

  const pantryNote = pantryIngredients && pantryIngredients.length > 0
    ? `\nPantry items already available (DO NOT include in shopping list unless extra quantity needed): ${pantryIngredients.join(", ")}`
    : "";

  const prompt = `You are ParivarSehat AI — a smart Indian Kirana grocery assistant. Generate a comprehensive weekly grocery list for this family's meal plan.

Family: ${family.name}, Region: ${family.stateRegion}${pantryNote}

Meal plan summary: ${JSON.stringify(mealPlan.days).slice(0, 2500)}

Return ONLY valid JSON with this structure — every item MUST have a healthRationale:
{
  "items": [
    {
      "category": "Vegetables|Fruits|Grains|Pulses|Dairy|Spices|Oil|Other",
      "name": "ingredient name in English",
      "nameHindi": "name in Hindi",
      "quantity": "500g or 1 kg or 250 ml",
      "estimatedCost": 30,
      "cheaperAlternative": "optional cheaper swap for same nutrition",
      "alternativeCost": 20,
      "priority": "essential|optional",
      "healthRationale": "1-line reason why this ingredient is good for the family's health (e.g. 'Rich in iron — supports anaemia management per ICMR-NIN 2024')"
    }
  ],
  "totalEstimatedCost": 850,
  "savingsTips": ["tip 1", "tip 2", "tip 3"],
  "seasonalSuggestions": ["seasonal produce tip"]
}

Rules:
- Use tier-2 Indian city prices (Lucknow, Nagpur, Coimbatore etc.)
- Prioritize seasonal local produce
- Group essential items first within each category
- healthRationale must reference ICMR-NIN 2024 or specific health benefit`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });

    const groceryData = JSON.parse(response.text ?? "{}");

    if (updateMode === "subtract" && pantryIngredients && pantryIngredients.length > 0) {
      const pantrySet = pantryIngredients.map(p => p.toLowerCase().trim());
      if (Array.isArray(groceryData.items)) {
        const before = groceryData.items.length;
        groceryData.items = groceryData.items.filter((item: { name?: string; nameHindi?: string }) => {
          const itemName = item.name ?? "";
          return !pantrySet.some(p => ingredientMatches(p, itemName));
        });
        const subtracted = before - groceryData.items.length;
        groceryData.totalEstimatedCost = groceryData.items.reduce(
          (sum: number, i: { estimatedCost?: number }) => sum + (i.estimatedCost ?? 0), 0
        );
        groceryData.pantrySubtracted = subtracted;
      }
    }

    const weekStartDate = new Date().toISOString().split("T")[0];

    const [list] = await db.insert(groceryListsTable).values({
      familyId,
      mealPlanId: mealPlan.id,
      weekStartDate,
      items: groceryData,
      totalEstimatedCost: String(groceryData.totalEstimatedCost || 0),
      status: "active",
    }).returning();

    res.json(list);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Grocery generation failed", details: msg, retryable: true });
  }
});

const INGREDIENT_ALIASES: Record<string, string[]> = {
  "mustard oil": ["sarson oil", "sarso tel", "sarson ka tel", "sarsi tel"],
  "ghee": ["clarified butter", "desi ghee", "cow ghee"],
  "curd": ["yogurt", "dahi", "dahi curd", "yoghurt"],
  "chickpeas": ["chana", "chole", "garbanzo", "kabuli chana", "chhole"],
  "spinach": ["palak", "palak leaves"],
  "fenugreek": ["methi", "methi leaves", "fenugreek leaves"],
  "rice": ["chawal", "basmati", "basmati rice", "sona masoori"],
  "wheat flour": ["atta", "gehun atta", "chapati flour", "aata"],
  "lentils": ["dal", "daal", "masoor", "masoor dal"],
  "tomato": ["tamatar", "tamato"],
  "onion": ["pyaz", "piyaz", "kanda"],
  "garlic": ["lahsun", "lasan", "lehsun"],
  "ginger": ["adrak", "adrak paste", "adrakh"],
  "potato": ["aloo", "alu"],
  "cauliflower": ["gobhi", "phool gobhi", "gobi"],
  "green peas": ["matar", "hara matar", "mattar"],
  "paneer": ["cottage cheese", "fresh paneer"],
  "milk": ["doodh", "full cream milk", "toned milk"],
  "butter": ["makhan", "white butter"],
  "oil": ["tel", "cooking oil"],
  "salt": ["namak", "sendha namak", "rock salt"],
  "cumin": ["jeera", "zeera"],
  "turmeric": ["haldi", "haldee"],
  "coriander": ["dhania", "dhaniya", "cilantro", "coriander leaves"],
  "chilli": ["mirchi", "hari mirchi", "lal mirchi", "chili", "chilli powder"],
  "cardamom": ["elaichi", "ilaichi"],
  "cloves": ["laung", "lavang"],
  "cinnamon": ["dalchini", "dal chini"],
  "black pepper": ["kali mirch", "kaali mirch"],
  "bay leaf": ["tejpatta", "tej patta"],
  "mustard seeds": ["rai", "sarson", "raai"],
  "asafoetida": ["hing", "heeng"],
  "sugar": ["cheeni", "chini", "shakkar"],
  "jaggery": ["gur", "gud", "jaggery powder"],
  "gram flour": ["besan", "chickpea flour"],
  "semolina": ["suji", "sooji", "rava"],
  "moong dal": ["green gram", "mung dal", "moong", "green lentil"],
  "toor dal": ["arhar dal", "tuvar dal", "pigeon pea"],
  "urad dal": ["black gram", "black lentil", "urad"],
  "rajma": ["kidney beans", "red kidney beans"],
  "soybean": ["soya", "soy", "soya bean"],
  "groundnut": ["peanut", "moongfali", "mungfali"],
  "coconut": ["nariyal", "narial"],
  "tamarind": ["imli", "imlee"],
  "amla": ["indian gooseberry", "gooseberry"],
  "curry leaves": ["kadi patta", "meetha neem"],
  "green cardamom": ["choti elaichi", "small cardamom"],
  "vermicelli": ["seviyan", "sewai"],
  "poha": ["flattened rice", "beaten rice", "chivda"],
  "sabudana": ["sago", "tapioca pearls"],
  "makhana": ["fox nuts", "lotus seeds", "phool makhana"],
  "bottle gourd": ["lauki", "ghia", "doodhi"],
  "bitter gourd": ["karela", "bitter melon"],
  "ladies finger": ["okra", "bhindi"],
  "brinjal": ["eggplant", "baingan", "aubergine"],
};

function ingredientMatches(pantryItem: string, groceryItem: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  const p = normalize(pantryItem);
  const g = normalize(groceryItem);

  if (p.includes(g) || g.includes(p)) return true;

  const wordsP = p.split(" ").filter(w => w.length > 3);
  const wordsG = g.split(" ").filter(w => w.length > 3);
  if (wordsP.some(w => wordsG.includes(w))) return true;

  for (const [canonical, aliases] of Object.entries(INGREDIENT_ALIASES)) {
    const allForms = [canonical, ...aliases];
    const pMatches = allForms.some(f => p.includes(f));
    const gMatches = allForms.some(f => g.includes(f));
    if (pMatches && gMatches) return true;
  }

  return false;
}

router.get("/grocery/cheaper-alternative", async (req, res): Promise<void> => {
  const item = (req.query.item as string)?.trim();
  const budget = parseFloat(req.query.budget as string);
  const diet = (req.query.diet as string) ?? "";

  if (!item) {
    res.status(400).json({ error: "item query parameter is required", retryable: false });
    return;
  }

  const budgetFilter = !isNaN(budget) && budget > 0 ? budget : 100;

  try {
    const conditions: Parameters<typeof and>[0][] = [
      lte(recipesTable.costPerServing, budgetFilter),
      or(
        ilike(recipesTable.ingredients, `%${item}%`),
        ilike(recipesTable.name, `%${item}%`),
      ),
    ];

    const validDiets = ["vegetarian", "non vegetarian", "vegan", "eggetarian"];
    if (diet && validDiets.some(d => d.toLowerCase() === diet.toLowerCase())) {
      conditions.push(eq(recipesTable.diet, diet));
    }

    const alternatives = await localDb.select({
      id: recipesTable.id,
      name: recipesTable.name,
      nameHindi: recipesTable.nameHindi,
      cuisine: recipesTable.cuisine,
      diet: recipesTable.diet,
      calories: recipesTable.calories,
      protein: recipesTable.protein,
      costPerServing: recipesTable.costPerServing,
      ingredients: recipesTable.ingredients,
      totalTimeMin: recipesTable.totalTimeMin,
    })
      .from(recipesTable)
      .where(and(...conditions))
      .limit(5);

    if (alternatives.length === 0) {
      res.json({ item, alternatives: [], message: "No cheaper DB alternatives found for this ingredient" });
      return;
    }

    res.json({
      item,
      budget: budgetFilter,
      alternatives: alternatives.map(r => ({
        recipeId: r.id,
        name: r.name,
        nameHindi: r.nameHindi,
        cuisine: r.cuisine,
        diet: r.diet,
        costPerServing: r.costPerServing,
        calories: r.calories,
        protein: r.protein,
        totalTimeMin: r.totalTimeMin,
        source: "recipe_db",
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to fetch alternatives", details: msg, retryable: true });
  }
});

const ScanPantrySchema = z.object({
  imageBase64: z.string(),
  mimeType: z.string().default("image/jpeg"),
});

router.post("/pantry/scan-image", async (req, res): Promise<void> => {
  const parsed = ScanPantrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten(), retryable: false });
    return;
  }
  const { imageBase64, mimeType } = parsed.data;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          {
            text: `You are a kitchen pantry scanner for Indian households. Look at this image and identify ALL visible food items, ingredients, groceries, spices, and condiments.
For each item return:
- name: simple English name
- quantity: estimated quantity (e.g. "500g", "1 kg", "2 cups", "half packet", "few pieces")
- emoji: single relevant emoji

Return ONLY a valid JSON array, no markdown:
[{"name":"Rice","quantity":"2 kg","emoji":"🍚"},{"name":"Onions","quantity":"4-5 pieces","emoji":"🧅"}]

If no food items are visible, return [].`,
          }
        ],
      }],
      config: { maxOutputTokens: 1024, responseMimeType: "application/json" },
    });

    const text = result.text?.trim() ?? "[]";
    let items: Array<{ name: string; quantity: string; emoji: string }> = [];
    try { items = JSON.parse(text); } catch { items = []; }
    res.json({ items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Pantry scan failed", details: msg, retryable: true, items: [] });
  }
});

export default router;
