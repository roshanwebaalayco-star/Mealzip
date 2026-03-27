import { apiFetch } from "@/lib/api-fetch";
import { useState } from "react";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/contexts/language-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Heart, Scale, Activity, AlertTriangle, User, Plus, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const COMMON_SYMPTOMS = ["Fatigue", "Headache", "Nausea", "Bloating", "Constipation", "Dizziness", "Weakness", "Poor appetite", "Heartburn", "Joint pain"];
const COMMON_SYMPTOMS_HI = ["थकान", "सिरदर्द", "मतली", "पेट फूलना", "कब्ज", "चक्कर", "कमजोरी", "भूख न लगना", "एसिडिटी", "जोड़ों का दर्द"];

interface SymptomResult {
  disclaimer: string;
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

export default function HealthLog() {
  const { activeFamily } = useAppState();
  const { lang, t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  const { data: healthLogs } = useQuery({
    queryKey: ["health-logs", activeFamily?.id, activeMemberId],
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
      const data = await res.json();
      setSymptomResult(data);
    } catch {
      toast({ title: t("Error", "त्रुटि"), description: t("Symptom check failed", "लक्षण जांच विफल"), variant: "destructive" });
    } finally {
      setCheckingSymptoms(false);
    }
  };

  const weightData = (healthLogs || [])
    .filter(l => l.weightKg)
    .slice(0, 10)
    .reverse()
    .map(l => ({ date: l.logDate?.slice(5), weight: l.weightKg }));

  const urgencyColor = { routine: "bg-green-500/20 text-green-700", soon: "bg-yellow-500/20 text-yellow-700", urgent: "bg-red-500/20 text-red-700" };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground">
            {t("Health Log", "स्वास्थ्य लॉग")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("Track vitals & get nutrition-based symptom insights", "स्वास्थ्य संकेतक ट्रैक करें और लक्षण अंतर्दृष्टि पाएं")}
          </p>
        </div>
        <Button onClick={() => setShowLogForm(v => !v)} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          {t("Log Today", "आज लॉग करें")}
        </Button>
      </div>

      {/* Member pills */}
      {members && members.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedMemberId(m.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl text-sm font-medium transition-all ${
                activeMemberId === m.id ? "bg-primary text-white" : "glass-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Log Form */}
      {showLogForm && (
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
            <div>
              <label className="text-xs text-muted-foreground">{t("Blood Sugar (mg/dL)", "रक्त शर्करा (mg/dL)")}</label>
              <Input value={logForm.bloodSugar} onChange={e => setLogForm(f => ({ ...f, bloodSugar: e.target.value }))} type="number" placeholder="90" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("BP (sys/dia mmHg)", "बीपी (sys/dia)")}</label>
              <div className="flex gap-1">
                <Input value={logForm.bpSys} onChange={e => setLogForm(f => ({ ...f, bpSys: e.target.value }))} type="number" placeholder="120" />
                <Input value={logForm.bpDia} onChange={e => setLogForm(f => ({ ...f, bpDia: e.target.value }))} type="number" placeholder="80" />
              </div>
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
            <Button variant="outline" onClick={() => setShowLogForm(false)}>{t("Cancel", "रद्द करें")}</Button>
          </div>
        </div>
      )}

      {/* Weight trend */}
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

      {/* Recent logs */}
      {healthLogs && healthLogs.length > 0 && (
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
                    {log.symptoms?.map((s: string) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Symptom Checker */}
      <div className="glass-card rounded-3xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-500" />
          <h3 className="font-semibold">{t("Symptom Advisor", "लक्षण सलाहकार")}</h3>
          <Badge variant="secondary" className="text-[10px]">{t("Nutrition guidance only", "केवल पोषण मार्गदर्शन")}</Badge>
        </div>

        {/* Persistent disclaimer — always visible */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-700">
            {t(
              "Not medical advice. This tool provides nutrition-based suggestions only. Always consult a qualified doctor for medical concerns.",
              "यह चिकित्सा सलाह नहीं है। यह उपकरण केवल पोषण-आधारित सुझाव देता है। चिकित्सा समस्याओं के लिए हमेशा योग्य डॉक्टर से मिलें।"
            )}
          </p>
        </div>

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

        {selectedSymptoms.length > 0 && (
          <Button onClick={checkSymptoms} disabled={checkingSymptoms} className="w-full gap-2">
            <Sparkles className="w-4 h-4" />
            {checkingSymptoms ? t("Analyzing…", "विश्लेषण हो रहा है…") : t("Get Nutrition Insights", "पोषण अंतर्दृष्टि पाएं")}
          </Button>
        )}

        {symptomResult && (
          <div className="space-y-3">
            {/* Disclaimer always first */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-700">{symptomResult.disclaimer}</p>
            </div>

            <Badge className={urgencyColor[symptomResult.urgency] || ""}>
              {symptomResult.urgency === "routine" ? t("Routine check", "नियमित जांच") : symptomResult.urgency === "soon" ? t("See doctor soon", "जल्द डॉक्टर से मिलें") : t("See doctor urgently", "तुरंत डॉक्टर से मिलें")}
            </Badge>

            <div className="p-3 rounded-xl bg-muted/30">
              <p className="text-sm font-medium mb-1">{t("Nutritional Insight", "पोषण अंतर्दृष्टि")}</p>
              <p className="text-sm text-muted-foreground">{symptomResult.nutritionalInsight}</p>
            </div>

            {symptomResult.recommendedFoods?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-700 mb-1">{t("Recommended Foods:", "अनुशंसित खाद्य पदार्थ:")}</p>
                <div className="flex flex-wrap gap-1">
                  {symptomResult.recommendedFoods.map(f => <Badge key={f} className="text-[10px] bg-green-500/20 text-green-700 border-green-500/30">{f}</Badge>)}
                </div>
              </div>
            )}

            {symptomResult.avoidFoods?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 mb-1">{t("Avoid:", "से बचें:")}</p>
                <div className="flex flex-wrap gap-1">
                  {symptomResult.avoidFoods.map(f => <Badge key={f} className="text-[10px] bg-red-500/20 text-red-700 border-red-500/30">{f}</Badge>)}
                </div>
              </div>
            )}

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs font-semibold text-blue-700 mb-1">{t("When to see a doctor:", "डॉक्टर से कब मिलें:")}</p>
              <p className="text-xs text-blue-700">{symptomResult.seeDoctor}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
