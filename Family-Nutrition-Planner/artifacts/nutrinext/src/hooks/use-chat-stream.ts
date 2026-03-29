import { apiFetch } from "@/lib/api-fetch";
import { useState, useRef, useEffect } from "react";

export function useChatStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const onChunkRef = useRef<((chunk: string) => void) | null>(null);
  const onDoneRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const streamMessage = async (
    conversationId: number,
    content: string,
    familyId?: number | null,
    language?: string
  ) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsStreaming(true);
    setCurrentMessage("");

    let doneFired = false;
    const fireDone = () => {
      if (doneFired) return;
      doneFired = true;
      if (onDoneRef.current) onDoneRef.current();
    };

    let sseBuffer = "";

    try {
      const res = await apiFetch(`/api/gemini/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          familyId: familyId ?? null,
          ...(language && language !== "english" ? { language } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Failed to start stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });

        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.done) {
              fireDone();
              break;
            }
            if (data.content) {
              setCurrentMessage(prev => prev + data.content);
              if (onChunkRef.current) onChunkRef.current(data.content);
            }
          } catch {
            /* partial JSON — will be completed on next chunk */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error(err);
      }
    } finally {
      setIsStreaming(false);
      fireDone();
    }
  };

  const setOnChunk = (cb: ((chunk: string) => void) | null) => {
    onChunkRef.current = cb;
  };

  const setOnDone = (cb: (() => void) | null) => {
    onDoneRef.current = cb;
  };

  return { streamMessage, isStreaming, currentMessage, setCurrentMessage, setOnChunk, setOnDone };
}
