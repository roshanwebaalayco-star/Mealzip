import { useState, useRef, useEffect } from "react";
import { useAppState, useVoiceRecorder } from "@/hooks/use-app-state";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useListGeminiConversations, useCreateGeminiConversation, useTranscribeVoice } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Mic, Send, Bot, Loader2, Sparkles, ChevronDown, RefreshCcw, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api-fetch";

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

const VOICE_LANGUAGES = [
  { code: "hi-IN", label: "हिन्दी" },
  { code: "en-IN", label: "English" },
  { code: "bn-IN", label: "বাংলা" },
  { code: "ta-IN", label: "தமிழ்" },
  { code: "te-IN", label: "తెలుగు" },
  { code: "mr-IN", label: "मराठी" },
  { code: "gu-IN", label: "ગુજરાતી" },
  { code: "kn-IN", label: "ಕನ್ನಡ" },
  { code: "ml-IN", label: "മലയാളം" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ" },
  { code: "or-IN", label: "ଓଡ଼ିଆ" },
];

export default function Chat() {
  const { toast } = useToast();
  const { activeFamily } = useAppState();
  const { data: convos } = useListGeminiConversations();
  const createConvo = useCreateGeminiConversation();
  const { streamMessage, isStreaming, currentMessage } = useChatStream();

  const [activeConvoId, setActiveConvoId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [voiceLang, setVoiceLang] = useState<string>(() =>
    localStorage.getItem("chatVoiceLang") || "hi-IN"
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();
  const transcribe = useTranscribeVoice();

  type HFSSFoodEntry = { food: string; kcal_per_serve: number; sodium_mg: number; fat_g: number; is_hfss: boolean; kcal_per_100g?: number; sodium_mg_per_serve?: number; fat_g_per_100g?: number; sugar_g_per_100g?: number };
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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !activeConvoId || isStreaming) return;
    const userMsg = input.trim();
    setInput("");

    const isFoodLog = FOOD_LOG_PATTERNS.some(p => p.test(userMsg));

    setMessages((prev) => {
      const nextIdx = prev.length + 1; // +1 because AI response will be at this index
      if (isFoodLog) {
        pendingHFSSMsg.current = { msgIndex: nextIdx, text: userMsg };
      }
      return [...prev, { role: "user", content: userMsg }];
    });

    await streamMessage(activeConvoId, userMsg);
  };

  useEffect(() => {
    if (!isStreaming && currentMessage) {
      setMessages((prev) => [...prev, { role: "model", content: currentMessage }]);
      // Fire HFSS classify for the pending food log message
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
        try {
          const res = await transcribe.mutateAsync({ data: { audioBase64: base64, languageCode: voiceLang } });
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

  const hints = [
    "Suggest diabetic friendly snacks",
    "मुझे आज का खाना बताओ",
    "Why do I need 500g veggies?",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] md:h-screen p-4 md:p-6 w-full">
      <div className="glass-card flex-1 rounded-3xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="relative z-10 flex items-center gap-3 p-4 md:p-5 border-b border-white/60">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-orange-500 shadow shadow-primary/30">
            <Bot className="w-5 h-5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base leading-tight">Swasthya Sahayak (AI)</h2>
            <p className="text-[0.65rem] text-muted-foreground">Multilingual Nutrition Assistant</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="relative flex items-center">
              <select
                value={voiceLang}
                onChange={(e) => {
                  setVoiceLang(e.target.value);
                  localStorage.setItem("chatVoiceLang", e.target.value);
                }}
                className="appearance-none pl-2 pr-6 py-1 text-[0.65rem] font-medium rounded-full border border-white/80 bg-white/60 backdrop-blur-sm text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
              >
                {VOICE_LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 w-2.5 h-2.5 text-muted-foreground pointer-events-none" />
            </label>
            <div className="flex items-center gap-1.5 text-[0.65rem] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
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
              <div className="w-16 h-16 glass-panel rounded-3xl flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-primary/40" />
              </div>
              <p className="text-sm max-w-xs mb-5 leading-relaxed">
                Ask me anything about your family's nutrition, ICMR guidelines, or recipe suggestions.
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                {hints.map((hint) => (
                  <button
                    key={hint}
                    onClick={() => { setInput(hint); inputRef.current?.focus(); }}
                    className="px-3.5 py-1.5 glass-card rounded-full text-xs font-medium text-foreground/70 hover:text-primary transition-colors"
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
                        ? "bg-gradient-to-br from-primary to-orange-500 text-white rounded-3xl rounded-tr-lg shadow-md shadow-primary/20"
                        : "glass-panel rounded-3xl rounded-tl-lg text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap relative z-10">{msg.content}</p>
                  </div>
                </div>

                {/* HFSS Rebalance Card — shown below the AI response that follows the food log */}
                {msg.role === "model" && hfssResults[i] && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="ml-9 max-w-[82%] rounded-2xl border border-green-300/60 bg-green-50/70 px-4 py-3 text-xs"
                  >
                    <div className="flex items-center gap-1.5 mb-2 text-green-800 font-semibold">
                      <RefreshCcw className="w-3 h-3" />
                      🔄 HFSS Detected — ICMR Rebalance
                      {hfssResults[i].totalKcal && (
                        <span className="ml-auto text-[9px] font-normal text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">
                          ~{hfssResults[i].totalKcal} kcal · {hfssResults[i].totalSodiumMg}mg Na
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {hfssResults[i].foodLog && hfssResults[i].foodLog.length > 0
                        ? hfssResults[i].foodLog.map(f => (
                            <span key={f.food} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[9px] font-medium capitalize">
                              {f.food} <span className="opacity-70">{f.kcal_per_serve}kcal</span>
                            </span>
                          ))
                        : hfssResults[i].items.map(item => (
                            <span key={item} className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-medium capitalize">{item}</span>
                          ))
                      }
                    </div>
                    <p className="text-green-900 leading-snug">{hfssResults[i].rebalance_strategy ?? hfssResults[i].rebalanceSuggestion}</p>
                    {hfssResults[i].patchedSlot && (
                      <p className="mt-1.5 text-[9px] text-teal-700 bg-teal-50 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                        ✅ {hfssResults[i].patchedSlot!.day} {hfssResults[i].patchedSlot!.mealType} rebalanced in your meal plan
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
              <div className="max-w-[78%] glass-panel rounded-3xl rounded-tl-lg px-4 py-3 text-sm text-foreground">
                <p className="whitespace-pre-wrap relative z-10">
                  {currentMessage}
                  <span className="inline-block w-1.5 h-4 bg-primary ml-1 rounded-sm animate-pulse" />
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input bar */}
        <div className="relative z-10 p-3 md:p-4 border-t border-white/60">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 bg-white/55 backdrop-blur-sm border border-white/80 rounded-2xl px-3 py-2 shadow-inner"
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
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 py-1"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="btn-liquid w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shrink-0 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
