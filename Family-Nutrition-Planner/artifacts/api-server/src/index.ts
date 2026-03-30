import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { ingestKnowledgeBase } from "./services/ingestion.js";
import { startEmbeddingQueue } from "./services/embeddingQueue.js";

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
      logger.warn(
        `DB health check: recipes table has ${recipeCount} rows (expected ${MIN_RECIPES}+). ` +
        `Run: pnpm --filter @workspace/scripts seed-recipes`
      );
    }

    if (icmrCount < MIN_ICMR_ROWS) {
      logger.warn(
        `DB health check: icmr_nin_rda table has ${icmrCount} rows (expected ${MIN_ICMR_ROWS}+). ` +
        `Run: pnpm --filter @workspace/scripts seed-icmr-nin`
      );
    }

    logger.info(`DB check — ${recipeCount} recipes, ${icmrCount} ICMR-NIN RDA rows`);
  } catch (err) {
    logger.error({ err }, "DB health check failed — cannot connect to database. Server will start anyway.");
  }
}

const server = app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Server listening on 0.0.0.0");
});

server.setTimeout(120000);
server.keepAliveTimeout = 65000;

checkDbHealth().catch(() => {});

startEmbeddingQueue().catch((err) =>
  logger.warn({ err }, "Could not start embedding queue (non-fatal)."),
);

ingestKnowledgeBase().catch((err) => {
  logger.warn({ err }, "Knowledge base ingestion failed (non-fatal). RAG features may be degraded.");
});
