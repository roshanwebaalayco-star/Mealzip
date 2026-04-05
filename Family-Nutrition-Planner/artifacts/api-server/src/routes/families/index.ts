import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { familiesTable, familyMembersTable, monthlyBudgetsTable, weeklyContextsTable } from "@workspace/db";
import {
  CreateFamilyBody,
  UpdateFamilyBody,
  UpdateFamilyParams,
  DeleteFamilyParams,
  GetFamilyParams,
  AddFamilyMemberBody,
  AddFamilyMemberParams,
  UpdateFamilyMemberParams,
  UpdateFamilyMemberBody,
  DeleteFamilyMemberParams,
} from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";
import { applyResponsibleAIRules, normalizeGoal } from "../../lib/profile-rules.js";

const router: IRouter = Router();


router.get("/families/bootstrap", async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [latestFamily] = await db
    .select({ id: familiesTable.id, createdAt: familiesTable.createdAt })
    .from(familiesTable)
    .where(eq(familiesTable.userId, userId))
    .orderBy(desc(familiesTable.createdAt))
    .limit(1);

  if (!latestFamily) {
    res.json({
      profileComplete: false,
      hasFamilyProfile: false,
      hasBudget: false,
      hasWeeklyContext: false,
      familyId: null,
      lastActiveContext: "/family-setup",
    });
    return;
  }

  const [budget] = await db
    .select({ id: monthlyBudgetsTable.id })
    .from(monthlyBudgetsTable)
    .where(eq(monthlyBudgetsTable.familyId, latestFamily.id))
    .orderBy(desc(monthlyBudgetsTable.createdAt))
    .limit(1);

  const [weeklyContext] = await db
    .select({ id: weeklyContextsTable.id })
    .from(weeklyContextsTable)
    .where(eq(weeklyContextsTable.familyId, latestFamily.id))
    .orderBy(desc(weeklyContextsTable.updatedAt))
    .limit(1);

  const hasBudget = !!budget;
  const hasWeeklyContext = !!weeklyContext;

  const lastActiveContext = !hasBudget
    ? "/profile"
    : !hasWeeklyContext
      ? "/meal-plan/context"
      : "/meal-plan";

  res.json({
    profileComplete: hasBudget,
    hasFamilyProfile: true,
    hasBudget,
    hasWeeklyContext,
    familyId: latestFamily.id,
    lastActiveContext,
  });
});

router.get("/families", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const families = await db
    .select()
    .from(familiesTable)
    .where(eq(familiesTable.userId, userId))
    .orderBy(familiesTable.createdAt);
  res.json(families);
});

router.post("/families", async (req, res): Promise<void> => {
  const parsed = CreateFamilyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [family] = await db
    .insert(familiesTable)
    .values({ ...parsed.data, userId: req.user!.userId })
    .returning();
  res.status(201).json(family);
});

router.get("/families/:id", async (req, res): Promise<void> => {
  const params = GetFamilyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [family] = await db
    .select()
    .from(familiesTable)
    .where(eq(familiesTable.id, params.data.id));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  if (family.userId !== req.user!.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const members = await db
    .select()
    .from(familyMembersTable)
    .where(eq(familyMembersTable.familyId, params.data.id));
  res.json({ ...family, members });
});

router.put("/families/:id", async (req, res): Promise<void> => {
  const params = UpdateFamilyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateFamilyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select({ userId: familiesTable.userId })
    .from(familiesTable)
    .where(eq(familiesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  if (existing.userId !== req.user!.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const [family] = await db
    .update(familiesTable)
    .set(parsed.data)
    .where(eq(familiesTable.id, params.data.id))
    .returning();
  res.json(family);
});

router.delete("/families/:id", async (req, res): Promise<void> => {
  const params = DeleteFamilyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select({ userId: familiesTable.userId })
    .from(familiesTable)
    .where(eq(familiesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  if (existing.userId !== req.user!.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  await db.delete(familiesTable).where(eq(familiesTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/families/:familyId/members", async (req, res): Promise<void> => {
  const familyId = parseInt(req.params.familyId);
  if (isNaN(familyId)) {
    res.status(400).json({ error: "Invalid familyId" });
    return;
  }
  const [family] = await db
    .select({ userId: familiesTable.userId })
    .from(familiesTable)
    .where(eq(familiesTable.id, familyId));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  if (family.userId !== req.user!.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const members = await db
    .select()
    .from(familyMembersTable)
    .where(eq(familyMembersTable.familyId, familyId))
    .orderBy(familyMembersTable.displayOrder);
  res.json(members);
});

router.post("/families/:familyId/members", async (req, res): Promise<void> => {
  const params = AddFamilyMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [family] = await db
    .select({ userId: familiesTable.userId })
    .from(familiesTable)
    .where(eq(familiesTable.id, params.data.familyId));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  if (family.userId !== req.user!.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const parsed = AddFamilyMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const canonicalGoal = normalizeGoal(parsed.data.primaryGoal);
  const raiResult = applyResponsibleAIRules({
    age: parsed.data.age,
    gender: parsed.data.gender,
    weightKg: parsed.data.weightKg,
    heightCm: parsed.data.heightCm,
    activityLevel: parsed.data.activityLevel,
    primary_goal: canonicalGoal,
    goalPace: parsed.data.goalPace,
  });
  const memberData = {
    ...parsed.data,
    familyId: params.data.familyId,
    primaryGoal: raiResult.primary_goal ?? canonicalGoal ?? "no_specific_goal",
    goalPace: raiResult.goalPace,
    dailyCalorieTarget: parsed.data.dailyCalorieTarget ?? raiResult.dailyCalorieTarget,
  };
  const [member] = await db
    .insert(familyMembersTable)
    .values(memberData)
    .returning();
  res.status(201).json(member);
});

router.put("/families/:familyId/members/:memberId", async (req, res): Promise<void> => {
  const params = UpdateFamilyMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [family] = await db
    .select({ userId: familiesTable.userId })
    .from(familiesTable)
    .where(eq(familiesTable.id, params.data.familyId));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  if (family.userId !== req.user!.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const parsed = UpdateFamilyMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(familyMembersTable)
    .where(
      and(
        eq(familyMembersTable.id, params.data.memberId),
        eq(familyMembersTable.familyId, params.data.familyId),
      ),
    );
  if (!existing) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const merged = {
    age: parsed.data.age ?? existing.age,
    gender: parsed.data.gender ?? existing.gender,
    weightKg: parsed.data.weightKg ?? (existing.weightKg ? Number(existing.weightKg) : undefined),
    heightCm: parsed.data.heightCm ?? (existing.heightCm ? Number(existing.heightCm) : undefined),
    activityLevel: parsed.data.activityLevel ?? existing.activityLevel,
    primaryGoal: normalizeGoal(parsed.data.primaryGoal) ?? normalizeGoal(existing.primaryGoal),
    goalPace: parsed.data.goalPace ?? existing.goalPace,
  };

  const raiResult = applyResponsibleAIRules({
    age: merged.age,
    gender: merged.gender ?? undefined,
    weightKg: merged.weightKg ?? undefined,
    heightCm: merged.heightCm ?? undefined,
    activityLevel: merged.activityLevel ?? undefined,
    primary_goal: merged.primaryGoal ?? undefined,
    goalPace: merged.goalPace ?? undefined,
  });

  const updateData = {
    ...parsed.data,
    ...(raiResult.primary_goal ? { primaryGoal: raiResult.primary_goal } : {}),
    ...(raiResult.goalPace ? { goalPace: raiResult.goalPace } : {}),
    ...(raiResult.dailyCalorieTarget && !parsed.data.dailyCalorieTarget ? { dailyCalorieTarget: raiResult.dailyCalorieTarget } : {}),
  };
  const [member] = await db
    .update(familyMembersTable)
    .set(updateData)
    .where(
      and(
        eq(familyMembersTable.id, params.data.memberId),
        eq(familyMembersTable.familyId, params.data.familyId),
      ),
    )
    .returning();
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json(member);
});

router.delete("/families/:familyId/members/:memberId", async (req, res): Promise<void> => {
  const params = DeleteFamilyMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [family] = await db
    .select({ userId: familiesTable.userId })
    .from(familiesTable)
    .where(eq(familiesTable.id, params.data.familyId));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  if (family.userId !== req.user!.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const [member] = await db
    .delete(familyMembersTable)
    .where(
      and(
        eq(familyMembersTable.id, params.data.memberId),
        eq(familyMembersTable.familyId, params.data.familyId),
      ),
    )
    .returning();
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.sendStatus(204);
});

const PROFILE_CHAT_SYSTEM = `You are ParivarSehat AI — a warm, conversational Indian nutrition assistant helping set up a family profile for personalised meal planning.

GOAL: Collect ALL required information below by asking ONE question at a time. Be warm, brief, and conversational. Use the language specified by the user.

=== COLLECTION SEQUENCE (follow this order strictly) ===
STEP 1 → Family name (e.g. "Sharma Family")
STEP 2 → Indian state/region they live in
STEP 3 → Household dietary baseline — present as options:
  A) Strictly vegetarian  B) Vegetarian with eggs  C) Non-vegetarian  D) Mixed household
  → store as: strictly_veg / veg_with_eggs / non_veg / mixed
STEP 4 → Cooking skill — present as options:
  A) Beginner (basic cooking)  B) Intermediate  C) Experienced
  → store as: beginner / intermediate / experienced
STEP 5 → Meals per day — present as options:
  A) 2 meals  B) 3 meals  C) 3 meals + snacks
  → store as: 2_meals / 3_meals / 3_meals_plus_snacks
STEP 6 → For EACH family member, ask for their name and age (in one question).
  After getting name and age:
  - Ask: "Does [Name] have any health conditions like diabetes, hypertension, or anaemia? Say 'none' if healthy."
  - Then ask: "Are there more family members to add?" (yes/no)
  Default values if not mentioned: gender inferred from name/role, activityLevel=moderately_active, dietaryType=non_vegetarian, spiceTolerance=medium.

=== RULES ===
- Ask EXACTLY ONE question per response. Never combine multiple questions.
- Do NOT re-ask something already answered. Track what was collected.
- Accept option letters (A/B/C) or number references (1/2/3) for multiple-choice questions.
- Accept partial info and ask only for what is still missing.
- Keep each reply SHORT — 1–2 lines max (excluding the final JSON block).
- NEVER ask about kitchen appliances or monthly budget — these are not needed.

=== COMPLETION ===
When you have: familyName, stateRegion, householdDietaryBaseline, cookingSkillLevel, mealsPerDay, AND at least one member with name and age — you may complete.
Output on its own line: PROFILE_COMPLETE
Then output the JSON block (no other text after):
\`\`\`json
{
  "familyName": "Sharma",
  "stateRegion": "Maharashtra",
  "householdDietaryBaseline": "non_veg",
  "cookingSkillLevel": "intermediate",
  "mealsPerDay": "3_meals",
  "members": [
    { "name": "Rajesh", "age": 42, "gender": "male", "activityLevel": "moderately_active", "dietaryType": "non_vegetarian", "healthConditions": ["diabetes"], "spiceTolerance": "medium" },
    { "name": "Priya", "age": 38, "gender": "female", "activityLevel": "lightly_active", "dietaryType": "strictly_vegetarian", "healthConditions": [], "spiceTolerance": "mild" }
  ]
}
\`\`\`
Do NOT include PROFILE_COMPLETE until you have collected familyName, stateRegion, householdDietaryBaseline, cookingSkillLevel, mealsPerDay, and at least one member.`;

router.post("/families/profile-chat", async (req, res): Promise<void> => {
  const { messages, language } = req.body as {
    messages?: Array<{ role: "user" | "model"; content: string }>;
    language?: string;
  };

  if (!Array.isArray(messages)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  const langNote = language ? `\n\nIMPORTANT: Respond in ${language}. Use the appropriate script (Devanagari for Hindi/Marathi, etc.) if needed.` : "";

  const geminiMessages = messages.map(m => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: PROFILE_CHAT_SYSTEM + langNote }] },
        { role: "model", parts: [{ text: "Namaste! I will help you set up your family profile for personalized nutrition planning. I'll ask you a few simple questions." }] },
        ...geminiMessages,
      ],
      config: { maxOutputTokens: 1024 },
    });

    const reply = result.text ?? "";
    const isComplete = reply.includes("PROFILE_COMPLETE");

    let extractedData: Record<string, unknown> | null = null;
    if (isComplete) {
      try {
        // Try fenced code block first
        const fenceMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) {
          extractedData = JSON.parse(fenceMatch[1].trim()) as Record<string, unknown>;
        } else {
          // Try to find raw JSON object in the reply
          const jsonMatch = reply.match(/\{[\s\S]*"familyName"[\s\S]*\}/);
          if (jsonMatch) {
            extractedData = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
          }
        }
      } catch { extractedData = null; }
    }

    const displayReply = reply
      .replace(/PROFILE_COMPLETE/g, "")
      .replace(/```json[\s\S]*?```/g, "")
      .replace(/```[\s\S]*?```/g, "")
      .trim();

    res.json({ reply: displayReply, extractedData, isComplete });
  } catch (err) {
    req.log.error({ err }, "Profile chat failed");
    res.status(500).json({ error: "AI chat unavailable" });
  }
});

export default router;
