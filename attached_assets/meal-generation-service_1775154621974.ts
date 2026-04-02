// =============================================================================
// NutriNext ParivarSehat — Meal Generation Service
// The single Express Router that orchestrates the entire meal generation pipeline.
//
// Routes exposed:
//   POST /api/meal-plans/generate          → Start async generation, returns ID
//   GET  /api/meal-plans/:id/status        → Poll for live log + result
//   GET  /api/meal-plans/:id/conflicts     → Conflict transparency card
//   POST /api/meal-plans/:id/skip-meal     → Mark meal skipped / eaten out
//
// Mount in app.ts / server.ts:
//   import mealPlanRouter from "./engine/meal-generation-service";
//   app.use("/api/meal-plans", mealPlanRouter);
// =============================================================================

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
import { eq, and } from "drizzle-orm";

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

import { runConflictEngine, formatConflictSummaryForUI } from "./conflict-engine";
import { runPromptChain } from "./prompt-chain";

// ── NEW: Harmony Score module ─────────────────────────────────────────────────
import {
  buildHarmonyScoreCard,
  formatHarmonyScorePlainText,
  assembleFinalResult,
  type MealPlanFinalResult,
} from "./src/lib/harmonyScore";

const router = Router();

// =============================================================================
// GENERATION LOG HELPER
// Appends one log entry to the meal plan's generation_log JSONB column.
// Frontend polls /status and reads this array to show the waiting screen.
// =============================================================================

async function appendLog(mealPlanId: string, entry: GenerationLogEntry): Promise<void> {
  // Read → append → write. Safe for Replit/Supabase (no JSON_ARRAYAPPEND support needed).
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
  mealPlanId: string,
  status: "pending" | "processing" | "completed" | "failed"
): Promise<void> {
  await db
    .update(mealPlans)
    .set({ generationStatus: status })
    .where(eq(mealPlans.id, mealPlanId));
}

function makeLogger(mealPlanId: string, stepIndex: number) {
  return async (message: string, startTime: number): Promise<void> => {
    await appendLog(mealPlanId, {
      message,
      duration_ms: Date.now() - startTime,
      completed: true,
      step_index: stepIndex,
    });
  };
}

// =============================================================================
// DATA FETCHER
// Loads all required DB rows for the generation payload.
// Uses parallel fetches where possible to minimize latency.
// =============================================================================

interface GenerationPayload {
  family: Family;
  members: FamilyMember[];
  budget: MonthlyBudget;
  weeklyContext: WeeklyContext;
  memberWeeklyCtxs: MemberWeeklyContext[];
  weeklyContextId: string;
}

async function loadGenerationPayload(
  familyId: string,
  weekStartDate: string,
  monthYear: string
): Promise<GenerationPayload> {
  // Fetch family, members, budget, and weekly context in parallel
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

  // Fetch member weekly contexts (depends on weeklyCtx.id)
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

// =============================================================================
// CALORIE TARGET REFRESHER
// Recalculates daily_calorie_target for each member using current week data.
// Persists updated values back to the family_members table.
// =============================================================================

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

    // Persist if changed (null → 0 treated as same, skip update)
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

// =============================================================================
// CORE GENERATION PIPELINE
// Async — runs after returning 202 Accepted to the client.
// Updates generation_log in real-time for the polling waiting screen.
// =============================================================================

async function runMealGeneration(
  mealPlanId: string,
  familyId: string,
  weekStartDate: string,
  monthYear: string
): Promise<void> {
  let stepIndex = 0;

  try {
    await setStatus(mealPlanId, "processing");

    // ── STEP 1: Load family data ──────────────────────────────────────────
    let t = Date.now();
    await appendLog(mealPlanId, {
      message: "Loading family profile and weekly context...",
      duration_ms: 0,
      completed: false,
      step_index: stepIndex,
    });

    const payload = await loadGenerationPayload(familyId, weekStartDate, monthYear);
    await makeLogger(mealPlanId, stepIndex++)(
      `Family profile loaded: ${payload.family.name} — ${payload.members.length} members, ` +
      `₹${payload.budget.totalMonthlyBudget} monthly budget.`,
      t
    );

    // ── STEP 2: Refresh calorie targets ───────────────────────────────────
    t = Date.now();
    const refreshedMembers = await refreshCalorieTargets(
      payload.members,
      payload.memberWeeklyCtxs
    );
    const calorieLog = refreshedMembers
      .map((m) => `${m.name}: ${m.dailyCalorieTarget ?? "N/A"} kcal`)
      .join(", ");
    await makeLogger(mealPlanId, stepIndex++)(
      `ICMR-NIN calorie targets calculated — ${calorieLog}`, t
    );

    // ── STEP 3: Run conflict engine ───────────────────────────────────────
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
      return n > 0 ? `${n}×Level${lvl}` : null;
    }).filter(Boolean).join(", ");

    await makeLogger(mealPlanId, stepIndex++)(
      `Conflict engine complete — ${conflicts.length} conflict(s) detected and resolved. ` +
      `${levelCounts ? `(${levelCounts})` : ""} ` +
      `Family Harmony Score: ${harmonyScore.final_score}/100.`,
      t
    );

    // ── STEP 4: Regional budget calibration ───────────────────────────────
    t = Date.now();
    await makeLogger(mealPlanId, stepIndex++)(
      `Regional food prices calibrated for ${payload.family.stateRegion}. ` +
      `Daily perishable limit: ₹${constraintPacket.effectiveDailyBudget.toFixed(0)}. ` +
      `Budget splits: ₹${payload.budget.staplesBudget.toFixed(0)} staples / ` +
      `₹${payload.budget.perishablesBudget.toFixed(0)} perishables / ` +
      `₹${payload.budget.bufferBudget.toFixed(0)} buffer. ` +
      `Zero-waste pantry items queued: ${constraintPacket.pantryZeroWasteItems.length}.`,
      t
    );

    // ── STEP 5: Medication window resolution ──────────────────────────────
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

      // Surface the scheduling notes from the rule engine in the waiting screen
      // e.g. "Levothyroxine: breakfast delayed 30–60 min after medication."
      const schedulingHighlight =
        constraintPacket.medicationSchedulingNotes.length > 0
          ? ` Scheduling notes: ${constraintPacket.medicationSchedulingNotes.slice(0, 2).join(" | ")}`
          : "";

      await makeLogger(mealPlanId, stepIndex++)(
        `Medication absorption windows resolved — ${medMembers.map((m) => m.name).join(", ")}: ` +
        `${totalMeds} drug-food interaction(s) across ${totalDrugClasses} drug class(es) locked into meal slot constraints. ` +
        `${weeklyMonitorCount} week-level consistency rule(s) applied (e.g. Warfarin leafy-green schedule, grapefruit ban).` +
        schedulingHighlight,
        t
      );
    }

    // ── STEP 6: Fasting pre-load check ────────────────────────────────────
    const fastingMembers = constraintPacket.effectiveProfiles.filter(
      (p) => p.effectiveFastingDays.length > 0 || p.ekadashiThisWeek || p.festivalFastThisWeek
    );
    if (fastingMembers.length > 0) {
      t = Date.now();
      await makeLogger(mealPlanId, stepIndex++)(
        `Fasting schedule locked — ${fastingMembers.map((m) => m.name).join(", ")} ` +
        `fasting this week. Pre-loading iron/B12 boost days scheduled for the days before each fast.`,
        t
      );
    }

    // ── STEP 7–9: Run the 3-step Gemini prompt chain ──────────────────────
    t = Date.now();
    await appendLog(mealPlanId, {
      message: `Generating monthly staples list within ₹${payload.budget.staplesBudget.toFixed(0)}...`,
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
        `Monthly staples generated — ${promptResult.staples.length} items, ` +
        `₹${promptResult.staples_total_cost.toFixed(0)} total.`,
      duration_ms: timings.staples_ms,
      completed: true,
      step_index: stepIndex++,
    });

    await appendLog(mealPlanId, {
      message:
        `21 meals built with "One Base, Many Plates" for ` +
        `${constraintPacket.effectiveProfiles.length} members — ` +
        `₹${promptResult.weeklyPerishables_total_cost.toFixed(0)} weekly perishables.`,
      duration_ms: timings.meals_ms,
      completed: true,
      step_index: stepIndex++,
    });

    await appendLog(mealPlanId, {
      message:
        `Nutritional buffer finalised — dry fruits and seasonal fruit allocation ` +
        `within ₹${payload.budget.bufferBudget.toFixed(0)}.`,
      duration_ms: timings.buffer_ms,
      completed: true,
      step_index: stepIndex++,
    });

    // ── STEP 10: Assemble final result (harmony score + full meal plan) ────
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

    // ── STEP 11: Write meal plan + harmony score to DB ─────────────────────
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

    // ── STEP 12: Write grocery lists to DB ────────────────────────────────

    // Monthly staples (40% budget)
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

    // Weekly perishables (50% budget)
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

    // Buffer dry fruits + fruits (10% budget)
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

    // Update weekly context status to meal_plan_generated
    await db
      .update(weeklyContexts)
      .set({ status: "meal_plan_generated", updatedAt: new Date() })
      .where(eq(weeklyContexts.id, payload.weeklyContextId));

    // Return the complete final result — used by /status polling endpoint
    return finalResult;

  } catch (error: any) {
    console.error(`[MealGen] ❌ Error for plan ${mealPlanId}:`, error);

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

// =============================================================================
// ROUTE: POST /generate
// Returns 202 Accepted immediately with { meal_plan_id }.
// Frontend starts polling /api/meal-plans/:id/status.
// =============================================================================

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { familyId, weekStartDate } = req.body as {
      familyId: string;
      weekStartDate: string; // "YYYY-MM-DD" — must be a Monday
    };

    if (!familyId || !weekStartDate) {
      return res.status(400).json({ error: "familyId and weekStartDate are required." });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) {
      return res.status(400).json({ error: "weekStartDate must be in YYYY-MM-DD format." });
    }

    const monthYear = weekStartDate.substring(0, 7); // "YYYY-MM"

    // Check weekly_context exists
    const [weeklyCtx] = await db
      .select()
      .from(weeklyContexts)
      .where(
        and(
          eq(weeklyContexts.familyId, familyId),
          eq(weeklyContexts.weekStartDate, weekStartDate)
        )
      );

    if (!weeklyCtx) {
      return res.status(404).json({
        error: "Weekly context not found. Complete the weekly check-in form first.",
      });
    }

    // Prevent duplicate generation
    const [existingPlan] = await db
      .select()
      .from(mealPlans)
      .where(
        and(eq(mealPlans.familyId, familyId), eq(mealPlans.weeklyContextId, weeklyCtx.id))
      );

    if (existingPlan?.generationStatus === "completed") {
      return res.status(409).json({
        error: "A completed meal plan already exists for this week.",
        meal_plan_id: existingPlan.id,
        harmony_score: existingPlan.harmonyScore,
      });
    }

    // Clean up stuck/failed plan so we can regenerate
    if (existingPlan && existingPlan.generationStatus === "failed") {
      await db.delete(mealPlans).where(eq(mealPlans.id, existingPlan.id));
    }

    // Create meal plan row in pending state — return this ID immediately
    const [newPlan] = await db
      .insert(mealPlans)
      .values({
        familyId,
        weeklyContextId: weeklyCtx.id,
        generationStatus: "pending",
        harmonyScoreBreakdown: {} as any,
        generationLog: [] as any,
        days: [] as any,
        nutritionalSummary: {} as any,
      })
      .returning({ id: mealPlans.id });

    const mealPlanId = newPlan.id;

    // Return immediately — do NOT await the pipeline
    res.status(202).json({
      meal_plan_id: mealPlanId,
      status: "pending",
      message: "Meal generation started. Poll /api/meal-plans/:id/status every 2 seconds.",
      poll_interval_ms: 2000,
    });

    // Kick off async pipeline — errors are caught internally
    runMealGeneration(mealPlanId, familyId, weekStartDate, monthYear).catch((err) => {
      console.error("[MealGen] Uncaught pipeline error:", err);
    });
  } catch (error: any) {
    console.error("[POST /generate]", error);
    res.status(500).json({ error: error?.message ?? "Internal server error" });
  }
});

// =============================================================================
// ROUTE: GET /:id/status
// Lightweight poll endpoint. Returns generation_log + final plan on completion.
// =============================================================================

router.get("/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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

      // Use the harmonyScore module for rich card data (no re-computation needed)
      const scoreCard = rawBreakdown
        ? buildHarmonyScoreCard(rawBreakdown)
        : null;

      return res.json({
        id: plan.id,
        status: plan.generationStatus,
        harmony_score: plan.harmonyScore,
        harmony_score_label: scoreCard?.label ?? "Good",
        harmony_score_emoji: scoreCard?.emoji ?? "🟡",
        harmony_score_color: scoreCard?.color ?? "#65a30d",
        harmony_score_breakdown: rawBreakdown,
        harmony_score_card: scoreCard,        // Full card data for the UI conflict panel
        generation_log: plan.generationLog,
        days: plan.days,
        nutritional_summary: plan.nutritionalSummary,
        updated_at: plan.updatedAt,
      });
    }

    // Pending / processing — log only, no days data yet
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

// =============================================================================
// ROUTE: GET /:id/conflicts
// Returns the formatted conflict transparency card for the frontend.
// Now powered by buildHarmonyScoreCard() for rich, structured output.
// =============================================================================

router.get("/:id/conflicts", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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

    // Return the full structured card — the frontend renders this directly
    return res.json({
      harmony_score: scoreCard.score,
      harmony_score_label: scoreCard.label,
      harmony_score_emoji: scoreCard.emoji,
      harmony_score_color: scoreCard.color,
      tier_description: scoreCard.tier_description,
      score_summary_text: scoreCard.score_summary_text,
      // Deductions and additions for the breakdown chart
      deductions: scoreCard.deductions,
      additions: scoreCard.additions,
      total_deducted: scoreCard.total_deducted,
      total_added: scoreCard.total_added,
      // Per-conflict cards for the transparent UI panel
      conflict_cards: scoreCard.conflict_cards,
      conflicts_detected: scoreCard.conflict_cards.length,
      conflicts_resolved: rawBreakdown.conflicts_resolved?.length ?? 0,
      // Highlighted bonus lines
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

// =============================================================================
// ROUTE: POST /:id/skip-meal
// User skipped a meal / ate out. Pulls nutritional bandaid from buffer.
// Propagates unused pantry ingredients to the next day.
// Does NOT regenerate the whole week.
// =============================================================================

router.post("/:id/skip-meal", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { day_date, meal_slot } = req.body as {
      day_date: string; // "YYYY-MM-DD"
      meal_slot: "breakfast" | "lunch" | "dinner" | "snack";
    };

    if (!day_date || !meal_slot) {
      return res.status(400).json({ error: "day_date and meal_slot are required." });
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

    // Mark meal as skipped
    days[dayIndex].meals[meal_slot] = {
      ...skippedMeal,
      skipped: true,
      skip_reason: "User skipped / ate out",
      priority_flags: [...(skippedMeal.priority_flags ?? []), "skipped_meal"],
      nutritional_bandaid:
        `Missed ${meal_slot} on ${day_date}. Pull from your monthly dry fruit buffer: ` +
        `a handful of almonds or walnuts (150 kcal, protein + healthy fats), ` +
        `2 dates for quick energy, or a glass of warm haldi milk (anti-inflammatory). ` +
        `₹${savedAmount.toFixed(0)} saved — rolls over to tomorrow's budget.`,
    };

    // Propagate unused pantry items to the next day
    const nextDayIndex = dayIndex + 1;
    if (nextDayIndex < days.length && skippedMeal.pantry_items_used?.length) {
      if (!days[nextDayIndex].carry_forward_ingredients) {
        days[nextDayIndex].carry_forward_ingredients = [];
      }
      const skippedIngredients = skippedMeal.base_recipe?.ingredients?.map(
        (i: any) => `${i.name} (carry-forward from skipped ${meal_slot} on ${day_date})`
      ) ?? [];
      days[nextDayIndex].carry_forward_ingredients!.push(...skippedIngredients);

      // Tag tomorrow's first non-skipped meal with the rollover
      const tomorrow = days[nextDayIndex].meals;
      const firstMeal = tomorrow.breakfast ?? tomorrow.lunch ?? tomorrow.dinner;
      if (firstMeal) {
        firstMeal.priority_flags = [
          ...(firstMeal.priority_flags ?? []),
          "zero_waste_rollover_from_skipped_meal",
        ];
      }
    }

    // Persist updated days
    await db
      .update(mealPlans)
      .set({ days: days as any, updatedAt: new Date() })
      .where(eq(mealPlans.id, id));

    return res.json({
      success: true,
      nutritional_bandaid: days[dayIndex].meals[meal_slot]!.nutritional_bandaid,
      carry_forward:
        nextDayIndex < days.length
          ? `${skippedMeal.base_recipe?.ingredients?.length ?? 0} ingredient(s) queued for tomorrow's priority use.`
          : "Last day of week — no carry-forward.",
      saved_amount_inr: savedAmount,
    });
  } catch (error: any) {
    console.error("[POST /:id/skip-meal]", error);
    res.status(500).json({ error: error?.message ?? "Internal server error" });
  }
});

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function getPriorityLabel(level: number): string {
  const labels: Record<number, string> = {
    1: "Allergy (Critical)",
    2: "Religious / Dietary Rule (Critical)",
    3: "Medication Interaction Window",
    4: "Clinical Condition",
    5: "Personal Goal",
    6: "Preference",
  };
  return labels[level] ?? "Unknown";
}

function getHarmonyLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Moderate";
  return "Challenging";
}

// =============================================================================
// DB ROW CASTERS — Drizzle rows → TypeScript interfaces
// Handles numeric string → number parsing, null-safety, and JSONB casting.
// =============================================================================

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

export default router;
