import { useState, useRef, useCallback, useEffect } from "react";
import { useSpeechSynthesis } from "./useVoice";
import { apiFetch } from "@/lib/api-fetch";

const SESSION_STORAGE_KEY = "ps_chat_session_id";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return `session_${Date.now()}`;
  }

  const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing && existing.trim().length > 0) return existing;

  const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

  sessionStorage.setItem(SESSION_STORAGE_KEY, uuid);
  return uuid;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id:          string;
  role:        MessageRole;
  text:        string;
  timestamp:   Date;
  isStreaming?: boolean;
  fromHistory?: boolean;
}

export type ActionType =
  | "leftover_suggestion"
  | "cheat_meal_detected"
  | "medication_conflict_warning"
  | "meal_plan_query";

export interface ActionPayload {
  action: ActionType;
  [key: string]: unknown;
}

interface ActionCardMeta {
  buttonLabel: string;
  description: string;
  variant:     "primary" | "warning" | "info";
}

export function getActionCardMeta(payload: ActionPayload): ActionCardMeta {
  switch (payload.action) {
    case "leftover_suggestion":
      return {
        buttonLabel: `Update Tomorrow's Plan with ${payload.dish ?? "suggested dish"}`,
        description: `Use leftover ${payload.ingredient ?? "ingredient"} for ${payload.mealSlot ?? "a meal"} tomorrow.`,
        variant: "primary",
      };
    case "cheat_meal_detected":
      return {
        buttonLabel: "Log Adjustment to This Week",
        description: `Tomorrow's ${payload.adjustedMeal ?? "meal"} will be rebalanced for ${payload.reason ?? "macros"}.`,
        variant: "info",
      };
    case "medication_conflict_warning":
      return {
        buttonLabel: "View Safe Meal Window",
        description: `⚠️ ${payload.member ?? "A family member"}'s ${payload.drug ?? "medication"} conflicts with ${payload.conflict ?? "this food"}.`,
        variant: "warning",
      };
    case "meal_plan_query":
      return {
        buttonLabel: "Apply This Change to Plan",
        description: `Change ${payload.slot ?? "meal"} on ${payload.day ?? "the scheduled day"} to ${payload.newMeal ?? "the new meal"}.`,
        variant: "primary",
      };
    default:
      return {
        buttonLabel: "Take Action",
        description: "The assistant has a suggestion.",
        variant: "info",
      };
  }
}

interface UseChatOptions {
  language?:    string;
  enableVoice?: boolean;
  familyId?:    number | null;
}

interface UseChatReturn {
  messages:       ChatMessage[];
  pendingAction:  ActionPayload | null;
  isLoading:      boolean;
  isLoadingHistory: boolean;
  error:          string | null;
  sessionId:      string;
  sendMessage:    (text: string) => Promise<void>;
  dismissAction:  () => void;
  clearError:     () => void;
  startNewSession: () => void;
  isSpeaking:     boolean;
  cancelSpeech:   () => void;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { language = "en-IN", enableVoice = true, familyId = null } = options;

  const [messages,          setMessages]          = useState<ChatMessage[]>([]);
  const [pendingAction,     setPendingAction]     = useState<ActionPayload | null>(null);
  const [isLoading,         setIsLoading]         = useState(false);
  const [isLoadingHistory,  setIsLoadingHistory]  = useState(true);
  const [error,             setError]             = useState<string | null>(null);
  const [sessionId,         setSessionId]         = useState<string>(() => getOrCreateSessionId());

  const abortControllerRef = useRef<AbortController | null>(null);

  const { speakDelta, flushBuffer, cancelSpeech, isSpeaking, setLanguage } =
    useSpeechSynthesis();

  useEffect(() => {
    setLanguage(language);
  }, [language, setLanguage]);

  useEffect(() => {
    let cancelled = false;

    async function fetchHistory() {
      setIsLoadingHistory(true);
      setMessages([]);

      if (!familyId) {
        setIsLoadingHistory(false);
        return;
      }

      try {
        const res = await apiFetch(
          `/api/chat/history?sessionId=${encodeURIComponent(sessionId)}&familyId=${familyId}`
        );

        if (!res.ok) {
          if (res.status !== 401) {
            console.warn("[Chat] History fetch failed:", res.status);
          }
          return;
        }

        const data = await res.json();
        const historyMessages: ChatMessage[] = (data.messages ?? []).map(
          (m: { id: number; role: string; text: string; createdAt: string }) => ({
            id:          `history_${m.id}`,
            role:        m.role as MessageRole,
            text:        m.text,
            timestamp:   new Date(m.createdAt),
            isStreaming: false,
            fromHistory: true,
          })
        );

        if (!cancelled) {
          setMessages(historyMessages);
        }
      } catch (err) {
        console.warn("[Chat] Could not load chat history:", err);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    }

    fetchHistory();
    return () => { cancelled = true; };
  }, [sessionId, familyId]);

  const startNewSession = useCallback(() => {
    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    const newId = getOrCreateSessionId();
    setSessionId(newId);
    setPendingAction(null);
    setError(null);
    cancelSpeech();
  }, [cancelSpeech]);

  const dismissAction = useCallback(() => setPendingAction(null), []);
  const clearError    = useCallback(() => setError(null),         []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      if (isSpeaking) cancelSpeech();

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const userMessage: ChatMessage = {
        id:        generateId(),
        role:      "user",
        text:      text.trim(),
        timestamp: new Date(),
      };

      const assistantMessageId = generateId();
      const assistantMessage: ChatMessage = {
        id:          assistantMessageId,
        role:        "assistant",
        text:        "",
        timestamp:   new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);
      setError(null);
      setPendingAction(null);

      try {
        const response = await apiFetch("/api/chat", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            message:   text.trim(),
            language,
            sessionId,
            familyId,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: "Request failed" }));
          throw new Error(errData.error ?? `HTTP ${response.status}`);
        }

        if (!response.body) throw new Error("No response body.");

        const reader      = response.body.getReader();
        const decoder     = new TextDecoder("utf-8");
        let   streamBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          streamBuffer += decoder.decode(value, { stream: true });
          const lines   = streamBuffer.split("\n\n");
          streamBuffer  = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            const dataLine = line.startsWith("data: ") ? line.slice(6) : line;

            let event: Record<string, unknown>;
            try {
              event = JSON.parse(dataLine);
            } catch {
              continue;
            }

            switch (event.type) {
              case "delta": {
                const token = event.text as string;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, text: msg.text + token }
                      : msg
                  )
                );
                if (enableVoice) speakDelta(token);
                break;
              }
              case "action": {
                const payload = event.payload as ActionPayload;
                if (payload?.action) setPendingAction(payload);
                break;
              }
              case "done": {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, isStreaming: false }
                      : msg
                  )
                );
                if (enableVoice) flushBuffer();
                break;
              }
              case "error": {
                throw new Error(event.message as string);
              }
            }
          }
        }

      } catch (err: unknown) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false }
              : msg
          )
        );

        if (err instanceof Error && err.name === "AbortError") return;

        const errorMsg = err instanceof Error ? err.message : "An unknown error occurred.";
        console.error("[Chat] Stream error:", errorMsg);
        setError(errorMsg);

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, text: msg.text || "An error occurred. Please try again." }
              : msg
          )
        );
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [isLoading, isSpeaking, language, sessionId, familyId, enableVoice, cancelSpeech, speakDelta, flushBuffer]
  );

  return {
    messages,
    pendingAction,
    isLoading,
    isLoadingHistory,
    error,
    sessionId,
    sendMessage,
    dismissAction,
    clearError,
    startNewSession,
    isSpeaking,
    cancelSpeech,
  };
}
