import { useState, useRef, useEffect, useCallback } from "react";
import { useAppState, useVoiceRecorder } from "@/hooks/use-app-state";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useVoiceChat } from "@/hooks/use-voice-chat";
import { useLanguageStore } from "@/store/useLanguageStore";
import { LANG_TO_BCP47 } from "@/lib/languages";
import { useListGeminiConversations, useCreateGeminiConversation, useTranscribeVoice } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Send, Bot, Loader2, Sparkles, RefreshCcw, AlertTriangle, AudioLines, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api-fetch";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const FOOD_LOG_PATTERNS = [/\b(ate|had|eaten|drank|consumed|just ate|just had|eating|drinking|finished)\b/i];
const HFSS_LS_KEY = "nutrinext_hfss_log";

function getWeeklyHFSSCount(): number {
  try {
    const log = JSON.parse(localStorage.getItem(HFSS_LS_KEY) ?? "[]") as Array<{ ts: number }>;
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return log.filter(e => e.ts > weekAgo).length;
  } catch { return 0; }
}

function recordHFSSEvent() {
  try {
    const log = JSON.parse(localStorage.getItem(HFSS_LS_KEY) ?? "[]") as Array<{ ts: number }>;
    log.push({ ts: Date.now() });
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    localStorage.setItem(HFSS_LS_KEY, JSON.stringify(log.filter(e => e.ts > weekAgo)));
  } catch { /* non-critical */ }
}

export default function Chat() {
  const { toast } = useToast();
  const { activeFamily } = useAppState();
  const { data: convos } = useListGeminiConversations();
  const createConvo = useCreateGeminiConversation();
  const { streamMessage, isStreaming, currentMessage, setOnChunk, setOnDone } = useChatStream();
  const { currentLanguage } = useLanguageStore();

  const {
    voiceMode,
    micState,
    volume,
    setMicState,
    startVoiceMode,
    stopVoiceMode,
    bargeIn,
    listenOnce,
    feedChunk,
    flushBuffer,
    resetStreamState,
    waitForSpeechDone,
  } = useVoiceChat();

  const [activeConvoId, setActiveConvoId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();
  const transcribe = useTranscribeVoice();
  const voiceModeLoopRef = useRef(false);

  type HFSSFoodEntry = { food: string; kcal_per_serve: number; sodium_mg: number; fat_g: number; is_hfss: boolean; nova_group?: number; kcal_per_100g?: number; sodium_mg_per_serve?: number; fat_g_per_100g?: number; sugar_g_per_100g?: number };
  type HFSSResult = { isHFSS: boolean; items: string[]; foodLog?: HFSSFoodEntry[]; totalKcal?: number; totalSodiumMg?: number; rebalanceSuggestion: string | null; rebalance_strategy?: string | null; patchedSlot?: { day: string; mealType: string; planId: number } | null };
  const [hfssResults, setHfssResults] = useState<Record<number, HFSSResult>>({});
  const [weeklyHFSSCount, setWeeklyHFSSCount] = useState(() => getWeeklyHFSSCount());
  const pendingHFSSMsg = useRef<{ msgIndex: number; text: string } | null>(null);

  useEffect(() => {
    if (convos && convos.length > 0 && !activeConvoId) {
      setActiveConvoId(convos[0].id);
    } else if (convos && convos.length === 0 && !activeConvoId) {
      createConvo.mutateAsync({ data: { title: "Nutrition Session" } }).then((c) =>
        setActiveConvoId(c.id)
      );
    }
  }, [convos, activeConvoId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentMessage]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !activeConvoId || isStreaming) return;
    const userMsg = text.trim();

    const isFoodLog = FOOD_LOG_PATTERNS.some(p => p.test(userMsg));

    setMessages((prev) => {
      const nextIdx = prev.length + 1;
      if (isFoodLog) {
        pendingHFSSMsg.current = { msgIndex: nextIdx, text: userMsg };
      }
      return [...prev, { role: "user", content: userMsg }];
    });

    if (voiceMode) {
      resetStreamState();
      setOnChunk(feedChunk);
      setOnDone(flushBuffer);
    } else {
      setOnChunk(null);
      setOnDone(null);
    }

    await streamMessage(activeConvoId, userMsg, activeFamily?.id ?? null, currentLanguage);
  }, [activeConvoId, isStreaming, activeFamily, currentLanguage, voiceMode, streamMessage, feedChunk, flushBuffer, resetStreamState, setOnChunk, setOnDone]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    const msg = input.trim();
    setInput("");
    await sendMessage(msg);
  };

  useEffect(() => {
    if (!isStreaming && currentMessage) {
      setMessages((prev) => [...prev, { role: "model", content: currentMessage }]);
      if (pendingHFSSMsg.current) {
        const { msgIndex, text } = pendingHFSSMsg.current;
        pendingHFSSMsg.current = null;
        apiFetch("/api/gemini/hfss-classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, familyId: activeFamily?.id ?? null }),
        }).then(r => r.json()).then((result: HFSSResult) => {
          if (result.isHFSS) {
            setHfssResults(prev => ({ ...prev, [msgIndex]: result }));
            recordHFSSEvent();
            setWeeklyHFSSCount(getWeeklyHFSSCount());
          }
        }).catch(() => { /* non-critical */ });
      }
    }
  }, [isStreaming]);

  const handleVoice = async () => {
    if (isRecording) {
      const base64 = await stopRecording();
      if (base64) {
        const bcp47 = LANG_TO_BCP47[currentLanguage] ?? "en-IN";
        try {
          const res = await transcribe.mutateAsync({ data: { audioBase64: base64, languageCode: bcp47 } });
          if (res.transcript) setInput(res.transcript);
        } catch (e) {
          const detail = (e as { detail?: string; message?: string })?.detail
            ?? (e instanceof Error ? e.message : null)
            ?? "Voice transcription failed. Please try typing instead.";
          toast({ title: "Voice input failed", description: detail, variant: "destructive" });
        }
      }
    } else {
      await startRecording();
    }
  };

  const startVoiceLoop = useCallback(async () => {
    await startVoiceMode();
    voiceModeLoopRef.current = true;

    const loop = async () => {
      while (voiceModeLoopRef.current) {
        const transcript = await listenOnce();
        if (!voiceModeLoopRef.current) break;
        if (!transcript) continue;
        setMicState("processing");
        await sendMessage(transcript);
        await waitForSpeechDone();
        if (!voiceModeLoopRef.current) break;
      }
    };
    loop().catch(() => { /* voice loop ended */ });
  }, [startVoiceMode, listenOnce, sendMessage, setMicState, waitForSpeechDone]);

  const stopVoiceLoop = useCallback(() => {
    voiceModeLoopRef.current = false;
    stopVoiceMode();
  }, [stopVoiceMode]);

  useEffect(() => {
    return () => {
      voiceModeLoopRef.current = false;
      stopVoiceMode();
    };
  }, [stopVoiceMode]);

  const hints = [
    "Suggest diabetic friendly snacks",
    "मुझे आज का खाना बताओ",
    "Why do I need 500g veggies?",
  ];

  const micPulseSize = Math.max(1, 1 + (volume / 100) * 0.6);

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] sm:h-[calc(100vh-5.5rem)] md:h-screen p-3 sm:p-4 md:p-6 w-full animate-fade-up">
      <div className="glass-elevated flex-1 rounded-3xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="relative z-10 flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4 md:p-5 border-b border-white/60">
          <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl shadow shrink-0" style={{ background: 'linear-gradient(135deg, var(--brand-400), var(--brand-600))' }}>
            <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          <div className="min-w-0">
            <h2 className="font-medium text-sm sm:text-base leading-tight truncate" style={{ letterSpacing: '-0.015em', color: 'var(--text-primary)' }}>Swasthya Sahayak (AI)</h2>
            <p className="text-[10px] sm:text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>Multilingual Nutrition Assistant</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => (voiceMode ? stopVoiceLoop() : startVoiceLoop())}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all border ${
                voiceMode
                  ? "bg-red-50 text-red-600 border-red-200/60 hover:bg-red-100"
                  : "bg-emerald-50 text-emerald-700 border-emerald-300/60 hover:bg-emerald-100"
              }`}
              title={voiceMode ? "Exit voice mode" : "Enter voice chat mode"}
            >
              {voiceMode ? (
                <>
                  <MicOff className="w-4 h-4" />
                  Stop
                </>
              ) : (
                <>
                  <AudioLines className="w-4 h-4" />
                  Talk
                </>
              )}
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
              <Sparkles className="w-3 h-3" />
              Gemini AI
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 hide-scrollbar relative z-10"
          ref={scrollRef}
        >
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-full flex flex-col items-center justify-center text-center text-muted-foreground"
            >
              <div className="w-16 h-16 glass-elevated rounded-3xl flex items-center justify-center mb-4">
                <Bot className="w-8 h-8" style={{ color: 'var(--brand-300)' }} />
              </div>
              <p className="text-sm max-w-xs mb-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Ask me anything about your family's nutrition, ICMR-NIN 2024 guidelines, or recipes.
              </p>
              <p className="text-xs mb-5" style={{ color: 'var(--text-tertiary)' }}>
                Type in any language or tap Voice Chat to speak
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                {hints.map((hint) => (
                  <button
                    key={hint}
                    onClick={() => { setInput(hint); inputRef.current?.focus(); }}
                    className="pill px-3.5 py-1.5 rounded-full text-xs font-medium hover:text-primary transition-colors"
                  >
                    "{hint}"
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Weekly HFSS rolling note */}
          {weeklyHFSSCount >= 3 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-start gap-2 px-3 py-2.5 rounded-2xl border border-amber-300/60 bg-amber-50/70 text-amber-900 text-xs"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold">Weekly HFSS Alert:</span> You've logged {weeklyHFSSCount} high-fat/sugar/salt items this week. Your meal plan will auto-compensate with more fibre, iron, and hydration.
              </span>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col gap-2">
                <div className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role !== "user" && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-3xl rounded-tr-lg text-white shadow-md bg-gradient-to-br from-[var(--brand-400)] to-[var(--brand-600)]"
                        : "glass-card rounded-3xl rounded-tl-lg"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap relative z-10">{msg.content}</p>
                    ) : (
                      <div className="relative z-10 prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-p:leading-relaxed prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-strong:font-semibold prose-h3:text-sm prose-h3:mt-2 prose-h3:mb-1 prose-h2:text-sm prose-h2:mt-2 prose-h2:mb-1 prose-table:text-xs prose-thead:bg-muted/40 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-td:border prose-td:border-border/40">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>

                {/* HFSS Rebalance Card */}
                {msg.role === "model" && hfssResults[i] && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="ml-9 max-w-[82%] rounded-2xl border border-green-300/60 bg-green-50/70 px-4 py-3 text-xs"
                  >
                    <div className="flex items-center gap-1.5 mb-2 text-green-800 font-semibold">
                      <RefreshCcw className="w-3 h-3" />
                      HFSS Detected — ICMR Rebalance
                      {hfssResults[i].totalKcal && (
                        <span className="ml-auto text-[11px] font-normal text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">
                          ~{hfssResults[i].totalKcal} kcal · {hfssResults[i].totalSodiumMg}mg Na
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {hfssResults[i].foodLog && hfssResults[i].foodLog.length > 0
                        ? hfssResults[i].foodLog.map(f => (
                            <span key={f.food} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-medium capitalize">
                              {f.food}
                              <span className="opacity-70">{f.kcal_per_serve}kcal</span>
                              {f.nova_group && (
                                <span className={`text-[11px] font-bold px-1 rounded ${f.nova_group === 4 ? "bg-red-700 text-white" : f.nova_group === 3 ? "bg-orange-500 text-white" : "bg-green-600 text-white"}`}>
                                  N{f.nova_group}
                                </span>
                              )}
                            </span>
                          ))
                        : hfssResults[i].items.map(item => (
                            <span key={item} className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-medium capitalize">{item}</span>
                          ))
                      }
                    </div>
                    <p className="text-green-900 leading-snug">{hfssResults[i].rebalance_strategy ?? hfssResults[i].rebalanceSuggestion}</p>
                    {hfssResults[i].patchedSlot && (
                      <p className="mt-1.5 text-[11px] text-teal-700 bg-teal-50 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                        {hfssResults[i].patchedSlot!.day} {hfssResults[i].patchedSlot!.mealType} rebalanced in your meal plan
                      </p>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2.5 justify-start"
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="max-w-[78%] glass-card rounded-3xl rounded-tl-lg px-4 py-3 text-sm">
                <div className="relative z-10 prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-p:leading-relaxed prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-strong:font-semibold prose-h3:text-sm prose-h2:text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentMessage}</ReactMarkdown>
                  <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 rounded-sm animate-pulse align-middle" />
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Voice Mode Overlay */}
        <AnimatePresence>
          {voiceMode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="relative z-10 px-4 py-5 border-t border-white/60 bg-gradient-to-t from-violet-50/80 to-transparent"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center">
                    <div
                      className="absolute rounded-full bg-violet-400/20 transition-transform duration-150"
                      style={{
                        width: 56,
                        height: 56,
                        transform: `scale(${micPulseSize})`,
                      }}
                    />
                    <div
                      className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                        micState === "listening"
                          ? "bg-gradient-to-br from-violet-500 to-purple-600"
                          : micState === "speaking"
                          ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                          : micState === "processing"
                          ? "bg-gradient-to-br from-amber-500 to-orange-600"
                          : "bg-gradient-to-br from-gray-400 to-gray-500"
                      }`}
                    >
                      {micState === "processing" ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : micState === "speaking" ? (
                        <AudioLines className="w-6 h-6 text-white" />
                      ) : (
                        <Mic className="w-6 h-6 text-white" />
                      )}
                    </div>
                  </div>

                  <button
                    onClick={stopVoiceLoop}
                    className="w-10 h-10 rounded-full bg-red-100 text-red-500 hover:bg-red-200 flex items-center justify-center transition-colors"
                    title="Exit voice mode"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs font-medium text-muted-foreground">
                  {micState === "listening"
                    ? "Listening..."
                    : micState === "processing"
                    ? "Processing..."
                    : micState === "speaking"
                    ? "Speaking..."
                    : "Ready"}
                </p>

                {micState === "speaking" && (
                  <button
                    onClick={() => {
                      bargeIn();
                    }}
                    className="text-[11px] text-violet-600 hover:text-violet-800 font-medium underline underline-offset-2"
                  >
                    Tap to interrupt
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input bar — hidden when voice mode is active */}
        {!voiceMode && (
          <div className="relative z-10 p-3 md:p-4 border-t border-white/60">
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 glass-card rounded-2xl px-3 py-2"
            >
              <button
                type="button"
                onClick={handleVoice}
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all focus-ring ${
                  isRecording
                    ? "bg-red-100 text-red-500 animate-pulse"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                }`}
              >
                {transcribe.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message or tap mic to speak…"
                className="flex-1 bg-transparent text-sm outline-none py-1 placeholder:text-[var(--text-tertiary)]"
                disabled={isStreaming}
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                className="btn-brand w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
