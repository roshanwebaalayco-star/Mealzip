import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { familiesTable, familyMembersTable } from "@workspace/db";
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

const router: IRouter = Router();

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
    .orderBy(familyMembersTable.id);
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
  const [member] = await db
    .insert(familyMembersTable)
    .values({ ...parsed.data, familyId: params.data.familyId })
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
  const [member] = await db
    .update(familyMembersTable)
    .set(parsed.data)
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

const PROFILE_CHAT_SYSTEM = `You are ParivarSehat AI — a warm, conversational assistant helping collect family information for personalised Indian nutrition meal planning.

GOAL: Collect a complete family profile by asking ONE question at a time in a friendly, conversational way. The language to use will be specified in the first user message.

Required info to collect:
1. Family name (परिवार का नाम)
2. Indian state they live in
3. Monthly food budget in ₹
4. Number of family members (min 2, max 5)
5. For each member: first name, age, gender (male/female), role (father/mother/son/daughter/grandfather/grandmother/other), any health conditions (diabetes/hypertension/anaemia/none)
6. Family's overall dietary type (vegetarian/non-vegetarian/vegan/jain)

Rules:
- Ask EXACTLY ONE question per response
- Be warm and natural — use the appropriate language/script
- Accept partial answers gracefully and ask for missing info
- When you have collected ALL the above information, output this EXACT marker on its own line: PROFILE_COMPLETE
  Then immediately output a JSON block with this exact structure:
\`\`\`json
{
  "familyName": "Sharma",
  "state": "Maharashtra",
  "monthlyBudget": 8000,
  "dietaryType": "vegetarian",
  "members": [
    { "name": "Rajesh", "age": 42, "gender": "male", "role": "father", "healthConditions": ["diabetes"] },
    { "name": "Priya", "age": 38, "gender": "female", "role": "mother", "healthConditions": [] }
  ]
}
\`\`\`
- Do NOT output PROFILE_COMPLETE until you have all required info for all members
- Keep responses short (2-3 lines max) unless outputting the final JSON`;

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
        { role: "model", parts: [{ text: "Namaste! 🙏 I will help you set up your family profile for personalized nutrition planning. I'll ask you a few simple questions." }] },
        ...geminiMessages,
      ],
      config: { maxOutputTokens: 1024 },
    });

    const reply = result.text ?? "";
    const isComplete = reply.includes("PROFILE_COMPLETE");

    let extractedData: Record<string, unknown> | null = null;
    if (isComplete) {
      try {
        const fenceMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) {
          extractedData = JSON.parse(fenceMatch[1]) as Record<string, unknown>;
        }
      } catch { extractedData = null; }
    }

    const displayReply = reply
      .replace("PROFILE_COMPLETE", "")
      .replace(/```json[\s\S]*?```/g, "")
      .trim();

    res.json({ reply: displayReply, extractedData, isComplete });
  } catch (err) {
    req.log.error({ err }, "Profile chat failed");
    res.status(500).json({ error: "AI chat unavailable" });
  }
});

export default router;
