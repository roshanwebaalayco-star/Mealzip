import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateFamily, useAddFamilyMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, Save, Plus, Trash2, Loader2, Mic, MessageSquare, Send, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import VoiceAssistantModal from "@/components/VoiceAssistantModal";
import type { VoiceFormData } from "@/hooks/use-voice-assistant";
import { INDIAN_LANGUAGES } from "@/lib/languages";
import type { IMemberProfileFields } from "@/components/MemberEditSheet";

type MemberDraft = Omit<
  IMemberProfileFields,
  "age" | "gender" | "activityLevel" | "primaryGoal" | "goalPace" | "tiffinType" | "religiousRules" | "nonVegDays" | "nonVegTypes" | "healthConditions" | "dietaryRestrictions" | "ingredientDislikes"
> & {
  _id: number;
  age: number | "";
  gender: string;
  activityLevel?: string;
  primaryGoal?: string;
  goalPace?: string;
  tiffinType?: string;
  religiousRules?: string;
  healthConditions: string[];
  dietaryRestrictions: string[];
  ingredientDislikes: string[];
  nonVegDays: string[];
  nonVegTypes: string[];
  healthGoal: string;
  dietaryType: string;
  memberFastingDays: string[];
  foodAllergies: string;
  individualTypicalBreakfast: string;
  individualTypicalLunch: string;
  individualTypicalDinner: string;
};

type MemberErrors = { name?: string; age?: string };

let _memberIdCounter = 0;

export default function FamilySetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const createFamily = useCreateFamily();
  const addMember = useAddFamilyMember();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberErrors, setMemberErrors] = useState<Record<number, MemberErrors>>({});

  const [familyData, setFamilyData] = useState({
    name: "",
    state: "Jharkhand",
    city: "",
    monthlyBudget: 5000,
    primaryLanguage: "hindi",
    cuisinePreferences: [] as string[],
    cookingTimePreference: "moderate" as "quick" | "moderate" | "elaborate",
    dietaryType: "vegetarian" as "vegetarian" | "non-vegetarian" | "vegan" | "jain",
    healthGoal: "general_wellness" as "general_wellness" | "weight_loss" | "muscle_gain" | "manage_diabetes" | "heart_health" | "manage_thyroid",
    fastingDays: [] as string[],
    mealsAreShared: true,
    sharedTypicalBreakfast: "",
    sharedTypicalLunch: "",
    sharedTypicalDinner: "",
  });

  const [members, setMembers] = useState<MemberDraft[]>([
    {
      _id: ++_memberIdCounter, name: "", role: "father", age: 35, gender: "male", weightKg: 70, heightCm: 170,
      activityLevel: "moderate", healthConditions: [], dietaryRestrictions: [], healthGoal: "general_wellness",
      dietaryType: "vegetarian", memberFastingDays: [], foodAllergies: "",
      goalPace: "none", tiffinType: "none", religiousRules: "none",
      ingredientDislikes: [], nonVegDays: [], nonVegTypes: [],
      individualTypicalBreakfast: "", individualTypicalLunch: "", individualTypicalDinner: "",
    }
  ]);

  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  const CHAT_LANGUAGES = INDIAN_LANGUAGES.map(l => ({
    key: l.key.charAt(0).toUpperCase() + l.key.slice(1),
    label: l.label,
  }));

  type ChatMsg = { role: "user" | "model"; content: string };
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLang, setChatLang] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatComplete, setChatComplete] = useState(false);
  const [dislikeInputs, setDislikeInputs] = useState<Record<number, string>>({});
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  const sendChatMessage = async (userText: string, msgs: ChatMsg[]) => {
    if (!chatLang) return;
    setChatLoading(true);
    const newMsgs: ChatMsg[] = [...msgs, { role: "user", content: userText }];
    setChatMessages(newMsgs);
    setChatInput("");
    try {
      const res = await fetch("/api/families/profile-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token") ?? ""}`,
        },
        body: JSON.stringify({ messages: newMsgs, language: chatLang }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json() as { reply: string; extractedData?: Record<string, unknown>; isComplete: boolean };
      const updatedMsgs: ChatMsg[] = [...newMsgs, { role: "model", content: data.reply }];
      setChatMessages(updatedMsgs);
      if (data.isComplete && data.extractedData) {
        const p = data.extractedData as {
          familyName?: string;
          state?: string;
          monthlyBudget?: number;
          dietaryType?: string;
          members?: Array<{ name?: string; age?: number; gender?: string; role?: string; healthConditions?: string[] }>;
        };
        const newFamilyData = {
          ...familyData,
          ...(p.familyName ? { name: p.familyName } : {}),
          ...(p.state ? { state: p.state } : {}),
          ...(p.monthlyBudget ? { monthlyBudget: p.monthlyBudget } : {}),
          ...(p.dietaryType ? { dietaryType: p.dietaryType as typeof familyData.dietaryType } : {}),
        };
        const newMembers: MemberDraft[] = (p.members ?? []).filter(m => m.name).map(m => ({
          _id: ++_memberIdCounter,
          name: m.name ?? "",
          role: m.role ?? "other",
          age: m.age ?? 25,
          gender: m.gender ?? "male",
          weightKg: 65,
          heightCm: 165,
          activityLevel: "moderate",
          healthConditions: m.healthConditions ?? [],
          dietaryRestrictions: [],
          ingredientDislikes: [],
          nonVegDays: [],
          nonVegTypes: [],
          goalPace: "none",
          tiffinType: "none",
          religiousRules: "none",
          healthGoal: "general_wellness",
          dietaryType: newFamilyData.dietaryType,
          memberFastingDays: [],
          foodAllergies: "",
          individualTypicalBreakfast: "",
          individualTypicalLunch: "",
          individualTypicalDinner: "",
        }));
        setFamilyData(newFamilyData);
        if (newMembers.length > 0) setMembers(newMembers);
        setChatComplete(true);
        await executeSave(newFamilyData, newMembers.length > 0 ? newMembers : members, "/pantry-scan", 1);
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "model", content: "Sorry, I had trouble responding. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const startChat = async (lang: string) => {
    setChatLang(lang);
    setChatMessages([]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/families/profile-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token") ?? ""}`,
        },
        body: JSON.stringify({ messages: [{ role: "user", content: `Hello! Please help me set up my family profile. Use ${lang}.` }], language: lang }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json() as { reply: string };
      setChatMessages([
        { role: "user", content: `Hello! Please help me set up my family profile. Use ${lang}.` },
        { role: "model", content: data.reply },
      ]);
    } catch {
      setChatMessages([
        { role: "user", content: `Hello!` },
        { role: "model", content: "Namaste! 🙏 Let's set up your family profile. What is your family name?" },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleAddMember = () => {
    setMembers(prev => [...prev, {
      _id: ++_memberIdCounter, name: "", role: "other", age: 25, gender: "female", weightKg: 60, heightCm: 160,
      activityLevel: "moderate", healthConditions: [], dietaryRestrictions: [], healthGoal: "general_wellness",
      dietaryType: "vegetarian", memberFastingDays: [], foodAllergies: "",
      goalPace: "none", tiffinType: "none", religiousRules: "none",
      ingredientDislikes: [], nonVegDays: [], nonVegTypes: [],
      individualTypicalBreakfast: "", individualTypicalLunch: "", individualTypicalDinner: "",
    }]);
  };

  const toggleMemberCondition = (idx: number, cond: string) => {
    const current = members[idx].healthConditions;
    let next: string[];
    if (cond === "none") {
      next = current.includes("none") ? [] : ["none"];
    } else {
      const without = current.filter(c => c !== "none");
      next = without.includes(cond) ? without.filter(c => c !== cond) : [...without, cond];
    }
    handleUpdateMember(idx, "healthConditions", next);
  };

  const toggleMemberFasting = (idx: number, day: string) => {
    const current = members[idx].memberFastingDays;
    let next: string[];
    if (day === "none") {
      next = current.includes("none") ? [] : ["none"];
    } else {
      const without = current.filter(d => d !== "none");
      next = without.includes(day) ? without.filter(d => d !== day) : [...without, day];
    }
    handleUpdateMember(idx, "memberFastingDays", next);
  };

  const handleUpdateMember = <K extends keyof MemberDraft>(index: number, field: K, value: MemberDraft[K]) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  };

  const handleRemoveMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const toggleFastingDay = (day: string) => {
    setFamilyData(fd => ({
      ...fd,
      fastingDays: fd.fastingDays.includes(day)
        ? fd.fastingDays.filter(d => d !== day)
        : [...fd.fastingDays, day],
    }));
  };

  const executeSave = async (fd: typeof familyData, mems: MemberDraft[], redirectTo = "/pantry-scan", minMembers = 2) => {
    if (!fd.name) {
      toast({ title: "Error", description: "Family name is required", variant: "destructive" });
      return;
    }

    const errors: Record<number, MemberErrors> = {};
    mems.forEach((m) => {
      const e: MemberErrors = {};
      if (!m.name.trim()) e.name = "Name is required";
      if (m.age === "" || m.age <= 0 || !Number.isFinite(Number(m.age))) e.age = "Enter a valid age";
      if (Object.keys(e).length > 0) errors[m._id] = e;
    });
    if (Object.keys(errors).length > 0) {
      setMemberErrors(errors);
      return;
    }
    setMemberErrors({});

    if (mems.length < minMembers) {
      toast({ title: "At least 2 members required", description: "Please add at least one more family member before saving.", variant: "destructive" });
      return;
    }
    if (mems.length > 5) {
      toast({ title: "Maximum 5 members", description: "Please remove some members to continue (family limit: 5).", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const enrichedPreferences = [
        ...fd.cuisinePreferences,
        fd.dietaryType,
        `cooking_time:${fd.cookingTimePreference}`,
        `health_goal:${fd.healthGoal}`,
        ...fd.fastingDays.map(d => `fasting:${d}`),
      ];
      const fam = await createFamily.mutateAsync({
        data: { ...fd, cuisinePreferences: enrichedPreferences },
      });

      for (const member of mems) {
        if (member.name) {
          const enrichedDietaryRestrictions = [
            ...member.dietaryRestrictions,
            ...(member.dietaryType ? [`diet_type:${member.dietaryType}`] : []),
            ...(member.healthGoal && member.healthGoal !== "general_wellness" ? [`health_goal:${member.healthGoal}`] : []),
            ...member.memberFastingDays.filter(d => d !== "none").map(d => `fasting:${d}`),
          ];
          const allergyList = member.foodAllergies
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);
          await addMember.mutateAsync({
            familyId: fam.id,
            data: {
              name: member.name,
              role: member.role,
              age: Number(member.age),
              gender: member.gender,
              weightKg: member.weightKg,
              heightCm: member.heightCm,
              activityLevel: member.activityLevel ?? "moderate",
              healthConditions: member.healthConditions.filter(c => c !== "none"),
              dietaryRestrictions: enrichedDietaryRestrictions,
              allergies: allergyList,
              primaryGoal: member.healthGoal !== "general_wellness" ? member.healthGoal : undefined,
              goalPace: member.goalPace !== "none" ? member.goalPace : undefined,
              tiffinType: member.tiffinType !== "none" ? member.tiffinType : undefined,
              religiousRules: member.religiousRules !== "none" ? member.religiousRules : undefined,
              ingredientDislikes: member.ingredientDislikes.length > 0 ? member.ingredientDislikes : undefined,
              nonVegDays: member.nonVegDays.length > 0 ? member.nonVegDays : undefined,
              nonVegTypes: member.nonVegTypes.length > 0 ? member.nonVegTypes : undefined,
              individualTypicalBreakfast: member.individualTypicalBreakfast || undefined,
              individualTypicalLunch: member.individualTypicalLunch || undefined,
              individualTypicalDinner: member.individualTypicalDinner || undefined,
            }
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      toast({ title: "Success!", description: "Family profile created!" });
      setLocation(redirectTo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Error saving profile", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = () => executeSave(familyData, members);

  const handleVoiceComplete = async (voiceData: VoiceFormData) => {
    const mergedFamilyData = {
      ...familyData,
      ...(voiceData.familyName ? { name: voiceData.familyName } : {}),
      ...(voiceData.state ? { state: voiceData.state } : {}),
      ...(voiceData.monthlyBudget ? { monthlyBudget: voiceData.monthlyBudget } : {}),
      ...(voiceData.dietaryType
        ? { dietaryType: voiceData.dietaryType as typeof familyData.dietaryType }
        : {}),
    };

    const voiceMembers: MemberDraft[] = (voiceData.members ?? [])
      .filter(m => m.name)
      .map(m => ({
        _id: ++_memberIdCounter,
        name: m.name ?? "",
        role: m.role ?? "other",
        age: m.age ?? 25,
        gender: m.gender ?? "male",
        weightKg: 65,
        heightCm: 165,
        activityLevel: "moderate",
        healthConditions: m.healthConditions ?? [],
        dietaryRestrictions: [],
        healthGoal: m.healthGoal ?? "general_wellness",
        dietaryType: mergedFamilyData.dietaryType,
        memberFastingDays: [],
        foodAllergies: "",
        goalPace: "none", tiffinType: "none", religiousRules: "none",
        ingredientDislikes: [], nonVegDays: [], nonVegTypes: [],
        individualTypicalBreakfast: "", individualTypicalLunch: "", individualTypicalDinner: "",
      }));

    const finalMembers = voiceMembers.length > 0 ? voiceMembers : members;

    setFamilyData(mergedFamilyData);
    if (voiceMembers.length > 0) setMembers(voiceMembers);
    setVoiceModalOpen(false);

    await executeSave(mergedFamilyData, finalMembers, "/pantry-scan", 1);
  };

  const handleVoiceClose = (partialData?: VoiceFormData) => {
    setVoiceModalOpen(false);
    if (!partialData) return;
    setFamilyData(prev => ({
      ...prev,
      ...(partialData.familyName ? { name: partialData.familyName } : {}),
      ...(partialData.state ? { state: partialData.state } : {}),
      ...(partialData.monthlyBudget ? { monthlyBudget: partialData.monthlyBudget } : {}),
      ...(partialData.dietaryType
        ? { dietaryType: partialData.dietaryType as typeof familyData.dietaryType }
        : {}),
    }));
    if (partialData.members && partialData.members.length > 0) {
      setMembers(partialData.members
        .filter(m => m.name)
        .map(m => ({
          _id: ++_memberIdCounter,
          name: m.name ?? "",
          role: m.role ?? "other",
          age: m.age ?? 25,
          gender: m.gender ?? "male",
          weightKg: 65,
          heightCm: 165,
          activityLevel: "moderate",
          healthConditions: m.healthConditions ?? [],
          dietaryRestrictions: [],
          ingredientDislikes: [],
          nonVegDays: [],
          nonVegTypes: [],
          goalPace: "none",
          tiffinType: "none",
          religiousRules: "none",
          healthGoal: m.healthGoal ?? "general_wellness",
          dietaryType: (partialData.dietaryType ?? familyData.dietaryType) as string,
          memberFastingDays: [],
          foodAllergies: "",
          individualTypicalBreakfast: "",
          individualTypicalLunch: "",
          individualTypicalDinner: "",
        }))
      );
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">
          {step === 1 ? t("Family Details", "परिवार का विवरण") : t("Family Members", "सदस्य")}
        </h1>
        <div className="flex gap-2 mt-4">
          <div className={`h-2 flex-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-2 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-border"
          >
            <div className="space-y-6">
              {/* Quick setup options: Voice + Chat */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("Quick Setup (AI-Guided)", "AI गाइडेड सेटअप")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Voice Setup */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/20">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{t("Voice Setup", "वॉइस सेटअप")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {t("Speak in your language", "अपनी भाषा में बोलें")}
                      </p>
                    </div>
                    <Button type="button" size="sm" onClick={() => setVoiceModalOpen(true)} className="gap-1.5 shrink-0 ml-2">
                      <Mic className="w-3.5 h-3.5" />
                      {t("Voice", "बोलें")}
                    </Button>
                  </div>

                  {/* Chat Setup */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/5 border border-secondary/20">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{t("Chat Setup", "चैट सेटअप")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {t("Type your answers", "टाइप करके जवाब दें")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => { setChatOpen(true); setChatLang(null); setChatMessages([]); setChatComplete(false); }}
                      className="gap-1.5 shrink-0 ml-2 border-secondary/40 text-secondary hover:bg-secondary/10"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {t("Chat", "चैट")}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Inline Chat Interface */}
              <AnimatePresence>
                {chatOpen && (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border border-secondary/30 rounded-2xl bg-secondary/5 overflow-hidden">
                      {/* Chat header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-secondary/10 border-b border-secondary/20">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-secondary" />
                          <span className="text-sm font-semibold">{t("ParivarSehat AI Chat", "पारिवार सेहत AI चैट")}</span>
                        </div>
                        <button type="button" onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Language selection */}
                      {!chatLang && (
                        <div className="p-4">
                          <p className="text-sm font-semibold mb-1">🙏 Namaste!</p>
                          <p className="text-xs text-muted-foreground mb-3">{t("Select your preferred language to continue:", "अपनी भाषा चुनें:")}</p>
                          <div className="flex flex-wrap gap-2">
                            {CHAT_LANGUAGES.map(l => (
                              <button
                                key={l.key}
                                type="button"
                                onClick={() => startChat(l.key)}
                                className="px-3 py-1.5 text-xs font-medium rounded-full bg-white border border-secondary/30 hover:bg-secondary/10 hover:border-secondary/60 transition-colors"
                              >
                                {l.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Chat messages */}
                      {chatLang && (
                        <>
                          <div className="h-52 overflow-y-auto p-3 space-y-2">
                            {chatLoading && chatMessages.length === 0 && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {t("Starting chat…", "चैट शुरू हो रही है…")}
                              </div>
                            )}
                            {chatMessages.map((msg, i) => (
                              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                                  msg.role === "user"
                                    ? "bg-primary text-white rounded-br-sm"
                                    : "bg-white border border-border text-foreground rounded-bl-sm"
                                }`}>
                                  {msg.content}
                                </div>
                              </div>
                            ))}
                            {chatLoading && chatMessages.length > 0 && (
                              <div className="flex justify-start">
                                <div className="bg-white border border-border rounded-2xl rounded-bl-sm px-3 py-2 flex gap-1">
                                  <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                  <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                  <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                </div>
                              </div>
                            )}
                            {chatComplete && (
                              <div className="text-center py-2">
                                <p className="text-xs text-green-600 font-semibold">✅ {t("Profile collected! Saving…", "प्रोफाइल तैयार! सहेज रहे हैं…")}</p>
                              </div>
                            )}
                            <div ref={chatEndRef} />
                          </div>

                          {/* Input box */}
                          {!chatComplete && (
                            <div className="flex items-center gap-2 p-3 border-t border-secondary/20 bg-white/50">
                              <Input
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter" && !e.shiftKey && chatInput.trim() && !chatLoading) {
                                    e.preventDefault();
                                    sendChatMessage(chatInput.trim(), chatMessages);
                                  }
                                }}
                                placeholder={t("Type your answer…", "अपना जवाब टाइप करें…")}
                                disabled={chatLoading}
                                className="h-8 text-xs rounded-xl bg-white"
                              />
                              <Button
                                type="button"
                                size="sm"
                                disabled={!chatInput.trim() || chatLoading}
                                onClick={() => sendChatMessage(chatInput.trim(), chatMessages)}
                                className="h-8 w-8 p-0 shrink-0"
                              >
                                {chatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium">{t("or fill form manually", "या फॉर्म भरें")}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div>
                <Label className="text-base">{t("Family Name", "परिवार का नाम")}</Label>
                <Input 
                  value={familyData.name}
                  onChange={(e) => setFamilyData({...familyData, name: e.target.value})}
                  className="mt-2 h-12 rounded-xl text-lg bg-background"
                  placeholder="e.g. Sharma Family"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>{t("State", "राज्य")}</Label>
                  <Select value={familyData.state} onValueChange={v => setFamilyData({...familyData, state: v})}>
                    <SelectTrigger className="mt-2 h-12 rounded-xl">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Andhra Pradesh">Andhra Pradesh</SelectItem>
                      <SelectItem value="Arunachal Pradesh">Arunachal Pradesh</SelectItem>
                      <SelectItem value="Assam">Assam</SelectItem>
                      <SelectItem value="Bihar">Bihar</SelectItem>
                      <SelectItem value="Chhattisgarh">Chhattisgarh</SelectItem>
                      <SelectItem value="Delhi">Delhi (NCT)</SelectItem>
                      <SelectItem value="Goa">Goa</SelectItem>
                      <SelectItem value="Gujarat">Gujarat</SelectItem>
                      <SelectItem value="Haryana">Haryana</SelectItem>
                      <SelectItem value="Himachal Pradesh">Himachal Pradesh</SelectItem>
                      <SelectItem value="Jharkhand">Jharkhand</SelectItem>
                      <SelectItem value="Karnataka">Karnataka</SelectItem>
                      <SelectItem value="Kerala">Kerala</SelectItem>
                      <SelectItem value="Madhya Pradesh">Madhya Pradesh</SelectItem>
                      <SelectItem value="Maharashtra">Maharashtra</SelectItem>
                      <SelectItem value="Manipur">Manipur</SelectItem>
                      <SelectItem value="Meghalaya">Meghalaya</SelectItem>
                      <SelectItem value="Mizoram">Mizoram</SelectItem>
                      <SelectItem value="Nagaland">Nagaland</SelectItem>
                      <SelectItem value="Odisha">Odisha</SelectItem>
                      <SelectItem value="Punjab">Punjab</SelectItem>
                      <SelectItem value="Rajasthan">Rajasthan</SelectItem>
                      <SelectItem value="Sikkim">Sikkim</SelectItem>
                      <SelectItem value="Tamil Nadu">Tamil Nadu</SelectItem>
                      <SelectItem value="Telangana">Telangana</SelectItem>
                      <SelectItem value="Tripura">Tripura</SelectItem>
                      <SelectItem value="UP">Uttar Pradesh</SelectItem>
                      <SelectItem value="Uttarakhand">Uttarakhand</SelectItem>
                      <SelectItem value="West Bengal">West Bengal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Monthly Food Budget (₹)", "मासिक खाद्य बजट (₹)")}</Label>
                  <Input 
                    type="number" 
                    value={familyData.monthlyBudget}
                    onChange={(e) => setFamilyData({...familyData, monthlyBudget: parseInt(e.target.value) || 0})}
                    className="mt-2 h-12 rounded-xl bg-background"
                  />
                </div>
                <div>
                  <Label>{t("Primary Language", "मुख्य भाषा")}</Label>
                  <Select value={familyData.primaryLanguage} onValueChange={v => setFamilyData({...familyData, primaryLanguage: v})}>
                    <SelectTrigger className="mt-2 h-12 rounded-xl">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hindi">Hindi / हिंदी</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="bengali">Bengali / বাংলা</SelectItem>
                      <SelectItem value="tamil">Tamil / தமிழ்</SelectItem>
                      <SelectItem value="telugu">Telugu / తెలుగు</SelectItem>
                      <SelectItem value="marathi">Marathi / मराठी</SelectItem>
                      <SelectItem value="gujarati">Gujarati / ગુજરાતી</SelectItem>
                      <SelectItem value="kannada">Kannada / ಕನ್ನಡ</SelectItem>
                      <SelectItem value="malayalam">Malayalam / മലയാളം</SelectItem>
                      <SelectItem value="punjabi">Punjabi / ਪੰਜਾਬੀ</SelectItem>
                      <SelectItem value="odia">Odia / ଓଡ଼ିଆ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Dietary Type", "आहार प्रकार")}</Label>
                  <Select value={familyData.dietaryType} onValueChange={v => setFamilyData({...familyData, dietaryType: v as typeof familyData.dietaryType})}>
                    <SelectTrigger className="mt-2 h-12 rounded-xl">
                      <SelectValue placeholder="Dietary preference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vegetarian">Vegetarian / शाकाहारी</SelectItem>
                      <SelectItem value="non-vegetarian">Non-Vegetarian / मांसाहारी</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                      <SelectItem value="jain">Jain / जैन</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Cooking Time Available", "खाना पकाने का समय")}</Label>
                  <Select value={familyData.cookingTimePreference} onValueChange={v => setFamilyData({...familyData, cookingTimePreference: v as typeof familyData.cookingTimePreference})}>
                    <SelectTrigger className="mt-2 h-12 rounded-xl">
                      <SelectValue placeholder="Cooking time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quick">Quick (&lt;30 min) / जल्दी</SelectItem>
                      <SelectItem value="moderate">Moderate (30–60 min) / मध्यम</SelectItem>
                      <SelectItem value="elaborate">Elaborate (&gt;60 min) / विस्तृत</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Health Goal", "स्वास्थ्य लक्ष्य")}</Label>
                  <Select value={familyData.healthGoal} onValueChange={v => setFamilyData({...familyData, healthGoal: v as typeof familyData.healthGoal})}>
                    <SelectTrigger className="mt-2 h-12 rounded-xl">
                      <SelectValue placeholder="Health goal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general_wellness">General Wellness / सामान्य स्वास्थ्य</SelectItem>
                      <SelectItem value="weight_loss">Weight Loss / वजन घटाना</SelectItem>
                      <SelectItem value="muscle_gain">Muscle Gain / मांसपेशी बनाना</SelectItem>
                      <SelectItem value="manage_diabetes">Manage Diabetes / मधुमेह नियंत्रण</SelectItem>
                      <SelectItem value="heart_health">Heart Health / हृदय स्वास्थ्य</SelectItem>
                      <SelectItem value="manage_thyroid">Manage Thyroid / थायरॉइड नियंत्रण</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-base">{t("Fasting Days", "व्रत के दिन")} <span className="text-muted-foreground text-sm font-normal">({t("optional", "वैकल्पिक")})</span></Label>
                <p className="text-sm text-muted-foreground mb-3">{t("Select days your family regularly fasts", "परिवार किन दिनों उपवास रखता है")}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "monday", en: "Monday", hi: "सोमवार" },
                    { key: "tuesday", en: "Tuesday", hi: "मंगलवार" },
                    { key: "thursday", en: "Thursday", hi: "गुरुवार" },
                    { key: "saturday", en: "Saturday", hi: "शनिवार" },
                    { key: "ekadashi", en: "Ekadashi", hi: "एकादशी" },
                    { key: "navratri", en: "Navratri", hi: "नवरात्रि" },
                    { key: "shravan", en: "Shravan Mondays", hi: "सावन सोमवार" },
                    { key: "karva_chauth", en: "Karva Chauth", hi: "करवा चौथ" },
                  ].map(({ key, en, hi }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleFastingDay(key)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        familyData.fastingDays.includes(key)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:border-primary"
                      }`}
                    >
                      {t(en, hi)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t("Current Dietary Baseline", "वर्तमान आहार दिनचर्या")} <span className="normal-case font-normal text-muted-foreground">({t("optional — helps AI improve your meals", "वैकल्पिक — AI को आपके भोजन सुधारने में मदद मिलेगी")})</span></p>

                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setFamilyData(fd => ({ ...fd, mealsAreShared: !fd.mealsAreShared }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${familyData.mealsAreShared ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${familyData.mealsAreShared ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                  <Label className="cursor-pointer" onClick={() => setFamilyData(fd => ({ ...fd, mealsAreShared: !fd.mealsAreShared }))}>
                    {t("All family members eat the same meals", "सभी सदस्य एक जैसा खाना खाते हैं")}
                  </Label>
                </div>

                {familyData.mealsAreShared && (
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label className="text-sm">{t("Typical Breakfast", "सामान्य नाश्ता")}</Label>
                      <Textarea
                        value={familyData.sharedTypicalBreakfast}
                        onChange={e => setFamilyData(fd => ({ ...fd, sharedTypicalBreakfast: e.target.value }))}
                        placeholder={t("e.g. Paratha with curd and chai", "जैसे पराठा, दही और चाय")}
                        className="mt-1 rounded-xl bg-background resize-none"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">{t("Typical Lunch", "सामान्य दोपहर का खाना")}</Label>
                      <Textarea
                        value={familyData.sharedTypicalLunch}
                        onChange={e => setFamilyData(fd => ({ ...fd, sharedTypicalLunch: e.target.value }))}
                        placeholder={t("e.g. Dal chawal, sabzi, roti", "जैसे दाल चावल, सब्जी, रोटी")}
                        className="mt-1 rounded-xl bg-background resize-none"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">{t("Typical Dinner", "सामान्य रात का खाना")}</Label>
                      <Textarea
                        value={familyData.sharedTypicalDinner}
                        onChange={e => setFamilyData(fd => ({ ...fd, sharedTypicalDinner: e.target.value }))}
                        placeholder={t("e.g. Roti, sabzi, dal", "जैसे रोटी, सब्जी, दाल")}
                        className="mt-1 rounded-xl bg-background resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                )}

                {!familyData.mealsAreShared && (
                  <p className="text-sm text-muted-foreground bg-secondary/10 rounded-xl px-4 py-3">
                    {t("You can enter each member's individual meals on the next step.", "अगले चरण में प्रत्येक सदस्य का अलग भोजन दर्ज कर सकते हैं।")}
                  </p>
                )}
              </div>

              <div className="pt-4 flex justify-end">
                <Button 
                  size="lg" 
                  className="rounded-xl h-12 px-8" 
                  onClick={() => setStep(2)}
                  disabled={!familyData.name}
                >
                  {t("Next Step", "अगला कदम")} <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {members.map((member, idx) => (
              <div key={member._id} className="bg-white rounded-3xl p-6 shadow-sm border border-border relative">
                {members.length > 1 && (
                  <button onClick={() => handleRemoveMember(idx)} className="absolute top-4 right-4 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                
                <h3 className="font-display font-bold text-lg mb-4">{t("Member", "सदस्य")} #{idx + 1}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label>{t("Name", "नाम")} <span className="text-destructive">*</span></Label>
                    <Input 
                      value={member.name} 
                      onChange={e => {
                        handleUpdateMember(idx, "name", e.target.value);
                        if (memberErrors[member._id]?.name) setMemberErrors(prev => ({ ...prev, [member._id]: { ...prev[member._id], name: undefined } }));
                      }}
                      className={`mt-1 ${memberErrors[member._id]?.name ? "border-destructive" : ""}`}
                    />
                    {memberErrors[member._id]?.name && <p className="text-xs text-destructive mt-1">{memberErrors[member._id].name}</p>}
                  </div>
                  <div>
                    <Label>{t("Role", "संबंध")}</Label>
                    <Select value={member.role} onValueChange={v => handleUpdateMember(idx, "role", v)}>
                      <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="father">{t("Father", "पिता")}</SelectItem>
                        <SelectItem value="mother">{t("Mother", "माँ")}</SelectItem>
                        <SelectItem value="spouse">{t("Spouse", "जीवनसाथी")}</SelectItem>
                        <SelectItem value="child">{t("Child", "बच्चा")}</SelectItem>
                        <SelectItem value="grandparent">{t("Grandparent", "दादा-दादी")}</SelectItem>
                        <SelectItem value="other">{t("Other", "अन्य")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>{t("Age", "आयु")} <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      value={member.age}
                      onChange={e => {
                        const val = e.target.value === "" ? "" : parseInt(e.target.value);
                        handleUpdateMember(idx, "age", val as number | "");
                        if (memberErrors[member._id]?.age) setMemberErrors(prev => ({ ...prev, [member._id]: { ...prev[member._id], age: undefined } }));
                      }}
                      className={`mt-1 ${memberErrors[member._id]?.age ? "border-destructive" : ""}`}
                    />
                    {memberErrors[member._id]?.age && <p className="text-xs text-destructive mt-1">{memberErrors[member._id].age}</p>}
                  </div>
                  <div>
                    <Label>{t("Weight (kg)", "वजन (किग्रा)")}</Label>
                    <Input type="number" value={member.weightKg} onChange={e => handleUpdateMember(idx, "weightKg", parseInt(e.target.value) || 60)} className="mt-1" />
                  </div>
                  <div>
                    <Label>{t("Height (cm)", "ऊंचाई (सेमी)")}</Label>
                    <Input type="number" value={member.heightCm} onChange={e => handleUpdateMember(idx, "heightCm", parseInt(e.target.value) || 160)} className="mt-1" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Auto-assignment notice for children */}
                  {Number(member.age) > 0 && Number(member.age) < 13 && (
                    <div className="col-span-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
                      <span className="shrink-0 mt-0.5">🤖</span>
                      <span>
                        {Number(member.age) < 5
                          ? t("Goal auto-set: Early Childhood Nutrition (age <5)", "लक्ष्य स्वतः: शैशव पोषण (आयु <5)")
                          : t("Goal auto-set: Healthy Growth & School Nutrition (age 5–12)", "लक्ष्य स्वतः: स्वस्थ विकास (आयु 5–12)")}
                      </span>
                    </div>
                  )}
                  {/* Teenager guardrail notice */}
                  {Number(member.age) >= 13 && Number(member.age) <= 17 && (
                    <div className="col-span-2 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-800">
                      <span className="shrink-0 mt-0.5">🔒</span>
                      <span>{t("Calorie deficit goals (weight loss) are not available for ages 13–17 per Responsible AI guidelines.", "13–17 वर्ष के लिए कैलोरी घाटा लक्ष्य Responsible AI नियमों के अनुसार उपलब्ध नहीं है।")}</span>
                    </div>
                  )}
                  {/* Health Goal — hidden for age <5 (auto early childhood) and age 5-12 (auto healthy growth) */}
                  {Number(member.age) >= 13 && (
                  <div>
                    <Label className="text-sm font-semibold">{t("Health Goal", "स्वास्थ्य लक्ष्य")}</Label>
                    <Select value={member.healthGoal} onValueChange={v => handleUpdateMember(idx, "healthGoal", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general_wellness">{t("General Wellness", "सामान्य स्वास्थ्य")}</SelectItem>
                        {/* Weight loss hidden for age 13–17 (Responsible AI guardrail) */}
                        {Number(member.age) >= 18 && (
                          <SelectItem value="weight_loss">{t("Weight Loss", "वजन घटाना")}</SelectItem>
                        )}
                        <SelectItem value="manage_diabetes">{t("Manage Diabetes", "मधुमेह नियंत्रण")}</SelectItem>
                        <SelectItem value="anemia_recovery">{t("Anemia Recovery", "रक्ताल्पता")}</SelectItem>
                        <SelectItem value="heart_health">{t("Heart Health", "हृदय स्वास्थ्य")}</SelectItem>
                        {Number(member.age) >= 18 && (
                          <SelectItem value="muscle_gain">{t("Muscle Gain", "मांसपेशी वृद्धि")}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  )}
                  <div>
                    <Label className="text-sm font-semibold">{t("Dietary Type", "आहार प्रकार")}</Label>
                    <Select value={member.dietaryType} onValueChange={v => handleUpdateMember(idx, "dietaryType", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vegetarian">{t("Vegetarian", "शाकाहारी")}</SelectItem>
                        <SelectItem value="non-vegetarian">{t("Non-Vegetarian", "मांसाहारी")}</SelectItem>
                        <SelectItem value="vegan">{t("Vegan", "शुद्ध शाकाहारी")}</SelectItem>
                        <SelectItem value="jain">{t("Jain", "जैन")}</SelectItem>
                        <SelectItem value="eggetarian">{t("Eggetarian", "अंडाहारी")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">{t("Health Conditions", "स्वास्थ्य स्थितियां")}</Label>
                    {[
                      { id: 'diabetes', en: 'Diabetes', hi: 'मधुमेह' },
                      { id: 'hypertension', en: 'Hypertension', hi: 'उच्च रक्तचाप' },
                      { id: 'obesity', en: 'Obesity', hi: 'मोटापा' },
                      { id: 'anemia', en: 'Anemia', hi: 'रक्ताल्पता' },
                      { id: 'thyroid', en: 'Thyroid', hi: 'थायरॉइड' },
                      { id: 'high_cholesterol', en: 'High Cholesterol', hi: 'उच्च कोलेस्ट्रॉल' },
                      { id: 'pcod', en: 'PCOD', hi: 'पीसीओडी' },
                      { id: 'growing_child', en: 'Growing Child', hi: 'बढ़ता बच्चा' },
                      { id: 'elderly', en: 'Elderly (60+)', hi: 'बुजुर्ग (60+)' },
                      { id: 'none', en: 'None', hi: 'कोई नहीं' },
                    ].map(({ id: cond, en, hi }) => (
                      <div key={cond} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`${member._id}-${cond}`}
                          checked={member.healthConditions.includes(cond)}
                          onCheckedChange={() => toggleMemberCondition(idx, cond)}
                        />
                        <Label htmlFor={`${member._id}-${cond}`}>{t(en, hi)}</Label>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">{t("Fasting Days", "उपवास के दिन")}</Label>
                    {[
                      { id: "monday", en: "Monday", hi: "सोमवार" },
                      { id: "tuesday", en: "Tuesday", hi: "मंगलवार" },
                      { id: "thursday", en: "Thursday", hi: "गुरुवार" },
                      { id: "friday", en: "Friday", hi: "शुक्रवार" },
                      { id: "saturday", en: "Saturday", hi: "शनिवार" },
                      { id: "ekadashi", en: "Ekadashi", hi: "एकादशी" },
                      { id: "ramadan", en: "Ramadan", hi: "रमजान" },
                      { id: "none", en: "None", hi: "कोई नहीं" },
                    ].map(({ id: day, en, hi }) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${member._id}-fasting-${day}`}
                          checked={member.memberFastingDays.includes(day)}
                          onCheckedChange={() => toggleMemberFasting(idx, day)}
                        />
                        <Label htmlFor={`${member._id}-fasting-${day}`} className="text-xs">{t(en, hi)}</Label>
                      </div>
                    ))}

                    <div className="pt-2">
                      <Label className="text-sm font-semibold">{t("Food Allergies", "खाद्य एलर्जी")} <span className="font-normal text-muted-foreground">({t("optional", "वैकल्पिक")})</span></Label>
                      <Input
                        value={member.foodAllergies}
                        onChange={e => handleUpdateMember(idx, "foodAllergies", e.target.value)}
                        placeholder={t("e.g. peanuts, milk, gluten", "जैसे मूंगफली, दूध, ग्लूटन")}
                        className="mt-1 text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{t("Separate multiple with commas", "कई एलर्जी को कॉमा से अलग करें")}</p>
                    </div>
                  </div>
                </div>

                {/* ── Advanced Profile Fields ── */}
                <div className="mt-4 pt-4 border-t border-dashed border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t("Advanced Profile", "विस्तृत प्रोफाइल")}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Goal Pace — shown only for weight loss/gain goals, hidden for minors */}
                    {(member.healthGoal === "weight_loss" || member.healthGoal === "muscle_gain") && Number(member.age) >= 18 && (
                    <div>
                      <Label className="text-sm font-semibold">{t("Goal Pace", "लक्ष्य गति")}</Label>
                      <Select value={member.goalPace} onValueChange={v => handleUpdateMember(idx, "goalPace", v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("No specific pace", "कोई लक्ष्य नहीं")}</SelectItem>
                          <SelectItem value="0.25">{t("Gentle (0.25 kg/week)", "धीमा (0.25 किग्रा/हफ्ता)")}</SelectItem>
                          <SelectItem value="0.5">{t("Moderate (0.5 kg/week)", "मध्यम (0.5 किग्रा/हफ्ता)")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    )}
                    <div>
                      <Label className="text-sm font-semibold">{t("Tiffin Type", "टिफिन प्रकार")}</Label>
                      <Select value={member.tiffinType} onValueChange={v => handleUpdateMember(idx, "tiffinType", v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("Not required", "नहीं")}</SelectItem>
                          <SelectItem value="school">{t("School Tiffin", "स्कूल टिफिन")}</SelectItem>
                          <SelectItem value="office">{t("Office Tiffin", "ऑफिस टिफिन")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">{t("Religious / Cultural Rules", "धार्मिक नियम")}</Label>
                      <Select value={member.religiousRules} onValueChange={v => handleUpdateMember(idx, "religiousRules", v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("None", "कोई नहीं")}</SelectItem>
                          <SelectItem value="jain">{t("Jain (no root veg)", "जैन (मूल सब्जी नहीं)")}</SelectItem>
                          <SelectItem value="no_beef">{t("Hindu (no beef)", "हिंदू (गोमांस नहीं)")}</SelectItem>
                          <SelectItem value="no_pork">{t("Halal / No Pork", "हलाल / सूअर नहीं")}</SelectItem>
                          <SelectItem value="sattvic">{t("Sattvic (no onion/garlic)", "सात्विक (प्याज/लहसुन नहीं)")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-sm font-semibold">
                        {t("Ingredient Dislikes", "पसंद न आने वाली चीजें")}
                        <span className="text-muted-foreground font-normal text-xs ml-1">({t("max 5", "अधिकतम 5")})</span>
                      </Label>
                      <div className="mt-1 flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-xl border border-input bg-background">
                        {member.ingredientDislikes.map((d, di) => (
                          <span key={di} className="flex items-center gap-1 bg-orange-100 text-orange-800 text-[11px] font-medium px-2 py-0.5 rounded-full border border-orange-200">
                            {d}
                            <button type="button" onClick={() => handleUpdateMember(idx, "ingredientDislikes", member.ingredientDislikes.filter((_, i) => i !== di))} className="text-orange-500 hover:text-orange-800 ml-0.5 font-bold leading-none">×</button>
                          </span>
                        ))}
                        {member.ingredientDislikes.length < 5 && (
                          <input
                            type="text"
                            value={dislikeInputs[idx] ?? ""}
                            onChange={e => setDislikeInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                            onKeyDown={e => {
                              if ((e.key === "Enter" || e.key === ",") && (dislikeInputs[idx] ?? "").trim()) {
                                e.preventDefault();
                                const val = (dislikeInputs[idx] ?? "").trim().replace(/,$/, "");
                                if (val && !member.ingredientDislikes.includes(val)) {
                                  handleUpdateMember(idx, "ingredientDislikes", [...member.ingredientDislikes, val]);
                                }
                                setDislikeInputs(prev => ({ ...prev, [idx]: "" }));
                              }
                            }}
                            placeholder={member.ingredientDislikes.length === 0 ? t("e.g. karela, fish", "जैसे करेला, मछली") : t("Add more...", "और जोड़ें...")}
                            className="flex-1 min-w-[120px] text-[12px] bg-transparent outline-none placeholder:text-muted-foreground/50"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Non-veg days (only show if non-vegetarian) */}
                  {(member.dietaryType === "non-vegetarian") && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-semibold">{t("Non-Veg Days", "मांसाहार के दिन")}</Label>
                        <div className="mt-2 space-y-1.5">
                          {[
                            { id: "monday", en: "Monday", hi: "सोमवार" },
                            { id: "tuesday", en: "Tuesday", hi: "मंगलवार" },
                            { id: "wednesday", en: "Wednesday", hi: "बुधवार" },
                            { id: "thursday", en: "Thursday", hi: "गुरुवार" },
                            { id: "friday", en: "Friday", hi: "शुक्रवार" },
                            { id: "saturday", en: "Saturday", hi: "शनिवार" },
                            { id: "sunday", en: "Sunday", hi: "रविवार" },
                          ].map(({ id, en, hi }) => (
                            <div key={id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`setup-nvday-${idx}-${id}`}
                                checked={member.nonVegDays.includes(id)}
                                onCheckedChange={() => {
                                  const current = member.nonVegDays;
                                  handleUpdateMember(idx, "nonVegDays", current.includes(id) ? current.filter(d => d !== id) : [...current, id]);
                                }}
                              />
                              <Label htmlFor={`setup-nvday-${idx}-${id}`} className="text-sm">{t(en, hi)}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold">{t("Non-Veg Types", "मांसाहार प्रकार")}</Label>
                        <div className="mt-2 space-y-1.5">
                          {[
                            { id: "chicken", en: "Chicken", hi: "चिकन" },
                            { id: "mutton", en: "Mutton", hi: "मटन" },
                            { id: "fish", en: "Fish", hi: "मछली" },
                            { id: "eggs", en: "Eggs", hi: "अंडे" },
                          ].map(({ id, en, hi }) => (
                            <div key={id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`setup-nvtype-${idx}-${id}`}
                                checked={member.nonVegTypes.includes(id)}
                                onCheckedChange={() => {
                                  const current = member.nonVegTypes;
                                  handleUpdateMember(idx, "nonVegTypes", current.includes(id) ? current.filter(tp => tp !== id) : [...current, id]);
                                }}
                              />
                              <Label htmlFor={`setup-nvtype-${idx}-${id}`} className="text-sm">{t(en, hi)}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {!familyData.mealsAreShared && (
                  <div className="mt-4 pt-4 border-t border-dashed border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t("Individual Meal Baseline", "व्यक्तिगत भोजन दिनचर्या")} <span className="normal-case font-normal">({t("optional", "वैकल्पिक")})</span></p>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label className="text-sm">{t("Typical Breakfast", "सामान्य नाश्ता")}</Label>
                        <Textarea
                          value={member.individualTypicalBreakfast}
                          onChange={e => handleUpdateMember(idx, "individualTypicalBreakfast", e.target.value)}
                          placeholder={t("e.g. Poha and tea", "जैसे पोहा और चाय")}
                          className="mt-1 rounded-xl text-sm resize-none"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label className="text-sm">{t("Typical Lunch", "सामान्य दोपहर का खाना")}</Label>
                        <Textarea
                          value={member.individualTypicalLunch}
                          onChange={e => handleUpdateMember(idx, "individualTypicalLunch", e.target.value)}
                          placeholder={t("e.g. Tiffin box with rice and sabzi", "जैसे टिफिन बॉक्स")}
                          className="mt-1 rounded-xl text-sm resize-none"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label className="text-sm">{t("Typical Dinner", "सामान्य रात का खाना")}</Label>
                        <Textarea
                          value={member.individualTypicalDinner}
                          onChange={e => handleUpdateMember(idx, "individualTypicalDinner", e.target.value)}
                          placeholder={t("e.g. Light roti and dal", "जैसे रोटी और दाल")}
                          className="mt-1 rounded-xl text-sm resize-none"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Button 
              type="button" 
              variant="outline" 
              onClick={handleAddMember}
              disabled={members.length >= 5}
              className="w-full h-14 rounded-2xl border-dashed border-2 text-muted-foreground hover:text-primary hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5 mr-2" />
              {members.length >= 5 ? t("Maximum 5 members reached", "अधिकतम 5 सदस्य") : t("Add Another Member", "एक और सदस्य जोड़ें")}
            </Button>

            <div className="flex justify-between pt-6">
              <Button variant="ghost" size="lg" className="rounded-xl" onClick={() => setStep(1)}>
                <ArrowLeft className="w-5 h-5 mr-2" /> {t("Back", "वापस")}
              </Button>
              <Button size="lg" className="rounded-xl px-8" onClick={handleSave} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                {t("Save Family Profile", "परिवार प्रोफ़ाइल सेव करें")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <VoiceAssistantModal
        open={voiceModalOpen}
        language={familyData.primaryLanguage}
        onClose={handleVoiceClose}
        onComplete={handleVoiceComplete}
      />
    </div>
  );
}
