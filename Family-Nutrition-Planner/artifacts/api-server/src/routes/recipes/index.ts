import { Router, type IRouter } from "express";
import { eq, ilike, and, lte, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { recipesTable } from "@workspace/db";
import { ListRecipesQueryParams, GetRecipeParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/recipes", async (req, res): Promise<void> => {
  const query = ListRecipesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { q, cuisine, diet, category, maxCalories, maxCookTime, page = 1, limit = 20 } = query.data;
  const offset = (page - 1) * limit;

  const conditions: Parameters<typeof and>[0][] = [];

  if (q) {
    // Use GIN full-text search index for sub-500ms performance
    const safeQuery = q.trim().replace(/[^a-zA-Z0-9\u0900-\u097F\s]/g, "").split(/\s+/).filter(Boolean).join(" & ");
    if (safeQuery) {
      conditions.push(
        sql`to_tsvector('simple', coalesce(${recipesTable.name}, '') || ' ' || coalesce(${recipesTable.nameHindi}, '') || ' ' || coalesce(${recipesTable.ingredients}, '')) @@ to_tsquery('simple', ${safeQuery + ":*"})`
      );
    }
  }
  if (cuisine) conditions.push(ilike(recipesTable.cuisine, `%${cuisine}%`));
  if (diet) conditions.push(eq(recipesTable.diet, diet.toLowerCase()));
  if (category) conditions.push(eq(recipesTable.category, category));
  if (maxCalories) conditions.push(lte(recipesTable.calories, maxCalories));
  if (maxCookTime) conditions.push(lte(recipesTable.totalTimeMin, maxCookTime));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [recipes, countResult] = await Promise.all([
    db.select().from(recipesTable)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(recipesTable.name),
    db.select({ count: sql<number>`count(*)` }).from(recipesTable).where(whereClause)
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(total / limit);

  res.json({
    recipes: recipes.map(r => ({
      ...r,
      calories: Number(r.calories ?? 0),
      protein: Number(r.protein ?? 0),
      carbs: Number(r.carbs ?? 0),
      fat: Number(r.fat ?? 0),
      fiber: Number(r.fiber ?? 0),
      iron: Number(r.iron ?? 0),
      calcium: Number(r.calcium ?? 0),
      vitaminC: Number(r.vitaminC ?? 0),
      costPerServing: Number(r.costPerServing ?? 0),
    })),
    total,
    page,
    limit,
    totalPages,
  });
});

router.get("/recipes/:id", async (req, res): Promise<void> => {
  const params = GetRecipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [recipe] = await db.select().from(recipesTable).where(eq(recipesTable.id, params.data.id));
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  res.json({
    ...recipe,
    calories: Number(recipe.calories ?? 0),
    protein: Number(recipe.protein ?? 0),
    carbs: Number(recipe.carbs ?? 0),
    fat: Number(recipe.fat ?? 0),
    fiber: Number(recipe.fiber ?? 0),
    iron: Number(recipe.iron ?? 0),
    calcium: Number(recipe.calcium ?? 0),
    vitaminC: Number(recipe.vitaminC ?? 0),
    costPerServing: Number(recipe.costPerServing ?? 0),
  });
});

export default router;
