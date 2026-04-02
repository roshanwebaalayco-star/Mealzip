import { Router, type Request, type Response } from "express";
import { forceReingestKnowledgeBase, reingestICMROnly } from "../../services/ingestion.js";
import { findSimilarChunks, isEmbeddingConfigured } from "../../services/embedding.js";
import { startEmbeddingQueue, getEmbeddingQueueStatus } from "../../services/embeddingQueue.js";
import { db } from "@workspace/db";
import { familiesTable, familyMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function requireAdmin(req: Request, res: Response): boolean {
  const providedSecret = req.headers["x-admin-secret"];
  if (!ADMIN_SECRET || providedSecret !== ADMIN_SECRET) {
    res.status(403).json({ error: "Forbidden. Valid x-admin-secret header required." });
    return false;
  }
  return true;
}

router.post("/admin/reingest", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    res.json({ status: "started", message: "Re-ingestion started in background." });
    forceReingestKnowledgeBase().catch((err) => {
      console.error("Re-ingestion failed:", err);
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to start re-ingestion" });
  }
});

router.get("/admin/embedding-status", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  res.json(getEmbeddingQueueStatus());
});

router.post("/admin/restart-embedding-queue", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    await startEmbeddingQueue();
    res.json({ success: true, status: getEmbeddingQueueStatus() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to start embedding queue", details: msg });
  }
});

router.post("/admin/reingest-icmr", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    await reingestICMROnly();
    res.json({ success: true, message: "ICMR documents re-ingested with finer chunks" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "ICMR re-ingestion failed", details: msg });
  }
});

router.post("/admin/test-retrieval", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const { query, table, zone, diet, limit } = req.body as {
    query?: string;
    table?: "knowledge_chunks" | "recipes";
    zone?: string;
    diet?: string;
    limit?: number;
  };

  if (!query || typeof query !== "string") {
    res.status(400).json({ error: "query (string) is required in request body" });
    return;
  }

  if (!isEmbeddingConfigured()) {
    res.status(503).json({ error: "Embedding API not configured. Set VOYAGE_API_KEY or GEMINI_API_KEY." });
    return;
  }

  const searchTable = table ?? "recipes";
  const searchLimit = Math.min(limit ?? 10, 50);

  try {
    if (searchTable === "knowledge_chunks") {
      const results = await findSimilarChunks(query, "knowledge_chunks", searchLimit);
      res.json({
        table: "knowledge_chunks",
        query,
        resultCount: results.length,
        results: results.map(r => ({
          id: r.id,
          source: r.source,
          similarity: Math.round(r.similarity * 1000) / 1000,
          contentPreview: r.content.slice(0, 300),
        })),
      });
    } else {
      const results = await findSimilarChunks(query, "recipes", searchLimit, {
        zone: zone,
        diet: diet,
      });
      res.json({
        table: "recipes",
        query,
        filters: { zone, diet },
        resultCount: results.length,
        results: results.map(r => ({
          id: r.id,
          name: r.name,
          cuisine: r.cuisine,
          diet: r.diet,
          course: r.course,
          similarity: Math.round(r.similarity * 1000) / 1000,
        })),
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Retrieval failed", details: msg });
  }
});

const TEST_FAMILIES = [
  {
    key: "diabetes_test",
    family: {
      name: "Clinical Test — Diabetes",
      stateRegion: "Rajasthan",
      languagePreference: "hindi",
      householdDietaryBaseline: "strictly_veg",
      mealsPerDay: "3_meals",
      cookingSkillLevel: "intermediate",
      appliances: ["tawa", "pressure_cooker", "kadai"],
    },
    members: [
      {
        name: "Ravi Kumar", age: 45, gender: "male",
        weightKg: "78", heightCm: "172", activityLevel: "sedentary",
        healthConditions: ["diabetes"], dietaryType: "strictly_vegetarian",
        allergies: [], ingredientDislikes: [], primaryGoal: "manage_health", dailyCalorieTarget: 1800,
        displayOrder: 0,
      },
    ],
  },
  {
    key: "weight_loss_test",
    family: {
      name: "Clinical Test — Weight Loss",
      stateRegion: "Punjab",
      languagePreference: "hindi",
      householdDietaryBaseline: "strictly_veg",
      mealsPerDay: "3_meals",
      cookingSkillLevel: "intermediate",
      appliances: ["tawa", "pressure_cooker", "kadai"],
    },
    members: [
      {
        name: "Priya Kaur", age: 32, gender: "female",
        weightKg: "72", heightCm: "162", activityLevel: "lightly_active",
        healthConditions: [], dietaryType: "strictly_vegetarian",
        allergies: [], ingredientDislikes: [], primaryGoal: "lose_weight", goalPace: "slow", dailyCalorieTarget: 1500,
        displayOrder: 0,
      },
    ],
  },
  {
    key: "weight_gain_test",
    family: {
      name: "Clinical Test — Weight Gain",
      stateRegion: "Bihar",
      languagePreference: "hindi",
      householdDietaryBaseline: "strictly_veg",
      mealsPerDay: "3_meals",
      cookingSkillLevel: "intermediate",
      appliances: ["tawa", "pressure_cooker", "kadai"],
    },
    members: [
      {
        name: "Amit Kumar", age: 19, gender: "male",
        weightKg: "55", heightCm: "175", activityLevel: "moderately_active",
        healthConditions: [], dietaryType: "strictly_vegetarian",
        allergies: [], ingredientDislikes: [], primaryGoal: "gain_weight", dailyCalorieTarget: 3000,
        displayOrder: 0,
      },
    ],
  },
  {
    key: "multi_member_conflict",
    family: {
      name: "Clinical Test — Multi-Member Conflict",
      stateRegion: "Uttar Pradesh",
      languagePreference: "hindi",
      householdDietaryBaseline: "mixed",
      mealsPerDay: "3_meals",
      cookingSkillLevel: "intermediate",
      appliances: ["tawa", "pressure_cooker", "kadai"],
    },
    members: [
      {
        name: "Papa", age: 52, gender: "male",
        weightKg: "80", heightCm: "170", activityLevel: "sedentary",
        healthConditions: ["diabetes"], dietaryType: "occasional_nonveg",
        allergies: [], ingredientDislikes: [], primaryGoal: "manage_health", dailyCalorieTarget: 1800,
        occasionalNonvegConfig: { days: ["saturday", "sunday"], types: ["chicken", "fish"] },
        displayOrder: 0,
      },
      {
        name: "Mama", age: 46, gender: "female",
        weightKg: "58", heightCm: "155", activityLevel: "moderately_active",
        healthConditions: ["anaemia"], dietaryType: "strictly_vegetarian",
        allergies: [], ingredientDislikes: [], primaryGoal: "manage_health", dailyCalorieTarget: 1700,
        displayOrder: 1,
      },
      {
        name: "Rani", age: 10, gender: "female",
        weightKg: "30", heightCm: "138", activityLevel: "very_active",
        healthConditions: [], dietaryType: "strictly_vegetarian",
        allergies: [], ingredientDislikes: [], primaryGoal: "healthy_growth", dailyCalorieTarget: 1600,
        displayOrder: 2,
      },
    ],
  },
  {
    key: "budget_constraint",
    family: {
      name: "Clinical Test — Budget Constraint",
      stateRegion: "West Bengal",
      languagePreference: "bengali",
      householdDietaryBaseline: "strictly_veg",
      mealsPerDay: "3_meals",
      cookingSkillLevel: "beginner",
      appliances: ["tawa", "pressure_cooker"],
    },
    members: [
      {
        name: "Baba", age: 50, gender: "male",
        weightKg: "70", heightCm: "168", activityLevel: "moderately_active",
        healthConditions: [], dietaryType: "strictly_vegetarian",
        allergies: [], ingredientDislikes: [], dailyCalorieTarget: 2000,
        displayOrder: 0,
      },
      {
        name: "Ma", age: 45, gender: "female",
        weightKg: "60", heightCm: "155", activityLevel: "moderately_active",
        healthConditions: [], dietaryType: "strictly_vegetarian",
        allergies: [], ingredientDislikes: [], dailyCalorieTarget: 1700,
        displayOrder: 1,
      },
      {
        name: "Dada", age: 20, gender: "male",
        weightKg: "65", heightCm: "172", activityLevel: "very_active",
        healthConditions: [], dietaryType: "strictly_vegetarian",
        allergies: [], ingredientDislikes: [], dailyCalorieTarget: 2400,
        displayOrder: 2,
      },
      {
        name: "Didi", age: 16, gender: "female",
        weightKg: "48", heightCm: "158", activityLevel: "moderately_active",
        healthConditions: [], dietaryType: "strictly_vegetarian",
        allergies: [], ingredientDislikes: [], dailyCalorieTarget: 1800,
        displayOrder: 3,
      },
    ],
  },
];

router.post("/admin/seed-test-families", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const userId = (req.body as { userId?: number }).userId ?? null;

  try {
    const results: Record<string, { familyId: number; memberCount: number }> = {};

    for (const testDef of TEST_FAMILIES) {
      const existing = await db.select().from(familiesTable)
        .where(eq(familiesTable.name, testDef.family.name));

      if (existing.length > 0) {
        const family = existing[0];
        const members = await db.select().from(familyMembersTable)
          .where(eq(familyMembersTable.familyId, family.id));
        results[testDef.key] = { familyId: family.id, memberCount: members.length };
        continue;
      }

      const [family] = await db.insert(familiesTable).values({
        ...testDef.family,
        userId,
      }).returning();

      const membersData = testDef.members.map(m => ({
        familyId: family.id,
        ...m,
      }));

      await db.insert(familyMembersTable).values(membersData);

      results[testDef.key] = { familyId: family.id, memberCount: testDef.members.length };
    }

    res.json({
      status: "success",
      message: `${Object.keys(results).length} clinical test families seeded`,
      note: userId ? `Families owned by userId ${userId}` : "Families created without userId — pass { userId } in body for meal-plan generation compatibility",
      families: results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to seed test families", details: msg });
  }
});

export default router;
