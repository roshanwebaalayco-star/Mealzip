import { apiFetch } from "@/lib/api-fetch";
import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/contexts/language-context";
import { useListMealPlans, useGenerateMealPlan, getListMealPlansQueryKey } from "@workspace/api-client-react";
import {
  Loader2, Sparkles, Utensils, Info, RefreshCw, ThumbsUp, ThumbsDown,
  CalendarDays, Moon, Leaf, Link2, Camera, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, XCircle, BookOpen, HelpCircle, ExternalLink,
  FlaskConical, Clock3, RefreshCcw, TrendingDown, Mic, SkipForward, UtensilsCrossed,
  X, Plus, Timer
} from "lucide-react";
import { recordOnce } from "@/lib/audio-utils";
import { format, startOfMonth, getDaysInMonth, getDay, addDays } from "date-fns";
import { HarmonyScore } from "@/components/HarmonyScore";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ThaliScoreBadge from "@/components/ThaliScoreBadge";
import { getPrepsForMeals, type PrepReminder } from "@/lib/prep-reminders";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

interface RecipeDetail {
  id: number;
  name: string;
  nameHindi?: string | null;
  cuisine?: string | null;
  diet?: string | null;
  course?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  iron?: number | null;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  totalTimeMin?: number | null;
  servings?: number | null;
  costPerServing?: number | null;
  ingredients?: string | null;
  instructions?: string | null;
  imageUrl?: string | null;
  icmr_rationale?: string;
}

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
  description?: string;
  calories?: number;
  estimatedCost?: number;
  isLeftover?: boolean;
  notes?: string;
  recipeId?: number | null;
  memberVariations?: Record<string, string>;
  leftoverChain?: LeftoverStep[];
  icmr_rationale?: string;
  _hfssRebalance?: { detectedAt: string; items: string[]; totalKcal: number; rebalanceNote: string } | null;
  instructions?: string[];
  ingredients?: string[];
  base_dish_name?: string;
  base_ingredients?: Array<{ ingredient: string; qty_grams?: number }>;
  member_plates?: Record<string, MemberPlate>;
  _validationReplaced?: boolean;
  _candidateSelected?: boolean;
  _originalDish?: string;
  _violations?: string[];
  _thaliScore?: number;
  _thaliPresent?: string[];
  _thaliMissing?: string[];
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
  dataYear: number | null;
  isFallbackYear: boolean;
  isFestivalFasting?: boolean;
  festivals?: FastingDay[];
  fastingDays: FastingDay[];
  generalFastingDays?: FastingDay[];
  totalFestivalsInMonth?: number;
  message?: string | null;
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

const CONDITION_BADGES: Record<string, { label: string; labelHi: string; color: string; icon: string }> = {
  diabetes:        { label: "Diabetic",        labelHi: "मधुमेह",    color: "bg-rose-100 text-rose-700 border-rose-300",         icon: "🍬" },
  diabetes_type2:  { label: "Diabetic T2",     labelHi: "मधुमेह T2", color: "bg-rose-100 text-rose-700 border-rose-300",         icon: "🍬" },
  anemia:          { label: "Anemic",           labelHi: "रक्ताल्पता",color: "bg-red-100 text-red-700 border-red-300",            icon: "🩸" },
  iron_deficiency: { label: "Iron Low",         labelHi: "आयरन कम",   color: "bg-red-100 text-red-700 border-red-300",            icon: "🩸" },
  hypertension:    { label: "BP",               labelHi: "BP",        color: "bg-amber-100 text-amber-700 border-amber-300",      icon: "💉" },
  blood_pressure:  { label: "BP",               labelHi: "BP",        color: "bg-amber-100 text-amber-700 border-amber-300",      icon: "💉" },
  obesity:         { label: "Weight Loss",      labelHi: "वजन घटाएं", color: "bg-orange-100 text-orange-700 border-orange-300",   icon: "⚖️" },
  weight_loss:     { label: "Weight Loss",      labelHi: "वजन घटाएं", color: "bg-orange-100 text-orange-700 border-orange-300",   icon: "⚖️" },
  growing_child:   { label: "Growing Child",    labelHi: "बढ़ता बच्चा",color: "bg-green-100 text-green-700 border-green-300",     icon: "🌱" },
  thyroid:         { label: "Thyroid",          labelHi: "थायरॉइड",   color: "bg-purple-100 text-purple-700 border-purple-300",  icon: "🦋" },
  pcod:            { label: "PCOD",             labelHi: "PCOD",      color: "bg-pink-100 text-pink-700 border-pink-300",        icon: "🌸" },
};

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
  const [, setLocation] = useLocation();
  const [leftoverPanelOpen, setLeftoverPanelOpen] = useState(true);
  const [cachedPlan, setCachedPlan] = useState<Record<string, unknown> | null>(null);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [leftoverInput, setLeftoverInput] = useState("");
  const [isRecordingLeftover, setIsRecordingLeftover] = useState(false);
  const [skippedMeals, setSkippedMeals] = useState<Record<string, "skip" | "ate_out">>({});
  const [rebalanceBanner, setRebalanceBanner] = useState<{ dayIndex: number; nextMealType: string; suggestion: string; suggestionHi: string } | null>(null);

  // Determine today's day name (e.g., "Monday")
  const todayDayName = useMemo(() => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return dayNames[new Date().getDay()];
  }, []);

  const MEAL_PLAN_CACHE_KEY = `meal_plan_cache_${familyId}`;

  const { data: plans, isLoading, isError, refetch } = useListMealPlans(
    { familyId },
    { query: { enabled: !!activeFamily, queryKey: getListMealPlansQueryKey({ familyId }) } }
  );

  // Write successful plans to localStorage; fall back to cache on error
  useEffect(() => {
    if (plans && plans.length > 0) {
      try { localStorage.setItem(MEAL_PLAN_CACHE_KEY, JSON.stringify(plans[0])); } catch { /* ignore */ }
      setShowOfflineBanner(false);
    }
  }, [plans, MEAL_PLAN_CACHE_KEY]);

  useEffect(() => {
    if (isError && familyId) {
      try {
        const raw = localStorage.getItem(MEAL_PLAN_CACHE_KEY);
        if (raw) {
          setCachedPlan(JSON.parse(raw) as Record<string, unknown>);
          setShowOfflineBanner(true);
        }
      } catch { /* ignore */ }
    } else if (!isError) {
      setShowOfflineBanner(false);
    }
  }, [isError, familyId, MEAL_PLAN_CACHE_KEY]);

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

  const tomorrowPrepReminders = useMemo((): PrepReminder[] => {
    const raw = plans?.[0]?.plan;
    if (!raw) return [];
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const tomorrowName = dayNames[(new Date().getDay() + 1) % 7];
    const dayArr = parsed?.days as Array<{
      day: string;
      meals: Record<string, {
        ingredients?: string[];
        base_ingredients?: Array<{ ingredient: string; qty_grams?: number }>;
        recipeName?: string;
        base_dish_name?: string;
      }>;
    }> | undefined;
    const tomorrowData = dayArr?.find(d => d.day === tomorrowName);
    if (!tomorrowData) return [];
    const mealEntries = Object.entries(tomorrowData.meals).map(([mealType, meal]) => ({
      mealType,
      ingredients: meal.ingredients ?? [],
      base_ingredients: meal.base_ingredients ?? [],
      recipeName: meal.recipeName,
      base_dish_name: meal.base_dish_name,
    }));
    return getPrepsForMeals(mealEntries);
  }, [plans]);

  const arbitrageData = useMemo(() => {
    const raw = plans?.[0]?.plan;
    if (!raw) return { mods: [] as Array<{ original: string; substituted: string; savingPerKg: number }>, saving: 0 };
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const mods = (Array.isArray(parsed?.arbitrageMods) ? parsed.arbitrageMods : []) as Array<{ original: string; substituted: string; savingPerKg: number }>;
    return { mods, saving: Number(parsed?.arbitrageSaving ?? 0) };
  }, [plans]);

  interface LeftoverItemData {
    id: number;
    ingredientName: string;
    quantityEstimate?: string | null;
    hoursRemaining: number;
  }
  const { data: activeLeftovers, refetch: refetchLeftovers } = useQuery<LeftoverItemData[]>({
    queryKey: ["leftovers", familyId],
    queryFn: async () => {
      const res = await apiFetch(`/api/leftovers?familyId=${familyId}`);
      return res.json() as Promise<LeftoverItemData[]>;
    },
    enabled: !!familyId,
  });

  const quickChips = useMemo(() => {
    const raw = plans?.[0]?.plan;
    if (!raw) return [];
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = dayNames[new Date().getDay()];
    const dayArr = parsed?.days as DayData[] | undefined;
    const todayData = dayArr?.find(d => d.day === todayName);
    if (!todayData) return [];
    const chips = new Set<string>();
    Object.values(todayData.meals).forEach((cell: MealCell) => {
      const ingredients = cell.ingredients ?? [];
      ingredients.forEach((ing: string) => {
        const cleaned = ing.replace(/^[\d./]+\s*(g|grams?|kg|ml|cups?|tsp|tbsp|pieces?)\s*/i, "").trim();
        if (cleaned.length > 2 && !["salt", "water", "oil", "ghee", "sugar", "haldi", "mirch"].includes(cleaned.toLowerCase())) {
          chips.add(cleaned.split(",")[0].trim().slice(0, 30));
        }
      });
      const name = cell.recipeName ?? cell.name;
      if (name && name !== "—") {
        const parts = name.split(/\s+/);
        parts.forEach(p => {
          const lower = p.toLowerCase();
          if (["rice", "dal", "roti", "sabzi", "paneer", "chicken", "rajma", "chole", "chawal", "dosa", "idli", "paratha", "poha"].includes(lower)) {
            chips.add(p);
          }
        });
      }
    });
    return Array.from(chips).slice(0, 12);
  }, [plans]);

  const leftoverLogMutation = useMutation({
    mutationFn: async (items: Array<{ ingredientName: string; quantityEstimate?: string }>) => {
      const res = await apiFetch("/api/leftovers/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId, items }),
      });
      return res.json();
    },
    onSuccess: () => {
      refetchLeftovers();
      setLeftoverInput("");
      toast({ title: t("Leftovers logged!", "बचा खाना लॉग हो गया!") });
    },
  });

  const dismissLeftoverMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/leftovers/${id}`, { method: "PATCH" });
      return res.json();
    },
    onSuccess: () => refetchLeftovers(),
  });

  const handleLogLeftoverChip = (chip: string) => {
    leftoverLogMutation.mutate([{ ingredientName: chip }]);
  };

  const handleLogLeftoverText = () => {
    const items = leftoverInput.split(",").map(s => s.trim()).filter(Boolean).map(s => ({ ingredientName: s }));
    if (items.length > 0) leftoverLogMutation.mutate(items);
  };

  const handleVoiceLeftover = async () => {
    setIsRecordingLeftover(true);
    try {
      const transcript = await recordOnce({ languageCode: "hi-IN", maxDurationMs: 6000 });
      if (transcript) {
        const items = transcript.split(/[,;]+/).map(s => s.trim()).filter(s => s.length > 1).map(s => ({ ingredientName: s }));
        if (items.length > 0) leftoverLogMutation.mutate(items);
        else setLeftoverInput(transcript);
      }
    } catch {
      toast({ title: t("Voice input failed", "वॉइस इनपुट विफल"), variant: "destructive" });
    } finally {
      setIsRecordingLeftover(false);
    }
  };

  const REBALANCE_SUGGESTIONS: Record<string, { en: string; hi: string }> = {
    protein: { en: "Add a boiled egg + curd to compensate for protein", hi: "प्रोटीन की भरपाई के लिए उबला अंडा + दही जोड़ें" },
    carbs: { en: "Add extra roti or rice to meet energy needs", hi: "ऊर्जा की जरूरत के लिए अतिरिक्त रोटी या चावल जोड़ें" },
    balanced: { en: "Add a banana + handful of nuts for balanced nutrition", hi: "संतुलित पोषण के लिए एक केला + मुट्ठी भर मेवे जोड़ें" },
    light: { en: "Add a glass of buttermilk + fruit for easy nutrition", hi: "आसान पोषण के लिए एक गिलास छाछ + फल जोड़ें" },
  };

  const handleSkipMeal = (dayIndex: number, mealType: string, action: "skip" | "ate_out") => {
    const key = `${dayIndex}-${mealType}`;
    setSkippedMeals(prev => ({ ...prev, [key]: action }));

    if (currentPlan) {
      feedbackMutation.mutate({
        dayIndex,
        mealType,
        liked: false,
        mealPlanId: currentPlan.id,
      }, {
        onSuccess: () => {
          apiFetch(`/api/meal-plans/${currentPlan.id}/feedback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ familyId, dayIndex, mealType, liked: false, action }),
          }).catch(() => {});
        },
      });
    }

    const mealOrder = ["Breakfast", "Mid Morning", "Lunch", "Evening Snack", "Dinner"];
    const currentIndex = mealOrder.indexOf(mealType);
    const nextMeal = currentIndex < mealOrder.length - 1 ? mealOrder[currentIndex + 1] : null;
    if (nextMeal) {
      const mealCell = getDayMeal(days[dayIndex] || "", mealType);
      const calories = mealCell?.calories ?? 0;
      let sugType = "balanced";
      if (calories > 400) sugType = "protein";
      else if (mealType === "Breakfast" || mealType === "Lunch") sugType = "carbs";
      else sugType = "light";
      const sug = REBALANCE_SUGGESTIONS[sugType];
      setRebalanceBanner({ dayIndex, nextMealType: nextMeal, suggestion: sug.en, suggestionHi: sug.hi });
    }
  };


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

  const currentPlan = plans?.[0] ?? (showOfflineBanner ? cachedPlan as unknown as NonNullable<typeof plans>[number] : undefined);

  if (!currentPlan) {
    return (
      <div className="p-6 md:p-12 flex flex-col items-center justify-center text-center">
        <div className="glass-card rounded-3xl p-10 max-w-md w-full">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Utensils className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-medium mb-2 relative z-10">{t("No Meal Plan Yet", "अभी कोई भोजन योजना नहीं")}</h2>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed relative z-10">
            {t("Generate an AI-powered 7-day plan optimized for your family's health, budget & tastes using ICMR-NIN 2024 guidelines.", "ICMR-NIN 2024 दिशानिर्देशों का उपयोग करके आपके परिवार के स्वास्थ्य, बजट और स्वाद के लिए AI-संचालित 7-दिवसीय योजना बनाएं।")}
          </p>
          <div className="flex flex-col gap-3">
            <button
              className="btn-liquid w-full inline-flex items-center justify-center gap-2 bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-sm font-semibold px-6 py-3.5 rounded-2xl relative z-10 disabled:opacity-60"
              onClick={() => setLocation("/meal-plan/context")}
              disabled={generate.isPending}
            >
              {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {t("Generate AI Plan", "AI योजना बनाएं")}
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

  const openMealDetail = (cell: MealCell, cellKey: string) => {
    const name = cell.recipeName ?? cell.name ?? "Unknown";
    const basic: RecipeDetail = {
      id: cell.recipeId ?? -1,
      name,
      nameHindi: cell.nameHindi,
      calories: cell.calories,
      costPerServing: cell.estimatedCost,
      instructions: cell.instructions ? cell.instructions.join("\n") : null,
      ingredients: cell.ingredients ? cell.ingredients.join(" | ") : null,
      icmr_rationale: cell.icmr_rationale,
    };
    if (cell.recipeId && cell.recipeId > 0) {
      sessionStorage.setItem("pending_recipe_detail", JSON.stringify(basic));
      setLocation(`/recipes/${cell.recipeId}`);
    } else {
      sessionStorage.setItem("pending_recipe_detail", JSON.stringify({ ...basic, id: 0 }));
      setLocation(`/recipes/0`);
    }
  };

  const mealColors = ["bg-orange-50/60", "bg-amber-50/50", "bg-emerald-50/50", "bg-violet-50/40", "bg-blue-50/40"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className="p-4 md:p-8 space-y-5"
    >
      {/* Offline cached plan banner */}
      {showOfflineBanner && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-300 bg-amber-50 text-amber-800 text-sm font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
          <span className="flex-1">
            {t(
              "📱 Showing cached plan — connect to internet to refresh",
              "📱 कैश प्लान दिखाया जा रहा है — ताज़ा करने के लिए इंटरनेट से जुड़ें"
            )}
          </span>
          <button
            onClick={() => refetch()}
            className="text-xs font-semibold underline underline-offset-2 shrink-0"
          >
            {t("Retry", "पुनः प्रयास")}
          </button>
        </div>
      )}
      {/* Header */}
      <div className="glass-elevated rounded-3xl p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div className="relative z-10">
          <p className="label-caps mb-1" style={{ color: 'var(--brand-600)' }}>
            {t("Weekly Plan", "साप्ताहिक योजना")}
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold leading-tight" style={{ letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
            {t("Weekly Meal Plan", "साप्ताहिक भोजन योजना")}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {format(new Date(currentPlan.weekStartDate), "MMM d, yyyy")}
          </p>
          {/* Budget tracker — green < 80%, orange 80-100%, red > 100% */}
          {(() => {
            const weeklyBudget = activeFamily.monthlyBudget ? Math.round(Number(activeFamily.monthlyBudget) / 4) : null;
            const spent = currentPlan.totalBudgetEstimate ?? 0;
            const pct = weeklyBudget ? Math.min(110, Math.round((spent / weeklyBudget) * 100)) : null;
            const overBudget = weeklyBudget && spent > weeklyBudget;
            const nearBudget = weeklyBudget && !overBudget && pct !== null && pct >= 80;
            const barColor = overBudget ? "bg-red-500" : nearBudget ? "bg-orange-400" : "bg-green-500";
            const labelColor = overBudget ? "text-red-600" : nearBudget ? "text-orange-600" : "text-green-700";
            const badgeClass = overBudget ? "bg-red-50 text-red-600" : nearBudget ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-700";
            return (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className={`font-bold ${labelColor}`}>
                    ₹{spent.toLocaleString("en-IN")}
                  </span>
                  {weeklyBudget && (
                    <span className="text-muted-foreground">/ ₹{weeklyBudget.toLocaleString("en-IN")} {t("budget", "बजट")}</span>
                  )}
                  {pct !== null && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badgeClass}`}>
                      {Math.min(pct, 100)}%
                    </span>
                  )}
                  {weeklyBudget && !overBudget && (
                    <span className="text-xs text-muted-foreground">
                      · ₹{Math.max(0, weeklyBudget - spent).toLocaleString("en-IN")} {t("remaining", "शेष")}
                    </span>
                  )}
                  {overBudget && weeklyBudget && (
                    <span className="text-xs text-red-500 font-semibold">
                      · ₹{Math.abs(weeklyBudget - spent).toLocaleString("en-IN")} {t("over budget", "बजट से अधिक")}
                    </span>
                  )}
                </div>
                {pct !== null && (
                  <div className="w-40 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })()}
          {Boolean((currentPlan.nutritionSummary as Record<string, unknown> | null)?.isFasting) && (
            <Badge className="mt-2 bg-purple-500/20 text-purple-700 border-purple-500/30">
              <Moon className="w-3 h-3 mr-1" /> {t("Fasting Plan", "व्रत योजना")}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          <button
            onClick={() => setLocation("/meal-plan/context")}
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
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-2">
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
            <Badge variant="secondary" className="text-xs">
              {fastingData.isFallbackYear
                ? `${fastingData.generalFastingDays?.length ?? 0} ${t("estimated", "अनुमानित")}`
                : `${fastingData.totalFestivalsInMonth ?? fastingData.fastingDays?.length ?? 0} ${t("events", "कार्यक्रम")}`
              }
            </Badge>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <div key={d} className="text-center text-xs font-bold text-muted-foreground py-1">{d}</div>
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
                  const activeDays = fastingData.isFallbackYear
                    ? (fastingData.generalFastingDays ?? [])
                    : (fastingData.fastingDays ?? []);
                  const fastDay = cell
                    ? activeDays.find((fd: FastingDay) => fd.date === format(cell, "yyyy-MM-dd"))
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

          {/* Fallback year warning badge */}
          {fastingData.isFallbackYear && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold mb-3">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              {t(
                "⚠️ Using estimated fasting dates — exact festival calendar for this year not yet available.",
                "⚠️ अनुमानित व्रत तिथियां — इस वर्ष का सटीक त्योहार कैलेंडर अभी उपलब्ध नहीं है।"
              )}
            </div>
          )}

          {/* Festival detail list (known data) */}
          {(fastingData.fastingDays?.length ?? 0) > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {fastingData.fastingDays?.map((day: FastingDay) => (
                <div key={day.date} className="flex items-start gap-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <Moon className="w-3 h-3 text-purple-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{lang === "hi" ? day.nameHindi : day.name}</p>
                    <p className="text-xs text-muted-foreground">{day.date} · <span className="capitalize">{day.fastingType}</span></p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {day.recommendedFoods.slice(0, 3).map((f: string) => (
                        <span key={f} className="text-[11px] px-1.5 py-0.5 rounded-full bg-background/60 border border-border">{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Estimated Ekadashi dates for fallback years */}
          {fastingData.isFallbackYear && (fastingData.generalFastingDays?.length ?? 0) > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-amber-700 mb-2">
                {t("Estimated Ekadashi Dates (lunar calculation)", "अनुमानित एकादशी तिथियां (चंद्र गणना)")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {fastingData.generalFastingDays?.map((day: FastingDay) => (
                  <div key={day.date} className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/30">
                    <Moon className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{lang === "hi" ? day.nameHindi : day.name}</p>
                      <p className="text-xs text-muted-foreground">{day.date} · partial fast</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {day.recommendedFoods.slice(0, 3).map((f: string) => (
                          <span key={f} className="text-[11px] px-1.5 py-0.5 rounded-full bg-background/60 border border-border">{f}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-3">{fastingData.note}</p>
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

      {/* ♻️ Leftover Router — Log what's left in the fridge */}
      <div className="glass-card rounded-3xl p-5 border border-emerald-200/60" style={{ background: "rgba(236,253,245,0.65)" }}>
        <div className="flex items-center gap-2 mb-3">
          <RefreshCcw className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-sm text-emerald-800">{t("Log Leftovers", "बचा खाना लॉग करें")}</h3>
          {(activeLeftovers?.length ?? 0) > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 ml-auto">
              {activeLeftovers!.length} {t("active", "सक्रिय")}
            </span>
          )}
        </div>

        {quickChips.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-emerald-700/70 mb-1.5 font-medium">{t("Quick add from today's plan:", "आज की योजना से जल्दी जोड़ें:")}</p>
            <div className="flex flex-wrap gap-1.5">
              {quickChips.map(chip => (
                <button
                  key={chip}
                  onClick={() => handleLogLeftoverChip(chip)}
                  disabled={leftoverLogMutation.isPending}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={leftoverInput}
            onChange={e => setLeftoverInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogLeftoverText()}
            placeholder={t("Type: rice, dal, sabzi...", "टाइप करें: चावल, दाल, सब्जी...")}
            className="flex-1 text-xs bg-white/80 border border-emerald-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 placeholder:text-emerald-400"
          />
          <button
            onClick={handleLogLeftoverText}
            disabled={!leftoverInput.trim() || leftoverLogMutation.isPending}
            className="p-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleVoiceLeftover}
            disabled={isRecordingLeftover}
            className={`p-2 rounded-xl transition-colors ${isRecordingLeftover ? "bg-red-500 text-white animate-pulse" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
            title={t("Voice input", "वॉइस इनपुट")}
          >
            <Mic className="w-4 h-4" />
          </button>
        </div>

        {(activeLeftovers?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {activeLeftovers!.map(item => (
              <div key={item.id} className="flex items-center gap-1 text-xs bg-white border border-emerald-200 rounded-full pl-2.5 pr-1 py-0.5">
                <span className="font-medium text-emerald-800">{item.ingredientName}</span>
                <span className="text-emerald-500 flex items-center gap-0.5">
                  <Timer className="w-2.5 h-2.5" />{item.hoursRemaining}h
                </span>
                <button
                  onClick={() => dismissLeftoverMutation.mutate(item.id)}
                  className="p-2 -m-1.5 rounded-full hover:bg-emerald-100 text-emerald-400 hover:text-emerald-700 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-emerald-600/60 mt-2 italic">
          {t("Leftovers auto-expire after 48h. They'll be prioritized in your next plan regeneration.", "बचा खाना 48 घंटे बाद स्वतः समाप्त हो जाता है। अगली योजना में इसे प्राथमिकता दी जाएगी।")}
        </p>
      </div>

      {/* ♻️ Leftover Intelligence panel — collapsible */}
      {(() => {
        const chains: { day: string; meal: string; dish: string; isLeftover: boolean; icmrVerified: boolean }[] = [];
        const dayArr = planData?.days as DayData[] | undefined;
        dayArr?.forEach(dayObj => {
          Object.entries(dayObj.meals ?? {}).forEach(([mealKey, cell]) => {
            const c = cell as MealCell;
            if (c.isLeftover && c.recipeName) {
              chains.push({ day: dayObj.day, meal: mealKey, dish: c.recipeName, isLeftover: true, icmrVerified: !!c.icmr_rationale });
            }
            c.leftoverChain?.forEach(step => {
              chains.push({ day: step.day, meal: step.meal, dish: step.dish, isLeftover: false, icmrVerified: !!c.icmr_rationale });
            });
          });
        });
        if (chains.length === 0) return null;
        return (
          <div className="glass-card rounded-3xl border border-amber-200/60 overflow-hidden" style={{ background: "rgba(255,251,235,0.75)" }}>
            {/* Collapsible header */}
            <button
              className="w-full flex items-center gap-2 p-4 text-left"
              onClick={() => setLeftoverPanelOpen(o => !o)}
            >
              <Link2 className="w-4 h-4 text-amber-600 shrink-0" />
              <h3 className="font-bold text-sm text-amber-800 flex-1">{t("♻️ Leftover Intelligence", "♻️ बचे भोजन की बुद्धिमानी")}</h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                {chains.length} {t("reuse links", "पुनः उपयोग")}
              </span>
              <ChevronDown className={`w-4 h-4 text-amber-600 transition-transform duration-200 ${leftoverPanelOpen ? "rotate-180" : ""}`} />
            </button>
            {leftoverPanelOpen && (
              <div className="px-4 pb-4">
                <div className="space-y-1.5">
                  {chains.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center font-bold text-[11px]">{i + 1}</span>
                      <span className="font-medium text-amber-900">{c.day.slice(0, 3)} {c.meal.replace(/_/g, " ")}: {c.dish.slice(0, 30)}</span>
                      <span className={`ml-auto shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${c.icmrVerified ? "bg-green-50 text-green-700 border-green-300" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                        {c.icmrVerified ? "✓ ICMR Verified" : "AI Suggested"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-700/70 mt-2 italic">
                  {t("Cooking extra saves time, money & reduces food waste — ICMR-NIN 2024 recommends batch cooking.", "अतिरिक्त पकाने से समय, पैसा बचता है — ICMR-NIN 2024 बैच कुकिंग की सिफारिश करता है।")}
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Per-Member Variations Legend + Expand/Collapse All */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {familyMembers && familyMembers.length > 0 && (
          <div className="glass-card rounded-2xl p-3 flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-muted-foreground mr-1">{t("Plate variations:", "थाली बदलाव:")}</span>
            {familyMembers.map((member, idx) => (
              <span key={member.id} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${MEMBER_COLORS[idx % MEMBER_COLORS.length]}`}>
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
                      <p className={`text-xs font-bold uppercase tracking-widest ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day.slice(0, 3)}</p>
                      {isToday && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                    {dayObj?.dailyHarmonyScore && (
                      <p className="text-xs font-semibold text-primary">{dayObj.dailyHarmonyScore}% ✦</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {dayObj?.isFastingDay && <Moon className="w-3 h-3 text-purple-500 shrink-0" />}
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </div>
                {!isExpanded && breakfastPreview && breakfastPreview !== "—" && (
                  <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2 mt-0.5">
                    {breakfastPreview}
                  </p>
                )}
                {dn && (
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${dn.calories < 1600 ? "text-red-700 bg-red-50" : dn.calories > 2400 ? "text-amber-700 bg-amber-50" : "text-green-700 bg-green-50"}`}>
                      {dn.calories} kcal
                    </span>
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${dn.protein < 45 ? "text-red-700 bg-red-50" : "text-green-700 bg-green-50"}`}>
                      {dn.protein}g P
                    </span>
                    {dn.carbs && (
                      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full text-blue-700 bg-blue-50">
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

                    const cellKey = `${di}-${meal}`;
                    const displayMealName = lang === "hi" && cell.nameHindi ? cell.nameHindi : (cell.recipeName || cell.name || "—");
                    const isSkipped = !!skippedMeals[feedbackKey];
                    const skipAction = skippedMeals[feedbackKey];

                    return (
                      <div key={meal} className={`p-3 space-y-1.5 ${mealColors[mi]} ${isSkipped ? "opacity-60" : ""}`}>
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            {t(meal, mealTranslations[meal] ?? meal)}
                          </p>
                          {isSkipped && (
                            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${skipAction === "skip" ? "bg-orange-100 text-orange-600" : "bg-violet-100 text-violet-600"}`}>
                              {skipAction === "skip" ? t("Skipped", "छोड़ा") : t("Ate Out", "बाहर खाया")}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => displayMealName !== "—" && openMealDetail(cell, cellKey)}
                          className={`text-left text-sm font-medium leading-snug hover:text-primary transition-colors group flex items-start gap-1 w-full ${isSkipped ? "line-through text-muted-foreground" : "text-foreground"}`}
                          title={t("View recipe details", "रेसिपी विवरण देखें")}
                        >
                          <span className="flex-1">{displayMealName}</span>
                          {displayMealName !== "—" && (
                            <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                          )}
                        </button>
                        {displayMealName !== "—" && (
                          <p className="text-[11px] text-secondary/60 leading-none -mt-0.5">
                            📚 ICMR-NIN 2024 · {t("Science-backed nutrition", "विज्ञान-आधारित पोषण")}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-1">
                          {cell.isLeftover && (
                            <span className="text-[11px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">♻️ {t("Leftover", "बचा")}</span>
                          )}
                          {cell._hfssRebalance && (
                            <span className="text-[11px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-full" title={cell._hfssRebalance.rebalanceNote}>🔄 {t("Rebalanced", "पुनर्संतुलित")}</span>
                          )}
                          {(cell.calories || 0) > 0 && (
                            <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{cell.calories} kcal</span>
                          )}
                          {cell.estimatedCost && (
                            <span className="text-[11px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">₹{cell.estimatedCost}</span>
                          )}
                          {(cell._validationReplaced) && (
                            <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200" title={Array.isArray(cell._violations) ? cell._violations.join("; ") : ""}>
                              🛡️ {t("Safe swap", "सुरक्षित बदलाव")}
                            </span>
                          )}
                        </div>
                        {displayMealName !== "—" && (
                          <ThaliScoreBadge meal={cell} compact={false} />
                        )}

                        {/* "Why this dish?" collapsible — ICMR rationale */}
                        <button
                          type="button"
                          onClick={() => setRationaleExpanded(prev => ({ ...prev, [rationaleKey]: !prev[rationaleKey] }))}
                          className="flex items-center gap-1 text-[11px] text-secondary/80 hover:text-secondary transition-colors min-h-[44px]"
                        >
                          <HelpCircle className="w-3 h-3 shrink-0" />
                          <span className="font-medium">{t("Why this dish?", "यह क्यों?")}</span>
                          {rationaleExpanded[rationaleKey] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {rationaleExpanded[rationaleKey] && (
                          <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-2 text-[11px] text-secondary/90 leading-relaxed">
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
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
                        >
                          <BookOpen className="w-3 h-3 shrink-0" />
                          <span className="font-medium">{t("Steps", "विधि")}</span>
                          {instructionsExpanded[instructionsKey] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {instructionsExpanded[instructionsKey] && (
                          <div className="bg-muted/30 border border-border/30 rounded-xl p-2 space-y-1">
                            {hasInstructions
                              ? cell.instructions!.map((step, si) => (
                                  <div key={si} className="flex gap-1.5 text-[11px] text-foreground/80">
                                    <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold">{si + 1}</span>
                                    <span className="leading-relaxed">{step.replace(/^Step \d+:\s*/i, "")}</span>
                                  </div>
                                ))
                              : (
                                <p className="text-[11px] text-muted-foreground italic">
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
                                  <div key={member.id} className={`rounded-xl border p-2 space-y-1 text-[11px] ${MEMBER_COLORS[idx % MEMBER_COLORS.length]}`}>
                                    <p className="font-bold text-[11px] leading-none">{firstName}</p>
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
                                  <span key={member.id} className={`text-[11px] px-1.5 py-0.5 rounded-full border ${MEMBER_COLORS[idx % MEMBER_COLORS.length]}`}>
                                    {member.name.split(" ")[0]}: {variation}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          )
                        )}

                        {/* Leftover chain — all 3 steps */}
                        {isDinner && (cell.leftoverChain?.length ?? 0) > 0 && (
                          <div className="space-y-0.5 mt-0.5">
                            <p className="text-[11px] font-bold text-amber-700 flex items-center gap-0.5 uppercase tracking-wide">
                              <Link2 className="w-2.5 h-2.5" /> {t("Leftover Plan", "बचे भोजन की योजना")}
                            </p>
                            {cell.leftoverChain!.slice(0, 3).map((lc, li) => (
                              <div key={li} className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                <span className="font-bold shrink-0">{li + 1}.</span>
                                <span>{lc.day.slice(0, 3)} {lc.meal}: {lc.dish.slice(0, 22)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {isDinner && !cell.leftoverChain?.length && leftoverChain && (
                          <div className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                            <Link2 className="w-2.5 h-2.5" />
                            <span>↳ {leftoverChain.nextDay.slice(0, 3)} {leftoverChain.meal}: {leftoverChain.dish.slice(0, 18)}</span>
                          </div>
                        )}

                        {/* Rebalance banner — shown above next meal after skip */}
                        {rebalanceBanner && rebalanceBanner.dayIndex === di && rebalanceBanner.nextMealType === meal && (
                          <button
                            onClick={() => {
                              toast({ title: t("Suggestion applied to your plan!", "सुझाव आपकी योजना में लागू!") });
                              setRebalanceBanner(null);
                            }}
                            className="w-full flex items-start gap-2 p-2 rounded-xl bg-blue-50 border border-blue-200 text-left transition-colors hover:bg-blue-100"
                          >
                            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-blue-800">
                                {t("Adjusted for today's meals.", "आज के भोजन के लिए समायोजित।")}
                              </p>
                              <p className="text-[11px] text-blue-700/80">{lang === "hi" ? rebalanceBanner.suggestionHi : rebalanceBanner.suggestion}</p>
                              <p className="text-[11px] text-blue-500 mt-0.5 font-medium">{t("Tap to apply", "लागू करने के लिए टैप करें")}</p>
                            </div>
                          </button>
                        )}

                        {/* Feedback + log + skip actions */}
                        <div className="flex gap-1 pt-0.5 flex-wrap">
                          <button
                            onClick={() => handleFeedback(di, meal, true)}
                            className={`p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${feedback === true ? "text-green-600 bg-green-100" : "text-muted-foreground hover:text-green-600 hover:bg-green-50"}`}
                            title={t("Like", "पसंद")}
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleFeedback(di, meal, false)}
                            className={`p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${feedback === false ? "text-red-500 bg-red-100" : "text-muted-foreground hover:text-red-500 hover:bg-red-50"}`}
                            title={t("Dislike", "नापसंद")}
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleLogMeal(cell, meal, logKey)}
                            disabled={loggingMeal === logKey}
                            className="p-2.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title={t("Log meal", "लॉग करें")}
                          >
                            {loggingMeal === logKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                          </button>
                          <div className="border-l border-muted-foreground/20 mx-0.5" />
                          <button
                            onClick={() => handleSkipMeal(di, meal, "skip")}
                            disabled={!!skippedMeals[feedbackKey]}
                            className={`px-2 py-2.5 rounded-lg transition-colors text-[11px] font-medium flex items-center gap-1 min-h-[44px] ${skippedMeals[feedbackKey] === "skip" ? "text-orange-600 bg-orange-100" : "text-muted-foreground hover:text-orange-600 hover:bg-orange-50"} disabled:opacity-50`}
                            title={t("Skip", "छोड़ें")}
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                            {t("Skip", "छोड़ें")}
                          </button>
                          <button
                            onClick={() => handleSkipMeal(di, meal, "ate_out")}
                            disabled={!!skippedMeals[feedbackKey]}
                            className={`px-2 py-2.5 rounded-lg transition-colors text-[11px] font-medium flex items-center gap-1 min-h-[44px] ${skippedMeals[feedbackKey] === "ate_out" ? "text-violet-600 bg-violet-100" : "text-muted-foreground hover:text-violet-600 hover:bg-violet-50"} disabled:opacity-50`}
                            title={t("Ate Out", "बाहर खाया")}
                          >
                            <UtensilsCrossed className="w-3 h-3" />
                            {t("Ate Out", "बाहर खाया")}
                          </button>
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
                <span className="text-xs text-muted-foreground font-normal ml-1">— {expandedDay ?? days[0]}</span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
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
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
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
                    <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{mealCell.calories} kcal</span>
                  )}
                  {mealCell.estimatedCost && (
                    <span className="text-[11px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">₹{mealCell.estimatedCost}</span>
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-xs">{member.name}</span>
                          {member.role && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/50 text-muted-foreground capitalize">{member.role}</span>
                          )}
                          {(member.healthConditions ?? []).slice(0, 4).map(c => {
                            const badge = CONDITION_BADGES[c];
                            return badge ? (
                              <span key={c} className={`text-[11px] px-1.5 py-0.5 rounded-full border font-semibold ${badge.color}`}>
                                {badge.icon} {lang === "hi" ? badge.labelHi : badge.label}
                              </span>
                            ) : (
                              <span key={c} className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/60 border border-current/20 font-medium capitalize">
                                {c.replace(/_/g, " ")}
                              </span>
                            );
                          })}
                        </div>
                        {hasStructuredContent ? (
                          <>
                            {plate!.add.length > 0 && (
                              <div className="flex items-start gap-1.5">
                                <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-[11px] font-semibold text-green-700">{t("Add", "जोड़ें")}: </span>
                                  <span className="text-[11px] text-green-700/80">{plate!.add.join(", ")}</span>
                                </div>
                              </div>
                            )}
                            {plate!.reduce.length > 0 && (
                              <div className="flex items-start gap-1.5">
                                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-[11px] font-semibold text-amber-700">{t("Reduce", "कम करें")}: </span>
                                  <span className="text-[11px] text-amber-700/80">{plate!.reduce.join(", ")}</span>
                                </div>
                              </div>
                            )}
                            {plate!.avoid.length > 0 && (
                              <div className="flex items-start gap-1.5">
                                <XCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-[11px] font-semibold text-red-600">{t("Avoid", "न लें")}: </span>
                                  <span className="text-[11px] text-red-600/80">{plate!.avoid.join(", ")}</span>
                                </div>
                              </div>
                            )}
                          </>
                        ) : fallback ? (
                          <p className="text-[11px] text-foreground/70">{fallback}</p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic">{t("Standard serving — no specific modifications needed.", "सामान्य मात्रा — कोई विशेष बदलाव नहीं।")}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ICMR rationale for this slot */}
                {mealCell.icmr_rationale && (
                  <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-2.5 flex gap-2">
                    <Info className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[11px] text-secondary/90 leading-relaxed">{mealCell.icmr_rationale}</p>
                      <span className="inline-block mt-1 text-[11px] font-bold text-secondary/60 border border-secondary/20 px-1.5 py-0.5 rounded-full">
                        📚 ICMR-NIN 2024
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {tomorrowPrepReminders.length > 0 && (() => {
        const tomorrowName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][(new Date().getDay() + 1) % 7];
        return (
          <Collapsible defaultOpen className="glass-card rounded-3xl p-5 border border-violet-500/20" style={{ background: "rgba(245,240,255,0.55)" }}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left cursor-pointer group">
              <FlaskConical className="w-4 h-4 text-violet-600" />
              <h3 className="font-semibold text-sm text-violet-900">
                {t(`Tonight's Prep for ${tomorrowName}`, `कल के लिए आज रात की तैयारी (${tomorrowName})`)}
              </h3>
              <Badge className="bg-violet-500/15 text-violet-700 border-violet-500/20 text-[11px] ml-auto mr-1">
                {t("Prep reminder", "तैयारी रिमाइंडर")}
              </Badge>
              <ChevronDown className="w-4 h-4 text-violet-400 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <div className="space-y-2">
                {tomorrowPrepReminders.map((reminder, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white/60 rounded-2xl px-3.5 py-3 border border-violet-200/50">
                    <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                      reminder.prepType === "soak" ? "bg-blue-100 text-blue-700" :
                      reminder.prepType === "sprout" ? "bg-green-100 text-green-700" :
                      reminder.prepType === "marinate" ? "bg-orange-100 text-orange-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {reminder.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-foreground capitalize">{reminder.ingredient}</p>
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                          reminder.prepType === "soak" ? "bg-blue-50 text-blue-700" :
                          reminder.prepType === "sprout" ? "bg-green-50 text-green-700" :
                          reminder.prepType === "marinate" ? "bg-orange-50 text-orange-700" :
                          "bg-amber-50 text-amber-700"
                        }`}>
                          {reminder.prepType.charAt(0).toUpperCase() + reminder.prepType.slice(1)} {reminder.duration}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                          <Clock3 className="w-2.5 h-2.5" /> {t("For best results", "सर्वोत्तम परिणामों के लिए")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {lang === "hi" ? reminder.benefitHi : reminder.benefit}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })()}

      {/* ── Mandi Optimizer — Arbitrage Swap Panel ── */}
      {arbitrageData.mods.length > 0 && (
        <div className="glass-card rounded-3xl p-5 border border-amber-400/20" style={{ background: "rgba(255,251,235,0.65)" }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-sm text-amber-900">{t("Mandi Optimizer", "मंडी ऑप्टिमाइज़र")}</h3>
            <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/20 text-[11px] ml-auto">
              💰 {t("Save", "बचत")} ₹{Math.round(arbitrageData.saving)}/kg
            </Badge>
          </div>
          <div className="space-y-2">
            {arbitrageData.mods.map((mod, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/50 rounded-xl p-2.5">
                <span className="text-xs text-muted-foreground line-through">{mod.original}</span>
                <span className="text-xs text-amber-600 font-bold">→</span>
                <span className="text-xs font-semibold text-green-700">{mod.substituted}</span>
                {mod.savingPerKg > 0 && (
                  <span className="ml-auto text-[11px] font-bold text-green-600 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded-full">
                    -₹{Math.round(mod.savingPerKg)}/kg
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-amber-700/70 mt-3 leading-relaxed">
            {t("Ingredients auto-swapped based on today's mandi's best prices.", "आज की मंडी की सबसे अच्छी कीमतों के आधार पर सामग्री स्वचालित रूप से बदली गई।")}
          </p>
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
