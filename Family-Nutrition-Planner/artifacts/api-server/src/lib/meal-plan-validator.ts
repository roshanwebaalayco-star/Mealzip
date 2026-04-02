export interface MemberProfile {
  name: string;
  healthConditions: string[];
  dietaryType: string;
  allergies: string[];
}

export interface Violation {
  severity: "hard" | "soft";
  member: string;
  rule: string;
  message: string;
}

const HIGH_GI_KEYWORDS = [
  "white rice", "maida", "potato", "sugar", "jaggery", "honey",
  "bread", "naan", "cornflakes", "instant noodles", "maggi",
  "white bread", "pav", "bun", "cake", "biscuit", "cookie",
  "mashed potato", "french fries", "chips", "watermelon",
  "pineapple", "ripe banana", "dates", "glucose",
];

const MEDIUM_GI_KEYWORDS = [
  "basmati rice", "brown rice", "parboiled rice", "semolina",
  "suji", "rava", "mango", "papaya", "raisins",
];

const HIGH_SODIUM_KEYWORDS: Array<{ keyword: string; estimatedMg: number }> = [
  { keyword: "pickle", estimatedMg: 800 },
  { keyword: "achar", estimatedMg: 800 },
  { keyword: "papad", estimatedMg: 700 },
  { keyword: "processed cheese", estimatedMg: 600 },
  { keyword: "instant noodles", estimatedMg: 900 },
  { keyword: "maggi", estimatedMg: 900 },
  { keyword: "soy sauce", estimatedMg: 900 },
  { keyword: "ketchup", estimatedMg: 400 },
  { keyword: "chips", estimatedMg: 500 },
  { keyword: "namkeen", estimatedMg: 600 },
  { keyword: "bhujia", estimatedMg: 600 },
  { keyword: "packaged", estimatedMg: 500 },
  { keyword: "canned", estimatedMg: 500 },
  { keyword: "salted", estimatedMg: 400 },
];

const JAIN_FORBIDDEN_KEYWORDS = [
  "onion", "garlic", "potato", "carrot", "radish", "beetroot",
  "turnip", "ginger", "turmeric root", "sweet potato", "yam",
  "tapioca", "mushroom", "eggplant", "brinjal",
];

function extractIngredientText(meal: Record<string, unknown>): string {
  const parts: string[] = [];

  const name = (meal.base_dish_name ?? meal.recipeName ?? "") as string;
  parts.push(name);

  if (Array.isArray(meal.ingredients)) {
    parts.push(...(meal.ingredients as string[]));
  } else if (typeof meal.ingredients === "string") {
    parts.push(meal.ingredients);
  }

  if (Array.isArray(meal.base_ingredients)) {
    for (const bi of meal.base_ingredients as Array<{ ingredient?: string }>) {
      if (bi.ingredient) parts.push(bi.ingredient);
    }
  }

  return parts.join(" ").toLowerCase();
}

function wordBoundaryMatch(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s,;|/()\\[\\]])${escaped}(?=$|[\\s,;|/()\\[\\]])`, "i").test(text);
}

function checkDiabetic(ingredientText: string, memberName: string): Violation[] {
  const violations: Violation[] = [];

  for (const kw of HIGH_GI_KEYWORDS) {
    if (wordBoundaryMatch(ingredientText, kw)) {
      violations.push({
        severity: "hard",
        member: memberName,
        rule: "diabetic_high_gi",
        message: `High-GI ingredient "${kw}" found — unsuitable for diabetic member ${memberName}`,
      });
    }
  }

  for (const kw of MEDIUM_GI_KEYWORDS) {
    if (wordBoundaryMatch(ingredientText, kw)) {
      violations.push({
        severity: "soft",
        member: memberName,
        rule: "diabetic_medium_gi",
        message: `Medium-GI ingredient "${kw}" — consider low-GI alternative for ${memberName}`,
      });
    }
  }

  return violations;
}

function checkHypertension(ingredientText: string, memberName: string): Violation[] {
  const violations: Violation[] = [];

  for (const { keyword, estimatedMg } of HIGH_SODIUM_KEYWORDS) {
    if (wordBoundaryMatch(ingredientText, keyword)) {
      violations.push({
        severity: estimatedMg >= 700 ? "hard" : "soft",
        member: memberName,
        rule: "hypertension_sodium",
        message: `High-sodium item "${keyword}" (~${estimatedMg}mg) — risky for hypertensive member ${memberName}`,
      });
    }
  }

  return violations;
}

function checkJain(ingredientText: string, memberName: string): Violation[] {
  const violations: Violation[] = [];

  for (const kw of JAIN_FORBIDDEN_KEYWORDS) {
    if (wordBoundaryMatch(ingredientText, kw)) {
      violations.push({
        severity: "hard",
        member: memberName,
        rule: "jain_forbidden",
        message: `Jain-forbidden ingredient "${kw}" found — ${memberName} follows Jain diet`,
      });
    }
  }

  return violations;
}

function checkAllergies(ingredientText: string, memberName: string, allergies: string[]): Violation[] {
  const violations: Violation[] = [];

  for (const allergen of allergies) {
    const lower = allergen.toLowerCase().trim();
    if (!lower) continue;
    if (wordBoundaryMatch(ingredientText, lower)) {
      violations.push({
        severity: "hard",
        member: memberName,
        rule: "allergy_crosscheck",
        message: `Allergen "${allergen}" detected in ingredients — ${memberName} has declared allergy`,
      });
    }
  }

  return violations;
}

export interface CandidateSelectionResult {
  selectedIndex: number;
  selectedMeal: Record<string, unknown>;
  violations: Violation[];
  allViolations: Violation[];
  usedFallback: boolean;
}

export function validateMealPlan(
  candidates: Record<string, unknown>[],
  members: MemberProfile[],
): CandidateSelectionResult {
  let allViolations: Violation[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const violations = validateMealForMembers(candidates[i], members);
    const hardViolations = violations.filter(v => v.severity === "hard");
    allViolations.push(...violations);

    if (hardViolations.length === 0) {
      return {
        selectedIndex: i,
        selectedMeal: candidates[i],
        violations,
        allViolations,
        usedFallback: false,
      };
    }
  }

  return {
    selectedIndex: -1,
    selectedMeal: candidates[0] ?? {},
    violations: allViolations,
    allViolations,
    usedFallback: true,
  };
}

export function validateMealForMembers(
  meal: Record<string, unknown>,
  members: MemberProfile[],
): Violation[] {
  const ingredientText = extractIngredientText(meal);
  const violations: Violation[] = [];

  for (const member of members) {
    const conditions = (member.healthConditions ?? []).map(c => c.toLowerCase());
    const dietType = (member.dietaryType ?? "").toLowerCase();

    if (conditions.includes("diabetes") || conditions.includes("diabetes_type2")) {
      violations.push(...checkDiabetic(ingredientText, member.name));
    }

    if (conditions.includes("hypertension") || conditions.includes("blood_pressure")) {
      violations.push(...checkHypertension(ingredientText, member.name));
    }

    if (dietType === "jain" || dietType === "jain_vegetarian") {
      violations.push(...checkJain(ingredientText, member.name));
    }

    if (member.allergies && member.allergies.length > 0) {
      violations.push(...checkAllergies(ingredientText, member.name, member.allergies));
    }
  }

  return violations;
}

export function hasHardViolation(violations: Violation[]): boolean {
  return violations.some(v => v.severity === "hard");
}

export interface SafeFallback {
  base_dish_name: string;
  recipeName: string;
  nameHindi: string;
  calories: number;
  estimatedCost: number;
  recipeId: null;
  required_appliances: string[];
  icmr_rationale: string;
  base_ingredients: Array<{ ingredient: string; qty_grams: number }>;
  ingredients: string[];
  instructions: string[];
  member_adjustments: Record<string, unknown>;
  member_plates: Record<string, unknown>;
}

const SAFE_FALLBACKS: Record<string, Record<string, SafeFallback>> = {
  breakfast: {
    vegetarian: {
      base_dish_name: "Poha with Vegetables",
      recipeName: "Poha with Vegetables",
      nameHindi: "सब्जी वाला पोहा",
      calories: 280,
      estimatedCost: 60,
      recipeId: null,
      required_appliances: ["kadai"],
      icmr_rationale: "Complex carbs, iron from flattened rice",
      base_ingredients: [
        { ingredient: "flattened rice (poha)", qty_grams: 100 },
        { ingredient: "mixed vegetables", qty_grams: 80 },
        { ingredient: "peanuts", qty_grams: 20 },
      ],
      ingredients: ["100g poha", "mixed vegetables", "peanuts", "mustard seeds", "curry leaves"],
      instructions: ["Rinse poha in water", "Sauté vegetables with spices", "Mix poha and serve"],
      member_adjustments: {},
      member_plates: {},
    },
    jain: {
      base_dish_name: "Sabudana Khichdi",
      recipeName: "Sabudana Khichdi",
      nameHindi: "साबूदाना खिचड़ी",
      calories: 310,
      estimatedCost: 70,
      recipeId: null,
      required_appliances: ["kadai"],
      icmr_rationale: "Energy-dense, Jain-safe, no root vegetables",
      base_ingredients: [
        { ingredient: "sabudana", qty_grams: 100 },
        { ingredient: "peanuts", qty_grams: 30 },
        { ingredient: "ghee", qty_grams: 10 },
      ],
      ingredients: ["100g sabudana (soaked)", "peanuts", "cumin seeds", "green chilli", "ghee"],
      instructions: ["Soak sabudana overnight", "Sauté with peanuts and spices", "Serve hot"],
      member_adjustments: {},
      member_plates: {},
    },
    default: {
      base_dish_name: "Oats Porridge with Fruits",
      recipeName: "Oats Porridge with Fruits",
      nameHindi: "फलों के साथ ओट्स दलिया",
      calories: 250,
      estimatedCost: 50,
      recipeId: null,
      required_appliances: [],
      icmr_rationale: "High fiber, low GI, safe for all conditions",
      base_ingredients: [
        { ingredient: "rolled oats", qty_grams: 50 },
        { ingredient: "milk", qty_grams: 200 },
        { ingredient: "banana", qty_grams: 80 },
      ],
      ingredients: ["50g oats", "200ml milk", "1 banana", "nuts"],
      instructions: ["Cook oats in milk", "Top with sliced fruit", "Serve warm"],
      member_adjustments: {},
      member_plates: {},
    },
  },
  mid_morning: {
    default: {
      base_dish_name: "Fruit and Curd Bowl",
      recipeName: "Fruit and Curd Bowl",
      nameHindi: "फल और दही कटोरी",
      calories: 150,
      estimatedCost: 40,
      recipeId: null,
      required_appliances: [],
      icmr_rationale: "Probiotics, vitamin C, calcium",
      base_ingredients: [
        { ingredient: "curd", qty_grams: 150 },
        { ingredient: "seasonal fruits", qty_grams: 100 },
      ],
      ingredients: ["150g curd", "seasonal fruits", "honey (optional)"],
      instructions: ["Add curd to bowl", "Top with fruits", "Serve chilled"],
      member_adjustments: {},
      member_plates: {},
    },
    vegetarian: {
      base_dish_name: "Fruit and Curd Bowl",
      recipeName: "Fruit and Curd Bowl",
      nameHindi: "फल और दही कटोरी",
      calories: 150,
      estimatedCost: 40,
      recipeId: null,
      required_appliances: [],
      icmr_rationale: "Probiotics, vitamin C, calcium",
      base_ingredients: [
        { ingredient: "curd", qty_grams: 150 },
        { ingredient: "seasonal fruits", qty_grams: 100 },
      ],
      ingredients: ["150g curd", "seasonal fruits", "honey (optional)"],
      instructions: ["Add curd to bowl", "Top with fruits", "Serve chilled"],
      member_adjustments: {},
      member_plates: {},
    },
    jain: {
      base_dish_name: "Dry Fruit Mix",
      recipeName: "Dry Fruit Mix",
      nameHindi: "सूखे मेवे मिश्रण",
      calories: 180,
      estimatedCost: 60,
      recipeId: null,
      required_appliances: [],
      icmr_rationale: "Healthy fats, iron, no root vegetables",
      base_ingredients: [
        { ingredient: "almonds", qty_grams: 20 },
        { ingredient: "cashews", qty_grams: 15 },
        { ingredient: "raisins", qty_grams: 15 },
      ],
      ingredients: ["almonds", "cashews", "raisins", "walnuts"],
      instructions: ["Mix all dry fruits", "Serve as snack", "Store in airtight container"],
      member_adjustments: {},
      member_plates: {},
    },
  },
  lunch: {
    vegetarian: {
      base_dish_name: "Moong Dal Khichdi with Curd",
      recipeName: "Moong Dal Khichdi with Curd",
      nameHindi: "मूंग दाल खिचड़ी दही के साथ",
      calories: 420,
      estimatedCost: 80,
      recipeId: null,
      required_appliances: ["pressure_cooker"],
      icmr_rationale: "Complete protein, easy to digest, iron",
      base_ingredients: [
        { ingredient: "rice", qty_grams: 80 },
        { ingredient: "moong dal", qty_grams: 40 },
        { ingredient: "ghee", qty_grams: 10 },
        { ingredient: "curd", qty_grams: 100 },
      ],
      ingredients: ["80g rice", "40g moong dal", "ghee", "cumin", "curd"],
      instructions: ["Pressure cook dal and rice together", "Temper with ghee and cumin", "Serve with curd"],
      member_adjustments: {},
      member_plates: {},
    },
    jain: {
      base_dish_name: "Moong Dal Khichdi",
      recipeName: "Moong Dal Khichdi",
      nameHindi: "मूंग दाल खिचड़ी",
      calories: 380,
      estimatedCost: 70,
      recipeId: null,
      required_appliances: ["pressure_cooker"],
      icmr_rationale: "Safe protein source, no root vegetables",
      base_ingredients: [
        { ingredient: "rice", qty_grams: 80 },
        { ingredient: "moong dal", qty_grams: 40 },
        { ingredient: "ghee", qty_grams: 10 },
      ],
      ingredients: ["80g rice", "40g moong dal", "ghee", "cumin seeds"],
      instructions: ["Wash and soak dal", "Pressure cook with rice", "Serve with ghee"],
      member_adjustments: {},
      member_plates: {},
    },
    default: {
      base_dish_name: "Dal Roti Sabzi",
      recipeName: "Dal Roti Sabzi",
      nameHindi: "दाल रोटी सब्जी",
      calories: 450,
      estimatedCost: 90,
      recipeId: null,
      required_appliances: ["pressure_cooker", "tawa"],
      icmr_rationale: "Balanced meal, 3:1 cereal-pulse ratio",
      base_ingredients: [
        { ingredient: "toor dal", qty_grams: 50 },
        { ingredient: "wheat flour", qty_grams: 80 },
        { ingredient: "mixed vegetables", qty_grams: 100 },
      ],
      ingredients: ["toor dal", "wheat flour rotis", "seasonal sabzi"],
      instructions: ["Cook dal with turmeric", "Make rotis on tawa", "Prepare seasonal vegetable"],
      member_adjustments: {},
      member_plates: {},
    },
  },
  evening_snack: {
    default: {
      base_dish_name: "Masala Chaas",
      recipeName: "Masala Chaas",
      nameHindi: "मसाला छाछ",
      calories: 80,
      estimatedCost: 25,
      recipeId: null,
      required_appliances: [],
      icmr_rationale: "Probiotics, hydration, calcium",
      base_ingredients: [
        { ingredient: "curd", qty_grams: 200 },
        { ingredient: "cumin powder", qty_grams: 2 },
        { ingredient: "water", qty_grams: 100 },
      ],
      ingredients: ["200ml curd", "cumin", "salt", "water"],
      instructions: ["Blend curd with water", "Add roasted cumin", "Serve chilled"],
      member_adjustments: {},
      member_plates: {},
    },
    vegetarian: {
      base_dish_name: "Masala Chaas",
      recipeName: "Masala Chaas",
      nameHindi: "मसाला छाछ",
      calories: 80,
      estimatedCost: 25,
      recipeId: null,
      required_appliances: [],
      icmr_rationale: "Probiotics, hydration, calcium",
      base_ingredients: [
        { ingredient: "curd", qty_grams: 200 },
        { ingredient: "cumin powder", qty_grams: 2 },
        { ingredient: "water", qty_grams: 100 },
      ],
      ingredients: ["200ml curd", "cumin", "salt", "water"],
      instructions: ["Blend curd with water", "Add roasted cumin", "Serve chilled"],
      member_adjustments: {},
      member_plates: {},
    },
    jain: {
      base_dish_name: "Makhana Roast",
      recipeName: "Makhana Roast",
      nameHindi: "भुने मखाने",
      calories: 120,
      estimatedCost: 40,
      recipeId: null,
      required_appliances: [],
      icmr_rationale: "Low-calorie, high calcium, Jain-safe",
      base_ingredients: [
        { ingredient: "makhana (fox nuts)", qty_grams: 30 },
        { ingredient: "ghee", qty_grams: 5 },
      ],
      ingredients: ["30g makhana", "ghee", "rock salt"],
      instructions: ["Dry roast makhana in ghee", "Season with rock salt", "Serve warm"],
      member_adjustments: {},
      member_plates: {},
    },
  },
  dinner: {
    vegetarian: {
      base_dish_name: "Palak Dal with Roti",
      recipeName: "Palak Dal with Roti",
      nameHindi: "पालक दाल रोटी",
      calories: 480,
      estimatedCost: 100,
      recipeId: null,
      required_appliances: ["pressure_cooker", "tawa"],
      icmr_rationale: "Iron from spinach, protein from dal, fiber",
      base_ingredients: [
        { ingredient: "masoor dal", qty_grams: 50 },
        { ingredient: "spinach", qty_grams: 100 },
        { ingredient: "wheat flour", qty_grams: 80 },
      ],
      ingredients: ["masoor dal", "palak (spinach)", "wheat rotis", "ghee"],
      instructions: ["Cook dal with spinach", "Make wheat rotis", "Serve together"],
      member_adjustments: {},
      member_plates: {},
    },
    jain: {
      base_dish_name: "Paneer Sabzi with Phulka",
      recipeName: "Paneer Sabzi with Phulka",
      nameHindi: "पनीर सब्जी फुल्के",
      calories: 450,
      estimatedCost: 120,
      recipeId: null,
      required_appliances: ["kadai", "tawa"],
      icmr_rationale: "Protein from paneer, no root vegetables",
      base_ingredients: [
        { ingredient: "paneer", qty_grams: 100 },
        { ingredient: "tomato", qty_grams: 80 },
        { ingredient: "wheat flour", qty_grams: 80 },
      ],
      ingredients: ["paneer", "tomato gravy", "wheat phulkas"],
      instructions: ["Cook paneer in tomato gravy", "Make phulkas on tawa", "Serve hot"],
      member_adjustments: {},
      member_plates: {},
    },
    default: {
      base_dish_name: "Roti Dal Sabzi",
      recipeName: "Roti Dal Sabzi",
      nameHindi: "रोटी दाल सब्जी",
      calories: 500,
      estimatedCost: 100,
      recipeId: null,
      required_appliances: ["pressure_cooker", "tawa"],
      icmr_rationale: "Balanced dinner, adequate protein and fiber",
      base_ingredients: [
        { ingredient: "toor dal", qty_grams: 50 },
        { ingredient: "wheat flour", qty_grams: 80 },
        { ingredient: "seasonal vegetable", qty_grams: 100 },
      ],
      ingredients: ["toor dal", "wheat rotis", "seasonal sabzi"],
      instructions: ["Cook dal", "Make rotis", "Prepare vegetable curry"],
      member_adjustments: {},
      member_plates: {},
    },
  },
};

export function getSafeFallback(
  slotKey: string,
  dietPreference: string,
): SafeFallback {
  const slotFallbacks = SAFE_FALLBACKS[slotKey] ?? SAFE_FALLBACKS["lunch"];
  const diet = dietPreference.toLowerCase();

  if (diet.includes("jain")) return slotFallbacks["jain"] ?? slotFallbacks["default"] ?? slotFallbacks["vegetarian"];
  if (diet.includes("veg")) return slotFallbacks["vegetarian"] ?? slotFallbacks["default"];
  return slotFallbacks["default"] ?? slotFallbacks["vegetarian"];
}
