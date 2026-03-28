import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CalendarDays, Clock, IndianRupee, Utensils, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/language-context";

export interface MemberContextOverride {
  feeling_this_week?: string;
  fasting_days?: string[];
  tiffin_override?: boolean;
  spice_override?: string;
}

export interface WeeklyContext {
  budget_inr?: number;
  dining_out_freq?: number;
  weekday_prep_time?: string;
  weekend_prep_time?: string;
  special_request?: string;
  member_overrides?: Record<string, MemberContextOverride>;
}

interface FamilyMember {
  id: number;
  name: string;
  role: string;
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

const LS_KEY = (_familyId: number) => `nutrinext_weekly_context`;

const FASTING_OPTIONS = [
  { id: "monday", label: "Monday", hi: "सोमवार" },
  { id: "tuesday", label: "Tuesday", hi: "मंगलवार" },
  { id: "thursday", label: "Thursday", hi: "गुरुवार" },
  { id: "friday", label: "Friday", hi: "शुक्रवार" },
  { id: "ekadashi", label: "Ekadashi", hi: "एकादशी" },
];

const FEELING_OPTIONS = [
  { value: "great", label: "Great / बढ़िया 💪" },
  { value: "tired", label: "Tired / थका हुआ 😴" },
  { value: "stressed", label: "Stressed / तनाव में 😰" },
  { value: "unwell", label: "Slightly Unwell / थोड़ा बीमार 🤒" },
  { value: "active", label: "Very Active / बहुत सक्रिय 🏃" },
];

export default function WeeklyContextModal({ open, familyId, members, defaultBudget = 5000, onClose, onGenerate, isPending }: Props) {
  const { t, lang } = useLanguage();

  const [ctx, setCtx] = useState<WeeklyContext>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY(familyId));
      if (stored) return JSON.parse(stored) as WeeklyContext;
    } catch { /* ignore */ }
    return { budget_inr: Math.round(defaultBudget / 4) };
  });

  const [expandedMembers, setExpandedMembers] = useState<Record<number, boolean>>({});
  const [isFasting, setIsFasting] = useState(false);

  useEffect(() => {
    if (familyId) {
      try {
        const stored = localStorage.getItem(LS_KEY(familyId));
        if (stored) setCtx(JSON.parse(stored) as WeeklyContext);
        else setCtx({ budget_inr: Math.round(defaultBudget / 4) });
      } catch { /* ignore */ }
    }
  }, [familyId, defaultBudget]);

  const persist = (updated: WeeklyContext) => {
    setCtx(updated);
    try { localStorage.setItem(LS_KEY(familyId), JSON.stringify(updated)); } catch { /* ignore */ }
  };

  const updateField = <K extends keyof WeeklyContext>(key: K, value: WeeklyContext[K]) => {
    persist({ ...ctx, [key]: value });
  };

  const updateMemberOverride = (memberName: string, field: keyof MemberContextOverride, value: unknown) => {
    const overrides = { ...(ctx.member_overrides ?? {}) };
    overrides[memberName] = { ...(overrides[memberName] ?? {}), [field]: value };
    persist({ ...ctx, member_overrides: overrides });
  };

  const toggleMemberFastingDay = (memberName: string, day: string) => {
    const overrides = { ...(ctx.member_overrides ?? {}) };
    const memberOv = { ...(overrides[memberName] ?? {}) };
    const days = memberOv.fasting_days ?? [];
    memberOv.fasting_days = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
    overrides[memberName] = memberOv;
    persist({ ...ctx, member_overrides: overrides });
  };

  const handleGenerate = () => {
    onGenerate(isFasting, ctx);
  };

  const handleSkip = () => {
    onGenerate(false, { budget_inr: Math.round(defaultBudget / 4) });
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
              {/* Budget + Dining Out */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-primary" />
                    {t("Weekly Budget (₹)", "साप्ताहिक बजट (₹)")}
                  </Label>
                  <Input
                    type="number"
                    value={ctx.budget_inr ?? ""}
                    onChange={e => updateField("budget_inr", parseInt(e.target.value) || undefined)}
                    placeholder="e.g. 1500"
                    className="mt-1.5 h-10 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-primary" />
                    {t("Dining Out (days)", "बाहर खाना (दिन)")}
                  </Label>
                  <Select
                    value={String(ctx.dining_out_freq ?? "0")}
                    onValueChange={v => updateField("dining_out_freq", parseInt(v))}
                  >
                    <SelectTrigger className="mt-1.5 h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5].map(n => (
                        <SelectItem key={n} value={String(n)}>{n === 0 ? t("None", "नहीं") : `${n} ${t("days", "दिन")}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Prep Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    {t("Weekday Cook Time", "सप्ताह में समय")}
                  </Label>
                  <Select value={ctx.weekday_prep_time ?? ""} onValueChange={v => updateField("weekday_prep_time", v)}>
                    <SelectTrigger className="mt-1.5 h-10 rounded-xl text-sm"><SelectValue placeholder={t("Select", "चुनें")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15min">15 min</SelectItem>
                      <SelectItem value="30min">30 min</SelectItem>
                      <SelectItem value="45min">45 min</SelectItem>
                      <SelectItem value="60min+">60 min+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-orange-500" />
                    {t("Weekend Cook Time", "सप्ताहांत में समय")}
                  </Label>
                  <Select value={ctx.weekend_prep_time ?? ""} onValueChange={v => updateField("weekend_prep_time", v)}>
                    <SelectTrigger className="mt-1.5 h-10 rounded-xl text-sm"><SelectValue placeholder={t("Select", "चुनें")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30min">30 min</SelectItem>
                      <SelectItem value="60min">60 min</SelectItem>
                      <SelectItem value="90min">90 min</SelectItem>
                      <SelectItem value="elaborate">Elaborate / विस्तृत</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                  placeholder={t("e.g. Guest coming Sunday, exam week for kids", "जैसे रविवार को मेहमान, बच्चे की परीक्षा")}
                  className="mt-1.5 h-10 rounded-xl text-sm"
                />
              </div>

              {/* Per-member overrides */}
              {members.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">{t("Member Check-In", "सदस्यों की इस-हफ्ते की स्थिति")}</p>
                  <div className="space-y-2">
                    {members.map(member => {
                      const memberOv = ctx.member_overrides?.[member.name] ?? {};
                      const isExpanded = expandedMembers[member.id] ?? false;
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
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                  {FEELING_OPTIONS.find(f => f.value === memberOv.feeling_this_week)?.label.split(" / ")[0]}
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
                                  <div className="pt-3">
                                    <Label className="text-xs font-semibold text-muted-foreground">{t("Feeling this week", "इस हफ्ते कैसा महसूस हो रहा है")}</Label>
                                    <Select
                                      value={memberOv.feeling_this_week ?? "not_set"}
                                      onValueChange={v => updateMemberOverride(member.name, "feeling_this_week", v === "not_set" ? undefined : v)}
                                    >
                                      <SelectTrigger className="mt-1 h-9 rounded-xl text-xs"><SelectValue placeholder={t("How are they feeling?", "कैसा महसूस हो रहा है?")} /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="not_set">{t("Not set", "नहीं")}</SelectItem>
                                        {FEELING_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{lang === "hi" ? f.label.split(" / ")[1] ?? f.label : f.label.split(" / ")[0]}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">{t("Fasting days this week", "इस हफ्ते उपवास के दिन")}</Label>
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                      {FASTING_OPTIONS.map(fd => (
                                        <button
                                          key={fd.id}
                                          type="button"
                                          onClick={() => toggleMemberFastingDay(member.name, fd.id)}
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
                                  <div className="grid grid-cols-2 gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={memberOv.tiffin_override ?? false}
                                        onChange={e => updateMemberOverride(member.name, "tiffin_override", e.target.checked || undefined)}
                                        className="w-3.5 h-3.5 accent-primary"
                                      />
                                      <span className="text-xs">{t("Needs tiffin", "टिफिन चाहिए")}</span>
                                    </label>
                                    <div>
                                      <Select
                                        value={memberOv.spice_override ?? "normal"}
                                        onValueChange={v => updateMemberOverride(member.name, "spice_override", v === "normal" ? undefined : v)}
                                      >
                                        <SelectTrigger className="h-8 rounded-xl text-xs border-border"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="normal">{t("Normal", "सामान्य")}</SelectItem>
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
            <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-border px-6 py-4 space-y-2">
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
              <button
                onClick={handleSkip}
                disabled={isPending}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1 disabled:opacity-40"
              >
                {t("Skip & use defaults", "छोड़ें और डिफ़ॉल्ट उपयोग करें")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
