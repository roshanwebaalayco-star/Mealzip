export interface ThaliCategory {
  key: string;
  label: string;
  labelHi: string;
  icon: string;
}

export const THALI_CATEGORIES: ThaliCategory[] = [
  { key: "carb", label: "Carbs", labelHi: "कार्ब्स", icon: "🌾" },
  { key: "protein", label: "Protein", labelHi: "प्रोटीन", icon: "💪" },
  { key: "fat", label: "Healthy Fat", labelHi: "स्वस्थ वसा", icon: "✨" },
  { key: "fiber", label: "Fiber", labelHi: "फाइबर", icon: "🥦" },
  { key: "vegetable", label: "Vegetable", labelHi: "सब्जी", icon: "🥗" },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  carb: [
    "rice", "chawal", "roti", "paratha", "naan", "bread", "poha", "upma",
    "idli", "dosa", "puri", "bhature", "phulka", "chapati", "khichdi",
    "pulao", "biryani", "pasta", "noodles", "oats", "semolina", "suji",
    "rava", "millet", "bajra", "jowar", "ragi", "maize", "corn",
    "sabudana", "wheat", "atta", "flour", "cereal",
  ],
  protein: [
    "dal", "daal", "lentil", "chana", "chickpea", "rajma", "kidney bean",
    "moong", "urad", "toor", "masoor", "sprout", "paneer", "tofu",
    "curd", "dahi", "yogurt", "milk", "egg", "chicken", "mutton",
    "fish", "prawn", "shrimp", "soybean", "soya", "cheese", "whey",
    "buttermilk", "chaas", "lassi", "peanut", "almond", "cashew",
    "walnut", "pistachio", "seed",
  ],
  fat: [
    "ghee", "oil", "butter", "coconut", "nut", "almond", "cashew",
    "walnut", "peanut", "pistachio", "flaxseed", "chia", "sesame",
    "til", "mustard oil", "olive oil", "avocado", "cream",
    "makhana", "fox nut",
  ],
  fiber: [
    "oats", "whole grain", "whole wheat", "bran", "flaxseed", "chia",
    "psyllium", "isabgol", "brown rice", "millet", "bajra", "jowar",
    "ragi", "barley", "sprout", "legume", "bean", "lentil",
    "guava", "apple", "pear", "fig", "prune",
  ],
  vegetable: [
    "sabzi", "sabji", "vegetable", "palak", "spinach", "methi",
    "bhindi", "okra", "gobi", "cauliflower", "broccoli", "cabbage",
    "carrot", "gajar", "beetroot", "tomato", "onion", "capsicum",
    "bell pepper", "lauki", "bottle gourd", "tori", "ridge gourd",
    "karela", "bitter gourd", "pumpkin", "kaddu", "beans",
    "french beans", "cucumber", "radish", "mushroom", "drumstick",
    "bathua", "amaranth", "salad", "lettuce", "raita",
    "coriander", "mint", "curry leaf", "brinjal", "eggplant",
    "peas", "matar", "corn", "baby corn", "zucchini",
  ],
};

const MISSING_SUGGESTIONS: Record<string, { en: string; hi: string }> = {
  carb: { en: "Add roti, rice, or a millet like bajra/ragi", hi: "रोटी, चावल, या बाजरा/रागी जोड़ें" },
  protein: { en: "Add curd, dal, paneer, or an egg", hi: "दही, दाल, पनीर, या अंडा जोड़ें" },
  fat: { en: "Add a spoon of ghee, nuts, or seeds", hi: "एक चम्मच घी, मेवे, या बीज जोड़ें" },
  fiber: { en: "Add a whole-grain item or sprouts", hi: "साबुत अनाज या अंकुरित अनाज जोड़ें" },
  vegetable: { en: "Add a sabzi, salad, or raita", hi: "सब्जी, सलाद, या रायता जोड़ें" },
};

export interface ThaliScore {
  score: number;
  present: string[];
  missing: string[];
  suggestions: Array<{ category: string; en: string; hi: string }>;
}

export function scoreThaliCompleteness(meal: {
  recipeName?: string;
  base_dish_name?: string;
  name?: string;
  nameHindi?: string;
  ingredients?: string[] | string;
  base_ingredients?: Array<{ ingredient: string; qty_grams?: number }>;
}): ThaliScore {
  const textParts: string[] = [];

  if (meal.base_dish_name) textParts.push(meal.base_dish_name);
  if (meal.recipeName) textParts.push(meal.recipeName);
  if (meal.name) textParts.push(meal.name);
  if (meal.nameHindi) textParts.push(meal.nameHindi);

  if (Array.isArray(meal.ingredients)) {
    textParts.push(...meal.ingredients);
  } else if (typeof meal.ingredients === "string") {
    textParts.push(meal.ingredients);
  }

  if (Array.isArray(meal.base_ingredients)) {
    for (const bi of meal.base_ingredients) {
      if (bi.ingredient) textParts.push(bi.ingredient);
    }
  }

  const fullText = textParts.join(" ").toLowerCase();

  const wordBoundaryMatch = (text: string, keyword: string): boolean => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[\\s,;|/()\\[\\]])${escaped}(?=$|[\\s,;|/()\\[\\]])`, "i").test(text);
  };

  const present: string[] = [];
  const missing: string[] = [];
  const suggestions: Array<{ category: string; en: string; hi: string }> = [];

  for (const cat of THALI_CATEGORIES) {
    const keywords = CATEGORY_KEYWORDS[cat.key] ?? [];
    const found = keywords.some(kw => wordBoundaryMatch(fullText, kw));
    if (found) {
      present.push(cat.key);
    } else {
      missing.push(cat.key);
      const sug = MISSING_SUGGESTIONS[cat.key];
      if (sug) {
        suggestions.push({ category: cat.key, ...sug });
      }
    }
  }

  return {
    score: present.length,
    present,
    missing,
    suggestions,
  };
}
