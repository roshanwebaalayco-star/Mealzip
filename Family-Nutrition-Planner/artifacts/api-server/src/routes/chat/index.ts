import { Router, Request, Response } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import { db, familiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { assembleChatContext } from "../../lib/assembleContext.js";
import { MEGA_PROMPT }         from "../../lib/megaPrompt.js";
import {
  saveChatMessage,
  loadChatHistory,
  listSessionsForFamily,
} from "../../lib/chatHistory.js";

const router = Router();

const ACTION_DELIMITER   = "---ACTION---";
const GEMINI_MODEL       = "gemini-2.5-flash";
const MAX_MESSAGE_LENGTH = 2_000;

function isValidSessionId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    id.trim().length > 0 &&
    id.trim().length <= 128
  );
}

interface ParsedResponse {
  conversationalText: string;
  actionPayload: Record<string, unknown> | null;
}

function parseActionFromResponse(rawText: string): ParsedResponse {
  if (!rawText.includes(ACTION_DELIMITER)) {
    return { conversationalText: rawText.trim(), actionPayload: null };
  }

  const delimiterIndex    = rawText.indexOf(ACTION_DELIMITER);
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
      }
    } catch {
      console.error("[ActionParser] Failed to parse JSON:", jsonCandidate.slice(0, 200));
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

async function validateFamilyOwnership(familyId: number, userId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: familiesTable.id })
    .from(familiesTable)
    .where(and(eq(familiesTable.id, familyId), eq(familiesTable.userId, userId)))
    .limit(1);
  return !!row;
}

function getUserId(req: Request): number | null {
  const userId = (req as any).user?.userId;
  if (typeof userId !== "number" || !Number.isInteger(userId) || userId <= 0) return null;
  return userId;
}

router.get("/history", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const { sessionId, familyId: qFamilyId } = req.query;
  if (!isValidSessionId(sessionId)) {
    res.status(400).json({ error: "sessionId query parameter is required." });
    return;
  }

  const familyId = typeof qFamilyId === "string" ? parseInt(qFamilyId, 10) : null;
  if (!familyId || !Number.isInteger(familyId) || familyId <= 0) {
    res.status(400).json({ error: "familyId query parameter is required." });
    return;
  }

  if (!(await validateFamilyOwnership(familyId, userId))) {
    res.status(403).json({ error: "You do not have access to this family." });
    return;
  }

  const messages = await loadChatHistory({ familyId, sessionId, limit: 100 });
  res.json({ messages });
});

router.get("/sessions", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const { familyId: qFamilyId } = req.query;
  const familyId = typeof qFamilyId === "string" ? parseInt(qFamilyId, 10) : null;
  if (!familyId || !Number.isInteger(familyId) || familyId <= 0) {
    res.status(400).json({ error: "familyId query parameter is required." });
    return;
  }

  if (!(await validateFamilyOwnership(familyId, userId))) {
    res.status(403).json({ error: "You do not have access to this family." });
    return;
  }

  const sessions = await listSessionsForFamily(familyId);
  res.json({ sessions });
});

router.post("/", async (req: Request, res: Response) => {

  const { message, language, familyId: bodyFamilyId, sessionId } = req.body as {
    message?:   unknown;
    language?:  unknown;
    familyId?:  unknown;
    sessionId?: unknown;
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message must be a non-empty string." });
    return;
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length === 0) {
    res.status(400).json({ error: "message cannot be empty." });
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

  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const familyIdRaw = typeof bodyFamilyId === "number" ? bodyFamilyId : null;

  if (familyIdRaw && Number.isInteger(familyIdRaw) && familyIdRaw > 0) {
    if (!(await validateFamilyOwnership(familyIdRaw, userId))) {
      res.status(403).json({ error: "You do not have access to this family." });
      return;
    }
  }

  if (!isValidSessionId(sessionId)) {
    res.status(400).json({
      error: "sessionId is required. Generate a UUID on the client and include it in the request body.",
    });
    return;
  }
  const safeSessionId = (sessionId as string).trim();

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let isClientDisconnected = false;
  req.on("close", () => {
    isClientDisconnected = true;
    console.info("[Chat] Client disconnected — stream will be abandoned.");
  });

  try {
    if (familyIdRaw && Number.isInteger(familyIdRaw) && familyIdRaw > 0) {
      await saveChatMessage({
        familyId: familyIdRaw,
        sessionId: safeSessionId,
        role: "user",
        text: trimmedMessage,
      });
    }

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
        ? `[Language note: Respond in language code "${safeLanguage}".]`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const streamResult = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: contextualizedMessage }] }],
      config: {
        temperature:     0.4,
        maxOutputTokens: 1024,
      },
      systemInstruction: { parts: [{ text: MEGA_PROMPT }] },
    });

    let fullResponseBuffer = "";
    let streamedUpTo = 0;

    for await (const chunk of streamResult) {
      if (isClientDisconnected) break;

      const chunkText = typeof chunk === "object" && chunk !== null && "text" in chunk ? (chunk as any).text : "";
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
      const { conversationalText, actionPayload } = parseActionFromResponse(fullResponseBuffer);

      if (familyIdRaw && Number.isInteger(familyIdRaw) && familyIdRaw > 0 && conversationalText) {
        await saveChatMessage({
          familyId: familyIdRaw,
          sessionId: safeSessionId,
          role: "assistant",
          text: conversationalText,
        });
      }

      if (actionPayload) {
        sendSseEvent(res, { type: "action", payload: actionPayload });
      }

      closeSseStream(res);
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "An unknown error occurred.";
    console.error("[Chat] Error:", msg);

    if (res.headersSent) {
      sendSseEvent(res, { type: "error", message: msg });
      closeSseStream(res);
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status:    "ok",
    model:     GEMINI_MODEL,
    timestamp: new Date().toISOString(),
  });
});

export default router;
