export interface MandiIngredient {
  id: string;
  name: string;
  nameHindi: string;
  category: string;
  wholesale_price: number;
  retail_price: number;
  unit: string;
  trend: "stable" | "rising" | "surging";
  surge_percentage: number;
  seasonal_baseline: number;
  arbitrage_target: string | null;
  amino_note?: string;
}

const BASE_PRICES: MandiIngredient[] = [
  { id: "ing_01", name: "Paneer", nameHindi: "पनीर", category: "Dairy", wholesale_price: 280, retail_price: 340, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 260, arbitrage_target: "Tofu", amino_note: "3:1 amino acid ratio maintained" },
  { id: "ing_02", name: "Tomato", nameHindi: "टमाटर", category: "Vegetables", wholesale_price: 42, retail_price: 60, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 35, arbitrage_target: "Tamarind" },
  { id: "ing_03", name: "Tofu", nameHindi: "टोफू", category: "Soy", wholesale_price: 180, retail_price: 220, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 180, arbitrage_target: null },
  { id: "ing_04", name: "Potato", nameHindi: "आलू", category: "Vegetables", wholesale_price: 33, retail_price: 50, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 30, arbitrage_target: "Sweet Potato" },
  { id: "ing_05", name: "Onion", nameHindi: "प्याज", category: "Vegetables", wholesale_price: 28, retail_price: 45, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 25, arbitrage_target: "Spring Onion" },
  { id: "ing_06", name: "Moong Dal", nameHindi: "मूंग दाल", category: "Pulses", wholesale_price: 95, retail_price: 130, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 90, arbitrage_target: "Masoor Dal" },
  { id: "ing_07", name: "Masoor Dal", nameHindi: "मसूर दाल", category: "Pulses", wholesale_price: 85, retail_price: 120, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 85, arbitrage_target: null },
  { id: "ing_08", name: "Toor Dal", nameHindi: "तूर दाल", category: "Pulses", wholesale_price: 100, retail_price: 140, unit: "kg", trend: "rising", surge_percentage: 12, seasonal_baseline: 88, arbitrage_target: "Chana Dal" },
  { id: "ing_09", name: "Chana Dal", nameHindi: "चना दाल", category: "Pulses", wholesale_price: 78, retail_price: 115, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 78, arbitrage_target: null },
  { id: "ing_10", name: "Rice", nameHindi: "चावल", category: "Grains", wholesale_price: 42, retail_price: 60, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 40, arbitrage_target: "Millets" },
  { id: "ing_11", name: "Wheat Flour (Atta)", nameHindi: "आटा", category: "Grains", wholesale_price: 35, retail_price: 50, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 33, arbitrage_target: null },
  { id: "ing_12", name: "Spinach", nameHindi: "पालक", category: "Vegetables", wholesale_price: 20, retail_price: 35, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 18, arbitrage_target: "Fenugreek" },
  { id: "ing_13", name: "Fenugreek", nameHindi: "मेथी", category: "Vegetables", wholesale_price: 18, retail_price: 30, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 18, arbitrage_target: null },
  { id: "ing_14", name: "Mustard Oil", nameHindi: "सरसों तेल", category: "Oils", wholesale_price: 140, retail_price: 185, unit: "litre", trend: "stable", surge_percentage: 0, seasonal_baseline: 135, arbitrage_target: null },
  { id: "ing_15", name: "Ghee", nameHindi: "घी", category: "Dairy", wholesale_price: 480, retail_price: 580, unit: "kg", trend: "rising", surge_percentage: 8, seasonal_baseline: 450, arbitrage_target: "Mustard Oil" },
  { id: "ing_16", name: "Milk", nameHindi: "दूध", category: "Dairy", wholesale_price: 48, retail_price: 60, unit: "litre", trend: "stable", surge_percentage: 0, seasonal_baseline: 46, arbitrage_target: "Soy Milk" },
  { id: "ing_17", name: "Rajma", nameHindi: "राजमा", category: "Pulses", wholesale_price: 110, retail_price: 155, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 108, arbitrage_target: "Kidney Beans (Canned)" },
  { id: "ing_18", name: "Chickpeas (Chole)", nameHindi: "छोले", category: "Pulses", wholesale_price: 88, retail_price: 125, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 85, arbitrage_target: null },
  { id: "ing_19", name: "Brinjal", nameHindi: "बैंगन", category: "Vegetables", wholesale_price: 22, retail_price: 40, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 20, arbitrage_target: "Zucchini" },
  { id: "ing_20", name: "Cauliflower", nameHindi: "गोभी", category: "Vegetables", wholesale_price: 18, retail_price: 35, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 15, arbitrage_target: null },
  { id: "ing_21", name: "Banana", nameHindi: "केला", category: "Fruits", wholesale_price: 28, retail_price: 45, unit: "dozen", trend: "stable", surge_percentage: 0, seasonal_baseline: 25, arbitrage_target: null },
  { id: "ing_22", name: "Apple", nameHindi: "सेब", category: "Fruits", wholesale_price: 80, retail_price: 120, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 75, arbitrage_target: "Guava" },
  { id: "ing_23", name: "Millets (Bajra)", nameHindi: "बाजरा", category: "Grains", wholesale_price: 28, retail_price: 45, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 25, arbitrage_target: null },
  { id: "ing_24", name: "Peanuts", nameHindi: "मूंगफली", category: "Nuts", wholesale_price: 80, retail_price: 110, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 75, arbitrage_target: null },
  { id: "ing_25", name: "Curd (Dahi)", nameHindi: "दही", category: "Dairy", wholesale_price: 55, retail_price: 70, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 50, arbitrage_target: null },
  { id: "ing_26", name: "Eggs", nameHindi: "अंडे", category: "Protein", wholesale_price: 65, retail_price: 90, unit: "dozen", trend: "stable", surge_percentage: 0, seasonal_baseline: 60, arbitrage_target: null },
  { id: "ing_27", name: "Chicken", nameHindi: "मुर्गा", category: "Protein", wholesale_price: 180, retail_price: 240, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 170, arbitrage_target: "Eggs" },
  { id: "ing_28", name: "Tamarind", nameHindi: "इमली", category: "Condiments", wholesale_price: 80, retail_price: 120, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 78, arbitrage_target: null },
  { id: "ing_29", name: "Jaggery (Gur)", nameHindi: "गुड़", category: "Sweeteners", wholesale_price: 45, retail_price: 65, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 42, arbitrage_target: null },
  { id: "ing_30", name: "Sweet Potato", nameHindi: "शकरकंद", category: "Vegetables", wholesale_price: 22, retail_price: 40, unit: "kg", trend: "stable", surge_percentage: 0, seasonal_baseline: 20, arbitrage_target: null },
];

let liveMandiState: MandiIngredient[] = BASE_PRICES.map(p => ({ ...p }));

export function getMandiPrices(): MandiIngredient[] {
  return liveMandiState;
}

export function triggerSurge(ingredientName: string = "Paneer", surgePercent: number = 42): void {
  const target = liveMandiState.find(i => i.name.toLowerCase() === ingredientName.toLowerCase());
  if (target) {
    target.surge_percentage = surgePercent;
    target.trend = "surging";
    target.retail_price = Math.round(target.seasonal_baseline * (1 + surgePercent / 100) * 1.4);
    target.wholesale_price = Math.round(target.seasonal_baseline * (1 + surgePercent / 100));
  }
}

export function resetSurge(ingredientName?: string): void {
  if (ingredientName) {
    const base = BASE_PRICES.find(i => i.name.toLowerCase() === ingredientName.toLowerCase());
    const live = liveMandiState.find(i => i.name.toLowerCase() === ingredientName.toLowerCase());
    if (base && live) {
      live.surge_percentage = base.surge_percentage;
      live.trend = base.trend;
      live.retail_price = base.retail_price;
      live.wholesale_price = base.wholesale_price;
    }
  } else {
    liveMandiState = BASE_PRICES.map(p => ({ ...p }));
  }
}
