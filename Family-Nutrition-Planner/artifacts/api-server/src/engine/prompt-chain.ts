import type {
  ConstraintPacket,
  EffectiveMemberProfile,
  GroceryItem,
  DayPlan,
  PromptChainResult,
  PromptChainTimings,
  NutritionalSummary,
  PantryItem,
} from "./types";
import { cookingTimeToConstraintString } from "./budget-engine";
import { buildMemberModifierMap, buildModifierInjectionSection } from "./one-many-plates";
import { T1D_MANDATORY_GROCERY_ITEMS } from "./clinical/type1Diabetes";

import { ai } from "@workspace/integrations-gemini-ai";

const GEMINI_MODEL = "gemini-2.5-flash";

async function callGemini(prompt: string, maxOutputTokens = 8192): Promise<string> {
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      maxOutputTokens,
      temperature: 0.3,
      topP: 0.8,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const rawText: string =
    (response as any).text ??
    response.candidates?.[0]?.content?.parts?.[0]?.text ??
    "";

  if (!rawText) {
    const finishReason = response.candidates?.[0]?.finishReason;
    throw new Error(
      `Gemini returned empty response. Finish reason: ${finishReason ?? "unknown"}. ` +
      `This may indicate a safety filter or token limit was hit.`
    );
  }

  return rawText
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();
}

function repairTruncatedJSON(raw: string): string {
  let s = raw.trim();
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') openBraces++;
    if (ch === '}') openBraces--;
    if (ch === '[') openBrackets++;
    if (ch === ']') openBrackets--;
  }

  if (inString) s += '"';

  const lastComplete = Math.max(s.lastIndexOf('},'), s.lastIndexOf('}]'));
  if (lastComplete > 0 && (openBraces > 0 || openBrackets > 0)) {
    s = s.slice(0, lastComplete + 1);
    openBraces = 0; openBrackets = 0;
    inString = false; escape = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') openBraces++;
      if (ch === '}') openBraces--;
      if (ch === '[') openBrackets++;
      if (ch === ']') openBrackets--;
    }
  }

  while (openBrackets > 0) { s += ']'; openBrackets--; }
  while (openBraces > 0) { s += '}'; openBraces--; }

  return s;
}

function safeParseJSON<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (_firstErr) {
    const repaired = repairTruncatedJSON(raw);
    try {
      console.warn(`[PromptChain] Repaired truncated JSON for "${label}" (original ${raw.length} chars → ${repaired.length} chars)`);
      return JSON.parse(repaired) as T;
    } catch (err) {
      throw new Error(
        `[PromptChain] Failed to parse Gemini JSON for "${label}". ` +
        `Model: ${GEMINI_MODEL}. ` +
        `Parse error: ${(err as Error).message}. ` +
        `First 500 chars of response: ${raw.slice(0, 500)}`
      );
    }
  }
}

function buildFamilyContextSection(packet: ConstraintPacket): string {
  const { family, effectiveProfiles } = packet;

  const memberLines = effectiveProfiles
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((p) => {
      const conditions = p.effectiveHealthConditions.filter((c) => c !== "none").join(", ") || "none";
      const allergies = p.allergies.filter((a) => a !== "none").join(", ") || "none";
      const meds =
        p.activeMedications.length > 0
          ? p.activeMedications.map((m) => `${m.name} (${m.timing})`).join(", ")
          : "none";
      const dislikes = p.ingredientDislikes.join(", ") || "none";
      const fasting = p.effectiveFastingDays.join(", ") || "none";
      const religious = p.religiousCulturalRules?.type ?? "none";
      const feeling = p.feelingThisWeek ? `Feeling this week: "${p.feelingThisWeek}".` : "";
      const flagLabels = [
        p.isChildUnder5 ? "INFANT/TODDLER" : "",
        p.isSchoolAge ? "SCHOOL AGE" : "",
        p.isTeen ? "TEEN" : "",
        p.isSenior ? "SENIOR 60+" : "",
      ]
        .filter(Boolean)
        .join(", ");

      return (
        `  - ${p.name} (${p.age}y, ${p.gender}${flagLabels ? `, [${flagLabels}]` : ""}): ` +
        `Diet=${p.dietaryType}, Goal=${p.effectiveGoal}, ` +
        `Target=${p.dailyCalorieTarget} kcal/day, Spice=${p.effectiveSpiceTolerance}, ` +
        `Religion=${religious}, Conditions=${conditions}, Allergies=${allergies}, ` +
        `Medications=${meds}, Dislikes=${dislikes}, ` +
        `Fasting days this week=${fasting}. ${feeling}`
      );
    })
    .join("\n");

  return `
FAMILY: ${family.name}
Region: ${family.stateRegion} | Language: ${family.languagePreference}
Household dietary baseline: ${family.householdDietaryBaseline}
Meals per day: ${family.mealsPerDay}
Cooking skill: ${family.cookingSkillLevel}
Appliances: ${(family.appliances ?? []).join(", ") || "Gas stove"}

MEMBERS (${effectiveProfiles.length} total):
${memberLines}
`.trim();
}

function buildConstraintInstructionSection(packet: ConstraintPacket): string {
  const {
    harmonyScore,
    conflicts,
    resolutions,
    pantryZeroWasteItems,
    fastingPreloadInstructions,
    medicationGuardrailBundles,
    medicationWeeklyMonitorDirectives,
    medicationWarnings,
    weeklyContext,
  } = packet;

  const conflictLines = resolutions
    .map((r, i) => {
      const c = conflicts[i];
      return `  [${i + 1}] ${c?.description ?? ""}\n     → RESOLUTION: ${r.resolution}`;
    })
    .join("\n");

  const pantrySection =
    pantryZeroWasteItems.length > 0
      ? `ZERO-WASTE MANDATE — Use these perishable pantry items THIS WEEK (before buying new):\n` +
        pantryZeroWasteItems.map((p) => `  - ${p.name}: ${p.quantity} ${p.unit}`).join("\n")
      : "No perishable pantry items to use up this week.";

  const fastingSection =
    fastingPreloadInstructions.length > 0
      ? `FASTING PRE-LOAD INSTRUCTIONS:\n` +
        fastingPreloadInstructions.map((i) => `  ${i}`).join("\n")
      : "";

  const weeklyMonitorSection =
    medicationWeeklyMonitorDirectives.length > 0
      ? `MEDICATION WEEKLY MONITOR RULES — Apply across ENTIRE 7-day plan before generating any day:\n` +
        medicationWeeklyMonitorDirectives.map((d) => `  ⚠️ ${d}`).join("\n")
      : "";

  let medicationSection: string;

  if (medicationGuardrailBundles && medicationGuardrailBundles.length > 0) {
    const allDirectives = medicationGuardrailBundles.flatMap((b) => b.directives);
    const combinedDirectives = [...allDirectives, ...medicationWarnings];
    medicationSection =
      `MEDICATION INTERACTION GUARDRAILS (ABSOLUTE — Gemini MUST NEVER violate these):\n` +
      `These are deterministic pharmacology rules, not suggestions. Implement each one exactly.\n` +
      combinedDirectives.map((w) => `  ${w}`).join("\n");
  } else if (medicationWarnings.length > 0) {
    medicationSection =
      `MEDICATION INTERACTION GUARDRAILS (ABSOLUTE — never violate):\n` +
      medicationWarnings.map((w) => `  ${w}`).join("\n");
  } else {
    medicationSection = "No active medication constraints this week.";
  }

  const specialRequest = weeklyContext.specialRequest
    ? `SPECIAL REQUEST (HIGHEST PRIORITY — override recipe defaults if needed):\n  "${weeklyContext.specialRequest}"`
    : "";

  const cookingConstraints = cookingTimeToConstraintString(
    weeklyContext.weekdayCookingTime,
    weeklyContext.weekendCookingTime
  );

  return `
${weeklyMonitorSection ? weeklyMonitorSection + "\n\n" : ""}RESOLVED CONFLICTS (implement EXACTLY — these are hardcoded constraints):
${conflictLines || "  No conflicts detected — full flexibility."}

${pantrySection}

${fastingSection ? fastingSection + "\n" : ""}${medicationSection}

${specialRequest}

${cookingConstraints.weekday}
${cookingConstraints.weekend}
`.trim();
}

export async function generateStaplesList(packet: ConstraintPacket): Promise<{
  items: GroceryItem[];
  total_cost: number;
}> {
  const { budget, effectiveProfiles, family } = packet;
  const familyContext = buildFamilyContextSection(packet);
  const familySize = effectiveProfiles.length;

  const globalNever = new Set<string>();
  for (const p of effectiveProfiles) {
    for (const allergy of p.allergies) {
      if (allergy === "none") continue;
      const forbidden = (
        allergy === "peanuts" ? ["peanuts", "groundnut oil", "moongphali"] :
        allergy === "dairy"   ? ["paneer", "ghee", "butter", "curd", "milk", "cheese"] :
        allergy === "gluten"  ? ["atta", "maida", "suji", "wheat"] :
        allergy === "soy"     ? ["soya chunks", "tofu", "soya flour"] :
        allergy === "sesame"  ? ["til", "sesame"] :
        []
      );
      forbidden.forEach((f) => globalNever.add(f));
    }
    const religForbidden: Record<string, string[]> = {
      no_beef: ["beef"],
      no_pork: ["pork"],
      sattvic_no_onion_garlic: ["onion powder", "garlic powder"],
      jain_rules: ["onion powder", "garlic powder"],
    };
    (religForbidden[p.religiousCulturalRules?.type] ?? []).forEach((f) => globalNever.add(f));
  }

  const allConditions = [
    ...new Set(effectiveProfiles.flatMap((p) => p.effectiveHealthConditions.filter((c) => c !== "none")))
  ];
  const healthStaples: string[] = [];
  if (allConditions.includes("diabetes_type_2"))
    healthStaples.push("Include: jowar atta 500g, bajra atta 500g, brown rice 2kg, besan 500g, oats 500g");
  if (allConditions.includes("hypertension"))
    healthStaples.push("Include: amchur powder, lemon juice powder. REDUCE: regular salt quantity by 30%.");
  if (allConditions.includes("anaemia"))
    healthStaples.push("Include: jaggery (gud) 500g, sesame seeds/til 250g (if no allergy), chia seeds 250g");
  if (allConditions.includes("high_cholesterol"))
    healthStaples.push("Include: oats 500g, flaxseeds/alsi 250g. Prefer mustard oil over refined oil.");
  if (allConditions.includes("hypothyroid"))
    healthStaples.push("MANDATORY: Iodised salt only. Limit: raw cruciferous vegetables in bulk.");
  if (allConditions.includes("pcos"))
    healthStaples.push("Include: flaxseeds/alsi 250g, chia seeds 250g. Whole grains preferred over refined.");
  if (allConditions.includes("kidney_issues"))
    healthStaples.push("CRITICAL: Low-phosphorus grains only. Limit: whole grain quantity. Avoid high-potassium bulk items.");

  const prompt = `
You are a professional Indian home-cooking nutritionist. Generate a precise monthly bulk grocery (staples) list.

${familyContext}

BUDGET: ₹${budget.staplesBudget.toFixed(0)} total for the entire month's staples.
FAMILY SIZE: ${familySize} members.

ABSOLUTE EXCLUSIONS (never include in ANY form):
${[...globalNever].join(", ") || "None"}

HEALTH-DRIVEN INCLUSIONS:
${healthStaples.join("\n") || "No specific health-driven staple requirements."}

RULES:
1. DRY GOODS ONLY: atta, rice, assorted dals (minimum: toor, moong, chana, masoor), cooking oil, sugar, salt, spices (haldi, jeera, dhaniya powder, rai, hing, red chilli powder, garam masala), tea leaves, poha, suji, besan, papad.
2. NO fresh vegetables, fruit, dairy, eggs, or meat — those are weekly perishables.
3. Quantities must be realistic for ${familySize} people for 30 days.
   (Reference: a family of 4 uses ~8–10 kg atta/month, ~5–6 kg rice/month, ~2 kg toor dal/month.)
4. Total sum of estimated_price must NOT exceed ₹${budget.staplesBudget.toFixed(0)}.
5. Use realistic retail prices for ${family.stateRegion} region.
6. Include the complete range of Indian kitchen essentials.

Respond ONLY with valid JSON:
{
  "items": [
    {
      "name": "Toor Dal",
      "quantity": 2,
      "unit": "kg",
      "estimated_price": 240,
      "category": "dal",
      "purchased": false,
      "notes": "For daily dal. Buy from local kirana."
    }
  ],
  "total_estimated_cost": 3800
}
`.trim();

  const raw = await callGemini(prompt, 8192);
  const parsed = safeParseJSON<{ items: GroceryItem[]; total_estimated_cost: number }>(raw, "staples");

  return { items: parsed.items, total_cost: parsed.total_estimated_cost };
}

export async function generateWeeklyMealPlan(
  packet: ConstraintPacket,
  weekStartDate: string
): Promise<{
  days: DayPlan[];
  perishables: GroceryItem[];
  nutritional_summary: NutritionalSummary;
  perishables_total: number;
}> {
  const { budget, effectiveProfiles, weeklyContext, nonvegDaysByMember, family } = packet;

  const slotWeights = {
    breakfast: budget.budgetBreakdown.breakfast_weight,
    lunch: budget.budgetBreakdown.lunch_weight,
    dinner: budget.budgetBreakdown.dinner_weight,
  };
  const modifierMap = buildMemberModifierMap(packet, slotWeights);
  const modifierSection = buildModifierInjectionSection(modifierMap);

  const familyContext = buildFamilyContextSection(packet);
  const constraintInstructions = buildConstraintInstructionSection(packet);

  const startDate = new Date(weekStartDate + "T00:00:00");
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weekDays = dayNames.map((name, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return { name, date: d.toISOString().split("T")[0] };
  });

  const nonvegSummary =
    Object.entries(nonvegDaysByMember).length > 0
      ? Object.entries(nonvegDaysByMember)
          .map(([memberId, days]) => {
            const m = effectiveProfiles.find((p) => p.id === memberId);
            return `  ${m?.name ?? memberId}: Non-veg allowed on ${days.join(", ")}`;
          })
          .join("\n")
      : "  No non-veg members this week.";

  const fastingSummary = effectiveProfiles
    .filter((p) => p.effectiveFastingDays.length > 0 || p.ekadashiThisWeek || p.festivalFastThisWeek)
    .map((p) => {
      const days = [...p.effectiveFastingDays];
      if (p.ekadashiThisWeek) days.push("Ekadashi day");
      if (p.festivalFastThisWeek) days.push("Festival fast day");
      return `  ${p.name}: Fasting on ${days.join(", ")}`;
    })
    .join("\n");

  const pantryStr = (weeklyContext.pantrySnapshot as PantryItem[])
    .map((p) => `${p.name} (${p.quantity} ${p.unit}${p.is_perishable ? " — MUST USE THIS WEEK" : ""})`)
    .join(", ");

  const memberIdRef = effectiveProfiles
    .map((p) => `${p.name} → member_id: "${p.id}"`)
    .join(", ");

  const mealsIncludeSnack = family.mealsPerDay === "3_meals_snacks";
  const weeklyBudget = round2(packet.effectiveDailyBudget * 7);

  const prompt = `
You are an expert Indian family nutritionist and home cook. Generate a complete 7-day meal plan using the "One Base, Many Plates" method.

${familyContext}

BUDGET:
- Weekly perishable budget: ₹${weeklyBudget.toFixed(0)} total
- Daily budget: ₹${packet.effectiveDailyBudget.toFixed(0)}
- Breakfast limit: ₹${budget.budgetBreakdown.daily_limits.breakfast.toFixed(0)}
- Lunch limit: ₹${budget.budgetBreakdown.daily_limits.lunch.toFixed(0)}
- Dinner limit: ₹${budget.budgetBreakdown.daily_limits.dinner.toFixed(0)}
${mealsIncludeSnack ? `- Snack limit: ₹${budget.budgetBreakdown.daily_limits.snack.toFixed(0)}` : ""}

WEEK DATES: ${weekDays.map((d) => `${d.name} ${d.date}`).join(", ")}

${constraintInstructions}

NON-VEG DAYS BY MEMBER:
${nonvegSummary}

FASTING THIS WEEK:
${fastingSummary || "  No fasting members this week."}

PANTRY AVAILABLE: ${pantryStr || "None"}

ONE BASE, MANY PLATES — MANDATORY RULES:
1. Every meal slot has ONE base dish cooked for the whole family (cost-efficient, kitchen-efficient).
2. For each member, list plate_modifications — what changes on their plate vs. the base.
3. If a member is fasting, set fasting_replacement (e.g. "Sabudana khichdi, sendha namak") instead of the base dish.
4. Tiffin members (school/office): their lunch plate must be packable and travel-friendly.
5. Keep recipes practical — match cooking skill level (${family.cookingSkillLevel}).
6. Pantry items marked "MUST USE" must appear in meals this week.
7. Spice and conflict resolutions above are MANDATORY — implement exactly.
8. image_search_query must be an English dish name suitable for Google Image Search.
9. priority_flags: include applicable tags from: allergy_compliant, medication_window_respected, zero_waste_item_used, diabetic_friendly, low_sodium, low_protein, high_protein_plate, fasting_replacement, tiffin_packed.

${modifierSection}

MEMBER ID REFERENCE (use EXACT IDs in member_plates):
${memberIdRef}

Respond ONLY with valid JSON:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "day_name": "Monday",
      "meals": {
        "breakfast": {
          "name": "Vegetable Poha",
          "is_base_dish": true,
          "base_recipe": {
            "ingredients": [{"name": "Poha", "quantity": "200g"}, {"name": "Onion", "quantity": "1 medium"}],
            "steps": ["Wash and soak poha for 5 mins.", "Temper mustard seeds and curry leaves.", "Add onion, cook till soft.", "Add poha, salt, turmeric. Toss for 3 mins.", "Garnish with coriander."],
            "prep_time_mins": 5,
            "cook_time_mins": 10,
            "image_search_query": "poha Indian breakfast recipe"
          },
          "member_plates": [
            {
              "member_id": "EXACT_UUID_FROM_REFERENCE",
              "member_name": "Member Name",
              "modifications": ["Skip onion — sattvic diet", "Use minimal salt"],
              "fasting_replacement": null,
              "tiffin_instructions": null
            }
          ],
          "pantry_items_used": ["poha"],
          "estimated_cost": 35,
          "priority_flags": ["allergy_compliant", "medication_window_respected"]
        },
        "lunch": { "...": "..." },
        "dinner": { "...": "..." }${mealsIncludeSnack ? `,\n        "snack": { "...": "..." }` : ""}
      }
    }
  ],
  "perishables": [
    {
      "name": "Spinach",
      "quantity": 500,
      "unit": "grams",
      "estimated_price": 40,
      "category": "vegetable",
      "purchased": false,
      "notes": "Buy fresh twice a week"
    }
  ],
  "perishables_total": 1150,
  "nutritional_summary": {
    "MEMBER_UUID": {
      "member_name": "Member Name",
      "daily_avg_calories": 1850,
      "daily_target_calories": 1900,
      "weekly_protein_g": 385,
      "nutritional_debt": ["Low Iron on Wednesday fasting pre-load needed"],
      "fasting_days_handled": ["monday"]
    }
  }
}

CRITICAL RULES:
- perishables_total must NOT exceed ₹${weeklyBudget.toFixed(0)}.
- Generate ALL 7 days, ALL meal slots per the family's meals_per_day setting.
- Include ALL ${effectiveProfiles.length} members in every meal's member_plates array.
- Use the EXACT member IDs listed above.
`.trim();

  const raw = await callGemini(prompt, 32768);
  const parsed = safeParseJSON<{
    days: DayPlan[];
    perishables: GroceryItem[];
    perishables_total: number;
    nutritional_summary: NutritionalSummary;
  }>(raw, "weekly_meal_plan");

  return {
    days: parsed.days,
    perishables: parsed.perishables,
    nutritional_summary: parsed.nutritional_summary,
    perishables_total: parsed.perishables_total,
  };
}

export async function generateBufferList(packet: ConstraintPacket): Promise<{
  items: GroceryItem[];
  total_cost: number;
}> {
  const { budget, effectiveProfiles, family } = packet;

  const dryFruitExclusions = new Set<string>();
  for (const p of effectiveProfiles) {
    if (p.allergies.includes("tree_nuts")) {
      ["almonds", "cashews", "walnuts", "pistachios", "hazelnuts"].forEach((n) =>
        dryFruitExclusions.add(n)
      );
    }
    if (p.allergies.includes("peanuts")) {
      dryFruitExclusions.add("peanuts");
      dryFruitExclusions.add("groundnuts");
    }
    if (p.allergies.includes("sesame")) {
      dryFruitExclusions.add("sesame seeds");
      dryFruitExclusions.add("til");
    }
  }

  const clinicalSummary = effectiveProfiles.map((p) => {
    const conditions = p.effectiveHealthConditions.filter((c) => c !== "none").join(", ") || "none";
    return (
      `  ${p.name} (${p.age}y, ${p.gender}): goal=${p.effectiveGoal}, ` +
      `conditions=${conditions}, fasting=${p.effectiveFastingDays.join(", ") || "none"}`
    );
  }).join("\n");

  const prompt = `
You are a clinical nutritionist specializing in preventive Indian nutrition. Generate a monthly dry fruit and seasonal fruit budget plan.

FAMILY MEMBERS:
${clinicalSummary}

TOTAL BUFFER BUDGET: ₹${budget.bufferBudget.toFixed(0)}
REGION: ${family.stateRegion}
EXCLUSIONS (allergies): ${[...dryFruitExclusions].join(", ") || "None"}

RULES:
1. Budget split: ~60% dry fruits/seeds (monthly batch), ~40% as weekly seasonal fruit cash allocation.
2. Clinical optimization per condition:
   - Diabetes: Almonds (blood sugar regulation), Walnuts (omega-3). Avoid high-sugar dried fruits.
   - Hypertension: Pistachios (potassium), Walnuts. Avoid salted varieties.
   - Anaemia: Raisins (kishmish), dates (khajoor), dried apricots (iron source).
   - PCOS: Walnuts, flaxseeds (alsi), pumpkin seeds (kaddu ke beej).
   - Kidney issues: Limit high-potassium options (no dates, no banana chips, no coconut).
   - High cholesterol: Walnuts, flaxseeds, pumpkin seeds (soluble fibre + omega-3).
   - Hypothyroid: Brazil nuts (selenium). Limit cashews (high phosphorus).
   - Weight gain / build muscle: Cashews, mixed dry fruits (calorie-dense).
   - Weight loss: Almonds (satiety), portion-controlled (max 10 pieces/day).
   - Senior (60+): Walnuts (brain health), almonds, prunes.
   - Children under 5: Ground/paste form only — no whole nuts (choking hazard).
   - School-age children: Mixed dry fruits, raisins — whole pieces fine.
3. The "Seasonal Fresh Fruits" must be one line item with weekly_budget_inr (not estimated_price × quantity).
   Notes should explain which fruits are typically cheap in the region this season.
4. Use realistic prices for ${family.stateRegion}.
5. Total of all estimated_price values must NOT exceed ₹${budget.bufferBudget.toFixed(0)}.

MEMBER IDs for reference: ${effectiveProfiles.map((p) => `"${p.id}" = ${p.name}`).join(", ")}

Respond ONLY with valid JSON:
{
  "items": [
    {
      "name": "Almonds (Badam)",
      "quantity": 250,
      "unit": "grams",
      "estimated_price": 275,
      "category": "dry_fruit",
      "purchased": false,
      "notes": "For diabetic and all adults — 8–10 almonds/day. Soak overnight."
    },
    {
      "name": "Seasonal Fresh Fruits (Weekly Allocation)",
      "quantity": 4,
      "unit": "weeks",
      "estimated_price": 120,
      "category": "fruit",
      "purchased": false,
      "notes": "₹120/week. Buy cheapest seasonal option: papaya, guava, banana, or seasonal citrus."
    }
  ],
  "total_estimated_cost": 950
}
`.trim();

  const raw = await callGemini(prompt, 2048);
  const parsed = safeParseJSON<{ items: GroceryItem[]; total_estimated_cost: number }>(raw, "buffer_list");

  return { items: parsed.items, total_cost: parsed.total_estimated_cost };
}

export async function runPromptChain(
  packet: ConstraintPacket,
  weekStartDate: string
): Promise<{ result: PromptChainResult; timings: PromptChainTimings }> {
  const t1 = Date.now();
  const staples = await generateStaplesList(packet);
  const staples_ms = Date.now() - t1;

  const t2 = Date.now();
  const meals = await generateWeeklyMealPlan(packet, weekStartDate);
  const meals_ms = Date.now() - t2;

  const t3 = Date.now();
  const buffer = await generateBufferList(packet);
  const buffer_ms = Date.now() - t3;

  const weeklyPerishables = [...meals.perishables];
  let weeklyPerishablesTotalCost = meals.perishables_total;
  const hasT1DMember = packet.effectiveProfiles.some(p =>
    p.effectiveHealthConditions.includes("diabetes_type_1")
  );
  if (hasT1DMember) {
    weeklyPerishables.push(...T1D_MANDATORY_GROCERY_ITEMS);
    weeklyPerishablesTotalCost += T1D_MANDATORY_GROCERY_ITEMS.reduce(
      (sum, item) => sum + item.estimated_price, 0
    );
  }

  const result: PromptChainResult = {
    staples: staples.items,
    staples_total_cost: staples.total_cost,
    weeklyMealPlan: meals.days,
    weeklyPerishables,
    weeklyPerishables_total_cost: weeklyPerishablesTotalCost,
    bufferItems: buffer.items,
    buffer_total_cost: buffer.total_cost,
    nutritional_summary: meals.nutritional_summary,
  };

  return {
    result,
    timings: {
      staples_ms,
      meals_ms,
      buffer_ms,
      total_ms: staples_ms + meals_ms + buffer_ms,
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
