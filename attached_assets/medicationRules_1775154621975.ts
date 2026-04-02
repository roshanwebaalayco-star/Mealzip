// =============================================================================
// NutriNext ParivarSehat — Static Medication Absorption Window Rules
// src/lib/medicationRules.ts
//
// THIS IS NOT AI LOGIC. This is a hardcoded, medically-reviewed pharmacology
// lookup table. Every rule here is deterministic and medically defensible.
// Sources: CIMS India, Medscape Drug Interactions, WHO Essential Medicines List,
//          Jan Aushadhi formulary, standard Indian clinical pharmacology.
//
// THE ARCHITECTURE PRINCIPLE:
//   Gemini never makes the medication decision — this code does.
//   Gemini receives FINISHED constraint strings. It obeys them as hard rules.
//   The constraint strings are already formatted for maximum LLM compliance.
//
// HOW IT WORKS:
//   1. User enters "Metformin with breakfast, Iron pill at night" (free text)
//   2. parseMedicationTiming() extracts structured timing from free text
//   3. matchMedicationRule() finds the correct MedicationRule via keyword match
//   4. buildGuardrailStrings() converts the rule into ready-to-inject directives
//   5. conflict-engine.ts appends these to ConstraintPacket.medicationWarnings
//   6. prompt-chain.ts injects them verbatim under MEDICATION GUARDRAILS section
// =============================================================================

import type {
  MedicationRule,
  MedicationSlotConstraint,
  MedicationWeeklyMonitor,
  ParsedMedicationTiming,
  MedicationGuardrailBundle,
} from "../../types";

// =============================================================================
// SECTION 1: THE STATIC RULES MAP
// Keyed by a canonical drug_id for O(1) lookup after keyword matching.
// Order of entries does not matter — matching is done via match_keywords.
// =============================================================================

export const MEDICATION_RULES: Record<string, MedicationRule> = {

  // ---------------------------------------------------------------------------
  // METFORMIN (Glucophage, Glycomet, Obimet, Gluformin)
  // Most prescribed drug in India for Type-2 Diabetes.
  // Mechanism: Must be taken WITH or IMMEDIATELY AFTER food to prevent nausea
  //            and GI distress. High-sugar/high-carb meals defeat its purpose.
  // ---------------------------------------------------------------------------
  metformin: {
    drug_id: "metformin",
    display_name: "Metformin",
    match_keywords: ["metformin", "glucophage", "glycomet", "obimet", "gluformin", "gluconorm"],
    match_regex: /metform/i,

    slot_constraints: [
      {
        slot: "breakfast",
        must_have_food: true,
        must_have_solid_food: true, // Tea alone is NOT enough. A real meal is required.
        forbidden_ingredients: [
          "white sugar", "refined sugar", "jaggery in excess", "fruit juice",
          "cold drinks", "sweet lassi", "mithai", "halwa",
        ],
        forbidden_categories: ["high_glycaemic_index", "added_sugar", "sugary_beverages"],
        positive_requirements: [
          "complex carbohydrates (oats, poha, whole wheat roti)",
          "protein source (eggs, dal, curd)",
        ],
        timing_instruction:
          "Take Metformin DURING or immediately AFTER this meal — not before, not on empty stomach.",
      },
    ],

    // If user noted "Metformin with dinner" — apply same solid-food rule to dinner
    dynamic_slot_rule: {
      forbidden_ingredients: ["white sugar", "refined sugar", "fruit juice", "cold drinks"],
      must_have_solid_food: true,
      timing_instruction: "Take Metformin DURING or immediately AFTER this meal.",
    },

    weekly_monitor: null, // No weekly consistency concern

    scheduling_note:
      "Metformin is timing-flexible (breakfast, lunch, or dinner) but the meal it is paired with MUST be a full, solid meal — " +
      "never a liquid-only or sugar-heavy meal. If user has it with dinner, apply the same rule to dinner slot.",

    clinical_reason:
      "Metformin taken on an empty stomach or with a high-sugar meal causes lactic acidosis risk and severe GI side effects (nausea, vomiting, diarrhoea). " +
      "High-sugar meals also counteract its primary mechanism of reducing hepatic glucose output.",

    harmony_score_addition: 3, // Correctly scheduling this earns +3 per spec
  },

  // ---------------------------------------------------------------------------
  // IRON / FERROUS SULPHATE (Feronia, Haemup, Ferium, Tardyferon, Fersolate)
  // Extremely common in India — anaemia affects ~50% of Indian women.
  // Mechanism: Calcium, tannins (tea/coffee), and fibre block iron absorption
  //            by 30–90%. Must be taken on empty stomach OR away from calcium.
  // ---------------------------------------------------------------------------
  iron_supplement: {
    drug_id: "iron_supplement",
    display_name: "Iron Supplement (Ferrous Sulphate)",
    match_keywords: [
      "iron", "ferrous", "ferric", "haemup", "ferium", "tardyferon",
      "fersolate", "feronia", "fe supplement", "iron tablet",
    ],
    match_regex: /ferr(ous|ic)|iron\s*(tablet|supplement|pill|cap)/i,

    slot_constraints: [
      {
        // Empty stomach or morning = best absorption
        slot: "breakfast",
        must_have_food: false, // Can be taken on empty stomach
        must_have_solid_food: false,
        forbidden_ingredients: [
          // Calcium blockers
          "milk", "doodh", "paneer", "curd", "dahi", "ghee", "cream", "buttermilk",
          "chaas", "raita", "kheer", "rabri", "lassi", "cheese",
          // Tannin blockers
          "tea", "chai", "coffee", "black tea", "green tea",
          // Other absorption blockers
          "antacid", "calcium supplement", "zinc supplement",
          "whole grain cereals in large quantity", "bran",
        ],
        forbidden_categories: ["dairy", "caffeinated_beverages", "calcium_rich"],
        positive_requirements: [
          "Vitamin C source — lemon juice, amla, raw tomato, orange",
          "(Vitamin C converts Fe³⁺ to Fe²⁺, increasing absorption by up to 3x)",
        ],
        timing_instruction:
          "Take iron tablet on empty stomach OR 30 min BEFORE this meal for maximum absorption. " +
          "If stomach upset occurs, take with a small non-dairy, non-caffeinated snack.",
      },
      {
        // If user takes it at night / dinner slot — apply same calcium/tannin block
        slot: "dinner",
        must_have_food: false,
        must_have_solid_food: false,
        forbidden_ingredients: [
          "milk", "paneer", "curd", "dahi", "tea", "chai", "coffee",
          "cheese", "calcium supplement",
        ],
        forbidden_categories: ["dairy", "caffeinated_beverages"],
        positive_requirements: ["Vitamin C source — lemon wedge, raw tomato"],
        timing_instruction:
          "If iron is scheduled at night, ensure dinner does NOT contain dairy or tea. " +
          "Iron at 9 PM → dinner must be served by 7:30 PM at the latest (to maintain 1.5hr gap).",
      },
    ],

    // CROSS-SLOT RULE: Calcium supplement must be separated by ≥2 hours
    cross_slot_conflict: {
      conflicts_with_drug_ids: ["calcium_supplement"],
      minimum_gap_hours: 2,
      directive:
        "IRON + CALCIUM CONFLICT: Iron tablet and calcium supplement must be separated by minimum 2 hours. " +
        "Schedule iron in the morning slot and calcium in the afternoon/evening slot. Never in the same meal.",
    },

    weekly_monitor: null,

    scheduling_note:
      "Ideal schedule: Iron on empty stomach at 7:00 AM. Breakfast (WITHOUT dairy/tea) at 7:30 AM. " +
      "If iron is taken at night, set a hard rule: dinner must NOT contain milk, paneer, curd, or tea, " +
      "and dinner must be served by 7:30 PM if iron is scheduled at 9 PM.",

    clinical_reason:
      "Calcium (in dairy) competes directly with iron at intestinal absorption sites, reducing absorption by 30–60%. " +
      "Tannins in tea and coffee form insoluble iron-tannate complexes, reducing absorption by up to 90%. " +
      "Vitamin C (ascorbic acid) reduces Fe³⁺ to Fe²⁺ and chelates it, tripling absorption.",

    harmony_score_addition: 3,
  },

  // ---------------------------------------------------------------------------
  // LEVOTHYROXINE / THYROXINE (Eltroxin, Thyronorm, Thyrox)
  // Prescribed for hypothyroidism — extremely common in Indian women.
  // CRITICAL timing: Must be taken 30–60 min before ANY food, on empty stomach.
  // This means breakfast itself must be DELAYED by 30–60 minutes.
  // ---------------------------------------------------------------------------
  levothyroxine: {
    drug_id: "levothyroxine",
    display_name: "Levothyroxine (Thyroid Hormone)",
    match_keywords: [
      "levothyroxine", "thyroxine", "eltroxin", "thyronorm", "thyrox",
      "thyroid tablet", "thyroid medication", "thyroid pill",
    ],
    match_regex: /levo?thyroxine|thyronorm|eltroxin|thyrox|thyroid\s*(tablet|pill|med)/i,

    slot_constraints: [
      {
        slot: "breakfast",
        must_have_food: false, // MUST NOT have food immediately — medication taken first
        must_have_solid_food: false,
        forbidden_ingredients: [
          // Absorption blockers that MUST be spaced ≥4 hours from medication
          "soya chunks", "nutrela", "soya milk", "tofu", "soya flour", "edamame",
          // Calcium blockers (≥4 hours gap)
          "milk", "doodh", "paneer", "curd", "dahi", "cheese", "cream",
          // Fibre/goitrogen blockers (within 30 min)
          "high-fibre cereals", "bran", "psyllium husk",
          // Coffee is a known absorption blocker
          "coffee",
        ],
        forbidden_categories: ["soy_products", "high_calcium_dairy", "caffeinated_coffee"],
        positive_requirements: [],
        timing_instruction:
          "⏰ LEVOTHYROXINE SCHEDULE: Take tablet on empty stomach with plain water at wake-up. " +
          "Wait 30–60 minutes before eating ANY food. Breakfast must be scheduled AFTER this window. " +
          "The breakfast meal itself must be dairy-free and soy-free.",
      },
    ],

    // Special: affects ALL meal slots for soy products on same day
    day_wide_restrictions: {
      avoid_entirely_today: [
        "soya chunks", "nutrela", "tofu", "soya milk",
        "raw cabbage", "raw broccoli", "raw cauliflower (in large amounts)",
      ],
      directive:
        "SOY-FREE DAY MANDATE for {memberName}: Soy products interfere with thyroid hormone synthesis throughout the day, " +
        "not just at breakfast. Remove soy from all meal slots for this member.",
    },

    weekly_monitor: {
      ingredient_category: "goitrogen_foods",
      ingredients: [
        "cabbage", "patta gobhi", "broccoli", "cauliflower", "phool gobhi",
        "kale", "radish", "mooli", "soybean", "millet in large excess",
      ],
      rule: "limit_frequency",
      max_meals_per_week: 2,
      directive:
        "GOITROGEN WEEKLY CAP for {memberName} (Levothyroxine): Cruciferous vegetables must appear " +
        "NO MORE THAN 2 MEALS this week, and ALWAYS cooked — never raw. " +
        "Cooking inactivates the goitrogenic compounds.",
    },

    scheduling_note:
      "MEAL TIMING SHIFT REQUIRED: For a member on Levothyroxine, the breakfast slot is structurally delayed. " +
      "If the family's normal breakfast is 7:30 AM, this member eats at 8:00–8:30 AM. " +
      "The meal plan must note this timing shift explicitly in the breakfast slot instructions.",

    clinical_reason:
      "Levothyroxine absorption from the gut is highly sensitive. Calcium (dairy) and iron reduce absorption by 20–40%. " +
      "Soy isoflavones inhibit the enzyme deiodinase that converts T4 to active T3. " +
      "Coffee reduces absorption by 30% by adsorbing to the tablet surface. " +
      "Food in general reduces absorption — 30-60 min fasting window is standard clinical protocol.",

    harmony_score_addition: 3,
  },

  // ---------------------------------------------------------------------------
  // WARFARIN (Coumadin, Acitrom — used in India)
  // Anticoagulant for AF, DVT, mechanical heart valves.
  // CRITICAL: Not about eliminating Vitamin K — it's about CONSISTENCY.
  // A sudden spike or drop in leafy green intake changes the INR unpredictably.
  // ---------------------------------------------------------------------------
  warfarin: {
    drug_id: "warfarin",
    display_name: "Warfarin / Acitrom (Blood Thinner)",
    match_keywords: [
      "warfarin", "acitrom", "coumadin", "blood thinner", "anticoagulant",
    ],
    match_regex: /warfarin|acitrom|coumad/i,

    slot_constraints: [
      {
        slot: "all",
        must_have_food: true,
        must_have_solid_food: true,
        forbidden_ingredients: [
          // These are NOT forbidden — they must be CONSISTENT.
          // The real constraint is handled by the weekly_monitor below.
          // At individual meal level: avoid SUDDEN LARGE DOSES of VitK foods.
          "spinach juice (raw concentrated)", "palak juice", "kale shots",
          "concentrated green supplements", "spirulina", "wheatgrass shots",
        ],
        forbidden_categories: ["concentrated_vitamin_k_supplements"],
        positive_requirements: [],
        timing_instruction:
          "Take with food. DO NOT suddenly change leafy green vegetable intake this week — " +
          "consistency in Vitamin K is more important than elimination.",
      },
    ],

    weekly_monitor: {
      ingredient_category: "high_vitamin_k_foods",
      ingredients: [
        "spinach", "palak", "methi", "fenugreek leaves", "bathua", "sarson ka saag",
        "mustard leaves", "kale", "broccoli", "cabbage (cooked)", "Brussels sprouts",
        "cauliflower leaves", "curry leaves in large amount",
      ],
      rule: "keep_consistent",
      // Target: 2–3 servings per week, same as every week. NOT zero.
      max_meals_per_week: 3,
      directive:
        "WARFARIN VITAMIN-K CONSISTENCY MANDATE for {memberName}: " +
        "Vitamin K foods (spinach, methi, palak, sarson, broccoli) must appear in EXACTLY 2–3 meals this week — " +
        "NO MORE, NO FEWER. Do NOT eliminate leafy greens (this causes INR to spike). " +
        "Do NOT suddenly increase them (this causes INR to drop). CONSISTENCY is the medical imperative. " +
        "This is more important than any variety or zero-waste consideration for this member.",
    },

    scheduling_note:
      "Warfarin INR is monitored weekly in clinical settings. The meal plan must maintain the same " +
      "leafy green frequency as the previous week. If week 1 had palak 3 times, week 2 must also have palak 3 times. " +
      "Flag to user: 'Warfarin detected — maintaining consistent Vitamin K intake across the week (2–3 servings palak/methi).'",

    clinical_reason:
      "Warfarin competes with Vitamin K in the coagulation cascade. Sudden increases in dietary Vitamin K " +
      "reduce warfarin's anticoagulant effect (INR drops = clotting risk). Sudden decreases amplify warfarin's effect " +
      "(INR rises = bleeding risk). The therapeutic goal is INR stability, which requires dietary Vitamin K CONSISTENCY — " +
      "not elimination. This is a nuanced, widely misunderstood interaction even among non-specialist clinicians.",

    harmony_score_addition: 3,
  },

  // ---------------------------------------------------------------------------
  // AMLODIPINE (Amlopress, Amlodac, Norvasc)
  // Calcium channel blocker for hypertension and angina.
  // One specific food interaction: grapefruit / pomelo (rarely consumed in India
  // but increasingly available in urban supermarkets and smoothie bars).
  // ---------------------------------------------------------------------------
  amlodipine: {
    drug_id: "amlodipine",
    display_name: "Amlodipine (Calcium Channel Blocker)",
    match_keywords: [
      "amlodipine", "amlopress", "amlodac", "norvasc", "amlosafe",
      "calcium channel blocker", "ccb", "felodipine",
    ],
    match_regex: /amlodip|amlopress|norvasc|felodip/i,

    slot_constraints: [
      {
        slot: "all",
        must_have_food: false,
        must_have_solid_food: false,
        forbidden_ingredients: [
          "grapefruit", "pomelo", "chakotara",
          "grapefruit juice", "pomelo juice",
          "grapefruit flavoured drinks", "citrus cocktails with grapefruit",
        ],
        forbidden_categories: ["grapefruit_pomelo"],
        positive_requirements: [],
        timing_instruction:
          "AMLODIPINE: Take once daily at the same time each day. No food timing restriction. " +
          "ABSOLUTE BAN: Grapefruit and pomelo in ANY form, ANY meal, ALL week. " +
          "This applies to juices, raw fruit, and flavoured beverages.",
      },
    ],

    // In the Indian context, flag the specific risk vector
    regional_flag:
      "In urban Indian supermarkets and juice bars, grapefruit is sometimes mixed into 'vitamin C shots' " +
      "and citrus smoothies without clear labelling. Flag any recipe using 'citrus mix' or 'vitamin C fruits'.",

    weekly_monitor: {
      ingredient_category: "grapefruit_pomelo",
      ingredients: ["grapefruit", "pomelo", "chakotara", "grapefruit juice"],
      rule: "avoid_entirely",
      max_meals_per_week: 0,
      directive:
        "AMLODIPINE — GRAPEFRUIT ZERO-TOLERANCE for {memberName}: " +
        "Grapefruit and pomelo must appear ZERO TIMES in the entire 7-day plan. " +
        "This is an absolute interaction — not a preference. " +
        "Grapefruit inhibits CYP3A4, the enzyme that metabolises amlodipine, causing dangerous plasma level spikes.",
    },

    scheduling_note:
      "Amlodipine has a long half-life (30–50 hrs). Food timing does not matter. " +
      "The ONLY dietary constraint is complete grapefruit/pomelo avoidance. " +
      "Other citrus (lemon, orange, mosambi, amla) are safe and beneficial for hypertension.",

    clinical_reason:
      "Grapefruit contains furanocoumarins that irreversibly inhibit CYP3A4 (intestinal cytochrome P450). " +
      "This prevents first-pass metabolism of amlodipine, increasing plasma concentration by 20–200%. " +
      "Result: excessive blood pressure drop (hypotension), reflex tachycardia. " +
      "The effect persists for 24–72 hours after a single grapefruit serving.",

    harmony_score_addition: 3,
  },

  // ---------------------------------------------------------------------------
  // STATINS (Atorvastatin, Rosuvastatin, Simvastatin — Lipitor, Crestor, Tonact)
  // Already in old matrix — enhanced here.
  // ---------------------------------------------------------------------------
  statin: {
    drug_id: "statin",
    display_name: "Statin (Cholesterol Medication)",
    match_keywords: [
      "atorvastatin", "rosuvastatin", "simvastatin", "pitavastatin",
      "lipitor", "crestor", "tonact", "rozavel", "statin",
    ],
    match_regex: /statin|atorvas|rosvas|simvas|lipitor|crestor|tonact/i,

    slot_constraints: [
      {
        slot: "dinner",
        must_have_food: true,
        must_have_solid_food: false,
        forbidden_ingredients: [
          "grapefruit", "pomelo", "chakotara", "grapefruit juice",
        ],
        forbidden_categories: ["grapefruit_pomelo"],
        positive_requirements: [],
        timing_instruction:
          "Most statins are taken at night (except rosuvastatin, which can be taken any time). " +
          "Take with or after dinner. ABSOLUTE BAN on grapefruit/pomelo at any meal.",
      },
    ],

    weekly_monitor: {
      ingredient_category: "grapefruit_pomelo",
      ingredients: ["grapefruit", "pomelo", "chakotara"],
      rule: "avoid_entirely",
      max_meals_per_week: 0,
      directive:
        "STATIN — GRAPEFRUIT ZERO-TOLERANCE for {memberName}: Same CYP3A4 inhibition mechanism as Amlodipine. " +
        "Zero grapefruit/pomelo in the entire week.",
    },

    scheduling_note: "Take statin at night for maximum effectiveness (cholesterol synthesis peaks at night).",
    clinical_reason:
      "Grapefruit furanocoumarins inhibit CYP3A4, dramatically increasing statin plasma levels → rhabdomyolysis risk.",
    harmony_score_addition: 3,
  },

  // ---------------------------------------------------------------------------
  // CALCIUM SUPPLEMENT (Shelcal, Carcium, Calcirol)
  // ---------------------------------------------------------------------------
  calcium_supplement: {
    drug_id: "calcium_supplement",
    display_name: "Calcium Supplement",
    match_keywords: [
      "calcium", "shelcal", "carcium", "calcirol", "calcimax",
      "calcium carbonate", "calcium citrate",
    ],
    match_regex: /calcium|shelcal|carcium|calcirol/i,

    slot_constraints: [
      {
        slot: "all",
        must_have_food: true,
        must_have_solid_food: true, // Must be with meals for carbonate form
        forbidden_ingredients: ["iron supplement (simultaneous)", "zinc supplement (simultaneous)"],
        forbidden_categories: ["concurrent_mineral_supplements"],
        positive_requirements: ["Vitamin D source (sunlight exposure or fortified food)"],
        timing_instruction:
          "Calcium carbonate: MUST be taken WITH food (requires stomach acid). " +
          "Calcium citrate: can be taken without food. " +
          "Keep minimum 2-hour gap from iron supplement.",
      },
    ],

    weekly_monitor: null,
    scheduling_note:
      "Do not co-administer calcium and iron supplements in the same meal. " +
      "Split: calcium with breakfast, iron supplement 2+ hours later or at night.",
    clinical_reason:
      "Calcium carbonate requires gastric acid for dissolution — food stimulates acid secretion. " +
      "Concurrent iron and calcium compete for intestinal absorption.",
    harmony_score_addition: 3,
  },

  // ---------------------------------------------------------------------------
  // PPIs / ANTACIDS (Pantoprazole, Omeprazole, Pan-D, Rabeprazole)
  // ---------------------------------------------------------------------------
  ppi_antacid: {
    drug_id: "ppi_antacid",
    display_name: "PPI / Antacid (Pantoprazole, Omeprazole)",
    match_keywords: [
      "pantoprazole", "omeprazole", "rabeprazole", "lansoprazole",
      "pan-d", "pantop", "omez", "ppi", "antacid", "ranitidine", "famotidine",
    ],
    match_regex: /pantoprazole|omeprazole|rabeprazole|pan[\s-]?d|omez|antacid|ppi/i,

    slot_constraints: [
      {
        slot: "breakfast",
        must_have_food: false,
        must_have_solid_food: false,
        forbidden_ingredients: [],
        forbidden_categories: [],
        positive_requirements: [],
        timing_instruction:
          "PPI must be taken 30–60 minutes BEFORE the first meal for maximum acid suppression. " +
          "The breakfast slot itself has no restrictions.",
      },
    ],

    weekly_monitor: null,
    scheduling_note:
      "Take PPI 30 minutes before breakfast, NOT with food. This is commonly misunderstood. " +
      "The pre-meal window allows the drug to activate proton pumps before they are stimulated by food.",
    clinical_reason:
      "PPIs work by irreversibly binding H⁺/K⁺-ATPase (proton pumps) during their active phase. " +
      "Proton pumps are activated by food stimulation. Taking PPI 30 min before a meal catches pumps " +
      "at their activation peak, maximising efficacy. Taking after food is 40–50% less effective.",
    harmony_score_addition: 3,
  },

  // ---------------------------------------------------------------------------
  // ACE INHIBITORS (Lisinopril, Ramipril, Enalapril — Cardace, Zestril)
  // ---------------------------------------------------------------------------
  ace_inhibitor: {
    drug_id: "ace_inhibitor",
    display_name: "ACE Inhibitor (Lisinopril, Ramipril)",
    match_keywords: [
      "lisinopril", "ramipril", "enalapril", "perindopril",
      "cardace", "zestril", "ace inhibitor",
    ],
    match_regex: /lisinopril|ramipril|enalapril|cardace|zestril|ace\s*inhibit/i,

    slot_constraints: [
      {
        slot: "all",
        must_have_food: false,
        must_have_solid_food: false,
        forbidden_ingredients: [
          "potassium chloride (KCl) salt substitute",
          "salt substitute (low-sodium salt)",
          "potassium supplements",
        ],
        forbidden_categories: ["potassium_chloride_salt_substitutes"],
        positive_requirements: [],
        timing_instruction:
          "CRITICAL: Do NOT use potassium-chloride (KCl) salt substitutes with ACE inhibitors. " +
          "Regular iodised salt in controlled amounts is safe. Potassium-rich foods (banana, potato) — moderate, not eliminate.",
      },
    ],

    weekly_monitor: {
      ingredient_category: "high_potassium_foods",
      ingredients: [
        "banana", "kela", "coconut water", "nariyal paani",
        "potato in excess", "tomato paste in large quantity",
        "orange juice concentrated", "beans in very large quantity",
      ],
      rule: "limit_frequency",
      max_meals_per_week: 4,
      directive:
        "ACE INHIBITOR — POTASSIUM MODERATION for {memberName}: " +
        "ACE inhibitors raise serum potassium (hyperkalaemia risk). " +
        "High-potassium foods (banana, coconut water, potato-heavy meals) must be MODERATED — " +
        "maximum 3–4 servings per week. Do NOT use KCl-based 'low sodium salt' as a table salt substitute.",
    },

    scheduling_note:
      "ACE inhibitors are well-tolerated with any food. The primary dietary concern is potassium load, " +
      "not meal timing. Avoid KCl salt substitutes in ALL recipes for this member.",
    clinical_reason:
      "ACE inhibitors block aldosterone, which normally excretes potassium. " +
      "Combined with a high-potassium diet or KCl salt substitute (commonly used in low-sodium cooking), " +
      "this causes hyperkalaemia — potentially life-threatening cardiac arrhythmia.",
    harmony_score_addition: 3,
  },

  // ---------------------------------------------------------------------------
  // MAOI (Phenelzine — rare but still used in India for depression)
  // ---------------------------------------------------------------------------
  maoi: {
    drug_id: "maoi",
    display_name: "MAOI (Monoamine Oxidase Inhibitor)",
    match_keywords: [
      "maoi", "phenelzine", "tranylcypromine", "selegiline", "monoamine oxidase",
    ],
    match_regex: /maoi|phenelzine|tranylcyprom|selegiline|monoamine/i,

    slot_constraints: [
      {
        slot: "all",
        must_have_food: true,
        must_have_solid_food: false,
        forbidden_ingredients: [
          // Tyramine-rich foods — cause hypertensive crisis with MAOIs
          "aged cheese", "matured paneer", "blue cheese", "feta (aged)",
          "fermented foods", "achaar", "pickles", "kimchi",
          "soy sauce", "miso", "fermented soya", "tempeh",
          "smoked or cured meat", "salami", "sausage",
          "tap beer", "red wine", "champagne",
          "banana peel (banana flesh is borderline — limit)",
          "avocado in excess",
        ],
        forbidden_categories: [
          "tyramine_rich", "aged_fermented_foods", "cured_meats",
        ],
        positive_requirements: ["fresh, unprocessed foods only"],
        timing_instruction:
          "MAOI — TYRAMINE CRITICAL RESTRICTION: ALL meals this week must be made from FRESH, UNPROCESSED ingredients. " +
          "No pickles, no aged paneer, no fermented anything. This is a hypertensive crisis risk.",
      },
    ],

    weekly_monitor: {
      ingredient_category: "tyramine_rich_foods",
      ingredients: [
        "pickles", "achaar", "aged cheese", "fermented foods", "soy sauce",
      ],
      rule: "avoid_entirely",
      max_meals_per_week: 0,
      directive:
        "MAOI — TYRAMINE ZERO TOLERANCE for {memberName}: " +
        "Zero tyramine-rich foods in the entire week. " +
        "This is a life-threatening interaction — hypertensive crisis. " +
        "Fresh cooking from raw ingredients ONLY.",
    },

    scheduling_note:
      "MAOI on the member profile is an immediate flag to the generation engine. " +
      "The entire meal plan for this member must use ONLY fresh ingredients. " +
      "No shortcuts with readymade pastes, sauces, or pickles.",
    clinical_reason:
      "MAOIs block monoamine oxidase, which normally breaks down tyramine in the gut and liver. " +
      "Unmetabolised tyramine from fermented/aged foods triggers massive norepinephrine release, " +
      "causing acute hypertensive crisis — severe headache, stroke risk, potentially fatal.",
    harmony_score_addition: 3,
  },

};

// =============================================================================
// SECTION 2: MEDICATION TIMING PARSER
// Parses free-text timing strings like "Metformin with breakfast" or
// "Iron pill at night" into structured ParsedMedicationTiming objects.
// This is pure regex — no AI involved.
// =============================================================================

const TIMING_PATTERNS: Array<{
  pattern: RegExp;
  slot: "breakfast" | "lunch" | "dinner" | "snack" | "empty_stomach" | "morning" | "night";
  relation: "with" | "before" | "after" | "at";
}> = [
  { pattern: /with[\s_]?breakfast|during[\s_]?breakfast|at[\s_]?breakfast/i, slot: "breakfast", relation: "with" },
  { pattern: /before[\s_]?breakfast|prior[\s_]?to[\s_]?breakfast/i,           slot: "breakfast", relation: "before" },
  { pattern: /after[\s_]?breakfast/i,                                          slot: "breakfast", relation: "after" },
  { pattern: /with[\s_]?lunch|during[\s_]?lunch|at[\s_]?lunch/i,             slot: "lunch",     relation: "with" },
  { pattern: /before[\s_]?lunch/i,                                            slot: "lunch",     relation: "before" },
  { pattern: /after[\s_]?lunch/i,                                             slot: "lunch",     relation: "after" },
  { pattern: /with[\s_]?dinner|during[\s_]?dinner|at[\s_]?dinner/i,          slot: "dinner",    relation: "with" },
  { pattern: /before[\s_]?dinner/i,                                           slot: "dinner",    relation: "before" },
  { pattern: /after[\s_]?dinner/i,                                            slot: "dinner",    relation: "after" },
  { pattern: /at[\s_]?night|night[\s_]?time|before[\s_]?bed|bedtime/i,        slot: "night",    relation: "at" },
  { pattern: /empty[\s_]?stomach|fasting|morning[\s_]?empty/i,                slot: "empty_stomach", relation: "before" },
  { pattern: /morning/i,                                                        slot: "morning",  relation: "at" },
  { pattern: /with[\s_]?food|after[\s_]?food|after[\s_]?eating/i,             slot: "breakfast", relation: "with" }, // Generic "with food" → breakfast as default
];

export function parseMedicationTiming(rawTiming: string): ParsedMedicationTiming {
  const lower = rawTiming.toLowerCase().trim();

  for (const { pattern, slot, relation } of TIMING_PATTERNS) {
    if (pattern.test(lower)) {
      return {
        raw: rawTiming,
        resolved_slot: slot,
        relation,
        is_empty_stomach: slot === "empty_stomach",
        is_night: slot === "night",
      };
    }
  }

  // Fallback: unrecognised timing → treat as "with breakfast" (safest default)
  return {
    raw: rawTiming,
    resolved_slot: "breakfast",
    relation: "with",
    is_empty_stomach: false,
    is_night: false,
  };
}

// =============================================================================
// SECTION 3: RULE MATCHER
// Finds the correct MedicationRule for a given free-text medication name.
// Uses keyword matching first, then regex fallback.
// =============================================================================

export function matchMedicationRule(medicationName: string): MedicationRule | null {
  const lower = medicationName.toLowerCase().trim();

  for (const rule of Object.values(MEDICATION_RULES)) {
    // 1. Keyword match (fastest, most reliable for known drug names)
    if (rule.match_keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return rule;
    }
    // 2. Regex match (handles brand names and abbreviations)
    if (rule.match_regex && rule.match_regex.test(lower)) {
      return rule;
    }
  }

  return null; // Unrecognised drug — no constraints injected
}

// =============================================================================
// SECTION 4: GUARDRAIL STRING BUILDER
// Takes a MedicationRule + parsed timing + member name
// and produces FINAL ready-to-inject constraint strings for the Gemini prompt.
//
// These strings are written to be:
//   1. LLM-friendly (imperative, clear, no ambiguity)
//   2. Medically precise (specific ingredients, not vague categories)
//   3. Actionable (tells Gemini exactly what to do, not just what to avoid)
// =============================================================================

export function buildGuardrailStrings(
  memberName: string,
  rule: MedicationRule,
  parsedTiming: ParsedMedicationTiming,
  userNotes: string
): MedicationGuardrailBundle {
  const directives: string[] = [];
  const weeklyMonitorDirectives: string[] = [];
  const schedulingNotes: string[] = [];

  // ── 1. Per-slot constraints ────────────────────────────────────────────────
  for (const slotConstraint of rule.slot_constraints) {
    const targetSlot = slotConstraint.slot === "all"
      ? "ALL MEAL SLOTS"
      : `THE ${slotConstraint.slot.toUpperCase()} SLOT`;

    const parts: string[] = [
      `[MEDICATION GUARDRAIL — ABSOLUTE] ${memberName} takes ${rule.display_name}.`,
    ];

    if (slotConstraint.must_have_food || (slotConstraint as any).must_have_solid_food) {
      parts.push(
        `${targetSlot} MUST contain a substantial solid meal — not tea, coffee, or juice alone.`
      );
    }

    if (slotConstraint.forbidden_ingredients.length > 0) {
      parts.push(
        `In ${targetSlot}, STRICTLY EXCLUDE from ${memberName}'s plate: ` +
        slotConstraint.forbidden_ingredients.join(", ") + "."
      );
    }

    if (slotConstraint.forbidden_categories.length > 0) {
      parts.push(
        `Forbidden food categories for ${memberName} in ${targetSlot}: ` +
        slotConstraint.forbidden_categories.join(", ") + "."
      );
    }

    if (slotConstraint.positive_requirements.length > 0) {
      parts.push(
        `${memberName}'s ${targetSlot} MUST include: ` +
        slotConstraint.positive_requirements.join(" AND ") + "."
      );
    }

    parts.push(`[REASON] ${rule.clinical_reason}`);
    parts.push(`[TIMING] ${slotConstraint.timing_instruction}`);

    directives.push(parts.join(" "));
  }

  // ── 2. Dynamic slot override (e.g., Metformin taken at dinner instead of breakfast) ──
  if (rule.dynamic_slot_rule && parsedTiming.resolved_slot !== "breakfast") {
    const dynSlot = parsedTiming.resolved_slot;
    const dynRule = rule.dynamic_slot_rule;
    directives.push(
      `[DYNAMIC SLOT RULE] ${memberName} takes ${rule.display_name} at ${dynSlot}. ` +
      `Apply the following rule to the ${dynSlot.toUpperCase()} SLOT instead: ` +
      (dynRule.must_have_solid_food ? `Meal must be solid and substantial. ` : "") +
      (dynRule.forbidden_ingredients?.length
        ? `Exclude: ${dynRule.forbidden_ingredients.join(", ")}. `
        : "") +
      dynRule.timing_instruction
    );
  }

  // ── 3. Day-wide restrictions (e.g., Levothyroxine soy-free ALL day) ────────
  if ((rule as any).day_wide_restrictions) {
    const dwd = (rule as any).day_wide_restrictions;
    directives.push(
      dwd.directive.replace("{memberName}", memberName)
    );
  }

  // ── 4. Weekly monitor directive ────────────────────────────────────────────
  if (rule.weekly_monitor) {
    const wm = rule.weekly_monitor;
    weeklyMonitorDirectives.push(
      wm.directive.replace("{memberName}", memberName)
    );

    if (wm.rule === "avoid_entirely") {
      weeklyMonitorDirectives.push(
        `WEEKLY COUNT CHECK: ${wm.ingredients.join(", ")} must appear ZERO times in the 7-day plan for ${memberName}.`
      );
    } else if (wm.rule === "limit_frequency") {
      weeklyMonitorDirectives.push(
        `WEEKLY COUNT CHECK: ${wm.ingredients.join(", ")} must appear AT MOST ${wm.max_meals_per_week} times in the 7-day plan for ${memberName}.`
      );
    } else if (wm.rule === "keep_consistent") {
      weeklyMonitorDirectives.push(
        `WEEKLY CONSISTENCY CHECK: ${wm.ingredients.join(", ")} must appear EXACTLY 2–${wm.max_meals_per_week} times in the 7-day plan for ${memberName}. Not more, not fewer.`
      );
    }
  }

  // ── 5. Cross-slot conflict directive ─────────────────────────────────────
  if ((rule as any).cross_slot_conflict) {
    const csc = (rule as any).cross_slot_conflict;
    directives.push(`[CROSS-SLOT CONFLICT] ${csc.directive}`);
  }

  // ── 6. Scheduling note ─────────────────────────────────────────────────────
  if (rule.scheduling_note) {
    schedulingNotes.push(`[SCHEDULING — ${memberName}/${rule.display_name}] ${rule.scheduling_note}`);
  }

  // ── 7. User-supplied notes (verbatim, high priority) ──────────────────────
  if (userNotes && userNotes.trim().length > 0) {
    directives.push(
      `[USER NOTE — ${memberName}/${rule.display_name}] "${userNotes.trim()}" — Implement this as a hard instruction.`
    );
  }

  return {
    drug_id: rule.drug_id,
    member_name: memberName,
    directives,
    weekly_monitor_directives: weeklyMonitorDirectives,
    scheduling_notes: schedulingNotes,
    harmony_score_addition: rule.harmony_score_addition,
  };
}

// =============================================================================
// SECTION 5: MASTER RESOLVER
// The single function called by conflict-engine.ts.
// Takes a member name + their medication list → returns MedicationGuardrailBundle[]
// =============================================================================

export function resolveAllMedicationGuardrails(
  memberName: string,
  medications: Array<{ name: string; timing: string; notes: string }>
): MedicationGuardrailBundle[] {
  const bundles: MedicationGuardrailBundle[] = [];

  for (const med of medications) {
    const rule = matchMedicationRule(med.name);
    if (!rule) {
      // Unrecognised drug — emit a generic pass-through warning
      bundles.push({
        drug_id: "unknown",
        member_name: memberName,
        directives: [
          `[MEDICATION NOTE] ${memberName} takes ${med.name} (${med.timing}). ` +
          (med.notes
            ? `User note: "${med.notes}". Respect this as a dietary instruction.`
            : `No food interaction data available for this drug. Avoid scheduling unusually rich or irritating foods at this slot.`),
        ],
        weekly_monitor_directives: [],
        scheduling_notes: [],
        harmony_score_addition: 0,
      });
      continue;
    }

    const parsedTiming = parseMedicationTiming(med.timing);
    const bundle = buildGuardrailStrings(memberName, rule, parsedTiming, med.notes);
    bundles.push(bundle);
  }

  return bundles;
}
