import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { mealFeedbackTable } from "@workspace/db";

const router: IRouter = Router();

const MealFeedbackSchema = z.object({
  familyId: z.number({ required_error: "familyId is required" }).int().positive(),
  dayIndex: z.number({ required_error: "dayIndex is required" }).int().min(0).max(6),
  mealType: z.string({ required_error: "mealType is required" }).min(1),
  liked: z.boolean().optional().default(true),
  rating: z.number().int().min(1).max(5).optional(),
  skipReason: z.string().optional(),
  notes: z.string().optional(),
});

router.get("/meal-plans/:mealPlanId/feedback", async (req, res): Promise<void> => {
  const mealPlanId = parseInt(req.params.mealPlanId);
  if (isNaN(mealPlanId)) {
    res.status(400).json({ error: "Invalid meal plan id" });
    return;
  }
  const feedback = await db.select().from(mealFeedbackTable)
    .where(eq(mealFeedbackTable.mealPlanId, mealPlanId));
  res.json(feedback);
});

router.post("/meal-plans/:mealPlanId/feedback", async (req, res): Promise<void> => {
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
  const { familyId, dayIndex, mealType, liked, rating, skipReason, notes } = parsed.data;

  const [feedback] = await db.insert(mealFeedbackTable).values({
    familyId,
    mealPlanId,
    dayIndex,
    mealType,
    liked,
    rating: rating ?? (liked ? 5 : 1),
    skipReason: skipReason ?? null,
    notes: notes ?? null,
  }).onConflictDoNothing().returning();

  res.status(201).json(feedback || { message: "Feedback recorded" });
});

export default router;
