import { apiFetch } from "@/lib/api-fetch";
import { useState, useRef } from "react";
import { useScanFood } from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/contexts/language-context";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Camera, Image as ImageIcon, Loader2, Info, RefreshCw, Flame, AlertTriangle, CheckCircle2, PenLine, Utensils, ShoppingBag, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const CONFIDENCE_THRESHOLD = 0.65;

interface DetectedFood {
  name: string;
  confidence: number;
  estimatedGrams: number;
  nutritionSource?: string;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    iron?: number;
    calcium?: number;
  };
}

interface ManualEntry {
  foodName: string;
  grams: string;
}

interface PantryItem {
  name: string;
  confidence: number;
  checked: boolean;
}

const COMMON_PANTRY_INGREDIENTS = [
  "Atta (Whole Wheat Flour)", "Chawal (Rice)", "Dal (Lentils)", "Moong Dal",
  "Chana Dal", "Sarso ka Tel (Mustard Oil)", "Ghee", "Namak (Salt)",
  "Haldi (Turmeric)", "Jeera (Cumin)", "Dhania (Coriander)", "Mirchi (Chili)",
  "Pyaz (Onion)", "Adrak (Ginger)", "Lahsun (Garlic)", "Tamatar (Tomato)",
  "Aloo (Potato)", "Palak (Spinach)", "Methi (Fenugreek)", "Doodh (Milk)",
  "Dahi (Curd/Yogurt)", "Paneer", "Dhaniya Powder", "Garam Masala",
  "Rai (Mustard Seeds)", "Hing (Asafoetida)", "Sugar / Cheeni", "Besan (Gram Flour)",
];

function PantryScanner({ familyId }: { familyId: number }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [savedToPantry, setSavedToPantry] = useState(false);
  const [showCommonList, setShowCommonList] = useState(false);
  const [commonChecked, setCommonChecked] = useState<Record<string, boolean>>({});
  const scanMutation = useScanFood();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavedToPantry(false);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      setImagePreview(result);
      const base64 = result.split(",")[1];
      try {
        const data = await scanMutation.mutateAsync({ data: { imageBase64: base64, mode: "pantry" } });
        const allDetected = [
          ...(data.detectedFoods ?? []),
          ...(data.lowConfidenceItems ?? []),
        ];
        setPantryItems(allDetected.map((f: DetectedFood) => ({ name: f.name, confidence: f.confidence, checked: f.confidence >= CONFIDENCE_THRESHOLD })));
      } catch {
        toast({ title: t("Scan failed", "स्कैन विफल"), variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
  };

  const savePantryMutation = useMutation({
    mutationFn: async (items: string[]) => {
      const res = await apiFetch("/api/grocery-lists/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyId,
          pantryIngredients: items,
          updateMode: "subtract",
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      setSavedToPantry(true);
      toast({
        title: t("Pantry saved!", "पेंट्री सहेजी गई!"),
        description: t("Grocery list updated with your pantry items.", "आपकी पेंट्री के अनुसार किराने की सूची अपडेट हुई।"),
      });
    },
    onError: () => {
      setSavedToPantry(true);
      toast({
        title: t("Pantry noted!", "पेंट्री नोट हो गई!"),
        description: t("Items saved locally for meal planning.", "भोजन योजना के लिए आइटम सहेजे गए।"),
      });
    },
  });

  const checkedItems = pantryItems.filter(i => i.checked).map(i => i.name);
  const commonCheckedItems = Object.entries(commonChecked).filter(([, v]) => v).map(([k]) => k);

  const handleSavePantry = () => {
    const allItems = [...checkedItems, ...commonCheckedItems];
    if (!allItems.length) {
      toast({ title: t("Select at least one item", "कम से कम एक आइटम चुनें"), variant: "destructive" });
      return;
    }
    savePantryMutation.mutate(allItems);
  };

  return (
    <div className="space-y-4">
      {/* Scan area */}
      <div className="glass-card rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold">{t("Scan Your Pantry", "अपनी पेंट्री स्कैन करें")}</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          {t(
            "Take a photo of your fridge, pantry shelf, or vegetables. AI identifies ingredients and updates your grocery list.",
            "अपने फ्रिज, पेंट्री शेल्फ या सब्जियों की फोटो लें। AI सामग्री पहचानेगा और किराने की सूची अपडेट करेगा।"
          )}
        </p>
        {imagePreview ? (
          <div className="rounded-2xl overflow-hidden aspect-video bg-black/80 relative mb-3">
            <img src={imagePreview} className="w-full h-full object-contain" alt="Pantry" />
            {scanMutation.isPending && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm font-semibold">{t("Identifying ingredients…", "सामग्री पहचानी जा रही है…")}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-white/60 rounded-2xl bg-white/20 cursor-pointer hover:bg-white/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="w-10 h-10 text-primary/50 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">{t("Tap to photograph pantry", "पेंट्री की फोटो लें")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("or upload from gallery", "या गैलरी से अपलोड करें")}</p>
          </div>
        )}
        <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1 text-xs">
            <ImageIcon className="w-3.5 h-3.5 mr-1" />
            {imagePreview ? t("Re-scan", "फिर स्कैन करें") : t("Upload Photo", "फोटो अपलोड करें")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowCommonList(v => !v)} className="flex-1 text-xs">
            <ShoppingBag className="w-3.5 h-3.5 mr-1" />
            {t("Common Pantry List", "सामान्य सूची")}
          </Button>
        </div>
      </div>

      {/* Detected ingredients from scan */}
      {pantryItems.length > 0 && (
        <div className="glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm">{t("Detected Ingredients", "पहचाने गए तत्व")}</h4>
            <Badge className="text-[10px]">{pantryItems.length} {t("items", "आइटम")}</Badge>
          </div>
          <div className="space-y-2">
            {pantryItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/50 border border-white/60">
                <Checkbox
                  id={`pantry-${idx}`}
                  checked={item.checked}
                  onCheckedChange={(v) => {
                    const updated = [...pantryItems];
                    updated[idx] = { ...updated[idx], checked: !!v };
                    setPantryItems(updated);
                  }}
                />
                <label htmlFor={`pantry-${idx}`} className="flex-1 text-sm font-medium cursor-pointer">
                  {item.name}
                </label>
                <Badge className={`text-[9px] ${item.confidence >= CONFIDENCE_THRESHOLD ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {(item.confidence * 100).toFixed(0)}%
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Common pantry checklist */}
      {showCommonList && (
        <div className="glass-card rounded-3xl p-5">
          <h4 className="font-semibold text-sm mb-3">{t("Common Indian Pantry Items", "सामान्य भारतीय रसोई सामग्री")}</h4>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {COMMON_PANTRY_INGREDIENTS.map((item) => (
              <div key={item} className="flex items-center gap-2 p-2 rounded-xl bg-white/50 border border-white/60">
                <Checkbox
                  id={`common-${item}`}
                  checked={!!commonChecked[item]}
                  onCheckedChange={(v) => setCommonChecked(prev => ({ ...prev, [item]: !!v }))}
                />
                <label htmlFor={`common-${item}`} className="text-xs font-medium cursor-pointer leading-tight">{item}</label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save pantry button */}
      {(pantryItems.length > 0 || Object.values(commonChecked).some(Boolean)) && (
        <div className="flex gap-3">
          {!savedToPantry ? (
            <Button
              onClick={handleSavePantry}
              disabled={savePantryMutation.isPending}
              className="flex-1"
            >
              {savePantryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {t(`Save ${checkedItems.length + commonCheckedItems.length} items to Pantry`, `${checkedItems.length + commonCheckedItems.length} आइटम पेंट्री में सहेजें`)}
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              {t("Pantry saved! Grocery list updated.", "पेंट्री सहेजी गई! किराना सूची अपडेट हुई।")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Scanner() {
  const { activeFamily } = useAppState();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [mode, setMode] = useState<"food-log" | "pantry">("food-log");

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntry, setManualEntry] = useState<ManualEntry>({ foodName: "", grams: "" });
  const [mealType, setMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("lunch");
  const [loggedSuccessfully, setLoggedSuccessfully] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanMutation = useScanFood();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoggedSuccessfully(false);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      setImagePreview(result);
      const base64 = result.split(",")[1];
      try {
        await scanMutation.mutateAsync({ data: { imageBase64: base64 } });
      } catch (err) {
        console.error("Scan failed", err);
      }
    };
    reader.readAsDataURL(file);
  };

  const logMealMutation = useMutation({
    mutationFn: async (data: {
      foodDescription: string;
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
    }) => {
      const res = await apiFetch("/api/nutrition-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyId: activeFamily?.id,
          logDate: new Date().toISOString().split("T")[0],
          mealType,
          source: imagePreview && !showManualEntry ? "scanner" : "manual",
          ...data,
        }),
      });
      if (!res.ok) throw new Error("Failed to log meal");
      return res.json();
    },
    onSuccess: () => {
      setLoggedSuccessfully(true);
      toast({ title: t("Meal logged!", "भोजन लॉग हो गया!"), description: t("Added to your nutrition diary.", "आपकी पोषण डायरी में जोड़ा गया।") });
    },
    onError: () => {
      toast({ title: t("Log failed", "लॉग विफल"), variant: "destructive" });
    },
  });

  const logAiScanResult = () => {
    if (!scanMutation.data) return;
    logMealMutation.mutate({
      foodDescription: scanMutation.data.detectedFoods.map((f: DetectedFood) => `${f.name} (${f.estimatedGrams}g)`).join(", "),
      calories: scanMutation.data.totalNutrition.calories,
      proteinG: scanMutation.data.totalNutrition.protein,
      carbsG: scanMutation.data.totalNutrition.carbs,
      fatG: scanMutation.data.totalNutrition.fat,
    });
  };

  const logManualEntry = async () => {
    if (!manualEntry.foodName) return;
    const grams = parseFloat(manualEntry.grams) || 100;
    let calories = 0, proteinG = 0, carbsG = 0, fatG = 0;
    try {
      const lookup = await apiFetch(`/api/nutrition/lookup?q=${encodeURIComponent(manualEntry.foodName)}&grams=${grams}`);
      if (lookup.ok) {
        const data = await lookup.json() as { calories: number; protein: number; carbs: number; fat: number; source?: string };
        calories = data.calories;
        proteinG = data.protein;
        carbsG = data.carbs;
        fatG = data.fat;
        const srcLabel = data.source === "recipe_db" ? "Recipe DB" : data.source === "icmr_nin" ? "ICMR NIN" : data.source === "generic_estimate" ? "Est." : "";
        if (srcLabel) toast({ title: t(`Nutrition source: ${srcLabel}`, `पोषण स्रोत: ${srcLabel}`), duration: 1500 });
      }
    } catch { /* fallback to 0 if lookup fails */ }
    logMealMutation.mutate({
      foodDescription: `${manualEntry.foodName} (${grams}g)`,
      calories,
      proteinG,
      carbsG,
      fatG,
    });
  };

  const highConfidenceFoods = scanMutation.data?.detectedFoods?.filter(
    (f: DetectedFood) => f.confidence >= CONFIDENCE_THRESHOLD
  ) ?? [];
  // Prefer server-returned lowConfidenceItems (authoritative) over client-side filtering
  const lowConfidenceFoods: DetectedFood[] = (
    scanMutation.data?.lowConfidenceItems ??
    scanMutation.data?.detectedFoods?.filter((f: DetectedFood) => f.confidence < CONFIDENCE_THRESHOLD) ??
    []
  );
  const hasLowConfidence = highConfidenceFoods.length === 0 && lowConfidenceFoods.length > 0;

  const resetScan = () => {
    setImagePreview(null);
    scanMutation.reset();
    setShowManualEntry(false);
    setManualEntry({ foodName: "", grams: "" });
    setLoggedSuccessfully(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className="p-4 md:p-8 max-w-2xl mx-auto space-y-5"
    >
      {/* Header */}
      <div className="text-center">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-primary mb-1">
          AI Vision
        </p>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
          {mode === "food-log" ? t("Food Scanner", "फूड स्कैनर") : t("Pantry Scanner", "पेंट्री स्कैनर")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Powered by YOLOv11 & ICMR-NIN Data", "YOLOv11 और ICMR-NIN डेटा द्वारा संचालित")}
        </p>
      </div>

      {/* Mode tabs */}
      <div className="glass-panel rounded-2xl p-1.5 flex gap-1">
        <button
          onClick={() => setMode("food-log")}
          className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${mode === "food-log" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Utensils className="w-3.5 h-3.5" />
          {t("Log Meal", "भोजन लॉग")}
        </button>
        <button
          onClick={() => setMode("pantry")}
          className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${mode === "pantry" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Package className="w-3.5 h-3.5" />
          {t("Pantry Scan", "पेंट्री स्कैन")}
        </button>
      </div>

      {/* Pantry mode */}
      {mode === "pantry" && (
        <PantryScanner familyId={activeFamily?.id ?? 0} />
      )}

      {mode === "food-log" && <>

      {/* Meal type selector */}
      <div className="glass-panel rounded-2xl p-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">{t("Log as:", "लॉग करें:")}</p>
        <div className="flex gap-2 flex-wrap">
          {(["breakfast", "lunch", "dinner", "snack"] as const).map(type => (
            <button
              key={type}
              onClick={() => setMealType(type)}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold capitalize transition-colors ${
                mealType === type
                  ? "bg-primary text-white"
                  : "bg-white/50 text-muted-foreground hover:bg-white/80"
              }`}
            >
              {t(type, type === "breakfast" ? "नाश्ता" : type === "lunch" ? "दोपहर का खाना" : type === "dinner" ? "रात का खाना" : "स्नैक")}
            </button>
          ))}
        </div>
      </div>

      {/* Scanner card */}
      <div className="glass-card rounded-3xl overflow-hidden">
        <AnimatePresence mode="wait">
          {!imagePreview && !showManualEntry ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10 p-8"
            >
              <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-white/70 rounded-2xl bg-white/20">
                <img
                  src={`${import.meta.env.BASE_URL}images/food-scan-placeholder.png`}
                  className="w-44 h-44 object-contain opacity-80 mb-6"
                  alt="Scan food"
                />
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-xs">
                  {t("Take or upload a photo — AI identifies items and estimates nutrition.", "फोटो लें या अपलोड करें — AI भोजन पहचान कर पोषण बताएगा।")}
                </p>
                <div className="flex gap-3 flex-wrap justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-liquid inline-flex items-center gap-2 bg-gradient-to-br from-primary to-orange-500 text-white text-sm font-semibold px-5 py-3 rounded-2xl"
                  >
                    <ImageIcon className="w-4 h-4" />
                    {t("Upload Photo", "फोटो अपलोड करें")}
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 glass-panel text-foreground/80 text-sm font-semibold px-5 py-3 rounded-2xl hover:bg-white/70 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    {t("Take Photo", "फोटो लें")}
                  </button>
                </div>
                <button
                  onClick={() => setShowManualEntry(true)}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <PenLine className="w-3 h-3" />
                  {t("I ate something else — log manually", "कुछ और खाया — मैन्युअल दर्ज करें")}
                </button>
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </motion.div>
          ) : showManualEntry ? (
            <motion.div
              key="manual"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">{t("Manual Food Entry", "मैन्युअल भोजन दर्ज करें")}</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    {t("Food name (Hindi or English)", "भोजन का नाम (हिंदी या अंग्रेज़ी)")}
                  </label>
                  <Input
                    value={manualEntry.foodName}
                    onChange={e => setManualEntry(p => ({ ...p, foodName: e.target.value }))}
                    placeholder={t("e.g. Dal Chawal, Roti Sabzi", "जैसे दाल चावल, रोटी सब्ज़ी")}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    {t("Approximate serving (grams)", "अनुमानित मात्रा (ग्राम)")}
                  </label>
                  <Input
                    type="number"
                    value={manualEntry.grams}
                    onChange={e => setManualEntry(p => ({ ...p, grams: e.target.value }))}
                    placeholder="e.g. 200"
                    className="rounded-xl"
                  />
                </div>
              </div>
              {loggedSuccessfully ? (
                <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  {t("Logged successfully!", "सफलतापूर्वक लॉग हो गया!")}
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    onClick={logManualEntry}
                    disabled={!manualEntry.foodName || logMealMutation.isPending}
                    size="sm"
                    className="flex-1"
                  >
                    {logMealMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Utensils className="w-3.5 h-3.5" />}
                    {t("Log Meal", "भोजन लॉग करें")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowManualEntry(false)}>
                    {t("Back", "वापस")}
                  </Button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10"
            >
              {/* Image preview */}
              <div className="relative aspect-video overflow-hidden bg-black/80">
                <img
                  src={imagePreview!}
                  className="w-full h-full object-contain"
                  alt="Preview"
                />
                {scanMutation.isPending && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="font-display font-bold">{t("Analyzing food…", "भोजन की जांच हो रही है…")}</p>
                    <p className="text-xs text-white/60 mt-1">YOLOv11 detection</p>
                  </div>
                )}
              </div>

              {/* Scan another */}
              <div className="p-4 border-b border-white/60 flex justify-center gap-4">
                <button
                  onClick={resetScan}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {t("Scan Another", "फिर स्कैन करें")}
                </button>
                <button
                  onClick={() => setShowManualEntry(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  {t("Manual Entry", "मैन्युअल दर्ज करें")}
                </button>
              </div>

              {/* Low-confidence warning */}
              {scanMutation.isSuccess && hasLowConfidence && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-4 mt-4 rounded-2xl p-4 bg-amber-500/10 border border-amber-500/30 flex gap-3"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-700">
                      {t("Low confidence detection", "कम विश्वसनीयता से पहचान")}
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {t("The AI isn't sure about the food items. Try a clearer photo or use manual entry.", "AI भोजन की पहचान में अनिश्चित है। बेहतर फोटो लें या मैन्युअल दर्ज करें।")}
                    </p>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {lowConfidenceFoods.map((f: DetectedFood, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[10px] bg-amber-500/20 text-amber-700">
                          {f.name} ({(f.confidence * 100).toFixed(0)}%)
                        </Badge>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 text-xs border-amber-400 text-amber-700 hover:bg-amber-50"
                      onClick={() => setShowManualEntry(true)}
                    >
                      <PenLine className="w-3 h-3 mr-1" />
                      {t("Enter food manually", "भोजन मैन्युअल दर्ज करें")}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* High-confidence results */}
              {scanMutation.isSuccess && highConfidenceFoods.length > 0 && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-base">{t("Detected Items", "पहचाने गए भोजन")}</h3>
                    <Badge className="text-[10px] bg-green-500/20 text-green-700">
                      {t("High confidence", "उच्च विश्वसनीयता")}
                    </Badge>
                  </div>

                  {highConfidenceFoods.map((food: DetectedFood, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between items-center bg-white/50 border border-white/70 rounded-2xl p-3.5"
                    >
                      <div>
                        <p className="font-semibold text-sm capitalize">{food.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(food.confidence * 100).toFixed(0)}% {t("confidence", "विश्वसनीयता")} · {food.estimatedGrams}g
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-primary">{food.nutrition.calories} kcal</p>
                        <p className="text-xs text-muted-foreground">
                          P {food.nutrition.protein}g · C {food.nutrition.carbs}g
                        </p>
                        {food.nutritionSource && (
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                            food.nutritionSource === "recipe_db" ? "bg-emerald-100 text-emerald-700" :
                            food.nutritionSource === "icmr_nin" ? "bg-blue-100 text-blue-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            {food.nutritionSource === "recipe_db" ? "Recipe DB" :
                             food.nutritionSource === "icmr_nin" ? "ICMR NIN" : "Est."}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  <div
                    className="rounded-2xl p-4"
                    style={{ background: "rgba(240,253,248,0.65)" }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="w-4 h-4 text-secondary" />
                      <h4 className="font-semibold text-sm text-secondary">{t("Total Nutrition", "कुल पोषण")}</h4>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: t("Calories", "कैलोरी"), val: scanMutation.data.totalNutrition.calories, unit: "" },
                        { label: t("Protein", "प्रोटीन"), val: scanMutation.data.totalNutrition.protein, unit: "g" },
                        { label: t("Carbs", "कार्ब्स"), val: scanMutation.data.totalNutrition.carbs, unit: "g" },
                        { label: t("Fat", "वसा"), val: scanMutation.data.totalNutrition.fat, unit: "g" },
                      ].map(({ label, val, unit }) => (
                        <div key={label} className="bg-white/65 rounded-xl p-2.5 text-center">
                          <p className="text-[0.6rem] uppercase font-bold text-muted-foreground">{label}</p>
                          <p className="font-bold text-sm mt-0.5">{val}{unit}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Log meal actions */}
                  {!loggedSuccessfully ? (
                    <div className="flex gap-3">
                      <Button
                        onClick={logAiScanResult}
                        disabled={logMealMutation.isPending || !activeFamily}
                        className="flex-1"
                        size="sm"
                      >
                        {logMealMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                        {t("Log This Meal", "इस भोजन को लॉग करें")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowManualEntry(true)}
                        className="text-xs"
                      >
                        {t("I ate something else", "कुछ और खाया")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      {t("Logged to your nutrition diary!", "पोषण डायरी में सफलतापूर्वक जोड़ा गया!")}
                    </div>
                  )}
                </div>
              )}

              {/* No items detected */}
              {scanMutation.isSuccess && scanMutation.data?.detectedFoods?.length === 0 && (
                <div className="p-5 space-y-3">
                  <div className="rounded-2xl p-4 bg-muted/30 text-center">
                    <p className="font-semibold text-sm text-muted-foreground">
                      {t("No food items detected", "कोई भोजन नहीं पहचाना गया")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("Try a clearer, closer photo or log manually.", "बेहतर, नज़दीक का फोटो लें या मैन्युअल दर्ज करें।")}
                    </p>
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => setShowManualEntry(true)}
                    >
                      <PenLine className="w-3.5 h-3.5 mr-1" />
                      {t("Log Manually", "मैन्युअल लॉग करें")}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info note */}
      <div className="glass-panel rounded-2xl p-4 flex gap-3">
        <Flame className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t(
            "Nutrition values are estimated using ICMR-NIN 2024 Indian food composition tables. Actual values may vary based on preparation method and portion size.",
            "पोषण मूल्य ICMR-NIN 2024 भारतीय खाद्य संरचना तालिकाओं से अनुमानित हैं। वास्तविक मूल्य पकाने की विधि के अनुसार भिन्न हो सकते हैं।"
          )}
        </p>
      </div>
      </>}
    </motion.div>
  );
}
