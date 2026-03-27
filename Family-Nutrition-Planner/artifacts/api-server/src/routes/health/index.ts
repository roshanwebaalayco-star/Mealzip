import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db, localDb } from "@workspace/db";
import { healthLogsTable, nutritionLogsTable, familyMembersTable, icmrNinRdaTable } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import { FASTING_CALENDAR, type FastingEntry } from "../../lib/festival-fasting.js";

const router: IRouter = Router();

const HealthLogSchema = z.object({
  familyId: z.number({ required_error: "familyId is required" }).int().positive(),
  memberId: z.number().int().positive().optional(),
  logDate: z.string({ required_error: "logDate is required" }).min(1),
  weightKg: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  bloodSugar: z.number().optional(),
  bloodPressureSystolic: z.number().int().optional(),
  bloodPressureDiastolic: z.number().int().optional(),
  symptoms: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const NutritionLogSchema = z.object({
  familyId: z.number({ required_error: "familyId is required" }).int().positive(),
  memberId: z.number().int().positive().optional(),
  logDate: z.string({ required_error: "logDate is required" }).min(1),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  foodDescription: z.string().optional(),
  calories: z.number().optional(),
  proteinG: z.number().optional(),
  carbsG: z.number().optional(),
  fatG: z.number().optional(),
  fiberG: z.number().optional(),
  ironMg: z.number().optional(),
  calciumMg: z.number().optional(),
  vitaminCMg: z.number().optional(),
  imageUrl: z.string().url().optional(),
  source: z.enum(["manual", "scanner", "ai"]).optional(),
});

const SymptomCheckSchema = z.object({
  symptoms: z.array(z.string()).min(1, "At least one symptom is required"),
  age: z.number().int().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  existingConditions: z.array(z.string()).optional(),
  language: z.enum(["english", "hindi"]).optional(),
});

router.get("/health-logs", async (req, res): Promise<void> => {
  const familyId = parseInt(req.query.familyId as string);
  const memberId = req.query.memberId ? parseInt(req.query.memberId as string) : undefined;
  if (isNaN(familyId)) {
    res.status(400).json({ error: "familyId is required" });
    return;
  }

  const conditions = [eq(healthLogsTable.familyId, familyId)];
  if (memberId) conditions.push(eq(healthLogsTable.memberId, memberId));

  const logs = await db.select().from(healthLogsTable)
    .where(and(...conditions))
    .orderBy(desc(healthLogsTable.logDate));
  res.json(logs);
});

router.post("/health-logs", async (req, res): Promise<void> => {
  const parsed = HealthLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const { familyId, memberId, logDate, weightKg, heightCm, bloodSugar, bloodPressureSystolic, bloodPressureDiastolic, symptoms, notes } = parsed.data;

  let bmi: number | undefined;
  if (weightKg && heightCm) {
    const heightM = heightCm / 100;
    bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
  }

  const [log] = await db.insert(healthLogsTable).values({
    familyId,
    memberId: memberId ?? null,
    logDate: typeof logDate === "string" ? logDate : new Date(logDate).toISOString().split("T")[0],
    weightKg: weightKg ?? null,
    heightCm: heightCm ?? null,
    bmi: bmi ?? null,
    bloodSugar: bloodSugar ?? null,
    bloodPressureSystolic: bloodPressureSystolic ?? null,
    bloodPressureDiastolic: bloodPressureDiastolic ?? null,
    symptoms: symptoms ?? [],
    notes: notes ?? null,
  }).returning();

  res.status(201).json(log);
});

router.get("/nutrition-logs", async (req, res): Promise<void> => {
  const familyId = parseInt(req.query.familyId as string);
  const memberId = req.query.memberId ? parseInt(req.query.memberId as string) : undefined;
  const logDate = req.query.logDate as string | undefined;
  if (isNaN(familyId)) {
    res.status(400).json({ error: "familyId is required" });
    return;
  }

  const conditions = [eq(nutritionLogsTable.familyId, familyId)];
  if (memberId) conditions.push(eq(nutritionLogsTable.memberId, memberId));
  if (logDate) conditions.push(eq(nutritionLogsTable.logDate, logDate));

  const logs = await db.select().from(nutritionLogsTable)
    .where(and(...conditions))
    .orderBy(desc(nutritionLogsTable.logDate));
  res.json(logs);
});

router.post("/nutrition-logs", async (req, res): Promise<void> => {
  const parsed = NutritionLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const { familyId, memberId, logDate, mealType, foodDescription, calories, proteinG, carbsG, fatG, fiberG, ironMg, calciumMg, vitaminCMg, imageUrl, source } = parsed.data;

  const [log] = await db.insert(nutritionLogsTable).values({
    familyId,
    memberId: memberId ?? null,
    logDate: typeof logDate === "string" ? logDate : new Date(logDate).toISOString().split("T")[0],
    mealType: mealType ?? "lunch",
    foodDescription: foodDescription ?? null,
    calories: calories ?? null,
    proteinG: proteinG ?? null,
    carbsG: carbsG ?? null,
    fatG: fatG ?? null,
    fiberG: fiberG ?? null,
    ironMg: ironMg ?? null,
    calciumMg: calciumMg ?? null,
    vitaminCMg: vitaminCMg ?? null,
    imageUrl: imageUrl ?? null,
    source: source ?? "manual",
  }).returning();

  res.status(201).json(log);
});

router.get("/nutrition-summary/:memberId", async (req, res): Promise<void> => {
  const memberId = parseInt(req.params.memberId);
  if (isNaN(memberId)) {
    res.status(400).json({ error: "Invalid memberId" });
    return;
  }

  const [member] = await db.select().from(familyMembersTable).where(eq(familyMembersTable.id, memberId));
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const logs = await db.select().from(nutritionLogsTable)
    .where(and(eq(nutritionLogsTable.memberId, memberId), eq(nutritionLogsTable.logDate, today)));

  const actual = logs.reduce((acc, l) => ({
    calories: acc.calories + (l.calories || 0),
    protein: acc.protein + (l.proteinG || 0),
    carbs: acc.carbs + (l.carbsG || 0),
    fat: acc.fat + (l.fatG || 0),
    fiber: acc.fiber + (l.fiberG || 0),
    iron: acc.iron + (l.ironMg || 0),
    calcium: acc.calcium + (l.calciumMg || 0),
    vitaminC: acc.vitaminC + (l.vitaminCMg || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, vitaminC: 0 });

  const gender = member.gender === "female" ? "female" : "male";
  const activityLevel = member.activityLevel || "moderate";

  const rdaRows = await localDb.select().from(icmrNinRdaTable)
    .where(and(eq(icmrNinRdaTable.gender, gender), eq(icmrNinRdaTable.activityLevel, activityLevel)));

  const rda = rdaRows.find(r => member.age >= r.ageMin && member.age <= r.ageMax)
    || rdaRows.find(r => member.age >= r.ageMin)
    || null;

  res.json({
    member: { id: member.id, name: member.name, age: member.age, gender: member.gender },
    actual,
    target: rda ? {
      calories: rda.calories, protein: rda.proteinG, carbs: rda.carbsG, fat: rda.fatG,
      fiber: rda.fiberG, iron: rda.ironMg, calcium: rda.calciumMg, vitaminC: rda.vitaminCMg,
    } : null,
    date: today,
  });
});

router.post("/symptom-check", async (req, res): Promise<void> => {
  const parsed = SymptomCheckSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const { symptoms, age, gender, existingConditions, language } = parsed.data;

  const lang = language === "hindi" ? "Hindi" : "English";
  const prompt = `You are a nutrition-focused health advisor providing general guidance. IMPORTANT DISCLAIMER: You are NOT a doctor and cannot diagnose medical conditions.

Patient info: Age ${age || "adult"}, Gender ${gender || "unknown"}, Existing conditions: ${(existingConditions || []).join(", ") || "none"}
Symptoms reported: ${symptoms.join(", ")}

Respond in ${lang}. Provide:
1. A brief nutritional angle on these symptoms (e.g., "iron deficiency can cause fatigue")
2. Dietary suggestions that may help
3. When to see a doctor (specific red flags)

CRITICAL: Always include disclaimer that this is nutrition guidance only, not medical diagnosis. Recommend consulting a doctor for any serious symptoms.

Return JSON:
{
  "disclaimer": "This is nutrition guidance only, not medical advice...",
  "nutritionalInsight": "...",
  "dietarySuggestions": ["suggestion 1", "suggestion 2"],
  "recommendedFoods": ["food 1", "food 2"],
  "avoidFoods": ["food to avoid"],
  "seeDoctor": "When to seek medical attention...",
  "urgency": "routine|soon|urgent"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });
    const result = JSON.parse(response.text ?? "{}");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Symptom check failed", details: String(err) });
  }
});

// FASTING_CALENDAR now imported from ../../lib/festival-fasting.js (single source of truth)


router.get("/fasting-calendar", async (req, res): Promise<void> => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
  const memberId = req.query.memberId as string | undefined;

  const SUPPORTED_YEARS = Object.keys(FASTING_CALENDAR).map(Number);
  const calendarDataYear = SUPPORTED_YEARS.includes(year) ? year : 2026;
  const yearData = FASTING_CALENDAR[calendarDataYear] ?? {};
  const monthEntries = yearData[month] ?? [];

  const fastingDays = monthEntries.map((entry) => ({
    date: `${year}-${String(month).padStart(2, "0")}-${String(entry.day).padStart(2, "0")}`,
    day: entry.day,
    name: entry.name,
    nameHindi: entry.nameHindi,
    fastingType: entry.fastingType,
    recommendedFoods: entry.recommendedFoods,
    traditions: entry.traditions,
    memberId: memberId ?? null,
  })).sort((a, b) => a.day - b.day);

  res.json({
    year,
    month,
    dataYear: calendarDataYear,
    isFallbackYear: calendarDataYear !== year,
    fastingDays,
    totalFestivalsInMonth: fastingDays.length,
    note: calendarDataYear !== year
      ? `Fasting dates shown are from ${calendarDataYear} calendar data (2026-only coverage). Actual ${year} dates may differ by 1–2 days. Exact dates vary by regional tradition.`
      : "Dates are based on the Gregorian calendar equivalent of the 2026 Vikram Samvat panchang. Ekadashi tithis use the 11th lunar day of each paksha. Exact dates may vary by regional tradition.",
  });
});

export default router;
