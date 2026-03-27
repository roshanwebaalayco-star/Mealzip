import { Router, type IRouter } from "express";
import { eq, inArray, ilike, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { recipesTable, familyMembersTable, foodGiNutritionTable } from "@workspace/db";
import { AnalyzeNutritionBody, ScanFoodBody } from "@workspace/api-zod";
import { getICMRNINTargets } from "../../lib/icmr-nin.js";
import { ai } from "@workspace/integrations-gemini-ai";

const router: IRouter = Router();

router.post("/nutrition/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzeNutritionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { recipeIds, memberId } = parsed.data;

  const recipes = await db.select().from(recipesTable).where(inArray(recipesTable.id, recipeIds));

  const totals = recipes.reduce((acc, r) => ({
    calories: acc.calories + Number(r.calories ?? 0),
    protein: acc.protein + Number(r.protein ?? 0),
    carbs: acc.carbs + Number(r.carbs ?? 0),
    fat: acc.fat + Number(r.fat ?? 0),
    fiber: acc.fiber + Number(r.fiber ?? 0),
    iron: acc.iron + Number(r.iron ?? 0),
    calcium: acc.calcium + Number(r.calcium ?? 0),
    vitaminC: acc.vitaminC + Number(r.vitaminC ?? 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, vitaminC: 0 });

  let icmrTargets = { calories: 2000, protein: 60, carbs: 300, fat: 55, fiber: 30, iron: 17, calcium: 600, vitaminC: 40 };

  if (memberId) {
    const [member] = await db.select().from(familyMembersTable).where(eq(familyMembersTable.id, memberId));
    if (member) {
      icmrTargets = getICMRNINTargets(member.age, member.gender, member.activityLevel, member.healthConditions ?? []);
    }
  }

  const percentages = {
    calories: Math.round((totals.calories / icmrTargets.calories) * 100),
    protein: Math.round((totals.protein / icmrTargets.protein) * 100),
    carbs: Math.round((totals.carbs / icmrTargets.carbs) * 100),
    fat: Math.round((totals.fat / icmrTargets.fat) * 100),
    fiber: Math.round((totals.fiber / icmrTargets.fiber) * 100),
    iron: Math.round((totals.iron / icmrTargets.iron) * 100),
    calcium: Math.round((totals.calcium / icmrTargets.calcium) * 100),
    vitaminC: Math.round((totals.vitaminC / icmrTargets.vitaminC) * 100),
  };

  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (percentages.calories < 80) warnings.push("Calories below recommended level (ICMR-NIN 2024)");
  if (percentages.calories > 120) warnings.push("Calories exceed recommended level (ICMR-NIN 2024)");
  if (percentages.protein < 80) {
    warnings.push("Protein insufficient — risk of muscle loss");
    recommendations.push("Add dal, paneer, eggs, or legumes for protein");
  }
  if (percentages.fiber < 70) {
    warnings.push("Dietary fiber low — may impact digestive health");
    recommendations.push("Include more sabzi, whole grains, and fruits");
  }
  if (percentages.iron < 80) {
    warnings.push("Iron intake low — risk of anaemia");
    recommendations.push("Include spinach (palak), rajma, and amla for iron & vitamin C");
  }
  if (percentages.calcium < 80) {
    warnings.push("Calcium insufficient for bone health");
    recommendations.push("Add milk, curd, ragi, or til (sesame)");
  }
  if (percentages.vitaminC < 80) {
    warnings.push("Vitamin C low — impacts iron absorption");
    recommendations.push("Include amla, guava, lemon, or tomatoes");
  }

  if (warnings.length === 0) {
    recommendations.push("Excellent nutritional balance! Meets ICMR-NIN 2024 standards.");
  }

  res.json({ totals, icmrTargets, percentages, warnings, recommendations });
});

async function enrichFromICMRDB(detectedFoods: DetectedFoodRaw[]): Promise<DetectedFoodRaw[]> {
  if (detectedFoods.length === 0) return detectedFoods;
  const enriched: DetectedFoodRaw[] = [];
  for (const food of detectedFoods) {
    const dishName = food.name.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    const terms = dishName.split(" ").filter(t => t.length > 2);
    try {
      if (terms.length === 0) {
        enriched.push(food);
        continue;
      }
      const conditions = terms.map(term =>
        ilike(recipesTable.name, `%${term}%`)
      );
      const dbRecipes = await db.select({
        id: recipesTable.id,
        name: recipesTable.name,
        calories: recipesTable.calories,
        protein: recipesTable.protein,
        carbs: recipesTable.carbs,
        fat: recipesTable.fat,
        fiber: recipesTable.fiber,
        iron: recipesTable.iron,
        calcium: recipesTable.calcium,
        servings: recipesTable.servings,
      }).from(recipesTable)
        .where(or(...conditions))
        .limit(1);

      if (dbRecipes.length > 0 && dbRecipes[0]) {
        const recipe = dbRecipes[0];
        const gramsRatio = food.estimatedGrams / (300);
        enriched.push({
          ...food,
          name: food.name,
          nutrition: {
            calories: Math.round((recipe.calories ?? food.nutrition.calories) * gramsRatio),
            protein: Math.round((recipe.protein ?? food.nutrition.protein) * gramsRatio * 10) / 10,
            carbs: Math.round((recipe.carbs ?? food.nutrition.carbs) * gramsRatio * 10) / 10,
            fat: Math.round((recipe.fat ?? food.nutrition.fat) * gramsRatio * 10) / 10,
            fiber: Math.round((recipe.fiber ?? food.nutrition.fiber ?? 0) * gramsRatio * 10) / 10,
            iron: Math.round((recipe.iron ?? food.nutrition.iron ?? 0) * gramsRatio * 10) / 10,
            calcium: Math.round((recipe.calcium ?? food.nutrition.calcium ?? 0) * gramsRatio * 10) / 10,
          },
          icmrDbMatch: recipe.name,
          nutritionSource: "icmr_db",
        } as DetectedFoodRaw & { icmrDbMatch?: string; nutritionSource?: string });
      } else {
        enriched.push({ ...food, nutritionSource: "model_estimated" } as DetectedFoodRaw & { nutritionSource?: string });
      }
    } catch {
      enriched.push(food);
    }
  }
  return enriched;
}

// ICMR-NIN 2024 estimated nutrition per 100g for common Indian foods
const ICMR_FOOD_TABLE: Record<string, { calories: number; protein: number; carbs: number; fat: number; fiber: number; iron: number }> = {
  "rice": { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, iron: 0.5 },
  "roti": { calories: 104, protein: 3.4, carbs: 20, fat: 1.5, fiber: 2.7, iron: 2.0 },
  "chapati": { calories: 104, protein: 3.4, carbs: 20, fat: 1.5, fiber: 2.7, iron: 2.0 },
  "dal": { calories: 116, protein: 8.9, carbs: 18, fat: 0.6, fiber: 3.5, iron: 3.4 },
  "paneer": { calories: 265, protein: 18.3, carbs: 1.2, fat: 20.8, fiber: 0, iron: 0.8 },
  "chicken": { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, iron: 1.3 },
  "mutton": { calories: 187, protein: 25, carbs: 0, fat: 9.4, fiber: 0, iron: 2.7 },
  "fish": { calories: 128, protein: 22, carbs: 0, fat: 3.8, fiber: 0, iron: 1.0 },
  "egg": { calories: 143, protein: 13, carbs: 1.1, fat: 9.5, fiber: 0, iron: 1.8 },
  "milk": { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, iron: 0.1 },
  "spinach": { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, iron: 2.7 },
  "potato": { calories: 77, protein: 2.0, carbs: 17, fat: 0.1, fiber: 2.2, iron: 0.8 },
  "tomato": { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, iron: 0.4 },
  "onion": { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, iron: 0.2 },
  "banana": { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, iron: 0.3 },
  "apple": { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, iron: 0.1 },
  "bread": { calories: 265, protein: 9.0, carbs: 49, fat: 3.2, fiber: 2.7, iron: 3.0 },
  "idli": { calories: 58, protein: 2.0, carbs: 11, fat: 0.3, fiber: 0.5, iron: 0.4 },
  "dosa": { calories: 133, protein: 3.4, carbs: 22, fat: 3.7, fiber: 0.8, iron: 0.8 },
  "sambar": { calories: 48, protein: 2.1, carbs: 7.3, fat: 1.2, fiber: 2.0, iron: 1.5 },
  "curd": { calories: 98, protein: 3.1, carbs: 3.4, fat: 3.9, fiber: 0, iron: 0.1 },
  "ghee": { calories: 900, protein: 0.0, carbs: 0.0, fat: 99.5, fiber: 0, iron: 0.0 },
  "rajma": { calories: 127, protein: 8.7, carbs: 23, fat: 0.5, fiber: 6.4, iron: 2.9 },
  "chana": { calories: 164, protein: 8.9, carbs: 27, fat: 2.6, fiber: 7.6, iron: 2.9 },
  "aloo": { calories: 77, protein: 2.0, carbs: 17, fat: 0.1, fiber: 2.2, iron: 0.8 },
  "sabzi": { calories: 60, protein: 2.5, carbs: 10, fat: 1.5, fiber: 2.5, iron: 1.5 },
  "paratha": { calories: 200, protein: 4.5, carbs: 28, fat: 8.5, fiber: 2.5, iron: 1.8 },
  "biryani": { calories: 200, protein: 7.0, carbs: 30, fat: 6.5, fiber: 1.5, iron: 1.2 },
  "khichdi": { calories: 130, protein: 5.5, carbs: 22, fat: 2.5, fiber: 2.0, iron: 1.8 },
  "upma": { calories: 145, protein: 3.5, carbs: 25, fat: 4.0, fiber: 1.5, iron: 0.9 },
  "poha": { calories: 130, protein: 2.5, carbs: 27, fat: 2.0, fiber: 0.8, iron: 1.0 },
};

router.get("/nutrition/lookup", async (req, res): Promise<void> => {
  const foodName = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const grams = parseFloat(typeof req.query.grams === "string" ? req.query.grams : "100") || 100;

  if (!foodName) {
    res.status(400).json({ error: "Missing q parameter" });
    return;
  }

  // Step 1: search recipe DB by name using GIN index
  const nameLower = foodName.toLowerCase();
  const safeQuery = nameLower.replace(/[^a-zA-Z0-9\u0900-\u097F\s]/g, "").split(/\s+/).filter(Boolean).join(" & ");

  let nutritionPer100g: { calories: number; protein: number; carbs: number; fat: number; fiber: number; iron: number } | null = null;
  let source = "icmr";

  if (safeQuery) {
    const [recipe] = await db.select({
      calories: recipesTable.calories,
      protein: recipesTable.protein,
      carbs: recipesTable.carbs,
      fat: recipesTable.fat,
      fiber: recipesTable.fiber,
      iron: recipesTable.iron,
      servings: recipesTable.servings,
    }).from(recipesTable)
      .where(sql`to_tsvector('simple', coalesce(${recipesTable.name}, '')) @@ to_tsquery('simple', ${safeQuery + ":*"})`)
      .limit(1);

    if (recipe) {
      const servings = recipe.servings ?? 4;
      nutritionPer100g = {
        calories: Math.round(Number(recipe.calories ?? 0) / servings),
        protein: Math.round(Number(recipe.protein ?? 0) / servings),
        carbs: Math.round(Number(recipe.carbs ?? 0) / servings),
        fat: Math.round(Number(recipe.fat ?? 0) / servings),
        fiber: Math.round(Number(recipe.fiber ?? 0) / servings),
        iron: Math.round(Number(recipe.iron ?? 0) / servings * 10) / 10,
      };
      source = "recipe_db";
    }
  }

  // Step 2: if not found in recipe DB, use ICMR food table
  if (!nutritionPer100g) {
    const key = Object.keys(ICMR_FOOD_TABLE).find(k => nameLower.includes(k));
    if (key) {
      nutritionPer100g = ICMR_FOOD_TABLE[key];
      source = "icmr_nin";
    }
  }

  // Step 3: generic fallback estimate for unknown foods
  if (!nutritionPer100g) {
    nutritionPer100g = { calories: 150, protein: 4, carbs: 25, fat: 3, fiber: 2, iron: 1.5 };
    source = "generic_estimate";
  }

  const scale = grams / 100;
  res.json({
    query: foodName,
    grams,
    source,
    calories: Math.round(nutritionPer100g.calories * scale),
    protein: Math.round(nutritionPer100g.protein * scale * 10) / 10,
    carbs: Math.round(nutritionPer100g.carbs * scale * 10) / 10,
    fat: Math.round(nutritionPer100g.fat * scale * 10) / 10,
    fiber: Math.round(nutritionPer100g.fiber * scale * 10) / 10,
    iron: Math.round(nutritionPer100g.iron * scale * 10) / 10,
    calcium: 0,
    vitaminC: 0,
  });
});

const YOLO_CONFIDENCE_THRESHOLD = 0.65;

interface DetectedFoodRaw {
  name: string;
  confidence: number;
  estimatedGrams: number;
  nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber?: number; iron?: number; calcium?: number };
}

function applyConfidenceFilter(detectedFoods: DetectedFoodRaw[]) {
  const highConfidence = detectedFoods.filter(f => f.confidence >= YOLO_CONFIDENCE_THRESHOLD);
  const lowConfidence = detectedFoods.filter(f => f.confidence < YOLO_CONFIDENCE_THRESHOLD);
  const foods = highConfidence;
  const totalNutrition = foods.reduce((acc, f) => ({
    calories: acc.calories + f.nutrition.calories,
    protein: acc.protein + f.nutrition.protein,
    carbs: acc.carbs + f.nutrition.carbs,
    fat: acc.fat + f.nutrition.fat,
    fiber: acc.fiber + (f.nutrition.fiber ?? 0),
    iron: acc.iron + (f.nutrition.iron ?? 0),
    calcium: acc.calcium + (f.nutrition.calcium ?? 0),
    vitaminC: acc.vitaminC,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, vitaminC: 0 });
  return { detectedFoods: foods, lowConfidenceItems: lowConfidence, totalNutrition, confidenceThreshold: YOLO_CONFIDENCE_THRESHOLD };
}

router.post("/nutrition/food-scan", async (req, res): Promise<void> => {
  const parsed = ScanFoodBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const scanMode = parsed.data.mode ?? "food-log";
  const yoloUrl = process.env.YOLOV11_INFERENCE_URL;

  if (!yoloUrl) {
    if (process.env.DEMO_MODE !== "true") {
      res.status(503).json({
        error: "Food scanning service not configured. Set YOLOV11_INFERENCE_URL to enable AI scanning, or set DEMO_MODE=true for demo data.",
        code: "YOLO_UNAVAILABLE",
      });
      return;
    }
    const allFoods: DetectedFoodRaw[] = scanMode === "pantry"
      ? [
          { name: "Atta (Whole Wheat Flour)", confidence: 0.91, estimatedGrams: 500, nutrition: { calories: 1700, protein: 55, carbs: 360, fat: 10, fiber: 35, iron: 8.5, calcium: 130 } },
          { name: "Toor Dal (Raw)", confidence: 0.88, estimatedGrams: 300, nutrition: { calories: 1050, protein: 63, carbs: 183, fat: 3, fiber: 22, iron: 9.0, calcium: 210 } },
          { name: "Basmati Rice (Raw)", confidence: 0.80, estimatedGrams: 1000, nutrition: { calories: 3500, protein: 68, carbs: 780, fat: 5, fiber: 5, iron: 6.5, calcium: 50 } },
          { name: "Low-Confidence Pantry Item", confidence: 0.42, estimatedGrams: 200, nutrition: { calories: 200, protein: 6, carbs: 40, fat: 1, fiber: 3, iron: 1.0, calcium: 20 } },
        ]
      : [
          { name: "Roti (Whole Wheat)", confidence: 0.89, estimatedGrams: 120, nutrition: { calories: 300, protein: 10, carbs: 60, fat: 3, fiber: 8, iron: 2.5, calcium: 40 } },
          { name: "Dal Tadka", confidence: 0.85, estimatedGrams: 200, nutrition: { calories: 180, protein: 12, carbs: 25, fat: 5, fiber: 7, iron: 3.2, calcium: 60 } },
          { name: "Sabzi (Mixed Vegetable)", confidence: 0.78, estimatedGrams: 150, nutrition: { calories: 120, protein: 4, carbs: 18, fat: 4, fiber: 5, iron: 2.0, calcium: 80 } },
        ];
    const enriched = await enrichFromICMRDB(allFoods);
    res.json({ ...applyConfidenceFilter(enriched), demoMode: true, scanMode });
    return;
  }

  try {
    const response = await fetch(yoloUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: parsed.data.imageBase64, mode: scanMode }),
    });
    const data = await response.json() as {
      detectedFoods?: DetectedFoodRaw[];
      predictions?: Array<{ class?: string; label?: string; name?: string; confidence?: number; score?: number; estimatedGrams?: number }>;
    };

    let foods: DetectedFoodRaw[] | null = null;

    if (Array.isArray(data.detectedFoods)) {
      foods = data.detectedFoods;
    } else if (Array.isArray(data.predictions)) {
      foods = data.predictions.map(p => ({
        name: p.class ?? p.label ?? p.name ?? "Unknown",
        confidence: p.confidence ?? p.score ?? 0.5,
        estimatedGrams: p.estimatedGrams ?? 150,
        nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, iron: 0, calcium: 0 },
      }));
    }

    if (foods !== null) {
      const enriched = await enrichFromICMRDB(foods);
      res.json({ ...applyConfidenceFilter(enriched), scanMode });
    } else {
      res.json({ ...data, scanMode });
    }
  } catch (err) {
    req.log.error({ err }, "YOLOv11 inference failed");
    res.status(502).json({ error: "Food scanning service unavailable" });
  }
});

const COMMON_INDIAN_FOOD_GI: Array<typeof foodGiNutritionTable.$inferInsert> = [
  { name: "White Rice", nameHindi: "सफेद चावल", category: "grain", glycemicIndex: 72, glycemicLoad: 29.0, servingGrams: 150, calories: 193, proteinG: 3.6, carbsG: 42.8, fatG: 0.4, fiberG: 0.4, ironMg: 0.5, calciumMg: 13, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Brown Rice", nameHindi: "ब्राउन चावल", category: "grain", glycemicIndex: 55, glycemicLoad: 21.5, servingGrams: 150, calories: 172, proteinG: 3.5, carbsG: 37.1, fatG: 0.7, fiberG: 1.8, ironMg: 0.8, calciumMg: 10, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Whole Wheat Roti", nameHindi: "गेहूँ की रोटी", category: "grain", glycemicIndex: 62, glycemicLoad: 13.0, servingGrams: 40, calories: 104, proteinG: 3.9, carbsG: 22.0, fatG: 0.6, fiberG: 2.2, ironMg: 1.2, calciumMg: 15, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Bajra Roti", nameHindi: "बाजरे की रोटी", category: "grain", glycemicIndex: 54, glycemicLoad: 11.2, servingGrams: 40, calories: 118, proteinG: 3.1, carbsG: 22.5, fatG: 1.3, fiberG: 1.8, ironMg: 2.1, calciumMg: 11, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Jowar Roti", nameHindi: "ज्वार की रोटी", category: "grain", glycemicIndex: 57, glycemicLoad: 11.8, servingGrams: 40, calories: 117, proteinG: 3.2, carbsG: 24.0, fatG: 0.9, fiberG: 2.0, ironMg: 1.8, calciumMg: 12, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Moong Dal", nameHindi: "मूँग दाल", category: "pulse", glycemicIndex: 31, glycemicLoad: 6.1, servingGrams: 200, calories: 147, proteinG: 10.3, carbsG: 26.8, fatG: 0.4, fiberG: 5.2, ironMg: 2.4, calciumMg: 42, vitaminCMg: 2, source: "ICMR-NIN 2024" },
  { name: "Chana Dal", nameHindi: "चना दाल", category: "pulse", glycemicIndex: 27, glycemicLoad: 4.8, servingGrams: 200, calories: 175, proteinG: 11.0, carbsG: 31.5, fatG: 1.0, fiberG: 7.0, ironMg: 3.0, calciumMg: 49, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Toor Dal", nameHindi: "तुअर दाल", category: "pulse", glycemicIndex: 29, glycemicLoad: 5.5, servingGrams: 200, calories: 152, proteinG: 10.6, carbsG: 26.0, fatG: 0.4, fiberG: 5.7, ironMg: 2.1, calciumMg: 39, vitaminCMg: 1, source: "ICMR-NIN 2024" },
  { name: "Rajma", nameHindi: "राजमा", category: "pulse", glycemicIndex: 29, glycemicLoad: 7.4, servingGrams: 200, calories: 220, proteinG: 15.0, carbsG: 37.2, fatG: 0.5, fiberG: 9.4, ironMg: 4.2, calciumMg: 72, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Chole", nameHindi: "छोले", category: "pulse", glycemicIndex: 28, glycemicLoad: 6.8, servingGrams: 200, calories: 210, proteinG: 12.5, carbsG: 36.8, fatG: 2.6, fiberG: 8.9, ironMg: 4.3, calciumMg: 68, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Potato (Boiled)", nameHindi: "उबला आलू", category: "vegetable", glycemicIndex: 78, glycemicLoad: 15.6, servingGrams: 150, calories: 117, proteinG: 2.5, carbsG: 27.3, fatG: 0.1, fiberG: 1.8, ironMg: 0.8, calciumMg: 10, vitaminCMg: 18, source: "ICMR-NIN 2024" },
  { name: "Sweet Potato", nameHindi: "शकरकंद", category: "vegetable", glycemicIndex: 61, glycemicLoad: 12.4, servingGrams: 150, calories: 129, proteinG: 2.0, carbsG: 30.1, fatG: 0.1, fiberG: 3.5, ironMg: 0.7, calciumMg: 35, vitaminCMg: 22, source: "ICMR-NIN 2024" },
  { name: "Banana", nameHindi: "केला", category: "fruit", glycemicIndex: 51, glycemicLoad: 12.4, servingGrams: 120, calories: 109, proteinG: 1.3, carbsG: 28.2, fatG: 0.3, fiberG: 2.0, ironMg: 0.4, calciumMg: 6, vitaminCMg: 10, source: "ICMR-NIN 2024" },
  { name: "Mango", nameHindi: "आम", category: "fruit", glycemicIndex: 60, glycemicLoad: 9.0, servingGrams: 120, calories: 78, proteinG: 0.6, carbsG: 20.0, fatG: 0.4, fiberG: 1.6, ironMg: 0.1, calciumMg: 10, vitaminCMg: 28, source: "ICMR-NIN 2024" },
  { name: "Apple", nameHindi: "सेब", category: "fruit", glycemicIndex: 36, glycemicLoad: 6.2, servingGrams: 120, calories: 63, proteinG: 0.3, carbsG: 16.8, fatG: 0.2, fiberG: 2.1, ironMg: 0.1, calciumMg: 5, vitaminCMg: 5, source: "ICMR-NIN 2024" },
  { name: "Full Fat Milk", nameHindi: "दूध", category: "dairy", glycemicIndex: 27, glycemicLoad: 3.7, servingGrams: 200, calories: 124, proteinG: 6.4, carbsG: 9.6, fatG: 7.0, fiberG: 0, ironMg: 0.1, calciumMg: 240, vitaminCMg: 2, source: "ICMR-NIN 2024" },
  { name: "Curd (Dahi)", nameHindi: "दही", category: "dairy", glycemicIndex: 36, glycemicLoad: 5.8, servingGrams: 200, calories: 118, proteinG: 8.0, carbsG: 8.6, fatG: 5.6, fiberG: 0, ironMg: 0.2, calciumMg: 270, vitaminCMg: 1, source: "ICMR-NIN 2024" },
  { name: "Paneer", nameHindi: "पनीर", category: "dairy", glycemicIndex: 27, glycemicLoad: 1.0, servingGrams: 100, calories: 265, proteinG: 18.3, carbsG: 4.1, fatG: 20.8, fiberG: 0, ironMg: 0.2, calciumMg: 480, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Oats (Cooked)", nameHindi: "ओट्स", category: "grain", glycemicIndex: 57, glycemicLoad: 13.7, servingGrams: 200, calories: 148, proteinG: 5.4, carbsG: 27.0, fatG: 3.2, fiberG: 3.8, ironMg: 1.6, calciumMg: 19, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Upma (Semolina)", nameHindi: "उपमा", category: "grain", glycemicIndex: 66, glycemicLoad: 14.5, servingGrams: 200, calories: 180, proteinG: 4.8, carbsG: 30.2, fatG: 5.1, fiberG: 1.4, ironMg: 1.0, calciumMg: 18, vitaminCMg: 2, source: "ICMR-NIN 2024" },
  { name: "Idli (2 pieces)", nameHindi: "इडली", category: "grain", glycemicIndex: 69, glycemicLoad: 18.7, servingGrams: 120, calories: 116, proteinG: 4.1, carbsG: 22.9, fatG: 0.4, fiberG: 0.8, ironMg: 0.8, calciumMg: 18, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Dosa", nameHindi: "डोसा", category: "grain", glycemicIndex: 67, glycemicLoad: 14.6, servingGrams: 100, calories: 135, proteinG: 3.8, carbsG: 23.5, fatG: 3.5, fiberG: 0.6, ironMg: 0.9, calciumMg: 15, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Poha (Beaten Rice)", nameHindi: "पोहा", category: "grain", glycemicIndex: 70, glycemicLoad: 21.0, servingGrams: 200, calories: 244, proteinG: 3.8, carbsG: 42.8, fatG: 5.2, fiberG: 1.0, ironMg: 5.3, calciumMg: 18, vitaminCMg: 4, source: "ICMR-NIN 2024" },
  { name: "Ghee", nameHindi: "घी", category: "fat", glycemicIndex: 0, glycemicLoad: 0, servingGrams: 10, calories: 90, proteinG: 0, carbsG: 0, fatG: 10.0, fiberG: 0, ironMg: 0, calciumMg: 0, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Peanuts", nameHindi: "मूँगफली", category: "pulse", glycemicIndex: 14, glycemicLoad: 1.4, servingGrams: 50, calories: 286, proteinG: 12.9, carbsG: 8.8, fatG: 24.4, fiberG: 4.3, ironMg: 1.6, calciumMg: 31, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Almonds", nameHindi: "बादाम", category: "nut", glycemicIndex: 0, glycemicLoad: 0, servingGrams: 30, calories: 174, proteinG: 6.3, carbsG: 5.9, fatG: 15.1, fiberG: 3.5, ironMg: 1.0, calciumMg: 76, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Spinach (Palak)", nameHindi: "पालक", category: "vegetable", glycemicIndex: 15, glycemicLoad: 0.5, servingGrams: 100, calories: 23, proteinG: 2.9, carbsG: 3.6, fatG: 0.4, fiberG: 2.2, ironMg: 2.7, calciumMg: 99, vitaminCMg: 28, source: "ICMR-NIN 2024" },
  { name: "Tomato", nameHindi: "टमाटर", category: "vegetable", glycemicIndex: 15, glycemicLoad: 0.5, servingGrams: 100, calories: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2, fiberG: 1.2, ironMg: 0.4, calciumMg: 10, vitaminCMg: 18, source: "ICMR-NIN 2024" },
  { name: "Egg (Whole)", nameHindi: "अंडा", category: "protein", glycemicIndex: 0, glycemicLoad: 0, servingGrams: 55, calories: 79, proteinG: 6.9, carbsG: 0.4, fatG: 5.5, fiberG: 0, ironMg: 1.0, calciumMg: 28, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Chicken Breast", nameHindi: "चिकन", category: "protein", glycemicIndex: 0, glycemicLoad: 0, servingGrams: 100, calories: 165, proteinG: 31.0, carbsG: 0, fatG: 3.6, fiberG: 0, ironMg: 1.0, calciumMg: 15, vitaminCMg: 0, source: "ICMR-NIN 2024" },
  { name: "Sambar", nameHindi: "सांभर", category: "pulse", glycemicIndex: 35, glycemicLoad: 5.0, servingGrams: 200, calories: 100, proteinG: 5.5, carbsG: 14.0, fatG: 2.2, fiberG: 4.0, ironMg: 1.5, calciumMg: 38, vitaminCMg: 12, source: "ICMR-NIN 2024" },
];

router.get("/nutrition/food-gi", async (req, res): Promise<void> => {
  const search = req.query.search as string | undefined;
  const category = req.query.category as string | undefined;

  let rows = await db.select().from(foodGiNutritionTable);

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.nameHindi ?? "").includes(q)
    );
  }
  if (category) {
    rows = rows.filter(r => r.category === category);
  }

  res.json(rows);
});

router.post("/nutrition/food-gi/seed", async (req, res): Promise<void> => {
  const existing = await db.select({ id: foodGiNutritionTable.id }).from(foodGiNutritionTable);
  if (existing.length > 0) {
    res.json({ message: `Already seeded with ${existing.length} entries`, seeded: false });
    return;
  }
  await db.insert(foodGiNutritionTable).values(COMMON_INDIAN_FOOD_GI);
  res.json({ message: `Seeded ${COMMON_INDIAN_FOOD_GI.length} common Indian food GI entries`, seeded: true });
});

interface PantryVisionItem {
  name: string;
  nameHindi?: string;
  quantity: number;
  unit: string;
  weightGrams: number;
  confidence: number;
}

router.post("/nutrition/pantry-vision", async (req, res): Promise<void> => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  const PANTRY_VISION_PROMPT = `You are an expert Indian pantry analyst. Look at this image of a kitchen pantry, fridge, shelf, or vegetables and identify ALL visible food ingredients.

For each visible item estimate:
- name: English name (e.g. "Tomatoes", "Atta", "Toor Dal")
- nameHindi: Hindi name (e.g. "टमाटर", "आटा", "तुअर दाल")
- quantity: numeric amount (e.g. 4, 0.5, 1, 500)
- unit: kg | g | pieces | litre | ml | bunch | packet | bag
- weightGrams: total estimated weight in grams (e.g. 300, 1000, 500)
- confidence: 0.0 to 1.0

Return ONLY a valid JSON array with no other text:
[
  { "name": "Tomatoes", "nameHindi": "टमाटर", "quantity": 4, "unit": "pieces", "weightGrams": 320, "confidence": 0.92 },
  { "name": "Atta (Whole Wheat Flour)", "nameHindi": "आटा", "quantity": 1, "unit": "kg", "weightGrams": 1000, "confidence": 0.89 }
]

Focus on raw ingredients common in Indian kitchens: vegetables, pulses/dal, grains/atta/rice, spices, oils, dairy (milk/paneer/curd), fruits. Skip unreadable packaged products.`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          { text: PANTRY_VISION_PROMPT },
          { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
        ],
      }],
      config: { maxOutputTokens: 2048 },
    });

    const text = result.text ?? "";
    let items: PantryVisionItem[] = [];
    try {
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = fenceMatch ? fenceMatch[1] : text;
      const arrStart = jsonStr.indexOf("[");
      const arrEnd = jsonStr.lastIndexOf("]");
      if (arrStart !== -1 && arrEnd !== -1) {
        items = JSON.parse(jsonStr.slice(arrStart, arrEnd + 1)) as PantryVisionItem[];
      }
    } catch {
      items = [];
    }

    res.json({ items });
  } catch (err) {
    req.log.error({ err }, "Gemini Vision pantry scan failed");
    res.status(500).json({ error: "Vision scan failed", items: [] });
  }
});

router.post("/nutrition/meal-vision", async (req, res): Promise<void> => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  const MEAL_VISION_PROMPT = `You are an expert Indian nutrition analyst. Look at this photo of a meal/plate of food.

Identify each food item visible on the plate and estimate its quantity and nutrition.

For each item return:
- name: English name (e.g. "Dal Tadka", "Whole Wheat Roti", "Palak Paneer")
- nameHindi: Hindi name
- estimatedGrams: estimated weight in grams
- nutrition: { calories, protein, carbs, fat, fiber, iron } per the estimated grams (not per 100g)
- confidence: 0.0 to 1.0

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "items": [
    { "name": "Dal Tadka", "nameHindi": "दाल तड़का", "estimatedGrams": 200, "nutrition": { "calories": 180, "protein": 10, "carbs": 25, "fat": 5, "fiber": 6, "iron": 2.5 }, "confidence": 0.90 },
    { "name": "Whole Wheat Roti", "nameHindi": "गेहूं की रोटी", "estimatedGrams": 80, "nutrition": { "calories": 200, "protein": 6, "carbs": 40, "fat": 2, "fiber": 4, "iron": 1.5 }, "confidence": 0.88 }
  ],
  "totalNutrition": { "calories": 380, "protein": 16, "carbs": 65, "fat": 7, "fiber": 10, "iron": 4.0 },
  "mealDescription": "A balanced Indian meal with dal and roti providing good protein and complex carbs per ICMR-NIN 2024.",
  "icmrNote": "This meal covers approximately 20% of daily protein needs."
}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          { text: MEAL_VISION_PROMPT },
          { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
        ],
      }],
      config: { maxOutputTokens: 2048, responseMimeType: "application/json" },
    });

    const text = result.text ?? "";
    let parsed: { items?: unknown[]; totalNutrition?: unknown; mealDescription?: string; icmrNote?: string } = {};
    try {
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = fenceMatch ? fenceMatch[1] : text;
      const braceStart = jsonStr.indexOf("{");
      const braceEnd = jsonStr.lastIndexOf("}");
      if (braceStart !== -1 && braceEnd !== -1) {
        parsed = JSON.parse(jsonStr.slice(braceStart, braceEnd + 1)) as typeof parsed;
      }
    } catch {
      parsed = { items: [], totalNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, iron: 0 } };
    }

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Gemini Vision meal scan failed");
    res.status(500).json({ error: "Meal vision scan failed", items: [], totalNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, iron: 0 } });
  }
});

/**
 * POST /nutrition/scan
 * Canonical mode-based scan endpoint.
 *   mode: "pantry" → Gemini Vision ingredient recognition with quantity/weight estimation
 *   mode: "meal"   → Gemini Vision meal-plate nutrition analysis
 */
router.post("/nutrition/scan", async (req, res): Promise<void> => {
  const { imageBase64, mode } = req.body as { imageBase64?: string; mode?: "pantry" | "meal" };
  if (!imageBase64) { res.status(400).json({ error: "imageBase64 required" }); return; }
  if (!mode || (mode !== "pantry" && mode !== "meal")) {
    res.status(400).json({ error: "mode must be 'pantry' or 'meal'" }); return;
  }

  if (mode === "pantry") {
    const PANTRY_PROMPT = `You are an expert Indian pantry analyst. Look at this image and identify ALL visible food ingredients.

For each item return:
- name: English name (e.g. "Tomatoes", "Atta", "Toor Dal")
- nameHindi: Hindi name (e.g. "टमाटर", "आटा", "तुअर दाल")
- quantity: numeric amount (e.g. 4, 0.5, 1, 500)
- unit: kg | g | pieces | litre | ml | bunch | packet | bag
- weightGrams: total estimated weight in grams
- confidence: 0.0 to 1.0

Return ONLY a valid JSON array:
[{ "name": "Tomatoes", "nameHindi": "टमाटर", "quantity": 4, "unit": "pieces", "weightGrams": 320, "confidence": 0.92 }]`;

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: PANTRY_PROMPT }, { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }] }],
        config: { maxOutputTokens: 2048 },
      });
      const text = result.text ?? "";
      let items: PantryVisionItem[] = [];
      try {
        const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = fenceMatch ? fenceMatch[1] : text;
        const s = jsonStr.indexOf("["); const e = jsonStr.lastIndexOf("]");
        if (s !== -1 && e !== -1) items = JSON.parse(jsonStr.slice(s, e + 1)) as PantryVisionItem[];
      } catch { items = []; }
      res.json({ mode: "pantry", items });
    } catch (err) {
      req.log.error({ err }, "Gemini Vision pantry scan failed");
      res.status(500).json({ error: "Pantry scan failed", mode: "pantry", items: [] });
    }
    return;
  }

  // mode === "meal"
  const MEAL_PROMPT = `You are an expert Indian nutrition analyst. Examine this meal photo.

For each visible food item return:
- name: English name (e.g. "Dal Tadka", "Whole Wheat Roti")
- nameHindi: Hindi name
- estimatedGrams: estimated weight in grams
- nutrition: { calories, protein, carbs, fat, fiber, iron } for the estimated grams
- confidence: 0.0 to 1.0

Return ONLY a valid JSON object:
{
  "items": [{ "name": "Dal Tadka", "nameHindi": "दाल तड़का", "estimatedGrams": 200, "nutrition": { "calories": 180, "protein": 10, "carbs": 25, "fat": 5, "fiber": 6, "iron": 2.5 }, "confidence": 0.90 }],
  "totalNutrition": { "calories": 180, "protein": 10, "carbs": 25, "fat": 5, "fiber": 6, "iron": 2.5 },
  "mealDescription": "...",
  "icmrNote": "..."
}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: MEAL_PROMPT }, { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }] }],
      config: { maxOutputTokens: 2048, responseMimeType: "application/json" },
    });
    const text = result.text ?? "";
    let parsed: { items?: unknown[]; totalNutrition?: unknown; mealDescription?: string; icmrNote?: string } = {};
    try {
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = fenceMatch ? fenceMatch[1] : text;
      const s = jsonStr.indexOf("{"); const e = jsonStr.lastIndexOf("}");
      if (s !== -1 && e !== -1) parsed = JSON.parse(jsonStr.slice(s, e + 1)) as typeof parsed;
    } catch { parsed = { items: [], totalNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, iron: 0 } }; }
    res.json({ mode: "meal", ...parsed });
  } catch (err) {
    req.log.error({ err }, "Gemini Vision meal scan failed");
    res.status(500).json({ error: "Meal scan failed", mode: "meal", items: [], totalNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, iron: 0 } });
  }
});

export default router;
