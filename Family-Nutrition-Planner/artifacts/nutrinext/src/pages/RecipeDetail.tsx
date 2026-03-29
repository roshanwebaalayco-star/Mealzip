import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Clock, Flame, Leaf, IndianRupee, ChefHat, Users, BarChart2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api-fetch";

interface RecipeDetail {
  id: number;
  name: string;
  nameHindi?: string | null;
  cuisine?: string | null;
  diet?: string | null;
  course?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  iron?: number | null;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  totalTimeMin?: number | null;
  servings?: number | null;
  costPerServing?: number | null;
  ingredients?: string | null;
  instructions?: string | null;
  imageUrl?: string | null;
  icmr_rationale?: string;
}

function parseIngredients(raw: string): string[] {
  if (!raw) return [];
  const byPipe = raw.split("|").map(s => s.trim()).filter(Boolean);
  if (byPipe.length > 1) return byPipe;
  const byComma = raw.split(",").map(s => s.trim()).filter(Boolean);
  if (byComma.length > 1) return byComma;
  return raw.split("\n").map(s => s.trim()).filter(Boolean);
}

function parseInstructions(raw: string): string[] {
  if (!raw) return [];
  const byNewline = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  const byPeriod = raw.split(/\.\s+/).map(s => s.trim()).filter(Boolean);
  return byPeriod.length > 1 ? byPeriod : [raw];
}

const DIET_COLORS: Record<string, string> = {
  vegetarian: "bg-emerald-100 text-emerald-700 border-emerald-200",
  vegan: "bg-green-100 text-green-700 border-green-200",
  "non-vegetarian": "bg-red-100 text-red-700 border-red-200",
  eggetarian: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80";

export default function RecipeDetailPage() {
  const [, params] = useRoute("/recipes/:id");
  const [, setLocation] = useLocation();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const hasHistory = useRef(false);

  const recipeId = params?.id;

  useEffect(() => {
    hasHistory.current = window.history.length > 1;
  }, []);

  useEffect(() => {
    if (!recipeId) return;

    setRecipe(null);
    setIsLoading(true);
    setError(false);

    const pendingStr = sessionStorage.getItem("pending_recipe_detail");
    let pendingRecipe: RecipeDetail | null = null;
    if (pendingStr) {
      try {
        const pending = JSON.parse(pendingStr) as RecipeDetail;
        if (String(pending.id) === recipeId) {
          pendingRecipe = pending;
          setRecipe(pending);
        }
      } catch { }
      sessionStorage.removeItem("pending_recipe_detail");
    }

    apiFetch(`/api/recipes/${recipeId}`)
      .then(async res => {
        if (res.ok) {
          const detail = await res.json() as RecipeDetail;
          setRecipe(prev => {
            const base = prev ?? pendingRecipe;
            return base ? { ...base, ...detail, icmr_rationale: detail.icmr_rationale ?? base.icmr_rationale } : detail;
          });
        } else if (!pendingRecipe) {
          setError(true);
        }
      })
      .catch(() => {
        if (!pendingRecipe) setError(true);
      })
      .finally(() => setIsLoading(false));
  }, [recipeId]);

  if (isLoading && !recipe) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !recipe) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground text-sm">Recipe not found.</p>
        <button
          onClick={() => setLocation("/recipes")}
          className="mt-4 text-primary text-sm font-semibold hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  if (!recipe) return null;

  const ingredients = parseIngredients(recipe.ingredients ?? "");
  const steps = parseInstructions(recipe.instructions ?? "");
  const totalTime = recipe.totalTimeMin ?? ((recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0));
  const dietColor = DIET_COLORS[recipe.diet ?? ""] ?? "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen"
    >
      <div className="relative h-48 sm:h-64">
        <img
          src={recipe.imageUrl || DEFAULT_IMAGE}
          alt={recipe.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <button
          onClick={() => hasHistory.current ? window.history.back() : setLocation("/recipes")}
          className="absolute top-3 left-3 w-11 h-11 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-white font-medium text-xl sm:text-2xl leading-tight drop-shadow">
            {recipe.name}
          </h1>
          {recipe.nameHindi && (
            <p className="text-white/80 text-sm mt-0.5">{recipe.nameHindi}</p>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pb-8">
        <div className="flex items-center gap-2 pt-4 pb-2 flex-wrap">
          {recipe.cuisine && (
            <span className="text-xs font-semibold bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">
              {recipe.cuisine}
            </span>
          )}
          {recipe.diet && (
            <span className={`text-xs font-semibold border px-2.5 py-1 rounded-full flex items-center gap-1 ${dietColor}`}>
              {recipe.diet === "vegetarian" && <Leaf className="w-3 h-3" />}
              {recipe.diet}
            </span>
          )}
          {recipe.course && (
            <span className="text-xs font-medium bg-muted text-muted-foreground border border-border px-2.5 py-1 rounded-full capitalize">
              {recipe.course}
            </span>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 pb-4">
          <div className="bg-orange-50 rounded-xl p-2.5 text-center">
            <Flame className="w-4 h-4 text-orange-500 mx-auto mb-0.5" />
            <p className="text-sm font-bold text-orange-700">{Math.round(recipe.calories ?? 0)}</p>
            <p className="text-xs text-orange-500">kcal</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-2.5 text-center">
            <BarChart2 className="w-4 h-4 text-blue-500 mx-auto mb-0.5" />
            <p className="text-sm font-bold text-blue-700">{Math.round(recipe.protein ?? 0)}g</p>
            <p className="text-xs text-blue-500">protein</p>
          </div>
          {recipe.prepTimeMin != null ? (
            <div className="bg-amber-50 rounded-xl p-2.5 text-center">
              <Clock className="w-4 h-4 text-amber-500 mx-auto mb-0.5" />
              <p className="text-sm font-bold text-amber-700">{recipe.prepTimeMin}m</p>
              <p className="text-xs text-amber-500">prep</p>
            </div>
          ) : (
            <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
              <Clock className="w-4 h-4 text-emerald-500 mx-auto mb-0.5" />
              <p className="text-sm font-bold text-emerald-700">{totalTime > 0 ? `${totalTime}m` : "—"}</p>
              <p className="text-xs text-emerald-500">total time</p>
            </div>
          )}
          <div className="bg-violet-50 rounded-xl p-2.5 text-center">
            <IndianRupee className="w-4 h-4 text-violet-500 mx-auto mb-0.5" />
            <p className="text-sm font-bold text-violet-700">{Math.round(recipe.costPerServing ?? 0)}</p>
            <p className="text-xs text-violet-500">/serving</p>
          </div>
        </div>

        {recipe.prepTimeMin != null && recipe.cookTimeMin != null && (
          <div className="flex gap-2 pb-4">
            <div className="flex-1 bg-amber-50 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-amber-600 font-medium">Prep</span>
              <span className="text-sm font-bold text-amber-700">{recipe.prepTimeMin}m</span>
            </div>
            <div className="flex-1 bg-emerald-50 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-emerald-600 font-medium">Cook</span>
              <span className="text-sm font-bold text-emerald-700">{recipe.cookTimeMin}m</span>
            </div>
            {totalTime > 0 && (
              <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Total</span>
                <span className="text-sm font-bold text-gray-700">{totalTime}m</span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Carbs", value: recipe.carbs, unit: "g", color: "text-amber-600" },
              { label: "Fat", value: recipe.fat, unit: "g", color: "text-rose-600" },
              { label: "Fiber", value: recipe.fiber, unit: "g", color: "text-green-600" },
            ].map(m => (
              <div key={m.label} className="bg-muted/50 rounded-xl p-3 text-center">
                <p className={`text-sm font-bold ${m.color}`}>{Math.round(m.value ?? 0)}{m.unit}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>

          {recipe.servings && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4 shrink-0" />
              <span>Serves {recipe.servings} people</span>
            </div>
          )}

          {recipe.icmr_rationale && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">ICMR-NIN 2024</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{recipe.icmr_rationale}</p>
            </div>
          )}

          {ingredients.length > 0 && (
            <div>
              <h3 className="font-medium text-base mb-3 flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-primary" />
                Ingredients
              </h3>
              <ul className="space-y-2">
                {ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                    <span className="text-foreground/80 leading-snug">{ing}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {steps.length > 0 && (
            <div>
              <h3 className="font-medium text-base mb-3">
                Cooking Steps
              </h3>
              <ol className="space-y-3">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground/80 leading-relaxed flex-1">
                      {step.replace(/^step\s*\d+[:.]\s*/i, "")}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
