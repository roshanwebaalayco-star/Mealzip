export interface PrepAlert {
  ingredient: string;
  ingredientHindi: string;
  action: "Soak" | "Germinate" | "Ferment";
  duration: string;
  benefit: string;
  benefitHindi: string;
  meal_context: string;
}

const BIOCHEM_DB: Record<string, Omit<PrepAlert, "ingredient" | "meal_context">> = {
  "rajma": {
    ingredientHindi: "राजमा",
    action: "Soak",
    duration: "8h",
    benefit: "Reduces phytates by 40%, unlocking iron absorption — supports anemia goals",
    benefitHindi: "फाइटेट 40% कम, आयरन अवशोषण बढ़ता है — एनीमिया में लाभकारी",
  },
  "kidney beans": {
    ingredientHindi: "राजमा",
    action: "Soak",
    duration: "8h",
    benefit: "Reduces phytates by 40%, unlocking iron absorption — supports anemia goals",
    benefitHindi: "फाइटेट 40% कम, आयरन अवशोषण बढ़ता है",
  },
  "chole": {
    ingredientHindi: "छोले",
    action: "Soak",
    duration: "8h",
    benefit: "Improves digestibility and nutrient bioavailability by removing anti-nutritional factors",
    benefitHindi: "पाचन सुधरता है, पोषक तत्वों का अवशोषण बढ़ता है",
  },
  "chickpeas": {
    ingredientHindi: "छोले",
    action: "Soak",
    duration: "8h",
    benefit: "Improves digestibility and nutrient bioavailability by removing anti-nutritional factors",
    benefitHindi: "पाचन सुधरता है, पोषक तत्वों का अवशोषण बढ़ता है",
  },
  "chana": {
    ingredientHindi: "चना",
    action: "Soak",
    duration: "8h",
    benefit: "Reduces oligosaccharides, eases digestion, increases mineral absorption",
    benefitHindi: "ओलिगोसाकराइड कम, पाचन आसान, खनिज अवशोषण बढ़ता है",
  },
  "moong": {
    ingredientHindi: "मूंग",
    action: "Germinate",
    duration: "24h",
    benefit: "Increases Vitamin C by 300% and unlocks complex proteins for muscle synthesis",
    benefitHindi: "विटामिन C 300% बढ़ता है, प्रोटीन की उपलब्धता बढ़ती है",
  },
  "moong dal": {
    ingredientHindi: "मूंग दाल",
    action: "Germinate",
    duration: "12h",
    benefit: "Increases folate by 25% and enhances iron bioavailability — ideal for anemia",
    benefitHindi: "फोलेट 25% बढ़ता है, आयरन उपलब्धता बढ़ती है",
  },
  "dosa batter": {
    ingredientHindi: "डोसा बैटर",
    action: "Ferment",
    duration: "12h",
    benefit: "Increases Vitamin B12 and creates gut-friendly probiotics — improves gut health",
    benefitHindi: "विटामिन B12 बढ़ता है, प्रोबायोटिक्स बनते हैं — पेट के लिए लाभकारी",
  },
  "idli batter": {
    ingredientHindi: "इडली बैटर",
    action: "Ferment",
    duration: "12h",
    benefit: "Fermentation increases B-vitamins and improves protein digestibility",
    benefitHindi: "किण्वन से B-विटामिन बढ़ते हैं, प्रोटीन पाचन सुधरता है",
  },
  "urad dal": {
    ingredientHindi: "उड़द दाल",
    action: "Soak",
    duration: "6h",
    benefit: "Reduces tannins and trypsin inhibitors, significantly improving protein quality",
    benefitHindi: "टैनिन और ट्रिप्सिन अवरोधक कम होते हैं, प्रोटीन गुणवत्ता बढ़ती है",
  },
  "bajra": {
    ingredientHindi: "बाजरा",
    action: "Soak",
    duration: "8h",
    benefit: "Reduces phytic acid by 60%, making zinc and iron 3x more bioavailable",
    benefitHindi: "फाइटिक एसिड 60% कम, जिंक और आयरन 3 गुना अधिक उपलब्ध",
  },
  "ragi": {
    ingredientHindi: "रागी",
    action: "Germinate",
    duration: "24h",
    benefit: "Germination reduces tannins and doubles calcium bioavailability — critical for bone health",
    benefitHindi: "टैनिन कम होते हैं, कैल्शियम उपलब्धता दोगुनी — हड्डियों के लिए बेहतर",
  },
  "toor dal": {
    ingredientHindi: "तूर दाल",
    action: "Soak",
    duration: "4h",
    benefit: "Reduces cooking time by 50% and lowers phytic acid — improves zinc absorption",
    benefitHindi: "पकाने का समय 50% कम, फाइटिक एसिड घटता है — जिंक अवशोषण बढ़ता है",
  },
  "masoor dal": {
    ingredientHindi: "मसूर दाल",
    action: "Soak",
    duration: "2h",
    benefit: "Quick soak reduces anti-nutrients, boosts iron bioavailability for anemia prevention",
    benefitHindi: "शीघ्र भिगोने से पोषण-रोधी तत्व कम होते हैं, आयरन अवशोषण बढ़ता है",
  },
  "methi": {
    ingredientHindi: "मेथी",
    action: "Soak",
    duration: "12h",
    benefit: "Soaking activates galactomannan fiber which helps regulate blood sugar — ideal for diabetes",
    benefitHindi: "भिगोने से गैलेक्टोमैनन फाइबर सक्रिय होता है जो रक्त शर्करा नियंत्रित करता है — मधुमेह में लाभकारी",
  },
  "paneer": {
    ingredientHindi: "पनीर",
    action: "Soak",
    duration: "1h",
    benefit: "Soaking in warm water makes paneer softer and more digestible — preserves calcium content",
    benefitHindi: "गुनगुने पानी में भिगोने से पनीर नरम और पचने में आसान होता है — कैल्शियम बना रहता है",
  },
  "meat": {
    ingredientHindi: "मीट",
    action: "Soak",
    duration: "4h",
    benefit: "Marinating in curd/lemon tenderizes protein and adds probiotics — reduces heterocyclic amines on cooking",
    benefitHindi: "दही/नींबू में मैरिनेट करने से प्रोटीन नरम होता है और प्रोबायोटिक्स मिलते हैं",
  },
  "chicken": {
    ingredientHindi: "चिकन",
    action: "Soak",
    duration: "4h",
    benefit: "Marinating in curd reduces cooking time and creates a probiotic-rich gravy base",
    benefitHindi: "दही में मैरिनेट करने से पकाने का समय कम और प्रोबायोटिक्स बढ़ते हैं",
  },
  "sabudana": {
    ingredientHindi: "साबूदाना",
    action: "Soak",
    duration: "6h",
    benefit: "Soaking ensures even texture and prevents lumping — essential for sabudana khichdi",
    benefitHindi: "भिगोने से समान बनावट आती है — साबूदाना खिचड़ी के लिए जरूरी",
  },
};

const QTY_PREFIX_RE = /^[\d/.][\d/.]*\s*(g|grams?|kg|ml|l|litres?|liters?|tsp|tbsp|cups?|pieces?|nos?|handful|pinch)\s*/i;

function normalizeIngredient(raw: string): string {
  return raw.toLowerCase().trim()
    .replace(QTY_PREFIX_RE, "")
    .replace(/\(.*?\)/g, "")
    .trim();
}

export function generatePrepAlerts(ingredientList: string[], mealContext: string): PrepAlert[] {
  const alerts: PrepAlert[] = [];
  const matchedKeys = new Set<string>();

  for (const ing of ingredientList) {
    const normalized = normalizeIngredient(ing);
    for (const [key, data] of Object.entries(BIOCHEM_DB)) {
      if (!matchedKeys.has(key) && normalized.includes(key)) {
        matchedKeys.add(key);
        alerts.push({ ingredient: key, ...data, meal_context: mealContext });
      }
    }
  }

  return alerts;
}

export function scanPlanForPrepAlerts(
  tomorrowMeals: Array<{
    mealType: string;
    ingredients?: string[];
    base_ingredients?: Array<{ ingredient: string; qty_grams?: number }>;
  }>,
): PrepAlert[] {
  const allAlerts: PrepAlert[] = [];
  const seen = new Set<string>();

  for (const meal of tomorrowMeals) {
    const strIngredients = meal.ingredients ?? [];
    const baseIngredients = (meal.base_ingredients ?? []).map(b => b.ingredient);
    const combined = [...strIngredients, ...baseIngredients];
    const mealAlerts = generatePrepAlerts(combined, meal.mealType);
    for (const alert of mealAlerts) {
      const dedupeKey = `${alert.ingredient.toLowerCase()}:${alert.action}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        allAlerts.push(alert);
      }
    }
  }

  return allAlerts;
}
