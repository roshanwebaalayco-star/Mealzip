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
import { useLanguageStore } from "@/store/useLanguageStore";
import type { IMemberProfileFields } from "@/components/MemberEditSheet";

type MemberDraft = {
  _id: number;
  name: string;
  age: number | "";
  gender: string;
  weightKg?: number;
  heightCm?: number;
  activityLevel?: string;
  dietaryType: string;
  healthConditions: string[];
  ingredientDislikes: string[];
  healthGoal: string;
  primaryGoal?: string;
  goalPace?: string;
  tiffinNeeded?: string;
  religiousCulturalRules?: string;
  nonVegDays: string[];
  nonVegTypes: string[];
  memberFastingDays: string[];
  foodAllergies: string;
  spiceTolerance: string;
  ekadashi: boolean;
  festivalFastingAlerts: boolean;
  activeMedications?: string;
  insulinType?: string;
  ckdStage?: string;
  pregnancyStage?: string;
};

type MemberErrors = { name?: string; age?: string; weightKg?: string; heightCm?: string; gender?: string };

let _memberIdCounter = 0;

export default function FamilySetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { currentLanguage: globalLang, setLanguage: setGlobalLang } = useLanguageStore();
  const queryClient = useQueryClient();
  const createFamily = useCreateFamily();
  const addMember = useAddFamilyMember();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberErrors, setMemberErrors] = useState<Record<number, MemberErrors>>({});

  const [familyData, setFamilyData] = useState({
    name: "",
    stateRegion: "Jharkhand",
    languagePreference: "hindi",
    householdDietaryBaseline: "mixed" as string,
    cookingTimePreference: "moderate" as "quick" | "moderate" | "elaborate",
    dietaryType: "non_veg" as "strictly_veg" | "veg_with_eggs" | "non_veg" | "mixed",
    healthGoal: "maintain" as "maintain" | "weight_loss" | "weight_gain" | "build_muscle" | "manage_condition" | "senior_nutrition",
    fastingDays: [] as string[],
    appliances: ["tawa", "pressure_cooker", "kadai"] as string[],
    cookingSkillLevel: "intermediate" as "beginner" | "intermediate" | "experienced",
    mealsPerDay: "3_meals" as string,
    pincode: "",
  });

  const [members, setMembers] = useState<MemberDraft[]>([
    {
      _id: ++_memberIdCounter, name: "", age: 35, gender: "male", weightKg: undefined, heightCm: undefined,
      activityLevel: "moderately_active", healthConditions: [], healthGoal: "maintain",
      dietaryType: "non_vegetarian", memberFastingDays: [], foodAllergies: "",
      goalPace: "none", tiffinNeeded: "no", religiousCulturalRules: "none",
      ingredientDislikes: [], nonVegDays: [], nonVegTypes: [],
      spiceTolerance: "medium", ekadashi: false, festivalFastingAlerts: false,
    }
  ]);

  const DRAFT_KEY = "nutrinext_family_setup_draft";
  const DRAFT_VERSION = 3;

  const sanitizeMealsPerDay = (m: unknown): string => {
    if (typeof m === "number") {
      if (m === 2) return "2_meals";
      if (m === 4) return "3_meals_plus_snacks";
      return "3_meals";
    }
    if (typeof m === "string") {
      if (m === "2") return "2_meals";
      if (m === "4") return "3_meals_plus_snacks";
      if (m === "3") return "3_meals";
      if (m.includes("_meals") || m.includes("_snacks")) return m;
    }
    return "3_meals";
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft._version !== DRAFT_VERSION) {
          localStorage.removeItem(DRAFT_KEY);
          return;
        }
        if (draft.familyData) {
          const fd = draft.familyData as Record<string, unknown>;
          const sanitized = {
            ...fd,
            stateRegion: typeof fd.stateRegion === "string" && fd.stateRegion.trim() ? fd.stateRegion : "Jharkhand",
            mealsPerDay: sanitizeMealsPerDay(fd.mealsPerDay),
            householdDietaryBaseline: typeof fd.householdDietaryBaseline === "string" && fd.householdDietaryBaseline ? fd.householdDietaryBaseline : "mixed",
            cookingSkillLevel: typeof fd.cookingSkillLevel === "string" && fd.cookingSkillLevel ? fd.cookingSkillLevel : "intermediate",
            languagePreference: typeof fd.languagePreference === "string" && fd.languagePreference ? fd.languagePreference : "hindi",
          };
          setFamilyData(prev => ({ ...prev, ...sanitized }));
        }
        if (draft.members && Array.isArray(draft.members) && draft.members.length > 0) {
          setMembers(draft.members.map((m: any) => ({ ...m, _id: ++_memberIdCounter })));
        }
        if (draft.step) setStep(draft.step);
      }
    } catch { localStorage.removeItem(DRAFT_KEY); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ _version: DRAFT_VERSION, familyData, members, step }));
      } catch { /* quota exceeded — ignore */ }
    }, 1000);
    return () => clearTimeout(timer);
  }, [familyData, members, step]);

  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };

  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  const CHAT_LANGUAGES = INDIAN_LANGUAGES.map(l => ({
    key: l.key,
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
      if (data.isComplete && !data.extractedData) {
        setChatMessages(prev => [...prev, { role: "model", content: "Almost done! I need to collect a bit more info. Could you tell me your family name and at least one member's name and age to complete the profile?" }]);
        return;
      }
      if (data.isComplete && data.extractedData) {
        const p = data.extractedData as {
          familyName?: string;
          stateRegion?: string;
          state?: string;
          dietaryType?: string;
          householdDietaryBaseline?: string;
          appliances?: string[];
          members?: Array<{ name?: string; age?: number; gender?: string; role?: string; healthConditions?: string[] }>;
        };
        const ep = p as Record<string, unknown>;
        const newFamilyData = {
          ...familyData,
          ...(p.familyName ? { name: p.familyName } : {}),
          ...(p.stateRegion || p.state ? { stateRegion: (p.stateRegion || p.state)! } : {}),
          ...(p.householdDietaryBaseline ? { householdDietaryBaseline: p.householdDietaryBaseline as typeof familyData.householdDietaryBaseline } : {}),
          ...(p.dietaryType ? { dietaryType: p.dietaryType as typeof familyData.dietaryType } : {}),
          ...(p.appliances ? { appliances: p.appliances } : {}),
          ...(ep.cookingSkillLevel ? { cookingSkillLevel: ep.cookingSkillLevel as typeof familyData.cookingSkillLevel } : {}),
          ...(ep.mealsPerDay ? { mealsPerDay: String(ep.mealsPerDay) } : {}),
        };
        const newMembers: MemberDraft[] = (p.members ?? []).filter(m => m.name).map(m => ({
          _id: ++_memberIdCounter,
          name: m.name ?? "",
          age: m.age ?? 25,
          gender: m.gender ?? "male",
          weightKg: undefined,
          heightCm: undefined,
          activityLevel: (m as Record<string,unknown>).activityLevel as string ?? "moderately_active",
          healthConditions: m.healthConditions ?? [],
          ingredientDislikes: [],
          nonVegDays: ((m as Record<string,unknown>).occasionalNonvegDays as string[]) ?? [],
          nonVegTypes: ((m as Record<string,unknown>).occasionalNonvegTypes as string[]) ?? [],
          goalPace: "none",
          tiffinNeeded: "no",
          religiousCulturalRules: "none",
          healthGoal: ((m as Record<string,unknown>).healthGoal as string) ?? "maintain",
          dietaryType: ((m as Record<string,unknown>).dietaryType as string) ?? "non_vegetarian",
          memberFastingDays: [],
          foodAllergies: "",
          spiceTolerance: ((m as Record<string,unknown>).spiceTolerance as string) ?? "medium",
          ekadashi: false,
          festivalFastingAlerts: false,
        }));
        if (!newFamilyData.name) {
          setChatMessages(prev => [...prev, { role: "model", content: "Sorry, I couldn't extract the family name. Please type your family name and try again." }]);
          return;
        }
        if (newMembers.length === 0) {
          setChatMessages(prev => [...prev, { role: "model", content: "I need at least one family member's name to complete the profile. Please tell me one member's name and age." }]);
          return;
        }
        setFamilyData(newFamilyData);
        setMembers(newMembers);
        setChatComplete(true);
        await executeSave(newFamilyData, newMembers, "/pantry-scan", 1);
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "model", content: "Sorry, I had trouble responding. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const startChat = async (lang: string) => {
    setChatLang(lang);
    setGlobalLang(lang);
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
      _id: ++_memberIdCounter, name: "", age: 25, gender: "female", weightKg: undefined, heightCm: undefined,
      activityLevel: "moderately_active", healthConditions: [], healthGoal: "maintain",
      dietaryType: "non_vegetarian", memberFastingDays: [], foodAllergies: "",
      goalPace: "none", tiffinNeeded: "no", religiousCulturalRules: "none",
      ingredientDislikes: [], nonVegDays: [], nonVegTypes: [],
      spiceTolerance: "medium", ekadashi: false, festivalFastingAlerts: false,
    }]);
  };

  const toggleMemberCondition = (idx: number, cond: string) => {
    const current = members[idx].healthConditions;
    let next: string[];
    if (cond === "none") {
      next = current.includes("none") ? [] : ["none"];
    } else {
      const without = current.filter(c => c !== "none");
      if (without.includes(cond)) {
        next = without.filter(c => c !== cond);
      } else if (without.length >= 4) {
        return;
      } else {
        next = [...without, cond];
      }
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
    if (field === "age") {
      const age = Number(value);
      if (age > 0 && age < 5) {
        updated[index].healthGoal = "healthy_growth";
      } else if (age >= 5 && age <= 12) {
        updated[index].healthGoal = "healthy_growth";
      } else if (age >= 13 && age < 18) {
        if (updated[index].healthGoal === "weight_loss") {
          updated[index].healthGoal = "maintain";
        }
      } else if (age >= 60) {
        if (updated[index].healthGoal === "maintain") {
          updated[index].healthGoal = "senior_nutrition";
        }
      }
    }
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

  const executeSave = async (fd: typeof familyData, mems: MemberDraft[], redirectTo = "/pantry-scan", minMembers = 1) => {
    if (!fd.name) {
      toast({ title: "Error", description: "Family name is required", variant: "destructive" });
      return;
    }
    if (!fd.stateRegion || !fd.stateRegion.trim()) {
      toast({ title: "Error", description: "Please select your state", variant: "destructive" });
      return;
    }

    const errors: Record<number, MemberErrors> = {};
    mems.forEach((m) => {
      const e: MemberErrors = {};
      if (!m.name.trim()) e.name = "Name is required";
      if (m.age === "" || m.age <= 0 || !Number.isFinite(Number(m.age))) e.age = "Enter a valid age";
      if (typeof m.age === "number" && m.age > 120) e.age = "Age cannot exceed 120 years";
      if (Object.keys(e).length > 0) errors[m._id] = e;
    });
    if (Object.keys(errors).length > 0) {
      setMemberErrors(errors);
      return;
    }
    setMemberErrors({});

    if (mems.length < minMembers) {
      toast({ title: "At least 1 member required", description: "Please add at least one family member before saving.", variant: "destructive" });
      return;
    }
    if (mems.length > 8) {
      toast({ title: "Maximum 8 members", description: "Please remove some members to continue (family limit: 8).", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const fam = await createFamily.mutateAsync({
        data: {
          name: fd.name,
          stateRegion: (typeof fd.stateRegion === "string" && fd.stateRegion.trim()) ? fd.stateRegion.trim() : "Jharkhand",
          languagePreference: fd.languagePreference || "hindi",
          householdDietaryBaseline: fd.householdDietaryBaseline || "mixed",
          mealsPerDay: sanitizeMealsPerDay(fd.mealsPerDay),
          cookingSkillLevel: fd.cookingSkillLevel || "intermediate",
          appliances: Array.isArray(fd.appliances) ? fd.appliances : ["tawa", "pressure_cooker", "kadai"],
          pincode: fd.pincode || undefined,
        },
      });

      for (const member of mems) {
        if (member.name) {
          const allergyList = member.foodAllergies
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);
          const occasionalNonvegConfig = member.nonVegDays.length > 0 || member.nonVegTypes.length > 0
            ? { days: member.nonVegDays, types: member.nonVegTypes }
            : undefined;
          const fastingConfig = member.memberFastingDays.length > 0 || member.ekadashi
            ? { baselineDays: member.memberFastingDays, ekadashi: member.ekadashi }
            : undefined;
          const religiousCulturalRules = member.religiousCulturalRules && member.religiousCulturalRules !== "none"
            ? { primary: member.religiousCulturalRules }
            : undefined;
          await addMember.mutateAsync({
            familyId: fam.id,
            data: {
              name: member.name,
              age: Number(member.age),
              gender: member.gender,
              weightKg: member.weightKg,
              heightCm: member.heightCm,
              activityLevel: member.activityLevel ?? "lightly_active",
              healthConditions: member.healthConditions.filter(c => c !== "none"),
              allergies: allergyList,
              ingredientDislikes: member.ingredientDislikes.length > 0 ? member.ingredientDislikes : undefined,
              primaryGoal: member.healthGoal !== "maintain" ? member.healthGoal : undefined,
              goalPace: member.goalPace !== "none" ? member.goalPace : undefined,
              dietaryType: member.dietaryType ?? "strictly_vegetarian",
              tiffinNeeded: member.tiffinNeeded !== "no" ? member.tiffinNeeded : "no",
              spiceTolerance: member.spiceTolerance,
              festivalFastingAlerts: member.festivalFastingAlerts || undefined,
              occasionalNonvegConfig,
              fastingConfig,
              religiousCulturalRules,
              activeMedications: member.activeMedications || undefined,
              insulinType: member.insulinType || undefined,
              ckdStage: member.ckdStage || undefined,
              pregnancyStage: member.pregnancyStage || undefined,
            }
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      clearDraft();
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
    const vd = voiceData as Record<string, unknown>;
    const normalizeMeals = (m: unknown): string => {
      if (m === 2 || m === "2") return "2_meals";
      if (m === 3 || m === "3") return "3_meals";
      if (m === 4 || m === "4") return "3_meals_plus_snacks";
      if (typeof m === "string" && m.includes("meals")) return m;
      return "3_meals";
    };
    const mergedFamilyData = {
      ...familyData,
      ...(voiceData.familyName ? { name: voiceData.familyName } : {}),
      ...(voiceData.state ? { stateRegion: voiceData.state } : {}),
      ...(voiceData.dietaryType
        ? { householdDietaryBaseline: voiceData.dietaryType as typeof familyData.householdDietaryBaseline }
        : {}),
      ...(vd.appliances ? { appliances: vd.appliances as string[] } : {}),
      ...(voiceData.cookingSkill ? { cookingSkillLevel: voiceData.cookingSkill as typeof familyData.cookingSkillLevel } : {}),
      ...(vd.mealsPerDay ? { mealsPerDay: normalizeMeals(vd.mealsPerDay) } : {}),
    };

    const voiceMembers: MemberDraft[] = (voiceData.members ?? [])
      .filter(m => m.name)
      .map(m => ({
        _id: ++_memberIdCounter,
        name: m.name ?? "",
        age: m.age ?? 25,
        gender: m.gender ?? "male",
        weightKg: undefined,
        heightCm: undefined,
        activityLevel: (m as Record<string,unknown>).activityLevel as string ?? "moderately_active",
        healthConditions: m.healthConditions ?? [],
        healthGoal: m.healthGoal ?? "maintain",
        dietaryType: ((m as Record<string,unknown>).dietaryType as string) ?? "non_vegetarian",
        memberFastingDays: [],
        foodAllergies: "",
        goalPace: "none", tiffinNeeded: "no", religiousCulturalRules: "none",
        ingredientDislikes: [],
        nonVegDays: ((m as Record<string,unknown>).occasionalNonvegDays as string[]) ?? [],
        nonVegTypes: ((m as Record<string,unknown>).occasionalNonvegTypes as string[]) ?? [],
        spiceTolerance: ((m as Record<string,unknown>).spiceTolerance as string) ?? "medium",
        ekadashi: false, festivalFastingAlerts: false,
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
    const normalizeMeals = (m: unknown): string => {
      if (m === 2 || m === "2") return "2_meals";
      if (m === 3 || m === "3") return "3_meals";
      if (m === 4 || m === "4") return "3_meals_plus_snacks";
      if (typeof m === "string" && m.includes("meals")) return m;
      return "3_meals";
    };
    setFamilyData(prev => ({
      ...prev,
      ...(partialData.familyName ? { name: partialData.familyName } : {}),
      ...(partialData.state ? { stateRegion: partialData.state } : {}),
      ...(partialData.dietaryType
        ? { householdDietaryBaseline: partialData.dietaryType as typeof familyData.householdDietaryBaseline }
        : {}),
      ...(partialData.cookingSkill ? { cookingSkillLevel: partialData.cookingSkill as typeof familyData.cookingSkillLevel } : {}),
      ...(partialData.mealsPerDay ? { mealsPerDay: normalizeMeals(partialData.mealsPerDay) } : {}),
    }));
    if (partialData.members && partialData.members.length > 0) {
      setMembers(partialData.members
        .filter(m => m.name)
        .map(m => ({
          _id: ++_memberIdCounter,
          name: m.name ?? "",
          age: m.age ?? 25,
          gender: m.gender ?? "male",
          weightKg: undefined,
          heightCm: undefined,
          activityLevel: (m as Record<string,unknown>).activityLevel as string ?? "moderately_active",
          healthConditions: m.healthConditions ?? [],
          ingredientDislikes: [],
          nonVegDays: ((m as Record<string,unknown>).occasionalNonvegDays as string[]) ?? [],
          nonVegTypes: ((m as Record<string,unknown>).occasionalNonvegTypes as string[]) ?? [],
          goalPace: "none",
          tiffinNeeded: "no",
          religiousCulturalRules: "none",
          healthGoal: ((m as Record<string,unknown>).healthGoal as string) ?? "maintain",
          dietaryType: ((m as Record<string,unknown>).dietaryType as string) ?? "non_vegetarian",
          memberFastingDays: [],
          foodAllergies: "",
          spiceTolerance: ((m as Record<string,unknown>).spiceTolerance as string) ?? "medium",
          ekadashi: false,
          festivalFastingAlerts: false,
        }))
      );
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto animate-fade-up">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold" style={{ letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
          {step === 1 ? t("Family Details", "परिवार का विवरण") : step === 2 ? t("Family Members", "सदस्य") : t("Review & Save", "समीक्षा और सेव")}
        </h1>
        <div className="flex gap-2 mt-4">
          <div className={`h-2 flex-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-2 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-2 flex-1 rounded-full ${step >= 3 ? "bg-primary" : "bg-muted"}`} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span className={step === 1 ? "text-primary font-medium" : ""}>{t("Step 1: Family", "चरण 1: परिवार")}</span>
          <span className={step === 2 ? "text-primary font-medium" : ""}>{t("Step 2: Members", "चरण 2: सदस्य")}</span>
          <span className={step === 3 ? "text-primary font-medium" : ""}>{t("Step 3: Review", "चरण 3: समीक्षा")}</span>
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
                      onClick={() => {
                        setChatOpen(true);
                        setChatLang(null);
                        setChatMessages([]);
                        setChatComplete(false);
                      }}
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
                                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                                  l.key === globalLang
                                    ? "bg-secondary/20 border-secondary text-secondary-foreground ring-1 ring-secondary/40"
                                    : "bg-white border-secondary/30 hover:bg-secondary/10 hover:border-secondary/60"
                                }`}
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
                  <Select value={familyData.stateRegion} onValueChange={v => setFamilyData({...familyData, stateRegion: v})}>
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
                      <SelectItem value="Uttar Pradesh">Uttar Pradesh</SelectItem>
                      <SelectItem value="Uttarakhand">Uttarakhand</SelectItem>
                      <SelectItem value="West Bengal">West Bengal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Primary Language", "मुख्य भाषा")}</Label>
                  <Select value={familyData.languagePreference} onValueChange={v => setFamilyData({...familyData, languagePreference: v})}>
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
                  <Label>{t("Household Dietary Baseline", "घरेलू आहार प्रकार")}</Label>
                  <Select value={familyData.householdDietaryBaseline} onValueChange={v => setFamilyData({...familyData, householdDietaryBaseline: v as typeof familyData.householdDietaryBaseline})}>
                    <SelectTrigger className="mt-2 h-12 rounded-xl">
                      <SelectValue placeholder="Dietary preference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strictly_veg">{t("Strictly Vegetarian", "पूर्ण शाकाहारी")}</SelectItem>
                      <SelectItem value="veg_with_eggs">{t("Vegetarian with Eggs", "अंडे के साथ शाकाहारी")}</SelectItem>
                      <SelectItem value="non_veg">{t("Non-Vegetarian", "मांसाहारी")}</SelectItem>
                      <SelectItem value="mixed">{t("Mixed (varies by member)", "मिश्रित (सदस्य के अनुसार)")}</SelectItem>
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
                  <Label>{t("Cooking Skill", "पाक कौशल")}</Label>
                  <Select value={familyData.cookingSkillLevel} onValueChange={v => setFamilyData({...familyData, cookingSkillLevel: v as typeof familyData.cookingSkillLevel})}>
                    <SelectTrigger className="mt-2 h-12 rounded-xl">
                      <SelectValue placeholder="Cooking skill" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">{t("Beginner — simple recipes only", "शुरुआती — सिर्फ आसान रेसिपी")}</SelectItem>
                      <SelectItem value="intermediate">{t("Intermediate — can follow most recipes", "मध्यम — ज़्यादातर रेसिपी बना सकते हैं")}</SelectItem>
                      <SelectItem value="experienced">{t("Experienced — comfortable with all recipes", "अनुभवी — सभी रेसिपी बना सकते हैं")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Meals Per Day", "प्रतिदिन भोजन")}</Label>
                  <Select value={familyData.mealsPerDay} onValueChange={v => setFamilyData({...familyData, mealsPerDay: v})}>
                    <SelectTrigger className="mt-2 h-12 rounded-xl">
                      <SelectValue placeholder="Meals" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2_meals">{t("2 meals", "2 भोजन")}</SelectItem>
                      <SelectItem value="3_meals">{t("3 meals", "3 भोजन")}</SelectItem>
                      <SelectItem value="3_meals_plus_snacks">{t("3 + snacks", "3 + नाश्ता")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-base">{t("Kitchen Appliances", "किचन उपकरण")}</Label>
                <p className="text-sm text-muted-foreground mb-3">{t("Select appliances you have — meal plans will only use these", "अपने उपकरण चुनें — भोजन योजना इन्हीं से बनेगी")}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "tawa", en: "Tawa / Griddle", hi: "तवा" },
                    { key: "pressure_cooker", en: "Pressure Cooker", hi: "प्रेशर कुकर" },
                    { key: "kadai", en: "Kadai / Wok", hi: "कड़ाही" },
                    { key: "oven", en: "Oven / OTG", hi: "ओवन" },
                    { key: "microwave", en: "Microwave", hi: "माइक्रोवेव" },
                    { key: "blender_mixie", en: "Blender / Mixie", hi: "मिक्सी" },
                    { key: "idli_stand", en: "Idli Stand", hi: "इडली स्टैंड" },
                    { key: "air_fryer", en: "Air Fryer", hi: "एयर फ्रायर" },
                  ].map(({ key, en, hi }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFamilyData(fd => ({
                        ...fd,
                        appliances: fd.appliances.includes(key)
                          ? fd.appliances.filter(a => a !== key)
                          : [...fd.appliances, key],
                      }))}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        familyData.appliances.includes(key)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:border-primary"
                      }`}
                    >
                      {t(en, hi)}
                    </button>
                  ))}
                </div>
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
                
                <h3 className="font-medium text-lg mb-4">{t("Member", "सदस्य")} #{idx + 1}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label>{t("Name", "नाम")} <span className="text-destructive">*</span></Label>
                    <Input 
                      value={member.name}
                      maxLength={60}
                      onChange={e => {
                        handleUpdateMember(idx, "name", e.target.value);
                        if (memberErrors[member._id]?.name) setMemberErrors(prev => ({ ...prev, [member._id]: { ...prev[member._id], name: undefined } }));
                      }}
                      className={`mt-1 ${memberErrors[member._id]?.name ? "border-destructive" : ""}`}
                    />
                    {memberErrors[member._id]?.name && <p className="text-xs text-destructive mt-1">{memberErrors[member._id].name}</p>}
                  </div>
                  
                  <div>
                    <Label>{t("Age", "आयु")} <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      step={1}
                      value={member.age}
                      onChange={e => {
                        let val: number | "" = e.target.value === "" ? "" : parseInt(e.target.value);
                        if (typeof val === "number" && val > 120) val = 120;
                        if (typeof val === "number" && val < 0) val = 0;
                        handleUpdateMember(idx, "age", val as number | "");
                        if (memberErrors[member._id]?.age) setMemberErrors(prev => ({ ...prev, [member._id]: { ...prev[member._id], age: undefined } }));
                      }}
                      className={`mt-1 ${memberErrors[member._id]?.age ? "border-destructive" : ""}`}
                    />
                    {memberErrors[member._id]?.age && <p className="text-xs text-destructive mt-1">{memberErrors[member._id].age}</p>}
                    {typeof member.age === "number" && member.age > 120 && <p className="text-xs text-destructive mt-1">{t("Please enter a valid age (max 120)", "कृपया वैध आयु दर्ज करें (अधिकतम 120)")}</p>}
                  </div>

                  <div>
                    <Label>{t("Gender", "लिंग")} <span className="text-destructive">*</span></Label>
                    <div className="mt-1.5 flex gap-2">
                      {([
                        { id: "male", en: "Male", hi: "पुरुष" },
                        { id: "female", en: "Female", hi: "महिला" },
                        { id: "other", en: "Other", hi: "अन्य" },
                      ] as const).map(({ id, en, hi }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleUpdateMember(idx, "gender", id)}
                          className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                            member.gender === id
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border hover:border-primary"
                          }`}
                        >
                          {t(en, hi)}
                        </button>
                      ))}
                    </div>
                    {member.gender === "male" && Number(member.age) >= 18 && (
                      <p className="text-xs text-muted-foreground mt-1">{t("Iron RDA: 17mg/day (adult)", "आयरन RDA: 17mg/दिन (वयस्क)")}</p>
                    )}
                    {member.gender === "female" && Number(member.age) >= 18 && (
                      <p className="text-xs text-muted-foreground mt-1">{t("Iron RDA: 21mg/day (adult)", "आयरन RDA: 21mg/दिन (वयस्क)")}</p>
                    )}
                  </div>

                  <div>
                    <Label>{t("Weight (kg)", "वजन (किग्रा)")}</Label>
                    <Input type="number" min={0.5} max={300} step={0.1} value={member.weightKg || ""} onChange={e => {
                      const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                      handleUpdateMember(idx, "weightKg", v);
                    }} className="mt-1" placeholder="e.g. 65" />
                    {member.weightKg !== undefined && member.weightKg > 0 && member.weightKg > 300 && <p className="text-xs text-destructive mt-1">{t("Max 300 kg", "अधिकतम 300 किग्रा")}</p>}
                  </div>
                  <div>
                    <Label>{t("Height (cm)", "ऊंचाई (सेमी)")}</Label>
                    <Input type="number" min={30} max={275} step={0.1} value={member.heightCm || ""} onChange={e => {
                      const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                      handleUpdateMember(idx, "heightCm", v);
                    }} className="mt-1" placeholder="e.g. 165" />
                    {member.heightCm !== undefined && member.heightCm > 275 && <p className="text-xs text-destructive mt-1">{t("Max 275 cm", "अधिकतम 275 सेमी")}</p>}
                  </div>
                </div>

                {(() => {
                  const age = Number(member.age);
                  const w = member.weightKg;
                  const h = member.heightCm;
                  const g = member.gender;
                  const al = member.activityLevel;
                  if (age > 0 && w && w > 0 && h && h > 0 && g && al) {
                    let bmr = g === "female" || g === "other"
                      ? (10 * w) + (6.25 * h) - (5 * age) - 161
                      : (10 * w) + (6.25 * h) - (5 * age) + 5;
                    const mult = al === "sedentary" ? 1.2 : al === "lightly_active" ? 1.375 : al === "very_active" ? 1.725 : 1.55;
                    const target = Math.round((bmr * mult) / 50) * 50;
                    return (
                      <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800">
                        {t(`Estimated daily calorie target: ~${target.toLocaleString()} kcal (based on ICMR-NIN guidelines)`, `अनुमानित दैनिक कैलोरी लक्ष्य: ~${target.toLocaleString()} kcal (ICMR-NIN दिशानिर्देशों पर आधारित)`)}
                      </div>
                    );
                  }
                  return null;
                })()}

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
                  {/* Senior nutrition default notice */}
                  {Number(member.age) >= 60 && (
                    <div className="col-span-2 flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 text-xs text-violet-800">
                      <span className="shrink-0 mt-0.5">🤖</span>
                      <span>{t("Default goal: Senior Nutrition (age 60+). You can change it below.", "डिफ़ॉल्ट लक्ष्य: वरिष्ठ पोषण (आयु 60+)। नीचे बदल सकते हैं।")}</span>
                    </div>
                  )}
                  {/* Activity Level */}
                  <div>
                    <Label className="text-sm font-semibold">{t("Activity Level", "गतिविधि स्तर")}</Label>
                    <Select value={member.activityLevel} onValueChange={v => handleUpdateMember(idx, "activityLevel", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sedentary">{t("Sedentary", "गतिहीन")}</SelectItem>
                        <SelectItem value="lightly_active">{t("Lightly Active", "हल्की गतिविधि")}</SelectItem>
                        <SelectItem value="moderately_active">{t("Moderately Active", "मध्यम गतिविधि")}</SelectItem>
                        <SelectItem value="very_active">{t("Very Active", "बहुत सक्रिय")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Health Goal — hidden for age <5 (auto early childhood) and age 5-12 (auto healthy growth) */}
                  {Number(member.age) >= 13 && (
                  <div>
                    <Label className="text-sm font-semibold">{t("Health Goal", "स्वास्थ्य लक्ष्य")}</Label>
                    <Select value={member.healthGoal} onValueChange={v => handleUpdateMember(idx, "healthGoal", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="maintain">{t("Maintain Health", "स्वास्थ्य बनाए रखें")}</SelectItem>
                        {Number(member.age) >= 18 && (
                          <SelectItem value="weight_loss">{t("Weight Loss", "वजन घटाना")}</SelectItem>
                        )}
                        {Number(member.age) >= 18 && (
                          <SelectItem value="weight_gain">{t("Weight Gain", "वजन बढ़ाना")}</SelectItem>
                        )}
                        {Number(member.age) >= 18 && (
                          <SelectItem value="build_muscle">{t("Build Muscle", "मांसपेशी वृद्धि")}</SelectItem>
                        )}
                        <SelectItem value="manage_condition">{t("Manage Condition", "स्थिति प्रबंधन")}</SelectItem>
                        {Number(member.age) >= 60 && (
                          <SelectItem value="senior_nutrition">{t("Senior Nutrition", "वरिष्ठ पोषण")}</SelectItem>
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
                        <SelectItem value="strictly_vegetarian">{t("Strictly Vegetarian", "पूर्ण शाकाहारी")}</SelectItem>
                        <SelectItem value="jain_vegetarian">{t("Jain Vegetarian", "जैन शाकाहारी")}</SelectItem>
                        <SelectItem value="eggetarian">{t("Eggetarian", "अंडाहारी")}</SelectItem>
                        <SelectItem value="non_vegetarian">{t("Non-Vegetarian", "मांसाहारी")}</SelectItem>
                        <SelectItem value="occasional_nonveg">{t("Occasional Non-Veg", "कभी-कभी मांसाहार")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {member.dietaryType === "jain_vegetarian" && (
                      <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-[11px]">
                        <span className="shrink-0 mt-0.5">🙏</span>
                        <span>{t("Jain diet excludes all root vegetables — potato, carrot, onion, garlic, beetroot, radish. Our AI strictly follows this. Night-time eating restrictions also applied.", "जैन आहार में सभी जड़ वाली सब्जियां — आलू, गाजर, प्याज, लहसुन, चुकंदर, मूली शामिल नहीं होतीं। हमारी AI इसका पूरी तरह पालन करती है।")}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">{t("Health Conditions", "स्वास्थ्य स्थितियां")} <span className="text-muted-foreground font-normal text-xs">({t("max 4", "अधिकतम 4")})</span></Label>
                    {[
                      { id: 'diabetes_type_2', en: 'Type 2 Diabetes (T2D)', hi: 'टाइप 2 मधुमेह' },
                      { id: 'diabetes_type_1', en: 'Type 1 Diabetes (T1D) — Insulin-dependent', hi: 'टाइप 1 मधुमेह — इंसुलिन-निर्भर' },
                      { id: 'hypertension', en: 'Hypertension', hi: 'उच्च रक्तचाप' },
                      { id: 'obesity', en: 'Obesity', hi: 'मोटापा' },
                      { id: 'anemia', en: 'Anemia', hi: 'रक्ताल्पता' },
                      { id: 'thyroid', en: 'Thyroid', hi: 'थायरॉइड' },
                      { id: 'high_cholesterol', en: 'High Cholesterol', hi: 'उच्च कोलेस्ट्रॉल' },
                      { id: 'pcod', en: 'PCOD/PCOS', hi: 'पीसीओडी/पीसीओएस' },
                      { id: 'ckd', en: 'Chronic Kidney Disease (CKD)', hi: 'क्रोनिक किडनी रोग' },
                      { id: 'pregnancy', en: 'Pregnant / Lactating', hi: 'गर्भवती / स्तनपान' },
                      { id: 'growing_child', en: 'Growing Child', hi: 'बढ़ता बच्चा' },
                      { id: 'elderly', en: 'Elderly (60+)', hi: 'बुजुर्ग (60+)' },
                      { id: 'none', en: 'None', hi: 'कोई नहीं' },
                    ].map(({ id: cond, en, hi }) => {
                      const isDisabled = cond !== "none" && !member.healthConditions.includes(cond) && member.healthConditions.filter(c => c !== "none").length >= 4;
                      return (
                      <div key={cond} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`${member._id}-${cond}`}
                          checked={member.healthConditions.includes(cond)}
                          onCheckedChange={() => toggleMemberCondition(idx, cond)}
                          disabled={isDisabled}
                        />
                        <Label htmlFor={`${member._id}-${cond}`} className={isDisabled ? "opacity-40" : ""}>{t(en, hi)}</Label>
                      </div>
                      );
                    })}

                    {member.healthConditions.includes('diabetes_type_1') && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <Label className="text-sm font-semibold">{t("Insulin Type", "इंसुलिन प्रकार")}</Label>
                        <Select value={member.insulinType || ""} onValueChange={v => handleUpdateMember(idx, "insulinType", v)}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder={t("Select insulin type", "इंसुलिन चुनें")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="novorapid">NovoRapid (rapid-acting)</SelectItem>
                            <SelectItem value="humalog">Humalog (rapid-acting)</SelectItem>
                            <SelectItem value="apidra">Apidra (rapid-acting)</SelectItem>
                            <SelectItem value="actrapid">Actrapid (short-acting)</SelectItem>
                            <SelectItem value="lantus">Lantus (long-acting)</SelectItem>
                            <SelectItem value="tresiba">Tresiba (long-acting)</SelectItem>
                            <SelectItem value="levemir">Levemir (long-acting)</SelectItem>
                            <SelectItem value="mixtard">Mixtard (mixed)</SelectItem>
                            <SelectItem value="other">{t("Other / Not sure", "अन्य / पता नहीं")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {member.healthConditions.includes('ckd') && (
                      <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <Label className="text-sm font-semibold">{t("CKD Stage", "CKD चरण")}</Label>
                        <Select value={member.ckdStage || ""} onValueChange={v => handleUpdateMember(idx, "ckdStage", v)}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder={t("Select CKD stage", "CKD चरण चुनें")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="stage_1">Stage 1 (GFR ≥90)</SelectItem>
                            <SelectItem value="stage_2">Stage 2 (GFR 60-89)</SelectItem>
                            <SelectItem value="stage_3a">Stage 3a (GFR 45-59)</SelectItem>
                            <SelectItem value="stage_3b">Stage 3b (GFR 30-44)</SelectItem>
                            <SelectItem value="stage_4">Stage 4 (GFR 15-29)</SelectItem>
                            <SelectItem value="stage_5">Stage 5 (GFR &lt;15)</SelectItem>
                            <SelectItem value="dialysis">Stage 5 + Dialysis</SelectItem>
                          </SelectContent>
                        </Select>
                        {member.ckdStage === "dialysis" && (
                          <div className="mt-2 p-2 bg-amber-100 border border-amber-300 rounded text-xs text-amber-800">
                            {t("Stage 5 dialysis requires INCREASED protein (1.2–1.4g/kg/day). Our meal plan will apply this reversal automatically.", "स्टेज 5 डायलिसिस में बढ़ा हुआ प्रोटीन (1.2–1.4g/kg/day) चाहिए। हमारी मील प्लान यह स्वचालित रूप से लागू करेगी।")}
                          </div>
                        )}
                      </div>
                    )}

                    {member.healthConditions.includes('pregnancy') && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <Label className="text-sm font-semibold">{t("Pregnancy / Lactation Stage", "गर्भावस्था / स्तनपान चरण")}</Label>
                        <Select value={member.pregnancyStage || ""} onValueChange={v => handleUpdateMember(idx, "pregnancyStage", v)}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder={t("Select stage", "चरण चुनें")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pregnancy_t1">{t("Trimester 1 (0–13 weeks)", "तिमाही 1 (0–13 सप्ताह)")}</SelectItem>
                            <SelectItem value="pregnancy_t2">{t("Trimester 2 (14–27 weeks) — +350 kcal/day", "तिमाही 2 — +350 kcal/दिन")}</SelectItem>
                            <SelectItem value="pregnancy_t3">{t("Trimester 3 (28–40 weeks) — +350 kcal/day", "तिमाही 3 — +350 kcal/दिन")}</SelectItem>
                            <SelectItem value="lactating_0_6m">{t("Breastfeeding (0–6 months) — +600 kcal/day", "स्तनपान (0–6 माह) — +600 kcal/दिन")}</SelectItem>
                            <SelectItem value="lactating_7_12m">{t("Breastfeeding (7–12 months) — +520 kcal/day", "स्तनपान (7–12 माह) — +520 kcal/दिन")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded text-xs text-green-800">
                          {t("Calorie and nutrient targets will be automatically adjusted for this stage per ICMR-NIN 2020 guidelines.", "कैलोरी और पोषक तत्व लक्ष्य ICMR-NIN 2020 दिशानिर्देशों के अनुसार स्वचालित रूप से समायोजित होंगे।")}
                        </div>
                      </div>
                    )}

                    {member.healthConditions.includes('pcod') && member.gender === 'male' && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                        {t("PCOS is typically associated with female hormonal conditions. Please verify this selection.", "PCOS आमतौर पर महिला हार्मोनल स्थिति से जुड़ा है। कृपया इस चयन की पुष्टि करें।")}
                      </div>
                    )}
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
                    {member.memberFastingDays.filter(d => d !== "none").length >= 4 && (
                      <div className="mt-1 flex items-start gap-2 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                        <span className="shrink-0">⚠️</span>
                        <span>{t("4+ fasting days/week. AI will prioritise nutrient-dense foods to prevent deficiency.", "4+ उपवास दिन/सप्ताह। AI पोषक तत्वों की कमी रोकने के लिए घनी खाद्य सामग्री को प्राथमिकता देगी।")}</span>
                      </div>
                    )}
                    {member.healthConditions.includes("diabetes_type_1") && member.memberFastingDays.filter(d => d !== "none").length > 0 && (
                      <div className="mt-1 flex items-start gap-2 px-2.5 py-2 rounded-lg bg-red-50 border border-red-300 text-red-800 text-[11px]">
                        <span className="shrink-0">🚨</span>
                        <span className="font-medium">{t("CLINICAL ALERT: T1D + fasting is high-risk. Fasting with insulin-dependent diabetes can cause hypoglycaemia. Please consult your endocrinologist before fasting. Our AI will add carb-floor safety warnings to this member's fasting-day meals.", "नैदानिक चेतावनी: T1D + उपवास उच्च जोखिम है। इंसुलिन-निर्भर मधुमेह में उपवास हाइपोग्लाइसीमिया का कारण बन सकता है। कृपया उपवास से पहले अपने एंडोक्रिनोलॉजिस्ट से परामर्श लें।")}</span>
                      </div>
                    )}

                    <div className="pt-2">
                      <Label className="text-sm font-semibold">{t("Active Medications", "सक्रिय दवाइयां")} <span className="font-normal text-muted-foreground">({t("optional", "वैकल्पिक")})</span></Label>
                      <Textarea
                        value={member.activeMedications || ""}
                        onChange={e => handleUpdateMember(idx, "activeMedications", e.target.value.slice(0, 500))}
                        placeholder={t("e.g. Metformin 500mg with breakfast, Eltroxin 50mcg before food, NovoRapid 10 units before meals", "जैसे मेटफॉर्मिन 500mg नाश्ते के साथ, एल्ट्रॉक्सिन 50mcg खाने से पहले")}
                        className="mt-1 text-sm"
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground mt-1">{t("Include brand names, dosage, and timing if known. Used to avoid food-drug interactions.", "ब्रांड नाम, खुराक और समय शामिल करें। खाद्य-दवा इंटरैक्शन से बचने के लिए उपयोग किया जाता है।")} ({(member.activeMedications || "").length}/500)</p>
                    </div>

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

                    <div className="pt-2">
                      <Label className="text-sm font-semibold">{t("Spice Tolerance", "मसाला सहनशीलता")}</Label>
                      <div className="mt-1.5 flex gap-2">
                        {([
                          { id: "mild", en: "Mild", hi: "हल्का" },
                          { id: "medium", en: "Medium", hi: "मध्यम" },
                          { id: "spicy", en: "Spicy", hi: "तीखा" },
                        ] as const).map(({ id, en, hi }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleUpdateMember(idx, "spiceTolerance", id)}
                            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                              member.spiceTolerance === id
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border hover:border-primary"
                            }`}
                          >
                            {t(en, hi)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`${member._id}-ekadashi`}
                          checked={member.ekadashi}
                          onCheckedChange={(v) => handleUpdateMember(idx, "ekadashi", !!v)}
                        />
                        <Label htmlFor={`${member._id}-ekadashi`} className="text-xs">{t("Observes Ekadashi fasting", "एकादशी व्रत रखते हैं")}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`${member._id}-festival-alerts`}
                          checked={member.festivalFastingAlerts}
                          onCheckedChange={(v) => handleUpdateMember(idx, "festivalFastingAlerts", !!v)}
                        />
                        <Label htmlFor={`${member._id}-festival-alerts`} className="text-xs">{t("Festival fasting alerts", "त्योहार उपवास सूचनाएं")}</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Advanced Profile Fields ── */}
                <div className="mt-4 pt-4 border-t border-dashed border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t("Advanced Profile", "विस्तृत प्रोफाइल")}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Goal Pace — shown only for weight loss/gain goals, hidden for minors */}
                    {(member.healthGoal === "weight_loss" || member.healthGoal === "weight_gain" || member.healthGoal === "build_muscle") && Number(member.age) >= 18 && (
                    <div>
                      <Label className="text-sm font-semibold">{t("Goal Pace", "लक्ष्य गति")}</Label>
                      <Select value={member.goalPace} onValueChange={v => handleUpdateMember(idx, "goalPace", v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("No specific pace", "कोई लक्ष्य नहीं")}</SelectItem>
                          <SelectItem value="slow_0.25kg">{t("Slow (0.25 kg/week)", "धीमा (0.25 किग्रा/हफ्ता)")}</SelectItem>
                          <SelectItem value="moderate_0.5kg">{t("Moderate (0.5 kg/week)", "मध्यम (0.5 किग्रा/हफ्ता)")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    )}
                    <div>
                      <Label className="text-sm font-semibold">{t("Tiffin Type", "टिफिन प्रकार")}</Label>
                      <Select value={member.tiffinNeeded} onValueChange={v => handleUpdateMember(idx, "tiffinNeeded", v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">{t("Not required", "नहीं")}</SelectItem>
                          <SelectItem value="yes_school">{t("School Tiffin", "स्कूल टिफिन")}</SelectItem>
                          <SelectItem value="yes_office">{t("Office Tiffin", "ऑफिस टिफिन")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">{t("Religious / Cultural Rules", "धार्मिक नियम")}</Label>
                      <Select value={member.religiousCulturalRules} onValueChange={v => handleUpdateMember(idx, "religiousCulturalRules", v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("None", "कोई नहीं")}</SelectItem>
                          <SelectItem value="jain_rules">{t("Jain (no root veg)", "जैन (मूल सब्जी नहीं)")}</SelectItem>
                          <SelectItem value="no_beef">{t("Hindu (no beef)", "हिंदू (गोमांस नहीं)")}</SelectItem>
                          <SelectItem value="no_pork">{t("Halal / No Pork", "हलाल / सूअर नहीं")}</SelectItem>
                          <SelectItem value="sattvic_no_onion_garlic">{t("Sattvic (no onion/garlic)", "सात्विक (प्याज/लहसुन नहीं)")}</SelectItem>
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
                                  const allergyList = member.foodAllergies.split(",").map(a => a.trim().toLowerCase()).filter(Boolean);
                                  if (allergyList.includes(val.toLowerCase())) {
                                    toast({ title: t("Already in allergies", "पहले से एलर्जी में है"), description: t(`"${val}" is already listed as a food allergy. No need to add as dislike.`, `"${val}" पहले से खाद्य एलर्जी में है। नापसंद के रूप में जोड़ने की आवश्यकता नहीं।`), variant: "default" });
                                  }
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
                  {(member.dietaryType === "non_vegetarian" || member.dietaryType === "occasional_nonveg") && (
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

              </div>
            ))}

            <Button 
              type="button" 
              variant="outline" 
              onClick={handleAddMember}
              disabled={members.length >= 8}
              className="w-full h-14 rounded-2xl border-dashed border-2 text-muted-foreground hover:text-primary hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5 mr-2" />
              {members.length >= 8 ? t("Maximum 8 members reached", "अधिकतम 8 सदस्य") : t("Add Another Member", "एक और सदस्य जोड़ें")}
            </Button>

            <div className="flex justify-between pt-6">
              <Button variant="ghost" size="lg" className="rounded-xl" onClick={() => setStep(1)}>
                <ArrowLeft className="w-5 h-5 mr-2" /> {t("Back", "वापस")}
              </Button>
              <Button size="lg" className="rounded-xl px-8" onClick={() => setStep(3)}>
                {t("Next: Review", "अगला: समीक्षा")} <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="glass-elevated rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                {t("Family Details", "परिवार का विवरण")}
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">{t("Family Name", "परिवार का नाम")}</span>
                  <p className="font-medium">{familyData.name || "—"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">{t("Region", "क्षेत्र")}</span>
                  <p className="font-medium">{familyData.stateRegion || "—"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">{t("Diet Baseline", "आहार आधारभूत")}</span>
                  <p className="font-medium capitalize">{(familyData.householdDietaryBaseline || "—").replace(/_/g, " ")}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">{t("Meals/Day", "भोजन/दिन")}</span>
                  <p className="font-medium">{(familyData.mealsPerDay || "—").replace(/_/g, " ")}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">{t("Cooking Skill", "खाना पकाने का कौशल")}</span>
                  <p className="font-medium capitalize">{familyData.cookingSkillLevel}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">{t("Appliances", "उपकरण")}</span>
                  <p className="font-medium">{familyData.appliances.length > 0 ? familyData.appliances.join(", ").replace(/_/g, " ") : "—"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                {t(`Members (${members.length})`, `सदस्य (${members.length})`)}
              </h2>
              {members.map((m, idx) => (
                <div key={m._id} className="glass-elevated rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-base">{m.name || t(`Member ${idx + 1}`, `सदस्य ${idx + 1}`)}</h3>
                    <span className="text-xs text-muted-foreground px-2 py-1 rounded-full bg-muted">
                      {m.age ? `${m.age}y` : "—"} · {m.gender || "—"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {m.weightKg && (
                      <div>
                        <span className="text-xs text-muted-foreground">{t("Weight", "वजन")}</span>
                        <p className="font-medium">{m.weightKg} kg</p>
                      </div>
                    )}
                    {m.heightCm && (
                      <div>
                        <span className="text-xs text-muted-foreground">{t("Height", "ऊंचाई")}</span>
                        <p className="font-medium">{m.heightCm} cm</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-muted-foreground">{t("Diet", "आहार")}</span>
                      <p className="font-medium capitalize">{(m.dietaryType || "—").replace(/_/g, " ")}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">{t("Goal", "लक्ष्य")}</span>
                      <p className="font-medium capitalize">{(m.primaryGoal || m.healthGoal || "—").replace(/_/g, " ")}</p>
                    </div>
                    {m.healthConditions.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-xs text-muted-foreground">{t("Health Conditions", "स्वास्थ्य स्थितियां")}</span>
                        <p className="font-medium">{m.healthConditions.map(c => c.replace(/_/g, " ")).join(", ")}</p>
                      </div>
                    )}
                    {m.spiceTolerance && (
                      <div>
                        <span className="text-xs text-muted-foreground">{t("Spice", "मसाला")}</span>
                        <p className="font-medium capitalize">{m.spiceTolerance}</p>
                      </div>
                    )}
                    {m.tiffinNeeded && m.tiffinNeeded !== "no" && (
                      <div>
                        <span className="text-xs text-muted-foreground">{t("Tiffin", "टिफिन")}</span>
                        <p className="font-medium capitalize">{m.tiffinNeeded.replace(/_/g, " ")}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-6">
              <Button variant="ghost" size="lg" className="rounded-xl" onClick={() => setStep(2)}>
                <ArrowLeft className="w-5 h-5 mr-2" /> {t("Back to Members", "सदस्यों पर वापस")}
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
        language={familyData.languagePreference}
        onClose={handleVoiceClose}
        onComplete={handleVoiceComplete}
      />
    </div>
  );
}
