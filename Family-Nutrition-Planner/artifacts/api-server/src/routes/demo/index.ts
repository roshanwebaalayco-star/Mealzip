import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { familiesTable, familyMembersTable, mealPlansTable, usersTable, healthLogsTable } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import { getJwtSecret, type AuthPayload } from "../../middlewares/auth.js";

const router: IRouter = Router();

const SHARMA_FAMILY_NAME = "Sharma Family (Demo)";
const DEMO_EMAIL = "demo@parivarsehat.ai";
const DEMO_PASSWORD = "DemoJudge2025!";
const TOKEN_EXPIRY = "7d";

function requireDemoMode(res: import("express").Response): boolean {
  if (process.env.DEMO_MODE !== "true") {
    res.status(403).json({ error: "Demo mode is not available in this environment", retryable: false });
    return false;
  }
  return true;
}

router.get("/demo/instant", async (_req, res): Promise<void> => {
  if (!requireDemoMode(res)) return;
  try {
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, DEMO_EMAIL));
    if (!user) {
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
      [user] = await db.insert(usersTable).values({
        email: DEMO_EMAIL,
        passwordHash,
        name: "Demo Judge",
        primaryLanguage: "hindi",
      }).returning();
    }

    const seedResult = await seedSharmaFamily(user.id);

    const token = jwt.sign(
      { userId: user.id, email: user.email } satisfies AuthPayload,
      getJwtSecret(),
      { expiresIn: "8h" },
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, primaryLanguage: user.primaryLanguage, createdAt: user.createdAt },
      family: seedResult.family,
      mealPlan: seedResult.mealPlan,
      harmonyScore: seedResult.harmonyScore,
      message: "Demo ready — no signup needed! Loaded Sharma family with full AI meal plan.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Demo instant login failed", details: msg, retryable: true });
  }
});

router.post("/demo/quick-login", async (req, res): Promise<void> => {
  if (!requireDemoMode(res)) return;
  try {
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, DEMO_EMAIL));
    if (!user) {
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
      [user] = await db.insert(usersTable).values({
        email: DEMO_EMAIL,
        passwordHash,
        name: "Demo Judge",
        primaryLanguage: "hindi",
      }).returning();
    }

    const seedResult = await seedSharmaFamily(user.id);

    const token = jwt.sign(
      { userId: user.id, email: user.email } satisfies AuthPayload,
      getJwtSecret(),
      { expiresIn: TOKEN_EXPIRY }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, primaryLanguage: user.primaryLanguage, createdAt: user.createdAt },
      family: seedResult.family,
      mealPlan: seedResult.mealPlan,
      harmonyScore: seedResult.harmonyScore,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Demo login failed", details: msg, retryable: true });
  }
});

router.get("/demo/sharma-family", async (req, res): Promise<void> => {
  if (!requireDemoMode(res)) return;
  try {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to fetch demo family", details: msg, retryable: true });
  }
});

router.post("/demo/seed", async (req, res): Promise<void> => {
  if (!requireDemoMode(res)) return;
  try {
    const result = await seedSharmaFamily();
    res.json({
      success: true,
      message: "Sharma family demo data seeded successfully",
      familyId: result.family.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Demo seed failed", details: msg, retryable: true });
  }
});

async function seedSharmaFamily(userId?: number) {
  const existing = await db.select().from(familiesTable).where(eq(familiesTable.name, SHARMA_FAMILY_NAME));
  
  if (existing.length > 0) {
    const family = existing[0];
    if (userId && family.userId !== userId) {
      await db.update(familiesTable).set({ userId }).where(eq(familiesTable.id, family.id));
    }
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
    userId: userId ?? null,
    stateRegion: "Jharkhand",
    languagePreference: "hindi",
    householdDietaryBaseline: "mixed",
    mealsPerDay: "3_meals",
    cookingSkillLevel: "intermediate",
    appliances: ["tawa", "pressure_cooker", "kadai", "blender_mixie"],
  }).returning();

  const membersData = [
    {
      familyId: family.id, name: "Rajesh Sharma", age: 45, gender: "male",
      weightKg: "82", heightCm: "170", activityLevel: "sedentary",
      dietaryType: "strictly_vegetarian", dailyCalorieTarget: 1800,
      healthConditions: ["diabetes", "hypertension"], allergies: [], ingredientDislikes: [],
      spiceTolerance: "medium", displayOrder: 0,
    },
    {
      familyId: family.id, name: "Sunita Sharma", age: 40, gender: "female",
      weightKg: "68", heightCm: "158", activityLevel: "moderately_active",
      dietaryType: "strictly_vegetarian", dailyCalorieTarget: 1600,
      healthConditions: ["obesity"], allergies: [], ingredientDislikes: [],
      spiceTolerance: "medium", displayOrder: 1,
    },
    {
      familyId: family.id, name: "Arjun Sharma", age: 8, gender: "male",
      weightKg: "25", heightCm: "128", activityLevel: "very_active",
      dietaryType: "strictly_vegetarian", dailyCalorieTarget: 1690,
      healthConditions: [], allergies: [], ingredientDislikes: [],
      spiceTolerance: "mild", primaryGoal: "healthy_growth", displayOrder: 2,
    },
  ];

  const members = await db.insert(familyMembersTable).values(membersData).returning();

  const demoMealPlanData = getDemoMealPlanData();
  const [mealPlan] = await db.insert(mealPlansTable).values({
    familyId: family.id,
    harmonyScore: 78,
    generationStatus: "completed",
    days: demoMealPlanData,
    nutritionalSummary: { members: members.map(m => ({ name: m.name, dietaryType: m.dietaryType })) },
  }).returning();

  await seedDemoHealthLogs(family.id, members);

  return {
    family: { ...family, members },
    mealPlan: { ...mealPlan, harmonyScore: Number(mealPlan.harmonyScore) },
    harmonyScore: 78,
  };
}

async function seedDemoHealthLogs(familyId: number, members: { id: number; name: string }[]) {
  try {
    const existing = await db.select({ id: healthLogsTable.id }).from(healthLogsTable).where(eq(healthLogsTable.familyId, familyId));
    if (existing.length > 0) return;

    const rajesh = members.find(m => m.name.includes("Rajesh"));
    const sunita = members.find(m => m.name.includes("Sunita"));
    if (!rajesh || !sunita) return;

    const logs: Array<{
      familyId: number; memberId: number; logDate: string;
      weightKg: string | null; bloodSugar: string | null;
      bloodPressureSystolic: number | null; bloodPressureDiastolic: number | null;
    }> = [];

    const today = new Date();
    for (let week = 7; week >= 0; week--) {
      const d = new Date(today);
      d.setDate(d.getDate() - week * 7);
      const dateStr = d.toISOString().slice(0, 10);

      logs.push({
        familyId, memberId: rajesh.id, logDate: dateStr,
        weightKg: String(82 - week * 0.3),
        bloodSugar: String(145 - week * 2 + Math.round(Math.random() * 10 - 5)),
        bloodPressureSystolic: 142 - week * 1,
        bloodPressureDiastolic: 88 - week * 0.5 | 0,
      });

      logs.push({
        familyId, memberId: sunita.id, logDate: dateStr,
        weightKg: String(68 - week * 0.4),
        bloodSugar: String(105 + Math.round(Math.random() * 6 - 3)),
        bloodPressureSystolic: 128 - week * 0.5 | 0,
        bloodPressureDiastolic: 82,
      });
    }

    await db.insert(healthLogsTable).values(logs);
  } catch { /* non-critical */ }
}

function getDemoMealPlan(familyId: number) {
  return {
    id: 0,
    familyId,
    harmonyScore: 78,
    generationStatus: "completed",
    days: getDemoMealPlanData(),
    nutritionalSummary: null,
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

  return days.map((day, i) => ({
    day,
    meals: {
      breakfast: { recipeId: null, recipeName: mealsByDay[i].breakfast, servings: 3, estimatedCost: [45, 52, 38, 60, 41, 55, 48][i % 7] },
      lunch: { recipeId: null, recipeName: mealsByDay[i].lunch, servings: 3, estimatedCost: [85, 110, 72, 95, 105, 78, 90][i % 7] },
      dinner: { recipeId: null, recipeName: mealsByDay[i].dinner, servings: 3, estimatedCost: [70, 90, 65, 88, 75, 95, 80][i % 7] },
      snack: { recipeId: null, recipeName: mealsByDay[i].snack, servings: 3, estimatedCost: [20, 28, 22, 35, 18, 30, 25][i % 7] },
    },
    dailyHarmonyScore: [82, 87, 76, 91, 84, 79, 88][i % 7],
  }));
}

export default router;
