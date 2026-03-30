import { Router, type Request, type Response } from "express";
import { forceReingestKnowledgeBase } from "../../services/ingestion.js";

const router = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET;

router.post("/admin/reingest", async (req: Request, res: Response) => {
  const providedSecret = req.headers["x-admin-secret"];

  if (!ADMIN_SECRET || providedSecret !== ADMIN_SECRET) {
    res.status(403).json({ error: "Forbidden. Valid x-admin-secret header required." });
    return;
  }

  try {
    res.json({ status: "started", message: "Re-ingestion started in background." });
    forceReingestKnowledgeBase().catch((err) => {
      console.error("Re-ingestion failed:", err);
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to start re-ingestion" });
  }
});

export default router;
