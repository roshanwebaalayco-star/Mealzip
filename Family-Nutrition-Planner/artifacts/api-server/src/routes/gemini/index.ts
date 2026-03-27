import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { conversations as conversationsTable, messages as messagesTable, recipesTable } from "@workspace/db";
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
Keep responses concise and practical.`;

router.get("/gemini/conversations", async (_req, res): Promise<void> => {
  const conversations = await db.select().from(conversationsTable).orderBy(conversationsTable.createdAt);
  res.json(conversations);
});

router.post("/gemini/conversations", async (req, res): Promise<void> => {
  const parsed = CreateGeminiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [conv] = await db.insert(conversationsTable).values({ title: parsed.data.title }).returning();
  res.status(201).json(conv);
});

router.get("/gemini/conversations/:id", async (req, res): Promise<void> => {
  const params = GetGeminiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, params.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, params.data.id)).orderBy(messagesTable.createdAt);
  res.json({ ...conv, messages });
});

router.delete("/gemini/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteGeminiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [conv] = await db.delete(conversationsTable).where(eq(conversationsTable.id, params.data.id)).returning();
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/gemini/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = ListGeminiMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, params.data.id)).orderBy(messagesTable.createdAt);
  res.json(messages);
});

router.post("/gemini/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendGeminiMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SendGeminiMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, params.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messagesTable).values({ conversationId: params.data.id, role: "user", content: parsed.data.content });

  const allMessages = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.id))
    .orderBy(messagesTable.createdAt);

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
      const matchedRecipes = await db.select({
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

  let fullResponse = "";

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
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) {
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    }
  }

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

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.post("/gemini/generate-image", async (req, res): Promise<void> => {
  const parsed = GenerateGeminiImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { b64_json, mimeType } = await generateImage(parsed.data.prompt);
  res.json({ b64_json, mimeType });
});

export default router;
