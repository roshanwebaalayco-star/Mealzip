#!/usr/bin/env tsx
import { runConflictEngine } from "../artifacts/api-server/src/engine/conflict-engine.js";
import type {
  Family,
  FamilyMember,
  WeeklyContext,
  MemberWeeklyContext,
  MonthlyBudget,
} from "../artifacts/api-server/src/engine/types.js";
import { localDb, recipesTable } from "@workspace/db";
import { ai } from "../lib/integrations-gemini-ai/src/client.js";

const SEP = "═".repeat(60);

const papa: FamilyMember = {
  id: 1, name: "Papa", age: 52, gender: "male", weight: 85, height: 170,
  activityLevel: "sedentary", dietaryPreference: "vegetarian",
  healthConditions: ["diabetes"], allergies: [],
  medications: [{ name: "Metformin 500mg", dosage: "500mg", timing: "morning with breakfast", condition: "Diabetes" }],
  goal: "manage_condition", ingredientDislikes: [], religiousCulturalRules: null,
  fastingDays: [], spiceTolerance: "medium", feelingThisWeek: "",
  displayOrder: 0
};

const mama: FamilyMember = {
  id: 2, name: "Mama", age: 48, gender: "female", weight: 62, height: 158,
  activityLevel: "moderate", dietaryPreference: "vegetarian",
  healthConditions: ["anaemia"], allergies: [],
  medications: [{ name: "Ferrous Sulphate (Iron)", dosage: "200mg", timing: "night after dinner", condition: "Anaemia" }],
  goal: "manage_condition", ingredientDislikes: [], religiousCulturalRules: null,
  fastingDays: [], spiceTolerance: "medium", feelingThisWeek: "",
  displayOrder: 1
};

const family: Family = {
  id: 1, familyName: "Sharma", city: "Delhi", state: "Delhi", region: "north",
  preferredCuisines: ["north_indian"], cookingTimePreference: "moderate",
  kitchenEquipment: ["gas_stove", "pressure_cooker"],
  members: [papa, mama]
};

const budget: MonthlyBudget = { monthly: 12000, currency: "INR" };

const memberContexts: MemberWeeklyContext[] = [
  { memberId: 1, nonvegDays: [], fastingDays: [] },
  { memberId: 2, nonvegDays: [], fastingDays: [] },
];

const weeklyContext: WeeklyContext = {
  weekStartDate: "2026-04-06",
  memberContexts,
  eatingOutDays: [],
  specialOccasions: [],
  leftoverIngredients: [],
};

async function main() {
  console.log(`\n${SEP}`);
  console.log("  NutriNext E2E Pipeline Integration Test");
  console.log(SEP);

  console.log("\nSTAGE 1: Conflict Engine");
  const t1 = Date.now();
  const packet = runConflictEngine(family, budget, weeklyContext, []);
  console.log(`  ✅ Completed in ${Date.now() - t1}ms`);
  console.log(`  Harmony Score: ${packet.harmonyScore.total}/100`);
  console.log(`  Conflicts: ${packet.conflicts.length}`);
  console.log(`  Medical guardrails: ${packet.medicalLaws.length}`);
  console.log(`  Profiles: ${packet.effectiveProfiles.map(p => `${p.name}(${p.effectiveCalories}kcal)`).join(", ")}`);

  console.log("\nSTAGE 2: Recipe Database Query");
  const t2 = Date.now();
  const recipes = await localDb.select().from(recipesTable).limit(20);
  console.log(`  ✅ Completed in ${Date.now() - t2}ms`);
  console.log(`  Recipes: ${recipes.length}`);
  console.log(`  Sample: ${recipes.slice(0, 3).map(r => r.name).join(", ")}`);

  console.log("\nSTAGE 3: Gemini AI — Staples Generation");
  const t3 = Date.now();
  const staplesPrompt = `You are a nutritionist for a 2-person Indian vegetarian family in Delhi.
Weekly budget: ₹3000. Members: Papa (52y, diabetic, 1953 kcal/day), Mama (48y, anaemia, 1631 kcal/day).
Generate a weekly staples grocery list. Return ONLY valid JSON, no markdown:
{ "items": [ { "name": "Toor Dal", "quantity": 2, "unit": "kg", "estimated_price": 240, "category": "dal", "purchased": false, "notes": "For daily dal" } ], "total_estimated_cost": 3000 }
Include 10-15 items: dals, rice, atta, oil, spices, sugar, tea, milk.`;

  const staplesResp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: staplesPrompt }] }],
    config: { maxOutputTokens: 4096, temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } }
  });
  const staplesText = (staplesResp.text || "").replace(/^```json\s*/im, "").replace(/```\s*$/im, "").trim();
  const staples = JSON.parse(staplesText);
  console.log(`  ✅ Completed in ${Date.now() - t3}ms`);
  console.log(`  Items: ${staples.items.length}, Total: ₹${staples.total_estimated_cost}`);
  for (const item of staples.items.slice(0, 5)) {
    console.log(`    • ${item.name}: ${item.quantity} ${item.unit} — ₹${item.estimated_price}`);
  }

  console.log("\nSTAGE 4: Gemini AI — Single Day Meal Plan");
  const t4 = Date.now();
  const dayPrompt = `You are a nutritionist. Generate ONE DAY meal plan (Monday) for:
- Papa (52y male, 1953 kcal/day, diabetic on Metformin — needs substantial breakfast)
- Mama (48y female, 1631 kcal/day, anaemia — no dairy/tea at breakfast, needs Vitamin C source)
North Indian vegetarian cuisine. Return ONLY valid JSON, no markdown:
{ "day": "Monday", "meals": [
  { "slot": "breakfast", "dish_name": "Poha with Lemon", "cooking_time_min": 20,
    "member_plates": [
      { "member_id": "papa", "calories": 550, "portion": "1.5 cups" },
      { "member_id": "mama", "calories": 420, "portion": "1 cup with amla juice" }
    ] },
  { "slot": "lunch", "dish_name": "...", "cooking_time_min": 30, "member_plates": [...] },
  { "slot": "dinner", "dish_name": "...", "cooking_time_min": 30, "member_plates": [...] }
] }`;

  const dayResp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: dayPrompt }] }],
    config: { maxOutputTokens: 4096, temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } }
  });
  const dayText = (dayResp.text || "").replace(/^```json\s*/im, "").replace(/```\s*$/im, "").trim();
  const dayPlan = JSON.parse(dayText);
  console.log(`  ✅ Completed in ${Date.now() - t4}ms`);
  for (const meal of dayPlan.meals) {
    const cals = meal.member_plates.map((p: any) => `${p.member_id}:${p.calories}kcal`).join(", ");
    console.log(`  ${meal.slot}: ${meal.dish_name} → ${cals}`);
  }

  const totalMs = Date.now() - t1;
  console.log(`\n${SEP}`);
  console.log(`  ALL 4 STAGES PASSED ✅`);
  console.log(`  Total time: ${totalMs}ms (${(totalMs / 1000).toFixed(1)}s)`);
  console.log(SEP);

  process.exit(0);
}

main().catch(err => {
  console.error("\n❌ PIPELINE FAILED:", err.message || err);
  process.exit(1);
});
