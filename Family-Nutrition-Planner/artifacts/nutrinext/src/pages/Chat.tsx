import { useState, useRef, useEffect } from "react";
import { useAppState, useVoiceRecorder } from "@/hooks/use-app-state";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useListGeminiConversations, useCreateGeminiConversation, useTranscribeVoice } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Mic, Send, Bot, Loader2, Sparkles, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    await streamMessage(activeConvoId, userMsg);
  };

  useEffect(() => {
    if (!isStreaming && currentMessage) {
      setMessages((prev) => [...prev, { role: "model", content: currentMessage }]);
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

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
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
