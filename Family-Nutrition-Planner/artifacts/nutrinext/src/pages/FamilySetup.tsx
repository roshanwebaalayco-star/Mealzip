import { apiFetch } from "@/lib/api-fetch";
import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateFamily, useAddFamilyMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, Save, Plus, Trash2, Loader2, Mic, MicOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";

type MemberDraft = {
  _id: number;
  name: string;
  role: string;
  age: number | "";
  gender: string;
  weightKg: number;
  heightCm: number;
  activityLevel: string;
  healthConditions: string[];
  dietaryRestrictions: string[];
  healthGoal: string;
  dietaryType: string;
  memberFastingDays: string[];
  foodAllergies: string;
};

type MemberErrors = { name?: string; age?: string };

let _memberIdCounter = 0;

interface ParsedVoiceMember {
  name?: string;
  role?: string;
  age?: number;
  gender?: string;
  healthConditions?: string[];
  healthGoal?: string;
}

interface ParsedVoiceProfile {
  familyName?: string;
  state?: string;
  monthlyBudget?: number;
  dietaryType?: string;
  language?: string;
  members?: ParsedVoiceMember[];
}

export default function FamilySetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const createFamily = useCreateFamily();
  const addMember = useAddFamilyMember();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberErrors, setMemberErrors] = useState<Record<number, MemberErrors>>({});

  const [familyData, setFamilyData] = useState({
    name: "",
    state: "Jharkhand",
    city: "",
    monthlyBudget: 5000,
    primaryLanguage: "hindi",
    cuisinePreferences: [] as string[],
    cookingTimePreference: "moderate" as "quick" | "moderate" | "elaborate",
    dietaryType: "vegetarian" as "vegetarian" | "non-vegetarian" | "vegan" | "jain",
    healthGoal: "general_wellness" as "general_wellness" | "weight_loss" | "muscle_gain" | "manage_diabetes" | "heart_health" | "manage_thyroid",
    fastingDays: [] as string[],
  });

  const [members, setMembers] = useState<MemberDraft[]>([
    {
      _id: ++_memberIdCounter, name: "", role: "father", age: 35, gender: "male", weightKg: 70, heightCm: 170,
      activityLevel: "moderate", healthConditions: [], dietaryRestrictions: [], healthGoal: "general_wellness",
      dietaryType: "vegetarian", memberFastingDays: [], foodAllergies: "",
    }
  ]);

  const [isListening, setIsListening] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);

  const handleVoiceInput = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ title: "Not supported", description: "Microphone access is not available.", variant: "destructive" });
      return;
    }
    setIsListening(true);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setIsListening(false);
      toast({ title: "Mic denied", description: "Please allow microphone access.", variant: "destructive" });
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start();

    // Record 5 seconds then stop
    setTimeout(() => recorder.stop(), 5000);

    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      setIsListening(false);
      setVoiceLoading(true);

      const langCode = familyData.primaryLanguage === "hindi" ? "hi-IN"
        : familyData.primaryLanguage === "tamil" ? "ta-IN"
        : familyData.primaryLanguage === "bengali" ? "bn-IN"
        : familyData.primaryLanguage === "telugu" ? "te-IN"
        : "en-IN";

      try {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const arrayBuf = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));

        const transcribeRes = await apiFetch("/api/voice/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioBase64: base64, languageCode: langCode }),
        });
        if (!transcribeRes.ok) {
          const errBody = await transcribeRes.json() as { error?: string; detail?: string };
          throw new Error(errBody.detail ?? errBody.error ?? "Transcription service unavailable");
        }
        const { transcript } = await transcribeRes.json() as { transcript: string };
        if (!transcript) throw new Error("Empty transcript received");

        const parseRes = await apiFetch("/api/voice/parse-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, language: familyData.primaryLanguage }),
        });
        const parsed = await parseRes.json() as ParsedVoiceProfile;
        if (parsed.familyName) setFamilyData(fd => ({ ...fd, name: parsed.familyName ?? fd.name }));
        if (parsed.state) setFamilyData(fd => ({ ...fd, state: parsed.state ?? fd.state }));
        if (parsed.monthlyBudget) setFamilyData(fd => ({ ...fd, monthlyBudget: parsed.monthlyBudget ?? fd.monthlyBudget }));
        if (parsed.dietaryType) setFamilyData(fd => ({ ...fd, dietaryType: (parsed.dietaryType ?? fd.dietaryType) as typeof fd.dietaryType }));
        if (parsed.language) setFamilyData(fd => ({ ...fd, primaryLanguage: parsed.language ?? fd.primaryLanguage }));
        if (parsed.members && parsed.members.length > 0) {
          const parsedMembers: MemberDraft[] = parsed.members.map(m => ({
            _id: ++_memberIdCounter,
            name: m.name ?? "",
            role: m.role ?? "other",
            age: m.age ?? 25,
            gender: m.gender ?? "male",
            weightKg: 65,
            heightCm: 165,
            activityLevel: "moderate",
            healthConditions: m.healthConditions ?? [],
            dietaryRestrictions: [],
            healthGoal: m.healthGoal ?? "general_wellness",
            dietaryType: "vegetarian",
            memberFastingDays: [],
            foodAllergies: "",
          }));
          setMembers(parsedMembers);
        }
        toast({ title: "Profile filled!", description: "Voice data parsed and form populated." });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not parse voice input. Please try again.";
        toast({ title: "Voice input failed", description: msg, variant: "destructive" });
      } finally {
        setVoiceLoading(false);
      }
    };
  };

  const handleAddMember = () => {
    setMembers(prev => [...prev, {
      _id: ++_memberIdCounter, name: "", role: "other", age: 25, gender: "female", weightKg: 60, heightCm: 160,
      activityLevel: "moderate", healthConditions: [], dietaryRestrictions: [], healthGoal: "general_wellness",
      dietaryType: "vegetarian", memberFastingDays: [], foodAllergies: "",
    }]);
  };

  const toggleMemberCondition = (idx: number, cond: string) => {
    const current = members[idx].healthConditions;
    let next: string[];
    if (cond === "none") {
      next = current.includes("none") ? [] : ["none"];
    } else {
      const without = current.filter(c => c !== "none");
      next = without.includes(cond) ? without.filter(c => c !== cond) : [...without, cond];
    }
    handleUpdateMember(idx, "healthConditions", next);
  };

  const toggleMemberFasting = (idx: number, day: string) => {
    const current = members[idx].memberFastingDays;
    let next: string[];
    if (day === "none") {
      next = current.includes("none") ? [] : ["none"];
    } else {
      const without = current.filter(d => d !== "none");
      next = without.includes(day) ? without.filter(d => d !== day) : [...without, day];
    }
    handleUpdateMember(idx, "memberFastingDays", next);
  };

  const handleUpdateMember = <K extends keyof MemberDraft>(index: number, field: K, value: MemberDraft[K]) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  };

  const handleRemoveMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const toggleFastingDay = (day: string) => {
    setFamilyData(fd => ({
      ...fd,
      fastingDays: fd.fastingDays.includes(day)
        ? fd.fastingDays.filter(d => d !== day)
        : [...fd.fastingDays, day],
    }));
  };

  const handleSave = async () => {
    if (!familyData.name) {
      toast({ title: "Error", description: "Family name is required", variant: "destructive" });
      return;
    }

    // Inline validation — collect errors per member keyed by stable _id
    const errors: Record<number, MemberErrors> = {};
    members.forEach((m) => {
      const e: MemberErrors = {};
      if (!m.name.trim()) e.name = "Name is required";
      if (m.age === "" || m.age <= 0 || !Number.isFinite(Number(m.age))) e.age = "Enter a valid age";
      if (Object.keys(e).length > 0) errors[m._id] = e;
    });
    if (Object.keys(errors).length > 0) {
      setMemberErrors(errors);
      return;
    }
    setMemberErrors({});

    if (members.length < 2) {
      toast({ title: "At least 2 members required", description: "Please add at least one more family member before saving.", variant: "destructive" });
      return;
    }
    if (members.length > 5) {
      toast({ title: "Maximum 5 members", description: "Please remove some members to continue (family limit: 5).", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const enrichedPreferences = [
        ...familyData.cuisinePreferences,
        familyData.dietaryType,
        `cooking_time:${familyData.cookingTimePreference}`,
        `health_goal:${familyData.healthGoal}`,
        ...familyData.fastingDays.map(d => `fasting:${d}`),
      ];
      const fam = await createFamily.mutateAsync({
        data: { ...familyData, cuisinePreferences: enrichedPreferences },
      });
      
      // Save all members — encode per-member healthGoal, dietaryType, fastingDays into dietaryRestrictions array
      for (const member of members) {
        if (member.name) {
          const enrichedDietaryRestrictions = [
            ...member.dietaryRestrictions,
            ...(member.dietaryType ? [`diet_type:${member.dietaryType}`] : []),
            ...(member.healthGoal && member.healthGoal !== "general_wellness" ? [`health_goal:${member.healthGoal}`] : []),
            ...member.memberFastingDays.filter(d => d !== "none").map(d => `fasting:${d}`),
          ];
          const allergyList = member.foodAllergies
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);
          await addMember.mutateAsync({
            familyId: fam.id,
            data: {
              name: member.name,
              role: member.role,
              age: Number(member.age),
              gender: member.gender,
              weightKg: member.weightKg,
              heightCm: member.heightCm,
              activityLevel: member.activityLevel,
              healthConditions: member.healthConditions.filter(c => c !== "none"),
              dietaryRestrictions: enrichedDietaryRestrictions,
              allergies: allergyList,
            }
          });
        }
      }
      
      await queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      toast({ title: "Success!", description: "Family profile created. Now select what's in your pantry." });
      setLocation("/pantry");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Error saving profile", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">
          {step === 1 ? t("Family Details", "परिवार का विवरण") : t("Family Members", "सदस्य")}
        </h1>
        <div className="flex gap-2 mt-4">
          <div className={`h-2 flex-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-2 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-border"
          >
            <div className="space-y-6">
              {/* Voice profile setup */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/20">
                <div>
                  <p className="font-semibold text-sm">{t("Speak Your Family Profile", "अपनी प्रोफ़ाइल बोलें")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("Say family name, members, health goals in your language", "परिवार का नाम, सदस्य, स्वास्थ्य लक्ष्य बोलें")}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleVoiceInput}
                  disabled={isListening || voiceLoading}
                  className="gap-2 shrink-0"
                >
                  {voiceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isListening ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4" />}
                  {voiceLoading ? t("Parsing…", "समझ रहा है…") : isListening ? t("Listening…", "सुन रहा है…") : t("Speak Profile", "प्रोफ़ाइल बोलें")}
                </Button>
              </div>

              <div>
                <Label className="text-base">{t("Family Name", "परिवार का नाम")}</Label>
                <Input 
                  value={familyData.name}
                  onChange={(e) => setFamilyData({...familyData, name: e.target.value})}
                  className="mt-2 h-12 rounded-xl text-lg bg-background"
                  placeholder="e.g. Sharma Family"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>{t("State", "राज्य")}</Label>
                  <Select value={familyData.state} onValueChange={v => setFamilyData({...familyData, state: v})}>
                    <SelectTrigger className="mt-2 h-12 rounded-xl">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Andhra Pradesh">Andhra Pradesh</SelectItem>
                      <SelectItem value="Arunachal Pradesh">Arunachal Pradesh</SelectItem>
                      <SelectItem value="Assam">Assam</SelectItem>
                      <SelectItem value="Bihar">Bihar</SelectItem>
                      <SelectItem value="Chhattisgarh">Chhattisgarh</SelectItem>
                      <SelectItem value="Delhi">Delhi (NCT)</SelectItem>
                      <SelectItem value="Goa">Goa</SelectItem>
                      <SelectItem value="Gujarat">Gujarat</SelectItem>
                      <SelectItem value="Haryana">Haryana</SelectItem>
                      <SelectItem value="Himachal Pradesh">Himachal Pradesh</SelectItem>
                      <SelectItem value="Jharkhand">Jharkhand</SelectItem>
                      <SelectItem value="Karnataka">Karnataka</SelectItem>
                      <SelectItem value="Kerala">Kerala</SelectItem>
                      <SelectItem value="Madhya Pradesh">Madhya Pradesh</SelectItem>
                      <SelectItem value="Maharashtra">Maharashtra</SelectItem>
                      <SelectItem value="Manipur">Manipur</SelectItem>
                      <SelectItem value="Meghalaya">Meghalaya</SelectItem>
                      <SelectItem value="Mizoram">Mizoram</SelectItem>
                      <SelectItem value="Nagaland">Nagaland</SelectItem>
                      <SelectItem value="Odisha">Odisha</SelectItem>
                      <SelectItem value="Punjab">Punjab</SelectItem>
                      <SelectItem value="Rajasthan">Rajasthan</SelectItem>
                      <SelectItem value="Sikkim">Sikkim</SelectItem>
                      <SelectItem value="Tamil Nadu">Tamil Nadu</SelectItem>
                      <SelectItem value="Telangana">Telangana</SelectItem>
                      <SelectItem value="Tripura">Tripura</SelectItem>
                      <SelectItem value="UP">Uttar Pradesh</SelectItem>
                      <SelectItem value="Uttarakhand">Uttarakhand</SelectItem>
                      <SelectItem value="West Bengal">West Bengal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Monthly Food Budget (₹)", "मासिक खाद्य बजट (₹)")}</Label>
                  <Input 
                    type="number" 
                    value={familyData.monthlyBudget}
                    onChange={(e) => setFamilyData({...familyData, monthlyBudget: parseInt(e.target.value) || 0})}
                    className="mt-2 h-12 rounded-xl bg-background"
                  />
                </div>
                <div>
                  <Label>{t("Primary Language", "मुख्य भाषा")}</Label>
                  <Select value={familyData.primaryLanguage} onValueChange={v => setFamilyData({...familyData, primaryLanguage: v})}>
                    <SelectTrigger className="mt-2 h-12 rounded-xl">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hindi">Hindi / हिंदी</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="bengali">Bengali / বাংলা</SelectItem>
                      <SelectItem value="tamil">Tamil / தமிழ்</SelectItem>
                      <SelectItem value="telugu">Telugu / తెలుగు</SelectItem>
                      <SelectItem value="marathi">Marathi / मराठी</SelectItem>
                      <SelectItem value="gujarati">Gujarati / ગુજરાતી</SelectItem>
                      <SelectItem value="kannada">Kannada / ಕನ್ನಡ</SelectItem>
                      <SelectItem value="malayalam">Malayalam / മലയാളം</SelectItem>
                      <SelectItem value="punjabi">Punjabi / ਪੰਜਾਬੀ</SelectItem>
                      <SelectItem value="odia">Odia / ଓଡ଼ିଆ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Dietary Type", "आहार प्रकार")}</Label>
                  <Select value={familyData.dietaryType} onValueChange={v => setFamilyData({...familyData, dietaryType: v as typeof familyData.dietaryType})}>
                    <SelectTrigger className="mt-2 h-12 rounded-xl">
                      <SelectValue placeholder="Dietary preference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vegetarian">Vegetarian / शाकाहारी</SelectItem>
                      <SelectItem value="non-vegetarian">Non-Vegetarian / मांसाहारी</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                      <SelectItem value="jain">Jain / जैन</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Cooking Time Available", "खाना पकाने का समय")}</Label>
                  <Select value={familyData.cookingTimePreference} onValueChange={v => setFamilyData({...familyData, cookingTimePreference: v as typeof familyData.cookingTimePreference})}>
                    <SelectTrigger className="mt-2 h-12 rounded-xl">
                      <SelectValue placeholder="Cooking time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quick">Quick (&lt;30 min) / जल्दी</SelectItem>
                      <SelectItem value="moderate">Moderate (30–60 min) / मध्यम</SelectItem>
                      <SelectItem value="elaborate">Elaborate (&gt;60 min) / विस्तृत</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Health Goal", "स्वास्थ्य लक्ष्य")}</Label>
                  <Select value={familyData.healthGoal} onValueChange={v => setFamilyData({...familyData, healthGoal: v as typeof familyData.healthGoal})}>
                    <SelectTrigger className="mt-2 h-12 rounded-xl">
                      <SelectValue placeholder="Health goal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general_wellness">General Wellness / सामान्य स्वास्थ्य</SelectItem>
                      <SelectItem value="weight_loss">Weight Loss / वजन घटाना</SelectItem>
                      <SelectItem value="muscle_gain">Muscle Gain / मांसपेशी बनाना</SelectItem>
                      <SelectItem value="manage_diabetes">Manage Diabetes / मधुमेह नियंत्रण</SelectItem>
                      <SelectItem value="heart_health">Heart Health / हृदय स्वास्थ्य</SelectItem>
                      <SelectItem value="manage_thyroid">Manage Thyroid / थायरॉइड नियंत्रण</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-base">{t("Fasting Days", "व्रत के दिन")} <span className="text-muted-foreground text-sm font-normal">({t("optional", "वैकल्पिक")})</span></Label>
                <p className="text-sm text-muted-foreground mb-3">{t("Select days your family regularly fasts", "परिवार किन दिनों उपवास रखता है")}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "monday", en: "Monday", hi: "सोमवार" },
                    { key: "tuesday", en: "Tuesday", hi: "मंगलवार" },
                    { key: "thursday", en: "Thursday", hi: "गुरुवार" },
                    { key: "saturday", en: "Saturday", hi: "शनिवार" },
                    { key: "ekadashi", en: "Ekadashi", hi: "एकादशी" },
                    { key: "navratri", en: "Navratri", hi: "नवरात्रि" },
                    { key: "shravan", en: "Shravan Mondays", hi: "सावन सोमवार" },
                    { key: "karva_chauth", en: "Karva Chauth", hi: "करवा चौथ" },
                  ].map(({ key, en, hi }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleFastingDay(key)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        familyData.fastingDays.includes(key)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:border-primary"
                      }`}
                    >
                      {t(en, hi)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 flex justify-end">
                <Button 
                  size="lg" 
                  className="rounded-xl h-12 px-8" 
                  onClick={() => setStep(2)}
                  disabled={!familyData.name}
                >
                  {t("Next Step", "अगला कदम")} <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {members.map((member, idx) => (
              <div key={member._id} className="bg-white rounded-3xl p-6 shadow-sm border border-border relative">
                {members.length > 1 && (
                  <button onClick={() => handleRemoveMember(idx)} className="absolute top-4 right-4 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                
                <h3 className="font-display font-bold text-lg mb-4">{t("Member", "सदस्य")} #{idx + 1}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label>{t("Name", "नाम")} <span className="text-destructive">*</span></Label>
                    <Input 
                      value={member.name} 
                      onChange={e => {
                        handleUpdateMember(idx, "name", e.target.value);
                        if (memberErrors[member._id]?.name) setMemberErrors(prev => ({ ...prev, [member._id]: { ...prev[member._id], name: undefined } }));
                      }}
                      className={`mt-1 ${memberErrors[member._id]?.name ? "border-destructive" : ""}`}
                    />
                    {memberErrors[member._id]?.name && <p className="text-xs text-destructive mt-1">{memberErrors[member._id].name}</p>}
                  </div>
                  <div>
                    <Label>{t("Role", "संबंध")}</Label>
                    <Select value={member.role} onValueChange={v => handleUpdateMember(idx, "role", v)}>
                      <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="father">{t("Father", "पिता")}</SelectItem>
                        <SelectItem value="mother">{t("Mother", "माँ")}</SelectItem>
                        <SelectItem value="spouse">{t("Spouse", "जीवनसाथी")}</SelectItem>
                        <SelectItem value="child">{t("Child", "बच्चा")}</SelectItem>
                        <SelectItem value="grandparent">{t("Grandparent", "दादा-दादी")}</SelectItem>
                        <SelectItem value="other">{t("Other", "अन्य")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>{t("Age", "आयु")} <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      value={member.age}
                      onChange={e => {
                        const val = e.target.value === "" ? "" : parseInt(e.target.value);
                        handleUpdateMember(idx, "age", val as number | "");
                        if (memberErrors[member._id]?.age) setMemberErrors(prev => ({ ...prev, [member._id]: { ...prev[member._id], age: undefined } }));
                      }}
                      className={`mt-1 ${memberErrors[member._id]?.age ? "border-destructive" : ""}`}
                    />
                    {memberErrors[member._id]?.age && <p className="text-xs text-destructive mt-1">{memberErrors[member._id].age}</p>}
                  </div>
                  <div>
                    <Label>{t("Weight (kg)", "वजन (किग्रा)")}</Label>
                    <Input type="number" value={member.weightKg} onChange={e => handleUpdateMember(idx, "weightKg", parseInt(e.target.value) || 60)} className="mt-1" />
                  </div>
                  <div>
                    <Label>{t("Height (cm)", "ऊंचाई (सेमी)")}</Label>
                    <Input type="number" value={member.heightCm} onChange={e => handleUpdateMember(idx, "heightCm", parseInt(e.target.value) || 160)} className="mt-1" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">{t("Health Goal", "स्वास्थ्य लक्ष्य")}</Label>
                    <Select value={member.healthGoal} onValueChange={v => handleUpdateMember(idx, "healthGoal", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general_wellness">{t("General Wellness", "सामान्य स्वास्थ्य")}</SelectItem>
                        <SelectItem value="weight_loss">{t("Weight Loss", "वजन घटाना")}</SelectItem>
                        <SelectItem value="manage_diabetes">{t("Manage Diabetes", "मधुमेह नियंत्रण")}</SelectItem>
                        <SelectItem value="anemia_recovery">{t("Anemia Recovery", "रक्ताल्पता")}</SelectItem>
                        <SelectItem value="child_growth">{t("Child Growth", "बच्चे का विकास")}</SelectItem>
                        <SelectItem value="heart_health">{t("Heart Health", "हृदय स्वास्थ्य")}</SelectItem>
                        <SelectItem value="muscle_gain">{t("Muscle Gain", "मांसपेशी वृद्धि")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">{t("Dietary Type", "आहार प्रकार")}</Label>
                    <Select value={member.dietaryType} onValueChange={v => handleUpdateMember(idx, "dietaryType", v)}>
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
                </div>

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
                      { id: 'growing_child', en: 'Growing Child', hi: 'बढ़ता बच्चा' },
                      { id: 'elderly', en: 'Elderly (60+)', hi: 'बुजुर्ग (60+)' },
                      { id: 'none', en: 'None', hi: 'कोई नहीं' },
                    ].map(({ id: cond, en, hi }) => (
                      <div key={cond} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`${member._id}-${cond}`}
                          checked={member.healthConditions.includes(cond)}
                          onCheckedChange={() => toggleMemberCondition(idx, cond)}
                        />
                        <Label htmlFor={`${member._id}-${cond}`}>{t(en, hi)}</Label>
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
                      { id: "ramadan", en: "Ramadan", hi: "रमजान" },
                      { id: "none", en: "None", hi: "कोई नहीं" },
                    ].map(({ id: day, en, hi }) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${member._id}-fasting-${day}`}
                          checked={member.memberFastingDays.includes(day)}
                          onCheckedChange={() => toggleMemberFasting(idx, day)}
                        />
                        <Label htmlFor={`${member._id}-fasting-${day}`} className="text-xs">{t(en, hi)}</Label>
                      </div>
                    ))}

                    <div className="pt-2">
                      <Label className="text-sm font-semibold">{t("Food Allergies", "खाद्य एलर्जी")} <span className="font-normal text-muted-foreground">({t("optional", "वैकल्पिक")})</span></Label>
                      <Input
                        value={member.foodAllergies}
                        onChange={e => handleUpdateMember(idx, "foodAllergies", e.target.value)}
                        placeholder={t("e.g. peanuts, milk, gluten", "जैसे मूंगफली, दूध, ग्लूटन")}
                        className="mt-1 text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{t("Separate multiple with commas", "कई एलर्जी को कॉमा से अलग करें")}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button 
              type="button" 
              variant="outline" 
              onClick={handleAddMember}
              disabled={members.length >= 5}
              className="w-full h-14 rounded-2xl border-dashed border-2 text-muted-foreground hover:text-primary hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5 mr-2" />
              {members.length >= 5 ? t("Maximum 5 members reached", "अधिकतम 5 सदस्य") : t("Add Another Member", "एक और सदस्य जोड़ें")}
            </Button>

            <div className="flex justify-between pt-6">
              <Button variant="ghost" size="lg" className="rounded-xl" onClick={() => setStep(1)}>
                <ArrowLeft className="w-5 h-5 mr-2" /> {t("Back", "वापस")}
              </Button>
              <Button size="lg" className="rounded-xl px-8" onClick={handleSave} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                {t("Save Family Profile", "परिवार प्रोफ़ाइल सेव करें")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
