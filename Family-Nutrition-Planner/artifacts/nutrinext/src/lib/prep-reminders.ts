export interface PrepRequirement {
  ingredient: string;
  prepType: "soak" | "ferment" | "sprout" | "marinate";
  duration: string;
  benefit: string;
  benefitHi: string;
  emoji: string;
}

interface PrepEntry {
  prepType: "soak" | "ferment" | "sprout" | "marinate";
  duration: string;
  benefit: string;
  benefitHi: string;
}

const PREP_REQUIREMENTS: Record<string, PrepEntry> = {
  rajma: {
    prepType: "soak",
    duration: "8–12 h",
    benefit: "Reduces phytates; improves iron absorption by ~30%",
    benefitHi: "फाइटेट कम करता है; आयरन अवशोषण ~30% बेहतर",
  },
  chana: {
    prepType: "soak",
    duration: "8–10 h",
    benefit: "Softens fiber; reduces cooking gas; improves protein digestibility",
    benefitHi: "फाइबर नरम करता है; गैस कम करता है; प्रोटीन पाचन बेहतर",
  },
  chole: {
    prepType: "soak",
    duration: "8–10 h",
    benefit: "Softens fiber; reduces cooking gas; improves protein digestibility",
    benefitHi: "फाइबर नरम करता है; गैस कम करता है; प्रोटीन पाचन बेहतर",
  },
  chickpea: {
    prepType: "soak",
    duration: "8–10 h",
    benefit: "Softens fiber; reduces cooking gas; improves protein digestibility",
    benefitHi: "फाइबर नरम करता है; गैस कम करता है; प्रोटीन पाचन बेहतर",
  },
  moong: {
    prepType: "sprout",
    duration: "12–24 h",
    benefit: "Sprouting increases vitamin C by 6x and B-vitamins; boosts bioavailability",
    benefitHi: "अंकुरित करने से विटामिन C 6 गुना बढ़ता है; जैव उपलब्धता बेहतर",
  },
  "urad dal": {
    prepType: "soak",
    duration: "4–6 h",
    benefit: "Reduces anti-nutrients; faster cooking; better mineral absorption",
    benefitHi: "एंटी-न्यूट्रिएंट्स कम; जल्दी पकता है; मिनरल अवशोषण बेहतर",
  },
  urad: {
    prepType: "soak",
    duration: "4–6 h",
    benefit: "Reduces anti-nutrients; faster cooking; better mineral absorption",
    benefitHi: "एंटी-न्यूट्रिएंट्स कम; जल्दी पकता है; मिनरल अवशोषण बेहतर",
  },
  "toor dal": {
    prepType: "soak",
    duration: "2–4 h",
    benefit: "Reduces phytic acid; improves zinc and iron absorption",
    benefitHi: "फाइटिक एसिड कम; जिंक और आयरन अवशोषण बेहतर",
  },
  dosa: {
    prepType: "ferment",
    duration: "8–12 h",
    benefit: "Fermentation increases B12 and biotin; improves gut-friendly bacteria",
    benefitHi: "किण्वन से B12 और बायोटिन बढ़ता है; पेट के लिए अच्छे बैक्टीरिया",
  },
  idli: {
    prepType: "ferment",
    duration: "8–12 h",
    benefit: "Fermentation increases B12 and biotin; improves gut-friendly bacteria",
    benefitHi: "किण्वन से B12 और बायोटिन बढ़ता है; पेट के लिए अच्छे बैक्टीरिया",
  },
  dhokla: {
    prepType: "ferment",
    duration: "6–8 h",
    benefit: "Fermentation makes protein more digestible; increases B-vitamins",
    benefitHi: "किण्वन से प्रोटीन आसानी से पचता है; B-विटामिन बढ़ते हैं",
  },
  chicken: {
    prepType: "marinate",
    duration: "2–4 h",
    benefit: "Curd marinade tenderizes; reduces harmful compounds when cooking at high heat",
    benefitHi: "दही मैरिनेड से नरम होता है; तेज आंच पर हानिकारक तत्व कम",
  },
  mutton: {
    prepType: "marinate",
    duration: "4–8 h",
    benefit: "Breaks down tough fibers; papaya/curd marinade improves tenderness and digestion",
    benefitHi: "सख्त फाइबर टूटते हैं; पपीता/दही मैरिनेड से नरम और पाचन बेहतर",
  },
  paneer: {
    prepType: "marinate",
    duration: "1–2 h",
    benefit: "Spice marinade improves flavor absorption; curd keeps it soft during cooking",
    benefitHi: "मसाला मैरिनेड से स्वाद बेहतर; दही पकाते समय नरम रखती है",
  },
  "kidney bean": {
    prepType: "soak",
    duration: "8–12 h",
    benefit: "Reduces phytates; improves iron absorption by ~30%",
    benefitHi: "फाइटेट कम करता है; आयरन अवशोषण ~30% बेहतर",
  },
};

const PREP_TYPE_EMOJI: Record<string, string> = {
  soak: "💧",
  ferment: "🧫",
  sprout: "🌱",
  marinate: "🫙",
};

function wordBoundaryMatch(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?:^|[\\s,;|/()\\[\\]])${escaped}(?=$|[\\s,;|/()\\[\\]])`, "i");
  return regex.test(text);
}

export interface PrepReminder {
  ingredient: string;
  prepType: "soak" | "ferment" | "sprout" | "marinate";
  duration: string;
  benefit: string;
  benefitHi: string;
  emoji: string;
  mealContext: string;
}

export function getPrepsForMeals(
  meals: Array<{
    mealType: string;
    ingredients?: string[];
    base_ingredients?: Array<{ ingredient: string; qty_grams?: number }>;
    recipeName?: string;
    base_dish_name?: string;
  }>
): PrepReminder[] {
  const matched = new Set<string>();
  const reminders: PrepReminder[] = [];

  for (const meal of meals) {
    const textParts: string[] = [];
    if (meal.recipeName) textParts.push(meal.recipeName);
    if (meal.base_dish_name) textParts.push(meal.base_dish_name);
    if (meal.ingredients) textParts.push(...meal.ingredients);
    if (meal.base_ingredients) {
      textParts.push(...meal.base_ingredients.map(bi => bi.ingredient));
    }
    const fullText = textParts.join(" ");

    for (const [keyword, entry] of Object.entries(PREP_REQUIREMENTS)) {
      if (matched.has(keyword)) continue;
      if (wordBoundaryMatch(fullText, keyword)) {
        matched.add(keyword);
        reminders.push({
          ingredient: keyword,
          prepType: entry.prepType,
          duration: entry.duration,
          benefit: entry.benefit,
          benefitHi: entry.benefitHi,
          emoji: PREP_TYPE_EMOJI[entry.prepType] ?? "⏰",
          mealContext: meal.mealType,
        });
      }
    }
  }

  return reminders;
}
