import { apiFetch } from "@/lib/api-fetch";
import { useState, useMemo } from "react";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/contexts/language-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Heart, Scale, Activity, User, Plus, Sparkles, Target, TrendingUp, ActivitySquare, CheckCircle2, XCircle, Lightbulb, RotateCcw, ClipboardList, Stethoscope, AlertTriangle, Shield, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";

type NutrientKey = "calories" | "protein" | "carbs" | "fat" | "fiber" | "iron" | "calcium" | "vitaminC";
type NutrientRecord = Record<NutrientKey, number>;

interface NutritionSummary {
  member: { id: number; name: string; age: number; gender: string };
  actual: NutrientRecord;
  target: NutrientRecord | null;
  date: string;
}

const NUTRIENT_LABELS = {
  calories: { label: "Calories", labelHi: "कैलोरी", unit: "kcal", color: "#f97316" },
  protein: { label: "Protein", labelHi: "प्रोटीन", unit: "g", color: "#22c55e" },
  carbs: { label: "Carbs", labelHi: "कार्बोहाइड्रेट", unit: "g", color: "#3b82f6" },
  fat: { label: "Fat", labelHi: "वसा", unit: "g", color: "#a855f7" },
  fiber: { label: "Fiber", labelHi: "फाइबर", unit: "g", color: "#14b8a6" },
  iron: { label: "Iron", labelHi: "आयरन", unit: "mg", color: "#ef4444" },
  calcium: { label: "Calcium", labelHi: "कैल्शियम", unit: "mg", color: "#f59e0b" },
  vitaminC: { label: "Vitamin C", labelHi: "विटामिन सी", unit: "mg", color: "#ec4899" },
};

const COMMON_SYMPTOMS = ["Fatigue", "Headache", "Nausea", "Bloating", "Constipation", "Dizziness", "Weakness", "Poor appetite", "Heartburn", "Joint pain"];
const COMMON_SYMPTOMS_HI = ["थकान", "सिरदर्द", "मतली", "पेट फूलना", "कब्ज", "चक्कर", "कमजोरी", "भूख न लगना", "एसिडिटी", "जोड़ों का दर्द"];

interface SymptomResult {
  disclaimer?: string;
  nutritionalInsight: string;
  dietarySuggestions: string[];
  recommendedFoods: string[];
  avoidFoods: string[];
  seeDoctor: string;
  urgency: "routine" | "soon" | "urgent";
}

interface HealthLogEntry {
  id: number;
  logDate: string;
  weightKg?: number;
  bmi?: number;
  bloodSugar?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  symptoms?: string[];
}

function getBmiCategory(bmi: number): { label: string; labelHi: string; color: string } {
  if (bmi < 18.5) return { label: "Underweight", labelHi: "कम वजन", color: "text-blue-600" };
  if (bmi < 25) return { label: "Normal", labelHi: "सामान्य", color: "text-green-600" };
  if (bmi < 30) return { label: "Overweight", labelHi: "अधिक वजन", color: "text-amber-600" };
  return { label: "Obese", labelHi: "मोटापा", color: "text-red-600" };
}

function getBloodSugarRange(val: number): { label: string; labelHi: string; color: string; bg: string } {
  if (val < 70) return { label: "Low", labelHi: "कम", color: "text-blue-700", bg: "bg-blue-100" };
  if (val <= 100) return { label: "Normal", labelHi: "सामान्य", color: "text-green-700", bg: "bg-green-100" };
  if (val <= 125) return { label: "Pre-diabetic", labelHi: "प्री-डायबिटिक", color: "text-amber-700", bg: "bg-amber-100" };
  return { label: "High", labelHi: "उच्च", color: "text-red-700", bg: "bg-red-100" };
}

function getBpRange(sys: number, dia: number): { label: string; labelHi: string; color: string; bg: string } {
  if (sys < 90 || dia < 60) return { label: "Low", labelHi: "कम", color: "text-blue-700", bg: "bg-blue-100" };
  if (sys >= 140 || dia >= 90) return { label: "High", labelHi: "उच्च", color: "text-red-700", bg: "bg-red-100" };
  if (sys <= 120 && dia <= 80) return { label: "Normal", labelHi: "सामान्य", color: "text-green-700", bg: "bg-green-100" };
  return { label: "Elevated", labelHi: "बढ़ा हुआ", color: "text-amber-700", bg: "bg-amber-100" };
}

interface HealthLogFormProps {
  logForm: { weightKg: string; heightCm: string; bloodSugar: string; bpSys: string; bpDia: string; notes: string };
  setLogForm: React.Dispatch<React.SetStateAction<{ weightKg: string; heightCm: string; bloodSugar: string; bpSys: string; bpDia: string; notes: string }>>;
  logMutation: { mutate: () => void; isPending: boolean };
  onCancel: () => void;
  t: (en: string, hi: string) => string;
}

function HealthLogForm({ logForm, setLogForm, logMutation, onCancel, t }: HealthLogFormProps) {
  const bmi = useMemo(() => {
    const w = parseFloat(logForm.weightKg);
    const h = parseFloat(logForm.heightCm);
    if (w > 0 && h > 0) return w / ((h / 100) ** 2);
    return null;
  }, [logForm.weightKg, logForm.heightCm]);

  const bmiCat = bmi ? getBmiCategory(bmi) : null;

  const bs = parseFloat(logForm.bloodSugar);
  const bsRange = bs > 0 ? getBloodSugarRange(bs) : null;

  const sys = parseInt(logForm.bpSys);
  const dia = parseInt(logForm.bpDia);
  const bpRange = sys > 0 && dia > 0 ? getBpRange(sys, dia) : null;

  return (
    <div className="glass-card rounded-3xl p-5 space-y-4">
      <h3 className="font-semibold">{t("Log Health Metrics", "स्वास्थ्य डेटा दर्ज करें")}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Weight (kg)", "वजन (kg)")}</label>
          <Input value={logForm.weightKg} onChange={e => setLogForm(f => ({ ...f, weightKg: e.target.value }))} type="number" placeholder="65" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Height (cm)", "ऊंचाई (cm)")}</label>
          <Input value={logForm.heightCm} onChange={e => setLogForm(f => ({ ...f, heightCm: e.target.value }))} type="number" placeholder="170" />
        </div>
      </div>

      {bmi && bmiCat && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30">
          <Scale className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t("BMI", "बीएमआई")}:</span>
          <span className={`text-sm font-bold ${bmiCat.color}`}>{bmi.toFixed(1)}</span>
          <span className={`text-xs font-medium ${bmiCat.color}`}>({t(bmiCat.label, bmiCat.labelHi)})</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Blood Sugar (mg/dL)", "रक्त शर्करा (mg/dL)")}</label>
          <Input value={logForm.bloodSugar} onChange={e => setLogForm(f => ({ ...f, bloodSugar: e.target.value }))} type="number" placeholder="90" />
          {bsRange && (
            <span className={`inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${bsRange.bg} ${bsRange.color}`}>
              {t(bsRange.label, bsRange.labelHi)}
            </span>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("BP (sys/dia mmHg)", "बीपी (sys/dia)")}</label>
          <div className="flex gap-1">
            <Input value={logForm.bpSys} onChange={e => setLogForm(f => ({ ...f, bpSys: e.target.value }))} type="number" placeholder="120" />
            <Input value={logForm.bpDia} onChange={e => setLogForm(f => ({ ...f, bpDia: e.target.value }))} type="number" placeholder="80" />
          </div>
          {bpRange && (
            <span className={`inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${bpRange.bg} ${bpRange.color}`}>
              {t(bpRange.label, bpRange.labelHi)}
            </span>
          )}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">{t("Notes", "नोट्स")}</label>
        <Input value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} placeholder={t("How are you feeling today?", "आज कैसा महसूस हो रहा है?")} />
      </div>
      <div className="flex gap-2">
        <Button onClick={() => logMutation.mutate()} disabled={logMutation.isPending} className="flex-1">
          {logMutation.isPending ? t("Saving…", "सहेज रहा है…") : t("Save Log", "लॉग सहेजें")}
        </Button>
        <Button variant="outline" onClick={onCancel}>{t("Cancel", "रद्द करें")}</Button>
      </div>
    </div>
  );
}

export default function HealthLog() {
  const { activeFamily } = useAppState();
  const { lang, t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"nutrition" | "health">("nutrition");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [showLogForm, setShowLogForm] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [symptomResult, setSymptomResult] = useState<SymptomResult | null>(null);
  const [checkingSymptoms, setCheckingSymptoms] = useState(false);
  const [logForm, setLogForm] = useState({ weightKg: "", heightCm: "", bloodSugar: "", bpSys: "", bpDia: "", notes: "" });

  const { data: members } = useQuery({
    queryKey: ["family-members", activeFamily?.id],
    queryFn: async () => {
      const res = await apiFetch(`/api/families/${activeFamily?.id}/members`);
      return res.json() as Promise<Array<{ id: number; name: string; age: number; gender: string; healthConditions?: string[]; activityLevel?: string }>>;
    },
    enabled: !!activeFamily?.id,
  });

  const activeMemberId = selectedMemberId || members?.[0]?.id;
  const activeMember = members?.find(m => m.id === activeMemberId);

  const { data: summary, isLoading: nutritionLoading } = useQuery({
    queryKey: ["nutrition-summary", activeMemberId],
    queryFn: async () => {
      const res = await apiFetch(`/api/nutrition-summary/${activeMemberId}`);
      return res.json() as Promise<NutritionSummary>;
    },
    enabled: !!activeMemberId,
  });

  const { data: nutritionLogs } = useQuery({
    queryKey: ["nutrition-logs-30d", activeFamily?.id, activeMemberId],
    queryFn: async () => {
      const res = await apiFetch(`/api/nutrition-logs?familyId=${activeFamily?.id}&memberId=${activeMemberId}&limit=90`);
      const rows = await res.json() as Array<{
        logDate: string;
        calories?: number;
        proteinG?: number;
        carbsG?: number;
        fatG?: number;
        fiberG?: number;
      }>;
      const byDate: Record<string, { calories: number; protein: number; carbs: number; fat: number; fiber: number }> = {};
      for (const r of rows) {
        const d = r.logDate.slice(0, 10);
        if (!byDate[d]) byDate[d] = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
        byDate[d].calories += r.calories ?? 0;
        byDate[d].protein += r.proteinG ?? 0;
        byDate[d].carbs += r.carbsG ?? 0;
        byDate[d].fat += r.fatG ?? 0;
        byDate[d].fiber += r.fiberG ?? 0;
      }
      const today = new Date();
      return Array.from({ length: 30 }, (_, i) => {
        const d = subDays(today, 29 - i);
        const key = format(d, "yyyy-MM-dd");
        return {
          date: format(d, "MMM d"),
          ...byDate[key],
        };
      });
    },
    enabled: !!activeFamily?.id && !!activeMemberId,
  });

  const { data: healthLogs } = useQuery({
    queryKey: ["health-logs", activeFamily?.id, activeMemberId],
    staleTime: 0,
    queryFn: async () => {
      const url = `/api/health-logs?familyId=${activeFamily?.id}${activeMemberId ? `&memberId=${activeMemberId}` : ""}`;
      const res = await apiFetch(url);
      return res.json() as Promise<HealthLogEntry[]>;
    },
    enabled: !!activeFamily?.id,
  });

  const logMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/health-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyId: activeFamily?.id,
          memberId: activeMemberId,
          logDate: new Date().toISOString().split("T")[0],
          weightKg: logForm.weightKg ? parseFloat(logForm.weightKg) : null,
          heightCm: logForm.heightCm ? parseFloat(logForm.heightCm) : null,
          bloodSugar: logForm.bloodSugar ? parseFloat(logForm.bloodSugar) : null,
          bloodPressureSystolic: logForm.bpSys ? parseInt(logForm.bpSys) : null,
          bloodPressureDiastolic: logForm.bpDia ? parseInt(logForm.bpDia) : null,
          symptoms: selectedSymptoms,
          notes: logForm.notes || null,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health-logs"] });
      setShowLogForm(false);
      setLogForm({ weightKg: "", heightCm: "", bloodSugar: "", bpSys: "", bpDia: "", notes: "" });
      toast({ title: t("Health log saved!", "स्वास्थ्य लॉग सहेजा गया!") });
    },
  });

  const checkSymptoms = async () => {
    if (selectedSymptoms.length === 0) return;
    setCheckingSymptoms(true);
    setSymptomResult(null);
    try {
      const res = await apiFetch("/api/symptom-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms: selectedSymptoms,
          age: activeMember?.age,
          gender: activeMember?.gender,
          existingConditions: activeMember?.healthConditions || [],
          language: lang === "hi" ? "hindi" : "english",
        }),
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      if (!data || !data.nutritionalInsight) {
        throw new Error("Invalid response");
      }
      setSymptomResult(data);
    } catch {
      toast({ title: t("Error", "त्रुटि"), description: t("Symptom check failed. Please try again.", "लक्षण जांच विफल। कृपया पुनः प्रयास करें।"), variant: "destructive" });
    } finally {
      setCheckingSymptoms(false);
    }
  };

  const chartData = summary
    ? (Object.entries(NUTRIENT_LABELS) as [NutrientKey, typeof NUTRIENT_LABELS[NutrientKey]][]).map(([key, meta]) => {
        const actual = summary.actual[key] || 0;
        const target = summary.target ? summary.target[key] || 1 : 1;
        const pct = Math.min(Math.round((actual / target) * 100), 150);
        return {
          key,
          name: lang === "hi" ? meta.labelHi : meta.label,
          actual: Math.round(actual),
          target: Math.round(target),
          pct,
          fill: meta.color,
          unit: meta.unit,
        };
      })
    : [];

  const macroData = chartData.filter(d => ["calories", "protein", "carbs", "fat", "fiber"].includes(d.key));
  const microData = chartData.filter(d => ["iron", "calcium", "vitaminC"].includes(d.key));

  const overallScore = chartData.length > 0
    ? Math.round(chartData.reduce((sum, d) => sum + Math.min(d.pct, 100), 0) / chartData.length)
    : 0;

  const weightData = (healthLogs || [])
    .filter(l => l.weightKg)
    .slice(0, 10)
    .reverse()
    .map(l => ({ date: l.logDate?.slice(5), weight: l.weightKg }));

  const urgencyColor = { routine: "bg-green-500/20 text-green-700", soon: "bg-yellow-500/20 text-yellow-700", urgent: "bg-red-500/20 text-red-700" };

  const debtNutrients = chartData.filter(d => d.pct < 80);
  const shadowNutrients = chartData.filter(d => d.pct < 50);
  const memberConditions = activeMember?.healthConditions ?? [];

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl md:text-3xl" style={{ letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
            {t("Clinical Insights", "नैदानिक जानकारी")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("Track nutrition, vitals & get AI-powered insights", "पोषण, स्वास्थ्य संकेतक ट्रैक करें और AI अंतर्दृष्टि पाएं")}
          </p>
        </div>
        {activeTab === "health" && (
          <Button onClick={() => setShowLogForm(v => !v)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            {t("Log Today", "आज लॉग करें")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-3xl p-5 border border-amber-200/50" style={{ background: "rgba(255,251,235,0.70)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Target className="w-4 h-4 text-amber-600" />
            </span>
            <h3 className="font-semibold text-sm">{t("Nutritional Debt Ledger", "पोषण ऋण खाता")}</h3>
          </div>
          {!summary ? (
            <p className="text-xs text-muted-foreground py-3">{t("Log meals to see nutrient debt analysis", "पोषक तत्व विश्लेषण देखने के लिए भोजन लॉग करें")}</p>
          ) : debtNutrients.length > 0 ? (
            <div className="space-y-2">
              {debtNutrients.slice(0, 4).map(d => (
                <div key={d.key} className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{d.name}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.pct < 50 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {d.pct}%
                  </span>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground mt-1">
                {t(`${debtNutrients.length} nutrient(s) below 80% of ICMR target`, `${debtNutrients.length} पोषक तत्व ICMR लक्ष्य के 80% से नीचे`)}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <p className="text-sm text-green-700 font-medium">{t("All nutrients on track!", "सभी पोषक तत्व सही!")}</p>
            </div>
          )}
        </div>

        <div className="glass-card rounded-3xl p-5 border border-red-200/50" style={{ background: "rgba(254,242,242,0.70)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </span>
            <h3 className="font-semibold text-sm">{t("Nutritional Shadow Warning", "पोषण चेतावनी")}</h3>
          </div>
          {!summary ? (
            <p className="text-xs text-muted-foreground py-3">{t("Log meals to detect critical deficiencies", "गंभीर कमियों का पता लगाने के लिए भोजन लॉग करें")}</p>
          ) : shadowNutrients.length > 0 ? (
            <div className="space-y-2">
              {shadowNutrients.map(d => (
                <div key={d.key} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-xs font-medium text-foreground flex-1">{d.name}</span>
                  <span className="text-xs font-bold text-red-600">{d.actual} / {d.target} {d.unit}</span>
                </div>
              ))}
              <p className="text-[11px] text-red-600/70 mt-1 font-medium">
                {t("Critical deficiency risk — immediate dietary attention needed", "गंभीर कमी का खतरा — तुरंत आहार पर ध्यान दें")}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-3">
              <Shield className="w-5 h-5 text-green-500" />
              <p className="text-sm text-green-700 font-medium">{t("No shadow warnings", "कोई चेतावनी नहीं")}</p>
            </div>
          )}
        </div>

        <div className="glass-card rounded-3xl p-5 border border-blue-200/50" style={{ background: "rgba(239,246,255,0.70)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Pill className="w-4 h-4 text-blue-600" />
            </span>
            <h3 className="font-semibold text-sm">{t("Medication Guardrail", "दवा सुरक्षा मार्गदर्शन")}</h3>
          </div>
          {memberConditions.length > 0 ? (
            <div className="space-y-2">
              {memberConditions.slice(0, 3).map(c => (
                <div key={c} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-100">
                  <Stethoscope className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="text-xs font-medium text-blue-800 capitalize">{c.replace(/_/g, " ")}</span>
                </div>
              ))}
              <p className="text-[11px] text-blue-600/70 mt-1">
                {t("Meal plans account for these conditions", "भोजन योजनाएं इन स्थितियों को ध्यान में रखती हैं")}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <p className="text-sm text-green-700 font-medium">{t("No conditions flagged", "कोई स्थिति चिह्नित नहीं")}</p>
            </div>
          )}
        </div>
      </div>

      {members && members.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedMemberId(m.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all ${
                activeMemberId === m.id
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "glass-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex p-1 rounded-2xl glass-card w-fit" role="tablist" aria-label={t("Health & Nutrition sections", "स्वास्थ्य और पोषण अनुभाग")}>
        <button
          role="tab"
          aria-selected={activeTab === "nutrition"}
          onClick={() => setActiveTab("nutrition")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "nutrition"
              ? "bg-primary text-white shadow-md shadow-primary/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Target className="w-4 h-4" />
          {t("Nutrition", "पोषण")}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "health"}
          onClick={() => setActiveTab("health")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "health"
              ? "bg-primary text-white shadow-md shadow-primary/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className="w-4 h-4" />
          {t("Health", "स्वास्थ्य")}
        </button>
      </div>

      {activeTab === "nutrition" && (
      <div className="space-y-4" role="tabpanel" aria-label={t("Nutrition", "पोषण")}>
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h2 className="font-medium text-lg text-foreground">
            {t("Nutrition Tracker", "पोषण ट्रैकर")}
          </h2>
          <span className="text-xs text-muted-foreground">
            {t("ICMR-NIN 2024 targets vs actual intake today", "आज के लिए ICMR-NIN 2024 लक्ष्य बनाम वास्तविक सेवन")}
          </span>
        </div>

        {nutritionLoading && (
          <div className="glass-card rounded-3xl p-8 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {summary && !nutritionLoading && (
          <>
            <div className="glass-card rounded-3xl p-6 flex items-center gap-6">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/30" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke={overallScore >= 70 ? "#22c55e" : overallScore >= 40 ? "#f97316" : "#ef4444"}
                    strokeWidth="2.5" strokeLinecap="round"
                    strokeDasharray={`${overallScore} 100`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-medium text-xl">{overallScore}%</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-lg text-foreground">
                  {summary.member.name} — {t("Today's Progress", "आज की प्रगति")}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t(`Age ${summary.member.age} · ${summary.member.gender}`, `उम्र ${summary.member.age} · ${summary.member.gender === "male" ? "पुरुष" : "महिला"}`)}
                </p>
                <Badge className="mt-2 text-xs" variant={overallScore >= 70 ? "default" : "secondary"}>
                  {overallScore >= 70 ? t("Good nutrition day!", "अच्छा पोषण दिन!") : t("Needs improvement", "सुधार की जरूरत")}
                </Badge>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">{t("Macronutrients", "मैक्रोन्यूट्रिएंट्स")}</h3>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={macroData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string, props: { payload: { unit: string } }) => [
                      `${value} ${props.payload.unit}`,
                      name === "actual" ? t("Actual", "वास्तविक") : t("Target", "लक्ष्य"),
                    ]}
                  />
                  <Bar dataKey="target" fill="#94a3b8" opacity={0.4} radius={[4, 4, 0, 0]} name="target" />
                  <Bar dataKey="actual" radius={[4, 4, 0, 0]} name="actual">
                    {macroData.map((entry, i) => (
                      <rect key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-secondary" />
                <h3 className="font-semibold">{t("Micronutrients (% of target)", "सूक्ष्म पोषक तत्व (लक्ष्य का %)")}</h3>
              </div>
              <div className="space-y-3">
                {microData.map(item => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground">{item.actual} / {item.target} {item.unit}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(item.pct, 100)}%`, backgroundColor: item.fill }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-3xl p-5 border border-secondary/20" style={{ background: "rgba(240,253,248,0.65)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-secondary" />
                <h3 className="font-semibold text-sm">{t("ICMR-NIN 2024 Key Nutrient Targets", "ICMR-NIN 2024 मुख्य पोषक लक्ष्य")}</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                  {summary.member.name}
                </span>
              </div>
              {[
                { key: "calories" as const, label: t("Energy", "ऊर्जा"), labelHi: "ऊर्जा", unit: "kcal", color: "#f97316", bg: "bg-orange-500" },
                { key: "protein"  as const, label: t("Protein", "प्रोटीन"), labelHi: "प्रोटीन", unit: "g", color: "#22c55e", bg: "bg-green-500" },
                { key: "iron"     as const, label: t("Iron", "आयरन"), labelHi: "आयरन", unit: "mg", color: "#ef4444", bg: "bg-red-500" },
                { key: "calcium"  as const, label: t("Calcium", "कैल्शियम"), labelHi: "कैल्शियम", unit: "mg", color: "#f59e0b", bg: "bg-amber-500" },
              ].map(({ key, label, unit, bg }) => {
                const actual = Math.round(summary.actual[key] || 0);
                const target = Math.round(summary.target ? (summary.target[key] || 1) : 1);
                const pct = Math.min(Math.round((actual / target) * 100), 100);
                const isLow = pct < 50;
                const isGood = pct >= 80;
                return (
                  <div key={key} className="mb-3 last:mb-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-foreground">{label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isLow ? "text-red-600" : isGood ? "text-green-700" : "text-amber-600"}`}>
                          {actual} / {target} {unit}
                        </span>
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${isLow ? "bg-red-50 text-red-600 border-red-200" : isGood ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-600 border-amber-200"}`}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${bg}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-secondary/70 mt-3 border-t border-secondary/10 pt-2">
                {t(
                  "ICMR-NIN 2024 Recommended Dietary Allowances for Indians · Personalised per age, gender & health profile.",
                  "ICMR-NIN 2024 भारतीयों के लिए अनुशंसित आहार भत्ते · आयु, लिंग और स्वास्थ्य के अनुसार व्यक्तिगत।"
                )}
              </p>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-secondary/20 text-xs text-muted-foreground">
              <span className="font-semibold text-secondary">ICMR-NIN 2024: </span>
              {t(
                "Targets based on Recommended Dietary Allowances for Indians. Actual intake tracked from today's nutrition logs.",
                "भारतीयों के लिए अनुशंसित आहार भत्ते पर आधारित लक्ष्य। आज के पोषण लॉग से वास्तविक सेवन ट्रैक किया गया।"
              )}
            </div>

            {nutritionLogs && nutritionLogs.some(d => (d.calories ?? 0) > 0) && (
              <div className="glass-card rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">{t("30-Day Progress", "30 दिन की प्रगति")}</h3>
                  <Badge variant="secondary" className="text-xs">{summary.member.name}</Badge>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={nutritionLogs} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9 }}
                      interval={6}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        `${Math.round(value)} ${name === "calories" ? "kcal" : "g"}`,
                        name === "calories" ? t("Calories", "कैलोरी") :
                        name === "protein" ? t("Protein", "प्रोटीन") : t("Carbs", "कार्ब"),
                      ]}
                      labelFormatter={(label: string) => label}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    />
                    <Line type="monotone" dataKey="calories" stroke="#f97316" strokeWidth={2} dot={false} name="calories" />
                    <Line type="monotone" dataKey="protein" stroke="#22c55e" strokeWidth={1.5} dot={false} name="protein" />
                    <Line type="monotone" dataKey="carbs" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="carbs" strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 justify-center">
                  {[
                    { color: "#f97316", label: t("Calories", "कैलोरी") },
                    { color: "#22c55e", label: t("Protein", "प्रोटीन") },
                    { color: "#3b82f6", label: t("Carbs", "कार्ब") },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!nutritionLoading && !summary && activeMemberId && (
          <div className="glass-card rounded-3xl p-8 text-center space-y-3">
            <ActivitySquare className="w-12 h-12 text-muted-foreground/50 mx-auto" />
            <h2 className="font-medium text-xl">{t("No Nutrition Data Today", "आज कोई पोषण डेटा नहीं")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("Log your meals in the Chat or Scanner to see nutrition progress.", "पोषण प्रगति देखने के लिए चैट या स्कैनर में अपना भोजन लॉग करें।")}
            </p>
          </div>
        )}
      </div>
      )}

      {activeTab === "health" && (
      <div className="space-y-4" role="tabpanel" aria-label={t("Health", "स्वास्थ्य")}>
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          <h2 className="font-medium text-lg text-foreground">
            {t("Health Log", "स्वास्थ्य लॉग")}
          </h2>
          <span className="text-xs text-muted-foreground">
            {t("Track vitals & get nutrition-based symptom insights", "स्वास्थ्य संकेतक ट्रैक करें और लक्षण अंतर्दृष्टि पाएं")}
          </span>
        </div>

        {showLogForm && (
          <HealthLogForm
            logForm={logForm}
            setLogForm={setLogForm}
            logMutation={logMutation}
            onCancel={() => setShowLogForm(false)}
            t={t}
          />
        )}

        {weightData.length > 1 && (
          <div className="glass-card rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Scale className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">{t("Weight Trend", "वजन ट्रेंड")}</h3>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip formatter={(v: number) => [`${v} kg`, t("Weight", "वजन")]} />
                <Line type="monotone" dataKey="weight" stroke="#22c55e" strokeWidth={2.5} dot={{ fill: "#22c55e" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {healthLogs && healthLogs.length > 0 ? (
          <div className="glass-card rounded-3xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-secondary" />
              <h3 className="font-semibold">{t("Recent Records", "हाल के रिकॉर्ड")}</h3>
            </div>
            {healthLogs.slice(0, 5).map((log: HealthLogEntry) => (
              <div key={log.id} className="flex items-start justify-between p-3 rounded-xl bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{log.logDate}</p>
                  <div className="flex gap-3 mt-1 flex-wrap">
                    {log.weightKg && <span className="text-xs text-muted-foreground">⚖️ {log.weightKg} kg</span>}
                    {log.bmi && <span className="text-xs text-muted-foreground">BMI: {log.bmi}</span>}
                    {log.bloodSugar && <span className="text-xs text-muted-foreground">🩸 {log.bloodSugar} mg/dL</span>}
                    {log.bloodPressureSystolic && <span className="text-xs text-muted-foreground">💓 {log.bloodPressureSystolic}/{log.bloodPressureDiastolic}</span>}
                  </div>
                  {(log.symptoms?.length ?? 0) > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {log.symptoms?.map((s: string) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          !showLogForm && (
            <div className="glass-card rounded-3xl p-8 text-center space-y-3">
              <ClipboardList className="w-12 h-12 text-muted-foreground/40 mx-auto" />
              <h3 className="font-medium text-lg">{t("No Health Records Yet", "अभी तक कोई स्वास्थ्य रिकॉर्ड नहीं")}</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {t(
                  "Start tracking your weight, blood pressure, and blood sugar to see trends and get personalized insights.",
                  "अपना वजन, रक्तचाप और रक्त शर्करा ट्रैक करना शुरू करें और व्यक्तिगत अंतर्दृष्टि पाएं।"
                )}
              </p>
              <Button onClick={() => setShowLogForm(true)} className="gap-2 mt-2">
                <Plus className="w-4 h-4" />
                {t("Log Your First Entry", "अपनी पहली प्रविष्टि दर्ज करें")}
              </Button>
            </div>
          )
        )}

        <div className="glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-red-500" />
              <h3 className="font-semibold">{t("Symptom Advisor", "लक्षण सलाहकार")}</h3>
            </div>
            {symptomResult && (
              <button
                onClick={() => { setSymptomResult(null); setSelectedSymptoms([]); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted/50"
              >
                <RotateCcw className="w-3 h-3" />
                {t("Clear", "साफ़ करें")}
              </button>
            )}
          </div>

          {!symptomResult && !checkingSymptoms && selectedSymptoms.length === 0 && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
              <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                {t(
                  "Select your symptoms below and get AI-powered nutrition insights — which foods can help, what to avoid, and when to consult a doctor.",
                  "नीचे अपने लक्षण चुनें और AI-संचालित पोषण अंतर्दृष्टि पाएं — कौन से खाद्य पदार्थ मदद कर सकते हैं, क्या बचें, और डॉक्टर से कब मिलें।"
                )}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {COMMON_SYMPTOMS.map((symptom, i) => {
              const label = lang === "hi" ? COMMON_SYMPTOMS_HI[i] : symptom;
              const isSelected = selectedSymptoms.includes(symptom);
              return (
                <button
                  key={symptom}
                  onClick={() => setSelectedSymptoms(prev => isSelected ? prev.filter(s => s !== symptom) : [...prev, symptom])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    isSelected ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {selectedSymptoms.length > 0 && !symptomResult && (
            <Button onClick={checkSymptoms} disabled={checkingSymptoms} className="w-full gap-2">
              <Sparkles className="w-4 h-4" />
              {checkingSymptoms ? t("Analyzing…", "विश्लेषण हो रहा है…") : t("Get Nutrition Insights", "पोषण अंतर्दृष्टि पाएं")}
            </Button>
          )}

          {checkingSymptoms && (
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-24 bg-muted/50 rounded-full" />
              <div className="p-4 rounded-xl bg-muted/20 space-y-2">
                <div className="h-4 w-32 bg-muted/40 rounded" />
                <div className="h-3 w-full bg-muted/30 rounded" />
                <div className="h-3 w-3/4 bg-muted/30 rounded" />
              </div>
              <div className="p-4 rounded-xl bg-muted/20 space-y-2">
                <div className="h-4 w-28 bg-muted/40 rounded" />
                <div className="h-3 w-2/3 bg-muted/30 rounded" />
                <div className="h-3 w-1/2 bg-muted/30 rounded" />
              </div>
            </div>
          )}

          {symptomResult && (
            <div className="space-y-4">
              <Badge className={urgencyColor[symptomResult.urgency] || ""}>
                {symptomResult.urgency === "routine" ? t("Routine check", "नियमित जांच") : symptomResult.urgency === "soon" ? t("See doctor soon", "जल्द डॉक्टर से मिलें") : t("See doctor urgently", "तुरंत डॉक्टर से मिलें")}
              </Badge>

              {symptomResult.nutritionalInsight && (
                <div className="p-4 rounded-xl bg-muted/30">
                  <p className="text-sm font-semibold mb-2">{t("Nutritional Insight", "पोषण अंतर्दृष्टि")}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{symptomResult.nutritionalInsight}</p>
                </div>
              )}

              {symptomResult.dietarySuggestions && symptomResult.dietarySuggestions.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm font-semibold text-amber-700 mb-3">{t("Dietary Suggestions", "आहार सुझाव")}</p>
                  <ul className="space-y-2">
                    {symptomResult.dietarySuggestions.map((s, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span className="text-sm text-amber-800">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {symptomResult.recommendedFoods && symptomResult.recommendedFoods.length > 0 && (
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <p className="text-sm font-semibold text-green-700 mb-3">{t("Recommended Foods", "अनुशंसित खाद्य पदार्थ")}</p>
                  <ul className="space-y-2">
                    {symptomResult.recommendedFoods.map(f => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                        <span className="text-sm text-green-800">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {symptomResult.avoidFoods && symptomResult.avoidFoods.length > 0 && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-sm font-semibold text-red-700 mb-3">{t("Foods to Avoid", "इनसे बचें")}</p>
                  <ul className="space-y-2">
                    {symptomResult.avoidFoods.map(f => (
                      <li key={f} className="flex items-start gap-2">
                        <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                        <span className="text-sm text-red-800">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {symptomResult.seeDoctor && (
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm font-semibold text-blue-700 mb-3">{t("When to see a doctor", "डॉक्टर से कब मिलें")}</p>
                  <ul className="space-y-2">
                    {(typeof symptomResult.seeDoctor === "string" ? symptomResult.seeDoctor : "").split(/\n|•/).filter(line => line.trim()).map((line, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold mt-0.5 text-sm">•</span>
                        <span className="text-sm text-blue-700">{line.trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center pt-1">
                {t(
                  "This is nutrition guidance only, not medical advice. Always consult a qualified doctor for medical concerns.",
                  "यह केवल पोषण मार्गदर्शन है, चिकित्सा सलाह नहीं। चिकित्सा समस्याओं के लिए हमेशा योग्य डॉक्टर से मिलें।"
                )}
              </p>
            </div>
          )}
        </div>
        <div className="h-4 md:hidden" />
      </div>
      )}
    </div>
  );
}
