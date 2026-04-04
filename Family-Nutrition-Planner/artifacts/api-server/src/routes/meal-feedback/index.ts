import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { mealFeedbackTable, mealPlansTable, familiesTable } from "@workspace/db";
import { assertFamilyOwnership } from "../../middlewares/assertFamilyOwnership.js";

const router: IRouter = Router();

const MealFeedbackSchema = z.object({
  familyId: z.number({ required_error: "familyId is required" }).int().positive(),
  dayIndex: z.number({ required_error: "dayIndex is required" }).int().min(0).max(6),
  mealType: z.string({ required_error: "mealType is required" }).min(1),
  liked: z.boolean().optional().default(true),
  rating: z.number().int().min(0).max(5).optional(),
  skipReason: z.string().optional(),
  notes: z.string().optional(),
  action: z.enum(["like", "dislike", "skip", "ate_out"]).optional(),
});

router.get("/meal-plans/:mealPlanId/feedback", async (req, res): Promise<void> => {
  const mealPlanId = parseInt(req.params.mealPlanId);
  if (isNaN(mealPlanId)) {
    res.status(400).json({ error: "Invalid meal plan id" });
    return;
  }
  try {
    const [plan] = await db.select({ familyId: mealPlansTable.familyId }).from(mealPlansTable).where(eq(mealPlansTable.id, mealPlanId));
    if (plan) {
      const [family] = await db.select({ userId: familiesTable.userId }).from(familiesTable).where(eq(familiesTable.id, plan.familyId));
      if (family && req.user && family.userId !== req.user.userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }
    const feedback = await db.select().from(mealFeedbackTable)
      .where(eq(mealFeedbackTable.mealPlanId, mealPlanId));
    res.json(feedback);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to fetch feedback", details: msg });
  }
});

router.post("/meal-plans/:mealPlanId/feedback", assertFamilyOwnership, async (req, res): Promise<void> => {
  const mealPlanId = parseInt(req.params.mealPlanId);
  if (isNaN(mealPlanId)) {
    res.status(400).json({ error: "Invalid meal plan id" });
    return;
  }

  const parsed = MealFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const { familyId, dayIndex, mealType, liked, rating, skipReason, notes, action } = parsed.data;

  const isSkipOrAteOut = action === "skip" || action === "ate_out";
  const effectiveLiked = isSkipOrAteOut ? false : liked;
  const effectiveRating = isSkipOrAteOut ? 0 : (rating ?? (liked ? 5 : 1));
  const effectiveSkipReason = isSkipOrAteOut
    ? (action === "skip" ? (skipReason || "skipped") : "ate_out")
    : (skipReason ?? null);

  const [feedback] = await db.insert(mealFeedbackTable).values({
    familyId,
    mealPlanId,
    dayIndex,
    mealType,
    liked: effectiveLiked,
    rating: effectiveRating,
    skipReason: effectiveSkipReason,
    notes: notes ?? (isSkipOrAteOut ? action : null),
  }).onConflictDoNothing().returning();

  res.status(201).json(feedback || { message: "Feedback recorded" });
});

export default router;
