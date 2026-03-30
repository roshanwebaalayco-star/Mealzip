import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  let database = "disconnected";
  let knowledgeChunks = 0;
  let recipes = 0;
  let embeddedRecipes = 0;

  try {
    const dbCheck = await pool.query("SELECT 1");
    if (dbCheck.rows.length > 0) database = "connected";

    const [chunksResult, recipesResult] = await Promise.all([
      pool.query<{ count: string }>("SELECT COUNT(*)::int as count FROM knowledge_chunks").catch(() => ({ rows: [{ count: "0" }] })),
      pool.query<{ total: string; embedded: string }>(
        "SELECT COUNT(*)::int as total, COUNT(embedding)::int as embedded FROM recipes"
      ).catch(() => ({ rows: [{ total: "0", embedded: "0" }] })),
    ]);

    knowledgeChunks = Number(chunksResult.rows[0]?.count ?? 0);
    recipes = Number(recipesResult.rows[0]?.total ?? 0);
    embeddedRecipes = Number(recipesResult.rows[0]?.embedded ?? 0);
  } catch {
    database = "disconnected";
  }

  res.json({
    status: "ok",
    database,
    knowledgeChunks,
    recipes,
    embeddedRecipes,
  });
});

export default router;
