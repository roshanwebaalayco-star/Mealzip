import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, gt, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { assertFamilyOwnership } from "../../middlewares/assertFamilyOwnership.js";
import { leftoverItemsTable, familiesTable } from "@workspace/db";

const router: IRouter = Router();

const LogLeftoverBody = z.object({
  familyId: z.number().int().positive(),
  ingredientName: z.string().min(1),
  quantityEstimate: z.string().optional(),
});

const LogLeftoverBatchBody = z.object({
  familyId: z.number().int().positive(),
  items: z.array(z.object({
    ingredientName: z.string().min(1),
    quantityEstimate: z.string().optional(),
  })).min(1),
});

router.post("/leftovers", assertFamilyOwnership, async (req, res): Promise<void> => {
  const parsed = LogLeftoverBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const { familyId, ingredientName, quantityEstimate } = parsed.data;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  try {
    const [item] = await db.insert(leftoverItemsTable).values({
      familyId,
      ingredientName,
      quantityEstimate: quantityEstimate ?? null,
      expiresAt,
    }).returning();

    res.status(201).json(item);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to log leftover", details: msg });
  }
});

router.post("/leftovers/batch", assertFamilyOwnership, async (req, res): Promise<void> => {
  const parsed = LogLeftoverBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const { familyId, items } = parsed.data;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  try {
    const rows = await db.insert(leftoverItemsTable).values(
      items.map(item => ({
        familyId,
        ingredientName: item.ingredientName,
        quantityEstimate: item.quantityEstimate ?? null,
        expiresAt,
      }))
    ).returning();

    res.status(201).json(rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to log leftovers", details: msg });
  }
});

router.get("/leftovers", assertFamilyOwnership, async (req, res): Promise<void> => {
  const familyId = parseInt(req.query.familyId as string);
  if (isNaN(familyId)) {
    res.status(400).json({ error: "familyId query parameter required" });
    return;
  }

  try {
    const now = new Date();
    const items = await db.select().from(leftoverItemsTable)
      .where(and(
        eq(leftoverItemsTable.familyId, familyId),
        eq(leftoverItemsTable.usedUp, false),
        gt(leftoverItemsTable.expiresAt, now),
      ));

    const enriched = items.map(item => ({
      ...item,
      hoursRemaining: Math.max(0, Math.round((item.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60))),
    }));

    res.json(enriched);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to fetch leftovers", details: msg });
  }
});

router.patch("/leftovers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid leftover id" });
    return;
  }

  try {
    const [existing] = await db.select({ familyId: leftoverItemsTable.familyId }).from(leftoverItemsTable).where(eq(leftoverItemsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Leftover item not found" });
      return;
    }
    const [family] = await db.select({ userId: familiesTable.userId }).from(familiesTable).where(eq(familiesTable.id, existing.familyId));
    if (family && req.user && family.userId !== req.user.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const [updated] = await db.update(leftoverItemsTable)
      .set({ usedUp: true })
      .where(eq(leftoverItemsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Leftover item not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to update leftover", details: msg });
  }
});

export default router;
