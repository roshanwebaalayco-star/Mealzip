import { pool } from "@workspace/db";
import { generateEmbedding } from "./embedding.js";

let isRunning = false;
let processedCount = 0;
let totalToProcess = 0;
let failedCount = 0;
const failedRecipeIds = new Set<number>();

const RATE_DELAY_MS = 21000;

export async function startEmbeddingQueue(): Promise<void> {
  if (isRunning) {
    console.log("Embedding queue already running");
    return;
  }

  const countResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*) as count FROM recipes WHERE embedding IS NULL",
  );

  totalToProcess = parseInt(countResult.rows[0].count, 10);

  if (totalToProcess === 0) {
    console.log("All recipes already embedded.");
    return;
  }

  console.log(
    `Starting background embedding queue: ${totalToProcess} recipes to embed. Rate: ~3/minute (Voyage AI). Estimated time: ${Math.ceil(totalToProcess / 3)} minutes.`,
  );

  isRunning = true;
  processedCount = 0;
  failedCount = 0;

  embedRecipesGradually().catch((err) => {
    console.error("Embedding queue error:", err);
    isRunning = false;
  });
}

async function embedRecipesGradually(): Promise<void> {
  while (true) {
    const skipIds = Array.from(failedRecipeIds);
    const skipClause = skipIds.length > 0 ? `AND id NOT IN (${skipIds.join(",")})` : "";

    const result = await pool.query<{
      id: number;
      name: string;
      cuisine: string;
      course: string;
      diet: string;
      ingredients: string;
      instructions: string;
    }>(
      `SELECT id, name, cuisine, course, diet, ingredients, instructions
      FROM recipes
      WHERE embedding IS NULL ${skipClause}
      ORDER BY id
      LIMIT 1`,
    );

    if (result.rows.length === 0) {
      console.log(
        `Embedding queue complete. Total embedded: ${processedCount} recipes. Failed: ${failedCount}.`,
      );
      isRunning = false;
      break;
    }

    const recipe = result.rows[0];

    try {
      const recipeText = [
        `Recipe: ${recipe.name}`,
        `Cuisine zone: ${recipe.cuisine}`,
        `Course type: ${recipe.course}`,
        `Diet: ${recipe.diet}`,
        `Ingredients: ${recipe.ingredients}`,
        `Cooking method: ${(recipe.instructions || "").slice(0, 500)}`,
      ].join(". ");

      const embedding = await generateEmbedding(recipeText);
      const embeddingStr = `[${embedding.join(",")}]`;

      await pool.query(
        "UPDATE recipes SET embedding = $1::vector WHERE id = $2",
        [embeddingStr, recipe.id],
      );

      processedCount++;

      if (processedCount % 100 === 0) {
        const remaining = totalToProcess - processedCount - failedCount;
        console.log(
          `Embedding progress: ${processedCount}/${totalToProcess} done. ~${Math.ceil(remaining / 3)} minutes remaining.`,
        );
      }
    } catch (err) {
      failedCount++;
      failedRecipeIds.add(recipe.id);
      console.error(
        `Failed to embed recipe ${recipe.id} (${recipe.name}):`,
        err,
      );

      if (failedCount > 50) {
        console.error("Too many embedding failures (>50). Pausing queue.");
        isRunning = false;
        break;
      }
    }

    await new Promise((r) => setTimeout(r, RATE_DELAY_MS));
  }
}

export function getEmbeddingQueueStatus(): {
  isRunning: boolean;
  processedCount: number;
  totalToProcess: number;
  failedCount: number;
  remainingCount: number;
  percentComplete: number;
  estimatedMinutesRemaining: number;
} {
  return {
    isRunning,
    processedCount,
    totalToProcess,
    failedCount,
    remainingCount: Math.max(0, totalToProcess - processedCount - failedCount),
    percentComplete:
      totalToProcess > 0
        ? Math.round((processedCount / totalToProcess) * 100)
        : 100,
    estimatedMinutesRemaining: Math.ceil(
      Math.max(0, totalToProcess - processedCount - failedCount) / 3,
    ),
  };
}
