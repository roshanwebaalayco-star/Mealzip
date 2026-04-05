import { Request, Response, Router } from "express";
import { db } from "../../db";
import {
  families,
  familyMembers,
  monthlyBudgets,
  weeklyContexts,
  memberWeeklyContexts,
  mealPlans,
  groceryLists,
} from "../../db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { localDb, recipesTable } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";

import type {
  Family,
  FamilyMember,
  MonthlyBudget,
  WeeklyContext,
  MemberWeeklyContext,
  GenerationLogEntry,
  GoalPace,
  DayPlan,
} from "./types";

import {
  applyAutoAssignmentRules,
  calculateDailyCalorieTarget,
} from "./calorie-calculator";

import { runConflictEngine } from "./conflict-engine";
import { runPromptChain } from "./prompt-chain";

import {
  buildHarmonyScoreCard,
  formatHarmonyScorePlainText,
  assembleFinalResult,
  type MealPlanFinalResult,
} from "./lib/harmonyScore";

const router = Router();

async function verifyFamilyOwnership(familyId: number, userId: number): Promise<boolean> {
  const [family] = await db
    .select({ userId: families.userId })
    .from(families)
    .where(eq(families.id, familyId));
  return family?.userId === userId;
}

async function getMealPlanFamilyId(mealPlanId: number): Promise<number | null> {
  const [plan] = await db
    .select({ familyId: mealPlans.familyId })
    .from(mealPlans)
    .where(eq(mealPlans.id, mealPlanId));
  return plan?.familyId ?? null;
}

async function appendLog(mealPlanId: number, entry: GenerationLogEntry): Promise<void> {
  const [current] = await db
    .select({ generationLog: mealPlans.generationLog })
    .from(mealPlans)
    .where(eq(mealPlans.id, mealPlanId));

  const existing = (current?.generationLog as GenerationLogEntry[]) ?? [];

  await db
    .update(mealPlans)
    .set({ generationLog: [...existing, entry] })
    .where(eq(mealPlans.id, mealPlanId));
}

async function setStatus(
  mealPlanId: number,
  status: "pending" | "processing" | "completed" | "failed"
): Promise<void> {
  await db
    .update(mealPlans)
    .set({ generationStatus: status })
    .where(eq(mealPlans.id, mealPlanId));
}

function makeLogger(mealPlanId: number, stepIndex: number) {
  return async (message: string, startTime: number): Promise<void> => {
    await appendLog(mealPlanId, {
      message,
      duration_ms: Date.now() - startTime,
      completed: true,
      step_index: stepIndex,
    });
  };
}

interface GenerationPayload {
  family: Family;
  members: FamilyMember[];
  budget: MonthlyBudget;
  weeklyContext: WeeklyContext;
  memberWeeklyCtxs: MemberWeeklyContext[];
  weeklyContextId: number;
}

async function loadGenerationPayload(
  familyId: number,
  weekStartDate: string,
  monthYear: string
): Promise<GenerationPayload> {
  const [familyRows, memberRows, budgetRows, weeklyCtxRows] = await Promise.all([
    db.select().from(families).where(eq(families.id, familyId)),
    db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.familyId, familyId))
      .orderBy(familyMembers.displayOrder),
    db
      .select()
      .from(monthlyBudgets)
      .where(and(eq(monthlyBudgets.familyId, familyId), eq(monthlyBudgets.monthYear, monthYear))),
    db
      .select()
      .from(weeklyContexts)
      .where(
        and(eq(weeklyContexts.familyId, familyId), eq(weeklyContexts.weekStartDate, weekStartDate))
      ),
  ]);

  const family = familyRows[0];
  const weeklyCtx = weeklyCtxRows[0];
  const budget = budgetRows[0];

  if (!family) throw new Error(`Family ${familyId} not found.`);
  if (!weeklyCtx) throw new Error(`Weekly context for ${weekStartDate} not found. Complete the weekly check-in first.`);
  if (!budget) throw new Error(`Monthly budget for ${monthYear} not set. Please set your monthly budget first.`);
  if (!memberRows.length) throw new Error("No family members found. Complete profile setup first.");

  const memberWeeklyCtxRows = await db
    .select()
    .from(memberWeeklyContexts)
    .where(eq(memberWeeklyContexts.weeklyContextId, weeklyCtx.id));

  return {
    family: castFamily(family),
    members: memberRows.map(castFamilyMember),
    budget: castMonthlyBudget(budget),
    weeklyContext: castWeeklyContext(weeklyCtx),
    memberWeeklyCtxs: memberWeeklyCtxRows.map(castMemberWeeklyContext),
    weeklyContextId: weeklyCtx.id,
  };
}

async function refreshCalorieTargets(
  members: FamilyMember[],
  memberWeeklyCtxs: MemberWeeklyContext[]
): Promise<FamilyMember[]> {
  const weeklyMap = new Map(memberWeeklyCtxs.map((m) => [m.familyMemberId, m]));
  const updated: FamilyMember[] = [];

  for (const member of members) {
    const weekly = weeklyMap.get(member.id);
    const autoAssign = applyAutoAssignmentRules(member.age, member.primaryGoal);
    const effectiveGoal = weekly?.currentGoalOverride ?? autoAssign.effective_goal;
    const effectiveWeight = weekly?.currentWeightKg ?? member.weightKg;

    const { daily_calorie_target } = calculateDailyCalorieTarget({
      age: member.age,
      gender: member.gender,
      heightCm: member.heightCm,
      weightKg: effectiveWeight ? Number(effectiveWeight) : null,
      activityLevel: member.activityLevel,
      primaryGoal: effectiveGoal,
      goalPace: member.goalPace as GoalPace,
    });

    if (daily_calorie_target !== null && daily_calorie_target !== member.dailyCalorieTarget) {
      await db
        .update(familyMembers)
        .set({ dailyCalorieTarget: daily_calorie_target })
        .where(eq(familyMembers.id, member.id));
    }

    updated.push({ ...member, dailyCalorieTarget: daily_calorie_target ?? member.dailyCalorieTarget });
  }

  return updated;
}

async function runMealGeneration(
  mealPlanId: number,
  familyId: number,
  weekStartDate: string,
  monthYear: string
): Promise<MealPlanFinalResult | void> {
  let stepIndex = 0;

  try {
    await setStatus(mealPlanId, "processing");

    let t = Date.now();
    await appendLog(mealPlanId, {
      message: "Loading family profile and weekly context...",
      duration_ms: 0,
      completed: false,
      step_index: stepIndex,
    });

    const payload = await loadGenerationPayload(familyId, weekStartDate, monthYear);
    await makeLogger(mealPlanId, stepIndex++)(
      `Family profile loaded: ${payload.family.name} \u2014 ${payload.members.length} members, ` +
      `\u20B9${payload.budget.totalMonthlyBudget} monthly budget.`,
      t
    );

    t = Date.now();
    const refreshedMembers = await refreshCalorieTargets(
      payload.members,
      payload.memberWeeklyCtxs
    );
    const calorieLog = refreshedMembers
      .map((m) => `${m.name}: ${m.dailyCalorieTarget ?? "N/A"} kcal`)
      .join(", ");
    await makeLogger(mealPlanId, stepIndex++)(
      `ICMR-NIN calorie targets calculated \u2014 ${calorieLog}`, t
    );

    t = Date.now();
    const constraintPacket = runConflictEngine({
      family: payload.family,
      members: refreshedMembers,
      memberWeeklyContexts: payload.memberWeeklyCtxs,
      weeklyContext: payload.weeklyContext,
      budget: payload.budget,
    });

    const { conflicts, harmonyScore } = constraintPacket;
    const levelCounts = [1, 2, 3, 4, 5, 6].map((lvl) => {
      const n = conflicts.filter((c) => c.priority_level === lvl).length;
      return n > 0 ? `${n}\u00D7Level${lvl}` : null;
    }).filter(Boolean).join(", ");

    await makeLogger(mealPlanId, stepIndex++)(
      `Conflict engine complete \u2014 ${conflicts.length} conflict(s) detected and resolved. ` +
      `${levelCounts ? `(${levelCounts})` : ""} ` +
      `Family Harmony Score: ${harmonyScore.final_score}/100.`,
      t
    );

    t = Date.now();
    await makeLogger(mealPlanId, stepIndex++)(
      `Regional food prices calibrated for ${payload.family.stateRegion}. ` +
      `Daily perishable limit: \u20B9${constraintPacket.effectiveDailyBudget.toFixed(0)}. ` +
      `Budget splits: \u20B9${payload.budget.staplesBudget.toFixed(0)} staples / ` +
      `\u20B9${payload.budget.perishablesBudget.toFixed(0)} perishables / ` +
      `\u20B9${payload.budget.bufferBudget.toFixed(0)} buffer. ` +
      `Zero-waste pantry items queued: ${constraintPacket.pantryZeroWasteItems.length}.`,
      t
    );

    const medMembers = constraintPacket.effectiveProfiles.filter(
      (p) => p.activeMedications.length > 0
    );
    if (medMembers.length > 0) {
      t = Date.now();
      const totalMeds = medMembers.reduce((sum, m) => sum + m.activeMedications.length, 0);
      const totalDrugClasses = constraintPacket.medicationGuardrailBundles.filter(
        (b) => b.drug_id !== "unknown"
      ).length;
      const weeklyMonitorCount = constraintPacket.medicationWeeklyMonitorDirectives.length;

      const schedulingHighlight =
        constraintPacket.medicationSchedulingNotes.length > 0
          ? ` Scheduling notes: ${constraintPacket.medicationSchedulingNotes.slice(0, 2).join(" | ")}`
          : "";

      await makeLogger(mealPlanId, stepIndex++)(
        `Medication absorption windows resolved \u2014 ${medMembers.map((m) => m.name).join(", ")}: ` +
        `${totalMeds} drug-food interaction(s) across ${totalDrugClasses} drug class(es) locked into meal slot constraints. ` +
        `${weeklyMonitorCount} week-level consistency rule(s) applied.` +
        schedulingHighlight,
        t
      );
    }

    const feelingMembers = constraintPacket.effectiveProfiles.filter(
      (p) => p.feelingThisWeek
    );
    if (feelingMembers.length > 0) {
      t = Date.now();
      const feelingDetails = feelingMembers
        .map((m) => `${m.name}: "${m.feelingThisWeek}"`)
        .join(", ");
      await makeLogger(mealPlanId, stepIndex++)(
        `Weekly feelings noted — ${feelingDetails}. ` +
        `Gemini will adapt meal suggestions accordingly (lighter meals if tired, warming comfort food if stressed, etc).`,
        t
      );
    }

    const fastingMembers = constraintPacket.effectiveProfiles.filter(
      (p) => p.effectiveFastingDays.length > 0 || p.ekadashiThisWeek || p.festivalFastThisWeek
    );
    if (fastingMembers.length > 0) {
      t = Date.now();
      await makeLogger(mealPlanId, stepIndex++)(
        `Fasting schedule locked \u2014 ${fastingMembers.map((m) => m.name).join(", ")} ` +
        `fasting this week. Pre-loading iron/B12 boost days scheduled for the days before each fast.`,
        t
      );
    }

    t = Date.now();
    await appendLog(mealPlanId, {
      message: `Generating monthly staples list within \u20B9${payload.budget.staplesBudget.toFixed(0)}...`,
      duration_ms: 0,
      completed: false,
      step_index: stepIndex,
    });

    const { result: promptResult, timings } = await runPromptChain(
      constraintPacket,
      weekStartDate
    );

    await appendLog(mealPlanId, {
      message:
        `Monthly staples generated \u2014 ${promptResult.staples.length} items, ` +
        `\u20B9${promptResult.staples_total_cost.toFixed(0)} total.`,
      duration_ms: timings.staples_ms,
      completed: true,
      step_index: stepIndex++,
    });

    await appendLog(mealPlanId, {
      message:
        `21 meals built with "One Base, Many Plates" for ` +
        `${constraintPacket.effectiveProfiles.length} members \u2014 ` +
        `\u20B9${promptResult.weeklyPerishables_total_cost.toFixed(0)} weekly perishables.`,
      duration_ms: timings.meals_ms,
      completed: true,
      step_index: stepIndex++,
    });

    await appendLog(mealPlanId, {
      message:
        `Nutritional buffer finalised \u2014 dry fruits and seasonal fruit allocation ` +
        `within \u20B9${payload.budget.bufferBudget.toFixed(0)}.`,
      duration_ms: timings.buffer_ms,
      completed: true,
      step_index: stepIndex++,
    });

    t = Date.now();
    const finalResult: MealPlanFinalResult = assembleFinalResult(
      constraintPacket,
      promptResult,
      timings
    );

    await appendLog(mealPlanId, {
      message:
        `Plan complete. ${finalResult.harmonyScore.emoji} Family Harmony Score: ` +
        `${finalResult.harmonyScore.score}/100 (${finalResult.harmonyScore.label}). ` +
        `${finalResult.constraints.total_conflicts_detected} conflict(s) resolved. ` +
        `${finalResult.constraints.medication_guardrails_applied} medication guardrail(s) applied. ` +
        `Total generation time: ${timings.total_ms}ms.`,
      duration_ms: Date.now() - t,
      completed: true,
      step_index: stepIndex++,
    });

    await db
      .update(mealPlans)
      .set({
        harmonyScore: finalResult.harmonyScore.score,
        harmonyScoreBreakdown: finalResult.harmonyScore.breakdown as any,
        days: finalResult.mealPlan.days as any,
        nutritionalSummary: finalResult.mealPlan.nutritional_summary as any,
        generationStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(mealPlans.id, mealPlanId));

    await db
      .insert(groceryLists)
      .values({
        familyId,
        mealPlanId,
        listType: "monthly_staples",
        monthYear,
        totalEstimatedCost: String(finalResult.mealPlan.budget_summary.staples_total),
        status: "active",
        items: finalResult.mealPlan.staples as any,
      })
      .onConflictDoNothing();

    await db
      .insert(groceryLists)
      .values({
        familyId,
        mealPlanId,
        listType: "weekly_perishables",
        weekStartDate,
        totalEstimatedCost: String(finalResult.mealPlan.budget_summary.weekly_perishables_total),
        status: "active",
        items: finalResult.mealPlan.weekly_perishables as any,
      })
      .onConflictDoNothing();

    await db
      .insert(groceryLists)
      .values({
        familyId,
        mealPlanId,
        listType: "buffer_fruits_dryfruit",
        monthYear,
        totalEstimatedCost: String(finalResult.mealPlan.budget_summary.buffer_total),
        status: "active",
        items: finalResult.mealPlan.buffer_items as any,
      })
      .onConflictDoNothing();

    await db
      .update(weeklyContexts)
      .set({ status: "meal_plan_generated", updatedAt: new Date() })
      .where(eq(weeklyContexts.id, payload.weeklyContextId));

    return finalResult;

  } catch (error: any) {
    console.error(`[MealGen] Error for plan ${mealPlanId}:`, error);

    await db
      .update(mealPlans)
      .set({
        generationStatus: "failed",
        generationLog: [
          {
            message: `Generation failed: ${error?.message ?? "Unknown error"}`,
            duration_ms: 0,
            completed: false,
            step_index: stepIndex,
          },
        ] as any,
        updatedAt: new Date(),
      })
      .where(eq(mealPlans.id, mealPlanId));
  }
}

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { familyId, weekStartDate } = req.body as {
      familyId: number | string;
      weekStartDate: string;
    };

    if (!familyId || !weekStartDate) {
      return res.status(400).json({ error: "familyId and weekStartDate are required." });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) {
      return res.status(400).json({ error: "weekStartDate must be in YYYY-MM-DD format." });
    }

    const numericFamilyId = Number(familyId);
    if (!Number.isInteger(numericFamilyId) || numericFamilyId <= 0) {
      return res.status(400).json({ error: "familyId must be a positive integer." });
    }
    const userId = (req as any).user?.userId;

    if (userId != null) {
      const isOwner = await verifyFamilyOwnership(numericFamilyId, userId);
      if (!isOwner) {
        return res.status(403).json({ error: "Forbidden: you do not own this family." });
      }
    }

    const monthYear = weekStartDate.substring(0, 7);

    const [weeklyCtx] = await db
      .select()
      .from(weeklyContexts)
      .where(
        and(
          eq(weeklyContexts.familyId, numericFamilyId),
          eq(weeklyContexts.weekStartDate, weekStartDate)
        )
      );

    if (!weeklyCtx) {
      return res.status(404).json({
        error: "Weekly context not found. Complete the weekly check-in form first.",
      });
    }

    const [existingPlan] = await db
      .select()
      .from(mealPlans)
      .where(
        and(eq(mealPlans.familyId, numericFamilyId), eq(mealPlans.weeklyContextId, weeklyCtx.id))
      );

    if (existingPlan?.generationStatus === "completed") {
      return res.status(409).json({
        error: "A completed meal plan already exists for this week.",
        meal_plan_id: existingPlan.id,
        harmony_score: existingPlan.harmonyScore,
      });
    }

    if (existingPlan && existingPlan.generationStatus === "failed") {
      await db.delete(mealPlans).where(eq(mealPlans.id, existingPlan.id));
    }

    const [newPlan] = await db
      .insert(mealPlans)
      .values({
        familyId: numericFamilyId,
        weeklyContextId: weeklyCtx.id,
        generationStatus: "pending",
        harmonyScoreBreakdown: {} as any,
        generationLog: [] as any,
        days: [] as any,
        nutritionalSummary: {} as any,
      })
      .returning({ id: mealPlans.id });

    const mealPlanId = newPlan.id;

    res.status(202).json({
      meal_plan_id: mealPlanId,
      status: "pending",
      message: "Meal generation started. Poll /api/meal-gen/:id/status every 2 seconds.",
      poll_interval_ms: 2000,
    });

    runMealGeneration(mealPlanId, numericFamilyId, weekStartDate, monthYear).catch((err) => {
      console.error("[MealGen] Uncaught pipeline error:", err);
    });
  } catch (error: any) {
    console.error("[POST /generate]", error);
    res.status(500).json({ error: error?.message ?? "Internal server error" });
  }
});

router.get("/:id/status", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid meal plan ID" });

    const userId = (req as any).user?.userId;
    if (userId != null) {
      const ownerFamilyId = await getMealPlanFamilyId(id);
      if (ownerFamilyId == null) return res.status(404).json({ error: "Meal plan not found" });
      const isOwner = await verifyFamilyOwnership(ownerFamilyId, userId);
      if (!isOwner) return res.status(403).json({ error: "Forbidden: you do not own this meal plan." });
    }

    const [plan] = await db
      .select({
        id: mealPlans.id,
        generationStatus: mealPlans.generationStatus,
        harmonyScore: mealPlans.harmonyScore,
        harmonyScoreBreakdown: mealPlans.harmonyScoreBreakdown,
        generationLog: mealPlans.generationLog,
        days: mealPlans.days,
        nutritionalSummary: mealPlans.nutritionalSummary,
        updatedAt: mealPlans.updatedAt,
      })
      .from(mealPlans)
      .where(eq(mealPlans.id, id));

    if (!plan) return res.status(404).json({ error: "Meal plan not found" });

    if (plan.generationStatus === "completed") {
      const rawBreakdown = plan.harmonyScoreBreakdown as any;
      const scoreCard = rawBreakdown?.final_score != null
        ? buildHarmonyScoreCard(rawBreakdown)
        : null;

      return res.json({
        id: plan.id,
        status: plan.generationStatus,
        harmony_score: plan.harmonyScore,
        harmony_score_label: scoreCard?.label ?? "Good",
        harmony_score_emoji: scoreCard?.emoji ?? "\u{1F7E1}",
        harmony_score_color: scoreCard?.color ?? "#65a30d",
        harmony_score_breakdown: rawBreakdown,
        harmony_score_card: scoreCard,
        generation_log: plan.generationLog,
        days: plan.days,
        nutritional_summary: plan.nutritionalSummary,
        updated_at: plan.updatedAt,
      });
    }

    return res.json({
      id: plan.id,
      status: plan.generationStatus,
      generation_log: plan.generationLog,
      harmony_score: null,
      days: null,
    });
  } catch (error: any) {
    console.error("[GET /:id/status]", error);
    res.status(500).json({ error: error?.message ?? "Internal server error" });
  }
});

router.get("/:id/conflicts", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid meal plan ID" });

    const userId = (req as any).user?.userId;
    if (userId != null) {
      const ownerFamilyId = await getMealPlanFamilyId(id);
      if (ownerFamilyId == null) return res.status(404).json({ error: "Meal plan not found" });
      const isOwner = await verifyFamilyOwnership(ownerFamilyId, userId);
      if (!isOwner) return res.status(403).json({ error: "Forbidden: you do not own this meal plan." });
    }

    const [plan] = await db
      .select({
        harmonyScore: mealPlans.harmonyScore,
        harmonyScoreBreakdown: mealPlans.harmonyScoreBreakdown,
        generationStatus: mealPlans.generationStatus,
      })
      .from(mealPlans)
      .where(eq(mealPlans.id, id));

    if (!plan || plan.generationStatus !== "completed") {
      return res.status(404).json({ error: "Plan not found or not yet completed." });
    }

    const rawBreakdown = plan.harmonyScoreBreakdown as any;
    const scoreCard = buildHarmonyScoreCard(rawBreakdown);

    return res.json({
      harmony_score: scoreCard.score,
      harmony_score_label: scoreCard.label,
      harmony_score_emoji: scoreCard.emoji,
      harmony_score_color: scoreCard.color,
      tier_description: scoreCard.tier_description,
      score_summary_text: scoreCard.score_summary_text,
      deductions: scoreCard.deductions,
      additions: scoreCard.additions,
      total_deducted: scoreCard.total_deducted,
      total_added: scoreCard.total_added,
      conflict_cards: scoreCard.conflict_cards,
      conflicts_detected: scoreCard.conflict_cards.length,
      conflicts_resolved: rawBreakdown.conflicts_resolved?.length ?? 0,
      medication_bonus: {
        points: scoreCard.medication_bonus_pts,
        text: scoreCard.medication_bonus_text,
      },
      zero_waste_bonus: {
        points: scoreCard.zero_waste_bonus_pts,
        text: scoreCard.zero_waste_bonus_text,
      },
    });
  } catch (error: any) {
    console.error("[GET /:id/conflicts]", error);
    res.status(500).json({ error: error?.message ?? "Internal server error" });
  }
});

router.post("/:id/skip-meal", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid meal plan ID" });

    const userId = (req as any).user?.userId;
    if (userId != null) {
      const ownerFamilyId = await getMealPlanFamilyId(id);
      if (ownerFamilyId == null) return res.status(404).json({ error: "Meal plan not found" });
      const isOwner = await verifyFamilyOwnership(ownerFamilyId, userId);
      if (!isOwner) return res.status(403).json({ error: "Forbidden: you do not own this meal plan." });
    }

    const { day_date, meal_slot } = req.body as {
      day_date: string;
      meal_slot: "breakfast" | "lunch" | "dinner" | "snack";
    };

    if (!day_date || !meal_slot) {
      return res.status(400).json({ error: "day_date and meal_slot are required." });
    }

    const validSlots = ["breakfast", "lunch", "dinner", "snack"];
    if (!validSlots.includes(meal_slot)) {
      return res.status(400).json({ error: `meal_slot must be one of: ${validSlots.join(", ")}` });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(day_date)) {
      return res.status(400).json({ error: "day_date must be in YYYY-MM-DD format." });
    }

    const [plan] = await db
      .select({ days: mealPlans.days })
      .from(mealPlans)
      .where(eq(mealPlans.id, id));

    if (!plan) return res.status(404).json({ error: "Meal plan not found." });

    const days = (plan.days as DayPlan[]) ?? [];
    const dayIndex = days.findIndex((d) => d.date === day_date);

    if (dayIndex === -1) {
      return res.status(404).json({ error: `No day found for ${day_date}.` });
    }

    const targetDay = days[dayIndex];
    const skippedMeal = targetDay.meals?.[meal_slot];

    if (!skippedMeal) {
      return res.status(404).json({ error: `No ${meal_slot} found on ${day_date}.` });
    }

    const savedAmount = skippedMeal.estimated_cost ?? 0;

    days[dayIndex].meals[meal_slot] = {
      ...skippedMeal,
      skipped: true,
      skip_reason: "User skipped / ate out",
      priority_flags: [...(skippedMeal.priority_flags ?? []), "skipped_meal"],
      nutritional_bandaid:
        `Missed ${meal_slot} on ${day_date}. Pull from your monthly dry fruit buffer: ` +
        `a handful of almonds or walnuts (150 kcal, protein + healthy fats), ` +
        `2 dates for quick energy, or a glass of warm haldi milk (anti-inflammatory). ` +
        `\u20B9${savedAmount.toFixed(0)} saved \u2014 rolls over to tomorrow's budget.`,
    };

    const nextDayIndex = dayIndex + 1;
    if (nextDayIndex < days.length && skippedMeal.pantry_items_used?.length) {
      if (!days[nextDayIndex].carry_forward_ingredients) {
        days[nextDayIndex].carry_forward_ingredients = [];
      }
      const skippedIngredients = skippedMeal.base_recipe?.ingredients?.map(
        (i: any) => `${i.name} (carry-forward from skipped ${meal_slot} on ${day_date})`
      ) ?? [];
      days[nextDayIndex].carry_forward_ingredients!.push(...skippedIngredients);

      const tomorrow = days[nextDayIndex].meals;
      const firstMeal = tomorrow.breakfast ?? tomorrow.lunch ?? tomorrow.dinner;
      if (firstMeal) {
        firstMeal.priority_flags = [
          ...(firstMeal.priority_flags ?? []),
          "zero_waste_rollover_from_skipped_meal",
        ];
      }
    }

    await db
      .update(mealPlans)
      .set({ days: days as any, updatedAt: new Date() })
      .where(eq(mealPlans.id, id));

    return res.json({
      success: true,
      nutritional_bandaid: (days[dayIndex].meals[meal_slot] as any)?.nutritional_bandaid,
      carry_forward:
        nextDayIndex < days.length
          ? `${skippedMeal.base_recipe?.ingredients?.length ?? 0} ingredient(s) queued for tomorrow's priority use.`
          : "Last day of week \u2014 no carry-forward.",
      saved_amount_inr: savedAmount,
    });
  } catch (error: any) {
    console.error("[POST /:id/skip-meal]", error);
    res.status(500).json({ error: error?.message ?? "Internal server error" });
  }
});

function castFamily(row: any): Family {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    stateRegion: row.stateRegion,
    languagePreference: row.languagePreference,
    householdDietaryBaseline: row.householdDietaryBaseline,
    mealsPerDay: row.mealsPerDay,
    cookingSkillLevel: row.cookingSkillLevel,
    appliances: row.appliances ?? [],
    pincode: row.pincode ?? null,
  };
}

function castFamilyMember(row: any): FamilyMember {
  return {
    id: row.id,
    familyId: row.familyId,
    name: row.name,
    age: Number(row.age),
    gender: row.gender,
    heightCm: row.heightCm != null ? Number(row.heightCm) : null,
    weightKg: row.weightKg != null ? Number(row.weightKg) : null,
    activityLevel: row.activityLevel,
    primaryGoal: row.primaryGoal,
    goalPace: row.goalPace ?? null,
    dailyCalorieTarget: row.dailyCalorieTarget != null ? Number(row.dailyCalorieTarget) : null,
    dietaryType: row.dietaryType,
    spiceTolerance: row.spiceTolerance,
    tiffinNeeded: row.tiffinNeeded ?? "no",
    festivalFastingAlerts: row.festivalFastingAlerts ?? false,
    displayOrder: row.displayOrder ?? 0,
    healthConditions: row.healthConditions ?? [],
    allergies: row.allergies ?? [],
    ingredientDislikes: row.ingredientDislikes ?? [],
    religiousCulturalRules: row.religiousCulturalRules ?? { type: "none", details: [] },
    occasionalNonvegConfig: row.occasionalNonvegConfig ?? null,
    fastingConfig: row.fastingConfig ?? {
      type: "no_fasting",
      weekly_days: [],
      ekadashi: false,
      festival_alerts: false,
    },
  };
}

function castMonthlyBudget(row: any): MonthlyBudget {
  return {
    id: row.id,
    familyId: row.familyId,
    monthYear: row.monthYear,
    totalMonthlyBudget: Number(row.totalMonthlyBudget),
    staplesBudget: Number(row.staplesBudget),
    perishablesBudget: Number(row.perishablesBudget),
    bufferBudget: Number(row.bufferBudget),
    dailyPerishableLimit: Number(row.dailyPerishableLimit),
    regionalPriceSuggestion:
      row.regionalPriceSuggestion != null ? Number(row.regionalPriceSuggestion) : null,
    budgetBreakdown: row.budgetBreakdown ?? {
      breakfast_weight: 0.28,
      lunch_weight: 0.36,
      dinner_weight: 0.36,
      snack_weight: 0,
      daily_limits: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
    },
  };
}

function castWeeklyContext(row: any): WeeklyContext {
  return {
    id: row.id,
    familyId: row.familyId,
    weekStartDate: row.weekStartDate,
    eatingOutFrequency: row.eatingOutFrequency,
    weekdayCookingTime: row.weekdayCookingTime,
    weekendCookingTime: row.weekendCookingTime,
    weeklyPerishableBudgetOverride:
      row.weeklyPerishableBudgetOverride != null
        ? Number(row.weeklyPerishableBudgetOverride)
        : null,
    specialRequest: row.specialRequest ?? null,
    status: row.status,
    pantrySnapshot: row.pantrySnapshot ?? [],
  };
}

function castMemberWeeklyContext(row: any): MemberWeeklyContext {
  return {
    id: row.id,
    weeklyContextId: row.weeklyContextId,
    familyMemberId: row.familyMemberId,
    currentGoalOverride: row.currentGoalOverride ?? null,
    currentWeightKg: row.currentWeightKg != null ? Number(row.currentWeightKg) : null,
    feelingThisWeek: row.feelingThisWeek ?? null,
    spiceToleranceOverride: row.spiceToleranceOverride ?? null,
    tiffinNeededOverride: row.tiffinNeededOverride ?? null,
    healthConditionsOverride: row.healthConditionsOverride ?? null,
    activeMedications: row.activeMedications ?? [],
    fastingDaysThisWeek: row.fastingDaysThisWeek ?? [],
    ekadashiThisWeek: row.ekadashiThisWeek ?? false,
    festivalFastThisWeek: row.festivalFastThisWeek ?? false,
    nonvegDaysThisWeek: row.nonvegDaysThisWeek ?? [],
    nonvegTypesThisWeek: row.nonvegTypesThisWeek ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RECIPE VIEWER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const STEP_KEYWORDS: Record<string, string[]> = {
  tempering:    ["temper", "tadka", "heat oil", "mustard seed", "jeera", "splutter", "onion", "garlic", "add onion", "fry onion"],
  salt:         ["add salt", "season", "salt to taste", "namak"],
  dairy:        ["add ghee", "add butter", "add paneer", "add curd", "add cream", "add milk", "finish with ghee"],
  sugar:        ["add sugar", "jaggery", "sweetener"],
  serve:        ["serve", "garnish", "plate", "transfer to serving"],
  cook_protein: ["add chicken", "add mutton", "add fish", "add egg", "add prawns"],
};

function matchModificationToStep(modification: string, steps: string[]): number {
  const explicitMatch = modification.match(/step\s+(\d+)/i);
  if (explicitMatch) {
    const stepNum = parseInt(explicitMatch[1], 10);
    if (stepNum >= 1 && stepNum <= steps.length) return stepNum - 1;
  }
  const modLower = modification.toLowerCase();
  for (const [, keywords] of Object.entries(STEP_KEYWORDS)) {
    const modHasKeyword = keywords.some((kw) => modLower.includes(kw));
    if (modHasKeyword) {
      const matchedStepIndex = steps.findIndex((step) =>
        keywords.some((kw) => step.toLowerCase().includes(kw))
      );
      if (matchedStepIndex !== -1) return matchedStepIndex;
    }
  }
  return steps.length - 1;
}

function detectUrgency(modification: string): "CRITICAL" | "RECOMMENDED" | "INFO" {
  const upper = modification.toUpperCase();
  if (upper.includes("ALLERGY CRITICAL") || upper.includes("PULL BEFORE") || upper.includes("JAIN RULE") || upper.includes("RELIGIOUS")) return "CRITICAL";
  if (upper.includes("DIABETES") || upper.includes("KIDNEY") || upper.includes("HYPERTENSION") || upper.includes("SODIUM CAP") || upper.includes("FASTING")) return "RECOMMENDED";
  return "INFO";
}

interface EnrichedStep {
  step_number: number;
  instruction: string;
  member_modifications: {
    member_name: string;
    modification_text: string;
    urgency: "CRITICAL" | "RECOMMENDED" | "INFO";
  }[];
}

function buildEnrichedSteps(steps: string[], memberPlates: any[]): EnrichedStep[] {
  const stepModMap: Map<number, { member_name: string; modification_text: string; urgency: "CRITICAL" | "RECOMMENDED" | "INFO" }[]> = new Map();
  for (const plate of memberPlates) {
    const mods: string[] = plate.modifications ?? [];
    for (const mod of mods) {
      const idx = matchModificationToStep(mod, steps);
      if (!stepModMap.has(idx)) stepModMap.set(idx, []);
      stepModMap.get(idx)!.push({
        member_name: plate.member_name,
        modification_text: mod,
        urgency: detectUrgency(mod),
      });
    }
  }
  return steps.map((instruction, idx) => ({
    step_number: idx + 1,
    instruction,
    member_modifications: stepModMap.get(idx) ?? [],
  }));
}

async function fetchImageUrl(imageQuery: string): Promise<string | null> {
  try {
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (unsplashKey) {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(imageQuery + " Indian food")}&per_page=1&orientation=landscape`;
      const res = await fetch(url, { headers: { Authorization: `Client-ID ${unsplashKey}` } });
      if (res.ok) {
        const data = await res.json() as any;
        const imgUrl = data?.results?.[0]?.urls?.regular;
        if (imgUrl) return imgUrl;
      }
    }
    const googleKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    const googleCx = process.env.GOOGLE_SEARCH_ENGINE_ID;
    if (googleKey && googleCx) {
      const url = `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(imageQuery + " Indian food")}&searchType=image&num=1&imgSize=large`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as any;
        const imgUrl = data?.items?.[0]?.link;
        if (imgUrl) return imgUrl;
      }
    }
  } catch (e) {
    console.error("[RecipeViewer] Image fetch error:", e);
  }
  return null;
}

async function enrichSlot(slot: string, meal: any, stateRegion: string): Promise<any> {
  if (!meal) return null;

  if (meal.skipped) {
    return {
      slot,
      name: meal.name ?? slot,
      skipped: true,
      skip_reason: meal.skip_reason ?? "",
      nutritional_bandaid: meal.nutritional_bandaid ?? "",
    };
  }

  const baseRecipe = meal.base_recipe ?? {};
  let ingredients: { name: string; quantity: string }[] = baseRecipe.ingredients ?? [];
  let steps: string[] = baseRecipe.steps ?? [];
  let prepTime: number = baseRecipe.prep_time_mins ?? 0;
  let cookTime: number = baseRecipe.cook_time_mins ?? 0;
  let recipeSource: "stored" | "database" | "gemini_generated" = "stored";

  const hasStoredRecipe = steps.length > 0 && ingredients.length > 0;

  if (!hasStoredRecipe) {
    try {
      const [dbRow] = await localDb
        .select({
          ingredients: recipesTable.ingredients,
          instructions: recipesTable.instructions,
          prepTimeMin: recipesTable.prepTimeMin,
          cookTimeMin: recipesTable.cookTimeMin,
        })
        .from(recipesTable)
        .where(ilike(recipesTable.name, meal.name ?? ""))
        .limit(1);

      if (dbRow && dbRow.instructions) {
        const rawSteps = dbRow.instructions
          .split(/\r?\n|(?=Step \d+:)/i)
          .map((s: string) => s.trim())
          .filter(Boolean);
        const rawIngredients = typeof dbRow.ingredients === "string"
          ? dbRow.ingredients.split(/[|,\n]/).map((s: string) => ({ name: s.trim(), quantity: "" })).filter((i: any) => i.name.length > 0)
          : [];
        if (rawSteps.length > 0) {
          steps = rawSteps;
          ingredients = rawIngredients.length > 0 ? rawIngredients : ingredients;
          prepTime = dbRow.prepTimeMin ?? prepTime;
          cookTime = dbRow.cookTimeMin ?? cookTime;
          recipeSource = "database";
        }
      }
    } catch (e) {
      console.error("[RecipeViewer] DB recipe lookup error:", e);
    }
  }

  if (steps.length === 0) {
    try {
      const prompt = `You are a clinical Indian cooking assistant. Generate a standard recipe for "${meal.name ?? "the dish"}" as served in ${stateRegion}.

Return ONLY valid JSON in exactly this shape:
{
  "ingredients": [{ "name": "string", "quantity": "string" }],
  "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "prep_time_mins": number,
  "cook_time_mins": number
}

Rules:
- Do NOT include any health modifications in the steps. Steps are the base recipe only.
- Steps must be numbered: "Step 1:", "Step 2:", etc.
- Use Indian cooking terminology and measurements (katori, tbsp, tsp, grams).
- Maximum 10 steps. Minimum 4 steps.
- Do not add any text outside the JSON object.`;

      const geminiModel = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await geminiModel.generateContent(prompt);
      const text = result.response.text().trim();
      const jsonText = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(jsonText);
      steps = parsed.steps ?? [];
      if (parsed.ingredients?.length > 0) ingredients = parsed.ingredients;
      prepTime = parsed.prep_time_mins ?? prepTime;
      cookTime = parsed.cook_time_mins ?? cookTime;
      recipeSource = "gemini_generated";
    } catch (e) {
      console.error("[RecipeViewer] Gemini recipe generation error:", e);
    }
  }

  const memberPlates: any[] = meal.member_plates ?? [];
  const enrichedSteps = buildEnrichedSteps(steps, memberPlates);
  const imageQuery = baseRecipe.image_search_query ?? meal.name ?? "Indian food";
  const imageUrl = meal.image_url ?? await fetchImageUrl(imageQuery);

  return {
    slot,
    name: meal.name ?? slot,
    image_url: imageUrl,
    image_query: imageQuery,
    estimated_cost_inr: meal.estimated_cost ?? 0,
    prep_time_mins: prepTime,
    cook_time_mins: cookTime,
    priority_flags: meal.priority_flags ?? [],
    pantry_items_used: meal.pantry_items_used ?? [],
    ingredients,
    enriched_steps: enrichedSteps,
    member_plates: memberPlates.map((p: any) => ({
      member_name: p.member_name,
      modifications: p.modifications ?? [],
      fasting_replacement: p.fasting_replacement ?? null,
      tiffin_instructions: p.tiffin_instructions ?? null,
    })),
    recipe_source: recipeSource,
    skipped: false as const,
  };
}

// GET /api/meal-gen/:id/day/:date/recipe
router.get("/:id/day/:date/recipe", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const dateParam = req.params.date;

    if (isNaN(id)) return res.status(400).json({ error: "Invalid meal plan ID" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });

    const userId = (req as any).user?.userId;
    if (userId != null) {
      const ownerFamilyId = await getMealPlanFamilyId(id);
      if (ownerFamilyId == null) return res.status(404).json({ error: "Meal plan not found" });
      const isOwner = await verifyFamilyOwnership(ownerFamilyId, userId);
      if (!isOwner) return res.status(403).json({ error: "Forbidden: you do not own this meal plan." });
    }

    const [plan] = await db
      .select({ generationStatus: mealPlans.generationStatus, days: mealPlans.days, familyId: mealPlans.familyId })
      .from(mealPlans)
      .where(eq(mealPlans.id, id));

    if (!plan) return res.status(404).json({ error: "Meal plan not found" });

    if (plan.generationStatus !== "completed") {
      return res.status(403).json({
        error: "Recipe viewer is only available after meal generation is complete.",
        status: plan.generationStatus,
      });
    }

    const rawDays = plan.days as any;
    const daysArr: any[] = Array.isArray(rawDays) ? rawDays : (rawDays?.days ?? []);
    const dayPlan = daysArr.find((d: any) => d.date === dateParam || d.day === dateParam);

    if (!dayPlan) {
      return res.status(404).json({ error: "No meal plan found for this date." });
    }

    const [familyRow] = await db
      .select({ stateRegion: families.stateRegion })
      .from(families)
      .where(eq(families.id, plan.familyId));
    const stateRegion = familyRow?.stateRegion ?? "Delhi";

    const mealSlots = dayPlan.meals ?? {};
    const [breakfastResult, lunchResult, dinnerResult] = await Promise.all([
      (async () => {
        try { return await enrichSlot("breakfast", mealSlots.breakfast, stateRegion); }
        catch (e) { console.error("[RecipeViewer] breakfast error:", e); return { slot: "breakfast", name: "Breakfast", error: "Recipe details unavailable", skipped: false }; }
      })(),
      (async () => {
        try { return await enrichSlot("lunch", mealSlots.lunch, stateRegion); }
        catch (e) { console.error("[RecipeViewer] lunch error:", e); return { slot: "lunch", name: "Lunch", error: "Recipe details unavailable", skipped: false }; }
      })(),
      (async () => {
        try { return await enrichSlot("dinner", mealSlots.dinner, stateRegion); }
        catch (e) { console.error("[RecipeViewer] dinner error:", e); return { slot: "dinner", name: "Dinner", error: "Recipe details unavailable", skipped: false }; }
      })(),
    ]);

    const dayName = dayPlan.day_name ?? dayPlan.day ?? new Date(dateParam).toLocaleDateString("en-US", { weekday: "long" });

    return res.json({
      meal_plan_id: id,
      date: dateParam,
      day_name: dayName,
      meals: {
        breakfast: breakfastResult,
        lunch: lunchResult,
        dinner: dinnerResult,
      },
    });
  } catch (error: any) {
    console.error("[RecipeViewer]", error);
    res.status(500).json({ error: error?.message ?? "Internal server error" });
  }
});

export default router;
