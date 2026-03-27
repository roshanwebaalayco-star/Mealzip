import { X, Clock, Flame, Leaf, IndianRupee, ChefHat, Users, BarChart2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

interface RecipeDetailModalProps {
  recipe: RecipeDetail | null;
  onClose: () => void;
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

export default function RecipeDetailModal({ recipe, onClose }: RecipeDetailModalProps) {
  if (!recipe) return null;

  const ingredients = parseIngredients(recipe.ingredients ?? "");
  const steps = parseInstructions(recipe.instructions ?? "");
  const totalTime = recipe.totalTimeMin ?? ((recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0));
  const dietColor = DIET_COLORS[recipe.diet ?? ""] ?? "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="bg-white/95 backdrop-blur-xl w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Hero image */}
          <div className="relative h-52 sm:h-60 shrink-0">
            <img
              src={recipe.imageUrl || DEFAULT_IMAGE}
              alt={recipe.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-3 left-4 right-12">
              <h2 className="text-white font-display font-bold text-lg leading-tight drop-shadow">
                {recipe.name}
              </h2>
              {recipe.nameHindi && (
                <p className="text-white/80 text-sm mt-0.5">{recipe.nameHindi}</p>
              )}
            </div>
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 flex-wrap shrink-0">
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

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 px-4 pb-3 shrink-0">
            <div className="bg-orange-50 rounded-xl p-2 text-center">
              <Flame className="w-4 h-4 text-orange-500 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-orange-700">{Math.round(recipe.calories ?? 0)}</p>
              <p className="text-[10px] text-orange-500">kcal</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-2 text-center">
              <BarChart2 className="w-4 h-4 text-blue-500 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-blue-700">{Math.round(recipe.protein ?? 0)}g</p>
              <p className="text-[10px] text-blue-500">protein</p>
            </div>
            {recipe.prepTimeMin != null ? (
              <div className="bg-amber-50 rounded-xl p-2 text-center">
                <Clock className="w-4 h-4 text-amber-500 mx-auto mb-0.5" />
                <p className="text-xs font-bold text-amber-700">{recipe.prepTimeMin}m</p>
                <p className="text-[10px] text-amber-500">prep</p>
              </div>
            ) : (
              <div className="bg-emerald-50 rounded-xl p-2 text-center">
                <Clock className="w-4 h-4 text-emerald-500 mx-auto mb-0.5" />
                <p className="text-xs font-bold text-emerald-700">{totalTime > 0 ? `${totalTime}m` : "—"}</p>
                <p className="text-[10px] text-emerald-500">total time</p>
              </div>
            )}
            <div className="bg-violet-50 rounded-xl p-2 text-center">
              <IndianRupee className="w-4 h-4 text-violet-500 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-violet-700">{Math.round(recipe.costPerServing ?? 0)}</p>
              <p className="text-[10px] text-violet-500">/serving</p>
            </div>
          </div>
          {/* Prep + Cook breakdown when both are available */}
          {recipe.prepTimeMin != null && recipe.cookTimeMin != null && (
            <div className="flex gap-2 px-4 pb-2 shrink-0">
              <div className="flex-1 bg-amber-50 rounded-xl px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] text-amber-600 font-medium">Prep</span>
                <span className="text-xs font-bold text-amber-700">{recipe.prepTimeMin}m</span>
              </div>
              <div className="flex-1 bg-emerald-50 rounded-xl px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] text-emerald-600 font-medium">Cook</span>
                <span className="text-xs font-bold text-emerald-700">{recipe.cookTimeMin}m</span>
              </div>
              {totalTime > 0 && (
                <div className="flex-1 bg-gray-50 rounded-xl px-3 py-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-medium">Total</span>
                  <span className="text-xs font-bold text-gray-700">{totalTime}m</span>
                </div>
              )}
            </div>
          )}

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-4">
            {/* Macros */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Carbs", value: recipe.carbs, unit: "g", color: "text-amber-600" },
                { label: "Fat", value: recipe.fat, unit: "g", color: "text-rose-600" },
                { label: "Fiber", value: recipe.fiber, unit: "g", color: "text-green-600" },
              ].map(m => (
                <div key={m.label} className="bg-muted/50 rounded-xl p-2.5 text-center">
                  <p className={`text-sm font-bold ${m.color}`}>{Math.round(m.value ?? 0)}{m.unit}</p>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Servings */}
            {recipe.servings && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4 shrink-0" />
                <span>Serves {recipe.servings} people</span>
              </div>
            )}

            {/* ICMR rationale */}
            {recipe.icmr_rationale && (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">ICMR-NIN 2024</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{recipe.icmr_rationale}</p>
              </div>
            )}

            {/* Ingredients */}
            {ingredients.length > 0 && (
              <div>
                <h3 className="font-display font-bold text-sm mb-2 flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-primary" />
                  Ingredients
                </h3>
                <ul className="space-y-1.5">
                  {ingredients.map((ing, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                      <span className="text-foreground/80 leading-snug">{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Instructions */}
            {steps.length > 0 && (
              <div>
                <h3 className="font-display font-bold text-sm mb-2">
                  Cooking Steps
                </h3>
                <ol className="space-y-2.5">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
