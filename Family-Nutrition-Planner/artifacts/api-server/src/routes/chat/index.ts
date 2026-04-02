/**
 * FILE: server/routes/chat/index.ts
 * PURPOSE: The main chat API route. Handles:
 *   1. Input validation and auth checks
 *   2. Context assembly (State Payload + RAG)
 *   3. Gemini streaming via SSE (Server-Sent Events)
 *   4. Action-Extraction parsing (---ACTION--- delimiter)
 *   5. Clean SSE teardown and disconnect handling
 *
 * AUTH: Uses JWT auth middleware (req.user.userId) + familyId from request body
 * ENV: Requires GEMINI_API_KEY or AI_INTEGRATIONS_GEMINI_API_KEY in env
 *
 * SSE EVENT CONTRACT (what the frontend receives):
 *   { type: "delta",  text: "..." }         — streaming text token
 *   { type: "action", payload: {...} }      — parsed action (hidden from chat UI)
 *   { type: "done" }                        — stream complete
 *   { type: "error",  message: "..." }      — error during generation
 */

import { Router, Request, Response } from "express";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { db, familiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { assembleChatContext } from "../../lib/assembleContext.js";
import { MEGA_PROMPT }         from "../../lib/megaPrompt.js";

const router = Router();

const ACTION_DELIMITER = "---ACTION---";
const GEMINI_MODEL     = "gemini-1.5-pro";
const MAX_MESSAGE_LENGTH = 2_000;

let _geminiModel: GenerativeModel | null = null;

function getGeminiModel(): GenerativeModel {
  if (_geminiModel) return _geminiModel;

  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to Replit Secrets and restart the server."
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  _geminiModel = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: MEGA_PROMPT,
    generationConfig: {
      temperature:      0.4,
      topP:             0.85,
      topK:             40,
      maxOutputTokens:  1024,
      candidateCount:   1,
    },
  });

  return _geminiModel;
}

interface ParsedResponse {
  conversationalText: string;
  actionPayload: Record<string, unknown> | null;
}

function parseActionFromResponse(rawText: string): ParsedResponse {
  if (!rawText.includes(ACTION_DELIMITER)) {
    return { conversationalText: rawText.trim(), actionPayload: null };
  }

  const delimiterIndex = rawText.indexOf(ACTION_DELIMITER);
  const conversationalText = rawText.slice(0, delimiterIndex).trim();
  const jsonCandidate      = rawText.slice(delimiterIndex + ACTION_DELIMITER.length).trim();

  let actionPayload: Record<string, unknown> | null = null;

  if (jsonCandidate) {
    try {
      const cleaned = jsonCandidate
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i,    "")
        .replace(/```\s*$/i,    "")
        .trim();

      const parsed = JSON.parse(cleaned);

      if (parsed && typeof parsed.action === "string") {
        actionPayload = parsed;
      } else {
        console.warn("[ActionParser] JSON parsed but missing string 'action' key. Discarding.");
      }
    } catch (e) {
      console.error(
        "[ActionParser] Failed to parse action JSON:",
        jsonCandidate.slice(0, 200)
      );
    }
  }

  return { conversationalText, actionPayload };
}

function sendSseEvent(res: Response, data: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function closeSseStream(res: Response): void {
  sendSseEvent(res, { type: "done" });
  res.end();
}

router.post("/", async (req: Request, res: Response) => {

  const { message, language, familyId: bodyFamilyId } = req.body as {
    message?: unknown;
    language?: unknown;
    familyId?: unknown;
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message must be a non-empty string." });
    return;
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length === 0) {
    res.status(400).json({ error: "message cannot be empty or whitespace only." });
    return;
  }

  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({
      error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`,
    });
    return;
  }

  const safeLanguage =
    typeof language === "string" && language.trim().length > 0
      ? language.trim()
      : "en-IN";

  const familyIdRaw = typeof bodyFamilyId === "number" ? bodyFamilyId : null;

  if (familyIdRaw && Number.isInteger(familyIdRaw) && familyIdRaw > 0) {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    const [ownershipCheck] = await db
      .select({ id: familiesTable.id })
      .from(familiesTable)
      .where(and(eq(familiesTable.id, familyIdRaw), eq(familiesTable.userId, userId)))
      .limit(1);
    if (!ownershipCheck) {
      res.status(403).json({ error: "You do not have access to this family." });
      return;
    }
  }

  res.setHeader("Content-Type",    "text/event-stream");
  res.setHeader("Cache-Control",   "no-cache");
  res.setHeader("Connection",      "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let isClientDisconnected = false;
  req.on("close", () => {
    isClientDisconnected = true;
    console.info("[Chat] Client disconnected — stream will be abandoned.");
  });

  try {
    let contextString = "";

    if (familyIdRaw && Number.isInteger(familyIdRaw) && familyIdRaw > 0) {
      const ctx = await assembleChatContext(familyIdRaw, trimmedMessage);
      contextString = ctx.contextString;
    }

    const contextualizedMessage = [
      contextString ? "[SYSTEM CONTEXT — DO NOT QUOTE OR REFERENCE THIS BLOCK IN YOUR RESPONSE]" : "",
      contextString,
      contextString ? "[END SYSTEM CONTEXT]" : "",
      "",
      "USER MESSAGE:",
      trimmedMessage,
      safeLanguage !== "en-IN"
        ? `[Language note: The user is communicating in language code "${safeLanguage}". Respond in the same language register.]`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const model = getGeminiModel();

    const streamResult = await model.generateContentStream(contextualizedMessage);

    let fullResponseBuffer = "";
    let streamedUpTo = 0;

    for await (const chunk of streamResult.stream) {
      if (isClientDisconnected) break;

      const chunkText = chunk.text();
      if (!chunkText) continue;

      fullResponseBuffer += chunkText;

      const delimiterIdx = fullResponseBuffer.indexOf(ACTION_DELIMITER);
      if (delimiterIdx !== -1) {
        const unsent = fullResponseBuffer.slice(streamedUpTo, delimiterIdx);
        if (unsent.trim()) {
          sendSseEvent(res, { type: "delta", text: unsent });
        }
        streamedUpTo = fullResponseBuffer.length;
      } else {
        const safeEnd = fullResponseBuffer.length - ACTION_DELIMITER.length;
        if (safeEnd > streamedUpTo) {
          const unsent = fullResponseBuffer.slice(streamedUpTo, safeEnd);
          sendSseEvent(res, { type: "delta", text: unsent });
          streamedUpTo = safeEnd;
        }
      }
    }

    if (streamedUpTo < fullResponseBuffer.length) {
      const delimiterIdx = fullResponseBuffer.indexOf(ACTION_DELIMITER);
      const endIdx = delimiterIdx !== -1 ? delimiterIdx : fullResponseBuffer.length;
      const remaining = fullResponseBuffer.slice(streamedUpTo, endIdx);
      if (remaining.trim()) {
        sendSseEvent(res, { type: "delta", text: remaining });
      }
    }

    if (!isClientDisconnected) {
      const { actionPayload } = parseActionFromResponse(fullResponseBuffer);

      if (actionPayload) {
        sendSseEvent(res, { type: "action", payload: actionPayload });
      }
    }

    if (!isClientDisconnected) {
      closeSseStream(res);
    }

  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "An unknown error occurred.";

    console.error("[Chat] Stream error:", errorMessage);

    if (res.headersSent) {
      sendSseEvent(res, { type: "error", message: errorMessage });
      closeSseStream(res);
    } else {
      res.status(500).json({ error: errorMessage });
    }
  }
});

router.get("/health", (_req: Request, res: Response) => {
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY);
  res.json({
    status:    hasApiKey ? "ok" : "error — GEMINI_API_KEY not set",
    model:     GEMINI_MODEL,
    timestamp: new Date().toISOString(),
  });
});

export default router;
