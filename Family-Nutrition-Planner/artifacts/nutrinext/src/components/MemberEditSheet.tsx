import { useState } from "react";
import { useUpdateFamilyMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";

export interface IMemberProfileFields {
  name: string;
  role: "admin" | "member" | string;
  age: number;
  gender: "male" | "female" | "other";
  weightKg?: number;
  heightCm?: number;
  activityLevel?: "sedentary" | "light" | "moderate" | "active" | "very_active";
  healthConditions?: string[];
  dietaryRestrictions?: string[];
  primaryGoal?: "general_wellness" | "weight_loss" | "build_muscle" | "manage_diabetes" | "heart_health" | "anemia_recovery" | "healthy_growth" | "senior_nutrition";
  goalPace?: "none" | "0.25" | "0.5";
  tiffinType?: "none" | "school" | "office";
  religiousRules?: "none" | "no_beef" | "no_pork" | "sattvic" | "jain";
  ingredientDislikes?: string[];
  nonVegDays?: ("monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday")[];
  nonVegTypes?: ("chicken" | "fish" | "mutton" | "eggs")[];
  calorieTarget?: number;
}

export interface IMemberProfile extends IMemberProfileFields {
  id: number;
  familyId: number;
}

const GOALS = [
  { value: "general_wellness", label: "General Wellness" },
  { value: "weight_loss", label: "Weight Loss" },
  { value: "build_muscle", label: "Build Muscle" },
  { value: "manage_diabetes", label: "Manage Diabetes" },
  { value: "heart_health", label: "Heart Health" },
  { value: "anemia_recovery", label: "Anemia Recovery" },
  { value: "healthy_growth", label: "Healthy Growth (Child)" },
  { value: "senior_nutrition", label: "Senior Nutrition" },
];

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "active", label: "Active" },
  { value: "very_active", label: "Very Active" },
];

interface Props {
  member: IMemberProfile | null;
  onClose: () => void;
}

const DAYS_OF_WEEK = [
  { key: "monday" as const, label: "Mon" },
  { key: "tuesday" as const, label: "Tue" },
  { key: "wednesday" as const, label: "Wed" },
  { key: "thursday" as const, label: "Thu" },
  { key: "friday" as const, label: "Fri" },
  { key: "saturday" as const, label: "Sat" },
  { key: "sunday" as const, label: "Sun" },
];
const NON_VEG_TYPES = ["chicken", "fish", "mutton", "eggs"] as const;

export default function MemberEditSheet({ member, onClose }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMember = useUpdateFamilyMember();

  const [form, setForm] = useState<Partial<IMemberProfile>>(member ?? {});
  const [dislikeInput, setDislikeInput] = useState("");

  const set = <K extends keyof IMemberProfile>(key: K, value: IMemberProfile[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const toggleArrayItem = (key: "nonVegDays" | "nonVegTypes", item: string) => {
    const arr = (form[key] ?? []) as string[];
    set(key, (arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]) as IMemberProfile[typeof key]);
  };

  const addDislike = () => {
    const val = dislikeInput.trim().toLowerCase();
    if (!val) return;
    const current = form.ingredientDislikes ?? [];
    if (!current.includes(val)) set("ingredientDislikes", [...current, val]);
    setDislikeInput("");
  };

  const removeDislike = (item: string) =>
    set("ingredientDislikes", (form.ingredientDislikes ?? []).filter(d => d !== item));

  if (!member) return null;

  const handleSave = async () => {
    try {
      await updateMember.mutateAsync({
        familyId: member.familyId,
        memberId: member.id,
        data: {
          name: form.name,
          role: form.role,
          age: form.age,
          gender: form.gender,
          weightKg: form.weightKg,
          heightCm: form.heightCm,
          activityLevel: form.activityLevel,
          healthConditions: form.healthConditions,
          primaryGoal: form.primaryGoal,
          goalPace: (form.goalPace as "none" | "0.25" | "0.5") ?? "none",
          tiffinType: (form.tiffinType as "none" | "school" | "office") ?? "none",
          religiousRules: (form.religiousRules as "none" | "no_beef" | "no_pork" | "sattvic" | "jain") ?? "none",
          ingredientDislikes: form.ingredientDislikes,
          nonVegDays: form.nonVegDays,
          nonVegTypes: form.nonVegTypes,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      toast({ title: t("Saved", "सहेजा गया"), description: `${form.name ?? member.name} ${t("updated", "अपडेट किया")}` });
      onClose();
    } catch (err) {
      toast({ variant: "destructive", title: t("Error", "त्रुटि"), description: err instanceof Error ? err.message : "Save failed" });
    }
  };

  const showGoalPace = form.primaryGoal === "weight_loss" || form.primaryGoal === "build_muscle";
  const isNonVeg = (form.dietaryRestrictions ?? []).every(r => r !== "vegetarian" && r !== "vegan");

  return (
    <Sheet open={!!member} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lg font-sans font-bold">
            {t("Edit Profile", "प्रोफाइल संपादित करें")} — {member.name}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">{t("Name", "नाम")}</Label>
              <Input value={form.name ?? ""} onChange={e => set("name", e.target.value)} className="mt-1 h-9 rounded-xl text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold">{t("Age", "आयु")}</Label>
              <Input type="number" value={form.age ?? ""} onChange={e => set("age", Number(e.target.value))} className="mt-1 h-9 rounded-xl text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">{t("Weight (kg)", "वजन (किग्रा)")}</Label>
              <Input type="number" value={form.weightKg ?? ""} onChange={e => set("weightKg", Number(e.target.value))} className="mt-1 h-9 rounded-xl text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold">{t("Height (cm)", "ऊंचाई (सेमी)")}</Label>
              <Input type="number" value={form.heightCm ?? ""} onChange={e => set("heightCm", Number(e.target.value))} className="mt-1 h-9 rounded-xl text-sm" />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">{t("Activity Level", "गतिविधि स्तर")}</Label>
            <Select value={form.activityLevel ?? "moderate"} onValueChange={v => set("activityLevel", v as IMemberProfile["activityLevel"])}>
              <SelectTrigger className="mt-1 h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVITY_LEVELS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold">{t("Health Goal", "स्वास्थ्य लक्ष्य")}</Label>
            <Select value={form.primaryGoal ?? "general_wellness"} onValueChange={v => set("primaryGoal", v as IMemberProfile["primaryGoal"])}>
              <SelectTrigger className="mt-1 h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GOALS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {showGoalPace && (
            <div>
              <Label className="text-xs font-semibold">{t("Goal Pace", "लक्ष्य गति")}</Label>
              <Select value={form.goalPace ?? "none"} onValueChange={v => set("goalPace", v as IMemberProfile["goalPace"])}>
                <SelectTrigger className="mt-1 h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("Gradual", "धीरे-धीरे")}</SelectItem>
                  <SelectItem value="0.25">0.25 kg/week</SelectItem>
                  <SelectItem value="0.5">0.5 kg/week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold">{t("Tiffin Type", "टिफिन")}</Label>
            <Select value={form.tiffinType ?? "none"} onValueChange={v => set("tiffinType", v as IMemberProfile["tiffinType"])}>
              <SelectTrigger className="mt-1 h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("None", "नहीं")}</SelectItem>
                <SelectItem value="school">{t("School", "स्कूल")}</SelectItem>
                <SelectItem value="office">{t("Office", "ऑफिस")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold">{t("Religious Rules", "धार्मिक नियम")}</Label>
            <Select value={form.religiousRules ?? "none"} onValueChange={v => set("religiousRules", v as IMemberProfile["religiousRules"])}>
              <SelectTrigger className="mt-1 h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("None", "कोई नहीं")}</SelectItem>
                <SelectItem value="no_beef">{t("No Beef", "गोमांस नहीं")}</SelectItem>
                <SelectItem value="no_pork">{t("No Pork", "सुअर नहीं")}</SelectItem>
                <SelectItem value="sattvic">{t("Sattvic", "सात्विक")}</SelectItem>
                <SelectItem value="jain">{t("Jain", "जैन")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isNonVeg && (
            <>
              <div>
                <Label className="text-xs font-semibold">{t("Non-Veg Days", "मांसाहारी दिन")}</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <label key={day.key} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={(form.nonVegDays ?? []).includes(day.key)}
                        onCheckedChange={() => toggleArrayItem("nonVegDays", day.key)}
                        className="rounded-md"
                      />
                      <span className="text-xs">{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">{t("Non-Veg Types", "मांसाहार प्रकार")}</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {NON_VEG_TYPES.map(type => (
                    <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={(form.nonVegTypes ?? []).includes(type)}
                        onCheckedChange={() => toggleArrayItem("nonVegTypes", type)}
                        className="rounded-md"
                      />
                      <span className="text-xs capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <Label className="text-xs font-semibold">{t("Ingredient Dislikes", "नापसंद सामग्री")}</Label>
            <div className="mt-2 flex gap-2">
              <Input
                value={dislikeInput}
                onChange={e => setDislikeInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addDislike(); } }}
                placeholder={t("e.g. bitter gourd", "जैसे करेला")}
                className="h-9 rounded-xl text-sm flex-1"
              />
              <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-xl shrink-0" onClick={addDislike}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {(form.ingredientDislikes ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(form.ingredientDislikes ?? []).map(item => (
                  <Badge key={item} variant="secondary" className="text-xs pr-1 gap-1 rounded-full">
                    {item}
                    <button type="button" onClick={() => removeDislike(item)} className="ml-0.5 rounded-full hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleSave}
            disabled={updateMember.isPending}
            className="w-full rounded-2xl h-11 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold"
          >
            {updateMember.isPending ? t("Saving…", "सहेज रहे हैं…") : t("Save Changes", "बदलाव सहेजें")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
