import { Router, type IRouter } from "express";
import { eq, and, lte, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db, localDb } from "@workspace/db";
import { groceryListsTable, mealPlansTable, familiesTable, recipesTable } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";

const router: IRouter = Router();

const GenerateGrocerySchema = z.object({
  familyId: z.number({ required_error: "familyId is required" }).int().positive(),
  mealPlanId: z.number().int().positive().optional(),
  pantryIngredients: z.array(z.string()).optional(),
  updateMode: z.enum(["add", "subtract"]).optional().default("add"),
});

router.get("/grocery-lists", async (req, res): Promise<void> => {
  const familyId = parseInt(req.query.familyId as string);
  if (isNaN(familyId)) {
    res.status(400).json({ error: "familyId is required" });
    return;
  }
  const lists = await db.select().from(groceryListsTable)
    .where(eq(groceryListsTable.familyId, familyId))
    .orderBy(groceryListsTable.createdAt);
  res.json(lists);
});

router.post("/grocery-lists/generate", async (req, res): Promise<void> => {
  const parsed = GenerateGrocerySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const { familyId, mealPlanId, pantryIngredients, updateMode } = parsed.data;

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, familyId));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }

  let mealPlan: typeof import("@workspace/db").mealPlansTable.$inferSelect | undefined;
  if (mealPlanId) {
    [mealPlan] = await db.select().from(mealPlansTable).where(eq(mealPlansTable.id, mealPlanId));
  } else {
    const plans = await db.select().from(mealPlansTable)
      .where(eq(mealPlansTable.familyId, familyId))
      .orderBy(mealPlansTable.createdAt);
    mealPlan = plans[plans.length - 1];
  }

  if (!mealPlan) {
    res.status(404).json({ error: "No meal plan found" });
    return;
  }

  const budget = family.monthlyBudget;
  const weeklyBudget = Math.round(budget / 4);

  const pantryNote = pantryIngredients && pantryIngredients.length > 0
    ? `\nPantry items already available (DO NOT include in shopping list unless extra quantity needed): ${pantryIngredients.join(", ")}`
    : "";

  const prompt = `You are ParivarSehat AI — a smart Indian Kirana grocery assistant. Generate a comprehensive weekly grocery list for this family's meal plan.

Family: ${family.name}, State: ${family.state}
Weekly grocery budget: ₹${weeklyBudget}${pantryNote}

Meal plan summary: ${JSON.stringify(mealPlan.plan).slice(0, 2500)}

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
  "budgetStatus": "within|over|under",
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

    // Deterministic server-side pantry subtraction: remove items already in pantry
    if (updateMode === "subtract" && pantryIngredients && pantryIngredients.length > 0) {
      const pantrySet = pantryIngredients.map(p => p.toLowerCase().trim());
      if (Array.isArray(groceryData.items)) {
        const before = groceryData.items.length;
        groceryData.items = groceryData.items.filter((item: { name?: string; nameHindi?: string }) => {
          const itemName = item.name ?? "";
          return !pantrySet.some(p => ingredientMatches(p, itemName));
        });
        const subtracted = before - groceryData.items.length;
        // Recalculate total after subtraction
        groceryData.totalEstimatedCost = groceryData.items.reduce(
          (sum: number, i: { estimatedCost?: number }) => sum + (i.estimatedCost ?? 0), 0
        );
        groceryData.pantrySubtracted = subtracted;
        groceryData.budgetStatus =
          groceryData.totalEstimatedCost <= (family.monthlyBudget / 4) ? "within" : "over";
      }
    }

    const weekOf = mealPlan.weekStartDate;

    const [list] = await db.insert(groceryListsTable).values({
      familyId,
      mealPlanId: mealPlan.id,
      weekOf,
      items: groceryData,
      totalEstimatedCost: groceryData.totalEstimatedCost || 0,
      budgetStatus: groceryData.budgetStatus || "within",
    }).returning();

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Grocery generation failed", details: String(err) });
  }
});

// 7b: Flexible ingredient matching for pantry subtraction
function ingredientMatches(pantryItem: string, groceryItem: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  const p = normalize(pantryItem);
  const g = normalize(groceryItem);
  if (p.includes(g) || g.includes(p)) return true;
  return p.split(" ").some(word => word.length > 3 && g.split(" ").includes(word));
}

// 7a: Persist accepted swap for a grocery list item
router.patch("/grocery-lists/:id/swaps", async (req, res): Promise<void> => {
  const listId = parseInt(req.params.id);
  if (isNaN(listId)) { res.status(400).json({ error: "Invalid list id" }); return; }

  const { itemName, swappedWith, cost, source } = req.body as {
    itemName: string;
    swappedWith: string | null;
    cost?: number;
    source?: "db" | "ai";
  };
  if (!itemName) { res.status(400).json({ error: "itemName is required" }); return; }

  const [list] = await db.select({ id: groceryListsTable.id, acceptedSwaps: groceryListsTable.acceptedSwaps })
    .from(groceryListsTable).where(eq(groceryListsTable.id, listId));
  if (!list) { res.status(404).json({ error: "Grocery list not found" }); return; }

  const existing = (list.acceptedSwaps as Record<string, unknown> | null) ?? {};
  let updated: Record<string, unknown>;
  if (swappedWith === null) {
    // Remove swap (user reverted to original)
    updated = { ...existing };
    delete updated[itemName];
  } else {
    updated = { ...existing, [itemName]: { name: swappedWith, cost: cost ?? 0, source: source ?? "ai" } };
  }

  await db.update(groceryListsTable).set({ acceptedSwaps: updated }).where(eq(groceryListsTable.id, listId));
  res.json({ success: true, acceptedSwaps: updated });
});

// DB-backed cheaper alternative ingredient lookup endpoint
router.get("/grocery/cheaper-alternative", async (req, res): Promise<void> => {
  const item = (req.query.item as string)?.trim();
  const budget = parseFloat(req.query.budget as string);
  const diet = (req.query.diet as string) ?? "";

  if (!item) {
    res.status(400).json({ error: "item query parameter is required" });
    return;
  }

  const budgetFilter = !isNaN(budget) && budget > 0 ? budget : 100;

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
});

export default router;
