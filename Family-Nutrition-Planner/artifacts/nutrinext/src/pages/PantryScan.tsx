import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/contexts/language-context";
import { useToast } from "@/hooks/use-toast";
import { useGenerateMealPlan } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Loader2, CheckCircle2, Circle, ArrowRight, SkipForward, Package, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const CONFIDENCE_THRESHOLD = 0.65;

interface PantryItem {
  name: string;
  nameHindi?: string;
  quantity: number;
  unit: string;
  weightGrams: number;
  confidence: number;
  checked: boolean;
  source: "vision" | "yolo";
}

export default function PantryScan() {
  const { activeFamily } = useAppState();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateMealPlan = useGenerateMealPlan();

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      setImagePreview(result);
      const base64 = result.split(",")[1];

      setIsScanning(true);
      setPantryItems([]);

      try {
        // Canonical mode-based scan endpoint
        const res = await fetch("/api/nutrition/scan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("auth_token") ?? ""}`,
          },
          body: JSON.stringify({ imageBase64: base64, mode: "pantry" }),
        });
        if (res.ok) {
          const scanData = await res.json() as {
            mode: "pantry";
            items?: Array<{ name: string; nameHindi?: string; quantity: number; unit: string; weightGrams: number; confidence: number }>;
          };
          if (scanData.items && scanData.items.length > 0) {
            setPantryItems(scanData.items.map(item => ({
              ...item,
              checked: item.confidence >= CONFIDENCE_THRESHOLD,
              source: "vision" as const,
            })));
            setIsScanning(false);
            return;
          }
        }
      } catch { /* fall through to legacy YOLO */ }

      try {
        const legacyRes = await fetch("/api/nutrition/food-scan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("auth_token") ?? ""}`,
          },
          body: JSON.stringify({ imageBase64: base64, mode: "pantry" }),
        });
        if (legacyRes.ok) {
          const data = await legacyRes.json() as {
            detectedFoods?: Array<{ name: string; confidence: number; estimatedGrams: number }>;
            lowConfidenceItems?: Array<{ name: string; confidence: number; estimatedGrams: number }>;
          };
          const allDetected = [...(data.detectedFoods ?? []), ...(data.lowConfidenceItems ?? [])];
          setPantryItems(allDetected.map((f) => ({
            name: f.name,
            quantity: 1,
            unit: "serving",
            weightGrams: f.estimatedGrams,
            confidence: f.confidence,
            checked: f.confidence >= CONFIDENCE_THRESHOLD,
            source: "yolo" as const,
          })));
        } else {
          throw new Error("YOLO scan failed");
        }
      } catch {
        toast({ title: t("Scan failed — try a clearer photo", "स्कैन विफल — साफ फोटो लें"), variant: "destructive" });
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const startEditItem = (idx: number) => {
    const item = pantryItems[idx];
    setEditingIdx(idx);
    setEditQty(String(item.quantity));
    setEditUnit(item.unit);
  };

  const saveEditItem = () => {
    if (editingIdx === null) return;
    const qty = parseFloat(editQty);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: t("Enter a valid quantity", "सही मात्रा दर्ज करें"), variant: "destructive" });
      return;
    }
    const updated = [...pantryItems];
    const item = updated[editingIdx];
    updated[editingIdx] = {
      ...item,
      quantity: qty,
      unit: editUnit.trim() || item.unit,
      weightGrams: editUnit.trim().toLowerCase() === "kg" ? qty * 1000 :
        editUnit.trim().toLowerCase() === "g" ? qty :
          item.weightGrams,
    };
    setPantryItems(updated);
    setEditingIdx(null);
  };

  const handleConfirm = async () => {
    if (!activeFamily) return;

    const checkedItems = pantryItems
      .filter(i => i.checked)
      .map(i => `${i.name}${i.nameHindi ? ` / ${i.nameHindi}` : ""} (${i.quantity} ${i.unit})`);

    if (checkedItems.length === 0) {
      toast({ title: t("Select at least one item", "कम से कम एक आइटम चुनें"), variant: "destructive" });
      return;
    }

    // Persist to localStorage so Pantry page also reflects the scan
    try {
      const existingRaw = localStorage.getItem(`pantry_${activeFamily.id}`) ?? "[]";
      const existing: string[] = JSON.parse(existingRaw) as string[];
      const merged = [...new Set([...existing, ...checkedItems])];
      localStorage.setItem(`pantry_${activeFamily.id}`, JSON.stringify(merged));
    } catch {
      localStorage.setItem(`pantry_${activeFamily.id}`, JSON.stringify(checkedItems));
    }

    // Directly pass quantities into meal plan generation
    setIsGenerating(true);
    toast({
      title: t("Generating your meal plan…", "भोजन योजना बन रही है…"),
      description: t(
        `Using ${checkedItems.length} pantry ingredient${checkedItems.length === 1 ? "" : "s"}`,
        `${checkedItems.length} पेंट्री सामग्री उपयोग हो रही है`
      ),
    });

    try {
      await generateMealPlan.mutateAsync({
        data: {
          familyId: activeFamily.id,
          weekStartDate: new Date().toISOString(),
          preferences: {
            pantryIngredients: checkedItems,
          },
        },
      });
      toast({
        title: t("Meal plan ready!", "भोजन योजना तैयार है!"),
        description: t(
          `${checkedItems.length} pantry items incorporated`,
          `${checkedItems.length} पेंट्री सामग्री शामिल की गई`
        ),
      });
      setLocation("/meal-plan");
    } catch {
      toast({
        title: t("Generation failed", "भोजन योजना नहीं बनी"),
        description: t("Pantry saved. Please generate from the meal plan page.", "पेंट्री सहेजी गई। कृपया भोजन योजना पृष्ठ से जनरेट करें।"),
        variant: "destructive",
      });
      setLocation("/meal-plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const checkedCount = pantryItems.filter(i => i.checked).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-8 max-w-2xl mx-auto space-y-5"
    >
      {/* Header */}
      <div className="text-center space-y-1">
        <Package className="w-10 h-10 text-primary mx-auto mb-2" />
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
          {t("Scan Your Pantry", "पेंट्री स्कैन करें")}
        </h1>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
          {t(
            "Photograph your fridge or pantry shelf. AI identifies ingredients and estimates quantities for smarter meal planning.",
            "अपने फ्रिज या शेल्फ की फोटो लें। AI सामग्री और मात्रा पहचानेगा।"
          )}
        </p>
      </div>

      {/* Camera area */}
      <div className="glass-card rounded-3xl p-5">
        {imagePreview ? (
          <div className="rounded-2xl overflow-hidden aspect-video bg-black/80 relative mb-3">
            <img src={imagePreview} className="w-full h-full object-contain" alt="Pantry" />
            {isScanning && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm font-semibold">
                    {t("AI Vision scanning…", "AI Vision स्कैन हो रहा है…")}
                  </p>
                  <p className="text-xs opacity-70 mt-1">
                    {t("Identifying ingredients and quantities", "सामग्री और मात्रा पहचान रहा है")}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-white/60 rounded-2xl bg-white/20 cursor-pointer hover:bg-white/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="w-12 h-12 text-primary/50 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">
              {t("Tap to photograph pantry", "पेंट्री की फोटो लें")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("or upload from gallery", "या गैलरी से अपलोड करें")}
            </p>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="w-full text-xs mt-3"
        >
          <Camera className="w-3.5 h-3.5 mr-1.5" />
          {imagePreview ? t("Re-scan Photo", "दोबारा स्कैन करें") : t("Take / Upload Photo", "फोटो लें / अपलोड करें")}
        </Button>
      </div>

      {/* Detected items with inline editing */}
      <AnimatePresence>
        {pantryItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-3xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">
                {t("Detected Ingredients", "पहचाने गए तत्व")}
              </h4>
              <div className="flex items-center gap-2">
                <Badge className="text-[10px]">{checkedCount}/{pantryItems.length} {t("selected", "चुने")}</Badge>
                <span className="text-[10px] text-muted-foreground">{t("Tap ✏ to edit qty", "मात्रा बदलने के लिए ✏ टैप करें")}</span>
              </div>
            </div>
            <div className="space-y-2">
              {pantryItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border transition-all ${item.checked ? "bg-primary/5 border-primary/20" : "bg-white/40 border-white/60"}`}
                >
                  {editingIdx === idx ? (
                    <div className="flex items-center gap-2 p-3">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-0.5">{t("Quantity", "मात्रा")}</p>
                          <Input
                            type="number"
                            value={editQty}
                            onChange={e => setEditQty(e.target.value)}
                            className="h-7 text-xs"
                            autoFocus
                          />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-0.5">{t("Unit", "इकाई")}</p>
                          <Input
                            type="text"
                            value={editUnit}
                            onChange={e => setEditUnit(e.target.value)}
                            placeholder="kg / g / pieces"
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={saveEditItem} className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingIdx(null)} className="w-7 h-7 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-center hover:bg-muted">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3">
                      <button
                        onClick={() => {
                          const updated = [...pantryItems];
                          updated[idx] = { ...updated[idx], checked: !updated[idx].checked };
                          setPantryItems(updated);
                        }}
                        className="shrink-0"
                      >
                        {item.checked
                          ? <CheckCircle2 className="w-5 h-5 text-primary" />
                          : <Circle className="w-5 h-5 text-muted-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        {item.nameHindi && (
                          <p className="text-[10px] text-muted-foreground">{item.nameHindi}</p>
                        )}
                        <p className="text-xs text-primary/80 font-semibold mt-0.5">
                          {item.quantity} {item.unit}
                          {item.weightGrams ? ` · ~${item.weightGrams}g` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`text-[9px] ${item.confidence >= CONFIDENCE_THRESHOLD ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {(item.confidence * 100).toFixed(0)}%
                        </Badge>
                        <button
                          onClick={() => startEditItem(idx)}
                          className="w-6 h-6 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                          title={t("Edit quantity", "मात्रा बदलें")}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="space-y-3">
        {pantryItems.length > 0 && (
          <Button
            size="lg"
            className="w-full gap-2"
            onClick={handleConfirm}
            disabled={checkedCount === 0 || isGenerating || isScanning}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t("Generating meal plan…", "भोजन योजना बन रही है…")}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                {t(
                  `Use ${checkedCount} Ingredient${checkedCount === 1 ? "" : "s"} → Generate Meal Plan`,
                  `${checkedCount} सामग्री उपयोग करें → भोजन योजना बनाएं`
                )}
                <ArrowRight className="w-4 h-4 ml-auto" />
              </>
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground gap-1.5"
          onClick={() => setLocation("/meal-plan")}
        >
          <SkipForward className="w-4 h-4" />
          {t("Skip — go to meal plan", "छोड़ें — भोजन योजना पर जाएं")}
        </Button>
      </div>
    </motion.div>
  );
}
