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
