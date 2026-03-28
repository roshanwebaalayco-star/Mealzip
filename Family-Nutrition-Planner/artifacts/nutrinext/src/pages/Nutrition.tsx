import { apiFetch } from "@/lib/api-fetch";
import { useState } from "react";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/contexts/language-context";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { ActivitySquare, Target, TrendingUp, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export default function Nutrition() {
  const { activeFamily } = useAppState();
  const { lang, t } = useLanguage();
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  const { data: members } = useQuery({
    queryKey: ["family-members", activeFamily?.id],
    queryFn: async () => {
      const res = await apiFetch(`/api/families/${activeFamily?.id}/members`);
      return res.json() as Promise<Array<{ id: number; name: string; age: number; gender: string; healthConditions?: string[] }>>;
    },
    enabled: !!activeFamily?.id,
  });

  const activeMemberId = selectedMemberId || members?.[0]?.id;

  const { data: summary, isLoading } = useQuery({
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

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground">
          {t("Nutrition Tracker", "पोषण ट्रैकर")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("ICMR-NIN 2024 targets vs actual intake today", "आज के लिए ICMR-NIN 2024 लक्ष्य बनाम वास्तविक सेवन")}
        </p>
      </div>

      {/* Member selector */}
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

      {isLoading && (
        <div className="glass-card rounded-3xl p-8 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}

      {summary && !isLoading && (
        <>
          {/* Overall score */}
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
                <span className="font-display font-bold text-xl">{overallScore}%</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-display font-bold text-lg text-foreground">
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

          {/* Macronutrients bar chart */}
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

          {/* Micronutrients */}
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

          {/* Per-member ICMR-NIN 2024 key nutrient progress bars */}
          <div className="glass-card rounded-3xl p-5 border border-secondary/20" style={{ background: "rgba(240,253,248,0.65)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-secondary" />
              <h3 className="font-semibold text-sm">{t("ICMR-NIN 2024 Key Nutrient Targets", "ICMR-NIN 2024 मुख्य पोषक लक्ष्य")}</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
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
                      <span className={`text-[10px] font-bold ${isLow ? "text-red-600" : isGood ? "text-green-700" : "text-amber-600"}`}>
                        {actual} / {target} {unit}
                      </span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${isLow ? "bg-red-50 text-red-600 border-red-200" : isGood ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-600 border-amber-200"}`}>
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
            <p className="text-[10px] text-secondary/70 mt-3 border-t border-secondary/10 pt-2">
              {t(
                "ICMR-NIN 2024 Recommended Dietary Allowances for Indians · Personalised per age, gender & health profile.",
                "ICMR-NIN 2024 भारतीयों के लिए अनुशंसित आहार भत्ते · आयु, लिंग और स्वास्थ्य के अनुसार व्यक्तिगत।"
              )}
            </p>
          </div>

          {/* ICMR Note */}
          <div className="glass-card rounded-2xl p-4 border border-secondary/20 text-xs text-muted-foreground">
            <span className="font-semibold text-secondary">ICMR-NIN 2024: </span>
            {t(
              "Targets based on Recommended Dietary Allowances for Indians. Actual intake tracked from today's nutrition logs.",
              "भारतीयों के लिए अनुशंसित आहार भत्ते पर आधारित लक्ष्य। आज के पोषण लॉग से वास्तविक सेवन ट्रैक किया गया।"
            )}
          </div>

          {/* 30-day trend chart */}
          {nutritionLogs && nutritionLogs.some(d => (d.calories ?? 0) > 0) && (
            <div className="glass-card rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">{t("30-Day Progress", "30 दिन की प्रगति")}</h3>
                <Badge variant="secondary" className="text-[10px]">{summary.member.name}</Badge>
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
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!isLoading && !summary && activeMemberId && (
        <div className="glass-card rounded-3xl p-8 text-center space-y-3">
          <ActivitySquare className="w-12 h-12 text-muted-foreground/50 mx-auto" />
          <h2 className="font-display font-bold text-xl">{t("No Data Today", "आज कोई डेटा नहीं")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("Log your meals in the Chat or Scanner to see nutrition progress.", "पोषण प्रगति देखने के लिए चैट या स्कैनर में अपना भोजन लॉग करें।")}
          </p>
        </div>
      )}
    </div>
  );
}
