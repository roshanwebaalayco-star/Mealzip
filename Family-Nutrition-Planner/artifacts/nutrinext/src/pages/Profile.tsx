import { useState } from "react";
import { motion } from "framer-motion";
import { useAppState } from "@/hooks/use-app-state";
import { useGetFamily, useUpdateFamilyMember } from "@workspace/api-client-react";
import type { FamilyMember } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, ChevronDown, ChevronUp, User, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { useQueryClient } from "@tanstack/react-query";

type MemberEdit = {
  name: string;
  age: number;
  gender: string;
  weightKg: number;
  heightCm: number;
  activityLevel: string;
  healthConditions: string[];
  allergies: string[];
  primaryGoal: string;
  goalPace: string;
  tiffinNeeded: string;
  ingredientDislikes: string[];
  nonVegDays: string[];
  nonVegTypes: string[];
  memberFastingDays: string[];
  foodAllergies: string;
  dietaryType: string;
  healthGoal: string;
  spiceTolerance: string;
  festivalFastingAlerts: boolean;
  religiousCulturalRules: string;
};

function memberToEdit(m: FamilyMember): MemberEdit {
  const healthConditions = Array.isArray(m.healthConditions) ? m.healthConditions as string[] : [];
  const allergies = Array.isArray(m.allergies) ? m.allergies as string[] : [];
  const ingredientDislikes = Array.isArray(m.ingredientDislikes) ? m.ingredientDislikes as string[] : [];
  const nonvegConfig = (m.occasionalNonvegConfig ?? {}) as { days?: string[]; types?: string[] };
  const fastingConfig = (m.fastingConfig ?? {}) as { baselineDays?: string[]; ekadashi?: boolean };
  const religiousConfig = (m.religiousCulturalRules ?? {}) as { primary?: string };

  return {
    name: m.name,
    age: m.age,
    gender: m.gender,
    weightKg: Number(m.weightKg) || 60,
    heightCm: Number(m.heightCm) || 160,
    activityLevel: m.activityLevel,
    healthConditions,
    allergies,
    primaryGoal: m.primaryGoal ?? "no_specific_goal",
    goalPace: m.goalPace ?? "none",
    tiffinNeeded: m.tiffinNeeded ?? "no",
    ingredientDislikes,
    nonVegDays: nonvegConfig.days ?? [],
    nonVegTypes: nonvegConfig.types ?? [],
    memberFastingDays: fastingConfig.baselineDays ?? [],
    foodAllergies: allergies.join(", "),
    dietaryType: m.dietaryType ?? "strictly_vegetarian",
    healthGoal: m.primaryGoal ?? "no_specific_goal",
    spiceTolerance: m.spiceTolerance ?? "medium",
    festivalFastingAlerts: m.festivalFastingAlerts ?? false,
    religiousCulturalRules: religiousConfig.primary ?? "none",
  };
}

function DislikeInput({ onAdd, t }: { onAdd: (val: string) => void; t: (en: string, hi: string) => string }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const val = draft.trim();
    if (val) { onAdd(val); setDraft(""); }
  };
  return (
    <div className="flex gap-1.5 mt-1.5">
      <Input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        placeholder={t("Type and press Enter or +", "टाइप करें और Enter दबाएं")}
        className="text-sm h-8"
      />
      <Button type="button" size="sm" variant="outline" onClick={commit} className="h-8 px-2">
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default function Profile() {
  const { activeFamily } = useAppState();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMember = useUpdateFamilyMember();

  const familyId = activeFamily?.id;
  const { data: familyInfo, isLoading } = useGetFamily(familyId ?? 0, { query: { enabled: !!familyId } });

  const [editStates, setEditStates] = useState<Record<number, MemberEdit>>({});
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!familyInfo || !familyInfo.members?.length) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>{t("No family profile found. Set up your family first.", "परिवार प्रोफाइल नहीं मिली। पहले परिवार सेटअप करें।")}</p>
      </div>
    );
  }

  const getEdit = (m: FamilyMember): MemberEdit => editStates[m.id] ?? memberToEdit(m);

  const updateEdit = <K extends keyof MemberEdit>(memberId: number, field: K, value: MemberEdit[K]) => {
    const member = familyInfo.members.find(m => m.id === memberId);
    if (!member) return;
    const current = getEdit(member);
    setEditStates(prev => ({ ...prev, [memberId]: { ...current, [field]: value } }));
  };

  const toggleCondition = (memberId: number, cond: string) => {
    const member = familyInfo.members.find(m => m.id === memberId);
    if (!member) return;
    const current = getEdit(member).healthConditions;
    let next: string[];
    if (cond === "none") {
      next = current.includes("none") ? [] : ["none"];
    } else {
      const without = current.filter(c => c !== "none");
      next = without.includes(cond) ? without.filter(c => c !== cond) : [...without, cond];
    }
    updateEdit(memberId, "healthConditions", next);
  };

  const toggleFastingDay = (memberId: number, day: string) => {
    const member = familyInfo.members.find(m => m.id === memberId);
    if (!member) return;
    const current = getEdit(member).memberFastingDays;
    let next: string[];
    if (day === "none") {
      next = current.includes("none") ? [] : ["none"];
    } else {
      const without = current.filter(d => d !== "none");
      next = without.includes(day) ? without.filter(d => d !== day) : [...without, day];
    }
    updateEdit(memberId, "memberFastingDays", next);
  };

  const handleSave = async (member: FamilyMember) => {
    if (!familyId) return;
    const edit = getEdit(member);
    setSavingIds(prev => new Set(prev).add(member.id));
    try {
      const allergyList = edit.foodAllergies.split(",").map(s => s.trim()).filter(Boolean);
      await updateMember.mutateAsync({
        familyId,
        memberId: member.id,
        data: {
          name: edit.name,
          age: edit.age,
          gender: edit.gender,
          weightKg: edit.weightKg,
          heightCm: edit.heightCm,
          activityLevel: edit.activityLevel,
          dietaryType: edit.dietaryType,
          healthConditions: edit.healthConditions.filter(c => c !== "none"),
          allergies: allergyList,
          primaryGoal: edit.healthGoal !== "no_specific_goal" ? edit.healthGoal : undefined,
          goalPace: edit.goalPace !== "none" ? edit.goalPace : undefined,
          tiffinNeeded: edit.tiffinNeeded !== "no" ? edit.tiffinNeeded : undefined,
          religiousCulturalRules: edit.religiousCulturalRules !== "none" ? { primary: edit.religiousCulturalRules } : undefined,
          ingredientDislikes: edit.ingredientDislikes.length > 0 ? edit.ingredientDislikes : undefined,
          occasionalNonvegConfig: (edit.nonVegDays.length > 0 || edit.nonVegTypes.length > 0)
            ? { days: edit.nonVegDays, types: edit.nonVegTypes } : undefined,
          fastingConfig: edit.memberFastingDays.filter(d => d !== "none").length > 0
            ? { baselineDays: edit.memberFastingDays.filter(d => d !== "none") } : undefined,
          spiceTolerance: edit.spiceTolerance,
          festivalFastingAlerts: edit.festivalFastingAlerts,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      toast({ title: t("Saved!", "सहेजा गया!"), description: `${edit.name} ${t("profile updated.", "प्रोफाइल अपडेट हुई।")}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: t("Error", "त्रुटि"), description: msg, variant: "destructive" });
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(member.id); return s; });
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-medium text-foreground flex items-center gap-3">
          <User className="w-7 h-7 text-primary" />
          {t("Family Profiles", "परिवार प्रोफाइल")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Edit member details and nutrition preferences below.", "नीचे सदस्यों की जानकारी और पोषण वरीयताएं संपादित करें।")}
        </p>
      </div>

      <motion.div className="space-y-4" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}>
        {familyInfo.members.map((member) => {
          const edit = getEdit(member);
          const isExpanded = expandedIds.has(member.id);
          const isSaving = savingIds.has(member.id);
          const weightChangeGoal = edit.healthGoal === "weight_loss" || edit.healthGoal === "muscle_gain";
          const hasBodyMetrics = !!(member.weightKg && member.heightCm);
          const kcal = member.dailyCalorieTarget ?? null;
          const showGoalPaceField = weightChangeGoal && edit.age >= 18;
          const bmi = hasBodyMetrics
            ? Number(member.weightKg) / ((Number(member.heightCm) / 100) ** 2)
            : null;
          const bmiLabel = bmi
            ? bmi < 18.5 ? { label: "Underweight", color: "text-blue-600 bg-blue-50 border-blue-200" }
            : bmi < 25   ? { label: "Normal BMI",  color: "text-green-600 bg-green-50 border-green-200" }
            : bmi < 30   ? { label: "Overweight",  color: "text-amber-600 bg-amber-50 border-amber-200" }
            :               { label: "Obese",       color: "text-red-600 bg-red-50 border-red-200" }
            : null;

          return (
            <motion.div key={member.id} variants={item} className="bg-white rounded-3xl shadow-sm border border-border">
              {/* Header — always visible */}
              <div
                className="flex items-center justify-between p-5 cursor-pointer"
                onClick={() => toggleExpand(member.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.age}y · {member.gender}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {bmi && bmiLabel && (
                    <span className={`text-xs font-semibold border rounded-full px-2.5 py-1 ${bmiLabel.color}`}>
                      BMI {bmi.toFixed(1)} · {bmiLabel.label}
                    </span>
                  )}
                  {kcal && (
                    <span className="text-xs font-semibold text-primary bg-primary/5 border border-primary/20 rounded-full px-2.5 py-1">
                      ~{kcal} kcal/day
                    </span>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Expanded form */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">

                  {/* Basic info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <Label>{t("Name", "नाम")}</Label>
                      <Input value={edit.name} onChange={e => updateEdit(member.id, "name", e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>{t("Age", "आयु")}</Label>
                      <Input type="number" value={edit.age || ""} onChange={e => updateEdit(member.id, "age", e.target.value === "" ? 0 : parseInt(e.target.value))} className="mt-1" placeholder="e.g. 30" />
                    </div>
                    <div>
                      <Label>{t("Weight (kg)", "वजन (किग्रा)")}</Label>
                      <Input type="number" value={edit.weightKg || ""} onChange={e => updateEdit(member.id, "weightKg", e.target.value === "" ? 0 : parseFloat(e.target.value))} className="mt-1" placeholder="e.g. 65" />
                    </div>
                    <div>
                      <Label>{t("Height (cm)", "ऊंचाई (सेमी)")}</Label>
                      <Input type="number" value={edit.heightCm || ""} onChange={e => updateEdit(member.id, "heightCm", e.target.value === "" ? 0 : parseFloat(e.target.value))} className="mt-1" placeholder="e.g. 165" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>{t("Gender", "लिंग")}</Label>
                      <Select value={edit.gender} onValueChange={v => updateEdit(member.id, "gender", v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">{t("Male", "पुरुष")}</SelectItem>
                          <SelectItem value="female">{t("Female", "महिला")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t("Activity Level", "गतिविधि स्तर")}</Label>
                      <Select value={edit.activityLevel} onValueChange={v => updateEdit(member.id, "activityLevel", v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sedentary">{t("Sedentary", "निष्क्रिय")}</SelectItem>
                          <SelectItem value="light">{t("Light", "हल्का")}</SelectItem>
                          <SelectItem value="moderate">{t("Moderate", "मध्यम")}</SelectItem>
                          <SelectItem value="active">{t("Active", "सक्रिय")}</SelectItem>
                          <SelectItem value="very_active">{t("Very Active", "बहुत सक्रिय")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t("Dietary Type", "आहार प्रकार")}</Label>
                      <Select value={edit.dietaryType} onValueChange={v => updateEdit(member.id, "dietaryType", v)}>
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

                    {/* Health goal — hidden for under 13 */}
                    {edit.age >= 13 ? (
                      <div>
                        <Label>{t("Health Goal", "स्वास्थ्य लक्ष्य")}</Label>
                        <Select value={edit.healthGoal} onValueChange={v => updateEdit(member.id, "healthGoal", v)}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general_wellness">{t("General Wellness", "सामान्य स्वास्थ्य")}</SelectItem>
                            {edit.age >= 18 && <SelectItem value="weight_loss">{t("Weight Loss", "वजन घटाना")}</SelectItem>}
                            <SelectItem value="manage_diabetes">{t("Manage Diabetes", "मधुमेह नियंत्रण")}</SelectItem>
                            <SelectItem value="anemia_recovery">{t("Anemia Recovery", "रक्ताल्पता")}</SelectItem>
                            <SelectItem value="heart_health">{t("Heart Health", "हृदय स्वास्थ्य")}</SelectItem>
                            {edit.age >= 18 && <SelectItem value="muscle_gain">{t("Muscle Gain", "मांसपेशी वृद्धि")}</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
                        <span>🤖</span>
                        <span>
                          {edit.age < 5
                            ? t("Auto: Early Childhood Nutrition", "स्वतः: शैशव पोषण")
                            : t("Auto: Healthy Growth & School Nutrition (5–12)", "स्वतः: स्वस्थ विकास (5–12)")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Teenager guardrail notice */}
                  {edit.age >= 13 && edit.age <= 17 && (
                    <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-800">
                      <span>🔒</span>
                      <span>{t("Weight loss goal is not available for ages 13–17 per Responsible AI guidelines.", "13–17 वर्ष के लिए वजन घटाने का लक्ष्य Responsible AI नियमों के अनुसार उपलब्ध नहीं है।")}</span>
                    </div>
                  )}

                  {/* Advanced profile */}
                  <div className="pt-3 border-t border-dashed border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t("Advanced Profile", "विस्तृत प्रोफाइल")}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Goal Pace — only for weight loss/gain, adults */}
                      {showGoalPaceField && (
                        <div>
                          <Label className="text-sm font-semibold">{t("Goal Pace", "लक्ष्य गति")}</Label>
                          <Select value={edit.goalPace} onValueChange={v => updateEdit(member.id, "goalPace", v)}>
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
                        <Select value={edit.tiffinNeeded} onValueChange={v => updateEdit(member.id, "tiffinNeeded", v)}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">{t("Not required", "नहीं")}</SelectItem>
                            <SelectItem value="school_tiffin">{t("School Tiffin", "स्कूल टिफिन")}</SelectItem>
                            <SelectItem value="office_tiffin">{t("Office Tiffin", "ऑफिस टिफिन")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold">{t("Religious / Cultural Rules", "धार्मिक नियम")}</Label>
                        <Select value={edit.religiousCulturalRules} onValueChange={v => updateEdit(member.id, "religiousCulturalRules", v)}>
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
                        <Label className="text-sm font-semibold">{t("Ingredient Dislikes", "पसंद न आने वाली चीजें")} <span className="text-muted-foreground font-normal">{t("(max 5)", "(अधिकतम 5)")}</span></Label>
                        <div className="flex flex-wrap gap-1.5 mt-2 min-h-[28px]">
                          {edit.ingredientDislikes.map((item, i) => (
                            <span key={i} className="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-0.5 text-xs text-orange-800">
                              {item}
                              <button type="button" onClick={() => updateEdit(member.id, "ingredientDislikes", edit.ingredientDislikes.filter((_, j) => j !== i))} className="hover:text-red-600 ml-0.5">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        {edit.ingredientDislikes.length < 5 && (
                          <DislikeInput
                            onAdd={(val) => updateEdit(member.id, "ingredientDislikes", [...edit.ingredientDislikes, val])}
                            t={t}
                          />
                        )}
                      </div>
                    </div>

                    {/* Non-veg breakdown */}
                    {edit.dietaryType === "non-vegetarian" && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                  id={`${member.id}-nvday-${id}`}
                                  checked={edit.nonVegDays.includes(id)}
                                  onCheckedChange={() => {
                                    const current = edit.nonVegDays;
                                    updateEdit(member.id, "nonVegDays", current.includes(id) ? current.filter(d => d !== id) : [...current, id]);
                                  }}
                                />
                                <Label htmlFor={`${member.id}-nvday-${id}`} className="text-sm">{t(en, hi)}</Label>
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
                                  id={`${member.id}-nvtype-${id}`}
                                  checked={edit.nonVegTypes.includes(id)}
                                  onCheckedChange={() => {
                                    const current = edit.nonVegTypes;
                                    updateEdit(member.id, "nonVegTypes", current.includes(id) ? current.filter(tp => tp !== id) : [...current, id]);
                                  }}
                                />
                                <Label htmlFor={`${member.id}-nvtype-${id}`} className="text-sm">{t(en, hi)}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Health conditions */}
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
                          { id: 'none', en: 'None', hi: 'कोई नहीं' },
                        ].map(({ id: cond, en, hi }) => (
                          <div key={cond} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${member.id}-${cond}`}
                              checked={edit.healthConditions.includes(cond)}
                              onCheckedChange={() => toggleCondition(member.id, cond)}
                            />
                            <Label htmlFor={`${member.id}-${cond}`} className="text-sm">{t(en, hi)}</Label>
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
                          { id: "none", en: "None", hi: "कोई नहीं" },
                        ].map(({ id: day, en, hi }) => (
                          <div key={day} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${member.id}-fasting-${day}`}
                              checked={edit.memberFastingDays.includes(day)}
                              onCheckedChange={() => toggleFastingDay(member.id, day)}
                            />
                            <Label htmlFor={`${member.id}-fasting-${day}`} className="text-xs">{t(en, hi)}</Label>
                          </div>
                        ))}
                        <div className="pt-2">
                          <Label className="text-sm font-semibold">{t("Food Allergies", "खाद्य एलर्जी")}</Label>
                          <Input
                            value={edit.foodAllergies}
                            onChange={e => updateEdit(member.id, "foodAllergies", e.target.value)}
                            placeholder={t("e.g. peanuts, milk", "जैसे मूंगफली, दूध")}
                            className="mt-1 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* ICMR Calorie Target Badge */}
                    {kcal && (
                      <div className="mt-3 inline-flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                        <span className="text-xs text-muted-foreground">{t("ICMR Daily Target:", "ICMR दैनिक लक्ष्य:")}</span>
                        <span className="text-sm font-bold text-primary">~{kcal} kcal/day</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 flex justify-end">
                    <Button onClick={() => handleSave(member)} disabled={isSaving} className="rounded-xl px-6">
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      {t("Save Changes", "बदलाव सहेजें")}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
