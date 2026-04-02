import { db, chatMessagesTable } from "@workspace/db";
import { eq, and, desc, sql, count, min } from "drizzle-orm";

export interface HistoryMessage {
  id:        number;
  role:      "user" | "assistant";
  text:      string;
  createdAt: string;
}

export async function saveChatMessage(params: {
  familyId:  number;
  sessionId: string;
  role:      "user" | "assistant";
  text:      string;
}): Promise<void> {
  const { familyId, sessionId, role, text } = params;

  if (!text || !text.trim()) return;
  if (text.includes("---ACTION---")) {
    console.warn("[ChatHistory] Attempted to save message containing action delimiter. Stripped.");
  }

  const cleanText = text.includes("---ACTION---")
    ? text.slice(0, text.indexOf("---ACTION---")).trim()
    : text.trim();

  if (!cleanText) return;

  if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
    console.error("[ChatHistory] Invalid sessionId — message not saved.");
    return;
  }

  try {
    await db.insert(chatMessagesTable).values({
      familyId,
      sessionId: sessionId.trim(),
      role,
      text: cleanText,
    });
  } catch (err) {
    console.error("[ChatHistory] Failed to save message:", err);
  }
}

export async function loadChatHistory(params: {
  familyId:  number;
  sessionId: string;
  limit?:    number;
}): Promise<HistoryMessage[]> {
  const { familyId, sessionId, limit = 100 } = params;

  if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
    return [];
  }

  if (!Number.isInteger(familyId) || familyId <= 0) {
    return [];
  }

  try {
    const rows = await db
      .select({
        id:        chatMessagesTable.id,
        role:      chatMessagesTable.role,
        text:      chatMessagesTable.text,
        createdAt: chatMessagesTable.createdAt,
      })
      .from(chatMessagesTable)
      .where(
        and(
          eq(chatMessagesTable.familyId, familyId),
          eq(chatMessagesTable.sessionId, sessionId.trim())
        )
      )
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(limit);

    return rows
      .reverse()
      .map((row: any) => ({
        id:        row.id,
        role:      row.role as "user" | "assistant",
        text:      row.text,
        createdAt: new Date(row.createdAt).toISOString(),
      }));
  } catch (err) {
    console.error("[ChatHistory] Failed to load history:", err);
    return [];
  }
}

export async function listSessionsForFamily(familyId: number): Promise<
  { sessionId: string; startedAt: string; messageCount: number }[]
> {
  if (!Number.isInteger(familyId) || familyId <= 0) return [];

  try {
    const rows = await db
      .select({
        sessionId:    chatMessagesTable.sessionId,
        startedAt:    min(chatMessagesTable.createdAt),
        messageCount: count(),
      })
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.familyId, familyId))
      .groupBy(chatMessagesTable.sessionId)
      .orderBy(desc(min(chatMessagesTable.createdAt)))
      .limit(20);

    return rows.map((row: any) => ({
      sessionId:    row.sessionId,
      startedAt:    row.startedAt ? new Date(row.startedAt).toISOString() : new Date().toISOString(),
      messageCount: Number(row.messageCount),
    }));
  } catch (err) {
    console.error("[ChatHistory] Failed to list sessions:", err);
    return [];
  }
}
