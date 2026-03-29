import { apiFetch } from "@/lib/api-fetch";
import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAppState } from "@/hooks/use-app-state";
import { useSeedDemoData, useListMealPlans, useGetFamily } from "@workspace/api-client-react";
import { HarmonyScore } from "@/components/HarmonyScore";
import { Button } from "@/components/ui/button";
import { Users, Loader2, Sparkles, ChefHat, Activity, CalendarDays, MessageSquareText, SendHorizontal, Bot, Mic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/language-context";
import MemberEditSheet, { type IMemberProfile } from "@/components/MemberEditSheet";

export default function Dashboard() {
  const { activeFamily, isLoading } = useAppState();
  const seedDemo = useSeedDemoData();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSeedDemo = async () => {
    try {
      await seedDemo.mutateAsync();
      toast({ title: "Demo Loaded", description: "Sharma Family profile is ready." });
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load demo data." });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeFamily) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" as const }}
        className="flex flex-col items-center justify-center p-8 min-h-[82vh] text-center"
      >
        <div className="relative mb-10">
          <div className="absolute inset-0 scale-110 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="relative w-40 h-40 rounded-full glass-panel flex items-center justify-center">
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="NutriNext"
              className="w-28 h-28 object-contain relative z-10"
            />
          </div>
        </div>

        <h1 className="font-display font-bold text-4xl md:text-5xl text-foreground mb-3 leading-tight">
          ParivarSehat AI
        </h1>
        <p className="text-base text-muted-foreground max-w-sm mx-auto mb-10 leading-relaxed">
          India's first family-centric meal planner. Balancing nutrition, budget &amp; taste with ICMR-NIN 2024 science.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <Link href="/family-setup" className="flex-1">
            <Button
              size="lg"
              className="w-full h-13 rounded-2xl text-sm font-semibold bg-secondary hover:bg-secondary/90 btn-liquid"
            >
              <Users className="w-4 h-4 mr-2" />
              Setup Family
            </Button>
          </Link>
          <Button
            size="lg"
            variant="outline"
            className="flex-1 h-13 rounded-2xl text-sm font-semibold border-primary/30 text-primary hover:bg-primary/5"
            onClick={handleSeedDemo}
            disabled={seedDemo.isPending}
          >
            {seedDemo.isPending
              ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
              : <Sparkles className="w-4 h-4 mr-2" />}
            Try Demo
          </Button>
        </div>
      </motion.div>
    );
  }

  return <ActiveDashboard familyId={activeFamily.id} />;
}

function KalKyaBanayeinWidget({ familyId }: { familyId: number }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startVoiceInput = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(",")[1];
          try {
            const res = await apiFetch("/api/voice/transcribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audioBase64: base64, languageCode: "hi-IN" }),
            });
            if (!res.ok) throw new Error("Transcription failed");
            const data = await res.json() as { transcript: string };
            if (data.transcript) {
              setInput(data.transcript);
              inputRef.current?.focus();
            }
          } catch {
            toast({ title: t("Voice failed", "आवाज विफल"), description: t("Could not transcribe audio.", "ऑडियो ट्रांसक्राइब नहीं हो सका।"), variant: "destructive" });
          }
        };
        reader.readAsDataURL(blob);
      };
      setIsRecording(true);
      mr.start();
      setTimeout(() => { if (mr.state === "recording") mr.stop(); }, 5000);
    } catch {
      toast({ title: t("Mic unavailable", "माइक उपलब्ध नहीं"), variant: "destructive" });
    }
  };

  const quickQuestions = [
    { label: t("What to cook tomorrow?", "कल क्या बनाएं?"), q: "What should I cook for my family tomorrow? Suggest a healthy Indian meal." },
    { label: t("High protein breakfast?", "उच्च प्रोटीन नाश्ता?"), q: "Suggest a high protein Indian breakfast for my family." },
    { label: t("Diabetes-friendly meal?", "मधुमेह के लिए भोजन?"), q: "What is a good diabetes-friendly Indian lunch option?" },
    { label: t("Quick 20-min dinner?", "20 मिनट का खाना?"), q: "Suggest a quick 20-minute Indian dinner that's nutritious." },
  ];

  const convIdRef = useRef<number | null>(null);

  const getOrCreateConversation = useCallback(async (): Promise<number> => {
    if (convIdRef.current !== null) return convIdRef.current;
    const res = await apiFetch("/api/gemini/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Kal Kya Banayein — Home Chat" }),
    });
    const conv = await res.json() as { id: number };
    convIdRef.current = conv.id;
    return conv.id;
  }, []);

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;
    setLoading(true);
    setReply(null);
    try {
      const convId = await getOrCreateConversation();
      const res = await apiFetch(`/api/gemini/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.slice(6)) as { content?: string; done?: boolean };
              if (parsed.content) {
                accumulated += parsed.content;
                setReply(accumulated);
              }
            } catch { /* skip malformed chunk */ }
          }
        }
      }
      if (!accumulated) setReply("Sorry, I couldn't get a response. Please try again.");
    } catch {
      setReply("Unable to connect to AI assistant. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
    setInput("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
      className="glass-card rounded-3xl p-5 md:p-6"
      style={{ background: "rgba(254,252,240,0.80)" }}
    >
      <div className="flex items-center gap-2 mb-4 relative z-10">
        <span className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary" />
        </span>
        <div>
          <h3 className="font-display font-bold text-base leading-none">
            {t("Kal Kya Banayein?", "कल क्या बनाएं?")}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t("Ask your family nutrition assistant", "अपने पोषण सहायक से पूछें")}
          </p>
        </div>
      </div>

      {/* Quick question chips */}
      <div className="flex flex-wrap gap-1.5 mb-3 relative z-10">
        {quickQuestions.map(({ label, q }) => (
          <button
            key={label}
            onClick={() => sendMessage(q)}
            disabled={loading}
            className="text-[11px] px-2.5 py-1 rounded-full border border-primary/20 bg-white/60 hover:bg-primary/5 hover:border-primary/40 transition-colors font-medium text-foreground/80 disabled:opacity-40"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="flex gap-2 relative z-10">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t("Ask anything about today's meal…", "आज के भोजन के बारे में कुछ भी पूछें…")}
          disabled={loading}
          className="flex-1 h-10 rounded-xl border border-border bg-white/70 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={startVoiceInput}
          disabled={loading}
          title={isRecording ? t("Recording… tap to stop", "रिकॉर्ड हो रहा है… रोकने के लिए टैप करें") : t("Speak your question (Hindi/English)", "अपना सवाल बोलें (हिंदी/अंग्रेज़ी)")}
          className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${isRecording ? "bg-red-500 border-red-500 text-white animate-pulse" : "border-border bg-white/70 hover:bg-white/90 text-primary"}`}
        >
          <Mic className="w-4 h-4" />
        </button>
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-10 h-10 rounded-xl bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
        </button>
        <Link href="/chat" title="Full chat" className="w-10 h-10 rounded-xl border border-border bg-white/70 hover:bg-white/90 flex items-center justify-center transition-colors">
          <MessageSquareText className="w-4 h-4 text-secondary" />
        </Link>
      </form>

      {/* AI Reply */}
      {(loading || reply) && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-3 rounded-2xl bg-white/70 border border-primary/10 relative z-10"
        >
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              {t("Thinking…", "सोच रहा हूं…")}
            </div>
          ) : (
            <p className="text-sm text-foreground/80 leading-relaxed">{reply}</p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function ActiveDashboard({ familyId }: { familyId: number }) {
  const { data: familyInfo, isLoading: familyLoading } = useGetFamily(familyId);
  const { data: mealPlans, isLoading: plansLoading } = useListMealPlans({ familyId });
  const { t } = useLanguage();
  const [editingMember, setEditingMember] = useState<IMemberProfile | null>(null);

  const latestPlan = mealPlans?.[0];

  if (familyLoading || plansLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  };

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="p-4 md:p-8 space-y-5"
    >
      {/* ── Hero Banner ── */}
      <motion.div
        variants={item}
        className="relative rounded-3xl overflow-hidden glass-panel p-6 md:p-8 flex flex-col md:flex-row items-center gap-6"
      >
        <img
          src={`${import.meta.env.BASE_URL}images/hero-spices.png`}
          className="absolute inset-0 w-full h-full object-cover opacity-[0.12]"
          alt=""
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/70 to-white/30 pointer-events-none" />

        <div className="relative z-10 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary mb-2">
            {t("Family Dashboard", "पारिवारिक डैशबोर्ड")}
          </p>
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-1.5">
            {t("Namaste", "नमस्ते")}, {familyInfo?.name}!
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
            {familyInfo?.members?.length || 0} {t("members · ICMR-NIN 2024 compliant meals", "सदस्य · ICMR-NIN 2024 अनुरूप भोजन")}
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/meal-plan">
              <button className="btn-liquid inline-flex items-center gap-2 bg-gradient-to-br from-primary to-orange-500 text-white text-sm font-semibold px-5 py-2.5 rounded-2xl">
                <CalendarDays className="w-4 h-4" />
                {t("View Meal Plan", "भोजन योजना देखें")}
              </button>
            </Link>
            <Link href="/scanner">
              <button className="inline-flex items-center gap-2 glass-card text-foreground text-sm font-semibold px-5 py-2.5 rounded-2xl hover:bg-white/80 transition-colors">
                <Mic className="w-4 h-4 text-primary" />
                {t("Scan Pantry", "पेंट्री स्कैन")}
              </button>
            </Link>
          </div>
        </div>

        {/* Harmony Score */}
        <div className="relative z-10 glass-card rounded-3xl p-5 flex flex-col items-center min-w-[140px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">
            {t("Harmony Score", "सामंजस्य स्कोर")}
          </p>
          <HarmonyScore score={latestPlan?.harmonyScore || 0} size="lg" />
          <p className="mt-3 text-[11px] text-center text-muted-foreground max-w-[130px] leading-snug">
            {t("Balances every member's needs at once", "हर सदस्य की जरूरतें एक साथ")}
          </p>
        </div>
      </motion.div>

      {/* ── Kal Kya Banayein Quick Chat ── */}
      <motion.div variants={item}>
        <KalKyaBanayeinWidget familyId={familyId} />
      </motion.div>

      {/* ── Cards Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Family Members */}
        <motion.div variants={item} className="glass-card rounded-3xl p-6">
          <div className="flex items-center justify-between mb-5 relative z-10">
            <h3 className="font-display font-bold text-base flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-secondary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-secondary" />
              </span>
              {t("Family Members", "परिवार के सदस्य")}
            </h3>
            <Link href="/profile" className="text-xs font-semibold text-primary hover:underline">
              {t("Edit", "संपादित करें")}
            </Link>
          </div>
          <div className="space-y-3 relative z-10">
            {familyInfo?.members?.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setEditingMember({
                  id: member.id,
                  familyId: member.familyId,
                  name: member.name,
                  role: member.role,
                  age: member.age,
                  gender: member.gender as "male" | "female" | "other",
                  weightKg: member.weightKg ?? undefined,
                  heightCm: member.heightCm ?? undefined,
                  activityLevel: (member.activityLevel ?? undefined) as IMemberProfile["activityLevel"],
                  healthConditions: member.healthConditions ?? [],
                  dietaryRestrictions: member.dietaryRestrictions ?? [],
                  primaryGoal: (((member as unknown) as Record<string, unknown>).primaryGoal ?? undefined) as IMemberProfile["primaryGoal"],
                  goalPace: (((member as unknown) as Record<string, unknown>).goalPace ?? "none") as IMemberProfile["goalPace"],
                  tiffinType: (((member as unknown) as Record<string, unknown>).tiffinType ?? "none") as IMemberProfile["tiffinType"],
                  religiousRules: (((member as unknown) as Record<string, unknown>).religiousRules ?? "none") as IMemberProfile["religiousRules"],
                  ingredientDislikes: (((member as unknown) as Record<string, unknown>).ingredientDislikes as string[] | undefined) ?? [],
                  nonVegDays: (((member as unknown) as Record<string, unknown>).nonVegDays as string[] | undefined ?? []) as IMemberProfile["nonVegDays"],
                  nonVegTypes: (((member as unknown) as Record<string, unknown>).nonVegTypes as string[] | undefined ?? []) as IMemberProfile["nonVegTypes"],
                  calorieTarget: member.calorieTarget ?? undefined,
                })}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/50 border border-white/70 hover:bg-white/80 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/80 to-orange-400 flex items-center justify-center text-white text-sm font-bold shadow-sm shadow-primary/20">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{member.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {member.role} · {member.age}y
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {member.icmrCaloricTarget && member.weightKg && member.heightCm && (member.primaryGoal === "weight_loss" || member.primaryGoal === "muscle_gain") ? (
                    <div className="flex items-center justify-end gap-1 mb-0.5">
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full leading-none">ICMR</span>
                      <span className="text-xs font-semibold text-foreground/80">{member.icmrCaloricTarget ?? member.calorieTarget ?? "—"} kcal</span>
                    </div>
                  ) : null}
                  <div className="flex gap-1 mt-0.5 justify-end flex-wrap">
                    {member.healthConditions?.slice(0, 2).map((h) => (
                      <span key={h} className="text-[11px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 leading-none">{h}</span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* AI Insights */}
        <motion.div
          variants={item}
          className="glass-card rounded-3xl p-6"
          style={{ background: 'rgba(240,253,248,0.70)' }}
        >
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <span className="w-7 h-7 rounded-xl bg-secondary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-secondary" />
            </span>
            <h3 className="font-display font-bold text-base">{t("AI Insights", "AI अंतर्दृष्टि")}</h3>
          </div>

          {latestPlan?.aiInsights ? (
            <p className="text-sm text-emerald-900/80 leading-relaxed relative z-10">
              {latestPlan.aiInsights}
            </p>
          ) : (
            <div className="text-center py-8 text-secondary/50 relative z-10">
              <ChefHat className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-xs">{t("Generate a meal plan to see personalized insights.", "व्यक्तिगत सुझाव देखने के लिए भोजन योजना बनाएं।")}</p>
            </div>
          )}

          <div className="mt-5 flex items-start gap-3 bg-white/55 border border-white/70 rounded-2xl p-3.5 relative z-10">
            <Activity className="w-5 h-5 text-secondary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-secondary">{t("ICMR-NIN 2024 Tip", "ICMR-NIN 2024 सुझाव")}</p>
              <p className="text-xs text-emerald-800/70 mt-0.5 leading-snug">
                {t(
                  "Eat 500 g of diverse vegetables daily to meet adult micronutrient targets.",
                  "वयस्क सूक्ष्म पोषक लक्ष्यों को पूरा करने के लिए प्रतिदिन 500 ग्राम विविध सब्जियां खाएं।"
                )}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
      <MemberEditSheet key={editingMember?.id ?? 0} member={editingMember} onClose={() => setEditingMember(null)} />
    </motion.div>
  );
}
