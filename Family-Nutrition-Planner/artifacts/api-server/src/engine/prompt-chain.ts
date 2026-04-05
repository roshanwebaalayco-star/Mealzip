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

const DIETARY_TYPE_FORBIDDEN: Record<string, string[]> = {
  strictly_vegetarian: ["meat", "chicken", "mutton", "fish", "seafood", "shellfish", "eggs", "pork", "beef", "lamb", "prawns", "crab"],
  jain_vegetarian: ["meat", "chicken", "mutton", "fish", "seafood", "shellfish", "eggs", "pork", "beef", "onion", "garlic", "potato", "carrot", "radish", "beetroot", "turnip", "sweet potato", "arbi", "yam"],
  eggetarian: ["meat", "chicken", "mutton", "fish", "seafood", "shellfish", "pork", "beef", "lamb", "prawns", "crab"],
  vegan: ["meat", "chicken", "mutton", "fish", "seafood", "shellfish", "eggs", "pork", "beef", "milk", "paneer", "curd", "ghee", "butter", "cream", "cheese", "khoya", "honey"],
};

const UNIVERSAL_MEAL_PROHIBITIONS = [
  "Samosas (fried, not a meal)",
  "Pakoras, bhajias, or any deep-fried snack as a primary meal slot",
  "Mithai or sweets as a meal",
  "Street food (chaat, vada pav, pav bhaji) as a primary meal slot",
  "Maggi noodles or any instant noodle product",
  "Pizza, burger, sandwich, or fast food",
  "Kachori, puri (deep-fried) as primary carb — use roti/paratha instead",
  "Cold drinks, packaged juice, or sweetened beverages",
];

const CONDITION_CLINICAL_RULES: Record<string, { forbidden: string[]; rules: string[] }> = {
  diabetes_type_2: {
    forbidden: ["white sugar", "refined sugar", "maida", "fried foods", "mithai"],
    rules: [
      "No white rice as primary carb — replace with brown rice, jowar, or bajra",
      "No maida in any form",
      "No added sugar — no jaggery except tiny quantity",
      "Include dal at EVERY meal (protein slows glucose spike)",
      "Rice portion: 150g cooked max (not 250g)",
      "Roti: jowar or bajra preferred, max 2 per meal",
    ],
  },
  diabetes_type_1: {
    forbidden: ["white sugar", "refined sugar", "maida", "fried foods", "mithai", "honey in excess"],
    rules: [
      "CRITICAL: Consistent carbohydrate counting required — each meal must have predictable carb content",
      "No white rice as primary carb — replace with brown rice, jowar, or bajra",
      "Include protein and fat with every carb portion to slow glucose spike",
      "Snacks must be pre-portioned with known carb content",
      "Include glucagon kit items in grocery: glucose tablets, fruit juice box (emergency only)",
      "Avoid large gaps between meals — risk of hypoglycemia",
    ],
  },
  ckd_stage_1_2: {
    forbidden: ["high-sodium pickles", "papads", "processed foods"],
    rules: [
      "Moderate protein: 0.8g per kg bodyweight per day",
      "Low sodium: avoid added salt at table, minimal in cooking",
      "Monitor potassium: limit banana, orange, coconut water",
      "Adequate hydration: 2-3L water daily unless restricted",
      "Prefer plant-based protein sources over animal protein",
    ],
  },
  ckd_stage_3a: {
    forbidden: ["high-sodium pickles", "papads", "processed foods", "raw sprouts", "star fruit"],
    rules: [
      "CRITICAL: Protein restricted to 0.6-0.8g per kg bodyweight",
      "Restrict phosphorus: limit dairy, nuts, whole grains, cola",
      "Restrict potassium: no banana, orange, coconut water, tomato in excess",
      "Low sodium: under 2000mg per day",
      "Prefer white rice over brown rice (lower phosphorus/potassium)",
    ],
  },
  ckd_stage_3b: {
    forbidden: ["high-sodium pickles", "papads", "processed foods", "raw sprouts", "star fruit", "whole grains in excess"],
    rules: [
      "CRITICAL: Protein restricted to 0.6g per kg bodyweight",
      "Strictly restrict phosphorus: no dairy, no nuts, no whole grains",
      "Strictly restrict potassium: no banana, orange, coconut water, potato, tomato",
      "Sodium under 1500mg per day",
      "White rice only as carb source",
      "Consult nephrologist for meal adjustments",
    ],
  },
  ckd_stage_4: {
    forbidden: ["high-sodium pickles", "papads", "processed foods", "raw sprouts", "star fruit", "whole grains", "dairy in excess", "nuts"],
    rules: [
      "CRITICAL: Very low protein — 0.6g per kg bodyweight maximum",
      "Phosphorus under 800mg per day — no dairy, no nuts, no cola",
      "Potassium under 2000mg per day — strict food restrictions",
      "Sodium under 1500mg per day",
      "Fluid restriction may apply — check with nephrologist",
      "Only white rice, refined grains as carb sources",
    ],
  },
  ckd_stage_5: {
    forbidden: ["high-sodium pickles", "papads", "processed foods", "raw sprouts", "star fruit", "whole grains", "dairy", "nuts", "dried fruits"],
    rules: [
      "CRITICAL: Renal diet — strict protein, phosphorus, potassium, sodium, fluid restrictions",
      "Meals must be designed by or validated against nephrologist guidelines",
      "Protein: 0.6g per kg or as prescribed by nephrologist",
      "Phosphorus under 700mg per day",
      "Potassium under 1500mg per day",
      "Sodium under 1200mg per day",
    ],
  },
  ckd_stage_5_dialysis: {
    forbidden: ["high-sodium pickles", "papads", "processed foods", "raw sprouts", "star fruit"],
    rules: [
      "CRITICAL: Dialysis diet — HIGHER protein than pre-dialysis (1.2g per kg bodyweight)",
      "Phosphorus restriction still applies: under 800mg per day",
      "Potassium restriction: under 2000mg per day",
      "Sodium under 2000mg per day",
      "Fluid restriction as per dialysis schedule",
      "Include high-biological-value protein: eggs, paneer, fish",
    ],
  },
  pregnancy_t1: {
    forbidden: ["raw papaya", "raw pineapple", "ajinomoto", "excess caffeine", "alcohol", "raw sprouts", "unpasteurized dairy"],
    rules: [
      "First trimester: No extra calories needed yet — focus on nutrient density",
      "MANDATORY: Folic acid-rich foods in every meal: spinach, methi, dal, fortified cereals",
      "Iron-rich foods daily: palak, beetroot, dates, jaggery",
      "Vitamin C pairing with iron foods for absorption",
      "Small frequent meals if morning sickness present",
      "Avoid heavy spicy foods if nausea is an issue",
    ],
  },
  pregnancy_t2: {
    forbidden: ["raw papaya", "raw pineapple", "ajinomoto", "excess caffeine", "alcohol", "raw sprouts", "unpasteurized dairy"],
    rules: [
      "Second trimester: Extra 300 kcal/day above maintenance",
      "Calcium: 1200mg/day — ragi, sesame, curd, milk, paneer",
      "Iron: double the standard RDA — include heme and non-heme sources",
      "Protein: 78g/day (ICMR-NIN) — dal, paneer, eggs, chicken",
      "DHA/omega-3: walnuts, flaxseeds, fish (if non-veg)",
      "Fibre-rich foods to prevent constipation",
    ],
  },
  pregnancy_t3: {
    forbidden: ["raw papaya", "raw pineapple", "ajinomoto", "excess caffeine", "alcohol", "raw sprouts", "unpasteurized dairy"],
    rules: [
      "Third trimester: Extra 400-500 kcal/day above maintenance",
      "Small frequent meals — large meals cause discomfort",
      "Calcium: 1200mg/day — critical for foetal bone development",
      "Iron: continued high intake, vitamin C pairing mandatory",
      "Protein: 78g/day minimum",
      "Avoid gas-producing foods in excess: rajma, chole, cabbage",
      "Light dinner — prevent heartburn/reflux",
    ],
  },
  lactating_0_6m: {
    forbidden: ["alcohol", "excess caffeine", "strong spices that may affect milk taste"],
    rules: [
      "Lactation 0-6 months: Extra 500 kcal/day above pre-pregnancy maintenance",
      "Protein: 75g/day (ICMR-NIN 2024)",
      "Calcium: 1200mg/day — ragi, sesame, curd, milk",
      "Iron-rich foods: jaggery-based laddoos, dates, green leafy vegetables",
      "Traditional galactagogues: methi seeds, ajwain, saunf, jeera water",
      "Adequate fluids: 3-4L/day including water, buttermilk, dal water",
    ],
  },
  lactating_7_12m: {
    forbidden: ["alcohol", "excess caffeine"],
    rules: [
      "Lactation 7-12 months: Extra 400 kcal/day above pre-pregnancy maintenance",
      "Protein: 68g/day",
      "Calcium: 1200mg/day — continue high calcium foods",
      "Iron-rich foods daily: prevent postnatal anaemia",
      "Continue galactagogues if milk supply is a concern",
      "Gradually introduce complementary foods for baby — not reflected in mother's plate",
    ],
  },
  obesity: {
    forbidden: ["deep fried foods", "mithai", "packaged snacks", "maida", "cold drinks"],
    rules: [
      "Calorie deficit meals only — no second servings in recipe",
      "No fried items at dinner",
      "Include high-fibre vegetables in every meal",
      "Protein in every meal slot to maintain satiety",
      "No calorie-dense gravies (malai, cream, coconut milk)",
    ],
  },
  hypertension: {
    forbidden: ["high-sodium pickles", "papads", "processed snacks", "readymade masala mixes"],
    rules: [
      "Salt in base dish: HALF the standard recipe quantity",
      "No papad — contains 400-600mg sodium per piece",
      "No pickle/achar as a side",
      "Include potassium-rich foods: banana, tomato, spinach, sweet potato",
      "Use amchur, lemon, herbs for flavour instead of salt",
    ],
  },
  high_cholesterol: {
    forbidden: ["vanaspati", "dalda", "margarine", "trans fats", "hydrogenated oil"],
    rules: [
      "Use mustard oil or olive oil only — no refined oil",
      "Include soluble fibre sources: oats, flaxseeds, isabgol",
      "No coconut cream or heavy cream gravies",
      "Include omega-3 sources: walnuts, flaxseeds, fish (if non-veg)",
      "Limit egg yolk to 3 per week",
    ],
  },
  kidney_issues: {
    forbidden: ["high-sodium pickles", "papads", "processed foods", "excessive potassium fruits (banana, orange)", "raw sprouts", "spinach in excess", "tomato in excess"],
    rules: [
      "CRITICAL: Limit protein to prescribed amount — do not exceed",
      "Restrict phosphorus: limit dairy, nuts, whole grains",
      "Restrict potassium: no banana, orange, coconut water, tomato in excess",
      "Low sodium: no added salt at table, minimal in cooking",
      "Prefer white rice over brown rice (lower phosphorus)",
    ],
  },
  hypothyroid: {
    forbidden: ["raw cruciferous vegetables in excess (cabbage, cauliflower, broccoli)", "soy-based foods", "highly processed foods", "excessive sugar"],
    rules: [
      "MANDATORY: Iodised salt only",
      "Cruciferous vegetables must be cooked (not raw) — cooking deactivates goitrogens",
      "Avoid soy-based foods entirely (soya chunks, tofu, soy milk)",
      "Include selenium sources: Brazil nuts (if no tree nut allergy), eggs",
      "Include zinc sources: pumpkin seeds, sesame seeds",
    ],
  },
  pcos: {
    forbidden: ["white sugar", "refined carbs", "maida", "white bread", "cold drinks", "packaged juice", "deep fried foods"],
    rules: [
      "Anti-inflammatory spices in every meal: turmeric, cinnamon, ginger",
      "Low glycemic index carbs only: whole grains, millets",
      "Include omega-3 fatty acids: flaxseeds, walnuts",
      "Chromium-rich foods: broccoli (cooked), green beans, whole grains",
      "No refined carbs — use jowar, bajra, ragi instead of wheat",
    ],
  },
  anaemia: {
    forbidden: ["tea with meals (inhibits iron absorption)", "coffee with meals", "calcium supplements with iron-rich meals"],
    rules: [
      "Iron-rich food in every meal: spinach (palak), beetroot, dates, jaggery, rajma",
      "Vitamin C pairing mandatory: lemon, amla, guava alongside iron-rich foods",
      "No tea or coffee within 1 hour of meals",
      "Include B12 sources: curd, paneer (if vegetarian); eggs, fish (if non-veg)",
      "Soak and sprout legumes to increase iron bioavailability",
    ],
  },
};

function buildPerMemberClinicalBlocks(packet: ConstraintPacket): string {
  const { effectiveProfiles } = packet;
  const blocks: string[] = [];

  for (const p of effectiveProfiles) {
    const memberBlocks: string[] = [];

    const activeAllergies = p.allergies.filter(a => a !== "none");
    if (activeAllergies.length > 0) {
      const allergyItems = activeAllergies.flatMap(allergy => {
        const mapped: Record<string, string[]> = {
          peanuts: ["peanuts", "groundnuts", "mungfali", "moongphali", "peanut oil", "groundnut oil", "chikki"],
          dairy: ["milk", "paneer", "curd", "dahi", "ghee", "butter", "cream", "malai", "khoya", "cheese", "lassi", "raita", "kheer"],
          gluten: ["wheat", "atta", "maida", "suji", "roti", "paratha", "naan", "bread", "seviyan", "daliya"],
          tree_nuts: ["almonds", "cashews", "walnuts", "pistachios", "mixed dry fruits"],
          shellfish: ["prawns", "shrimp", "crab", "lobster", "mussels"],
          soy: ["soya chunks", "nutrela", "tofu", "soy sauce", "soya milk"],
          sesame: ["til", "sesame seeds", "tahini", "til ladoo", "gingelly oil"],
        };
        return mapped[allergy] ?? [];
      });
      memberBlocks.push(`  [${p.name}] LEVEL 1 — ALLERGY HARD BLOCKS:\n    ZERO TOLERANCE: ${allergyItems.join(", ")}`);
    }

    const dietForbidden = DIETARY_TYPE_FORBIDDEN[p.dietaryType] ?? [];
    if (dietForbidden.length > 0) {
      memberBlocks.push(`  [${p.name}] LEVEL 2 — DIETARY TYPE BLOCKS (${p.dietaryType}):\n    FORBIDDEN: ${dietForbidden.join(", ")}`);
    }

    if (p.activeMedications.length > 0) {
      const medLines = p.activeMedications.map(m => `    - ${m.name} (${m.timing}): ${m.notes || "follow standard drug-food interaction rules"}`);
      memberBlocks.push(`  [${p.name}] LEVEL 3 — MEDICATION INTERACTION WINDOWS:\n${medLines.join("\n")}`);
    }

    const activeConditions = p.effectiveHealthConditions.filter(c => c !== "none");
    if (activeConditions.length > 0) {
      const condLines: string[] = [];
      for (const cond of activeConditions) {
        const clinicalRule = CONDITION_CLINICAL_RULES[cond];
        if (clinicalRule) {
          condLines.push(`    ${cond.toUpperCase().replace(/_/g, " ")}:`);
          clinicalRule.rules.forEach(r => condLines.push(`      - ${r}`));
        }
      }
      if (condLines.length > 0) {
        memberBlocks.push(`  [${p.name}] LEVEL 4 — CLINICAL CONDITION RULES:\n${condLines.join("\n")}`);
      }
    }

    const goalRules = buildGoalRules(p);
    if (goalRules.length > 0) {
      memberBlocks.push(`  [${p.name}] LEVEL 5 — GOAL-SPECIFIC RULES (${p.effectiveGoal}):\n${goalRules.map(r => `    - ${r}`).join("\n")}`);
    }

    const religType = p.religiousCulturalRules?.type;
    if (religType && religType !== "none") {
      const religMap: Record<string, string[]> = {
        no_beef: ["beef", "veal"],
        no_pork: ["pork", "bacon", "ham", "lard"],
        sattvic_no_onion_garlic: ["onion", "garlic", "leek", "spring onion", "shallots"],
        jain_rules: ["onion", "garlic", "potato", "carrot", "radish", "beetroot", "turnip", "sweet potato", "arbi", "yam"],
      };
      const religForbidden = religMap[religType] ?? [];
      if (religForbidden.length > 0) {
        memberBlocks.push(`  [${p.name}] RELIGIOUS/CULTURAL BLOCKS (${religType}):\n    FORBIDDEN: ${religForbidden.join(", ")}`);
      }
    }

    if (memberBlocks.length > 0) {
      blocks.push(memberBlocks.join("\n\n"));
    }
  }

  if (blocks.length === 0) return "";

  return `═══════════════════════════════════════════════
PER-MEMBER CLINICAL CONSTRAINTS (MANDATORY — TypeScript backend has pre-computed these. Gemini MUST obey every line):
${blocks.join("\n\n")}
═══════════════════════════════════════════════`;
}

function buildGoalRules(p: EffectiveMemberProfile): string[] {
  const goal = p.effectiveGoal;
  const rules: string[] = [];

  if (goal === "weight_loss") {
    rules.push(`Daily calorie target: ${p.dailyCalorieTarget ?? "calculated"} kcal — do not exceed`);
    rules.push("High protein, high fibre in every meal");
    rules.push("No fried items at dinner");
    rules.push("Dinner must be the lightest meal — under 400 kcal");
    if (p.goalPace === "slow_0.25kg") rules.push("Pace: gradual 0.25kg/week — mild 250 kcal deficit");
    if (p.goalPace === "moderate_0.5kg") rules.push("Pace: moderate 0.5kg/week — 500 kcal deficit");
  } else if (goal === "weight_gain") {
    rules.push(`Daily calorie target: ${p.dailyCalorieTarget ?? "calculated"} kcal — caloric surplus required`);
    rules.push("Include calorie-dense healthy foods: ghee (if no dairy allergy), nuts, full-fat curd");
    rules.push("Larger portions of complex carbs: extra roti, rice");
    rules.push("Pre-bed snack: warm milk with turmeric + dry fruit (if no allergy)");
  } else if (goal === "build_muscle") {
    rules.push(`Daily calorie target: ${p.dailyCalorieTarget ?? "calculated"} kcal`);
    rules.push("Protein target: 1.6-2.0g per kg bodyweight");
    rules.push("Include protein in every meal: dal, paneer, eggs, chicken, soy");
    rules.push("Post-workout meal timing: within 2 hours of exercise");
  } else if (goal === "manage_condition") {
    rules.push("Follow all Level 4 clinical condition rules strictly");
    rules.push("Prioritize therapeutic foods for the specific condition");
  } else if (goal === "early_childhood_nutrition") {
    rules.push("CRITICAL: Age-appropriate textures and portions");
    rules.push("No whole nuts (choking hazard) — use ground/paste form");
    rules.push("No added salt or sugar for under 1 year");
    rules.push("Include iron-fortified cereals, mashed dal, soft vegetables");
  } else if (goal === "healthy_growth") {
    rules.push("Balanced meals with all food groups");
    rules.push("Calcium-rich foods: milk, curd, ragi, sesame");
    rules.push("Iron-rich foods daily: green leafy vegetables, jaggery");
    rules.push("No junk food substitutions — whole foods only");
  } else if (goal === "senior_nutrition") {
    rules.push("Easy to chew and digest meals");
    rules.push("Higher calcium: ragi, sesame, curd");
    rules.push("Adequate protein to prevent muscle loss");
    rules.push("Fibre-rich to aid digestion");
    rules.push("Low oil, low spice — gentle on the digestive system");
  }

  return rules;
}

function buildAbsoluteProhibitions(packet: ConstraintPacket): string {
  const { effectiveProfiles } = packet;

  const allergenBlocks = new Set<string>();
  const dietaryBlocks = new Set<string>();
  const religiousBlocks = new Set<string>();
  const conditionBlocks = new Set<string>();

  for (const p of effectiveProfiles) {
    for (const allergy of p.allergies) {
      if (allergy === "none") continue;
      const mapped: Record<string, string[]> = {
        peanuts: ["peanuts", "groundnuts", "mungfali", "moongphali", "peanut oil", "groundnut oil", "chikki"],
        dairy: ["milk", "paneer", "curd", "dahi", "ghee", "butter", "cream", "malai", "khoya", "cheese", "lassi", "raita", "kheer"],
        gluten: ["wheat", "atta", "maida", "suji", "roti", "paratha", "naan", "bread", "seviyan", "daliya"],
        tree_nuts: ["almonds", "cashews", "walnuts", "pistachios", "mixed dry fruits"],
        shellfish: ["prawns", "shrimp", "crab", "lobster", "mussels"],
        soy: ["soya chunks", "nutrela", "tofu", "soy sauce", "soya milk"],
        sesame: ["til", "sesame seeds", "tahini", "til ladoo", "gingelly oil"],
      };
      (mapped[allergy] ?? []).forEach(i => allergenBlocks.add(i));
    }

    const dietForbidden = DIETARY_TYPE_FORBIDDEN[p.dietaryType] ?? [];
    dietForbidden.forEach(i => dietaryBlocks.add(i));

    const religType = p.religiousCulturalRules?.type;
    if (religType) {
      const religMap: Record<string, string[]> = {
        no_beef: ["beef", "veal"],
        no_pork: ["pork", "bacon", "ham", "lard"],
        sattvic_no_onion_garlic: ["onion", "garlic", "leek", "spring onion", "shallots"],
        jain_rules: ["onion", "garlic", "potato", "carrot", "radish", "beetroot", "turnip", "sweet potato", "arbi", "yam"],
      };
      (religMap[religType] ?? []).forEach(i => religiousBlocks.add(i));
    }

    for (const cond of p.effectiveHealthConditions) {
      if (cond === "none") continue;
      const rule = CONDITION_CLINICAL_RULES[cond];
      if (rule) rule.forbidden.forEach(i => conditionBlocks.add(i));
    }
  }

  const sections: string[] = [];

  sections.push(`ABSOLUTE PROHIBITIONS — You MUST NEVER suggest any meal containing these under ANY circumstances:`);

  if (allergenBlocks.size > 0) {
    sections.push(`\nALLERGEN BLOCKS (life-threatening — zero tolerance):\n  ${[...allergenBlocks].join(", ")}`);
  }
  if (dietaryBlocks.size > 0) {
    sections.push(`\nDIETARY TYPE BLOCKS (family dietary restriction):\n  ${[...dietaryBlocks].join(", ")}`);
  }
  if (religiousBlocks.size > 0) {
    sections.push(`\nRELIGIOUS/CULTURAL BLOCKS:\n  ${[...religiousBlocks].join(", ")}`);
  }
  if (conditionBlocks.size > 0) {
    sections.push(`\nHEALTH CONDITION BLOCKS:\n  ${[...conditionBlocks].join(", ")}`);
  }

  sections.push(`\nABSOLUTE MEAL TYPE PROHIBITIONS — NEVER suggest these as primary meals:\n  ${UNIVERSAL_MEAL_PROHIBITIONS.map(p => `- ${p}`).join("\n  ")}`);

  return sections.join("\n");
}

function buildMealStructureRules(packet: ConstraintPacket): string {
  return `MEAL STRUCTURE RULES (MANDATORY — every meal must follow this):
- Every BREAKFAST must include: a complex carbohydrate (poha, upma, idli, dosa, paratha with whole wheat, oats, daliya) + a protein source (dal, sprouts, curd, eggs if eggetarian, paneer, besan chilla) + optionally a vegetable.
- Every LUNCH must include: a dal or legume (mandatory) + a sabzi/vegetable + a roti or rice + optionally curd/raita.
- Every DINNER must include: a dal or legume + a sabzi/vegetable + a roti. Dinner must be lighter than lunch. Avoid heavy fried items at dinner.
- No meal slot may be filled with a fried snack (samosa, pakora, bhajia, kachori) as the primary item.
- No two consecutive days may have the exact same main dish at the same meal slot. Variety is required.
- Use whole grains (whole wheat atta, bajra, jowar, ragi) as default. White maida is forbidden unless no member has diabetes or obesity.
- The meal must be realistically cookable within the cooking time constraints listed below.
- Include seasonal vegetables and locally available ingredients only.`;
}

function buildRegionalRequirement(packet: ConstraintPacket): string {
  const { family } = packet;
  const region = family.stateRegion || "India";

  const regionalHints: Record<string, string> = {
    "Kerala": "Use coconut oil, curry leaves, appam, puttu, avial, thorans, rice-based dishes. Fish curry for non-veg.",
    "Tamil Nadu": "Use gingelly oil, filter coffee, idli, dosa, sambar, rasam, kootu, poriyal. Tamarind-based gravies.",
    "Karnataka": "Use ragi mudde, bisi bele bath, akki rotti, jolada rotti, sambar, rasam. Coconut-heavy curries.",
    "Andhra Pradesh": "Use red chilli-heavy dishes, pesarattu, gongura, pappu, pulihora. Spicy and tangy flavors.",
    "Telangana": "Use jonna roti, sajja roti, sakinalu, pesarattu. Hyderabadi cuisine elements for non-veg.",
    "Maharashtra": "Use pithla bhakri, bharli vangi, usal, misal base. Kokum-based drinks, groundnut oil.",
    "Gujarat": "Use rotla, thepla, dhokla, undhiyu, kadhi, dal dhokli. Slightly sweet flavors. Groundnut oil.",
    "Rajasthan": "Use dal baati, gatte ki sabzi, ker sangri, bajra roti, churma (healthy version). Minimal water dishes.",
    "Punjab": "Use makki di roti, sarson da saag, rajma chawal, chole, paneer dishes, lassi. Mustard oil.",
    "Uttar Pradesh": "Use dal roti, sabzi, raita, tahiri, chana masala, lauki. Local seasonal vegetables.",
    "Bihar": "Use litti chokha, sattu paratha, dal pitha, chana dal. Mustard oil-based cooking.",
    "Jharkhand": "Use dhuska, litti chokha, rugda (mushroom), bamboo shoot curry. Local tribal ingredients.",
    "West Bengal": "Use bhat dal, shukto, posto, machher jhol for non-veg. Mustard oil, panch phoron.",
    "Odisha": "Use dalma, santula, pakhala, saga bhaja. Temple-style cuisine.",
    "Madhya Pradesh": "Use poha jalebi (healthy poha only), dal bafla, bhutte ka kees. Soy-based dishes.",
    "Delhi": "Use rajma chawal, chole bhature (use whole wheat, not maida), dal makhani (low-fat version). North Indian cuisine.",
    "Goa": "Use fish curry rice for non-veg, solkadhi, xacuti spice blends. Coconut-heavy.",
    "Assam": "Use khar, masor tenga, aloo pitika, ou tenga. Mustard oil, bamboo shoot.",
  };

  const hints = regionalHints[region] ?? "Use locally popular Indian cuisine authentic to the family's region.";

  return `REGIONAL REQUIREMENT:
- This family is from ${region}.
- All meals must use ${region} cuisine as the default.
- ${hints}
- Do not suggest dishes from a completely different regional cuisine unless universally common (e.g. dal tadka, poha are acceptable everywhere).`;
}

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

  const absoluteProhibitions = buildAbsoluteProhibitions(packet);
  const mealStructureRules = buildMealStructureRules(packet);
  const regionalRequirement = buildRegionalRequirement(packet);
  const perMemberClinicalBlocks = buildPerMemberClinicalBlocks(packet);

  const prompt = `
You are a clinical Indian nutritionist generating a weekly meal plan. You are not a creative chef. You are not a food blogger. You generate medically appropriate, budget-compliant, regionally authentic meals. You do not have artistic freedom. You follow constraints exactly.

LAW 1: Gemini NEVER makes clinical decisions. The TypeScript backend has pre-computed all medical constraints (Levels 1-5 below). You implement them exactly. You do not interpret, relax, or override any clinical rule.

${familyContext}

═══════════════════════════════════════════════
${absoluteProhibitions}
═══════════════════════════════════════════════

${perMemberClinicalBlocks}

${mealStructureRules}

═══════════════════════════════════════════════
BUDGET CONSTRAINT:
- Weekly perishable budget: ₹${weeklyBudget.toFixed(0)} total (HARD LIMIT — do not exceed)
- Daily perishable budget: ₹${packet.effectiveDailyBudget.toFixed(0)}
- Breakfast cost limit: ₹${budget.budgetBreakdown.daily_limits.breakfast.toFixed(0)} (ingredients only, staples pre-purchased)
- Lunch cost limit: ₹${budget.budgetBreakdown.daily_limits.lunch.toFixed(0)}
- Dinner cost limit: ₹${budget.budgetBreakdown.daily_limits.dinner.toFixed(0)}
${mealsIncludeSnack ? `- Snack cost limit: ₹${budget.budgetBreakdown.daily_limits.snack.toFixed(0)}` : ""}
- Staples (atta, dal, rice, oil, spices) are pre-purchased and do NOT count toward daily limits.
- You must estimate the ingredient cost of each meal and ensure it does not exceed the slot limit.
═══════════════════════════════════════════════

${regionalRequirement}

═══════════════════════════════════════════════
WEEK DATES: ${weekDays.map((d) => `${d.name} ${d.date}`).join(", ")}

${constraintInstructions}

NON-VEG DAYS BY MEMBER:
${nonvegSummary}

FASTING THIS WEEK:
${fastingSummary || "  No fasting members this week."}

ZERO-WASTE PANTRY MANDATE:
${pantryStr ? `The following ingredients are in the family's pantry and MUST be used THIS WEEK before buying new items:\n  ${pantryStr}\nPrioritize using these in the first 3 days of the week.` : "No pantry items to use up."}

═══════════════════════════════════════════════
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
