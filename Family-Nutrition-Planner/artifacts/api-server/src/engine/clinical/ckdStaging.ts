// =============================================================================
// NutriNext ParivarSehat — CKD Staging Clinical Module
// src/engine/clinical/ckdStaging.ts
//
// CURRENT STATE: The engine has a single "kidney_issues" condition with
// generic 0.6-0.8g/kg protein limit. This fails the stress test because:
//   Stage 3 CKD: Mild restriction — many normal foods allowed
//   Stage 4 CKD: Severe restriction — potassium, phosphorus, fluid limits
//   Stage 5 (Dialysis): Opposite of Stage 3 — protein INCREASES on dialysis
//                       (dialysis removes protein, so more protein is needed)
//
// Getting the Stage 5 rule wrong (restricting protein for a dialysis patient)
// is a MEDICALLY DANGEROUS error.
//
// STAGING PROTOCOL:
//   Stage 1–2: eGFR > 60. Usually asymptomatic. The app should not generate
//              a plan for these without the user confirming their stage.
//   Stage 3a:  eGFR 45–59. Mild-moderate restriction.
//   Stage 3b:  eGFR 30–44. Moderate-severe restriction.
//   Stage 4:   eGFR 15–29. Severe restriction. Pre-dialysis planning.
//   Stage 5:   eGFR < 15.  Kidney failure. On dialysis or awaiting transplant.
//              PROTEIN RULES REVERSE: dialysis patients need MORE protein.
//
// Sources:
//   National Kidney Foundation KDOQI Guidelines 2020
//   Kidney Disease Improving Global Outcomes (KDIGO) 2024
//   Indian Society of Nephrology (ISN) dietary guidelines
//   Narayana Health CKD Nutrition Protocol (India-adapted)
// =============================================================================

import type { EffectiveMemberProfile } from "../types";

// =============================================================================
// SECTION 1: CKD STAGE TYPES
// =============================================================================

export type CKDStage =
  | "ckd_stage_1_2"    // eGFR > 60 — mild, mostly normal diet with monitoring
  | "ckd_stage_3a"     // eGFR 45–59 — moderate restriction begins
  | "ckd_stage_3b"     // eGFR 30–44 — significant restriction
  | "ckd_stage_4"      // eGFR 15–29 — severe restriction, pre-dialysis
  | "ckd_stage_5"      // eGFR < 15 — kidney failure, NON-dialysis (most restrictive)
  | "ckd_stage_5_dialysis"; // On hemodialysis or peritoneal dialysis — PROTEIN RULE REVERSES

export const CKD_STAGE_IDS = [
  "ckd_stage_1_2",
  "ckd_stage_3a",
  "ckd_stage_3b",
  "ckd_stage_4",
  "ckd_stage_5",
  "ckd_stage_5_dialysis",
] as const;

export type CKDStageId = typeof CKD_STAGE_IDS[number];

// =============================================================================
// SECTION 2: PER-STAGE NUTRIENT LIMITS
// These are DAILY LIMITS, not targets.
// All values are PER KG OF IDEAL BODY WEIGHT unless marked absolute.
// =============================================================================

export interface CKDNutrientLimits {
  // Protein
  protein_g_per_kg_ideal_bw: { min: number; max: number };
  protein_note: string;

  // Potassium — most critical in CKD. Accumulates and causes fatal arrhythmias.
  potassium_mg_per_day_max: number;
  potassium_note: string;

  // Phosphorus — causes bone disease (renal osteodystrophy) and vascular calcification
  phosphorus_mg_per_day_max: number;
  phosphorus_note: string;

  // Sodium — fluid retention and blood pressure
  sodium_mg_per_day_max: number;
  sodium_note: string;

  // Fluid — only restricted in later stages (kidney cannot excrete water)
  fluid_ml_per_day_max: number | null;  // null = no restriction
  fluid_note: string;

  // Potassium-restricted vegetables allowed vs forbidden
  high_potassium_foods_forbidden: string[];
  low_potassium_foods_safe: string[];

  // High phosphorus foods
  high_phosphorus_foods_limit: string[];

  // Overall calorie target note
  calorie_note: string;

  // Dialysis-specific additions
  is_dialysis: boolean;
  dialysis_specific_notes: string | null;
}

export const CKD_STAGE_LIMITS: Record<CKDStageId, CKDNutrientLimits> = {

  // ── Stage 1–2 (eGFR > 60) ────────────────────────────────────────────────
  ckd_stage_1_2: {
    protein_g_per_kg_ideal_bw: { min: 0.8, max: 1.0 }, // Normal RDA range
    protein_note: "Normal protein intake. Monitor urine protein (proteinuria). Avoid excess protein supplementation.",
    potassium_mg_per_day_max: 4000, // Normal range — most foods allowed
    potassium_note: "No restriction yet. Monitor blood potassium levels.",
    phosphorus_mg_per_day_max: 1200,
    phosphorus_note: "Mild limitation. Avoid phosphorus additives in processed foods.",
    sodium_mg_per_day_max: 2300,
    sodium_note: "Standard DASH-diet sodium limit to protect remaining kidney function.",
    fluid_ml_per_day_max: null,
    fluid_note: "No fluid restriction. Standard 2L/day recommended.",
    high_potassium_foods_forbidden: [],
    low_potassium_foods_safe: ["all vegetables are generally safe at this stage"],
    high_phosphorus_foods_limit: [
      "processed cheese", "canned foods with phosphate additives", "dark colas",
      "fast food", "packaged snacks with phosphoric acid",
    ],
    calorie_note: "Normal calorie intake. Maintain healthy BMI to reduce kidney workload.",
    is_dialysis: false,
    dialysis_specific_notes: null,
  },

  // ── Stage 3a (eGFR 45–59) ─────────────────────────────────────────────────
  ckd_stage_3a: {
    protein_g_per_kg_ideal_bw: { min: 0.6, max: 0.8 },
    protein_note: "Protein restriction begins. Replace some dal with refined starches in meal. Avoid protein supplements.",
    potassium_mg_per_day_max: 3000,
    potassium_note: "Moderate restriction. Limit high-potassium vegetables. Leaching technique recommended.",
    phosphorus_mg_per_day_max: 1000,
    phosphorus_note: "Reduce dairy to 1 serving/day. Avoid phosphate additives. Prefer plant phosphorus (less absorbed).",
    sodium_mg_per_day_max: 2000,
    sodium_note: "Strict sodium limit. Avoid pickles, papads, processed foods, and added salt.",
    fluid_ml_per_day_max: null,
    fluid_note: "No fluid restriction yet unless oedema or hypertension present.",
    high_potassium_foods_forbidden: [
      "banana (kela)", "orange", "tomato (raw in large amounts)", "potato (without leaching)",
      "coconut water", "avocado", "dried fruits (dates, anjeer, munakka)",
      "tomato paste / puree", "spinach in large amounts", "plantain",
    ],
    low_potassium_foods_safe: [
      "apple (seb)", "pear (nashpati)", "grapes (angoor)", "watermelon (small quantity)",
      "cabbage (leached)", "cauliflower (leached)", "bottle gourd (lauki)",
      "ridge gourd (tori)", "bitter gourd (karela — also good for diabetes)",
      "white rice", "bread (without whole grains — lower potassium)",
    ],
    high_phosphorus_foods_limit: [
      "milk (limit to 100ml/day)", "curd (limit to 50g/day)", "paneer (limit to 30g/day)",
      "dal (rajma, chana especially — limit portion)", "whole grains",
      "nuts in excess", "dark colas", "cheese",
    ],
    calorie_note: "35 kcal/kg ideal body weight/day. Avoid malnutrition from over-restriction.",
    is_dialysis: false,
    dialysis_specific_notes: null,
  },

  // ── Stage 3b (eGFR 30–44) ─────────────────────────────────────────────────
  ckd_stage_3b: {
    protein_g_per_kg_ideal_bw: { min: 0.55, max: 0.7 },
    protein_note: "Stricter protein limit. Dal portions significantly reduced. Rice/roti as primary energy source.",
    potassium_mg_per_day_max: 2500,
    potassium_note: "Significant restriction. Leaching of all vegetables MANDATORY. Boil vegetables and discard water.",
    phosphorus_mg_per_day_max: 800,
    phosphorus_note: "Strict phosphorus limit. Dairy now restricted to small amounts. Avoid whole grains.",
    sodium_mg_per_day_max: 1800,
    sodium_note: "Very strict. No salt at table. Cook with minimal salt.",
    fluid_ml_per_day_max: 1500, // Mild fluid restriction begins
    fluid_note: "Fluid restriction begins: 1500ml/day. Include all liquids (water, dal soup, milk).",
    high_potassium_foods_forbidden: [
      "banana", "orange", "tomato", "potato", "coconut water", "all dried fruits",
      "spinach (palak)", "methi leaves", "lotus stem", "yam (suran)",
      "sweet potato (shakarkand)", "plantain",
    ],
    low_potassium_foods_safe: [
      "apple", "pear", "berries", "grapes (small portion)",
      "cabbage (double-boiled)", "cauliflower (double-boiled)", "lauki",
      "tori (ridge gourd)", "karela (bitter gourd)", "parwal",
      "white rice", "maida roti (lower potassium than atta)",
    ],
    high_phosphorus_foods_limit: [
      "milk (50ml/day max)", "curd (30g/day max)", "paneer (20g max)",
      "moong dal (limit to 30g raw)", "whole wheat (prefer maida)", "nuts (avoid)",
    ],
    calorie_note: "35 kcal/kg/day. Consider high-calorie low-protein foods: sugar, oil, starchy vegetables.",
    is_dialysis: false,
    dialysis_specific_notes: null,
  },

  // ── Stage 4 (eGFR 15–29) Pre-dialysis ────────────────────────────────────
  ckd_stage_4: {
    protein_g_per_kg_ideal_bw: { min: 0.5, max: 0.6 },
    protein_note:
      "SEVERE protein restriction. Very small dal portions. Protein primarily from egg white (if applicable) or limited paneer. Avoid protein supplements.",
    potassium_mg_per_day_max: 2000,
    potassium_note:
      "Severe restriction. Mandatory double-boiling of all vegetables. All high-potassium foods forbidden.",
    phosphorus_mg_per_day_max: 700,
    phosphorus_note:
      "Severe. Dairy almost entirely eliminated. Phosphate binders prescribed by doctor should be coordinated with meals.",
    sodium_mg_per_day_max: 1500,
    sodium_note:
      "Maximum restriction. Cooking should use no added salt. Use lemon, vinegar, and fresh herbs for flavour.",
    fluid_ml_per_day_max: 1000, // 1 litre total fluid
    fluid_note:
      "1 litre total fluid/day. This includes ALL liquids: water, chai, dal water, rasam, juice, milk.",
    high_potassium_foods_forbidden: [
      "all dried fruits", "banana", "orange", "all citrus", "tomato and tomato products",
      "potato", "sweet potato", "yam", "lotus stem", "coconut water",
      "spinach", "methi", "amaranth (chaulai)", "raw onion in excess",
      "mushroom", "avocado", "all nuts and seeds",
    ],
    low_potassium_foods_safe: [
      "apple (peeled)", "pear (peeled)", "grapes (10–15 pieces)",
      "cabbage (double-boiled, water discarded)",
      "cauliflower (double-boiled)", "lauki", "tori", "parwal", "tinda",
      "white rice (main carbohydrate source)", "maida roti",
    ],
    high_phosphorus_foods_limit: [
      "ALL DAIRY (milk, curd, paneer) — nearly eliminated",
      "ALL DALS — portion max 20g raw per day",
      "ALL whole grains — use refined only",
      "all nuts and seeds — eliminated",
    ],
    calorie_note:
      "35 kcal/kg/day from carbohydrates and fats — NOT protein. Butter, oil, and sugar become important calorie sources.",
    is_dialysis: false,
    dialysis_specific_notes: null,
  },

  // ── Stage 5 (eGFR < 15) NON-dialysis ────────────────────────────────────
  ckd_stage_5: {
    protein_g_per_kg_ideal_bw: { min: 0.4, max: 0.6 }, // Most restrictive
    protein_note:
      "MOST RESTRICTIVE PROTEIN LIMIT. On conservative (non-dialysis) management. Protein from egg white only if non-veg and prescribed. Vegetarian: extremely small dal portion, no paneer.",
    potassium_mg_per_day_max: 1500,
    potassium_note: "Extreme restriction. Life-threatening hyperkalemia risk.",
    phosphorus_mg_per_day_max: 600,
    phosphorus_note: "Extreme. Phosphate binders with every meal. Dairy fully eliminated.",
    sodium_mg_per_day_max: 1000,
    sodium_note: "Maximum restriction. No added salt whatsoever. Naturally occurring sodium only.",
    fluid_ml_per_day_max: 750,
    fluid_note: "750ml total fluid/day (less than 3 cups). Every sip counts.",
    high_potassium_foods_forbidden: [
      "ALL HIGH-POTASSIUM FOODS — see Stage 4 list, apply even more strictly",
      "even 'safe' vegetables must be double-boiled and verified",
    ],
    low_potassium_foods_safe: [
      "double-boiled cabbage, cauliflower, lauki only",
      "white rice as main food",
      "maida (refined wheat) roti",
      "apple (small, peeled)",
    ],
    high_phosphorus_foods_limit: [
      "All dairy eliminated entirely",
      "Dal: max 15g raw once every other day",
      "All whole grains eliminated",
    ],
    calorie_note: "35 kcal/kg/day. Primary calories from sugar, white rice, refined roti, butter/oil.",
    is_dialysis: false,
    dialysis_specific_notes: null,
  },

  // ── Stage 5 DIALYSIS ──────────────────────────────────────────────────────
  // ⚠️ THIS IS THE CRITICAL RULE REVERSAL ⚠️
  // On dialysis: protein INCREASES because dialysis removes protein from blood.
  // Getting this wrong (continuing protein restriction) causes malnutrition + death.
  ckd_stage_5_dialysis: {
    protein_g_per_kg_ideal_bw: { min: 1.2, max: 1.4 }, // ← INCREASES dramatically vs non-dialysis
    protein_note:
      "⚠️ DIALYSIS RULE REVERSAL: Protein restriction ENDS on dialysis. Dialysis removes protein, " +
      "causing malnutrition. Target 1.2–1.4g/kg/day. Include dal, paneer, egg white at every meal. " +
      "This is the OPPOSITE of pre-dialysis protein rules.",
    potassium_mg_per_day_max: 2000, // Slightly relaxed vs non-dialysis — dialysis removes some
    potassium_note:
      "Some relaxation vs pre-dialysis, but still restricted. Dialysis removes potassium, " +
      "but inter-dialysis period still risky. Leaching still required.",
    phosphorus_mg_per_day_max: 800, // Still restricted — dialysis doesn't remove well
    phosphorus_note:
      "Phosphorus is poorly removed by dialysis. Take phosphate binders with every meal containing protein. " +
      "Avoid high-phosphorus additives (dark colas, processed foods).",
    sodium_mg_per_day_max: 1500,
    sodium_note:
      "Control fluid gain between dialysis sessions (maximum 2kg between sessions). " +
      "High sodium causes thirst → excess fluid → fluid overload.",
    fluid_ml_per_day_max: 1000, // 1L + whatever urine output exists (if any)
    fluid_note:
      "Fluid = 500ml + previous day's urine output. Average 800–1000ml/day for most dialysis patients. " +
      "Fluid overload between dialysis sessions is a cardiac emergency.",
    high_potassium_foods_forbidden: [
      "banana", "orange", "coconut water", "tomato paste",
      "dried fruits", "all nuts and seeds", "potato (unless leached)",
    ],
    low_potassium_foods_safe: [
      "apple", "grapes", "leached vegetables (cabbage, cauliflower, lauki)",
      "white rice", "bread", "maida roti",
    ],
    high_phosphorus_foods_limit: [
      "dark colas", "processed cheese", "packaged foods with phosphate additives",
      "limit whole grains", "take phosphate binder with all protein meals",
    ],
    calorie_note:
      "35 kcal/kg/day total calories. Malnutrition is common in dialysis patients — adequate calories essential. " +
      "Do NOT restrict calories.",
    is_dialysis: true,
    dialysis_specific_notes:
      "DIALYSIS SCHEDULE MATTERS: On dialysis days, protein-rich meals are more effective post-dialysis " +
      "(nutrients can be absorbed better when blood is clean). Non-dialysis days should be slightly " +
      "more restricted in potassium and fluid.",
  },
};

// =============================================================================
// SECTION 3: LEACHING TECHNIQUE
// The potassium leaching technique is essential for CKD stages 3b, 4, 5.
// This needs to appear in recipe steps for affected members.
// =============================================================================

export const LEACHING_TECHNIQUE_INSTRUCTION =
  `LEACHING TECHNIQUE FOR CKD MEMBER: Peel and cut all vegetables into small pieces. ` +
  `Soak in large amount of warm water for 2–4 hours (change water once). ` +
  `Drain, then boil in FRESH water. Discard boiling water (do not use as soup or stock). ` +
  `This removes 30–50% of potassium. Apply to: potato, tomato, spinach, carrot, beetroot, ` +
  `and ALL medium-potassium vegetables. For cooking dal: rinse multiple times, soak 6 hours, discard soak water, boil in fresh water.`;

// =============================================================================
// SECTION 4: CONDITION DIETARY RULE OBJECTS
// Integrate these into CONDITION_DIETARY_RULES in conflict-engine.ts.
// Replace the existing single "kidney_issues" rule with 6 stage-specific rules.
// =============================================================================

export function getCKDConditionRule(stage: CKDStageId): {
  forbidden_ingredients: string[];
  limit_ingredients: string[];
  mandatory_nutrients: string[];
  special_instructions: string;
} {
  const limits = CKD_STAGE_LIMITS[stage];

  const isDialysis = limits.is_dialysis;

  return {
    forbidden_ingredients: limits.high_potassium_foods_forbidden,
    limit_ingredients: [
      ...limits.high_phosphorus_foods_limit,
      `sodium: max ${limits.sodium_mg_per_day_max}mg/day`,
      limits.fluid_ml_per_day_max
        ? `fluid: max ${limits.fluid_ml_per_day_max}ml/day (all liquids included)`
        : "",
    ].filter(Boolean),
    mandatory_nutrients: [
      `protein: ${limits.protein_g_per_kg_ideal_bw.min}–${limits.protein_g_per_kg_ideal_bw.max}g/kg ideal body weight/day`,
      `potassium: max ${limits.potassium_mg_per_day_max}mg/day`,
      `phosphorus: max ${limits.phosphorus_mg_per_day_max}mg/day`,
      `calories: 35 kcal/kg/day (adequate — avoid malnutrition)`,
    ],
    special_instructions: buildCKDInstruction(stage, limits, isDialysis),
  };
}

function buildCKDInstruction(
  stage: CKDStageId,
  limits: CKDNutrientLimits,
  isDialysis: boolean
): string {
  const stageLabel: Record<CKDStageId, string> = {
    ckd_stage_1_2: "CKD Stage 1–2 (eGFR > 60)",
    ckd_stage_3a: "CKD Stage 3a (eGFR 45–59)",
    ckd_stage_3b: "CKD Stage 3b (eGFR 30–44)",
    ckd_stage_4: "CKD Stage 4 (eGFR 15–29 — Pre-dialysis)",
    ckd_stage_5: "CKD Stage 5 (eGFR < 15 — Conservative Management)",
    ckd_stage_5_dialysis: "CKD Stage 5 — ON DIALYSIS",
  };

  let instruction = `${stageLabel[stage]}:\n`;

  if (isDialysis) {
    instruction +=
      `⚠️ DIALYSIS PROTEIN REVERSAL: Unlike all other CKD stages, dialysis patients need ` +
      `HIGH protein (${limits.protein_g_per_kg_ideal_bw.min}–${limits.protein_g_per_kg_ideal_bw.max}g/kg/day). ` +
      `Include dal, paneer, egg white, or other protein at EVERY meal.\n`;
  } else {
    instruction +=
      `PROTEIN RESTRICTION: ${limits.protein_g_per_kg_ideal_bw.min}–${limits.protein_g_per_kg_ideal_bw.max}g/kg/day. ` +
      `${limits.protein_note}\n`;
  }

  instruction +=
    `POTASSIUM LIMIT: ${limits.potassium_mg_per_day_max}mg/day. Forbidden: ${limits.high_potassium_foods_forbidden.slice(0, 5).join(", ")}.\n` +
    `Safe: ${limits.low_potassium_foods_safe.slice(0, 5).join(", ")}.\n` +
    `PHOSPHORUS LIMIT: ${limits.phosphorus_mg_per_day_max}mg/day. ${limits.phosphorus_note}\n` +
    `SODIUM LIMIT: ${limits.sodium_mg_per_day_max}mg/day. ${limits.sodium_note}\n`;

  if (limits.fluid_ml_per_day_max) {
    instruction +=
      `FLUID LIMIT: ${limits.fluid_ml_per_day_max}ml/day TOTAL. ` +
      `This includes water, chai, milk, dal water, rasam, juice — EVERYTHING liquid.\n`;
  }

  if (["ckd_stage_3b", "ckd_stage_4", "ckd_stage_5", "ckd_stage_5_dialysis"].includes(stage)) {
    instruction += `LEACHING REQUIRED: All vegetables must be leached before cooking (soak, drain, boil in fresh water, discard that water too).\n`;
  }

  instruction +=
    `CALORIE PRIORITY: 35 kcal/kg/day. Primary energy from white rice, roti, and cooking oil — not protein. Malnutrition is a real risk.`;

  if (limits.dialysis_specific_notes) {
    instruction += `\nDIALYSIS SPECIFIC: ${limits.dialysis_specific_notes}`;
  }

  return instruction;
}

// =============================================================================
// SECTION 5: CKD DETECTOR FUNCTION
// Call in conflict-engine.ts to detect which CKD stage a member has.
// =============================================================================

export interface CKDConflictCheck {
  memberName: string;
  hasCKD: boolean;
  ckdStage: CKDStageId | null;
  isDialysis: boolean;
  proteinConflicts: string[];   // Conflicts with other members' protein needs
  potassiumCritical: boolean;
  conflictDescriptions: string[];
  instructionStrings: string[];
  stageLimits: CKDNutrientLimits | null;
}

export function detectCKDConflicts(
  profile: EffectiveMemberProfile,
  allProfiles: EffectiveMemberProfile[]
): CKDConflictCheck {
  // Detect CKD stage
  const ckdStage = profile.effectiveHealthConditions.find(
    (c): c is CKDStageId => CKD_STAGE_IDS.includes(c as CKDStageId)
  ) ?? null;

  // Also check old "kidney_issues" generic — treat as Stage 3a if no staging given
  const hasOldKidneyIssues = !ckdStage && profile.effectiveHealthConditions.includes("kidney_issues");
  const effectiveStage: CKDStageId | null = ckdStage ?? (hasOldKidneyIssues ? "ckd_stage_3a" : null);

  if (!effectiveStage) {
    return {
      memberName: profile.name,
      hasCKD: false,
      ckdStage: null,
      isDialysis: false,
      proteinConflicts: [],
      potassiumCritical: false,
      conflictDescriptions: [],
      instructionStrings: [],
      stageLimits: null,
    };
  }

  const limits = CKD_STAGE_LIMITS[effectiveStage];
  const conflictDescriptions: string[] = [];
  const instructionStrings: string[] = [];
  const proteinConflicts: string[] = [];

  // If using old "kidney_issues" without staging — flag this
  if (hasOldKidneyIssues && !ckdStage) {
    conflictDescriptions.push(
      `${profile.name} has "kidney_issues" set without a CKD stage. ` +
      `The engine is using Stage 3a (eGFR 45–59) as a default. ` +
      `For accurate meal planning, ask the user to specify their CKD stage. ` +
      `IMPORTANT: CKD Stage 5 dialysis has OPPOSITE protein rules to other stages.`
    );
  }

  // Protein conflict with muscle-building or high-protein members
  const highProteinMembers = allProfiles.filter(
    (p) =>
      p.id !== profile.id &&
      (p.effectiveGoal === "build_muscle" || p.effectiveGoal === "weight_gain")
  );

  if (highProteinMembers.length > 0 && !limits.is_dialysis) {
    for (const hp of highProteinMembers) {
      proteinConflicts.push(
        `${profile.name} (CKD: ${effectiveStage}) needs LOW protein ` +
        `(${limits.protein_g_per_kg_ideal_bw.min}–${limits.protein_g_per_kg_ideal_bw.max}g/kg). ` +
        `${hp.name} needs HIGH protein for ${hp.effectiveGoal}. ` +
        `Resolution: Shared low-protein base dish. Extra protein sides (paneer, egg) exclusively on ${hp.name}'s plate.`
      );
    }
  }

  if (limits.is_dialysis) {
    const restrictedProteinMembers = allProfiles.filter(
      (p) =>
        p.id !== profile.id &&
        p.effectiveHealthConditions.some(c =>
          c === "kidney_issues" || (c.startsWith("ckd_") && c !== "ckd_stage_5_dialysis")
        )
    );
    if (restrictedProteinMembers.length > 0) {
      conflictDescriptions.push(
        `${profile.name} is on DIALYSIS (needs HIGH protein: ${limits.protein_g_per_kg_ideal_bw.min}g/kg) ` +
        `while ${restrictedProteinMembers.map(p => p.name).join(", ")} has CKD without dialysis (needs LOW protein). ` +
        `These are OPPOSITE requirements. Separate protein preparations are mandatory.`
      );
    }
  }

  // Build instruction strings for Gemini
  instructionStrings.push(
    `[CKD ${effectiveStage.toUpperCase()}] ${profile.name}: ` +
    (limits.is_dialysis
      ? `⚠️ ON DIALYSIS — PROTEIN INCREASES to ${limits.protein_g_per_kg_ideal_bw.min}–${limits.protein_g_per_kg_ideal_bw.max}g/kg/day. Include protein at every meal.`
      : `Protein LIMITED to ${limits.protein_g_per_kg_ideal_bw.min}–${limits.protein_g_per_kg_ideal_bw.max}g/kg/day.`) +
    ` Potassium max: ${limits.potassium_mg_per_day_max}mg/day. Phosphorus max: ${limits.phosphorus_mg_per_day_max}mg/day. Sodium max: ${limits.sodium_mg_per_day_max}mg/day.` +
    (limits.fluid_ml_per_day_max ? ` FLUID max: ${limits.fluid_ml_per_day_max}ml/day (ALL liquids).` : "")
  );

  if (["ckd_stage_3b", "ckd_stage_4", "ckd_stage_5", "ckd_stage_5_dialysis"].includes(effectiveStage)) {
    instructionStrings.push(
      `[CKD LEACHING MANDATORY] ${profile.name}: All vegetables must be leached before cooking. ` +
      LEACHING_TECHNIQUE_INSTRUCTION
    );
  }

  instructionStrings.push(
    `[CKD FORBIDDEN FOODS for ${profile.name}]: ` +
    limits.high_potassium_foods_forbidden.join(", ")
  );

  instructionStrings.push(
    `[CKD SAFE FOODS for ${profile.name}]: ` +
    limits.low_potassium_foods_safe.join(", ")
  );

  const potassiumCritical =
    effectiveStage === "ckd_stage_4" ||
    effectiveStage === "ckd_stage_5" ||
    effectiveStage === "ckd_stage_5_dialysis";

  return {
    memberName: profile.name,
    hasCKD: true,
    ckdStage: effectiveStage,
    isDialysis: limits.is_dialysis,
    proteinConflicts,
    potassiumCritical,
    conflictDescriptions,
    instructionStrings,
    stageLimits: limits,
  };
}
