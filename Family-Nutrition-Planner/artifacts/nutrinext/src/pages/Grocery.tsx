import { apiFetch } from "@/lib/api-fetch";
import { useState } from "react";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/contexts/language-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, TrendingDown, CheckCircle2, Circle, Sparkles, Leaf, IndianRupee, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface GroceryItem {
  category: string;
  name: string;
  nameHindi?: string;
  quantity: string;
  estimatedCost: number;
  cheaperAlternative?: string;
  alternativeCost?: number;
  priority: "essential" | "optional";
}

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
  const { lang, t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [swappedItems, setSwappedItems] = useState<Record<string, { name: string; estimatedCost?: number }>>({});
  const [dbSwaps, setDbSwaps] = useState<Record<string, { name: string; cost: number; source: "db" | "ai" } | null>>({});
  const [swapLoading, setSwapLoading] = useState<Record<string, boolean>>({});

  const handleCheaperSwap = async (listId: number, itemIdx: number, item: GroceryItem) => {
    const key = `${listId}-${itemIdx}`;
    const isSwapped = !!swappedItems[key];
    if (isSwapped) {
      setSwappedItems(prev => { const next = { ...prev }; delete next[key]; return next; });
      toast({ title: "Reverted to original", description: item.name });
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
      const res = await apiFetch("/api/grocery-lists/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId: activeFamily?.id }),
      });
      if (!res.ok) throw new Error("Generation failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grocery-lists", activeFamily?.id] });
      toast({ title: t("Grocery list generated!", "खरीदारी सूची तैयार!"), description: t("AI found the best deals for your family.", "AI ने आपके परिवार के लिए सबसे अच्छे विकल्प खोजे।") });
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

  const toggleItem = (key: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground">
            {t("Grocery List", "खरीदारी सूची")}
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
          {generateMutation.isPending ? t("Generating…", "तैयार हो रहा है…") : t("Generate List", "सूची बनाएं")}
        </Button>
      </div>

      {isLoading && (
        <div className="glass-card rounded-3xl p-8 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}

      {!isLoading && !latest && (
        <div className="glass-card rounded-3xl p-8 text-center space-y-4">
          <ShoppingCart className="w-16 h-16 text-muted-foreground/50 mx-auto" />
          <h2 className="font-display font-bold text-xl">{t("No Grocery List Yet", "अभी तक कोई सूची नहीं")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("Generate a grocery list based on your meal plan with AI-powered budget tips.", "AI द्वारा बजट टिप्स के साथ अपनी मील योजना के आधार पर खरीदारी सूची बनाएं।")}
          </p>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="gap-2">
            <Sparkles className="w-4 h-4" />
            {t("Create My First List", "पहली सूची बनाएं")}
          </Button>
        </div>
      )}

      {latest && (
        <>
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
