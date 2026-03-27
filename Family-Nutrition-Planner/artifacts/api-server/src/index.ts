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

async function checkDbHealth(): Promise<void> {
  try {
    const result = await pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM recipes"
    );
    const count = parseInt(result.rows[0].count, 10);
    logger.info(`DB OK — ${count} recipes loaded`);
  } catch (err) {
    logger.error({ err }, "DB health check failed — cannot connect to database");
    process.exit(1);
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await checkDbHealth();
});
