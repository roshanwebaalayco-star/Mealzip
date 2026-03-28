import { getMandiPrices, type MandiIngredient } from "./mandi-data.js";

export interface SwapResult {
  originalIngredient: string;
  substitutedIngredient: string;
  originalRetailPrice: number;
  newRetailPrice: number;
  savingPerKg: number;
  surgePercent: number;
  aminoNote?: string;
}

export interface ArbitrageResult {
  swaps: SwapResult[];
  totalSaved: number;
  hasArbitrage: boolean;
  alertMessage: string | null;
}

export interface PlanModification {
  day: string;
  meal: string;
  original: string;
  substituted: string;
  savingPerKg: number;
}

export interface ArbitragePlanResult {
  optimizedPlan: Array<Record<string, unknown>>;
  totalSaved: number;
  planModifications: PlanModification[];
}

export function applyIngredientArbitrage(ingredientNames: string[]): ArbitrageResult {
  const prices = getMandiPrices();
  const priceMap = new Map<string, MandiIngredient>(
    prices.map(p => [p.name.toLowerCase(), p])
  );

  const swaps: SwapResult[] = [];
  let totalSaved = 0;

  for (const ingName of ingredientNames) {
    const market = priceMap.get(ingName.toLowerCase());
    if (!market) continue;
    if (market.trend !== "surging" || market.surge_percentage <= 30) continue;
    if (!market.arbitrage_target) continue;

    const swapTarget = priceMap.get(market.arbitrage_target.toLowerCase());
    if (!swapTarget) continue;

    const savingPerKg = market.retail_price - swapTarget.retail_price;
    if (savingPerKg <= 0) continue;

    totalSaved += savingPerKg;
    swaps.push({
      originalIngredient: market.name,
      substitutedIngredient: swapTarget.name,
      originalRetailPrice: market.retail_price,
      newRetailPrice: swapTarget.retail_price,
      savingPerKg,
      surgePercent: market.surge_percentage,
      aminoNote: market.amino_note,
    });
  }

  let alertMessage: string | null = null;
  if (swaps.length > 0) {
    const primary = swaps[0];
    const savingStr = totalSaved > 0 ? `₹${totalSaved} Saved. ` : "";
    alertMessage = `⚠️ ${primary.originalIngredient} up ${primary.surgePercent}% in Bokaro Mandi. Auto-swapped to ${primary.substitutedIngredient}. ${savingStr}${primary.aminoNote ?? "Nutritional equivalence maintained."}`;
  }

  return {
    swaps,
    totalSaved,
    hasArbitrage: swaps.length > 0,
    alertMessage,
  };
}

export function applyArbitrageToPlan(
  days: Array<Record<string, unknown>>,
): ArbitragePlanResult {
  const extracted = new Set<string>();
  for (const day of days) {
    const meals = day.meals as Record<string, unknown> | undefined;
    if (!meals) continue;
    for (const meal of Object.values(meals)) {
      const m = meal as Record<string, unknown>;
      if (Array.isArray(m.ingredients)) {
        for (const ing of m.ingredients as string[]) {
          const cleaned = String(ing).replace(/^\d+[\w.]*\s*/, "").split(" ")[0];
          if (cleaned.length > 2) extracted.add(cleaned);
        }
      }
      if (Array.isArray(m.base_ingredients)) {
        for (const bi of m.base_ingredients as Array<{ ingredient?: string }>) {
          if (bi.ingredient && bi.ingredient.length > 2) extracted.add(bi.ingredient.split(" ")[0]);
        }
      }
      if (typeof m.recipeName === "string") {
        m.recipeName.split(/\s+/).forEach(w => { if (w.length > 3) extracted.add(w); });
      }
    }
  }

  const result = applyIngredientArbitrage([...extracted]);
  const planModifications: PlanModification[] = [];

  if (result.hasArbitrage && result.swaps.length > 0) {
    for (const day of days) {
      const dayName = String(day.day ?? "");
      const meals = day.meals as Record<string, unknown> | undefined;
      if (!meals) continue;
      for (const mealKey of Object.keys(meals)) {
        const meal = meals[mealKey] as Record<string, unknown>;
        const substitutions: string[] = [];

        if (Array.isArray(meal.ingredients)) {
          meal.ingredients = (meal.ingredients as string[]).map((ing: string) => {
            let out = ing;
            for (const swap of result.swaps) {
              const re = new RegExp(`\\b${swap.originalIngredient}\\b`, "gi");
              if (re.test(out)) {
                out = out.replace(re, swap.substitutedIngredient);
                if (!substitutions.includes(swap.originalIngredient)) substitutions.push(swap.originalIngredient);
              }
            }
            return out;
          });
        }

        if (Array.isArray(meal.base_ingredients)) {
          meal.base_ingredients = (meal.base_ingredients as Array<Record<string, unknown>>).map(bi => {
            const name = String(bi.ingredient ?? "");
            for (const swap of result.swaps) {
              const re = new RegExp(`\\b${swap.originalIngredient}\\b`, "gi");
              if (re.test(name)) {
                if (!substitutions.includes(swap.originalIngredient)) substitutions.push(swap.originalIngredient);
                return { ...bi, ingredient: name.replace(re, swap.substitutedIngredient) };
              }
            }
            return bi;
          });
        }

        if (substitutions.length > 0) {
          for (const s of substitutions) {
            const sw = result.swaps.find(x => x.originalIngredient.toLowerCase() === s.toLowerCase());
            if (sw) planModifications.push({ day: dayName, meal: mealKey, original: sw.originalIngredient, substituted: sw.substitutedIngredient, savingPerKg: sw.savingPerKg });
          }
          const swapNote = substitutions.map(s => {
            const sw = result.swaps.find(x => x.originalIngredient.toLowerCase() === s.toLowerCase());
            return sw ? `${sw.originalIngredient}→${sw.substitutedIngredient}` : s;
          }).join(", ");
          (meals[mealKey] as Record<string, unknown>)._arbitrageNote = `Mandi-optimized: ${swapNote} (save ₹${Math.round(result.totalSaved)}/kg)`;
        }
      }
    }
  }

  return { optimizedPlan: days, totalSaved: result.totalSaved, planModifications };
}
