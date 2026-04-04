import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

interface MemberModification {
  member_name: string;
  modification_text: string;
  urgency: "CRITICAL" | "RECOMMENDED" | "INFO";
}

interface EnrichedStep {
  step_number: number;
  instruction: string;
  member_modifications: MemberModification[];
}

interface MemberPlate {
  member_name: string;
  modifications: string[];
  fasting_replacement?: string | null;
  tiffin_instructions?: string | null;
}

interface RecipeSlideData {
  slot: "breakfast" | "lunch" | "dinner";
  name: string;
  image_url: string | null;
  image_query: string;
  estimated_cost_inr: number;
  prep_time_mins: number;
  cook_time_mins: number;
  priority_flags: string[];
  pantry_items_used: string[];
  ingredients: { name: string; quantity: string }[];
  enriched_steps: EnrichedStep[];
  member_plates: MemberPlate[];
  recipe_source: "stored" | "database" | "gemini_generated";
  skipped: false;
  error?: string;
}

interface SkippedSlide {
  slot: "breakfast" | "lunch" | "dinner";
  name: string;
  skipped: true;
  skip_reason: string;
  nutritional_bandaid: string;
}

type AnySlide = RecipeSlideData | SkippedSlide | null;

interface RecipeViewerData {
  meal_plan_id: number;
  date: string;
  day_name: string;
  meals: {
    breakfast: AnySlide;
    lunch: AnySlide;
    dinner: AnySlide;
  };
}

interface RecipeViewerProps {
  mealPlanId: string | number;
  date: string;
  onClose: () => void;
}

const SLOT_CONFIG = {
  breakfast: { label: "Breakfast", emoji: "☀️", gradient: "from-amber-400 to-orange-500", bg: "bg-amber-50" },
  lunch: { label: "Lunch", emoji: "🍱", gradient: "from-emerald-400 to-green-600", bg: "bg-emerald-50" },
  dinner: { label: "Dinner", emoji: "🌙", gradient: "from-indigo-500 to-violet-700", bg: "bg-indigo-50" },
};

const FLAG_MAP: Record<string, string> = {
  allergy_compliant: "✅ Allergy Safe",
  low_sodium: "💧 Low Sodium",
  medication_window_respected: "💊 Meds Checked",
  zero_waste_item_used: "♻️ Zero Waste",
  zero_waste_rollover_from_skipped_meal: "♻️ Rollover Used",
};

function formatFlag(flag: string): string {
  if (FLAG_MAP[flag]) return FLAG_MAP[flag];
  return flag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function urgencyStyle(urgency: "CRITICAL" | "RECOMMENDED" | "INFO") {
  if (urgency === "CRITICAL") return "border-l-4 border-red-500 bg-red-50";
  if (urgency === "RECOMMENDED") return "border-l-4 border-amber-500 bg-amber-50";
  return "border-l-4 border-blue-400 bg-blue-50";
}

function urgencyIcon(urgency: "CRITICAL" | "RECOMMENDED" | "INFO") {
  if (urgency === "CRITICAL") return "⚠️";
  if (urgency === "RECOMMENDED") return "🔶";
  return "ℹ️";
}

function urgencyText(urgency: "CRITICAL" | "RECOMMENDED" | "INFO") {
  if (urgency === "CRITICAL") return "text-red-700 font-bold";
  if (urgency === "RECOMMENDED") return "text-amber-700 font-semibold";
  return "text-blue-700";
}

function getMemberDotColor(modifications: string[]): string {
  const hasCritical = modifications.some((m) => {
    const upper = m.toUpperCase();
    return upper.includes("ALLERGY CRITICAL") || upper.includes("PULL BEFORE") || upper.includes("JAIN RULE") || upper.includes("RELIGIOUS");
  });
  if (hasCritical) return "bg-red-500";
  const hasRecommended = modifications.some((m) => {
    const upper = m.toUpperCase();
    return upper.includes("DIABETES") || upper.includes("KIDNEY") || upper.includes("HYPERTENSION") || upper.includes("SODIUM CAP") || upper.includes("FASTING");
  });
  if (hasRecommended) return "bg-amber-500";
  return "bg-green-500";
}

function SlideContent({ slide }: { slide: AnySlide }) {
  const [ingredientsOpen, setIngredientsOpen] = useState(true);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  if (!slide) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
        <p>No meal data for this slot.</p>
      </div>
    );
  }

  if ((slide as RecipeSlideData).error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
        <p>Recipe details unavailable for {slide.name}.</p>
      </div>
    );
  }

  const cfg = SLOT_CONFIG[slide.slot];

  if (slide.skipped) {
    const s = slide as SkippedSlide;
    return (
      <div className="flex-1 overflow-y-auto">
        {/* Hero placeholder for skipped */}
        <div className={`w-full h-[220px] bg-gradient-to-br ${cfg.gradient} flex items-center justify-center relative`}>
          <div className="text-center text-white">
            <p className="text-5xl mb-2">🍴</p>
            <p className="text-lg font-bold opacity-90">{s.name}</p>
          </div>
          <div className="absolute bottom-3 left-3">
            <span className="bg-black/50 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              {cfg.emoji} {cfg.label}
            </span>
          </div>
        </div>
        <div className="p-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 space-y-2">
            <p className="text-sm font-semibold text-yellow-800">⏭️ Meal Skipped</p>
            <p className="text-sm text-yellow-700">{s.skip_reason}</p>
            {s.nutritional_bandaid && (
              <p className="text-xs text-yellow-600 italic">{s.nutritional_bandaid}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const recipe = slide as RecipeSlideData;
  const hasTiffin = recipe.member_plates.some((p) => p.tiffin_instructions);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Zone 1 — Hero Image */}
      <div className="relative w-full h-[220px] shrink-0 overflow-hidden">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${cfg.gradient} flex items-center justify-center`}>
            <p className="text-white text-xl font-bold text-center px-6 drop-shadow">{recipe.name}</p>
          </div>
        )}
        <div className="absolute bottom-3 left-3">
          <span className="bg-black/55 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
            {cfg.emoji} {cfg.label}
          </span>
        </div>
        <div className="absolute bottom-3 right-3">
          <span className="bg-green-600/90 text-white text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
            ~₹{recipe.estimated_cost_inr}
          </span>
        </div>
      </div>

      {/* Zone 2 — Dish Info Bar */}
      <div className="px-4 py-3 border-b border-border/30">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[17px] font-bold text-foreground leading-tight flex-1">{recipe.name}</p>
          {recipe.recipe_source === "gemini_generated" && (
            <span className="shrink-0 text-[10px] font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">AI Generated</span>
          )}
          {recipe.recipe_source === "database" && (
            <span className="shrink-0 text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">From Library</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          {recipe.prep_time_mins > 0 && <span>🕐 {recipe.prep_time_mins} min prep</span>}
          {recipe.cook_time_mins > 0 && <span>🔥 {recipe.cook_time_mins} min cook</span>}
        </div>
      </div>

      {/* Zone 3 — Priority Flags */}
      {recipe.priority_flags.length > 0 && (
        <div className="px-4 py-2.5 flex gap-1.5 overflow-x-auto border-b border-border/30">
          {recipe.priority_flags.map((flag) => (
            <span
              key={flag}
              className="shrink-0 text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full whitespace-nowrap"
            >
              {formatFlag(flag)}
            </span>
          ))}
        </div>
      )}

      {/* Zone 5 — Ingredients */}
      <div className="border-b border-border/30">
        <button
          type="button"
          onClick={() => setIngredientsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors"
        >
          <span>🥘 Ingredients</span>
          {ingredientsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {ingredientsOpen && (
          <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-1">
            {recipe.ingredients.map((ing, i) => {
              const inPantry = recipe.pantry_items_used.some(
                (p) => p.toLowerCase() === ing.name.toLowerCase()
              );
              return (
                <div key={i} className="flex items-center justify-between py-1 border-b border-border/20 col-span-1">
                  <span className="text-xs font-medium text-foreground flex items-center gap-1">
                    {ing.name}
                    {inPantry && (
                      <span className="text-[9px] bg-green-100 text-green-700 px-1 py-0.5 rounded-full">📦</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">{ing.quantity}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Zone 6 — Step-by-Step Instructions */}
      <div className="px-4 py-3 border-b border-border/30 space-y-3">
        <p className="text-sm font-semibold text-foreground">👨‍🍳 Method</p>
        {recipe.enriched_steps.length > 0 ? (
          recipe.enriched_steps.map((step) => (
            <div key={step.step_number} className="rounded-xl border border-border/40 overflow-hidden">
              <div className="px-3 py-2.5 bg-muted/20">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Step {step.step_number}</p>
                <p className="text-sm text-foreground leading-relaxed">{step.instruction}</p>
              </div>
              {step.member_modifications.length > 0 && (
                <div className="divide-y divide-border/20">
                  {step.member_modifications.map((mod, mi) => (
                    <div key={mi} className={`px-3 py-2 ${urgencyStyle(mod.urgency)}`}>
                      <p className={`text-xs ${urgencyText(mod.urgency)}`}>
                        {urgencyIcon(mod.urgency)} For {mod.member_name}: {mod.modification_text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground italic">No steps available for this recipe.</p>
        )}
      </div>

      {/* Zone 7 — Member Summary Strip */}
      {recipe.member_plates.length > 0 && (
        <div className="px-4 py-3 border-b border-border/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Family Plates</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recipe.member_plates.map((plate) => {
              const dotColor = getMemberDotColor(plate.modifications);
              const isExpanded = expandedMember === plate.member_name;
              return (
                <div key={plate.member_name} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setExpandedMember(isExpanded ? null : plate.member_name)}
                    className="flex items-center gap-1.5 bg-muted/50 hover:bg-muted/80 border border-border/40 text-xs font-medium text-foreground px-2.5 py-1.5 rounded-full transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                    {plate.member_name}
                  </button>
                  {isExpanded && plate.modifications.length > 0 && (
                    <div className="mt-1.5 bg-muted/30 border border-border/40 rounded-xl p-2.5 min-w-[200px] max-w-[260px] space-y-1">
                      {plate.modifications.map((mod, i) => (
                        <p key={i} className="text-[11px] text-foreground/80 flex gap-1">
                          <span className="shrink-0">•</span>
                          <span>{mod}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Zone 8 — Tiffin Notice */}
      {hasTiffin && (
        <div className="px-4 py-3">
          {recipe.member_plates
            .filter((p) => p.tiffin_instructions)
            .map((p) => (
              <div key={p.member_name} className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-2">
                <p className="text-xs font-semibold text-blue-800 mb-0.5">🎒 Tiffin Note — {p.member_name}</p>
                <p className="text-xs text-blue-700">{p.tiffin_instructions}</p>
              </div>
            ))}
        </div>
      )}

      <div className="h-6" />
    </div>
  );
}

export default function RecipeViewer({ mealPlanId, date, onClose }: RecipeViewerProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RecipeViewerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const SLOTS: Array<"breakfast" | "lunch" | "dinner"> = ["breakfast", "lunch", "dinner"];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch(`/api/meal-gen/${mealPlanId}/day/${date}/recipe`)
      .then((res) => {
        if (!res.ok) return res.json().then((e: any) => { throw new Error(e?.error ?? "Failed to load recipes"); });
        return res.json();
      })
      .then((json: RecipeViewerData) => {
        if (!cancelled) { setData(json); setLoading(false); }
      })
      .catch((e: Error) => {
        if (!cancelled) { setError(e.message); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [mealPlanId, date]);

  const prevSlide = useCallback(() => setCurrentSlide((s) => Math.max(0, s - 1)), []);
  const nextSlide = useCallback(() => setCurrentSlide((s) => Math.min(2, s + 1)), []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === "ArrowRight") nextSlide();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, prevSlide, nextSlide]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 40) nextSlide();
    else if (delta < -40) prevSlide();
    touchStartX.current = null;
  };

  const currentSlideData = data ? data.meals[SLOTS[currentSlide]] : null;

  const displayDate = data?.date
    ? new Date(data.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : date;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative z-10 bg-background w-full md:max-w-lg md:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "95dvh", height: "95dvh" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0 bg-background">
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-foreground leading-tight">{data?.day_name ?? "Recipes"}</p>
            <p className="text-xs text-muted-foreground">{displayDate}</p>
          </div>

          {/* Slide Dots */}
          <div className="flex items-center gap-1.5 mx-4">
            {SLOTS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentSlide(i)}
                className={`rounded-full transition-all ${i === currentSlide ? "w-4 h-2.5 bg-primary" : "w-2 h-2 bg-muted-foreground/40"}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <div className="w-full space-y-3 animate-pulse">
              {[220, 60, 40].map((h, i) => (
                <div key={i} className="bg-muted rounded-xl" style={{ height: h }} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Loading today's recipes...</p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div>
              <p className="text-4xl mb-3">😕</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {/* Slide content */}
        {!loading && !error && data && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Slide label bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-muted/20 shrink-0">
              <button
                type="button"
                onClick={prevSlide}
                disabled={currentSlide === 0}
                className="p-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-base">{SLOT_CONFIG[SLOTS[currentSlide]].emoji}</span>
                <span className="text-sm font-semibold text-foreground">{SLOT_CONFIG[SLOTS[currentSlide]].label}</span>
              </div>
              <button
                type="button"
                onClick={nextSlide}
                disabled={currentSlide === 2}
                className="p-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <SlideContent slide={currentSlideData} />
          </div>
        )}
      </div>
    </div>
  );
}
