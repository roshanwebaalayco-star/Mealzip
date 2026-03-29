import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const MIN_RECIPES = 1000;
const MIN_ICMR_ROWS = 20;

async function checkDbHealth(): Promise<void> {
  try {
    const [recipeResult, icmrResult] = await Promise.all([
      pool.query<{ count: string }>("SELECT COUNT(*) as count FROM recipes"),
      pool.query<{ count: string }>("SELECT COUNT(*) as count FROM icmr_nin_rda"),
    ]);

    const recipeCount = parseInt(recipeResult.rows[0].count, 10);
    const icmrCount = parseInt(icmrResult.rows[0].count, 10);

    if (recipeCount < MIN_RECIPES) {
      logger.error(
        `DB health check failed: recipes table has ${recipeCount} rows (minimum ${MIN_RECIPES}). ` +
        `Run: pnpm --filter @workspace/scripts seed-recipes`
      );
      process.exit(1);
    }

    if (icmrCount < MIN_ICMR_ROWS) {
      logger.error(
        `DB health check failed: icmr_nin_rda table has ${icmrCount} rows (minimum ${MIN_ICMR_ROWS}). ` +
        `Run: pnpm --filter @workspace/scripts seed-icmr-nin`
      );
      process.exit(1);
    }

    logger.info(`DB OK — ${recipeCount} recipes loaded, ${icmrCount} ICMR-NIN RDA rows`);
  } catch (err) {
    logger.error({ err }, "DB health check failed — cannot connect to database. Set DATABASE_URL environment variable.");
    process.exit(1);
  }
}

// Run DB health check before accepting traffic so the server never starts
// in a degraded state with an open port.
await checkDbHealth();

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Extend HTTP timeout for long-running AI meal plan generation (Gemini can take 60-300s)
server.setTimeout(360000);
server.keepAliveTimeout = 360000;
