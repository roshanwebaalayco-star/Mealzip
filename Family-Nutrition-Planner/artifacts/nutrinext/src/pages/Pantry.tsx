import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGenerateMealPlan, getListMealPlansQueryKey } from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ChevronDown, ChevronUp, Camera, X } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface PantryIngredient {
  id: string;
  emoji: string;
  en: string;
  hi: string;
}

interface PantryGroup {
  label: string;
  labelHi: string;
  color: string;
  items: PantryIngredient[];
}

const PANTRY_GROUPS: PantryGroup[] = [
  {
    label: "Grains",
    labelHi: "अनाज",
    color: "bg-yellow-500/10 border-yellow-500/30 text-yellow-800",
    items: [
      { id: "rice", emoji: "🌾", en: "Rice", hi: "चावल" },
      { id: "wheat", emoji: "🌾", en: "Wheat", hi: "गेहूं" },
      { id: "atta", emoji: "🥖", en: "Atta", hi: "आटा" },
      { id: "sooji", emoji: "🥣", en: "Sooji", hi: "सूजी" },
      { id: "poha", emoji: "🍚", en: "Poha", hi: "पोहा" },
      { id: "bajra", emoji: "🌾", en: "Bajra", hi: "बाजरा" },
      { id: "maize", emoji: "🌽", en: "Maize", hi: "मक्का" },
    ],
  },
  {
    label: "Pulses",
    labelHi: "दालें",
    color: "bg-amber-500/10 border-amber-500/30 text-amber-800",
    items: [
      { id: "chana-dal", emoji: "🫘", en: "Chana Dal", hi: "चना दाल" },
      { id: "toor-dal", emoji: "🫘", en: "Toor Dal", hi: "तूर दाल" },
      { id: "moong-dal", emoji: "🟡", en: "Moong Dal", hi: "मूंग दाल" },
      { id: "masoor-dal", emoji: "🔴", en: "Masoor Dal", hi: "मसूर दाल" },
      { id: "urad-dal", emoji: "⚪", en: "Urad Dal", hi: "उड़द दाल" },
      { id: "rajma", emoji: "🫘", en: "Rajma", hi: "राजमा" },
      { id: "chole", emoji: "🫘", en: "Chole", hi: "छोले" },
    ],
  },
  {
    label: "Vegetables",
    labelHi: "सब्जियां",
    color: "bg-green-500/10 border-green-500/30 text-green-800",
    items: [
      { id: "potato", emoji: "🥔", en: "Potato", hi: "आलू" },
      { id: "onion", emoji: "🧅", en: "Onion", hi: "प्याज" },
      { id: "tomato", emoji: "🍅", en: "Tomato", hi: "टमाटर" },
      { id: "spinach", emoji: "🥬", en: "Spinach", hi: "पालक" },
      { id: "cauliflower", emoji: "🥦", en: "Cauliflower", hi: "गोभी" },
      { id: "peas", emoji: "🫛", en: "Peas", hi: "मटर" },
      { id: "carrot", emoji: "🥕", en: "Carrot", hi: "गाजर" },
      { id: "brinjal", emoji: "🍆", en: "Brinjal", hi: "बैंगन" },
    ],
  },
  {
    label: "Protein",
    labelHi: "प्रोटीन",
    color: "bg-orange-500/10 border-orange-500/30 text-orange-800",
    items: [
      { id: "egg", emoji: "🥚", en: "Egg", hi: "अंडा" },
      { id: "chicken", emoji: "🍗", en: "Chicken", hi: "चिकन" },
      { id: "paneer", emoji: "🧀", en: "Paneer", hi: "पनीर" },
      { id: "fish", emoji: "🐟", en: "Fish", hi: "मछली" },
      { id: "soya", emoji: "🟤", en: "Soya Chunks", hi: "सोया" },
    ],
  },
  {
    label: "Dairy",
    labelHi: "डेयरी",
    color: "bg-blue-500/10 border-blue-500/30 text-blue-800",
    items: [
      { id: "milk", emoji: "🥛", en: "Milk", hi: "दूध" },
      { id: "curd", emoji: "🥛", en: "Curd", hi: "दही" },
      { id: "ghee", emoji: "🫙", en: "Ghee", hi: "घी" },
      { id: "butter", emoji: "🧈", en: "Butter", hi: "मक्खन" },
      { id: "cheese", emoji: "🧀", en: "Cheese", hi: "चीज़" },
      { id: "buttermilk", emoji: "🥛", en: "Buttermilk", hi: "छाछ" },
    ],
  },
  {
    label: "Other",
    labelHi: "अन्य",
    color: "bg-gray-500/10 border-gray-500/30 text-gray-800",
    items: [
      { id: "mustard-oil", emoji: "🫙", en: "Mustard Oil", hi: "सरसों तेल" },
      { id: "turmeric", emoji: "🟡", en: "Turmeric", hi: "हल्दी" },
      { id: "cumin", emoji: "🌰", en: "Cumin", hi: "जीरा" },
      { id: "coriander", emoji: "🌿", en: "Coriander", hi: "धनिया" },
      { id: "chilli", emoji: "🌶️", en: "Chilli", hi: "मिर्च" },
      { id: "salt", emoji: "🧂", en: "Salt", hi: "नमक" },
      { id: "sugar", emoji: "🍬", en: "Sugar", hi: "चीनी" },
    ],
  },
];

const FESTIVAL_OPTIONS = [
  { value: "navratri", label: "Navratri / नवरात्रि", isFasting: true },
  { value: "ramadan", label: "Ramadan / रमज़ान", isFasting: true },
  { value: "ekadashi", label: "Ekadashi / एकादशी", isFasting: true },
  { value: "janmashtami", label: "Janmashtami / जन्माष्टमी", isFasting: true },
  { value: "other", label: "Other / अन्य", isFasting: false },
];

const ALL_ITEMS = PANTRY_GROUPS.flatMap(g => g.items);

function idToLabel(id: string): string {
  const item = ALL_ITEMS.find(i => i.id === id);
  return item ? `${item.en} / ${item.hi}` : id;
}

function labelToId(label: string): string | undefined {
  return ALL_ITEMS.find(i => `${i.en} / ${i.hi}` === label || i.en === label)?.id;
}

function loadStoredIds(familyId: number): Set<string> {
  try {
    const stored: string[] = JSON.parse(localStorage.getItem(`pantry_${familyId}`) ?? "[]");
    return new Set(
      stored.map(entry => {
        // Try to match to a known pantry item id
        const byLabel = labelToId(entry);
        return byLabel ?? entry; // Keep as raw label (e.g. from pantry scan) if no match
      })
    );
  } catch {
    return new Set();
  }
}

function saveSelectedIds(familyId: number, selectedIds: Set<string>): void {
  const labels = Array.from(selectedIds).map(id => {
    // Known catalog items: convert id → "English / Hindi" label
    const known = ALL_ITEMS.find(i => i.id === id);
    return known ? `${known.en} / ${known.hi}` : id; // Preserve raw scan labels as-is
  });
  localStorage.setItem(`pantry_${familyId}`, JSON.stringify(labels));
}

export default function Pantry() {
  const { activeFamily } = useAppState();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const generate = useGenerateMealPlan();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (!activeFamily) return new Set();
    return loadStoredIds(activeFamily.id);
  });

  const [festivalToggle, setFestivalToggle] = useState(false);
  const [festival, setFestival] = useState("navratri");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(PANTRY_GROUPS.map(g => g.label))
  );

  useEffect(() => {
    if (!activeFamily) { setSelectedIds(new Set()); return; }
    setSelectedIds(loadStoredIds(activeFamily.id));
  }, [activeFamily?.id]);

  useEffect(() => {
    if (!activeFamily) return;
    saveSelectedIds(activeFamily.id, selectedIds);
  }, [selectedIds, activeFamily?.id]);

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const selectedLabels = Array.from(selectedIds).map(idToLabel);
  const selectedFestivalOption = FESTIVAL_OPTIONS.find(f => f.value === festival);

  const handleGenerate = async () => {
    if (!activeFamily) {
      toast({ title: "No family selected", description: "Please complete family setup first.", variant: "destructive" });
      return;
    }
    const isFasting = festivalToggle ? (selectedFestivalOption?.isFasting ?? false) : undefined;
    const festivalType = festivalToggle ? selectedFestivalOption?.label.split(" / ")[0] : undefined;

    try {
      await generate.mutateAsync({
        data: {
          familyId: activeFamily.id,
          weekStartDate: new Date().toISOString(),
          preferences: {
            ...(isFasting !== undefined ? { isFasting } : {}),
            ...(festivalType ? { festivalType } : {}),
            ...(selectedLabels.length > 0 ? { pantryIngredients: selectedLabels } : {}),
          },
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListMealPlansQueryKey() });
      toast({
        title: "Meal plan ready!",
        description: `Generated for ${activeFamily.name}${festivalToggle ? ` (${selectedFestivalOption?.label.split(" / ")[0]})` : ""}${selectedLabels.length > 0 ? ` using ${selectedLabels.length} pantry items` : ""}.`,
      });
      setLocation("/meal-plan");
    } catch {
      toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" });
    }
  };

  const totalSelected = selectedIds.size;

  // Items imported from pantry scan that are not known pantry catalog ids
  const scannedImports = Array.from(selectedIds).filter(id => !ALL_ITEMS.some(i => i.id === id));

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-medium text-foreground">
          My Pantry / मेरी पेंट्री
        </h1>
        <p className="text-muted-foreground text-sm">
          Check off ingredients you already have at home. We'll build your meal plan around them.
        </p>
        {totalSelected > 0 && (
          <Badge className="bg-primary/10 text-primary border-primary/30 text-xs">
            {totalSelected} item{totalSelected === 1 ? "" : "s"} selected
          </Badge>
        )}
      </div>

      {/* Ingredient groups */}
      <div className="space-y-3">
        {PANTRY_GROUPS.map(group => {
          const groupSelected = group.items.filter(i => selectedIds.has(i.id)).length;
          const isExpanded = expandedGroups.has(group.label);
          return (
            <div key={group.label} className="glass-card rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {group.label} / {group.labelHi}
                  </span>
                  {groupSelected > 0 && (
                    <Badge className={`text-xs py-0 px-2 h-5 border ${group.color}`}>
                      {groupSelected}/{group.items.length}
                    </Badge>
                  )}
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {group.items.map(item => {
                    const checked = selectedIds.has(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                          checked
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border bg-muted/30 hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        <span className="text-2xl">{item.emoji}</span>
                        <span className={`text-xs font-medium leading-tight ${checked ? "text-primary" : "text-foreground"}`}>
                          {item.en}
                        </span>
                        <span className="text-xs text-muted-foreground">{item.hi}</span>
                        {checked && (
                          <span className="text-primary text-xs font-bold">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scan-imported items from PantryScan */}
      {scannedImports.length > 0 && (
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Pantry Scan Imports / स्कैन आइटम</span>
            <Badge className="text-xs bg-primary/10 text-primary border-primary/30 py-0">{scannedImports.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Items detected from your pantry photo — included in meal planning.</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {scannedImports.map(label => (
              <div key={label} className="flex items-center gap-1 bg-primary/5 border border-primary/20 rounded-full px-2.5 py-1">
                <span className="text-xs text-primary font-medium">{label}</span>
                <button
                  onClick={() => setSelectedIds(prev => { const next = new Set(prev); next.delete(label); return next; })}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Festival / Fast toggle */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-semibold text-sm">Today's Festival / Fast?</Label>
            <p className="text-xs text-muted-foreground mt-0.5">आज कोई त्योहार या व्रत है?</p>
          </div>
          <Switch
            checked={festivalToggle}
            onCheckedChange={setFestivalToggle}
          />
        </div>
        {festivalToggle && (
          <Select value={festival} onValueChange={setFestival}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FESTIVAL_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {festivalToggle && selectedFestivalOption?.isFasting && (
          <p className="text-xs text-primary font-medium">
            🙏 Fasting-mode meal plan will be generated (sabudana, kuttu, fruits, etc.)
          </p>
        )}
      </div>

      {/* Selected pantry summary */}
      {totalSelected > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-2">
            Items already in your kitchen ({totalSelected}):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(selectedIds).map(id => {
              const item = ALL_ITEMS.find(i => i.id === id);
              if (!item) return null;
              return (
                <span
                  key={id}
                  className="text-xs bg-green-500/10 text-green-800 border border-green-500/20 rounded-full px-2.5 py-0.5"
                >
                  {item.emoji} {item.en}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Generate button */}
      <Button
        size="lg"
        className="w-full text-base gap-2 btn-liquid"
        onClick={handleGenerate}
        disabled={generate.isPending}
      >
        {generate.isPending ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Generating your family's plan…
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Generate My Family's Plan →
          </>
        )}
      </Button>
      {totalSelected > 0 && !generate.isPending && (
        <p className="text-center text-xs text-muted-foreground -mt-3">
          {totalSelected} pantry item{totalSelected === 1 ? "" : "s"} will be used when planning your meals
        </p>
      )}
    </div>
  );
}
