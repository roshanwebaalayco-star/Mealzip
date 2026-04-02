import { localDb as db } from "@workspace/db";
import { recipesTable, icmrNinRdaTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const MIN_RECIPES = 100;
const MIN_ICMR_ROWS = 10;

async function verify() {
  const [recipeResult] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(recipesTable);

  const [icmrResult] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(icmrNinRdaTable);

  const recipeCount = recipeResult.count;
  const icmrCount = icmrResult.count;

  console.log(`Recipes: ${recipeCount} | ICMR-NIN rows: ${icmrCount}`);

  if (recipeCount < MIN_RECIPES) {
    console.error(`ERROR: recipes table has ${recipeCount} rows (minimum ${MIN_RECIPES}). Run: pnpm --filter @workspace/scripts seed-recipes`);
    process.exit(1);
  }

  if (icmrCount < MIN_ICMR_ROWS) {
    console.error(`ERROR: icmr_nin_rda table has ${icmrCount} rows (minimum ${MIN_ICMR_ROWS}). Run: pnpm --filter @workspace/scripts seed-icmr-nin`);
    process.exit(1);
  }

  console.log("Data verification passed.");
}

verify().catch(err => {
  console.error("DB verification failed:", err.message);
  process.exit(1);
});
