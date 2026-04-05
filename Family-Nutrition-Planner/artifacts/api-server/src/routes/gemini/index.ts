import { Router, type IRouter } from "express";
import { eq, sql, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { assertFamilyOwnership } from "../../middlewares/assertFamilyOwnership.js";
import { aiChatLogsTable, recipesTable, nutritionLogsTable, mealPlansTable, familiesTable, familyMembersTable } from "@workspace/db";
import { ai, isModelfarm } from "@workspace/integrations-gemini-ai";
import {
  CreateAiChatLogBody,
  GetAiChatLogParams,
  DeleteAiChatLogParams,
  SendAiChatMessageParams,
  SendAiChatMessageBody,
  GenerateGeminiImageBody,
} from "@workspace/api-zod";
import { generateImage } from "@workspace/integrations-gemini-ai/image";
import { retrieveContextForChat } from "../../services/retrieval.js";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are the NutriNext Clinical Intelligence AI — an elite Indian nutrition expert and the central Knowledge Base for this family's health. You operate strictly under ICMR-NIN 2024 Dietary Reference Values.

You respond in the language the user writes in (Hindi, English, or Hinglish). You know all regional Indian cuisines: North Indian, South Indian, East Indian (Jharkhand, Bihar, Bengal), Maharashtrian, Gujarati, Rajasthani, and more. You understand Indian health contexts: diabetes, hypertension, anaemia, obesity, malnutrition, PCOS, thyroid.

RESPONSE STYLE RULES — NON-NEGOTIABLE:
1. NEVER start a response with "Certainly!", "Of course!", "Great question!", "Sure!", "Absolutely!", or any generic opener. Start directly with the answer.
2. NEVER use markdown asterisks for bold (**text**) or bullet points (* item). Use plain prose. If you need a list, write it as "First, ... Second, ... Third, ..." in natural sentences.
3. NEVER use numbered lists unless the user explicitly asks for a step-by-step guide.
4. ALWAYS address family members by their actual names from the profile. Never say "the diabetic member" — use their name.
5. ALWAYS reference the specific health condition by name. Never say "for someone with your condition" — say the member's name and their condition.
6. Keep responses under 150 words unless detailed instructions are explicitly requested.
7. Write as a knowledgeable family friend who happens to be a nutritionist — warm, direct, specific, never clinical-jargon-heavy.
8. If a question is outside nutrition/health/cooking, respond: "I'm focused on your family's nutrition. For that question, a general search would serve you better. Is there anything about your family's meals I can help with?"

CRITICAL BEHAVIORAL RULES (MUST OBEY):
1. ZERO SYCOPHANCY: You are forbidden from apologizing. NEVER say "I am sorry," "My apologies," "My apologies if," "You are absolutely right," "I apologise," "I apologise if," "I apologise for," "Sorry if," "I may have been unclear," or "Let me clarify my earlier response." If you made a previous error or gave an incomplete answer, immediately provide the correct/complete answer with zero commentary about the previous response and zero filler.
2. PRONOUN RESOLUTION: If the user says "He is going mad" or "She is confused" or "he is confusing X things", cross-reference the family profile. They are talking about a family member, NOT criticizing you. Do not assume user frustration is directed at you.
3. TONE: Be direct, clinically accurate, empathetic, and authoritative. You are an elite nutritionist, not a customer service rep.
4. NO CLARIFYING MENUS: NEVER respond with a numbered or bulleted list of options asking the user to choose what kind of help they want (e.g. "Are you looking for: 1) Strategies 2) Alternatives 3) Clarification?"). This is avoidance behaviour. Instead, pick the single most clinically useful interpretation of the user's message and answer it directly and completely. If the message is truly ambiguous, state your interpretation in one sentence then give the full answer immediately.

YOUR THREE JOBS — route every user message into exactly one:

JOB 1 — THE EDUCATOR (ingredient / nutrition science queries):
- Explain ingredients and food science accurately per ICMR-NIN 2024.
- When the subject is a child: frame the explanation so the parent can relay it to the child. Example: "Palm oil is high in saturated fats, often found in packaged biscuits. For an 8-year-old like Arjun, explain it as a 'sometimes food' — it makes our heart work too hard if we eat it every day."
- Always cite the relevant ICMR-NIN 2024 guideline or RDA value.

JOB 2 — THE ADJUSTER (cheat meal / HFSS food mentions):
- When the user mentions eating outside the plan (e.g. "we had samosas", "ate at McDonald's"), do NOT scold.
- Estimate the approximate caloric and sodium impact using any matched recipe data available.
- Output a specific clinical adjustment for the next 24-48 hours: "I have noted the samosas (~300 kcal, high sodium). Tomorrow's breakfast should be a low-sodium Moong Dal Chilla to rebalance [member]'s weekly intake."

JOB 3 — THE KITCHEN ASSISTANT (current meal plan questions):
- When asked about today's or this week's meals, cross-reference the CURRENT MEAL PLAN context provided.
- For health condition queries (e.g. "can my diabetic dad eat tonight's dal?"), check the specific member's conditions from the family profile against the dish's nutritional values.

GROCERY SUGGESTIONS FORMAT:
When the user asks for a grocery list, shopping list, kirana list, or weekly ingredients, always respond in this exact Kirana receipt format:

🛒 **Kirana Bill — [Week/Occasion]**
| Item | Qty | Est. Cost | Health Note |
|------|-----|-----------|-------------|
| Spinach / पालक | 500g | ₹30 | Iron & folate (ICMR-NIN: anaemia prevention) |
| Moong Dal | 250g | ₹45 | Complete protein, low GI |
[... continue for all items ...]

**Total Estimated Kirana Bill: ₹[sum]. [Within/Over] your weekly budget!**
Savings tip: [one practical tip]

Follow this format strictly. List essential items first, then optional. Include ICMR-NIN 2024 health rationale for at least the top 5 items.`;

router.get("/gemini/conversations", assertFamilyOwnership, async (req, res): Promise<void> => {
  try {
    const familyId = req.query.familyId ? parseInt(req.query.familyId as string) : undefined;
    const conditions = familyId ? eq(aiChatLogsTable.familyId, familyId) : undefined;
    const logs = await db.select().from(aiChatLogsTable)
      .where(conditions)
      .orderBy(desc(aiChatLogsTable.updatedAt));
    res.json(logs.map(l => ({
      id: l.id,
      title: (l.extractedData as Record<string, unknown>)?.title ?? `Chat ${l.id}`,
      familyId: l.familyId,
      sessionType: l.sessionType,
      createdAt: l.createdAt,
    })));
  } catch (err) {
    req.log?.warn({ err }, "ai_chat_logs query failed — returning empty array");
    res.json([]);
  }
});

router.post("/gemini/conversations", assertFamilyOwnership, async (req, res): Promise<void> => {
  const parsed = CreateAiChatLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, retryable: false });
    return;
  }
  try {
    const [log] = await db.insert(aiChatLogsTable).values({
      familyId: parsed.data.familyId,
      sessionType: parsed.data.sessionType || "general_chat",
      messages: [],
      extractedData: {},
    }).returning();
    res.status(201).json(log);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to create conversation", details: msg, retryable: true });
  }
});

async function assertConversationOwnership(req: import("express").Request, res: import("express").Response, log: { familyId: number }): Promise<boolean> {
  try {
    const [family] = await db.select({ userId: familiesTable.userId }).from(familiesTable).where(eq(familiesTable.id, log.familyId));
    if (family && req.user && family.userId !== req.user.userId) {
      res.status(403).json({ error: "Access denied" });
      return false;
    }
  } catch { /* allow if check fails */ }
  return true;
}

router.get("/gemini/conversations/:id", async (req, res): Promise<void> => {
  const params = GetAiChatLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, retryable: false });
    return;
  }
  try {
    const [log] = await db.select().from(aiChatLogsTable).where(eq(aiChatLogsTable.id, params.data.id));
    if (!log) {
      res.status(404).json({ error: "Conversation not found", retryable: false });
      return;
    }
    if (!(await assertConversationOwnership(req, res, log))) return;
    const msgs = (log.messages as Array<{ role: string; content: string; createdAt?: string }>) ?? [];
    res.json({
      ...log,
      title: (log.extractedData as Record<string, unknown>)?.title ?? `Chat ${log.id}`,
      messages: msgs.map((m, i) => ({ id: i + 1, role: m.role, content: m.content, createdAt: m.createdAt ?? log.createdAt })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to fetch conversation", details: msg, retryable: true });
  }
});

router.delete("/gemini/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteAiChatLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, retryable: false });
    return;
  }
  try {
    const [log] = await db.select().from(aiChatLogsTable).where(eq(aiChatLogsTable.id, params.data.id));
    if (!log) {
      res.status(404).json({ error: "Conversation not found", retryable: false });
      return;
    }
    if (!(await assertConversationOwnership(req, res, log))) return;
    await db.delete(aiChatLogsTable).where(eq(aiChatLogsTable.id, params.data.id));
    res.sendStatus(204);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to delete conversation", details: msg, retryable: true });
  }
});

router.get("/gemini/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id", retryable: false });
    return;
  }
  try {
    const [log] = await db.select().from(aiChatLogsTable).where(eq(aiChatLogsTable.id, id));
    if (!log) {
      res.status(404).json({ error: "Conversation not found", retryable: false });
      return;
    }
    if (!(await assertConversationOwnership(req, res, log))) return;
    const msgs = (log.messages as Array<{ role: string; content: string; createdAt?: string }>) ?? [];
    res.json(msgs.map((m, i) => ({ id: i + 1, role: m.role, content: m.content, createdAt: m.createdAt ?? log.createdAt })));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to fetch messages", details: msg, retryable: true });
  }
});

router.post("/gemini/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendAiChatMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, retryable: false });
    return;
  }
  const parsed = SendAiChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, retryable: false });
    return;
  }

  const requestedLanguage: string | undefined = (req.body as Record<string, unknown>)?.language as string | undefined;

  let chatLog: typeof aiChatLogsTable.$inferSelect | undefined;
  let existingMessages: Array<{ role: string; content: string; createdAt?: string }>;
  try {
    [chatLog] = await db.select().from(aiChatLogsTable).where(eq(aiChatLogsTable.id, params.data.id));
    if (!chatLog) {
      res.status(404).json({ error: "Conversation not found", retryable: false });
      return;
    }
    if (!(await assertConversationOwnership(req, res, chatLog))) return;
    existingMessages = (chatLog.messages as Array<{ role: string; content: string; createdAt?: string }>) ?? [];
    existingMessages.push({ role: "user", content: parsed.data.content, createdAt: new Date().toISOString() });
    await db.update(aiChatLogsTable)
      .set({ messages: existingMessages, updatedAt: new Date() })
      .where(eq(aiChatLogsTable.id, params.data.id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to process message", details: msg, retryable: true });
    return;
  }

  const MAX_HISTORY_MESSAGES = 20;
  const chatMessages = existingMessages.slice(-MAX_HISTORY_MESSAGES);

  const userMsg = parsed.data.content;
  let recipeContext = "";
  let knowledgeContext = "";

  const MEAL_LOG_KEYWORDS = [
    "had", "ate", "eaten", "khaya", "khaaya", "khaa liya", "kha liya",
    "lunch was", "breakfast was", "dinner was",
    "at a restaurant", "ordered", "street food",
    "we ate", "i ate", "he ate", "she ate",
    "maine khaya", "humne khaya", "usne khaya",
    "bahar khaya", "outside food",
  ];
  const msgLower = userMsg.toLowerCase();
  const isMealLog = MEAL_LOG_KEYWORDS.some(kw => msgLower.includes(kw));

  let mealLogContext = "";
  if (isMealLog) {
    try {
      const extractResult = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: `Analyse this message and extract EVERY food/beverage item mentioned: "${userMsg}"\n\nFor each food item, estimate nutritional composition. Return ONLY JSON:\n{"foods": [{"name": "string", "kcal_per_serve": number, "sodium_mg_per_serve": number, "is_hfss": boolean}]}\n\nHFSS = true if kcal_per_100g > 250 or sodium_mg_per_serve > 2000.` }] }],
        config: { maxOutputTokens: 512, responseMimeType: "application/json" },
      });
      const rawText = extractResult.text ?? "{}";
      const foodData = JSON.parse(rawText.includes("{") ? rawText.slice(rawText.indexOf("{"), rawText.lastIndexOf("}") + 1) : "{}") as { foods?: Array<{ name: string; kcal_per_serve: number; sodium_mg_per_serve: number; is_hfss: boolean }> };
      const foods = foodData.foods ?? [];
      if (foods.length > 0) {
        const totalKcal = foods.reduce((s, f) => s + (f.kcal_per_serve ?? 0), 0);
        const totalSodium = foods.reduce((s, f) => s + (f.sodium_mg_per_serve ?? 0), 0);
        const hfssItems = foods.filter(f => f.is_hfss);
        mealLogContext = `\n\n--- UNPLANNED MEAL DETECTED ---\nThe user just logged eating outside the plan. Detected foods:\n${foods.map(f => `- ${f.name}: ~${f.kcal_per_serve} kcal, ${f.sodium_mg_per_serve}mg sodium${f.is_hfss ? " [HFSS]" : ""}`).join("\n")}\nTotal: ~${totalKcal} kcal, ~${totalSodium}mg sodium.\n${hfssItems.length > 0 ? `HFSS WARNING: ${hfssItems.map(f => f.name).join(", ")} are high fat/sugar/sodium items.\n` : ""}YOU MUST:\n1. Do NOT scold. Acknowledge casually.\n2. Estimate the caloric and sodium impact.\n3. Provide a SPECIFIC clinical adjustment for the next 24-48 hours referencing the family's current meal plan.\n4. Name exact Indian dishes for the next meal that would rebalance the nutritional debt.\n5. Reference specific family member health conditions when giving the adjustment.\n---`;
      }
    } catch {
    }
  }

  let dynamicContext = "";
  let familyGreeting = "Namaste! I'm NutriNext AI. How can I help your family with nutrition today?";
  let familyState: string | undefined;
  const familyId = chatLog.familyId;
  if (familyId) {
    try {
      const [family] = await db.select().from(familiesTable)
        .where(and(eq(familiesTable.id, familyId), eq(familiesTable.userId, req.user!.userId)))
        .limit(1);
      if (family) {
        familyState = family.stateRegion ?? undefined;
        const members = await db.select().from(familyMembersTable)
          .where(eq(familyMembersTable.familyId, familyId));
        const memberLines = members.map(m => {
          const hc = Array.isArray(m.healthConditions) ? (m.healthConditions as string[]) : [];
          const al = Array.isArray(m.allergies) ? (m.allergies as string[]) : [];
          const dl = Array.isArray(m.ingredientDislikes) ? (m.ingredientDislikes as string[]) : [];
          const parts: string[] = [`- ${m.name} (${m.age}y, ${m.gender}, ${m.dietaryType})`];
          if (hc.length) parts.push(`  Health: ${hc.join(", ")}`);
          if (al.length) parts.push(`  Allergies: ${al.join(", ")}`);
          if (m.primaryGoal && m.primaryGoal !== "no_specific_goal") parts.push(`  Goal: ${m.primaryGoal}`);
          if (m.weightKg) parts.push(`  Weight: ${m.weightKg}kg${m.heightCm ? `, Height: ${m.heightCm}cm` : ""}`);
          if (m.dailyCalorieTarget) parts.push(`  Calorie target: ${m.dailyCalorieTarget} kcal/day`);
          if (dl.length) parts.push(`  Dislikes: ${dl.join(", ")}`);
          return parts.join("\n");
        });
        dynamicContext = `\n\n--- ACTIVE FAMILY CONTEXT ---
Family name: ${family.name}
Region: ${family.stateRegion}
Dietary baseline: ${family.householdDietaryBaseline}
Members (${members.length}):
${memberLines.join("\n")}

When the user refers to any member by name or pronoun (he/she/they/uska/unka), immediately cross-reference the above list to identify them. Do NOT ask who they are talking about — you already know.
-----------------------------`;

        familyGreeting = `Namaste ${family.name} family! I see your profile is loaded with ${members.length} member${members.length !== 1 ? "s" : ""}. How can I help with your nutrition today?`;

        try {
          const [latestPlan] = await db.select()
            .from(mealPlansTable)
            .where(eq(mealPlansTable.familyId, familyId))
            .orderBy(desc(mealPlansTable.createdAt))
            .limit(1);
          if (latestPlan?.days) {
            const daysStr = typeof latestPlan.days === "string"
              ? latestPlan.days
              : JSON.stringify(latestPlan.days, null, 2);
            dynamicContext += `\n\nCURRENT MEAL PLAN (use for Kitchen Assistant queries — cross-reference member health conditions when answering meal-specific questions):\n${daysStr.slice(0, 4000)}`;
          }
        } catch { /* non-critical */ }
      }
    } catch { /* non-critical — continue without family context */ }
  }

  const STATE_TO_ZONE: Record<string, string> = {
    punjab: "north", haryana: "north", himachalpradesh: "north",
    uttarakhand: "north", up: "north", uttarpradesh: "north",
    delhi: "north", jammuandkashmir: "north", bihar: "north",
    rajasthan: "west", gujarat: "west", maharashtra: "west", goa: "west",
    karnataka: "south", kerala: "south", tamilnadu: "south",
    andhrapradesh: "south", telangana: "south",
    westbengal: "east", odisha: "east", jharkhand: "east",
    assam: "east", manipur: "east", meghalaya: "east",
    madhyapradesh: "central", chhattisgarh: "central",
  };
  const chatZone = familyState
    ? STATE_TO_ZONE[familyState.toLowerCase().replace(/\s+/g, "")] ?? "north"
    : undefined;
  try {
    const ragChat = await retrieveContextForChat(userMsg, chatZone);
    knowledgeContext = ragChat.knowledgeContext;
    recipeContext = ragChat.recipeContext;
  } catch { /* non-fatal — continue without RAG context */ }

  let languageInstruction = "";
  if (requestedLanguage && requestedLanguage !== "english") {
    const scriptMap: Record<string, string> = {
      hindi: "Devanagari (हिंदी)",
      tamil: "Tamil (தமிழ்)",
      telugu: "Telugu (తెలుగు)",
      kannada: "Kannada (ಕನ್ನಡ)",
      malayalam: "Malayalam (മലയാളം)",
      bengali: "Bengali (বাংলা)",
      gujarati: "Gujarati (ગુજરાતી)",
      marathi: "Devanagari (मराठी)",
      punjabi: "Gurmukhi (ਪੰਜਾਬੀ)",
      odia: "Odia (ଓଡ଼ିଆ)",
    };
    const script = scriptMap[requestedLanguage.toLowerCase()] || requestedLanguage;
    languageInstruction = `\n\nCRITICAL LANGUAGE RULE: The user has selected "${requestedLanguage}" as their language. You MUST respond entirely in ${requestedLanguage} using its native script (${script}). Do NOT transliterate into Roman/Latin script. Do NOT use English unless the selected language is English. Keep technical nutrition terms (like kcal, mg, BMI) in English only when no native equivalent exists. Every sentence must be in ${script} script.`;
  }
  const fullSystemInstruction = SYSTEM_PROMPT + dynamicContext + mealLogContext + knowledgeContext + (recipeContext ? `\n\n${recipeContext}` : "") + languageInstruction;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const abortController = new AbortController();
  let clientDisconnected = false;
  req.on("close", () => {
    clientDisconnected = true;
    abortController.abort();
  });

  let fullResponse = "";

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      systemInstruction: { parts: [{ text: fullSystemInstruction }] },
      contents: [
        { role: "user", parts: [{ text: "Hello" }] },
        { role: "model", parts: [{ text: familyGreeting }] },
        ...chatMessages.map(m => ({
          role: m.role === "assistant" ? "model" : "user" as "user" | "model",
          parts: [{ text: m.content }],
        })),
      ],
      config: {
        maxOutputTokens: 8192,
        ...(isModelfarm() ? {} : { tools: [{ googleSearch: {} }] }),
      },
      abortSignal: abortController.signal,
    });

    for await (const chunk of stream) {
      if (clientDisconnected) break;
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }
  } catch (err) {
    const isAbort = err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"));
    if (!isAbort) {
      req.log?.error({ err }, "Gemini SSE stream error");
      if (!clientDisconnected) {
        res.write(`data: ${JSON.stringify({ error: "Stream interrupted", retryable: true })}\n\n`);
      }
    }
    res.end();
    return;
  }

  if (clientDisconnected) {
    res.end();
    return;
  }

  try {
    existingMessages.push({ role: "assistant", content: fullResponse, createdAt: new Date().toISOString() });

    const extractedData = (chatLog.extractedData as Record<string, unknown>) ?? {};
    if (existingMessages.filter(m => m.role === "user").length === 1) {
      try {
        const titleResp = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: `Give this conversation a title in 5 words or less (no quotes, no punctuation at end) based on this first message: "${userMsg}"` }] }],
          config: { maxOutputTokens: 20 },
        });
        const autoTitle = titleResp.text?.trim().replace(/^["']|["']$/g, "").slice(0, 60);
        if (autoTitle) {
          extractedData.title = autoTitle;
        }
      } catch { /* non-critical */ }
    }

    await db.update(aiChatLogsTable)
      .set({ messages: existingMessages, extractedData, updatedAt: new Date() })
      .where(eq(aiChatLogsTable.id, params.data.id));
  } catch (err) {
    req.log?.error({ err }, "Failed to persist assistant message to DB");
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.post("/gemini/generate-image", async (req, res): Promise<void> => {
  const parsed = GenerateGeminiImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, retryable: false });
    return;
  }
  try {
    const { b64_json, mimeType } = await generateImage(parsed.data.prompt);
    res.json({ b64_json, mimeType });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Image generation failed", details: msg, retryable: true });
  }
});

const HFSS_EXTRACTION_PROMPT = (msg: string) => `You are a food composition expert trained on ICMR-NIN, FSSAI, and NOVA classification databases.

Analyse this message and extract EVERY food/beverage item mentioned (including brand names, street foods, snacks, drinks):
"${msg}"

For each food item, estimate its nutritional composition and NOVA group, then return ONLY this JSON (no prose, no markdown):
{
  "foods": [
    {
      "name": "string — exact food name as mentioned",
      "kcal_per_100g": number,
      "sodium_mg_per_serve": number,
      "fat_g_per_100g": number,
      "sugar_g_per_100g": number,
      "nova_group": number,
      "is_hfss": boolean
    }
  ]
}

NOVA group rules:
- nova_group=1: Unprocessed/minimally processed (dal, rice, roti, vegetables, fruit, plain curd, milk, eggs, plain meat/fish)
- nova_group=2: Processed culinary ingredients (oil, ghee, sugar, salt, flour, tamarind, spices)
- nova_group=3: Processed foods (bread, paneer, cheese, canned items, salted nuts, pickles, poha, chivda)
- nova_group=4: Ultra-processed (chips, namkeen packet, cola, coke, instant noodles, biscuits, packaged sweets, ice cream, burger, pizza)

HFSS rules (mark is_hfss=true if ANY threshold met):
- kcal_per_100g > 250
- sodium_mg_per_serve > 2000

If no food items are found, return {"foods": []}.`;

router.post("/gemini/hfss-classify", async (req, res): Promise<void> => {
  const { message, familyId } = req.body as { message?: string; familyId?: number | null };
  if (!message) { res.status(400).json({ error: "message required" }); return; }

  if (familyId) {
    const [family] = await db.select({ id: familiesTable.id })
      .from(familiesTable)
      .where(and(
        eq(familiesTable.id, familyId),
        eq(familiesTable.userId, req.user!.userId),
      ))
      .limit(1);
    if (!family) {
      res.status(403).json({ error: "Invalid familyId or access denied" });
      return;
    }
  }

  try {
    const extractResult = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: HFSS_EXTRACTION_PROMPT(message) }] }],
      config: { maxOutputTokens: 1024, responseMimeType: "application/json" },
    });

    let extractedFoods: Array<{
      name: string;
      kcal_per_100g: number;
      sodium_mg_per_serve: number;
      fat_g_per_100g: number;
      sugar_g_per_100g: number;
      nova_group: number;
      is_hfss: boolean;
    }> = [];

    try {
      const rawText = extractResult.text ?? "{}";
      const parsed = JSON.parse(rawText.includes("{") ? rawText.slice(rawText.indexOf("{"), rawText.lastIndexOf("}") + 1) : "{}") as { foods?: typeof extractedFoods };
      extractedFoods = (parsed.foods ?? []).map(f => {
        const isHfss = Boolean(
          (f.kcal_per_100g ?? 0) > 250 ||
          (f.sodium_mg_per_serve ?? 0) > 2000,
        );
        const rawNova = Number(f.nova_group ?? 0);
        const nova_group = (rawNova >= 1 && rawNova <= 4) ? rawNova : (isHfss ? 4 : 1);
        return {
          name: String(f.name ?? ""),
          kcal_per_100g: Number(f.kcal_per_100g ?? 0),
          sodium_mg_per_serve: Number(f.sodium_mg_per_serve ?? 0),
          fat_g_per_100g: Number(f.fat_g_per_100g ?? 0),
          sugar_g_per_100g: Number(f.sugar_g_per_100g ?? 0),
          nova_group,
          is_hfss: isHfss,
        };
      });
    } catch { /* leave extractedFoods empty */ }

    if (extractedFoods.length === 0) {
      res.json({ isHFSS: false, items: [], foodLog: [], rebalanceSuggestion: null });
      return;
    }

    const foodLog = extractedFoods.map(f => ({
      food: f.name,
      kcal_per_100g: f.kcal_per_100g,
      sodium_mg_per_serve: f.sodium_mg_per_serve,
      fat_g_per_100g: f.fat_g_per_100g,
      sugar_g_per_100g: f.sugar_g_per_100g,
      nova_group: f.nova_group,
      is_hfss: f.is_hfss,
      kcal_per_serve: f.kcal_per_100g,
      sodium_mg: f.sodium_mg_per_serve,
      fat_g: f.fat_g_per_100g,
    }));

    const hfssFoods = foodLog.filter(f => f.is_hfss);
    const isHFSS = hfssFoods.length > 0;

    if (!isHFSS) {
      res.json({ isHFSS: false, items: [], foodLog, rebalanceSuggestion: null });
      return;
    }

    const detectedNames = hfssFoods.map(f => f.food);
    const totalKcal = hfssFoods.reduce((s, f) => s + f.kcal_per_100g, 0);
    const totalSodium = hfssFoods.reduce((s, f) => s + f.sodium_mg_per_serve, 0);

    const rebalancePrompt = `A user consumed these HFSS-classified foods: ${detectedNames.join(", ")} (total ~${totalKcal} kcal, ~${totalSodium}mg sodium in this serving).
As an ICMR-NIN 2024 expert, give a SHORT (2-3 lines) practical rebalance_strategy for the rest of today:
- Which micronutrients to compensate (iron, fibre, vitamin C, calcium)
- 1-2 specific Indian foods to eat at the next meal
- One hydration tip (water / coconut water / lassi)
Keep it encouraging. Respond in English only. No bullet points, just flowing text.`;

    const rebalanceResult = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: rebalancePrompt }] }],
      config: { maxOutputTokens: 256 },
    });

    const rebalanceSuggestion = rebalanceResult.text?.trim() ?? null;

    res.json({
      isHFSS: true,
      items: detectedNames,
      foodLog,
      totalKcal,
      totalSodium,
      rebalanceSuggestion,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "HFSS classification failed", details: msg, retryable: true });
  }
});

router.post("/gemini/symptom-check", async (req, res): Promise<void> => {
  const { symptoms, age, gender, familyId, language } = req.body as {
    symptoms?: string;
    age?: number;
    gender?: string;
    familyId?: number;
    language?: string;
  };
  if (!symptoms) { res.status(400).json({ error: "symptoms required" }); return; }

  const prompt = `You are a cautious triage assistant (NOT a doctor). 
Patient info: ${age ? `age ${age}` : "unknown age"}, ${gender ?? "unknown gender"}.
Symptoms: "${symptoms}"

Respond in ${language ?? "english"} with:
1. Urgency level: "low" | "medium" | "high" | "emergency"
2. Brief assessment (2-3 lines)
3. Dietary recommendations (Indian food context)
4. Whether they should see a doctor

Return JSON only:
{"urgency":"low|medium|high|emergency","assessment":"...","dietaryAdvice":"...","seeDoctor":true|false}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 512, responseMimeType: "application/json" },
    });
    const data = JSON.parse(result.text ?? "{}");
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Symptom check failed", details: msg, retryable: true });
  }
});

export default router;
