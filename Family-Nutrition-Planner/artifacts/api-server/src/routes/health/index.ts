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
  const prompt = `You are a nutrition-focused health advisor providing general guidance. You are NOT a doctor and cannot diagnose medical conditions.

Patient info: Age ${age || "adult"}, Gender ${gender || "unknown"}, Existing conditions: ${(existingConditions || []).join(", ") || "none"}
Symptoms reported: ${symptoms.join(", ")}

Respond in ${lang}. Be concise but ensure every field has meaningful content.

Return ONLY valid JSON with these exact fields:
{
  "nutritionalInsight": "Two to three sentences explaining the nutritional connection to these symptoms.",
  "dietarySuggestions": ["actionable dietary change 1", "actionable dietary change 2", "actionable dietary change 3"],
  "recommendedFoods": ["Specific Indian food 1", "Specific Indian food 2", "Specific Indian food 3", "Specific Indian food 4"],
  "avoidFoods": ["Food to avoid 1", "Food to avoid 2", "Food to avoid 3"],
  "seeDoctor": "• Warning sign 1\\n• Warning sign 2\\n• Warning sign 3",
  "urgency": "routine|soon|urgent"
}

STRICT RULES:
- EVERY field must be non-empty. nutritionalInsight must be at least 2 sentences. Each array must have at least 2 items.
- recommendedFoods and avoidFoods: use Indian food names and brief phrases (not full sentences). Prefer locally available foods.
- dietarySuggestions: practical, actionable advice (e.g., "Eat iron-rich greens like palak daily", "Add lemon to meals for better iron absorption").
- seeDoctor: bullet points separated by \\n, each starting with "•". List specific warning signs that should trigger a doctor visit.
- URGENCY CALIBRATION (follow strictly):
  * "routine" = common single symptoms like headache, mild fatigue, occasional bloating. Most single-symptom cases are routine.
  * "soon" = multiple symptoms together suggesting a deficiency pattern, or symptoms lasting over a week.
  * "urgent" = symptoms suggesting serious conditions: severe chest pain, sudden vision changes, high fever with weakness, unexplained rapid weight loss.
  A single headache or mild symptom should NEVER be "urgent".
- Do NOT include a disclaimer field.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });
    const raw = response.text ?? "{}";
    const result = JSON.parse(raw);
    const fallback = {
      nutritionalInsight: result.nutritionalInsight || "Could not generate insight. Please try again.",
      dietarySuggestions: Array.isArray(result.dietarySuggestions) && result.dietarySuggestions.length > 0 ? result.dietarySuggestions : ["Maintain a balanced diet", "Stay hydrated"],
      recommendedFoods: Array.isArray(result.recommendedFoods) && result.recommendedFoods.length > 0 ? result.recommendedFoods : ["Fresh fruits", "Green vegetables"],
      avoidFoods: Array.isArray(result.avoidFoods) && result.avoidFoods.length > 0 ? result.avoidFoods : ["Processed foods", "Excessive sugar"],
      seeDoctor: result.seeDoctor || "• If symptoms persist for more than a week\n• If symptoms worsen suddenly",
      urgency: ["routine", "soon", "urgent"].includes(result.urgency) ? result.urgency : "routine",
    };
    res.json(fallback);
  } catch (err) {
    res.status(500).json({ error: "Symptom check failed", details: String(err) });
  }
});

// FASTING_CALENDAR now imported from ../../lib/festival-fasting.js (single source of truth)

/**
 * Approximate Ekadashi dates for any Gregorian month/year.
 * Uses mean lunar cycle (29.53058867 days) anchored to 2026-01-29 UTC new moon.
 * Derives a cycle-index window from the target month so it works for any year.
 */
function computeEkadashiDates(year: number, month: number): { day: number; name: string; nameHindi: string }[] {
  const LUNAR_CYCLE_DAYS = 29.53058867;
  const LUNAR_CYCLE_MS = LUNAR_CYCLE_DAYS * 86400_000;
  const TITHI_MS = (LUNAR_CYCLE_DAYS / 30) * 86400_000;

  const anchorNewMoon = new Date("2026-01-29T00:00:00Z").getTime();
  const targetStart = new Date(Date.UTC(year, month - 1, 1)).getTime();
  const targetEnd   = new Date(Date.UTC(year, month, 1)).getTime();

  // Compute the approximate index of the nearest new moon to targetStart
  const centerIndex = Math.round((targetStart - anchorNewMoon) / LUNAR_CYCLE_MS);

  const results: { day: number; name: string; nameHindi: string }[] = [];

  // Scan 3 cycles around the center to catch all Ekadashis in the target month
  for (let i = centerIndex - 2; i <= centerIndex + 2; i++) {
    const newMoonMs = anchorNewMoon + i * LUNAR_CYCLE_MS;
    const pairs = [
      { ms: newMoonMs + 11 * TITHI_MS, name: "Ekadashi (Shukla Paksha, estimated)", nameHindi: "एकादशी (शुक्ल पक्ष, अनुमानित)" },
      { ms: newMoonMs + 26 * TITHI_MS, name: "Ekadashi (Krishna Paksha, estimated)", nameHindi: "एकादशी (कृष्ण पक्ष, अनुमानित)" },
    ];
    for (const p of pairs) {
      if (p.ms >= targetStart && p.ms < targetEnd) {
        const day = new Date(p.ms).getUTCDate();
        // De-duplicate dates within 1-day tolerance (tithi drift)
        if (!results.some(r => Math.abs(r.day - day) <= 1)) {
          results.push({ day, name: p.name, nameHindi: p.nameHindi });
        }
      }
    }
  }

  return results.sort((a, b) => a.day - b.day);
}

router.get("/fasting-calendar", async (req, res): Promise<void> => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
  const memberId = req.query.memberId as string | undefined;

  const SUPPORTED_YEARS = Object.keys(FASTING_CALENDAR).map(Number);
  const isFallbackYear = !SUPPORTED_YEARS.includes(year);

  if (isFallbackYear) {
    const generalFastingDays = computeEkadashiDates(year, month).map(e => ({
      date: `${year}-${String(month).padStart(2, "0")}-${String(e.day).padStart(2, "0")}`,
      day: e.day,
      name: e.name,
      nameHindi: e.nameHindi,
      fastingType: "partial" as const,
      recommendedFoods: ["Fruits", "Milk", "Sabudana Khichdi", "Makhane ki Kheer", "Nuts"],
      traditions: ["Hindu"],
      isEstimated: true,
      memberId: memberId ?? null,
    }));

    res.json({
      year,
      month,
      dataYear: null,
      isFallbackYear: true,
      isFestivalFasting: false,
      festivals: [],
      fastingDays: [],
      generalFastingDays,
      totalFestivalsInMonth: 0,
      message: `Exact festival dates for ${year} are not yet in our dataset. Showing approximate Ekadashi dates computed from the lunar calendar. Actual dates may vary by 1–2 days by regional tradition.`,
      note: `Festival data unavailable for ${year}. Ekadashi dates are mathematically estimated.`,
    });
    return;
  }

  const yearData = FASTING_CALENDAR[year] ?? {};
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
    dataYear: year,
    isFallbackYear: false,
    isFestivalFasting: fastingDays.some(d => d.fastingType !== "none"),
    festivals: fastingDays,
    fastingDays,
    generalFastingDays: [],
    totalFestivalsInMonth: fastingDays.length,
    message: null,
    note: "Dates are based on the Gregorian calendar equivalent of the 2026 Vikram Samvat panchang. Ekadashi tithis use the 11th lunar day of each paksha. Exact dates may vary by regional tradition.",
  });
});

export default router;
