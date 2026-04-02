/**
 * FILE: server/lib/assembleContext.ts
 * PURPOSE: Assembles the complete "State Payload" context string that is injected
 *          into every Gemini call. Gemini NEVER operates on raw user messages alone.
 *
 * ADAPTED for NutriNext schema:
 *  - familyMembersTable: healthConditions (jsonb), dietaryType (text), no "role" field
 *  - mealPlansTable: days (jsonb), nutritionalSummary (jsonb) — no per-meal columns
 *  - nutritionLogsTable: replaces "foodLogs" — columns: logDate, mealType, foodDescription,
 *    calories, proteinG, carbsG, fatG, fiberG, ironMg, calciumMg, vitaminCMg
 *  - memberWeeklyContextsTable.activeMedications (jsonb) — replaces "medications" table
 */

import { db, familyMembersTable, mealPlansTable, nutritionLogsTable, memberWeeklyContextsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { runRagSearch, formatRagChunksForPrompt } from "./ragSearch.js";

interface FamilyMember {
  id: number;
  name: string;
  age: number;
  conditions: string[];
  dietaryType: string;
}

interface MealPlanDay {
  day: string;
  meals?: Record<string, unknown>;
  [key: string]: unknown;
}

interface NutritionLog {
  memberName: string;
  logDate: string;
  mealType: string;
  foodDescription: string;
  calories: number;
  carbsG: number;
  fatG: number;
  proteinG: number;
}

interface MedicationEntry {
  memberName: string;
  drugName: string;
  dosage: string;
  timings: string[];
  interactions: string[];
}

export interface AssembledContext {
  contextString: string;
  hasMedications: boolean;
  memberCount: number;
}

function getTodayDateString(): string {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function getSevenDaysAgoDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function safeParseJson<T>(value: unknown, fallback: T): T {
  if (Array.isArray(value)) return value as unknown as T;
  if (value !== null && typeof value === "object") return value as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function assembleChatContext(
  familyId: number,
  userMessage: string
): Promise<AssembledContext> {
  if (!Number.isInteger(familyId) || familyId <= 0) {
    throw new Error(`Invalid familyId: ${familyId}`);
  }

  const today = getTodayDateString();
  const sevenDaysAgo = getSevenDaysAgoDateString();

  const [membersRaw, mealPlanRaw, logsRaw, weeklyContextsRaw, ragChunks] =
    await Promise.all([
      db
        .select()
        .from(familyMembersTable)
        .where(eq(familyMembersTable.familyId, familyId)),

      db
        .select()
        .from(mealPlansTable)
        .where(eq(mealPlansTable.familyId, familyId))
        .orderBy(desc(mealPlansTable.createdAt))
        .limit(1),

      db
        .select({
          id:              nutritionLogsTable.id,
          memberId:        nutritionLogsTable.memberId,
          logDate:         nutritionLogsTable.logDate,
          mealType:        nutritionLogsTable.mealType,
          foodDescription: nutritionLogsTable.foodDescription,
          calories:        nutritionLogsTable.calories,
          proteinG:        nutritionLogsTable.proteinG,
          carbsG:          nutritionLogsTable.carbsG,
          fatG:            nutritionLogsTable.fatG,
        })
        .from(nutritionLogsTable)
        .where(
          and(
            eq(nutritionLogsTable.familyId, familyId),
            gte(nutritionLogsTable.logDate, sevenDaysAgo)
          )
        )
        .orderBy(desc(nutritionLogsTable.logDate))
        .limit(20),

      db
        .select()
        .from(memberWeeklyContextsTable)
        .limit(50),

      runRagSearch(userMessage, 4, 0.75),
    ]);

  const memberMap = new Map<number, FamilyMember>();

  const processedMembers: FamilyMember[] = (membersRaw as any[]).map((m) => {
    const member: FamilyMember = {
      id:          m.id,
      name:        m.name ?? "Unknown",
      age:         m.age ?? 0,
      conditions:  safeParseJson<string[]>(m.healthConditions, []),
      dietaryType: m.dietaryType ?? "vegetarian",
    };
    memberMap.set(m.id, member);
    return member;
  });

  const rawPlan = (mealPlanRaw as any[])[0];
  const days: MealPlanDay[] = rawPlan ? safeParseJson<MealPlanDay[]>(rawPlan.days, []) : [];

  const memberIds = new Set(processedMembers.map(m => m.id));
  const relevantContexts = (weeklyContextsRaw as any[]).filter(
    (ctx) => memberIds.has(ctx.familyMemberId)
  );

  const processedMeds: MedicationEntry[] = [];
  for (const ctx of relevantContexts) {
    const meds = safeParseJson<any[]>(ctx.activeMedications, []);
    const memberName = memberMap.get(ctx.familyMemberId)?.name ?? "Unknown member";
    for (const med of meds) {
      if (typeof med === "string") {
        processedMeds.push({
          memberName,
          drugName: med,
          dosage: "standard",
          timings: [],
          interactions: [],
        });
      } else if (med && typeof med === "object") {
        processedMeds.push({
          memberName,
          drugName: med.drugName ?? med.name ?? "Unknown drug",
          dosage: med.dosage ?? "standard",
          timings: safeParseJson<string[]>(med.timings, []),
          interactions: safeParseJson<string[]>(med.interactions, []),
        });
      }
    }
  }

  const processedLogs: NutritionLog[] = (logsRaw as any[]).map((log) => ({
    memberName:      memberMap.get(log.memberId)?.name ?? "Unknown member",
    logDate:         log.logDate ?? "Unknown date",
    mealType:        log.mealType ?? "meal",
    foodDescription: log.foodDescription ?? "Unnamed meal",
    calories:        log.calories ?? 0,
    carbsG:          log.carbsG ?? 0,
    fatG:            log.fatG ?? 0,
    proteinG:        log.proteinG ?? 0,
  }));

  const contextParts: string[] = [];

  if (processedMembers.length > 0) {
    const lines = processedMembers.map(
      (m) =>
        `  - ${m.name} | Age: ${m.age} | Diet: ${m.dietaryType}` +
        (m.conditions.length > 0
          ? ` | Conditions: ${m.conditions.join(", ")}`
          : "")
    );
    contextParts.push(`### FAMILY PROFILE\n${lines.join("\n")}`);
  } else {
    contextParts.push("### FAMILY PROFILE\nNo family members found for this account.");
  }

  if (days.length > 0) {
    const dayLines = days.map((d) => `  - ${d.day}: ${JSON.stringify(d.meals ?? d)}`);
    contextParts.push(`### TODAY'S MEAL PLAN\n${dayLines.join("\n")}`);
  } else {
    contextParts.push(
      `### TODAY'S MEAL PLAN\nNo meal plan found for today (${today}). Suggest meals appropriate for the family profile.`
    );
  }

  if (processedLogs.length > 0) {
    const lines = processedLogs.map(
      (log) =>
        `  - [${log.logDate}] ${log.memberName} — ${log.mealType}: ${log.foodDescription}` +
        ` (${log.calories} kcal | ${log.proteinG}g protein | ${log.fatG}g fat | ${log.carbsG}g carbs)`
    );
    contextParts.push(`### RECENT FOOD LOGS (Last 7 Days)\n${lines.join("\n")}`);
  } else {
    contextParts.push("### RECENT FOOD LOGS\nNo food logs recorded in the last 7 days.");
  }

  if (processedMeds.length > 0) {
    const lines = processedMeds.map(
      (med) =>
        `  - ${med.memberName} takes ${med.drugName} (${med.dosage})` +
        (med.timings.length > 0 ? ` at: ${med.timings.join(", ")}` : " — timing not logged") +
        (med.interactions.length > 0
          ? ` | Food interactions: ${med.interactions.join("; ")}`
          : "")
    );
    contextParts.push(`### MEDICATION RULES\n${lines.join("\n")}`);
  } else {
    contextParts.push("### MEDICATION RULES\nNo active medications on record.");
  }

  const ragText = formatRagChunksForPrompt(ragChunks);
  contextParts.push(
    ragText || "### ICMR EVIDENCE\nNo relevant ICMR-NIN guidelines found for this specific query."
  );

  const timeStr = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "Asia/Kolkata",
  });
  contextParts.push(`### CURRENT TIME (IST)\n  ${timeStr} on ${today}`);

  return {
    contextString:   contextParts.join("\n\n"),
    hasMedications:  processedMeds.length > 0,
    memberCount:     processedMembers.length,
  };
}
