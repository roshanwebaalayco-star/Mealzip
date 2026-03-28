import { apiFetch } from "@/lib/api-fetch";
import { useState, useRef, useEffect } from "react";

export function useChatStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const streamMessage = async (conversationId: number, content: string) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsStreaming(true);
    setCurrentMessage("");

    try {
      const res = await apiFetch(`/api/gemini/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Failed to start stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.replace('data: ', ''));
            if (data.done) {
              break;
            }
            if (data.content) {
              setCurrentMessage(prev => prev + data.content);
            }
          } catch (e) {
            console.error("SSE parse error", e);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error(err);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  return { streamMessage, isStreaming, currentMessage, setCurrentMessage };
}
