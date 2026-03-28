import { Router, type IRouter } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, localDb } from "@workspace/db";
import { conversations as conversationsTable, messages as messagesTable, recipesTable, nutritionLogsTable, mealPlansTable } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import {
  CreateGeminiConversationBody,
  GetGeminiConversationParams,
  DeleteGeminiConversationParams,
  ListGeminiMessagesParams,
  SendGeminiMessageParams,
  SendGeminiMessageBody,
  GenerateGeminiImageBody,
} from "@workspace/api-zod";
import { generateImage } from "@workspace/integrations-gemini-ai/image";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are NutriNext AI / ParivarSehat AI — a friendly, expert India-centric family nutrition assistant.
You follow ICMR-NIN 2024 Dietary Reference Values for all nutritional recommendations.
You respond in the language the user writes in (Hindi or English or both).
You know about Indian cuisines from all regions: North Indian, South Indian, East Indian (Jharkhand, Bihar, Bengal), Maharashtrian, Gujarati, etc.
You understand Indian health contexts: diabetes, hypertension, anaemia, obesity, malnutrition.
You give practical, affordable meal suggestions using ingredients available in Indian markets.
Always cite ICMR-NIN 2024 when giving nutritional targets.
Keep responses concise and practical.

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

router.get("/gemini/conversations", async (_req, res): Promise<void> => {
  try {
    const conversations = await db.select().from(conversationsTable).orderBy(conversationsTable.createdAt);
    res.json(conversations);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to fetch conversations", details: msg, retryable: true });
  }
});

router.post("/gemini/conversations", async (req, res): Promise<void> => {
  const parsed = CreateGeminiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, retryable: false });
    return;
  }
  try {
    const [conv] = await db.insert(conversationsTable).values({ title: parsed.data.title }).returning();
    res.status(201).json(conv);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to create conversation", details: msg, retryable: true });
  }
});

router.get("/gemini/conversations/:id", async (req, res): Promise<void> => {
  const params = GetGeminiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, retryable: false });
    return;
  }
  try {
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, params.data.id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found", retryable: false });
      return;
    }
    const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, params.data.id)).orderBy(messagesTable.createdAt);
    res.json({ ...conv, messages });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to fetch conversation", details: msg, retryable: true });
  }
});

router.delete("/gemini/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteGeminiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, retryable: false });
    return;
  }
  try {
    const [conv] = await db.delete(conversationsTable).where(eq(conversationsTable.id, params.data.id)).returning();
    if (!conv) {
      res.status(404).json({ error: "Conversation not found", retryable: false });
      return;
    }
    res.sendStatus(204);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to delete conversation", details: msg, retryable: true });
  }
});

router.get("/gemini/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = ListGeminiMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, retryable: false });
    return;
  }
  try {
    const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, params.data.id)).orderBy(messagesTable.createdAt);
    res.json(messages);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to fetch messages", details: msg, retryable: true });
  }
});

router.post("/gemini/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendGeminiMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, retryable: false });
    return;
  }
  const parsed = SendGeminiMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, retryable: false });
    return;
  }

  let conv: typeof import("@workspace/db").conversationsTable.$inferSelect | undefined;
  let allMessages: Array<typeof import("@workspace/db").messagesTable.$inferSelect>;
  try {
    [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, params.data.id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found", retryable: false });
      return;
    }
    await db.insert(messagesTable).values({ conversationId: params.data.id, role: "user", content: parsed.data.content });
    allMessages = await db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, params.data.id))
      .orderBy(messagesTable.createdAt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to process message", details: msg, retryable: true });
    return;
  }

  // 6b: Trim conversation history to avoid context window overflow
  const MAX_HISTORY_MESSAGES = 20;
  const chatMessages = allMessages.slice(-MAX_HISTORY_MESSAGES);

  // 6a: Improved food keyword extraction with stop-words and multi-word Indian food names
  const userMsg = parsed.data.content;
  const stopWords = new Set([
    "what", "how", "can", "you", "tell", "me", "about", "should", "for", "the",
    "and", "with", "make", "cook", "recipe", "food", "eat", "good", "best", "please",
    "kya", "hai", "aur", "mein", "ka", "ki", "ke", "kaise", "banate", "batao", "achha", "kaun",
    "this", "that", "from", "give", "want", "need", "help", "list", "when", "does",
  ]);
  const multiWordFoods = [
    "dal makhani", "chole bhature", "aloo gobi", "palak paneer", "rajma chawal",
    "kadhi chawal", "pav bhaji", "vada pav", "khichdi", "poha", "upma", "idli",
    "dosa", "roti", "paratha", "sabzi", "dal", "curry", "rice", "paneer",
    "biryani", "chicken", "mutton", "fish", "egg", "litti chokha", "dal baati",
    "gatte ki sabzi", "butter chicken", "aloo paratha", "masala dosa",
  ];
  const lowerMsg = userMsg.toLowerCase();
  const quotedPhrases = [...lowerMsg.matchAll(/"([^"]+)"/g)].map(m => m[1]);
  const foundMultiWord = multiWordFoods.filter(f => lowerMsg.includes(f));
  const singleWords = lowerMsg
    .replace(/[^\w\s\u0900-\u097F]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
  const foodKeywords = [...new Set([...quotedPhrases, ...foundMultiWord, ...singleWords])].slice(0, 6);
  let recipeContext = "";
  // Flatten multi-word foods to individual tokens for full-text search
  const tsTokens = [...new Set(foodKeywords.flatMap(k => k.split(/\s+/)).filter(w => w.length > 2))];
  if (tsTokens.length > 0) {
    try {
      const tsQuery = tsTokens.join(":* & ") + ":*";
      const matchedRecipes = await localDb.select({
        name: recipesTable.name,
        nameHindi: recipesTable.nameHindi,
        calories: recipesTable.calories,
        protein: recipesTable.protein,
        diet: recipesTable.diet,
        cuisine: recipesTable.cuisine,
        costPerServing: recipesTable.costPerServing,
        totalTimeMin: recipesTable.totalTimeMin,
      })
      .from(recipesTable)
      .where(sql`to_tsvector('simple', coalesce(${recipesTable.name}, '') || ' ' || coalesce(${recipesTable.nameHindi}, '') || ' ' || coalesce(${recipesTable.ingredients}, '')) @@ to_tsquery('simple', ${tsQuery})`)
      .limit(8);
      

      if (matchedRecipes.length > 0) {
        recipeContext = `\n\nMATCHED RECIPES FROM DATABASE:\n${JSON.stringify(matchedRecipes.map(r => ({
          name: r.name,
          nameHindi: r.nameHindi,
          calories: r.calories,
          protein: r.protein,
          diet: r.diet,
          cuisine: r.cuisine,
          costPerServing: r.costPerServing,
          totalTimeMin: r.totalTimeMin,
        })), null, 2)}\n\nUse these specific recipes when answering the user's question.`;
      }
    } catch { /* non-critical — continue without recipe context */ }
  }

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
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT + recipeContext }] },
        { role: "model", parts: [{ text: "Namaste! I'm NutriNext AI. How can I help your family with nutrition today? / नमस्ते! मैं NutriNext AI हूं। आज मैं आपके परिवार की पोषण संबंधी कैसे मदद कर सकता हूं?" }] },
        ...chatMessages.map(m => ({
          role: m.role === "assistant" ? "model" : "user" as "user" | "model",
          parts: [{ text: m.content }],
        })),
      ],
      config: { maxOutputTokens: 8192 },
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
    await db.insert(messagesTable).values({ conversationId: params.data.id, role: "assistant", content: fullResponse });

    // 6d: Auto-generate conversation title from the first user message
    // allMessages includes the message we just inserted, so length === 1 means this is the first
    if (allMessages.length === 1) {
      try {
        const titleResp = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: `Give this conversation a title in 5 words or less (no quotes, no punctuation at end) based on this first message: "${userMsg}"` }] }],
          config: { maxOutputTokens: 20 },
        });
        const autoTitle = titleResp.text?.trim().replace(/^["']|["']$/g, "").slice(0, 60);
        if (autoTitle) {
          await db.update(conversationsTable).set({ title: autoTitle }).where(eq(conversationsTable.id, params.data.id));
        }
      } catch { /* non-critical */ }
    }
  } catch (err) {
    req.log?.error({ err }, "Failed to persist assistant message to DB");
    /* SSE already streaming — cannot send error to client, just log */
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

// ── HFSS Classifier ──────────────────────────────────────────────
const HFSS_PROFILE: Record<string, { kcal_per_serve: number; sodium_mg: number; fat_g: number }> = {
  "chips":        { kcal_per_serve: 155, sodium_mg: 280, fat_g: 9 },
  "namkeen":      { kcal_per_serve: 130, sodium_mg: 320, fat_g: 7 },
  "biscuit":      { kcal_per_serve: 140, sodium_mg: 180, fat_g: 6 },
  "cookie":       { kcal_per_serve: 160, sodium_mg: 100, fat_g: 8 },
  "cake":         { kcal_per_serve: 250, sodium_mg: 180, fat_g: 12 },
  "burger":       { kcal_per_serve: 400, sodium_mg: 700, fat_g: 18 },
  "pizza":        { kcal_per_serve: 280, sodium_mg: 600, fat_g: 12 },
  "samosa":       { kcal_per_serve: 260, sodium_mg: 350, fat_g: 14 },
  "pakoda":       { kcal_per_serve: 200, sodium_mg: 280, fat_g: 12 },
  "jalebi":       { kcal_per_serve: 150, sodium_mg: 10, fat_g: 5 },
  "gulab jamun":  { kcal_per_serve: 140, sodium_mg: 40, fat_g: 5 },
  "cola":         { kcal_per_serve: 140, sodium_mg: 45, fat_g: 0 },
  "coke":         { kcal_per_serve: 140, sodium_mg: 45, fat_g: 0 },
  "pepsi":        { kcal_per_serve: 140, sodium_mg: 45, fat_g: 0 },
  "chocolate":    { kcal_per_serve: 200, sodium_mg: 40, fat_g: 12 },
  "ice cream":    { kcal_per_serve: 200, sodium_mg: 80, fat_g: 10 },
  "maggi":        { kcal_per_serve: 350, sodium_mg: 1200, fat_g: 14 },
  "instant noodles": { kcal_per_serve: 350, sodium_mg: 1200, fat_g: 14 },
  "white bread":  { kcal_per_serve: 140, sodium_mg: 240, fat_g: 2 },
};

const HFSS_KEYWORDS_BE = Object.keys(HFSS_PROFILE).concat([
  "pastry", "candy", "sweet", "mithai", "kulfi", "maida", "refined",
  "soda", "soft drink", "cold drink", "fanta", "sprite", "energy drink",
  "processed", "packed snack", "ketchup", "mayonnaise", "dalda", "vanaspati",
  "french fries", "deep fried", "fried", "pav",
]);

router.post("/gemini/hfss-classify", async (req, res): Promise<void> => {
  const { message, familyId } = req.body as { message?: string; familyId?: number | null };
  if (!message) { res.status(400).json({ error: "message required" }); return; }

  const lower = message.toLowerCase();
  const detectedNames = HFSS_KEYWORDS_BE.filter(k => lower.includes(k));
  if (detectedNames.length === 0) {
    res.json({ isHFSS: false, items: [], foodLog: [], rebalanceSuggestion: null });
    return;
  }

  const foodLog = detectedNames.map(name => ({
    food: name,
    kcal_per_serve: HFSS_PROFILE[name]?.kcal_per_serve ?? 180,
    sodium_mg: HFSS_PROFILE[name]?.sodium_mg ?? 200,
    fat_g: HFSS_PROFILE[name]?.fat_g ?? 8,
    is_hfss: true,
  }));

  const totalKcal = foodLog.reduce((s, f) => s + f.kcal_per_serve, 0);
  const totalSodium = foodLog.reduce((s, f) => s + f.sodium_mg, 0);

  try {
    const prompt = `A user ate: "${message}". Detected HFSS items: ${detectedNames.join(", ")} (total ~${totalKcal} kcal, ~${totalSodium}mg sodium).
As an ICMR-NIN 2024 expert, give a SHORT (2-3 lines) practical rebalance_strategy for the rest of today:
- Which micronutrients to compensate (iron, fibre, vitamin C, calcium)
- 1-2 specific Indian foods to eat at the next meal
- One hydration tip (water / coconut water / lassi)
Keep it encouraging. Respond in English only. No bullet points, just flowing text.`;
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 300 },
    });
    const rebalance_strategy = result.candidates?.[0]?.content?.parts?.[0]?.text
      ?? "Balance with a bowl of dal + vegetables at your next meal, and drink 2 glasses of water to flush excess sodium.";

    let patchedSlot: { day: string; mealType: string; planId: number } | null = null;

    // Persist HFSS food log to NutritionLog for longitudinal tracking + patch next meal slot
    if (familyId) {
      try {
        const today = new Date().toISOString().split("T")[0];
        await db.insert(nutritionLogsTable).values({
          familyId,
          logDate: today,
          mealType: "snack",
          foodDescription: `[HFSS] ${detectedNames.join(", ")} (${totalKcal}kcal, ${totalSodium}mg Na) | Rebalance: ${rebalance_strategy.slice(0, 300)}`,
          calories: totalKcal,
          source: "ai",
        }).catch(() => { /* non-critical */ });

        // Patch next meal slot in the latest active plan with _hfssRebalance marker
        const [latestPlan] = await db.select().from(mealPlansTable)
          .where(eq(mealPlansTable.familyId, familyId))
          .orderBy(desc(mealPlansTable.createdAt))
          .limit(1);

        if (latestPlan) {
          const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
          const hourIST = nowIST.getUTCHours();
          let targetMealType: string;
          let dayOffset = 0;
          if (hourIST < 11) { targetMealType = "lunch"; }
          else if (hourIST < 16) { targetMealType = "dinner"; }
          else { targetMealType = "breakfast"; dayOffset = 1; }

          const weekStart = new Date((latestPlan.weekStartDate as string) + "T00:00:00Z");
          const daysSinceStart = Math.floor((nowIST.getTime() - weekStart.getTime()) / (24 * 3600 * 1000));
          const targetDayIdx = daysSinceStart + dayOffset;

          type PlanJSON = { days?: Array<Record<string, unknown>> };
          const planData = latestPlan.plan as PlanJSON;
          const targetDay = planData?.days?.[targetDayIdx];
          if (targetDay) {
            const meals = (targetDay.meals as Record<string, unknown>) ?? {};
            const targetMeal = meals[targetMealType] as Record<string, unknown> | undefined;
            if (targetMeal) {
              targetMeal._hfssRebalance = {
                detectedAt: new Date().toISOString(),
                items: detectedNames,
                totalKcal,
                rebalanceNote: rebalance_strategy.slice(0, 200),
              };
              await db.update(mealPlansTable)
                .set({ plan: planData })
                .where(eq(mealPlansTable.id, latestPlan.id))
                .catch(() => { /* non-critical */ });
              patchedSlot = { day: String(targetDay.day ?? `Day ${targetDayIdx + 1}`), mealType: targetMealType, planId: latestPlan.id };
            }
          }
        }
      } catch { /* non-critical — never block the HFSS classify response */ }
    }

    res.json({
      isHFSS: true,
      items: detectedNames,
      foodLog,
      totalKcal,
      totalSodiumMg: totalSodium,
      rebalanceSuggestion: rebalance_strategy,
      rebalance_strategy,
      patchedSlot,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "HFSS classify failed", details: msg, retryable: true });
  }
});

export default router;
