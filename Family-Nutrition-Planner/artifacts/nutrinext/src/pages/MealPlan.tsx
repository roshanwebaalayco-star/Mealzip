import { apiFetch } from "@/lib/api-fetch";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/contexts/language-context";
import { useListMealPlans, useGenerateMealPlan, getListMealPlansQueryKey } from "@workspace/api-client-react";
import {
  Loader2, Sparkles, Utensils, Info, RefreshCw, ThumbsUp, ThumbsDown,
  CalendarDays, Moon, Leaf, Link2, Camera, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, XCircle, BookOpen, HelpCircle
} from "lucide-react";
import { format, startOfMonth, getDaysInMonth, getDay, addDays } from "date-fns";
import { HarmonyScore } from "@/components/HarmonyScore";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LeftoverStep {
  step: number;
  day: string;
  meal: string;
  dish: string;
}

interface MemberPlate {
  add: string[];
  reduce: string[];
  avoid: string[];
}

interface MealCell {
  recipeName?: string;
  nameHindi?: string;
  name?: string;
  calories?: number;
  estimatedCost?: number;
  isLeftover?: boolean;
  notes?: string;
  recipeId?: number | null;
  memberVariations?: Record<string, string>;
  leftoverChain?: LeftoverStep[];
  icmr_rationale?: string;
  instructions?: string[];
  member_plates?: Record<string, MemberPlate>;
}

interface DayData {
  day: string;
  isFastingDay?: boolean;
  meals: Record<string, MealCell>;
  dailyHarmonyScore?: number;
  dailyNutrition?: { calories: number; protein: number; carbs: number; fat: number; fiber?: number; iron?: number };
}

interface FastingDay {
  date: string;
  name: string;
  nameHindi: string;
  fastingType: string;
  recommendedFoods: string[];
  traditions?: string[];
}

interface FastingCalendar {
  year: number;
  month: number;
  dataYear: number;
  isFallbackYear: boolean;
  fastingDays: FastingDay[];
  totalFestivalsInMonth?: number;
  note: string;
}

interface FamilyMember {
  id: number;
  name: string;
  role: string;
  age: number;
  healthConditions: string[];
  dietaryRestrictions: string[];
}

const MEMBER_COLORS = [
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-rose-100 text-rose-700 border-rose-200",
];

function getMemberVariation(member: FamilyMember, mealType: string): string | null {
  const conditions = member.healthConditions ?? [];
  const restrictions = member.dietaryRestrictions ?? [];

  if (conditions.includes("diabetes") || conditions.includes("diabetes_type2")) {
    if (mealType === "Lunch" || mealType === "Dinner") return "Low-carb portion";
  }
  if (conditions.includes("hypertension") || conditions.includes("blood_pressure")) {
    return "No added salt";
  }
  if (conditions.includes("obesity") || conditions.includes("weight_loss")) {
    return "Reduced portion";
  }
  if (conditions.includes("anemia") || conditions.includes("iron_deficiency")) {
    return "+ Iron-rich add-on";
  }
  if (restrictions.includes("jain")) {
    return "No root vegetables";
  }
  if (member.age < 5) {
    return "Mashed + mild spice";
  }
  if (member.age < 12) {
    return "Extra nutrition";
  }
  if (member.role === "grandparent" && member.age > 60) {
    return "Soft texture";
  }
  return null;
}

export default function MealPlan() {
  const { activeFamily } = useAppState();
  const { lang, t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const familyId = activeFamily?.id || 0;

  const [feedbackState, setFeedbackState] = useState<Record<string, boolean | null>>({});
  const [showFasting, setShowFasting] = useState(false);
  const [loggingMeal, setLoggingMeal] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [allExpanded, setAllExpanded] = useState(false);
  const [rationaleExpanded, setRationaleExpanded] = useState<Record<string, boolean>>({});
  const [instructionsExpanded, setInstructionsExpanded] = useState<Record<string, boolean>>({});
  const [activeMealTab, setActiveMealTab] = useState("lunch");

  // Determine today's day name (e.g., "Monday")
  const todayDayName = useMemo(() => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return dayNames[new Date().getDay()];
  }, []);

  const { data: plans, isLoading, refetch } = useListMealPlans(
    { familyId },
    { query: { enabled: !!activeFamily, queryKey: getListMealPlansQueryKey({ familyId }) } }
  );

  const { data: familyMembers } = useQuery<FamilyMember[]>({
    queryKey: ["family-members", familyId],
    queryFn: async () => {
      const res = await apiFetch(`/api/families/${familyId}/members`);
      return res.json() as Promise<FamilyMember[]>;
    },
    enabled: !!familyId,
  });

  const { data: fastingData } = useQuery<FastingCalendar>({
    queryKey: ["fasting-calendar"],
    queryFn: async () => {
      const now = new Date();
      const res = await apiFetch(`/api/fasting-calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
      return res.json() as Promise<FastingCalendar>;
    },
  });

  const currentPlanId = plans?.[0]?.id;
  const { data: feedbackList } = useQuery<{ liked: boolean }[]>({
    queryKey: ["meal-feedback", currentPlanId],
    queryFn: async () => {
      if (!currentPlanId) return [];
      const res = await apiFetch(`/api/meal-plans/${currentPlanId}/feedback`);
      return res.json() as Promise<{ liked: boolean }[]>;
    },
    enabled: !!currentPlanId,
  });

  const feedbackCount = feedbackList?.length ?? 0;
  const canRegenerateWeek2 = feedbackCount >= 3;

  const generate = useGenerateMealPlan();

  const feedbackMutation = useMutation({
    mutationFn: async ({ dayIndex, mealType, liked, mealPlanId }: { dayIndex: number; mealType: string; liked: boolean; mealPlanId: number }) => {
      const res = await apiFetch(`/api/meal-plans/${mealPlanId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId, dayIndex, mealType, liked }),
      });
      return res.json();
    },
    onSuccess: (_, { liked }) => {
      toast({
        title: liked ? t("Great! We'll keep this.", "बढ़िया! हम इसे रखेंगे।") : t("Noted! We'll improve next week.", "ठीक है! अगले हफ्ते सुधार करेंगे।"),
      });
      queryClient.invalidateQueries({ queryKey: ["meal-feedback", currentPlanId] });
    },
  });

  const logMealMutation = useMutation({
    mutationFn: async ({ memberId, meal, mealType }: { memberId: number; meal: MealCell; mealType: string }) => {
      const mealName = meal.recipeName ?? meal.name ?? "Unknown meal";
      const todayStr = new Date().toISOString().split("T")[0];
      const res = await apiFetch("/api/nutrition-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyId,
          memberId,
          logDate: todayStr,
          mealType: mealType.toLowerCase(),
          foodDescription: mealName,
          calories: meal.calories ?? 0,
          proteinG: 0,
          carbsG: 0,
          fatG: 0,
          source: "manual",
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("Meal logged!", "भोजन लॉग हो गया!"), description: t("Added to your nutrition log.", "आपके पोषण लॉग में जोड़ा गया।") });
      setLoggingMeal(null);
    },
    onError: () => {
      toast({ title: "Logging failed", variant: "destructive" });
      setLoggingMeal(null);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (mealPlanId: number) => {
      const res = await apiFetch(`/api/meal-plans/${mealPlanId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListMealPlansQueryKey({ familyId }) });
      toast({ title: t("Plan regenerated with feedback!", "फीडबैक के साथ योजना पुनर्निर्मित!") });
    },
  });

  if (!activeFamily) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        {t("Please create or select a family first.", "पहले परिवार बनाएं या चुनें।")}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPlan = plans?.[0];

  const handleGenerate = async (isFasting = false) => {
    try {
      await generate.mutateAsync({
        data: {
          familyId: activeFamily.id,
          weekStartDate: new Date().toISOString(),
          preferences: isFasting ? { isFasting: true } : undefined,
        },
      });
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  if (!currentPlan) {
    return (
      <div className="p-6 md:p-12 flex flex-col items-center justify-center text-center">
        <div className="glass-card rounded-3xl p-10 max-w-md w-full">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Utensils className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2 relative z-10">{t("No Meal Plan Yet", "अभी कोई भोजन योजना नहीं")}</h2>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed relative z-10">
            {t("Generate an AI-powered 7-day plan optimized for your family's health, budget & tastes using ICMR-NIN 2024 guidelines.", "ICMR-NIN 2024 दिशानिर्देशों का उपयोग करके आपके परिवार के स्वास्थ्य, बजट और स्वाद के लिए AI-संचालित 7-दिवसीय योजना बनाएं।")}
          </p>
          <div className="flex flex-col gap-3">
            <button
              className="btn-liquid w-full inline-flex items-center justify-center gap-2 bg-gradient-to-br from-primary to-orange-500 text-white text-sm font-semibold px-6 py-3.5 rounded-2xl relative z-10 disabled:opacity-60"
              onClick={() => handleGenerate(false)}
              disabled={generate.isPending}
            >
              {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {t("Generate Regular Plan", "सामान्य योजना बनाएं")}
            </button>
            <button
              className="w-full inline-flex items-center justify-center gap-2 border border-primary/30 text-primary text-sm font-semibold px-6 py-3 rounded-2xl hover:bg-primary/5 transition-colors disabled:opacity-60"
              onClick={() => handleGenerate(true)}
              disabled={generate.isPending}
            >
              <Moon className="w-4 h-4" />
              {t("Generate Fasting Plan", "व्रत योजना बनाएं")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const planData = typeof currentPlan.plan === "string" ? JSON.parse(currentPlan.plan) : currentPlan.plan;
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const meals = ["Breakfast", "Mid Morning", "Lunch", "Evening Snack", "Dinner"];
  const MEAL_SLOTS = [
    { key: "breakfast", label: "Breakfast", labelHi: "नाश्ता", shortLabel: "BF" },
    { key: "mid_morning", label: "Mid-morning", labelHi: "मध्य-सुबह", shortLabel: "MM" },
    { key: "lunch", label: "Lunch", labelHi: "दोपहर", shortLabel: "LU" },
    { key: "evening_snack", label: "Evening Snack", labelHi: "शाम-नाश्ता", shortLabel: "ES" },
    { key: "dinner", label: "Dinner", labelHi: "रात", shortLabel: "DI" },
  ];

  const getDayData = (day: string): DayData | null => {
    const dayArr = planData?.days as DayData[] | undefined;
    return dayArr?.find(d => d.day === day) || null;
  };

  const getDayMeal = (day: string, meal: string): MealCell => {
    const dayObj = getDayData(day);
    if (dayObj) {
      const key = meal.toLowerCase().replace(/ /g, "_");
      const meals = dayObj.meals as Record<string, MealCell> | undefined;
      // Direct key lookup
      const m = meals?.[key];
      if (m) return m;
      // Backward compat: "snack" → also try "evening_snack"
      if (key === "evening_snack" && meals?.["snack"]) return meals["snack"];
      if (key === "snack" && meals?.["evening_snack"]) return meals["evening_snack"];
    }
    return { name: "—", calories: 0 };
  };

  const getLeftoverChain = (dayIndex: number): { nextDay: string; meal: string; dish: string } | null => {
    const nextDayIndex = dayIndex + 1;
    if (nextDayIndex >= days.length) return null;
    const nextDay = days[nextDayIndex];
    const nextLunch = getDayMeal(nextDay, "Lunch");
    if (nextLunch.isLeftover && nextLunch.name && nextLunch.name !== "—") {
      return { nextDay, meal: "Lunch", dish: lang === "hi" && nextLunch.nameHindi ? nextLunch.nameHindi : (nextLunch.recipeName ?? nextLunch.name ?? "") };
    }
    const nextBreakfast = getDayMeal(nextDay, "Breakfast");
    if (nextBreakfast.isLeftover && nextBreakfast.name && nextBreakfast.name !== "—") {
      return { nextDay, meal: "Breakfast", dish: lang === "hi" && nextBreakfast.nameHindi ? nextBreakfast.nameHindi : (nextBreakfast.recipeName ?? nextBreakfast.name ?? "") };
    }
    return null;
  };

  const handleFeedback = (dayIndex: number, mealType: string, liked: boolean) => {
    const key = `${dayIndex}-${mealType}`;
    setFeedbackState(prev => ({ ...prev, [key]: liked }));
    feedbackMutation.mutate({ dayIndex, mealType, liked, mealPlanId: currentPlan.id });
  };

  const handleLogMeal = (meal: MealCell, mealType: string, logKey: string) => {
    const firstMember = familyMembers?.[0];
    if (!firstMember) {
      toast({ title: "No family members found", variant: "destructive" });
      return;
    }
    setLoggingMeal(logKey);
    logMealMutation.mutate({ memberId: firstMember.id, meal, mealType });
  };

  const mealColors = ["bg-orange-50/60", "bg-amber-50/50", "bg-emerald-50/50", "bg-violet-50/40", "bg-blue-50/40"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className="p-4 md:p-8 space-y-5"
    >
      {/* Header */}
      <div className="glass-panel rounded-3xl p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div className="relative z-10">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-primary mb-1">
            {t("Weekly Plan", "साप्ताहिक योजना")}
          </p>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground leading-tight">
            {t("Weekly Meal Plan", "साप्ताहिक भोजन योजना")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(currentPlan.weekStartDate), "MMM d, yyyy")}
            {" · "}
            <span className="font-semibold text-foreground/70">₹{currentPlan.totalBudgetEstimate}</span>{" "}
            {t("est.", "अनुमानित")}
          </p>
          {Boolean((currentPlan.nutritionSummary as Record<string, unknown> | null)?.isFasting) && (
            <Badge className="mt-2 bg-purple-500/20 text-purple-700 border-purple-500/30">
              <Moon className="w-3 h-3 mr-1" /> {t("Fasting Plan", "व्रत योजना")}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          <button
            onClick={() => handleGenerate(false)}
            disabled={generate.isPending}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary glass-card px-3.5 py-2 rounded-xl hover:bg-white/80 transition-colors disabled:opacity-50"
          >
            {generate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {t("Regenerate", "पुनर्निर्मित")}
          </button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => currentPlan && regenerateMutation.mutate(currentPlan.id)}
            disabled={regenerateMutation.isPending || !canRegenerateWeek2}
            title={!canRegenerateWeek2 ? t(`Rate ${3 - feedbackCount} more meals to unlock`, `${3 - feedbackCount} और भोजन रेट करें`) : ""}
            className="text-xs gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {regenerateMutation.isPending
              ? t("Improving…", "सुधार हो रहा है…")
              : canRegenerateWeek2
                ? t("Week 2 (with feedback)", "सप्ताह 2 (फीडबैक के साथ)")
                : t(`Week 2 (rate ${3 - feedbackCount} more)`, `सप्ताह 2 (${3 - feedbackCount} और रेट करें)`)}
          </Button>

          <button
            onClick={() => setShowFasting(v => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 glass-card px-3.5 py-2 rounded-xl hover:bg-white/80 transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {t("Fasting Calendar", "व्रत कैलेंडर")}
          </button>

          <div className="glass-card rounded-2xl px-4 py-3 flex flex-col items-center">
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-2">
              {t("Harmony Score", "सामंजस्य स्कोर")}
            </p>
            <HarmonyScore score={currentPlan.harmonyScore} size="md" />
          </div>
        </div>
      </div>

      {/* Fasting Calendar — monthly grid */}
      {showFasting && fastingData && (
        <div className="glass-card rounded-3xl p-5 border border-purple-500/20">
          <div className="flex items-center gap-2 mb-4">
            <Moon className="w-4 h-4 text-purple-600" />
            <h3 className="font-semibold">
              {t("Fasting Calendar", "व्रत कैलेंडर")} — {format(new Date(fastingData.year, fastingData.month - 1, 1), "MMMM yyyy")}
            </h3>
            <Badge variant="secondary" className="text-[10px]">
              {fastingData.totalFestivalsInMonth ?? fastingData.fastingDays?.length ?? 0} {t("events", "कार्यक्रम")}
            </Badge>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Calendar date cells */}
          {(() => {
            const monthStart = startOfMonth(new Date(fastingData.year, fastingData.month - 1, 1));
            const totalDays = getDaysInMonth(monthStart);
            const startOffset = getDay(monthStart);
            const cells: (Date | null)[] = Array(startOffset).fill(null);
            for (let d = 1; d <= totalDays; d++) cells.push(addDays(monthStart, d - 1));
            while (cells.length % 7 !== 0) cells.push(null);
            return (
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, i) => {
                  const fastDay = cell
                    ? fastingData.fastingDays?.find(fd => fd.date === format(cell, "yyyy-MM-dd"))
                    : null;
                  return (
                    <div
                      key={i}
                      title={fastDay ? (lang === "hi" ? fastDay.nameHindi : fastDay.name) : undefined}
                      className={`h-9 rounded-xl flex flex-col items-center justify-center cursor-default select-none ${
                        !cell ? "" :
                        fastDay ? "bg-purple-500/20 border border-purple-400/40" : "bg-white/30"
                      }`}
                    >
                      {cell && (
                        <>
                          <span className={`text-[11px] font-semibold leading-none ${fastDay ? "text-purple-700" : "text-foreground/70"}`}>
                            {format(cell, "d")}
                          </span>
                          {fastDay && <Moon className="w-2 h-2 text-purple-500 mt-0.5" />}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Festival detail list */}
          {(fastingData.fastingDays?.length ?? 0) > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {fastingData.fastingDays?.map((day: FastingDay) => (
                <div key={day.date} className="flex items-start gap-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <Moon className="w-3 h-3 text-purple-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{lang === "hi" ? day.nameHindi : day.name}</p>
                    <p className="text-[10px] text-muted-foreground">{day.date} · <span className="capitalize">{day.fastingType}</span></p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {day.recommendedFoods.slice(0, 3).map((f: string) => (
                        <span key={f} className="text-[9px] px-1.5 py-0.5 rounded-full bg-background/60 border border-border">{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-3">{fastingData.note}</p>
          {fastingData.isFallbackYear && (
            <p className="text-[10px] text-amber-600/80 mt-1">
              {t(
                `Calendar data is for ${fastingData.dataYear} (exact dates for ${fastingData.year} not yet available — approximate patterns shown).`,
                `कैलेंडर डेटा ${fastingData.dataYear} का है (${fastingData.year} की सटीक तिथियां अभी उपलब्ध नहीं हैं — अनुमानित पैटर्न दिखाया गया है)।`
              )}
            </p>
          )}
        </div>
      )}

      {/* AI Insights */}
      {currentPlan.aiInsights && (
        <div className="glass-card rounded-3xl p-4 border border-secondary/20 flex gap-3">
          <Leaf className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-1">{t("AI Insights", "AI अंतर्दृष्टि")}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{currentPlan.aiInsights}</p>
          </div>
        </div>
      )}

      {/* Per-Member Variations Legend + Expand/Collapse All */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {familyMembers && familyMembers.length > 0 && (
          <div className="glass-card rounded-2xl p-3 flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-muted-foreground mr-1">{t("Plate variations:", "थाली बदलाव:")}</span>
            {familyMembers.map((member, idx) => (
              <span key={member.id} className={`text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${MEMBER_COLORS[idx % MEMBER_COLORS.length]}`}>
                {member.name.split(" ")[0]}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => {
            if (allExpanded) {
              setAllExpanded(false);
              setExpandedDay(null);
            } else {
              setAllExpanded(true);
              setExpandedDay(null);
            }
          }}
          className="text-xs font-medium text-primary glass-card px-3 py-2 rounded-xl hover:bg-white/80 transition-colors shrink-0 flex items-center gap-1"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${allExpanded ? "rotate-180" : ""}`} />
          {allExpanded ? t("Collapse All", "सब बंद करें") : t("Expand All", "सब खोलें")}
        </button>
      </div>

      {/* 7-Day Horizontal Day-Cards with tap-to-expand */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-1 px-1">
        {days.map((day, di) => {
          const dayObj = getDayData(day);
          const dn = dayObj?.dailyNutrition;
          const isToday = day === todayDayName;
          const isExpanded = allExpanded || expandedDay === day;
          const mealTranslations: Record<string, string> = { Breakfast: "नाश्ता", "Mid Morning": "मध्य-सुबह", Lunch: "दोपहर", "Evening Snack": "शाम-नाश्ता", Dinner: "रात", Snack: "शाम-नाश्ता" };
          const breakfastCell = getDayMeal(day, "Breakfast");
          const breakfastPreview = lang === "hi" && breakfastCell.nameHindi
            ? breakfastCell.nameHindi
            : (breakfastCell.recipeName ?? breakfastCell.name ?? "");

          return (
            <motion.div
              key={day}
              layout
              className={`snap-start shrink-0 glass-card rounded-2xl overflow-hidden transition-all ${isExpanded ? "w-[300px] md:w-[340px]" : "w-[120px] md:w-[140px]"} ${isToday ? "ring-2 ring-primary/50" : ""}`}
            >
              {/* Day header — always visible, tap to expand */}
              <button
                type="button"
                onClick={() => {
                  if (allExpanded) {
                    setAllExpanded(false);
                    setExpandedDay(expandedDay === day ? null : day);
                  } else {
                    setExpandedDay(isExpanded ? null : day);
                  }
                }}
                className={`w-full p-3 text-left flex flex-col gap-1 transition-colors ${dayObj?.isFastingDay ? "bg-purple-500/10" : isToday ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div>
                    <div className="flex items-center gap-1">
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day.slice(0, 3)}</p>
                      {isToday && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                    {dayObj?.dailyHarmonyScore && (
                      <p className="text-[10px] font-semibold text-primary">{dayObj.dailyHarmonyScore}% ✦</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {dayObj?.isFastingDay && <Moon className="w-3 h-3 text-purple-500 shrink-0" />}
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </div>
                {!isExpanded && breakfastPreview && breakfastPreview !== "—" && (
                  <p className="text-[9px] text-muted-foreground leading-tight line-clamp-2 mt-0.5">
                    {breakfastPreview}
                  </p>
                )}
                {dn && (
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${dn.calories < 1600 ? "text-red-700 bg-red-50" : dn.calories > 2400 ? "text-amber-700 bg-amber-50" : "text-green-700 bg-green-50"}`}>
                      {dn.calories} kcal
                    </span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${dn.protein < 45 ? "text-red-700 bg-red-50" : "text-green-700 bg-green-50"}`}>
                      {dn.protein}g P
                    </span>
                    {dn.carbs && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-blue-700 bg-blue-50">
                        {dn.carbs}g C
                      </span>
                    )}
                  </div>
                )}
              </button>

              {/* Expanded meal detail */}
              {isExpanded && (
                <div className="border-t border-white/50 divide-y divide-white/40">
                  {meals.map((meal, mi) => {
                    const cell = getDayMeal(day, meal);
                    const feedbackKey = `${di}-${meal}`;
                    const logKey = `${di}-${meal}-log`;
                    const feedback = feedbackState[feedbackKey];
                    const isDinner = meal === "Dinner";
                    const leftoverChain = isDinner ? getLeftoverChain(di) : null;
                    const rationaleKey = `${di}-${meal}`;
                    const instructionsKey = `${di}-${meal}-inst`;
                    const hasRationale = !!cell.icmr_rationale;
                    const hasInstructions = !!(cell.instructions && cell.instructions.length > 0);
                    const hasPlates = !!(cell.member_plates && Object.keys(cell.member_plates).length > 0);

                    return (
                      <div key={meal} className={`p-3 space-y-1.5 ${mealColors[mi]}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {t(meal, mealTranslations[meal] ?? meal)}
                        </p>
                        <p className="text-sm font-medium leading-snug text-foreground">
                          {lang === "hi" && cell.nameHindi ? cell.nameHindi : (cell.recipeName || cell.name || "—")}
                        </p>

                        <div className="flex flex-wrap gap-1">
                          {cell.isLeftover && (
                            <span className="text-[9px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">♻️ {t("Leftover", "बचा")}</span>
                          )}
                          {(cell.calories || 0) > 0 && (
                            <span className="text-[9px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{cell.calories} kcal</span>
                          )}
                          {cell.estimatedCost && (
                            <span className="text-[9px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">₹{cell.estimatedCost}</span>
                          )}
                        </div>

                        {/* "Why this dish?" collapsible — ICMR rationale */}
                        <button
                          type="button"
                          onClick={() => setRationaleExpanded(prev => ({ ...prev, [rationaleKey]: !prev[rationaleKey] }))}
                          className="flex items-center gap-1 text-[9px] text-secondary/80 hover:text-secondary transition-colors"
                        >
                          <HelpCircle className="w-3 h-3 shrink-0" />
                          <span className="font-medium">{t("Why this dish?", "यह क्यों?")}</span>
                          {rationaleExpanded[rationaleKey] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {rationaleExpanded[rationaleKey] && (
                          <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-2 text-[9px] text-secondary/90 leading-relaxed">
                            {hasRationale
                              ? cell.icmr_rationale
                              : t(
                                  "Chosen to meet ICMR-NIN 2024 macronutrient targets and suit this family's health profile.",
                                  "ICMR-NIN 2024 पोषण लक्ष्यों और परिवार की स्वास्थ्य स्थिति के अनुसार चुना गया।"
                                )}
                          </div>
                        )}

                        {/* Cooking instructions collapsible */}
                        <button
                          type="button"
                          onClick={() => setInstructionsExpanded(prev => ({ ...prev, [instructionsKey]: !prev[instructionsKey] }))}
                          className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <BookOpen className="w-3 h-3 shrink-0" />
                          <span className="font-medium">{t("Steps", "विधि")}</span>
                          {instructionsExpanded[instructionsKey] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {instructionsExpanded[instructionsKey] && (
                          <div className="bg-muted/30 border border-border/30 rounded-xl p-2 space-y-1">
                            {hasInstructions
                              ? cell.instructions!.map((step, si) => (
                                  <div key={si} className="flex gap-1.5 text-[9px] text-foreground/80">
                                    <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold">{si + 1}</span>
                                    <span className="leading-relaxed">{step.replace(/^Step \d+:\s*/i, "")}</span>
                                  </div>
                                ))
                              : (
                                <p className="text-[9px] text-muted-foreground italic">
                                  {t("Cooking instructions will appear after generating a new plan.", "नई योजना बनाने के बाद खाना पकाने के निर्देश दिखाई देंगे।")}
                                </p>
                              )
                            }
                          </div>
                        )}

                        {/* Per-member plate cards (structured add/reduce/avoid) */}
                        {familyMembers && familyMembers.length > 0 && (
                          hasPlates ? (
                            <div className="space-y-1.5 pt-0.5">
                              {familyMembers.map((member, idx) => {
                                const firstName = member.name.split(" ")[0];
                                const plate = cell.member_plates?.[member.name] ?? cell.member_plates?.[firstName];
                                const hasStructuredContent = plate && (plate.add.length + plate.reduce.length + plate.avoid.length) > 0;
                                const legacyVariation = cell.memberVariations?.[member.name] ?? cell.memberVariations?.[firstName];
                                const autoVariation = legacyVariation?.trim() || getMemberVariation(member, meal);
                                if (!hasStructuredContent && !autoVariation) return null;
                                return (
                                  <div key={member.id} className={`rounded-xl border p-2 space-y-1 text-[8px] ${MEMBER_COLORS[idx % MEMBER_COLORS.length]}`}>
                                    <p className="font-bold text-[9px] leading-none">{firstName}</p>
                                    {hasStructuredContent ? (
                                      <>
                                        {plate!.add.length > 0 && (
                                          <div className="flex items-start gap-1">
                                            <CheckCircle2 className="w-2.5 h-2.5 text-green-600 shrink-0 mt-0.5" />
                                            <span className="text-green-700">{plate!.add.join(", ")}</span>
                                          </div>
                                        )}
                                        {plate!.reduce.length > 0 && (
                                          <div className="flex items-start gap-1">
                                            <AlertTriangle className="w-2.5 h-2.5 text-amber-500 shrink-0 mt-0.5" />
                                            <span className="text-amber-700">{t("Reduce", "कम करें")}: {plate!.reduce.join(", ")}</span>
                                          </div>
                                        )}
                                        {plate!.avoid.length > 0 && (
                                          <div className="flex items-start gap-1">
                                            <XCircle className="w-2.5 h-2.5 text-red-500 shrink-0 mt-0.5" />
                                            <span className="text-red-600">{t("Avoid", "न लें")}: {plate!.avoid.join(", ")}</span>
                                          </div>
                                        )}
                                      </>
                                    ) : autoVariation ? (
                                      <p className="text-foreground/70">{autoVariation}</p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {familyMembers.map((member, idx) => {
                                const aiVariation = cell.memberVariations?.[member.name] || cell.memberVariations?.[member.name.split(" ")[0]];
                                const variation = (aiVariation && aiVariation.trim()) ? aiVariation : getMemberVariation(member, meal);
                                return variation ? (
                                  <span key={member.id} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${MEMBER_COLORS[idx % MEMBER_COLORS.length]}`}>
                                    {member.name.split(" ")[0]}: {variation}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          )
                        )}

                        {/* Leftover chain */}
                        {isDinner && (cell.leftoverChain?.length ?? 0) > 0 && (
                          <div className="flex items-center gap-1 text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                            <Link2 className="w-2.5 h-2.5" />
                            <span>{cell.leftoverChain?.[0].day.slice(0, 3)} {cell.leftoverChain?.[0].meal}: {cell.leftoverChain?.[0].dish.slice(0, 18)}</span>
                          </div>
                        )}
                        {isDinner && !cell.leftoverChain?.length && leftoverChain && (
                          <div className="flex items-center gap-1 text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                            <Link2 className="w-2.5 h-2.5" />
                            <span>{leftoverChain.nextDay.slice(0, 3)} {leftoverChain.meal}: {leftoverChain.dish.slice(0, 18)}</span>
                          </div>
                        )}

                        {/* Feedback + log actions */}
                        <div className="flex gap-1 pt-0.5">
                          <button
                            onClick={() => handleFeedback(di, meal, true)}
                            className={`p-1.5 rounded-lg transition-colors ${feedback === true ? "text-green-600 bg-green-100" : "text-muted-foreground hover:text-green-600 hover:bg-green-50"}`}
                            title={t("Like", "पसंद")}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleFeedback(di, meal, false)}
                            className={`p-1.5 rounded-lg transition-colors ${feedback === false ? "text-red-500 bg-red-100" : "text-muted-foreground hover:text-red-500 hover:bg-red-50"}`}
                            title={t("Dislike", "नापसंद")}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleLogMeal(cell, meal, logKey)}
                            disabled={loggingMeal === logKey}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                            title={t("Log meal", "लॉग करें")}
                          >
                            {loggingMeal === logKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                          </button>
                          <Link
                            href="/scanner"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-secondary hover:bg-secondary/10 transition-colors text-[9px] font-bold flex items-center"
                            title={t("I ate something else", "कुछ और खाया")}
                          >
                            +alt
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── Per-Member Plates section (5 meal slot tabs) ── */}
      {familyMembers && familyMembers.length > 0 && (
        <div className="glass-card rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.55)" }}>
          {/* Section header */}
          <div className="px-4 pt-4 pb-2">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Utensils className="w-4 h-4 text-primary" />
              {t("Personalised Plates", "व्यक्तिगत थाली")}
              {(expandedDay || days[0]) && (
                <span className="text-[10px] text-muted-foreground font-normal ml-1">— {expandedDay ?? days[0]}</span>
              )}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {t("Select a meal slot to see each member's plate guidance.", "भोजन स्लॉट चुनें — हर सदस्य की थाली देखें।")}
            </p>
          </div>

          {/* 5 meal slot tabs */}
          <div className="flex gap-1 px-4 pb-2 overflow-x-auto">
            {MEAL_SLOTS.map(slot => (
              <button
                key={slot.key}
                type="button"
                onClick={() => setActiveMealTab(slot.key)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                  activeMealTab === slot.key
                    ? "bg-primary text-white shadow-sm"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {lang === "hi" ? slot.labelHi : slot.label}
              </button>
            ))}
          </div>

          {/* Per-member plate cards for selected tab */}
          {(() => {
            const activeDay = expandedDay ?? days[0];
            const slotInfo = MEAL_SLOTS.find(s => s.key === activeMealTab);
            const mealLabel = activeMealTab.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
            const mealCell = getDayMeal(activeDay, mealLabel);
            const dishName = lang === "hi" && mealCell.nameHindi ? mealCell.nameHindi : (mealCell.recipeName || mealCell.name || "—");

            return (
              <div className="px-4 pb-4 space-y-2">
                {/* Active meal dish name */}
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-foreground">{dishName}</p>
                  {(mealCell.calories || 0) > 0 && (
                    <span className="text-[9px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{mealCell.calories} kcal</span>
                  )}
                  {mealCell.estimatedCost && (
                    <span className="text-[9px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">₹{mealCell.estimatedCost}</span>
                  )}
                </div>

                {/* Member plate cards */}
                <div className="grid grid-cols-1 gap-2">
                  {familyMembers.map((member, idx) => {
                    const firstName = member.name.split(" ")[0];
                    const plate = mealCell.member_plates?.[member.name] ?? mealCell.member_plates?.[firstName];
                    const hasStructuredContent = plate && (plate.add.length + plate.reduce.length + plate.avoid.length) > 0;
                    const legacyVariation = mealCell.memberVariations?.[member.name] ?? mealCell.memberVariations?.[firstName];
                    const fallback = legacyVariation?.trim() || getMemberVariation(member, slotInfo?.label ?? activeMealTab);

                    return (
                      <div key={member.id} className={`rounded-2xl border p-3 space-y-1.5 ${MEMBER_COLORS[idx % MEMBER_COLORS.length]}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs">{member.name}</span>
                          {member.role && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/50 text-muted-foreground">{member.role}</span>
                          )}
                        </div>
                        {hasStructuredContent ? (
                          <>
                            {plate!.add.length > 0 && (
                              <div className="flex items-start gap-1.5">
                                <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-[9px] font-semibold text-green-700">{t("Add", "जोड़ें")}: </span>
                                  <span className="text-[9px] text-green-700/80">{plate!.add.join(", ")}</span>
                                </div>
                              </div>
                            )}
                            {plate!.reduce.length > 0 && (
                              <div className="flex items-start gap-1.5">
                                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-[9px] font-semibold text-amber-700">{t("Reduce", "कम करें")}: </span>
                                  <span className="text-[9px] text-amber-700/80">{plate!.reduce.join(", ")}</span>
                                </div>
                              </div>
                            )}
                            {plate!.avoid.length > 0 && (
                              <div className="flex items-start gap-1.5">
                                <XCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-[9px] font-semibold text-red-600">{t("Avoid", "न लें")}: </span>
                                  <span className="text-[9px] text-red-600/80">{plate!.avoid.join(", ")}</span>
                                </div>
                              </div>
                            )}
                          </>
                        ) : fallback ? (
                          <p className="text-[9px] text-foreground/70">{fallback}</p>
                        ) : (
                          <p className="text-[9px] text-muted-foreground italic">{t("Standard serving — no specific modifications needed.", "सामान्य मात्रा — कोई विशेष बदलाव नहीं।")}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ICMR rationale for this slot */}
                {mealCell.icmr_rationale && (
                  <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-2.5 flex gap-2">
                    <Info className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" />
                    <p className="text-[9px] text-secondary/90 leading-relaxed">{mealCell.icmr_rationale}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Dietary note */}
      <div className="glass-card rounded-3xl p-5" style={{ background: "rgba(240,253,248,0.65)" }}>
        <div className="flex gap-3 relative z-10">
          <div className="w-8 h-8 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
            <Info className="w-4 h-4 text-secondary" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-secondary mb-1">{t("Dietary Assurance", "आहार आश्वासन")}</h4>
            <p className="text-xs text-secondary/80 leading-relaxed">
              {t(
                "Strictly adheres to ICMR-NIN 2024 guidelines. Expand any day card to see per-meal rationale, cooking steps, and per-member add/reduce/avoid plate guidance.",
                "ICMR-NIN 2024 दिशानिर्देशों का पालन। दिन का कार्ड खोलें — प्रत्येक भोजन का कारण, खाना पकाने के चरण, और सदस्य-विशेष थाली मार्गदर्शन देखें।"
              )}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
