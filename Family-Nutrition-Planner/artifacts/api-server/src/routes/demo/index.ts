import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { familiesTable, familyMembersTable, mealPlansTable, recipesTable } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";

const router: IRouter = Router();

const SHARMA_FAMILY_NAME = "Sharma Family (Demo)";

router.get("/demo/sharma-family", async (req, res): Promise<void> => {
  const [family] = await db.select().from(familiesTable)
    .where(eq(familiesTable.name, SHARMA_FAMILY_NAME));

  if (!family) {
    const seedResult = await seedSharmaFamily();
    res.json(seedResult);
    return;
  }

  const members = await db.select().from(familyMembersTable).where(eq(familyMembersTable.familyId, family.id));
  const [mealPlan] = await db.select().from(mealPlansTable)
    .where(eq(mealPlansTable.familyId, family.id))
    .orderBy(mealPlansTable.createdAt);

  const harmonyScore = mealPlan ? Number(mealPlan.harmonyScore) : 78;

  res.json({
    family: { ...family, members },
    mealPlan: mealPlan || getDemoMealPlan(family.id),
    harmonyScore,
  });
});

router.post("/demo/seed", async (req, res): Promise<void> => {
  const result = await seedSharmaFamily();
  res.json({
    success: true,
    message: "Sharma family demo data seeded successfully",
    familyId: result.family.id,
  });
});

async function seedSharmaFamily() {
  const existing = await db.select().from(familiesTable).where(eq(familiesTable.name, SHARMA_FAMILY_NAME));
  
  if (existing.length > 0) {
    const family = existing[0];
    const members = await db.select().from(familyMembersTable).where(eq(familyMembersTable.familyId, family.id));
    const [mealPlan] = await db.select().from(mealPlansTable).where(eq(mealPlansTable.familyId, family.id));
    return {
      family: { ...family, members },
      mealPlan: mealPlan || getDemoMealPlan(family.id),
      harmonyScore: mealPlan ? Number(mealPlan.harmonyScore) : 78,
    };
  }

  const [family] = await db.insert(familiesTable).values({
    name: SHARMA_FAMILY_NAME,
    state: "Jharkhand",
    city: "Bokaro Steel City",
    monthlyBudget: 5000,
    primaryLanguage: "hindi",
    cuisinePreferences: ["Jharkhand", "North Indian", "Bihari"],
    isDemo: true,
  }).returning();

  const membersData = [
    {
      familyId: family.id, name: "Rajesh Sharma", role: "father", age: 45, gender: "male",
      weightKg: 82, heightCm: 170, activityLevel: "sedentary",
      healthConditions: ["diabetes", "hypertension"], dietaryRestrictions: ["vegetarian"],
      allergies: [], calorieTarget: 1800,
    },
    {
      familyId: family.id, name: "Sunita Sharma", role: "mother", age: 40, gender: "female",
      weightKg: 68, heightCm: 158, activityLevel: "moderate",
      healthConditions: ["obesity"], dietaryRestrictions: ["vegetarian"],
      allergies: [], calorieTarget: 1600,
    },
    {
      familyId: family.id, name: "Arjun Sharma", role: "child", age: 8, gender: "male",
      weightKg: 25, heightCm: 128, activityLevel: "active",
      healthConditions: [], dietaryRestrictions: ["vegetarian"],
      allergies: [], calorieTarget: 1690,
    },
  ];

  const members = await db.insert(familyMembersTable).values(membersData).returning();

  const demoMealPlanData = getDemoMealPlanData();
  const [mealPlan] = await db.insert(mealPlansTable).values({
    familyId: family.id,
    name: "ParivarSehat Demo Week - Sharma Family",
    weekStartDate: new Date().toISOString().split("T")[0],
    harmonyScore: 78,
    totalBudgetEstimate: 1150,
    plan: demoMealPlanData,
    nutritionSummary: { members: members.map(m => ({ name: m.name, role: m.role })) },
    aiInsights: "शर्मा परिवार के लिए यह भोजन योजना ICMR-NIN 2024 मानकों के अनुसार तैयार की गई है। राजेश जी के मधुमेह को ध्यान में रखते हुए कम ग्लाइसेमिक इंडेक्स वाले खाद्य पदार्थ शामिल किए गए हैं। सुनीता जी के वजन प्रबंधन के लिए कम कैलोरी और उच्च फाइबर वाले विकल्प चुने गए हैं। अर्जुन के विकास के लिए पर्याप्त प्रोटीन और कैल्शियम सुनिश्चित किया गया है।",
  }).returning();

  return {
    family: { ...family, members },
    mealPlan: { ...mealPlan, harmonyScore: Number(mealPlan.harmonyScore) },
    harmonyScore: 78,
  };
}

function getDemoMealPlan(familyId: number) {
  return {
    id: 0,
    familyId,
    name: "ParivarSehat Demo Week",
    weekStartDate: new Date().toISOString().split("T")[0],
    harmonyScore: 78,
    totalBudgetEstimate: "1150",
    plan: getDemoMealPlanData(),
    nutritionSummary: null,
    aiInsights: "Demo meal plan loaded",
    createdAt: new Date(),
  };
}

function getDemoMealPlanData() {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const mealsByDay = [
    { breakfast: "Oats Upma / ओट्स उपमा", lunch: "Dal Palak + Brown Rice / दाल पालक + ब्राउन राइस", dinner: "Roti + Mixed Veg Sabzi / रोटी + मिक्स सब्जी", snack: "Makhana (Fox Nuts) / मखाना" },
    { breakfast: "Moong Dal Chilla / मूंग दाल चिल्ला", lunch: "Rajma + Jeera Rice / राजमा + जीरा राइस", dinner: "Chapati + Lauki Sabzi / चपाती + लौकी की सब्जी", snack: "Roasted Chana / भुना चना" },
    { breakfast: "Poha with Vegetables / पोहा", lunch: "Chana Dal + Roti / चना दाल + रोटी", dinner: "Brown Rice + Palak Paneer / ब्राउन राइस + पालक पनीर", snack: "Fruit Salad / फल सलाद" },
    { breakfast: "Idli + Sambar / इडली + सांभर", lunch: "Kadhi + Rice / कढ़ी + चावल", dinner: "Roti + Bhindi Masala / रोटी + भिंडी मसाला", snack: "Buttermilk / छाछ" },
    { breakfast: "Besan Chilla / बेसन चिल्ला", lunch: "Toor Dal + Rice / तुवर दाल + चावल", dinner: "Chapati + Aloo Gobhi / चपाती + आलू गोभी", snack: "Banana / केला" },
    { breakfast: "Dalia Khichdi / दलिया खिचड़ी", lunch: "Chole + Bhatura (small) / छोले + भटूरा", dinner: "Roti + Methi Sabzi / रोटी + मेथी की सब्जी", snack: "Roasted Peanuts / भुनी मूंगफली" },
    { breakfast: "Rava Upma / रवा उपमा", lunch: "Dal Makhani + Rice / दाल मखनी + चावल", dinner: "Khichdi + Dahi / खिचड़ी + दही", snack: "Murmura Chaat / मुरमुरे चाट" },
  ];

  return {
    harmonyScore: 78,
    totalBudgetEstimate: 1150,
    days: days.map((day, i) => ({
      day,
      meals: {
        breakfast: { recipeId: null, recipeName: mealsByDay[i].breakfast, servings: 3, estimatedCost: [45, 52, 38, 60, 41, 55, 48][i % 7] },
        lunch: { recipeId: null, recipeName: mealsByDay[i].lunch, servings: 3, estimatedCost: [85, 110, 72, 95, 105, 78, 90][i % 7] },
        dinner: { recipeId: null, recipeName: mealsByDay[i].dinner, servings: 3, estimatedCost: [70, 90, 65, 88, 75, 95, 80][i % 7] },
        snack: { recipeId: null, recipeName: mealsByDay[i].snack, servings: 3, estimatedCost: [20, 28, 22, 35, 18, 30, 25][i % 7] },
      },
      dailyHarmonyScore: [82, 87, 76, 91, 84, 79, 88][i % 7],
    })),
  };
}

export default router;
