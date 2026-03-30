import { Router, type Request, type Response } from "express";
import { forceReingestKnowledgeBase } from "../../services/ingestion.js";

const router = Router();

router.post("/admin/reingest", async (_req: Request, res: Response) => {
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
