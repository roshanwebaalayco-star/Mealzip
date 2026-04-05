import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays, Clock, IndianRupee, Utensils, ChevronDown, ChevronUp,
  Sparkles, Minus, Plus, Camera, CheckCircle2, Scale, Leaf, ArrowLeft,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useLanguage } from "@/contexts/language-context";
import { useAppState } from "@/hooks/use-app-state";
import { useGenerateMealPlan, getListMealPlansQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/hooks/use-toast";

import type { MemberContextOverride, WeeklyContext, FamilyMember } from "@/types/weekly-context";

interface GenerationLog {
  step: string;
  message: string;
  completed: boolean;
  duration_ms?: number;
}

const lsKey = (familyId: number) => `nutrinext_weekly_context_${familyId}`;

const FASTING_OPTIONS = [
  { id: "monday", label: "Monday", hi: "सोमवार" },
  { id: "tuesday", label: "Tuesday", hi: "मंगलवार" },
  { id: "thursday", label: "Thursday", hi: "गुरुवार" },
  { id: "friday", label: "Friday", hi: "शुक्रवार" },
  { id: "ekadashi", label: "Ekadashi", hi: "एकादशी" },
];

const NON_VEG_DAY_OPTIONS = [
  { id: "monday", label: "Mon", hi: "सोम" },
  { id: "tuesday", label: "Tue", hi: "मंगल" },
  { id: "wednesday", label: "Wed", hi: "बुध" },
  { id: "thursday", label: "Thu", hi: "गुरु" },
  { id: "friday", label: "Fri", hi: "शुक्र" },
  { id: "saturday", label: "Sat", hi: "शनि" },
  { id: "sunday", label: "Sun", hi: "रवि" },
];

const NON_VEG_TYPES = [
  { value: "chicken", label: "Chicken", hi: "चिकन" },
  { value: "fish", label: "Fish", hi: "मछली" },
  { value: "eggs", label: "Eggs", hi: "अंडे" },
  { value: "mutton", label: "Mutton", hi: "मटन" },
  { value: "any", label: "Any", hi: "कोई भी" },
];

function isWeightGoalMember(member: FamilyMember): boolean {
  const conditions = member.healthConditions ?? [];
  const goal = member.primaryGoal ?? "";
  return (
    conditions.some(c => ["obesity", "weight_loss", "weight_gain", "growing_child"].includes(c)) ||
    goal === "weight_loss" ||
    goal === "weight_gain" ||
    goal === "muscle_gain"
  );
}

function isOccasionalNonVeg(member: FamilyMember): boolean {
  const dietaryType = member.dietaryType ?? "strictly_vegetarian";
  if (dietaryType === "strictly_vegetarian" || dietaryType === "vegan" || dietaryType === "jain_vegetarian") return false;
  const nonvegConfig = member.occasionalNonvegConfig;
  return (
    dietaryType === "non_vegetarian" ||
    dietaryType === "occasional_non_veg" ||
    dietaryType === "occasional_nonveg" ||
    (nonvegConfig?.days?.length ?? 0) > 0
  );
}

function buildProfileDefaults(members: FamilyMember[], defaultBudget: number): WeeklyContext {
  const weeklyBudget = Math.round(defaultBudget / 4);
  const memberOverrides: Record<string, MemberContextOverride> = {};
  for (const m of members) {
    const ov: MemberContextOverride = { memberId: m.id };
    if (m.tiffinNeeded && m.tiffinNeeded !== "no") ov.tiffin_override = true;
    const nonvegConfig = m.occasionalNonvegConfig;
    if (nonvegConfig?.days && nonvegConfig.days.length > 0) ov.nonveg_days_override = nonvegConfig.days;
    if (nonvegConfig?.types && nonvegConfig.types.length > 0) ov.nonveg_type_override = nonvegConfig.types[0];
    if (m.weightKg && isWeightGoalMember(m)) ov.weight_kg = Number(m.weightKg);
    if (Object.keys(ov).length > 1) memberOverrides[String(m.id)] = ov;
  }
  return {
    budget_inr: weeklyBudget,
    weekday_prep_time: "<20",
    weekend_prep_time: "nopref",
    dining_out_freq: 0,
    member_overrides: memberOverrides,
  };
}

function mergeProfileAndStored(profile: WeeklyContext, stored: WeeklyContext): WeeklyContext {
  return {
    ...profile,
    ...stored,
    member_overrides: {
      ...profile.member_overrides,
      ...stored.member_overrides,
    },
  };
}

export default function MealGenPage() {
  const { activeFamily } = useAppState();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const familyId = activeFamily?.id || 0;
  const defaultBudget = activeFamily?.monthlyBudget ?? 5000;

  const [generatingPlanId, setGeneratingPlanId] = useState<number | null>(null);
  const [generationLogs, setGenerationLogs] = useState<GenerationLog[]>([]);
  const [generationStatus, setGenerationStatus] = useState<string>("pending");

  const { data: familyMembers } = useQuery<FamilyMember[]>({
    queryKey: ["family-members", familyId],
    queryFn: async () => {
      const res = await apiFetch(`/api/families/${familyId}/members`);
      return res.json() as Promise<FamilyMember[]>;
    },
    enabled: !!familyId,
  });

  const members = familyMembers ?? [];
  const generate = useGenerateMealPlan();

  const getInitialCtx = useCallback((): WeeklyContext => {
    const profileDefaults = buildProfileDefaults(members, defaultBudget);
    try {
      const stored = localStorage.getItem(lsKey(familyId));
      if (stored) return mergeProfileAndStored(profileDefaults, JSON.parse(stored) as WeeklyContext);
    } catch { }
    return profileDefaults;
  }, [members, defaultBudget, familyId]);

  const [ctx, setCtx] = useState<WeeklyContext>(getInitialCtx);
  const [expandedMembers, setExpandedMembers] = useState<Record<number, boolean>>({});
  const [isFasting, setIsFasting] = useState(false);
  const [pantryInput, setPantryInput] = useState(() => (ctx.pantry_items ?? []).join(", "));
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (!familyId || members.length === 0) return;

    const profileDefaults = buildProfileDefaults(members, defaultBudget);
    try {
      const stored = localStorage.getItem(lsKey(familyId));
      if (stored) {
        const merged = mergeProfileAndStored(profileDefaults, JSON.parse(stored) as WeeklyContext);
        setCtx(merged);
        setPantryInput((merged.pantry_items ?? []).join(", "));
      } else {
        setCtx(profileDefaults);
        setPantryInput("");
      }
    } catch {
      setCtx(profileDefaults);
      setPantryInput("");
    }
    setIsFasting(false);
    setExpandedMembers({});
    setInitialized(true);
  }, [familyId, members.length, defaultBudget, initialized]);

  const persist = (updated: WeeklyContext) => {
    setCtx(updated);
    try { localStorage.setItem(lsKey(familyId), JSON.stringify(updated)); } catch { }
  };

  const updateField = <K extends keyof WeeklyContext>(key: K, value: WeeklyContext[K]) => {
    persist({ ...ctx, [key]: value });
  };

  const updateMemberOverride = (memberId: number, field: keyof MemberContextOverride, value: unknown) => {
    const key = String(memberId);
    const overrides = { ...(ctx.member_overrides ?? {}) };
    overrides[key] = { ...(overrides[key] ?? {}), memberId, [field]: value };
    persist({ ...ctx, member_overrides: overrides });
  };

  const toggleMemberFastingDay = (memberId: number, day: string) => {
    const key = String(memberId);
    const overrides = { ...(ctx.member_overrides ?? {}) };
    const memberOv = { ...(overrides[key] ?? {}), memberId };
    const days = memberOv.fasting_days ?? [];
    memberOv.fasting_days = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
    overrides[key] = memberOv;
    persist({ ...ctx, member_overrides: overrides });
  };

  const toggleMemberNonVegDay = (memberId: number, day: string) => {
    const key = String(memberId);
    const overrides = { ...(ctx.member_overrides ?? {}) };
    const memberOv = { ...(overrides[key] ?? {}), memberId };
    const days = memberOv.nonveg_days_override ?? [];
    memberOv.nonveg_days_override = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
    overrides[key] = memberOv;
    persist({ ...ctx, member_overrides: overrides });
  };

  const handlePantryInputBlur = () => {
    const items = pantryInput.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    updateField("pantry_items", items.length > 0 ? items : undefined);
  };

  const buildFinalCtx = (): WeeklyContext => {
    const finalCtx = { ...ctx };
    const items = pantryInput.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    if (items.length > 0) finalCtx.pantry_items = items;
    else delete finalCtx.pantry_items;
    return finalCtx;
  };

  useEffect(() => {
    if (!generatingPlanId) return;
    let retryCount = 0;
    const MAX_RETRIES = 90;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/meal-gen/${generatingPlanId}/status`);
        if (!res.ok) {
          retryCount++;
          if (retryCount >= MAX_RETRIES) {
            clearInterval(interval);
            setGeneratingPlanId(null);
            setGenerationLogs([]);
            toast({ title: t("Generation timed out", "योजना बनाने में समय समाप्त"), description: t("Please try again", "कृपया फिर से प्रयास करें"), variant: "destructive" });
          }
          return;
        }
        const data = await res.json() as any;
        retryCount = 0;
        if (data.generation_log) setGenerationLogs(data.generation_log);
        if (data.status) setGenerationStatus(data.status);
        if (data.status === "completed") {
          clearInterval(interval);
          setGeneratingPlanId(null);
          queryClient.invalidateQueries({ queryKey: getListMealPlansQueryKey({ familyId }) });
          setLocation("/meal-plan");
        } else if (data.status === "failed") {
          clearInterval(interval);
          setGeneratingPlanId(null);
          setGenerationLogs([]);
          toast({ title: t("Generation failed", "योजना बनाने में विफल"), variant: "destructive" });
        }
      } catch {
        retryCount++;
        if (retryCount >= MAX_RETRIES) {
          clearInterval(interval);
          setGeneratingPlanId(null);
          setGenerationLogs([]);
          toast({ title: t("Connection lost", "कनेक्शन टूट गया"), variant: "destructive" });
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [generatingPlanId, familyId]);

  const submitPlan = async () => {
    const finalCtx = buildFinalCtx();
    persist(finalCtx);
    try {
      const result = await generate.mutateAsync({
        data: {
          familyId: activeFamily!.id,
          weekStartDate: new Date().toISOString(),
          preferences: isFasting ? { isFasting: true } : undefined,
          weeklyContext: finalCtx,
        },
      });
      const planId = (result as any)?.id ?? (result as any)?.mealPlanId;
      if (planId) {
        setGeneratingPlanId(planId);
        setGenerationLogs([]);
        setGenerationStatus("processing");
      } else {
        queryClient.invalidateQueries({ queryKey: getListMealPlansQueryKey({ familyId }) });
        setLocation("/meal-plan");
      }
    } catch (e) {
      console.error(e);
      toast({ title: t("Generation failed", "योजना बनाने में विफल"), variant: "destructive" });
    }
  };

  const isPolling = generatingPlanId !== null;
  const isGenerating = generate.isPending || isPolling;

  if (isPolling) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 animate-fade-up">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center animate-pulse mx-auto">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{t("Generating Your Meal Plan…", "आपकी भोजन योजना बना रहे हैं…")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("Building constraint packet → Running AI → Validating meals", "प्रतिबंध पैकेट बना रहे → AI चला रहे → भोजन जांच रहे")}</p>
          </div>
          <div className="w-full max-w-sm mx-auto space-y-2.5 text-left">
            {generationLogs.map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2.5 text-sm"
              >
                {log.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <svg className="w-5 h-5 animate-spin text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                <span className={log.completed ? "text-foreground" : "text-muted-foreground"}>
                  {log.message}
                  {log.duration_ms != null && log.completed && (
                    <span className="text-muted-foreground ml-1">({(log.duration_ms / 1000).toFixed(1)}s)</span>
                  )}
                </span>
              </motion.div>
            ))}
            {generationLogs.length === 0 && (
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t("Initializing…", "शुरू कर रहे हैं…")}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setLocation("/meal-plan")}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold">{t("This Week's Plan", "इस हफ्ते की योजना")}</h1>
          <p className="text-xs text-muted-foreground">{t("Pre-filled from profile — adjust if anything's different", "प्रोफ़ाइल से भरा — अगर कुछ अलग है तो बदलें")}</p>
        </div>
      </div>

      <div className="space-y-5">
        <button
          onClick={submitPlan}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl border-2 border-green-500 bg-green-50 hover:bg-green-100 transition-colors text-green-800 font-semibold text-sm disabled:opacity-50"
        >
          {isGenerating ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          )}
          {isGenerating
            ? t("Generating…", "बना रहे हैं…")
            : t("Nothing changed — confirm ✓", "कुछ नहीं बदला — पुष्टि करें ✓")}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-xs text-muted-foreground">{t("or adjust below", "या नीचे बदलें")}</span>
          </div>
        </div>

        <div>
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5 text-primary" />
            {t("Weekly Budget", "साप्ताहिक बजट")}
            <span className="ml-auto text-base font-bold text-primary">₹{(ctx.budget_inr ?? 1000).toLocaleString("en-IN")}</span>
          </Label>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => updateField("budget_inr", Math.max(500, (ctx.budget_inr ?? 1000) - 250))}
              className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 transition-colors shrink-0"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <Slider
              min={500}
              max={10000}
              step={250}
              value={[ctx.budget_inr ?? 1000]}
              onValueChange={([v]) => updateField("budget_inr", v)}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => updateField("budget_inr", Math.min(10000, (ctx.budget_inr ?? 1000) + 250))}
              className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs font-semibold flex items-center gap-1">
              <Utensils className="w-3 h-3 text-primary" />
              {t("Eat Out", "बाहर")}
            </Label>
            <Select
              value={String(ctx.dining_out_freq ?? "0")}
              onValueChange={v => updateField("dining_out_freq", parseInt(v))}
            >
              <SelectTrigger className="mt-1 h-9 rounded-xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t("None", "नहीं")}</SelectItem>
                <SelectItem value="2">{t("1–2x", "1–2 बार")}</SelectItem>
                <SelectItem value="4">{t("3–4x", "3–4 बार")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3 text-primary" />
              {t("Weekday", "सप्ताह")}
            </Label>
            <Select
              value={ctx.weekday_prep_time ?? "<20"}
              onValueChange={v => updateField("weekday_prep_time", v as "<20" | "20-40" | "nolimit")}
            >
              <SelectTrigger className="mt-1 h-9 rounded-xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="<20">{t("<20min", "<20 मि")}</SelectItem>
                <SelectItem value="20-40">{t("20-40min", "20-40 मि")}</SelectItem>
                <SelectItem value="nolimit">{t("No limit", "कोई सीमा नहीं")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3 text-orange-500" />
              {t("Weekend", "छुट्टी")}
            </Label>
            <Select
              value={ctx.weekend_prep_time ?? "nopref"}
              onValueChange={v => updateField("weekend_prep_time", v as "quick" | "elaborate" | "nopref")}
            >
              <SelectTrigger className="mt-1 h-9 rounded-xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quick">{t("Quick", "जल्दी")}</SelectItem>
                <SelectItem value="elaborate">{t("Elaborate", "विस्तृत")}</SelectItem>
                <SelectItem value="nopref">{t("No pref", "कोई नहीं")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <CalendarDays className="w-3 h-3 text-primary" />
            {t("Special Request", "विशेष मांग")}
          </Label>
          <Input
            value={ctx.special_request ?? ""}
            onChange={e => updateField("special_request", e.target.value || undefined)}
            placeholder={t("e.g. light meals Thursday, function Friday", "जैसे गुरुवार हल्का खाना, शुक्रवार समारोह")}
            className="mt-1 h-9 rounded-xl text-xs"
          />
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <Camera className="w-3 h-3 text-primary" />
              {t("Pantry Items", "पेंट्री")}
            </Label>
            <Link
              href="/pantry-scan"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
            >
              <Camera className="w-2.5 h-2.5" />
              {t("Scan", "स्कैन")}
            </Link>
          </div>
          <textarea
            value={pantryInput}
            onChange={e => setPantryInput(e.target.value)}
            onBlur={handlePantryInputBlur}
            placeholder={t("e.g. rice, dal, spinach, tomatoes", "जैसे चावल, दाल, पालक, टमाटर")}
            className="w-full resize-none rounded-lg border border-border bg-white dark:bg-zinc-800 text-xs px-3 py-2 min-h-[60px] focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {members.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">{t("Member Check-In", "सदस्य स्थिति")}</p>
            <div className="space-y-2">
              {members.map(member => {
                const memberOv = ctx.member_overrides?.[String(member.id)] ?? { memberId: member.id };
                const isExpanded = expandedMembers[member.id] ?? false;
                const showWeight = isWeightGoalMember(member);
                const showNonVeg = isOccasionalNonVeg(member);

                return (
                  <div key={member.id} className="border border-border rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedMembers(prev => ({ ...prev, [member.id]: !isExpanded }))}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary">
                          {member.name.charAt(0)}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold">{member.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{member.age}y · {member.gender}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {memberOv.feeling_this_week && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full truncate max-w-[80px]">
                            {memberOv.feeling_this_week.slice(0, 12)}
                          </span>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border bg-muted/20">
                            {showWeight && (
                              <div className="pt-3">
                                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                  <Scale className="w-3 h-3" />
                                  {t("Current weight (kg)", "वर्तमान वजन")}
                                </Label>
                                <Input
                                  type="number"
                                  min={20}
                                  max={200}
                                  step={0.5}
                                  value={memberOv.weight_kg ?? ""}
                                  onChange={e => updateMemberOverride(member.id, "weight_kg", e.target.value ? parseFloat(e.target.value) : undefined)}
                                  placeholder="e.g. 68"
                                  className="mt-1 h-8 rounded-lg text-xs w-28"
                                />
                              </div>
                            )}

                            <div className={showWeight ? "" : "pt-3"}>
                              <Label className="text-xs font-semibold text-muted-foreground">{t("Feeling this week?", "इस हफ्ते कैसा महसूस?")}</Label>
                              <Input
                                value={memberOv.feeling_this_week ?? ""}
                                onChange={e => updateMemberOverride(member.id, "feeling_this_week", e.target.value || undefined)}
                                placeholder={t("tired, stressed, great…", "थका, तनाव, बढ़िया…")}
                                className="mt-1 h-8 rounded-lg text-xs"
                              />
                            </div>

                            <div>
                              <Label className="text-xs font-semibold text-muted-foreground">{t("Fasting days", "उपवास")}</Label>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {FASTING_OPTIONS.map(fd => (
                                  <button
                                    key={fd.id}
                                    type="button"
                                    onClick={() => toggleMemberFastingDay(member.id, fd.id)}
                                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                                      (memberOv.fasting_days ?? []).includes(fd.id)
                                        ? "bg-primary text-white border-primary"
                                        : "bg-white border-border hover:border-primary text-foreground"
                                    }`}
                                  >
                                    {t(fd.label, fd.hi)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {showNonVeg && (
                              <div>
                                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                  <Leaf className="w-3 h-3 text-orange-500" />
                                  {t("Non-veg days", "मांसाहार दिन")}
                                </Label>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {NON_VEG_DAY_OPTIONS.map(d => (
                                    <button
                                      key={d.id}
                                      type="button"
                                      onClick={() => toggleMemberNonVegDay(member.id, d.id)}
                                      className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                                        (memberOv.nonveg_days_override ?? []).includes(d.id)
                                          ? "bg-orange-500 text-white border-orange-500"
                                          : "bg-white border-border hover:border-orange-400 text-foreground"
                                      }`}
                                    >
                                      {t(d.label, d.hi)}
                                    </button>
                                  ))}
                                </div>
                                {(memberOv.nonveg_days_override ?? []).length > 0 && (
                                  <Select
                                    value={memberOv.nonveg_type_override ?? "any"}
                                    onValueChange={v => updateMemberOverride(member.id, "nonveg_type_override", v)}
                                  >
                                    <SelectTrigger className="mt-1.5 h-8 rounded-lg text-xs border-border"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {NON_VEG_TYPES.map(t2 => (
                                        <SelectItem key={t2.value} value={t2.value}>
                                          {lang === "hi" ? t2.hi : t2.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={memberOv.tiffin_override ?? false}
                                  onChange={e => updateMemberOverride(member.id, "tiffin_override", e.target.checked)}
                                  className="w-3.5 h-3.5 accent-primary"
                                />
                                <span className="text-xs">{t("Needs tiffin", "टिफिन")}</span>
                              </label>
                              <Select
                                value={memberOv.spice_override ?? "normal"}
                                onValueChange={v => updateMemberOverride(member.id, "spice_override", v === "normal" ? undefined : v as "mild" | "medium" | "spicy")}
                              >
                                <SelectTrigger className="h-8 rounded-lg text-xs border-border"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="normal">{t("Normal spice", "सामान्य")}</SelectItem>
                                  <SelectItem value="mild">{t("Mild", "हल्का")}</SelectItem>
                                  <SelectItem value="medium">{t("Medium", "मध्यम")}</SelectItem>
                                  <SelectItem value="spicy">{t("Spicy", "तीखा")}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <label className="flex items-center gap-2 cursor-pointer flex-1">
            <input
              type="checkbox"
              checked={isFasting}
              onChange={e => setIsFasting(e.target.checked)}
              className="w-4 h-4 accent-amber-600"
            />
            <div>
              <p className="text-sm font-semibold text-amber-900">{t("Fasting Week", "व्रत सप्ताह")}</p>
              <p className="text-xs text-amber-700">{t("Sabudana, kuttu, fruits etc.", "साबूदाना, कुट्टू, फल आदि")}</p>
            </div>
          </label>
        </div>

        <button
          onClick={submitPlan}
          disabled={isGenerating}
          className="btn-liquid w-full inline-flex items-center justify-center gap-2 bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-sm font-semibold px-6 py-3.5 rounded-2xl disabled:opacity-60"
        >
          {generate.isPending ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : <Sparkles className="w-4 h-4" />}
          {generate.isPending
            ? t("Generating plan…", "योजना बना रहे हैं…")
            : t("Generate Plan", "योजना बनाएं")}
        </button>
      </div>
    </div>
  );
}
