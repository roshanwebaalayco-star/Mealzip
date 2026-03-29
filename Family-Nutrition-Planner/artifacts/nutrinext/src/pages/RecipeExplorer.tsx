import { useState } from "react";
import { useLocation } from "wouter";
import { useListRecipes } from "@workspace/api-client-react";
import { Search, Clock, Flame, Leaf, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function RecipeExplorer() {
  const [search, setSearch] = useState("");
  const [dietFilter, setDietFilter] = useState("");
  const [, setLocation] = useLocation();

  const { data, isLoading } = useListRecipes({
    q: search || undefined,
    diet: dietFilter || undefined,
    limit: 12,
  });

  const diets = ["", "vegetarian", "vegan", "non-vegetarian"];
  const dietLabels: Record<string, string> = {
    "": "All Diets",
    vegetarian: "Vegetarian",
    vegan: "Vegan",
    "non-vegetarian": "Non-Veg",
  };

  function openRecipeDetail(id: number) {
    setLocation(`/recipes/${id}`);
  }

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-up">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <p className="label-caps mb-1" style={{ color: 'var(--brand-600)' }}>
          Database
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold leading-tight" style={{ letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
          NutriNext Recipes
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Explore 58,000+ Indian recipes evaluated against ICMR-NIN 2024 standards.
        </p>
      </motion.div>

      {/* Search bar + filters */}
      <div className="glass-elevated rounded-2xl p-3 flex flex-col sm:flex-row gap-3 sticky top-0 z-30">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            className="input-glass w-full pl-9 pr-4 h-11 text-sm rounded-xl"
            placeholder="Search by ingredient or dish name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {diets.map((diet) => (
            <button
              key={diet}
              onClick={() => setDietFilter(diet)}
              className={`flex-shrink-0 h-11 px-4 rounded-xl text-sm font-semibold transition-all ${
                dietFilter === diet
                  ? "pill-active"
                  : "pill"
              }`}
            >
              {dietLabels[diet]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger">
          {data?.recipes?.map((recipe, i) => (
            <motion.div
              key={recipe.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              className="recipe-card glass-card rounded-3xl overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98]"
              onClick={() => openRecipeDetail(recipe.id)}
            >
              {/* Image */}
              <div className="h-44 relative overflow-hidden bg-muted">
                <img
                  src={
                    recipe.imageUrl ||
                    "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&q=80"
                  }
                  alt={recipe.name}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
                {/* Cuisine badge */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="text-[0.7rem] font-bold bg-white/85 backdrop-blur-sm border border-white/60 text-foreground/80 px-2 py-1 rounded-full shadow-sm">
                    {recipe.cuisine}
                  </span>
                </div>
                {/* Diet icon */}
                <div className="absolute top-2.5 right-2.5">
                  {recipe.diet === "vegetarian" && (
                    <div className="w-6 h-6 bg-white/85 backdrop-blur rounded-full flex items-center justify-center shadow-sm">
                      <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  )}
                  {recipe.diet === "non-vegetarian" && (
                    <div className="w-6 h-6 bg-white/85 backdrop-blur rounded-full flex items-center justify-center shadow-sm">
                      <Flame className="w-3.5 h-3.5 text-red-500" />
                    </div>
                  )}
                </div>
                {/* Bottom gradient */}
                <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
              </div>

              {/* Info */}
              <div className="p-4 relative z-10">
                <h3 className="font-medium text-sm line-clamp-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  {recipe.name}
                </h3>
                {recipe.nameHindi && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {recipe.nameHindi}
                  </p>
                )}
                <div className="flex items-center gap-2.5 mt-3">
                  <span className="pill-brand inline-flex items-center gap-1 text-xs">
                    <Flame className="w-3 h-3" />
                    {recipe.calories} kcal
                  </span>
                  <span className="pill inline-flex items-center gap-1 text-xs">
                    <Clock className="w-3 h-3" />
                    {(recipe.prepTimeMin || 0) + (recipe.cookTimeMin || 0)}m
                  </span>
                </div>
                <p className="text-xs text-primary mt-2 font-medium">Tap for full recipe →</p>
              </div>
            </motion.div>
          ))}

          {data?.recipes?.length === 0 && (
            <div className="col-span-full py-20 text-center glass-card rounded-3xl flex flex-col items-center justify-center p-12">
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No recipes found. Try a different search or filter.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
