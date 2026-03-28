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
};

export function generatePrepAlerts(ingredientList: string[], mealContext: string): PrepAlert[] {
  const alerts: PrepAlert[] = [];
  const seen = new Set<string>();

  for (const ing of ingredientList) {
    const key = ing.toLowerCase().trim();
    const match = BIOCHEM_DB[key];
    if (match && !seen.has(key)) {
      seen.add(key);
      alerts.push({
        ingredient: ing,
        ...match,
        meal_context: mealContext,
      });
    }
  }

  return alerts;
}

export function scanPlanForPrepAlerts(tomorrowMeals: Array<{ mealType: string; ingredients?: string[] }>): PrepAlert[] {
  const allAlerts: PrepAlert[] = [];
  const seen = new Set<string>();

  for (const meal of tomorrowMeals) {
    if (!meal.ingredients) continue;
    const mealAlerts = generatePrepAlerts(meal.ingredients, meal.mealType);
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
