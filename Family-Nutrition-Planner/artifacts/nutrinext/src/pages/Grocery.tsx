import { apiFetch } from "@/lib/api-fetch";
import { useState, useEffect, useRef } from "react";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/contexts/language-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, TrendingDown, CheckCircle2, Circle, Sparkles, Leaf, IndianRupee, ArrowLeftRight, Package, Plus, X, ChefHat, Share2, Languages, ChevronDown, ChevronUp, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const PANTRY_STAPLES = [
  "Rice / चावल", "Atta / आटा", "Dal / दाल", "Mustard Oil / सरसों तेल",
  "Onion / प्याज", "Tomato / टमाटर", "Garlic / लहसुन", "Ginger / अदरक",
  "Turmeric / हल्दी", "Cumin / जीरा", "Coriander / धनिया", "Chilli / मिर्च",
  "Salt / नमक", "Sugar / चीनी", "Milk / दूध", "Ghee / घी",
  "Potato / आलू", "Sooji / सूजी", "Poha / पोहा", "Tea / चाय",
];

interface GroceryItem {
  category: string;
  name: string;
  nameHindi?: string;
  quantity: string;
  estimatedCost: number;
  cheaperAlternative?: string;
  alternativeCost?: number;
  priority: "essential" | "optional";
  healthRationale?: string;
}

type SavedSwap = { name: string; cost: number; source: "db" | "ai" };

interface GroceryList {
  id: number;
  weekOf: string;
  items: {
    items: GroceryItem[];
    totalEstimatedCost: number;
    budgetStatus: string;
    savingsTips: string[];
    seasonalSuggestions: string[];
  };
  totalEstimatedCost: number;
  budgetStatus: string;
  acceptedSwaps?: Record<string, SavedSwap>;
}

const CATEGORY_COLORS: Record<string, string> = {
  Vegetables: "bg-green-500/20 text-green-700 border-green-500/30",
  Fruits: "bg-orange-500/20 text-orange-700 border-orange-500/30",
  Grains: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  Pulses: "bg-amber-500/20 text-amber-700 border-amber-500/30",
  Dairy: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  Spices: "bg-red-500/20 text-red-700 border-red-500/30",
  Oil: "bg-purple-500/20 text-purple-700 border-purple-500/30",
  Other: "bg-gray-500/20 text-gray-700 border-gray-500/30",
};

export default function Grocery() {
  const { activeFamily } = useAppState();
  const { lang, toggleLang, t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"list" | "pantry">("list");
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [pantryAlreadyHaveExpanded, setPantryAlreadyHaveExpanded] = useState(false);
  const [swappedItems, setSwappedItems] = useState<Record<string, { name: string; estimatedCost?: number }>>({});
  const [dbSwaps, setDbSwaps] = useState<Record<string, SavedSwap | null>>({});
  const [swapLoading, setSwapLoading] = useState<Record<string, boolean>>({});

  // Pantry state — persisted in localStorage per family
  const pantryKey = activeFamily ? `pantry_${activeFamily.id}` : null;
  const [pantryItems, setPantryItems] = useState<string[]>(() => {
    if (!activeFamily) return [];
    try { return JSON.parse(localStorage.getItem(`pantry_${activeFamily.id}`) ?? "[]") as string[]; }
    catch { return []; }
  });
  const [pantryInput, setPantryInput] = useState("");
  const pantryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pantryKey) return;
    localStorage.setItem(pantryKey, JSON.stringify(pantryItems));
  }, [pantryItems, pantryKey]);

  // Reload pantry when activeFamily changes
  useEffect(() => {
    if (!activeFamily) { setPantryItems([]); return; }
    try { setPantryItems(JSON.parse(localStorage.getItem(`pantry_${activeFamily.id}`) ?? "[]") as string[]); }
    catch { setPantryItems([]); }
  }, [activeFamily?.id]);

  const addPantryItem = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const normalised = trimmed.toLowerCase();
    if (pantryItems.some(p => p.toLowerCase() === normalised)) return;
    setPantryItems(prev => [...prev, trimmed]);
    setPantryInput("");
    pantryInputRef.current?.focus();
  };

  const removePantryItem = (item: string) => {
    setPantryItems(prev => prev.filter(p => p !== item));
  };

  const handleCheaperSwap = async (listId: number, itemIdx: number, item: GroceryItem) => {
    const key = `${listId}-${itemIdx}`;
    const isSwapped = !!swappedItems[key];
    if (isSwapped) {
      setSwappedItems(prev => { const next = { ...prev }; delete next[key]; return next; });
      toast({ title: "Reverted to original", description: item.name });
      // Persist revert to DB (fire-and-forget)
      apiFetch(`/api/grocery-lists/${listId}/swaps`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName: item.name, swappedWith: null }),
      }).catch(() => {/* non-critical */});
      return;
    }
    setSwapLoading(prev => ({ ...prev, [key]: true }));
    try {
      const budget = item.estimatedCost ? Math.round(item.estimatedCost * 0.8) : 50;
      const res = await apiFetch(`/api/grocery/cheaper-alternative?item=${encodeURIComponent(item.name)}&budget=${budget}`);
      const data = await res.json() as { alternatives?: Array<{ name: string; costPerServing?: number }>; item?: string };
      const dbAlt = data.alternatives?.[0];
      const swapDisplay = dbAlt
        ? { name: dbAlt.name, cost: dbAlt.costPerServing ?? Math.round(budget * 0.75), source: "db" as const }
        : item.cheaperAlternative
          ? { name: item.cheaperAlternative, cost: item.alternativeCost ?? Math.round(budget * 0.8), source: "ai" as const }
          : null;
      if (swapDisplay) {
        setDbSwaps(prev => ({ ...prev, [key]: swapDisplay }));
        setSwappedItems(prev => ({ ...prev, [key]: { name: item.name, estimatedCost: item.estimatedCost } }));
        toast({
          title: `Swapped to cheaper option! ${swapDisplay.source === "db" ? "(DB verified)" : "(AI suggested)"}`,
          description: `${swapDisplay.name} — ₹${swapDisplay.cost}`,
        });
        // Persist accepted swap to DB (fire-and-forget)
        apiFetch(`/api/grocery-lists/${listId}/swaps`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemName: item.name, swappedWith: swapDisplay.name, cost: swapDisplay.cost, source: swapDisplay.source }),
        }).catch(() => {/* non-critical */});
      } else {
        toast({ title: "No cheaper alternative found", description: `${item.name} is already budget-optimal` });
      }
    } catch {
      if (item.cheaperAlternative) {
        setDbSwaps(prev => ({ ...prev, [key]: { name: item.cheaperAlternative!, cost: item.alternativeCost ?? 0, source: "ai" } }));
        setSwappedItems(prev => ({ ...prev, [key]: { name: item.name, estimatedCost: item.estimatedCost } }));
        toast({ title: "Swapped to AI alternative", description: item.cheaperAlternative! });
      }
    } finally {
      setSwapLoading(prev => { const next = { ...prev }; delete next[key]; return next; });
    }
  };

  const { data: lists, isLoading } = useQuery({
    queryKey: ["grocery-lists", activeFamily?.id],
    queryFn: async () => {
      if (!activeFamily?.id) return [];
      const res = await apiFetch(`/api/grocery-lists?familyId=${activeFamily.id}`);
      return res.json() as Promise<GroceryList[]>;
    },
    enabled: !!activeFamily?.id,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { familyId: activeFamily?.id };
      if (pantryItems.length > 0) {
        body.pantryIngredients = pantryItems;
        body.updateMode = "subtract";
      }
      const res = await apiFetch("/api/grocery-lists/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Generation failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grocery-lists", activeFamily?.id] });
      const pantryNote = pantryItems.length > 0 ? ` (${pantryItems.length} pantry items excluded)` : "";
      toast({ title: t("Grocery list generated!", "खरीदारी सूची तैयार!"), description: t(`AI found the best deals for your family.${pantryNote}`, `AI ने आपके परिवार के लिए सबसे अच्छे विकल्प खोजे।${pantryNote}`) });
      setActiveTab("list");
    },
    onError: () => {
      toast({ title: t("Error", "त्रुटि"), description: t("Failed to generate grocery list.", "खरीदारी सूची बनाने में विफल।"), variant: "destructive" });
    },
  });

  const latest = lists?.[lists.length - 1];
  const items: GroceryItem[] = latest?.items?.items || [];
  const grouped = items.reduce<Record<string, GroceryItem[]>>((acc, item) => {
    const cat = item.category || "Other";
    acc[cat] = acc[cat] || [];
    acc[cat].push(item);
    return acc;
  }, {});

  // 7a: Restore accepted swaps from DB when grocery list loads
  useEffect(() => {
    if (!latest?.acceptedSwaps || !items.length) return;
    const savedSwaps = latest.acceptedSwaps;
    if (Object.keys(savedSwaps).length === 0) return;
    const newDbSwaps: Record<string, SavedSwap | null> = {};
    const newSwapped: Record<string, { name: string; estimatedCost?: number }> = {};
    Object.entries(grouped).forEach(([, catItems]) => {
      catItems.forEach((item, i) => {
        const saved = savedSwaps[item.name];
        if (saved) {
          const swapKey = `${latest.id}-${i}`;
          newDbSwaps[swapKey] = saved;
          newSwapped[swapKey] = { name: item.name, estimatedCost: item.estimatedCost };
        }
      });
    });
    if (Object.keys(newDbSwaps).length > 0) {
      setDbSwaps(newDbSwaps);
      setSwappedItems(newSwapped);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id]);

  const toggleItem = (key: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleShareList = async () => {
    if (!latest) return;
    const byCategory = Object.entries(
      items.reduce<Record<string, GroceryItem[]>>((acc, item) => {
        const cat = item.category || "Other";
        acc[cat] = acc[cat] || [];
        acc[cat].push(item);
        return acc;
      }, {})
    );
    const text = [
      `🛒 ${t("Grocery List", "खरीदारी सूची")} — ${activeFamily?.name ?? ""}`,
      `📅 ${latest.weekOf}  |  💰 ₹${latest.totalEstimatedCost}`,
      "",
      ...byCategory.flatMap(([cat, catItems]) => [
        `**${cat}**`,
        ...catItems.map(item => {
          const name = lang === "hi" && item.nameHindi ? item.nameHindi : item.name;
          return `• ${name} ${item.quantity} ₹${item.estimatedCost}`;
        }),
      ]),
      "",
      `Generated by ParivarSehat AI`,
    ].join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: t("Grocery List", "खरीदारी सूची"), text });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handlePrintList = () => {
    window.print();
  };

  const checkedCount = checkedItems.size;
  const totalItems = items.length;

  if (!activeFamily) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="glass-card rounded-3xl p-8 text-center max-w-sm">
          <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display font-bold text-xl mb-2">{t("No Family Selected", "परिवार नहीं चुना गया")}</h2>
          <p className="text-muted-foreground text-sm">{t("Please set up your family first.", "पहले अपना परिवार सेट करें।")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground">
            {t("Grocery & Pantry", "खरीदारी व पेंट्री")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("AI-curated shopping with budget-smart swaps", "AI द्वारा बजट-स्मार्ट विकल्पों के साथ खरीदारी")}
          </p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="shrink-0 gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {generateMutation.isPending
            ? t("Generating…", "तैयार हो रहा है…")
            : pantryItems.length > 0
              ? t(`Generate List (${pantryItems.length} in pantry)`, `सूची बनाएं (${pantryItems.length} पेंट्री में)`)
              : t("Generate List", "सूची बनाएं")}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit print:hidden">
        <button
          onClick={() => setActiveTab("list")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "list"
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          {t("Grocery List", "खरीदारी")}
        </button>
        <button
          onClick={() => setActiveTab("pantry")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "pantry"
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="w-4 h-4" />
          {t("My Pantry", "मेरी पेंट्री")}
          {pantryItems.length > 0 && (
            <span className="ml-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {pantryItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Pantry Tab */}
      {activeTab === "pantry" && (
        <div className="space-y-6">
          {/* Info banner */}
          <div className="glass-card rounded-2xl p-4 border border-primary/20 bg-primary/5 flex items-start gap-3">
            <ChefHat className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">{t("Save money by logging what you already have", "जो सामान पहले से है उसे दर्ज करें")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("When you generate a grocery list, pantry items will be automatically excluded.", "खरीदारी सूची बनाते समय पेंट्री की चीजें अपने आप हटा दी जाएंगी।")}</p>
            </div>
          </div>

          {/* Add item input */}
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">{t("Add Item to Pantry", "पेंट्री में जोड़ें")}</h3>
            <div className="flex gap-2">
              <Input
                ref={pantryInputRef}
                value={pantryInput}
                onChange={e => setPantryInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPantryItem(pantryInput); } }}
                placeholder={t("e.g. Rice, Onions, Dal…", "जैसे चावल, प्याज, दाल…")}
                className="flex-1"
              />
              <Button onClick={() => addPantryItem(pantryInput)} disabled={!pantryInput.trim()} className="gap-1">
                <Plus className="w-4 h-4" />
                {t("Add", "जोड़ें")}
              </Button>
            </div>

            {/* Quick-add staples */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t("Quick add common staples:", "सामान्य चीजें जल्दी जोड़ें:")}</p>
              <div className="flex flex-wrap gap-2">
                {PANTRY_STAPLES.map(staple => {
                  const alreadyAdded = pantryItems.some(p => p.toLowerCase() === staple.toLowerCase());
                  return (
                    <button
                      key={staple}
                      onClick={() => addPantryItem(staple)}
                      disabled={alreadyAdded}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        alreadyAdded
                          ? "bg-primary/10 text-primary border-primary/30 cursor-default"
                          : "bg-muted text-muted-foreground border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                      }`}
                    >
                      {alreadyAdded ? "✓ " : ""}{staple}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Pantry items list */}
          {pantryItems.length > 0 ? (
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{t(`${pantryItems.length} item${pantryItems.length === 1 ? "" : "s"} in pantry`, `पेंट्री में ${pantryItems.length} चीजें`)}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive"
                  onClick={() => { setPantryItems([]); toast({ title: t("Pantry cleared", "पेंट्री खाली हो गई") }); }}
                >
                  {t("Clear All", "सब हटाएं")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {pantryItems.map(item => (
                  <div key={item} className="flex items-center gap-1.5 bg-green-500/10 text-green-800 border border-green-500/20 rounded-full px-3 py-1 text-sm">
                    <span>{item}</span>
                    <button onClick={() => removePantryItem(item)} className="text-green-600 hover:text-green-900 ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-6 text-center space-y-2">
              <Package className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">{t("Your pantry is empty. Add items above.", "पेंट्री खाली है। ऊपर से जोड़ें।")}</p>
            </div>
          )}

          {pantryItems.length > 0 && (
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="w-full gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {generateMutation.isPending
                ? t("Generating…", "तैयार हो रहा है…")
                : t(`Generate List Excluding ${pantryItems.length} Pantry Item${pantryItems.length === 1 ? "" : "s"}`, `${pantryItems.length} पेंट्री चीजें हटाकर सूची बनाएं`)}
            </Button>
          )}
        </div>
      )}

      {/* Grocery List Tab */}
      {activeTab === "list" && isLoading && (
        <div className="glass-card rounded-3xl p-8 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}

      {activeTab === "list" && !isLoading && !latest && (
        <div className="glass-card rounded-3xl p-8 text-center space-y-4">
          <ShoppingCart className="w-16 h-16 text-muted-foreground/50 mx-auto" />
          <h2 className="font-display font-bold text-xl">{t("No Grocery List Yet", "अभी तक कोई सूची नहीं")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("Generate a grocery list based on your meal plan with AI-powered budget tips.", "AI द्वारा बजट टिप्स के साथ अपनी मील योजना के आधार पर खरीदारी सूची बनाएं।")}
          </p>
          {pantryItems.length > 0 && (
            <p className="text-xs text-primary font-medium">
              {t(`${pantryItems.length} pantry items will be excluded automatically.`, `${pantryItems.length} पेंट्री चीजें अपने आप हटाई जाएंगी।`)}
            </p>
          )}
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="gap-2">
            <Sparkles className="w-4 h-4" />
            {t("Create My First List", "पहली सूची बनाएं")}
          </Button>
        </div>
      )}

      {activeTab === "list" && latest && (
        <>
          {/* Action row: language toggle + share + print */}
          <div className="flex items-center justify-end gap-2 print:hidden">
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground glass-card px-3 py-1.5 rounded-xl hover:bg-white/80 hover:text-foreground transition-colors"
              title={t("Toggle language", "भाषा बदलें")}
            >
              <Languages className="w-3.5 h-3.5" />
              {lang === "en" ? "हिंदी" : "English"}
            </button>
            <button
              onClick={handleShareList}
              className="flex items-center gap-1.5 text-xs font-medium text-green-600 glass-card px-3 py-1.5 rounded-xl hover:bg-white/80 transition-colors"
              title={t("Share on WhatsApp", "WhatsApp पर शेयर करें")}
            >
              <Share2 className="w-3.5 h-3.5" />
              {t("Share on WhatsApp", "WhatsApp पर शेयर")}
            </button>
            <button
              onClick={handlePrintList}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground glass-card px-3 py-1.5 rounded-xl hover:bg-white/80 hover:text-foreground transition-colors"
              title={t("Download as PDF", "PDF डाउनलोड करें")}
            >
              <Printer className="w-3.5 h-3.5" />
              {t("Download", "डाउनलोड")}
            </button>
          </div>

          {/* Printable area starts here */}
          <div className="grocery-print-area space-y-6">
          {/* Budget Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass-card rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{t("Est. Total", "अनुमानित कुल")}</p>
              <p className="font-display font-bold text-xl text-foreground">
                ₹{latest.totalEstimatedCost || latest.items?.totalEstimatedCost || 0}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{t("Budget Status", "बजट स्थिति")}</p>
              <Badge className={latest.budgetStatus === "over" ? "bg-red-500/20 text-red-700" : "bg-green-500/20 text-green-700"}>
                {latest.budgetStatus === "within" ? t("Within Budget ✓", "बजट में ✓") : latest.budgetStatus === "under" ? t("Under Budget!", "बजट से कम!") : t("Over Budget", "बजट से अधिक")}
              </Badge>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{t("Checked Off", "खरीदा गया")}</p>
              <p className="font-display font-bold text-xl text-foreground">{checkedCount}/{totalItems}</p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{t("Week Of", "सप्ताह")}</p>
              <p className="font-semibold text-sm text-foreground">{latest.weekOf}</p>
            </div>
          </div>

          {/* Savings Tips */}
          {(latest.items?.savingsTips || []).length > 0 && (
            <div className="glass-card rounded-2xl p-4 border border-green-500/20">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold text-sm text-foreground">{t("Money-Saving Tips", "पैसे बचाने के टिप्स")}</h3>
              </div>
              <ul className="space-y-1">
                {(latest.items?.savingsTips || []).map((tip: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Grouped Items */}
          {Object.entries(grouped).map(([category, catItems]) => (
            <div key={category} className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">{t(category, category)}</h3>
                <Badge variant="secondary" className="text-xs">{catItems.length}</Badge>
              </div>
              <div className="space-y-2">
                {catItems.map((item, i) => {
                  const checkKey = `${category}-${i}`;
                  const swapKey = `${latest.id}-${i}`;
                  const isChecked = checkedItems.has(checkKey);
                  const isSwapped = !!swappedItems[swapKey];
                  const dbSwap = dbSwaps[swapKey];
                  const isSwapLoading = !!swapLoading[swapKey];
                  const displayName = isSwapped && dbSwap ? dbSwap.name : (lang === "hi" && item.nameHindi ? item.nameHindi : item.name);
                  const displayCost = isSwapped && dbSwap ? dbSwap.cost : item.estimatedCost;
                  return (
                    <div key={checkKey} className={`flex items-start gap-3 p-3 rounded-xl transition-all ${isChecked ? "opacity-50" : ""}`}>
                      <button onClick={() => toggleItem(checkKey)} className="mt-0.5 shrink-0">
                        {isChecked
                          ? <CheckCircle2 className="w-5 h-5 text-primary" />
                          : <Circle className="w-5 h-5 text-muted-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium text-sm ${isChecked ? "line-through" : ""} ${isSwapped ? "text-green-700" : ""}`}>
                            {displayName}
                          </span>
                          <span className="text-xs text-muted-foreground">{item.quantity}</span>
                          {item.priority === "essential" && (
                            <Badge className="text-[10px] py-0 px-1.5 h-4 bg-primary/20 text-primary border-primary/30">
                              {t("Essential", "जरूरी")}
                            </Badge>
                          )}
                          {isSwapped && (
                            <Badge className="text-[10px] py-0 px-1.5 h-4 bg-green-500/20 text-green-700 border-green-500/30">
                              {dbSwap?.source === "db" ? t("DB Verified", "DB सत्यापित") : t("Swapped", "बदला")}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-xs font-semibold text-foreground/80">
                            <IndianRupee className="w-3 h-3" />{displayCost}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isSwapLoading}
                            onClick={() => handleCheaperSwap(latest.id, i, item)}
                            className="h-5 px-2 text-[10px] gap-1 text-green-600 hover:text-green-800 hover:bg-green-50 disabled:opacity-50"
                          >
                            <ArrowLeftRight className={`w-2.5 h-2.5 ${isSwapLoading ? "animate-spin" : ""}`} />
                            {isSwapLoading
                              ? t("Finding...", "ढूंढ रहे हैं...")
                              : isSwapped
                                ? t("Use Original", "मूल लें")
                                : t("Find Cheaper", "सस्ता खोजें")}
                          </Button>
                        </div>
                        {item.healthRationale && (
                          <p className="text-[10px] text-primary/70 mt-1 leading-snug italic">
                            {item.healthRationale}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Already in Your Kitchen — bottom of list */}
          {pantryItems.length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden border border-muted">
              <button
                onClick={() => setPantryAlreadyHaveExpanded(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-muted-foreground">
                    {t("Items Already in Your Kitchen", "आपकी रसोई में पहले से मौजूद चीजें")}
                  </span>
                  <Badge variant="secondary" className="text-xs">{pantryItems.length}</Badge>
                </div>
                {pantryAlreadyHaveExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              {pantryAlreadyHaveExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {t("These items are already in your pantry and were excluded from the list above.", "ये चीजें आपकी पेंट्री में हैं और ऊपर की सूची से हटाई गई हैं।")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pantryItems.map(item => (
                      <span
                        key={item}
                        className="flex items-center gap-1.5 text-xs bg-muted text-muted-foreground border border-border rounded-full px-3 py-1"
                      >
                        <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>{/* end grocery-print-area */}
        </>
      )}
    </div>
  );
}
