import { useState } from "react";
import { useUpdateFamilyMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";

export interface IMemberProfileFields {
  name: string;
  role: string;
  age: number;
  gender: string;
  weightKg?: number;
  heightCm?: number;
  activityLevel?: string;
  healthConditions?: string[];
  dietaryRestrictions?: string[];
  primaryGoal?: string;
  goalPace?: string;
  tiffinType?: string;
  religiousRules?: string;
  ingredientDislikes?: string[];
  nonVegDays?: string[];
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

export default function MemberEditSheet({ member, onClose }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMember = useUpdateFamilyMember();

  const [form, setForm] = useState<Partial<IMemberProfile>>(member ?? {});

  const set = <K extends keyof IMemberProfile>(key: K, value: IMemberProfile[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

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

  return (
    <Sheet open={!!member} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lg font-display font-bold">
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
            <Select value={form.activityLevel ?? "moderate"} onValueChange={v => set("activityLevel", v)}>
              <SelectTrigger className="mt-1 h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVITY_LEVELS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold">{t("Health Goal", "स्वास्थ्य लक्ष्य")}</Label>
            <Select value={form.primaryGoal ?? "general_wellness"} onValueChange={v => set("primaryGoal", v)}>
              <SelectTrigger className="mt-1 h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GOALS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {showGoalPace && (
            <div>
              <Label className="text-xs font-semibold">{t("Goal Pace", "लक्ष्य गति")}</Label>
              <Select value={form.goalPace ?? "none"} onValueChange={v => set("goalPace", v)}>
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
            <Select value={form.tiffinType ?? "none"} onValueChange={v => set("tiffinType", v)}>
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
            <Select value={form.religiousRules ?? "none"} onValueChange={v => set("religiousRules", v)}>
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

          <Button
            onClick={handleSave}
            disabled={updateMember.isPending}
            className="w-full rounded-2xl h-11 bg-gradient-to-r from-primary to-orange-500 text-white font-semibold"
          >
            {updateMember.isPending ? t("Saving…", "सहेज रहे हैं…") : t("Save Changes", "बदलाव सहेजें")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
