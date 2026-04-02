/**
 * ICMR-NIN Nutritional Constants — Part 3 of 4 (Sections 10–12)
 * Sources:
 *   (1) Dietary Guidelines for Indians 2024, ICMR-NIN  [DGI_2024]
 *   (2) Dietary Guidelines for Indians — A Manual, NIN 2011  [NIN_2011]
 * Extraction date: 2026-04-02
 *
 * CONFLICT POLICY: Where documents differ, DGI_2024 value is used and noted.
 * Values marked NOT_IN_SOURCE were not found in either document.
 */

// ═══════════════════════════════════════════════════════════════════════
// SECTION 10 — COOKING METHOD NUTRITIONAL IMPACT
// ═══════════════════════════════════════════════════════════════════════

/**
 * How different cooking methods affect nutrient retention.
 *
 * Primary source: Guideline 13, DGI_2024, Pages 81–87.
 * Secondary source: NIN_2011, Pages 67–69 (cooking effects section).
 *
 * IMPORTANT: Neither document gives precise percentage nutrient loss figures
 * for most cooking methods. Where % loss is stated, it is noted.
 * Most rules are qualitative ("destroys", "reduces", "preserves").
 */
export const ICMR_COOKING_RULES = {

  nutrientRetentionRules: [

    // ─── OPEN-LID vs CLOSED-LID ────────────────────────────────────────────
    {
      nutrient: "All nutrients (general)",
      cookingMethod: "Open-lid cooking",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Open-lid cooking takes longer and exposure to air accelerates nutrient loss. — DGI_2024 Page 83",
    },
    {
      nutrient: "All nutrients (general)",
      cookingMethod: "Closed-lid cooking",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Closed-lid cooking is faster and nutrients are better retained due to shorter cooking time. Green vegetables change colour but nutrient loss is minimised. — DGI_2024 Page 83",
    },

    // ─── BOILING AND PRESSURE COOKING ─────────────────────────────────────
    {
      nutrient: "Anti-nutritional factors (enzyme inhibitors) in pulses",
      cookingMethod: "Boiling / Pressure cooking",
      impact: "destroys" as const,
      percentLossIfStated: null,
      notes: "Enzyme inhibitors that prevent nutrient digestion are destroyed by boiling/pressure cooking. Increases protein digestibility and availability. — DGI_2024 Page 83",
    },
    {
      nutrient: "Phytic acid in cereals and legumes",
      cookingMethod: "Boiling / Pressure cooking",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Phytic acid (which hinders absorption of minerals: iron, calcium, magnesium, zinc) decreases to a great extent after boiling or pressure cooking, making these minerals more absorbable. — DGI_2024 Page 83. NIN_2011 Page 68: consistent.",
    },
    {
      nutrient: "Folate in legumes",
      cookingMethod: "Boiling with just enough water (no drain)",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Boiling with just enough water without draining is the best method to retain folate in legumes. — DGI_2024 Page 83",
    },
    {
      nutrient: "Protein quality (lysine) in pulses",
      cookingMethod: "Prolonged boiling / overcooking",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Pulses should not be overcooked or boiled too long. Longer cooking causes loss of lysine, reducing protein nutritive value. — DGI_2024 Page 83",
    },
    {
      nutrient: "B-complex vitamins and Vitamin C",
      cookingMethod: "Boiling (when cooking water is discarded)",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "B complex vitamins and Vitamin C may be lost if cooking water after boiling is discarded. Prolonged boiling results in further vitamin loss. — DGI_2024 Page 83. NIN_2011 Page 68: 'heat-labile and water-soluble vitamins like vitamin B-complex and C is lost' during boiling.",
    },
    {
      nutrient: "Minerals (general)",
      cookingMethod: "Boiling",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Mineral content is not dramatically altered with boiling. — DGI_2024 Page 83",
    },

    // ─── STEAMING ──────────────────────────────────────────────────────────
    {
      nutrient: "Water-soluble vitamins and phytochemical compounds",
      cookingMethod: "Steaming",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Direct contact between vegetable tissue and water is avoided, minimising loss of water-soluble vitamins and phytochemicals through leaching. — DGI_2024 Page 83",
    },
    {
      nutrient: "Antioxidants and polyphenols",
      cookingMethod: "Steaming",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Steaming is the best cooking method to increase the level of both antioxidants and polyphenols (antioxidant activity) in vegetables and greens. — DGI_2024 Page 83",
    },
    {
      nutrient: "Beta-carotene and lutein",
      cookingMethod: "Steaming",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Steaming makes beta-carotene and lutein more readily available to the body. — DGI_2024 Page 83",
    },
    {
      nutrient: "Nutrients (general)",
      cookingMethod: "Steaming vs Blanching",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Steaming is better than blanching. Blanching involves water immersion and nutrients are lost along with water. Steaming avoids water contact. — DGI_2024 Page 82",
    },

    // ─── FRYING ────────────────────────────────────────────────────────────
    {
      nutrient: "Proteins, vitamins, antioxidants",
      cookingMethod: "Frying (deep or shallow)",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Due to high temperatures, changes occur in proteins, vitamins and antioxidants. Overall, moderate loss of vitamins and antioxidants and small loss of minerals. — DGI_2024 Page 83",
    },
    {
      nutrient: "Vitamin C",
      cookingMethod: "Frying",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Water-soluble vitamin C can be lost during water evaporation in frying. — DGI_2024 Page 83",
    },
    {
      nutrient: "Fats / oil quality (PUFA)",
      cookingMethod: "Repeated use of frying oil",
      impact: "destroys" as const,
      percentLossIfStated: null,
      notes: "Repeated heating of vegetable oils causes oxidation of PUFA, generating harmful/toxic compounds that increase cardiovascular disease and cancer risk. — DGI_2024 Page 55. NIN_2011 Page 69: 'Repeated heating of oils particularly PUFA-rich oils results in formation of peroxides and free radicals.'",
    },
    {
      nutrient: "Energy (fat content of food)",
      cookingMethod: "Frying",
      impact: "reduces" as const,  // impact on health — food absorbs oil, increasing energy
      percentLossIfStated: null,
      notes: "Main disadvantage: increases consumption of fats and oils. High-fat food intake linked with heart disease, stroke, type 2 diabetes. — DGI_2024 Page 83",
    },

    // ─── STIR-FRYING ────────────────────────────────────────────────────────
    {
      nutrient: "B vitamins",
      cookingMethod: "Stir-frying",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Cooking for short time without water prevents loss of B vitamins. Addition of fat improves absorption of plant compounds, antioxidants and fat-soluble vitamins. — DGI_2024 Page 84",
    },
    {
      nutrient: "Vitamin C",
      cookingMethod: "Stir-frying",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Vitamin C may be lost during stir-frying. Cooking time affects vitamin C losses more than cooking method — longer = more loss. — DGI_2024 Page 84",
    },
    {
      nutrient: "Fat-soluble vitamins and antioxidants",
      cookingMethod: "Stir-frying",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Fat addition in stir-frying improves absorption of fat-soluble vitamins (A, D, E, K) and plant antioxidants. Preserves nutrients better than cooking in liquid. — DGI_2024 Page 84",
    },
    {
      nutrient: "Heat-labile vitamins",
      cookingMethod: "Stir-frying (high heat)",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Rapid cooking and high temperature seals in nutrients but heat-labile vitamins will still begin to degrade. — DGI_2024 Page 84",
    },

    // ─── MICROWAVE ─────────────────────────────────────────────────────────
    {
      nutrient: "All nutrients (general)",
      cookingMethod: "Microwave cooking",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Minimal nutritional differences vs conventional cooking. Retains more vitamins and minerals than any other cooking method as no leaching occurs. Short cooking time preserves vitamin C and other heat-sensitive nutrients. — DGI_2024 Page 84. NIN_2011 Page 69: 'Microwave cooking is convenient, fast and preserves nutrients.'",
    },
    {
      nutrient: "Protein, lipids, vitamins, minerals",
      cookingMethod: "Microwave cooking",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Nutritional effects of microwaves on protein, lipid, vitamins and minerals are minimal. Prefer glass or microwave-safe ceramic vessels; avoid plastic. — DGI_2024 Page 84",
    },

    // ─── ROASTING ──────────────────────────────────────────────────────────
    {
      nutrient: "Heat-labile vitamins",
      cookingMethod: "Roasting (150–300°C)",
      impact: "destroys" as const,
      percentLossIfStated: null,
      notes: "Heat-labile vitamins are destroyed in large amounts during roasting. Roasting temp: 150–300°C. Lower constant temp (150–160°C) throughout cooking results in lower cooking loss vs high starting temp. — DGI_2024 Page 85",
    },
    {
      nutrient: "Minerals",
      cookingMethod: "Roasting",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Minerals remain intact with roasting. — DGI_2024 Page 85",
    },
    {
      nutrient: "Antioxidants in peanuts",
      cookingMethod: "Boiling peanuts (slow cooking)",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Boiling peanuts increases antioxidant concentration up to four times more than raw or roasted peanuts. — DGI_2024 Page 85",
    },

    // ─── GRILLING / BARBECUE ───────────────────────────────────────────────
    {
      nutrient: "Vitamins and minerals in meat (A, D, zinc, magnesium, iron, riboflavin, thiamine)",
      cookingMethod: "Grilling",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Grilled meat preserves more vitamins and minerals including vitamin A, D, zinc, magnesium, iron, riboflavin and thiamine. Same for grilled vegetables. — DGI_2024 Page 85–86",
    },
    {
      nutrient: "Fat content (excess fat in meat)",
      cookingMethod: "Grilling",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Grilling causes excess fat to melt and drip off. Other methods allow meat to cook in its own fat which can be reabsorbed. Grilling helps lower calorie intake. — DGI_2024 Page 85",
    },
    {
      nutrient: "Safety (carcinogens — PAHs)",
      cookingMethod: "Charcoal barbecue / continuous charcoal grilling",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Polycyclic Aromatic Hydrocarbons (PAHs) are carcinogenic compounds found in grilled/barbecued meats. Continuous barbecuing with the same charcoal results in higher concentration of certain carcinogens. Avoid charring — continuously turn meat. — DGI_2024 Page 85",
    },
    {
      nutrient: "AGE compounds (Advanced Glycation End Products)",
      cookingMethod: "Slow cooking / low-heat liquid cooking vs grilling/broiling",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Slow cooking meat in liquid at low heat reduces AGEs by 50% compared to broiling or grilling. — DGI_2024 Page 85. AGEs increase inflammation.",
    },

    // ─── AIR FRYING ────────────────────────────────────────────────────────
    {
      nutrient: "Fat / oil absorbed into food",
      cookingMethod: "Air frying",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Air frying significantly decreases oil absorption vs deep frying. Less oil = fewer calories, reduced obesity risk. — DGI_2024 Page 86",
    },
    {
      nutrient: "PUFA (omega-3) in fish",
      cookingMethod: "Air frying (fish)",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Air-frying fish may lower the amount of PUFA (heart-healthy omega-3 fats) and potentially increase inflammatory compounds. Adding herbs to fish may reduce fat oxidation during air frying. — DGI_2024 Page 86",
    },

    // ─── PRE-COOKING PROCESSES ─────────────────────────────────────────────
    {
      nutrient: "Water-soluble vitamins and minerals (from washing cut vegetables)",
      cookingMethod: "Soaking cut vegetables in water",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Cut vegetables, leafy vegetables and fruits should NOT be soaked in water as water-soluble minerals and vitamins tend to get lost. — DGI_2024 Page 81. NIN_2011 Page 68: consistent.",
    },
    {
      nutrient: "Vitamins (from washing grains)",
      cookingMethod: "Repeated washing of food grains (rice, pulses)",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Repeated washing of food grains results in loss of certain minerals and vitamins. Wash once, not repeatedly. — DGI_2024 Page 81. NIN_2011 Page 68: consistent.",
    },
    {
      nutrient: "Vitamins (from cutting vegetables small)",
      cookingMethod: "Cutting vegetables into small pieces",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Cutting vegetables into small pieces exposes greater surface area to atmosphere, resulting in loss of vitamins due to oxidation. Cut into larger pieces where possible. — DGI_2024 Page 81. NIN_2011 Page 68: 'vegetables should be cut into large pieces'.",
    },
    {
      nutrient: "B-complex vitamins in pulses",
      cookingMethod: "Using baking soda to hasten cooking of pulses",
      impact: "reduces" as const,
      percentLossIfStated: null,
      notes: "Use of baking soda for hastening cooking of pulses should NOT be practiced as it results in loss of vitamins. Also adds to sodium content. — DGI_2024 Page 88. NIN_2011 Page 68: consistent.",
    },
    {
      nutrient: "B-complex vitamins and Vitamin C",
      cookingMethod: "Fermentation (idli, dosa, dhokla)",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Fermentation improves digestibility and INCREASES B-complex vitamins and Vitamin C. Also increases bioavailability of micronutrients, especially iron and zinc. — DGI_2024 Page 81. NIN_2011 Page 68: 'fermentation…increase nutrients such as B-complex vitamins and vitamin C'.",
    },
    {
      nutrient: "All nutrients; vitamin content",
      cookingMethod: "Sprouting / Germination",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Sprouted whole grains contain all of the original bran, germ and endosperm. Nutrients in sprouts are more bioavailable than whole grains. Sprouting INCREASES the content of certain vitamins. Optimal sprout length = same as grain kernel; longer reduces nutrients. — DGI_2024 Pages 81–82. NIN_2011 Page 68: 'germination… improve digestibility'.",
    },
    {
      nutrient: "Antioxidants (from slow cooking tomatoes, corn, spinach)",
      cookingMethod: "Slow cooking",
      impact: "preserves" as const,
      percentLossIfStated: null,
      notes: "Slow cooking breaks down cell walls and releases powerful antioxidants from vegetables like tomatoes, corn, spinach, making them more available. — DGI_2024 Page 85",
    },

  ],

  recommendedMethods: [
    "Closed-lid cooking (faster, less nutrient loss)",
    "Pressure cooking (destroys anti-nutritional factors, reduces phytates)",
    "Steaming (best for antioxidants, polyphenols, water-soluble vitamins, beta-carotene)",
    "Microwave cooking (fastest, least nutrient loss overall)",
    "Stir-frying with minimal oil (preserves B vitamins; use for short periods)",
    "Grilling (preserves minerals and vitamins; reduces fat from meats)",
    "Slow cooking in liquid (reduces AGEs by 50% vs broiling/grilling)",
    "Fermentation (increases B vitamins, Vitamin C, improves mineral bioavailability)",
    "Sprouting/Germination (increases vitamin content, improves bioavailability)",
    "Boiling with just enough water without draining (preserves folate in legumes)",
  ],
  // Source: DGI_2024 Guideline 13 POINTS TO REGISTER Page 87–88; narrative Pages 81–86

  avoidMethods: [
    "Deep frying (large oil absorption, high calories, moderate vitamin/antioxidant loss)",
    "Open-lid cooking for long periods (air exposure, nutrient loss)",
    "Repeated reheating or reuse of cooking oils (generates toxic PUFA oxidation products)",
    "Mixing used frying oil with fresh oil (NIN_2011 Page 69 and DGI_2024 Page 55)",
    "Prolonged boiling / overcooking of pulses (destroys lysine, reduces protein quality)",
    "Cooking grains/pulses with excess water that is discarded (B vitamins, vitamin C lost)",
    "Charcoal barbecuing with the same charcoal repeatedly (high PAH carcinogen formation)",
    "Using baking soda when cooking pulses (destroys B vitamins, adds sodium)",
    "Soaking cut vegetables in water (water-soluble vitamins and minerals lost)",
    "Repeated washing of grains and pulses before cooking",
    "Using plastic vessels in microwave (use glass or microwave-safe ceramic)",
    "Cutting vegetables into very small pieces before cooking (vitamin oxidation)",
  ],
  // Source: DGI_2024 Guideline 13 Pages 81–88; NIN_2011 Pages 68–69

  soakingGerminatingBenefits: [
    "Soaking is the first step to sprouting — soak grains 12 hours minimum at room temperature",
    "Sprouting reduces phytic acid, which hinders mineral absorption (iron, zinc, calcium, magnesium)",
    "Sprouted grains/legumes have more bioavailable nutrients than whole unsprouted grains",
    "Sprouting increases the content of certain vitamins beyond what was in the original grain",
    "Fermentation (of batters for idli, dosa, dhokla) increases B-complex vitamins and Vitamin C",
    "Fermentation and sprouting both improve digestibility and bioavailability of micronutrients",
    "Soaking, popping, puffing, sprouting/germinating, malting and fermenting are established household methods — DGI_2024 Page 82",
    "Optimal sprout length = same as grain kernel — longer sprouts begin consuming the nutrient reserves — DGI_2024 Page 82",
  ],
  // Source: DGI_2024 Guideline 13 Pages 81–82

  reheatingWarning: "Consume cooked foods within 4–6 hours of preparation. If left at room temperature, reheat thoroughly before consuming. Avoid reheating and reuse of leftover heated oils. — DGI_2024 Guideline 12 POINTS TO REGISTER Page 80, and Guideline 13 Page 88. NIN_2011 Page 69: 'Never use partially heated food.'",

  cookwarePreference: [
    "Earthen pots: safest, require very little oil — DGI_2024 Page 86",
    "Stainless steel: durable, non-reactive with acidic or alkaline foods, does not impart metallic flavours — DGI_2024 Page 86",
    "Non-stick cookware: discard when coating is worn-out or damaged; do not heat empty pan above 170°C — DGI_2024 Page 86",
    "Granite stone cookware: set to maximum medium-high heat to protect non-stick coating — DGI_2024 Page 87",
    "Microwave: use glass or microwave-safe ceramic; avoid plastic — DGI_2024 Page 84, NIN_2011 Page 69",
  ],
  // Source: DGI_2024 Guideline 13 Pages 86–87

  source: "Guideline 13, DGI_2024, Pages 81–88; NIN_2011 Pages 67–69 (cooking effects section)",

} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 11 — ANTI-NUTRIENT AND FOOD INTERACTION RULES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Food–food and food–nutrient interactions that block or enhance absorption.
 * Extracted ONLY from DGI_2024 and NIN_2011.
 *
 * Sources:
 *   - DGI_2024 Guideline 13 Pages 81–83 (cooking effects on anti-nutrients)
 *   - DGI_2024 Guideline 2 Pages 14–18 (iron-specific interactions)
 *   - DGI_2024 Guideline 7 Pages 51–55 (fat-soluble vitamin absorption)
 *   - NIN_2011 Page 1125 (iron absorption)
 *   - NIN_2011 Pages 68–69 (cooking and anti-nutrients)
 */
export const ICMR_FOOD_INTERACTIONS = [

  // ─── IRON INTERACTIONS ─────────────────────────────────────────────────────
  {
    food1: "Tea (all types — tannins)",
    food2OrNutrient: "Dietary iron (non-haem / plant iron)",
    effect: "blocks" as const,
    mechanism: "Tannins in tea bind dietary iron and form insoluble iron-tannin complex, making iron unavailable for absorption",
    minimumSeparationHours: null,
    practicalRule: "Avoid tea before meals, during meals, and immediately after meals. Do not take tea with iron-folic acid (IFA) supplements. No precise hour-gap given in document — 'soon after a meal' is the stated boundary.",
    source: "DGI_2024 Guideline 2 Page 18; NIN_2011 Page 1125",
  },
  {
    food1: "Vitamin C-rich foods (guava, pineapple, citrus: lemon, orange, amla/gooseberry)",
    food2OrNutrient: "Non-haem iron (plant-source iron)",
    effect: "enhances" as const,
    mechanism: "Vitamin C (ascorbic acid) reduces ferric iron to more soluble ferrous form, significantly enhancing non-haem iron absorption from plant foods",
    minimumSeparationHours: 0,
    practicalRule: "Consume vitamin C-rich fruits at the same meal as iron-rich plant foods (GLVs, pulses, dry fruits). Do not take them hours apart.",
    source: "DGI_2024 Guideline 2 Page 14 and Page 18; NIN_2011 Page 1125",
  },
  {
    food1: "Fermented foods (idli batter, dosa batter, dhokla)",
    food2OrNutrient: "Non-haem iron (and zinc)",
    effect: "enhances" as const,
    mechanism: "Fermentation reduces phytate content; phytate is the main inhibitor of non-haem iron and zinc absorption from plant foods",
    minimumSeparationHours: null,
    practicalRule: "Use fermented preparations (idli, dosa, dhokla) as they improve bioavailability of iron and zinc from the same meal.",
    source: "DGI_2024 Guideline 2 Page 14; DGI_2024 Guideline 13 Page 81",
  },
  {
    food1: "Sprouted grains and legumes",
    food2OrNutrient: "Non-haem iron, zinc, calcium, magnesium",
    effect: "enhances" as const,
    mechanism: "Sprouting reduces phytic acid content in grains and legumes, improving mineral (iron, zinc, calcium, magnesium) absorption",
    minimumSeparationHours: null,
    practicalRule: "Sprout whole grains and legumes to improve mineral bioavailability. Optimal sprout length = same as grain kernel.",
    source: "DGI_2024 Guideline 2 Page 14; DGI_2024 Guideline 13 Pages 81–83",
  },
  {
    food1: "Animal-source foods (meat, fish, poultry — haem iron)",
    food2OrNutrient: "Non-haem iron (plant iron)",
    effect: "enhances" as const,
    mechanism: "Haem iron from animal foods is itself highly bioavailable (not blocked by phytates or tannins). Additionally, the 'meat factor' in flesh foods enhances absorption of non-haem iron consumed at the same meal.",
    minimumSeparationHours: 0,
    practicalRule: "Include small amounts of fish, poultry or meat in mixed meals to improve overall iron absorption from the meal.",
    source: "DGI_2024 Guideline 2 Page 18: 'Iron bio-availability is poor from plant foods but is good from flesh foods such as meat, fish and poultry products.'",
  },

  // ─── PHYTATE INTERACTIONS ──────────────────────────────────────────────────
  {
    food1: "Phytic acid (in cereals and legumes, raw or undercooked)",
    food2OrNutrient: "Minerals: iron, calcium, magnesium, zinc",
    effect: "blocks" as const,
    mechanism: "Phytic acid chelates divalent minerals (iron, calcium, magnesium, zinc), forming insoluble complexes that cannot be absorbed in the intestine",
    minimumSeparationHours: null,
    practicalRule: "Boil, pressure-cook, sprout, or ferment cereals and legumes to reduce phytic acid content. Do not eat raw or inadequately cooked pulses/grains as a significant mineral source.",
    source: "DGI_2024 Guideline 13 Page 83: 'concentration of phytic acid in cereals and legumes (which hinders the absorption of minerals) decreases to a great extent after boiling or pressure cooking making important minerals like iron, calcium, magnesium, and zinc absorbable'",
  },
  {
    food1: "Boiling / Pressure cooking",
    food2OrNutrient: "Phytic acid → Minerals (iron, calcium, magnesium, zinc) become absorbable",
    effect: "enhances" as const,
    mechanism: "High heat and hydration during boiling/pressure cooking reduces phytic acid, removing the mineral-chelation barrier",
    minimumSeparationHours: null,
    practicalRule: "Always adequately cook cereals and legumes (boil or pressure-cook) before consuming to maximise mineral bioavailability.",
    source: "DGI_2024 Guideline 13 Page 83",
  },

  // ─── FAT-SOLUBLE VITAMIN INTERACTIONS ─────────────────────────────────────
  {
    food1: "Dietary fat / cooking oil",
    food2OrNutrient: "Fat-soluble vitamins: A, D, E, K and carotenoids (beta-carotene, lutein)",
    effect: "enhances" as const,
    mechanism: "Fat-soluble vitamins require dietary fat for solubilisation and incorporation into micelles for intestinal absorption. Without dietary fat, absorption is poor.",
    minimumSeparationHours: 0,
    practicalRule: "Always consume fat-soluble vitamins (from vegetables, GLVs, fruits) with at least a small amount of fat (oil, ghee, nuts, seeds) in the same meal. Do not eat fat-free meals with fat-soluble vitamin-rich foods.",
    source: "DGI_2024 Guideline 7 Page 51: 'Fats serve as a vehicle for fat-soluble vitamins like vitamins A, D, E & K and carotenes, and promote their absorption.' DGI_2024 Page 83: steaming makes beta-carotene and lutein 'more readily available'; stir-frying with fat 'improves absorption of plant compounds, antioxidants and fat-soluble vitamins'.",
  },
  {
    food1: "Steaming vegetables",
    food2OrNutrient: "Beta-carotene and lutein",
    effect: "enhances" as const,
    mechanism: "Steaming breaks down plant cell walls, releasing carotenoids and making them more bioaccessible for absorption",
    minimumSeparationHours: null,
    practicalRule: "Steam vegetables rather than boiling (avoids leaching) or eating raw (cell walls limit carotenoid release). Combine with a small amount of fat to maximise absorption.",
    source: "DGI_2024 Guideline 13 Page 83",
  },

  // ─── PROTEIN / AMINO ACID COMPLEMENTATION ─────────────────────────────────
  {
    food1: "Cereals / millets (low in lysine, threonine, tryptophan)",
    food2OrNutrient: "Pulses / legumes (low in methionine) — complementary protein",
    effect: "enhances" as const,
    mechanism: "Cereals and pulses have complementary amino acid profiles. Together in 3:1 ratio they supply all nine essential amino acids (EAA), providing protein quality equivalent to animal protein.",
    minimumSeparationHours: 0,
    practicalRule: "Eat cereals and pulses together at the same meal in 3:1 ratio (raw weight) for complete protein. Do not rely on either alone for all EAA.",
    source: "DGI_2024 Guideline 8 Page 57–58; Table 8.1 Page 57",
  },
  {
    food1: "Milk (250ml/day)",
    food2OrNutrient: "Cereal + pulse diet — EAA completeness",
    effect: "enhances" as const,
    mechanism: "Milk provides all EAA including those limiting in plant foods; addition to a cereal-pulse diet fills any remaining EAA gaps",
    minimumSeparationHours: 0,
    practicalRule: "Adding 250ml milk per day to a cereal-pulse diet meets requirements of all essential amino acids — DGI_2024 Page 58.",
    source: "DGI_2024 Guideline 8 Page 58",
  },

  // ─── ENZYME INHIBITORS IN PULSES ──────────────────────────────────────────
  {
    food1: "Raw or undercooked pulses (enzyme inhibitors / trypsin inhibitors)",
    food2OrNutrient: "Protein digestibility",
    effect: "blocks" as const,
    mechanism: "Raw pulses contain trypsin inhibitors and other anti-nutritional factors (enzyme inhibitors) that prevent protein digestion",
    minimumSeparationHours: null,
    practicalRule: "Always adequately cook pulses (boil or pressure-cook). Anti-nutritional factors are destroyed by heat. Do not eat raw or insufficiently cooked pulses.",
    source: "DGI_2024 Guideline 13 Page 83: 'anti-nutritional factors (enzyme inhibitors that do not allow nutrients to get digested) are destroyed during boiling and pressure cooking'",
  },

  // ─── SODIUM–POTASSIUM BALANCE ─────────────────────────────────────────────
  {
    food1: "High-sodium diet (>5g salt/day)",
    food2OrNutrient: "Potassium (excretion), Blood pressure, Bone density",
    effect: "blocks" as const,
    mechanism: "High sodium intake increases renal excretion of potassium, disrupts Na:K ratio, raises blood pressure, and causes greater calcium excretion (reducing bone density)",
    minimumSeparationHours: null,
    practicalRule: "Limit salt to 5g/day. Increase potassium-rich foods (vegetables 400g/day, fruits 100g/day) to maintain optimal Na:K ratio. The Na:K ratio is more important than sodium alone for blood pressure outcomes.",
    source: "DGI_2024 Guideline 11 Pages 73–74: 'High sodium intake leads to greater calcium excretion, which may result in reduction in bone density.' 'It is the ratio of sodium to potassium in the diet which is important.'",
  },
  {
    food1: "Potassium-rich foods (vegetables, fruits, beans, lentils, banana, coconut water)",
    food2OrNutrient: "Sodium (blood pressure impact)",
    effect: "enhances" as const,
    mechanism: "Potassium helps excrete sodium via kidneys, lowers blood pressure, and improves Na:K ratio — the key determinant of blood pressure outcomes",
    minimumSeparationHours: 0,
    practicalRule: "Eat 400g vegetables and 100g fruits daily to meet the potassium target of 3800mg/day. This will naturally lower the Na:K ratio and mitigate sodium's hypertensive effects.",
    source: "DGI_2024 Guideline 11 Pages 73–76",
  },

  // ─── LYSINE LOSS IN OVERCOOKING ───────────────────────────────────────────
  {
    food1: "Prolonged boiling / overcooking of pulses",
    food2OrNutrient: "Lysine (essential amino acid)",
    effect: "blocks" as const,
    mechanism: "Extended heat causes Maillard-type reactions and thermal degradation of lysine, reducing protein quality of pulses",
    minimumSeparationHours: null,
    practicalRule: "Do not overcook pulses. Cook until just tender — extended cooking reduces lysine and overall protein nutritive value.",
    source: "DGI_2024 Guideline 13 Page 83",
  },

  // ─── CALCIUM AND IRON ─────────────────────────────────────────────────────
  {
    food1: "Milk (high calcium, poor iron source)",
    food2OrNutrient: "Iron status (as a food choice)",
    effect: "blocks" as const,
    mechanism: "Milk displaces iron-rich foods and calcium competes with iron for absorption at high intakes; however the document specifically states milk is 'poor source of iron' rather than giving a specific inhibition rate",
    minimumSeparationHours: null,
    practicalRule: "Do not rely on milk for iron. Use milk for calcium and protein. Ensure iron needs are met from separate GLV, pulse, dry fruit and flesh food sources.",
    source: "DGI_2024 Guideline 2 Page 14: 'Milk is the best source of biologically available calcium but is a poor source of iron.'",
  },

] as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 12 — BMI AND ANTHROPOMETRIC STANDARDS FOR INDIANS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Indian-specific BMI classification and anthropometric cut-offs.
 *
 * IMPORTANT: Indian (Asian) cut-offs differ from WHO global standards.
 * WHO global: Normal 18.5–25, Overweight 25–30, Obese >30.
 * Indian/Asian: Normal 18.5–23, Overweight 23–27.5, Obese >27.5.
 *
 * Sources:
 *   - DGI_2024 Guideline 9 Pages 62–64 (primary)
 *   - NIN_2011 Pages 52–53 (consistent with DGI_2024 for Asian cut-offs)
 */
export const ICMR_ANTHROPOMETRIC_STANDARDS = {

  // ─── BMI Classification (Indian / Asian cut-offs) ─────────────────────────
  bmiClassification: [
    {
      label: "Chronic Energy Deficiency (CED) / Underweight",
      minBMI: null,    // no lower bound given
      maxBMI: 18.5,    // exclusive
      notes: "BMI < 18.5 kg/m². Labelled 'Underweight (BMI <18.5 kg/m²)' for pregnant women — DGI_2024 Page 19. Labelled 'Chronic Energy Deficiency (CED)' in DGI_2024 Table II Page 5. NIN_2011 Page 52: BMI < 18.5 = undernourished.",
      source: "DGI_2024 Pages 5, 19, 62; NIN_2011 Page 52",
    },
    {
      label: "Normal (Ideal)",
      minBMI: 18.5,    // inclusive
      maxBMI: 23.0,    // inclusive
      notes: "BMI 18.5–23 kg/m². Recommended normal range for Asians/Indians. 'For Asians it is recommended that the BMI should be between 18.5 to 23 Kg/M², since they tend to have higher percentage body fat even at a given BMI compared to Caucasians and Europeans, which leaves them at a higher risk of NCDs.' — DGI_2024 Page 63. NIN_2011 Page 52: consistent.",
      source: "DGI_2024 Page 62–63; NIN_2011 Page 52",
    },
    {
      label: "Overweight",
      minBMI: 23.0,    // exclusive (>23)
      maxBMI: 27.5,    // inclusive
      notes: "BMI ranging over 23 to 27.5 kg/m² is overweight as per Asian cut-offs. 'Over 31% of urban and 16% of rural adults are overweight (NNMB).' — DGI_2024 Page 63. NIN_2011 does not explicitly state the upper overweight limit of 27.5 but references Asian cut-offs consistently.",
      source: "DGI_2024 Page 63",
    },
    {
      label: "Obese",
      minBMI: 27.5,    // exclusive (>27.5)
      maxBMI: null,    // no upper bound
      notes: "BMI above 27.5 kg/m² is obesity as per Asian cut-offs. 'Over 12% urban and 5% rural adults are obese (NNMB).' — DGI_2024 Page 63.",
      source: "DGI_2024 Page 63",
    },
  ],

  // ─── WHO Global BMI (for reference / comparison only) ────────────────────
  whoGlobalBMIClassification: [
    {
      label: "Normal (WHO global)",
      minBMI: 18.5,
      maxBMI: 25.0,
      notes: "WHO global normal range. NOT recommended for Indians — Asian cut-offs above apply. 'In general, BMI for adults, as per WHO, ranging from 18.5 to 25 kg/m² is considered to be normal. However, for Asians it is recommended that the BMI should be between 18.5 to 23 kg/m².' — DGI_2024 Page 62–63.",
      source: "DGI_2024 Page 62–63",
    },
  ],

  // ─── Abdominal / Central Obesity Cut-offs ────────────────────────────────
  abdominalObesityWaistCmMale: 90,
  // "Waist circumference of >90cm for men … is associated with increased risk
  //  of several chronic lifestyle diseases." — DGI_2024 Page 63.
  // NIN_2011 Page 53: consistent — "waist circumference 90cm for men".

  abdominalObesityWaistCmFemale: 80,
  // "Waist circumference of … >80cm for women is associated with increased risk
  //  of several chronic lifestyle diseases." — DGI_2024 Page 63.
  // NIN_2011 Page 53: consistent — "waist circumference … 80cm for women".

  waistHipRatioRiskMale: 0.9,
  // "Waist-to-hip ratio of more than 0.9 among men … associated with increased
  //  risk of chronic diseases especially in Asian Indians." — NIN_2011 Page 53.
  // DGI_2024 does not give a waist-to-hip ratio — NIN_2011 value only.

  waistHipRatioRiskFemale: 0.8,
  // "Waist-to-hip ratio of … 0.8 in women … associated with increased risk of
  //  chronic diseases especially in Asian Indians." — NIN_2011 Page 53.

  abdominalObesityPrevalence: {
    urban: "53%",
    rural: "19%",
    notes: "Abdominal obesity as per NNMB data cited in DGI_2024 Page 63",
    source: "DGI_2024 Page 63",
  },

  // ─── Population overweight/obesity prevalence (from DGI_2024) ────────────
  overweightPrevalence: {
    urban: "31% (over 31% of urban adults)",
    rural: "16% (16% of rural adults)",
    source: "DGI_2024 Page 63",
  },
  obesityPrevalence: {
    urban: "12% (over 12% of urban adults)",
    rural: "5% (5% of rural adults)",
    source: "DGI_2024 Page 63",
  },
  overweightOrObesePopulationPercent: 25,
  // "About 25% of Indians are either overweight or obese." — DGI_2024 Page 62

  // ─── BMI Formula ─────────────────────────────────────────────────────────
  bmiFormula: "BMI = Weight (kg) ÷ Height (m)²",
  // DGI_2024 Page 62; NIN_2011 Page 52 — both state this formula.

  normalBMIRangeIndians: "18.5 to 23 kg/m²",
  overweightBMICutoffIndians: 23.0,   // >23 = overweight
  obesityBMICutoffIndians: 27.5,      // >27.5 = obese
  underweightBMICutoffIndians: 18.5,  // <18.5 = underweight / CED

  // ─── Pregnancy BMI and weight gain ───────────────────────────────────────
  pregnancyBMI: {
    normalRange: "18.5–23 kg/m²",
    underweightCutoff: 18.5,
    overweightCutoff: 23.0,
    obeseCutoff: 27.5,
    underweightGuidance: "Underweight women (BMI <18.5) should increase dietary intake and access ICDS take-home rations; weight gain should be monitored — DGI_2024 Page 19",
    overweightGuidance: "Women who are overweight (BMI 23–27.5) should gain moderately — DGI_2024 Page 19",
    obeseGuidance: "Women who are obese (BMI >27.5) should aim to gain not more than 5–9 kg during pregnancy — DGI_2024 Page 17 (text was slightly ambiguous in extraction)",
    source: "DGI_2024 Pages 17–19",
  },

  // ─── Children and Adolescents BMI (reference to external standard) ────────
  childrenAdolescentsBMINote: "Cut-off levels for children and adolescents are different from adults. Age and gender-specific BMI Z-scores of a reference population (WHO growth standards) are used. Children with BMI < 5th centile = undernourished; 5th–85th centile = normal; 85th–95th centile = overweight; >95th centile = obese. — NIN_2011 Page 53. For 0–5 yrs: WHO child growth standards (https://www.who.int/tools/child-growth-standards). For school age and adolescents: WHO growth reference 5–19 years. — DGI_2024 Page 43.",

  // ─── Reference height/weight tables (WHO) ────────────────────────────────
  heightWeightTablesNote: "DGI_2024 Tables 5.1–5.4 (Pages 43–45) contain WHO median height-for-age (boys and girls, 2–5 years) and WHO median weight-for-height (boys and girls, 2–5 years). These tables have 100+ rows each and have NOT been extracted here as numeric arrays to avoid file size bloat. Refer to the PDF directly or the cited WHO URLs in the document. If needed, these can be added as a separate constant in Part 4.",

  source: "Guideline 9, DGI_2024 Pages 62–64; NIN_2011 Pages 52–53",

} as const;


// ═══════════════════════════════════════════════════════════════════════
// EXTRACTION NOTES — PART 3 (Sections 10–12)
// ═══════════════════════════════════════════════════════════════════════

export const EXTRACTION_NOTES_PART3 = {

  conflictsBetweenDocuments: [
    "SECTION 10 / Microwave safety: DGI_2024 Page 84 warns against plastic vessels in microwave. NIN_2011 Page 69 says 'use glass or pottery dishes and food grade microwave friendly plastic dishes' — NIN_2011 permits food-grade microwave plastic; DGI_2024 says avoid plastic entirely. DGI_2024 (stricter) recorded.",
    "SECTION 10 / Used frying oil: NIN_2011 Page 69 says 'oils which have been repeatedly heated should not be mixed with fresh oil but should be used for seasoning' (implying one reuse for seasoning is okay). DGI_2024 Page 88 says 'Avoid reheating and reuse of leftover heated oils' categorically. DGI_2024 (stricter) recorded.",
    "SECTION 12 / NIN_2011 Page 52 references 'BMI 18.5 to 25' as globally normal but acknowledges 18.5–23 for Asians, consistent with DGI_2024. No real conflict on Indian values.",
  ],

  valuesNotFound: [
    "SECTION 10 / Precise percentage nutrient loss for each cooking method — neither document gives e.g. '30% vitamin C lost in boiling'. All impacts are qualitative.",
    "SECTION 10 / Cooking time-temperature combinations for specific dishes — not given.",
    "SECTION 11 / Oxalate interactions (spinach oxalate inhibiting calcium absorption) — NOT mentioned in either document. Not extracted.",
    "SECTION 11 / Zinc absorption inhibitors other than phytates — not explicitly stated in either document.",
    "SECTION 11 / Polyphenol-iron inhibition beyond tea tannins — tannins are the only named polyphenol inhibitor of iron.",
    "SECTION 12 / Indian-specific reference body weight tables (adult) — neither document provides a height-to-ideal-weight table for Indian adults; only BMI ranges are given.",
    "SECTION 12 / Children/adolescent Indian-specific BMI percentile tables — document references WHO tables externally; not reproduced in the text.",
  ],

  ambiguousValues: [
    "SECTION 11 / Tea inhibition gap: Document states 'before, during, or soon after a meal' — no hour gap is specified. Recorded as null hours with qualitative rule.",
    "SECTION 11 / Calcium-iron competition: DGI_2024 states milk is a 'poor source of iron' but does not state calcium blocks iron absorption at a specific intake threshold. The interaction is inferred from the document's guidance, not stated mechanistically.",
    "SECTION 12 / Pregnancy weight gain: DGI_2024 Page 17 states 'not more than 5–9 kg' for obese women but the surrounding text was extracted from a multi-column layout and may need verification against the original PDF for context (whether this applies to obese women only or all pregnant women).",
    "SECTION 10 / Slow cooking AGE reduction '50 percent' — stated in DGI_2024 Page 85 for slow cooking vs broiling/grilling. The exact comparison conditions are not given (time, temperature, meat type).",
  ],

  tablesPartiallyExtracted: [
    "SECTION 12 / WHO height-for-age and weight-for-height tables (DGI_2024 Tables 5.1–5.4, Pages 43–45): These contain 100+ rows of centimetre and kilogram values and have been excluded from this file to manage size. They are WHO standard tables (not ICMR-generated data) and are available from the WHO website cited in the document.",
  ],

} as const;
