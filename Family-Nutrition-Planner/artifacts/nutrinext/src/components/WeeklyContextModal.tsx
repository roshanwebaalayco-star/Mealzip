import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, CalendarDays, Clock, IndianRupee, Utensils, ChevronDown, ChevronUp,
  Sparkles, Minus, Plus, Camera, CheckCircle2, Scale, Leaf,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useLanguage } from "@/contexts/language-context";

export interface MemberContextOverride {
  memberId: number;
  feeling_this_week?: string;
  fasting_days?: string[];
  tiffin_override?: boolean;
  spice_override?: "mild" | "medium" | "spicy";
  weight_kg?: number;
  nonveg_days_override?: string[];
  nonveg_type_override?: string;
}

export interface WeeklyContext {
  budget_inr?: number;
  dining_out_freq?: number;
  weekday_prep_time?: "<20" | "20-40" | "nolimit";
  weekend_prep_time?: "quick" | "elaborate" | "nopref";
  special_request?: string;
  member_overrides?: Record<string, MemberContextOverride>;
  pantry_items?: string[];
}

export interface FamilyMember {
  id: number;
  name: string;
  role: string;
  age?: number;
  healthConditions?: string[];
  dietaryRestrictions?: string[];
  primaryGoal?: string;
  nonVegDays?: string[];
  nonVegTypes?: string[];
  tiffinType?: string;
  weightKg?: number;
}

interface Props {
  open: boolean;
  familyId: number;
  members: FamilyMember[];
  defaultBudget?: number;
  onClose: () => void;
  onGenerate: (isFasting: boolean, weeklyContext: WeeklyContext) => void;
  isPending?: boolean;
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
  const restrictions = member.dietaryRestrictions ?? [];
  const nonVegDays = member.nonVegDays ?? [];
  if (restrictions.includes("vegetarian") || restrictions.includes("vegan") || restrictions.includes("jain")) return false;
  return (
    restrictions.includes("occasional_non_veg") ||
    restrictions.includes("non_vegetarian") ||
    nonVegDays.length > 0
  );
}

function buildProfileDefaults(members: FamilyMember[], defaultBudget: number): WeeklyContext {
  const weeklyBudget = Math.round(defaultBudget / 4);
  const memberOverrides: Record<string, MemberContextOverride> = {};

  for (const m of members) {
    const ov: MemberContextOverride = { memberId: m.id };
    if (m.tiffinType && m.tiffinType !== "none") ov.tiffin_override = true;
    if (m.nonVegDays && m.nonVegDays.length > 0) ov.nonveg_days_override = m.nonVegDays;
    if (m.nonVegTypes && m.nonVegTypes.length > 0) ov.nonveg_type_override = m.nonVegTypes[0];
    if (m.weightKg && isWeightGoalMember(m)) ov.weight_kg = m.weightKg;
    if (Object.keys(ov).length > 1) memberOverrides[String(m.id)] = ov;
  }

  return {
    budget_inr: weeklyBudget,
    weekday_prep_time: "<20",
    weekend_prep_time: "nopref",
    dining_out_freq: 0,
    member_overrides: Object.keys(memberOverrides).length > 0 ? memberOverrides : undefined,
  };
}

function mergeProfileAndStored(profileDefaults: WeeklyContext, stored: WeeklyContext): WeeklyContext {
  const merged: WeeklyContext = { ...profileDefaults, ...stored };
  if (profileDefaults.member_overrides || stored.member_overrides) {
    const mergedMembers: Record<string, MemberContextOverride> = { ...(profileDefaults.member_overrides ?? {}) };
    for (const [key, ov] of Object.entries(stored.member_overrides ?? {})) {
      mergedMembers[key] = { ...(mergedMembers[key] ?? {}), ...ov };
    }
    merged.member_overrides = mergedMembers;
  }
  return merged;
}

export default function WeeklyContextModal({ open, familyId, members, defaultBudget = 5000, onClose, onGenerate, isPending }: Props) {
  const { t, lang } = useLanguage();

  const getInitialCtx = (): WeeklyContext => {
    const profileDefaults = buildProfileDefaults(members, defaultBudget);
    try {
      const stored = localStorage.getItem(lsKey(familyId));
      if (stored) return mergeProfileAndStored(profileDefaults, JSON.parse(stored) as WeeklyContext);
    } catch { }
    return profileDefaults;
  };

  const [ctx, setCtx] = useState<WeeklyContext>(getInitialCtx);
  const [expandedMembers, setExpandedMembers] = useState<Record<number, boolean>>({});
  const [isFasting, setIsFasting] = useState(false);
  const [pantryInput, setPantryInput] = useState(() => (ctx.pantry_items ?? []).join(", "));

  useEffect(() => {
    if (open && familyId) {
      const profileDefaults = buildProfileDefaults(members, defaultBudget);
      try {
        const stored = localStorage.getItem(lsKey(familyId));
        const merged = stored
          ? mergeProfileAndStored(profileDefaults, JSON.parse(stored) as WeeklyContext)
          : profileDefaults;
        setCtx(merged);
        setPantryInput((merged.pantry_items ?? []).join(", "));
      } catch {
        setCtx(profileDefaults);
        setPantryInput("");
      }
      setIsFasting(false);
    }
  }, [open, familyId, defaultBudget]);

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

  const handleGenerate = () => {
    const finalCtx = buildFinalCtx();
    persist(finalCtx);
    onGenerate(isFasting, finalCtx);
  };

  const handleConfirmNoChange = () => {
    const finalCtx = buildFinalCtx();
    persist(finalCtx);
    onGenerate(isFasting, finalCtx);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.95 }}
            transition={{ type: "spring", damping: 28, stiffness: 400 }}
            className="relative z-10 w-full sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-zinc-900 rounded-t-3xl px-6 pt-5 pb-4 border-b border-border flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-display font-bold">{t("This Week's Context", "इस हफ्ते का विवरण")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("What's different this week? AI adapts accordingly.", "इस हफ्ते क्या अलग है? AI उसी के अनुसार ढलेगी।")}</p>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-xl hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* ONE-TAP CONFIRM: Nothing changed — submits current/last-saved context */}
              <button
                onClick={handleConfirmNoChange}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl border-2 border-green-500 bg-green-50 hover:bg-green-100 transition-colors text-green-800 font-semibold text-sm disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                {t("Nothing changed — confirm ✓", "कुछ नहीं बदला — पुष्टि करें ✓")}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white dark:bg-zinc-900 px-3 text-xs text-muted-foreground">{t("or adjust below", "या नीचे बदलें")}</span>
                </div>
              </div>

              {/* Budget */}
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-primary" />
                  {t("Weekly Budget", "साप्ताहिक बजट")}
                  <span className="ml-auto text-base font-bold text-primary">₹{(ctx.budget_inr ?? 1000).toLocaleString("en-IN")}</span>
                </Label>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => updateField("budget_inr", Math.max(500, (ctx.budget_inr ?? 1000) - 250))}
                    className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 transition-colors shrink-0"
                  >
                    <Minus className="w-3 h-3" />
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
                    className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 transition-colors shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground mt-1 px-10">
                  <span>₹500</span>
                  <span>₹5,000</span>
                  <span>₹10,000</span>
                </div>
              </div>

              {/* Dining Out */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-primary" />
                    {t("Eating Out", "बाहर खाना")}
                  </Label>
                  <Select
                    value={String(ctx.dining_out_freq ?? "0")}
                    onValueChange={v => updateField("dining_out_freq", parseInt(v))}
                  >
                    <SelectTrigger className="mt-1.5 h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t("None — all at home", "नहीं — सभी घर पर")}</SelectItem>
                      <SelectItem value="2">{t("1–2 times this week", "1–2 बार इस हफ्ते")}</SelectItem>
                      <SelectItem value="4">{t("Frequently (3–4 times)", "अक्सर (3–4 बार)")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cook Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    {t("Weekday Cook Time", "सप्ताह में समय")}
                  </Label>
                  <Select
                    value={ctx.weekday_prep_time ?? ""}
                    onValueChange={v => updateField("weekday_prep_time", v as "<20" | "20-40" | "nolimit")}
                  >
                    <SelectTrigger className="mt-1.5 h-10 rounded-xl text-sm"><SelectValue placeholder={t("Select", "चुनें")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="<20">{t("Under 20 min", "20 मिनट से कम")}</SelectItem>
                      <SelectItem value="20-40">{t("20–40 min", "20–40 मिनट")}</SelectItem>
                      <SelectItem value="nolimit">{t("No limit", "कोई सीमा नहीं")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-orange-500" />
                    {t("Weekend Style", "सप्ताहांत शैली")}
                  </Label>
                  <Select
                    value={ctx.weekend_prep_time ?? ""}
                    onValueChange={v => updateField("weekend_prep_time", v as "quick" | "elaborate" | "nopref")}
                  >
                    <SelectTrigger className="mt-1.5 h-10 rounded-xl text-sm"><SelectValue placeholder={t("Select", "चुनें")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quick">{t("Quick", "जल्दी")}</SelectItem>
                      <SelectItem value="elaborate">{t("Elaborate", "विस्तृत")}</SelectItem>
                      <SelectItem value="nopref">{t("No preference", "कोई प्राथमिकता नहीं")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pantry scan shortcut */}
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-primary" />
                    {t("Pantry Items", "पेंट्री में क्या है")}
                  </Label>
                  <Link
                    href="/pantry-scan"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Camera className="w-3 h-3" />
                    {t("Scan Pantry", "पेंट्री स्कैन करें")}
                  </Link>
                </div>
                <textarea
                  value={pantryInput}
                  onChange={e => setPantryInput(e.target.value)}
                  onBlur={handlePantryInputBlur}
                  placeholder={t("e.g. rice, dal, spinach, tomatoes (comma-separated)", "जैसे चावल, दाल, पालक, टमाटर")}
                  className="w-full resize-none rounded-xl border border-border bg-white dark:bg-zinc-800 text-sm px-3 py-2 min-h-[60px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t("AI will prioritize recipes using these ingredients to minimize shopping.", "AI इन सामग्रियों वाली रेसिपी को प्राथमिकता देगी।")}
                </p>
              </div>

              {/* Special request */}
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-primary" />
                  {t("Special Request this Week", "इस हफ्ते कोई विशेष मांग")}
                </Label>
                <Input
                  value={ctx.special_request ?? ""}
                  onChange={e => updateField("special_request", e.target.value || undefined)}
                  placeholder={t("e.g. light meals Thursday, function Friday", "जैसे गुरुवार हल्का खाना, शुक्रवार समारोह")}
                  className="mt-1.5 h-10 rounded-xl text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t("High-priority override — AI will honour this above all else.", "उच्च प्राथमिकता — AI इसे सबसे पहले पूरा करेगी।")}
                </p>
              </div>

              {/* Per-member overrides */}
              {members.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">{t("Member Check-In", "सदस्यों की इस-हफ्ते की स्थिति")}</p>
                  <div className="space-y-2">
                    {members.map(member => {
                      const memberOv = ctx.member_overrides?.[String(member.id)] ?? { memberId: member.id };
                      const isExpanded = expandedMembers[member.id] ?? false;
                      const showWeight = isWeightGoalMember(member);
                      const showNonVeg = isOccasionalNonVeg(member);

                      return (
                        <div key={member.id} className="border border-border rounded-2xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedMembers(prev => ({ ...prev, [member.id]: !isExpanded }))}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary">
                                {member.name.charAt(0)}
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-semibold">{member.name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {memberOv.feeling_this_week && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full truncate max-w-[80px]">
                                  {memberOv.feeling_this_week.slice(0, 12)}
                                </span>
                              )}
                              {memberOv.weight_kg && (
                                <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                                  {memberOv.weight_kg}kg
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
                                <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border bg-muted/20">
                                  {/* Weight update — only for weight-goal members */}
                                  {showWeight && (
                                    <div className="pt-3">
                                      <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                        <Scale className="w-3 h-3" />
                                        {t("Current weight (kg)", "वर्तमान वजन (kg)")}
                                      </Label>
                                      <div className="flex items-center gap-2 mt-1.5">
                                        <Input
                                          type="number"
                                          min={20}
                                          max={200}
                                          step={0.5}
                                          value={memberOv.weight_kg ?? ""}
                                          onChange={e => updateMemberOverride(member.id, "weight_kg", e.target.value ? parseFloat(e.target.value) : undefined)}
                                          placeholder={t("e.g. 68", "जैसे 68")}
                                          className="h-9 rounded-xl text-xs w-28"
                                        />
                                        <span className="text-xs text-muted-foreground">{t("kg — AI adjusts calorie target", "kg — AI कैलोरी समायोजित करेगी")}</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Wellness free text */}
                                  <div className={showWeight ? "" : "pt-3"}>
                                    <Label className="text-xs font-semibold text-muted-foreground">{t("How are you feeling this week?", "इस हफ्ते कैसा महसूस हो रहा है?")}</Label>
                                    <Input
                                      value={memberOv.feeling_this_week ?? ""}
                                      onChange={e => updateMemberOverride(member.id, "feeling_this_week", e.target.value || undefined)}
                                      placeholder={t("e.g. tired, stressed, feeling unwell, very active…", "जैसे थका हुआ, तनाव, थोड़ा बीमार, बहुत सक्रिय…")}
                                      className="mt-1 h-9 rounded-xl text-xs"
                                    />
                                  </div>

                                  {/* Fasting days */}
                                  <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">{t("Fasting days this week", "इस हफ्ते उपवास के दिन")}</Label>
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
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

                                  {/* Non-veg overrides — only for occasional non-veg members */}
                                  {showNonVeg && (
                                    <div>
                                      <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                        <Leaf className="w-3 h-3 text-orange-500" />
                                        {t("Non-veg days this week", "इस हफ्ते मांसाहार के दिन")}
                                      </Label>
                                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        {NON_VEG_DAY_OPTIONS.map(d => (
                                          <button
                                            key={d.id}
                                            type="button"
                                            onClick={() => toggleMemberNonVegDay(member.id, d.id)}
                                            className={`px-2 py-1 text-xs rounded-full border transition-colors ${
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
                                        <div className="mt-2">
                                          <Label className="text-xs font-semibold text-muted-foreground">{t("Non-veg type", "मांसाहार प्रकार")}</Label>
                                          <Select
                                            value={memberOv.nonveg_type_override ?? "any"}
                                            onValueChange={v => updateMemberOverride(member.id, "nonveg_type_override", v)}
                                          >
                                            <SelectTrigger className="mt-1 h-8 rounded-xl text-xs border-border"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              {NON_VEG_TYPES.map(t2 => (
                                                <SelectItem key={t2.value} value={t2.value}>
                                                  {lang === "hi" ? t2.hi : t2.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Tiffin & Spice */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={memberOv.tiffin_override ?? false}
                                        onChange={e => updateMemberOverride(member.id, "tiffin_override", e.target.checked)}
                                        className="w-3.5 h-3.5 accent-primary"
                                      />
                                      <span className="text-xs">{t("Needs tiffin", "टिफिन चाहिए")}</span>
                                    </label>
                                    <div>
                                      <Select
                                        value={memberOv.spice_override ?? "normal"}
                                        onValueChange={v => updateMemberOverride(member.id, "spice_override", v === "normal" ? undefined : v as "mild" | "medium" | "spicy")}
                                      >
                                        <SelectTrigger className="h-8 rounded-xl text-xs border-border"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="normal">{t("Normal spice", "सामान्य मसाला")}</SelectItem>
                                          <SelectItem value="mild">{t("Mild", "हल्का")}</SelectItem>
                                          <SelectItem value="medium">{t("Medium", "मध्यम")}</SelectItem>
                                          <SelectItem value="spicy">{t("Spicy", "तीखा")}</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
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

              {/* Fasting mode toggle */}
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={isFasting}
                    onChange={e => setIsFasting(e.target.checked)}
                    className="w-4 h-4 accent-amber-600"
                  />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">{t("🙏 Fasting Week", "🙏 व्रत सप्ताह")}</p>
                    <p className="text-xs text-amber-700">{t("Generate fasting-compatible meals (sabudana, kuttu, fruits)", "व्रत के अनुकूल भोजन बनाएं (साबूदाना, कुट्टू, फल)")}</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-border px-6 py-4">
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl h-11" disabled={isPending}>
                  {t("Cancel", "रद्द करें")}
                </Button>
                <button
                  onClick={handleGenerate}
                  disabled={isPending}
                  className="btn-liquid flex-[2] inline-flex items-center justify-center gap-2 bg-gradient-to-br from-primary to-orange-500 text-white text-sm font-semibold px-6 py-3 rounded-2xl disabled:opacity-60"
                >
                  {isPending ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : <Sparkles className="w-4 h-4" />}
                  {t("Generate Plan", "योजना बनाएं")}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
