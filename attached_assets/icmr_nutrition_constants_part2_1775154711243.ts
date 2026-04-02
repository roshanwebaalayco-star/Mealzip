/**
 * ICMR-NIN Nutritional Constants — Part 2 of 4 (Sections 5–9)
 * Sources:
 *   (1) Dietary Guidelines for Indians 2024, ICMR-NIN  [DGI_2024]
 *   (2) Dietary Guidelines for Indians — A Manual, NIN 2011  [NIN_2011]
 * Extraction date: 2026-04-02
 *
 * CONFLICT POLICY: Where documents differ, DGI_2024 value is used and noted.
 * Values marked NOT_IN_SOURCE were not found in either document.
 */

// ═══════════════════════════════════════════════════════════════════════
// SECTION 5 — GLYCEMIC INDEX AND GLYCEMIC LOAD TABLE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Glycemic Index (GI) and Glycemic Load (GL) of commonly consumed Indian foods.
 *
 * Source: ANNEXURE III, DGI_2024, Pages 125–126.
 * Original study sources cited in Annexure III:
 *   Source 1: Devindra S, et al (2017). Int. J. Diab. Dev. Coun. 37(4):426-431
 *   Source 2: Devindra S, et al (2022). Journal of Food Science and Technology.
 *             59, 3619-3626.
 *
 * IMPORTANT NOTES FROM SOURCE DOCUMENT:
 *   - "The GI and GL are calculated for 50g of available carbohydrates."
 *   - "The GI and GL are only indicative. They may differ depending on the
 *      ratios of different ingredients and preparation methods."
 *   - Each value is the mean of ten participants.
 *   - GI classification thresholds used here follow standard WHO/FAO cut-offs:
 *       LOW    = GI < 55
 *       MEDIUM = GI 55–70
 *       HIGH   = GI > 70
 *
 * The Annexure contains TWO tables:
 *   Table A: Indicative glycemic carbohydrates (g/100g dry matter) — NOT GI values.
 *   Table B: Representative GI and GL (mean ± SD) — these are the actual GI/GL values.
 * Only Table B values are used below as GI/GL. Table A glycemic carbohydrate
 * contents are included as a separate constant ICMR_GLYCEMIC_CARB_CONTENT.
 *
 * NIN_2011 does not contain a GI/GL table.
 */
export const ICMR_GLYCEMIC_INDEX_TABLE: Record<string, {
  gi: number,
  gl: number,
  giSD: number,     // standard deviation of GI (from source)
  glSD: number,     // standard deviation of GL (from source)
  category: "low" | "medium" | "high",
  foodType: "cereal" | "pulse" | "recipe" | "vegetable" | "fruit" | "other",
  notes: string | null,
}> = {

  // ─── CEREALS AND GRAINS ────────────────────────────────────────────────────
  "rice": {
    gi: 78.23, giSD: 4.24,
    gl: 49.38, glSD: 2.67,
    category: "high",
    foodType: "cereal",
    notes: "Annexure III Table B, DGI_2024 Page 126. Variety not specified.",
  },
  "wheat_chapati": {
    gi: 65.66, giSD: 4.22,
    gl: 32.83, glSD: 2.11,
    category: "medium",
    foodType: "cereal",
    notes: "Annexure III Table B, DGI_2024 Page 126. Listed as 'Wheat chapatti'.",
  },

  // ─── PULSES AND LEGUMES ────────────────────────────────────────────────────
  "mixed_dhal": {
    gi: 43.64, giSD: 6.98,
    gl: 21.82, glSD: 3.49,
    category: "low",
    foodType: "pulse",
    notes: "Annexure III Table B, DGI_2024 Page 126. Composite food — analysed as mixed dal.",
  },
  "red_gram_toor_dal": {
    gi: 43.01, giSD: 4.93,
    gl: 21.50, glSD: 2.46,
    category: "low",
    foodType: "pulse",
    notes: "Annexure III Table B, DGI_2024 Page 126. Listed as 'Red gram'.",
  },
  "green_gram_moong_dal": {
    gi: 42.45, giSD: 4.05,
    gl: 21.22, glSD: 2.02,
    category: "low",
    foodType: "pulse",
    notes: "Annexure III Table B, DGI_2024 Page 126. Listed as 'Green gram'.",
  },
  "masoor_dhal": {
    gi: 42.15, giSD: 3.26,
    gl: 21.07, glSD: 1.63,
    category: "low",
    foodType: "pulse",
    notes: "Annexure III Table B, DGI_2024 Page 126.",
  },
  "wheat_chana_barley_combo": {
    gi: 39.27, giSD: 5.20,
    gl: 19.63, glSD: 6.33,
    category: "low",
    foodType: "pulse",
    notes: "Annexure III Table B, DGI_2024 Page 126. Listed as 'Wheat + chana dhal + barley'. Composite food. Analysed as a cereal-pulse blend.",
  },
  "bengal_gram_chana": {
    gi: 37.95, giSD: 5.73,
    gl: 18.97, glSD: 2.86,
    category: "low",
    foodType: "pulse",
    notes: "Annexure III Table B, DGI_2024 Page 126. Listed as 'Bengal gram'.",
  },
  "wheat_chana_combo": {
    gi: 32.37, giSD: 9.10,
    gl: 16.18, glSD: 5.30,
    category: "low",
    foodType: "pulse",
    notes: "Annexure III Table B, DGI_2024 Page 126. Listed as 'Wheat + chana dhal'. Composite food.",
  },

  // ─── INDIAN RECIPES ────────────────────────────────────────────────────────
  "onion_dosa": {
    gi: 79.69, giSD: 5.9,
    gl: 39.84, glSD: 4.8,
    category: "high",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126.",
  },
  "plain_dosa": {
    gi: 79.39, giSD: 6.8,
    gl: 39.69, glSD: 2.7,
    category: "high",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126.",
  },
  "lemon_rice": {
    gi: 79.30, giSD: 5.9,
    gl: 39.65, glSD: 3.9,
    category: "high",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126.",
  },
  "open_dosa": {
    gi: 77.33, giSD: 5.7,
    gl: 39.34, glSD: 3.5,
    category: "high",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126.",
  },
  "bisibelebhath": {
    gi: 74.64, giSD: 5.8,
    gl: 32.59, glSD: 5.6,
    category: "high",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126. South Indian rice-lentil-vegetable dish.",
  },
  "vegetable_biryani": {
    gi: 74.53, giSD: 6.1,
    gl: 37.26, glSD: 7.3,
    category: "high",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126.",
  },
  "mla_upmapesarattu": {
    gi: 72.85, giSD: 5.8,
    gl: 36.42, glSD: 6.7,
    category: "high",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126. MLA Upma Pesarattu — green gram crepe with upma filling.",
  },
  "rawa_paneer_dosa": {
    gi: 71.94, giSD: 6.2,
    gl: 35.97, glSD: 5.2,
    category: "high",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126. Listed as 'Ravapaneerdosa'.",
  },
  "paneer_dosa": {
    gi: 71.47, giSD: 4.3,
    gl: 35.73, glSD: 3.7,
    category: "high",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126. Listed as 'Paneerdosa'.",
  },
  "mla_dosa": {
    gi: 71.17, giSD: 6.6,
    gl: 35.58, glSD: 5.4,
    category: "high",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126.",
  },
  "open_veg_paneer_dosa": {
    gi: 70.98, giSD: 6.4,
    gl: 35.49, glSD: 6.8,
    category: "high",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126.",
  },
  "tomato_rice": {
    gi: 68.89, giSD: 6.2,
    gl: 34.44, glSD: 7.3,
    category: "medium",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126.",
  },
  "idli_sambar": {
    gi: 68.69, giSD: 5.8,
    gl: 34.34, glSD: 7.1,
    category: "medium",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126. Composite — idli served with sambar.",
  },
  "tomato_bhath": {
    gi: 68.57, giSD: 5.8,
    gl: 36.54, glSD: 7.3,
    category: "medium",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126.",
  },
  "onion_rawa_dosa": {
    gi: 66.43, giSD: 5.7,
    gl: 33.21, glSD: 5.3,
    category: "medium",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126. Listed as 'Onion ravadosa'.",
  },
  "set_dosa": {
    gi: 65.97, giSD: 5.7,
    gl: 32.98, glSD: 6.5,
    category: "medium",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126.",
  },
  "curd_rice": {
    gi: 64.94, giSD: 5.6,
    gl: 32.47, glSD: 7.5,
    category: "medium",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126.",
  },
  "vegetable_dosa": {
    gi: 63.97, giSD: 5.7,
    gl: 31.98, glSD: 7.4,
    category: "medium",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126.",
  },
  "chapati": {
    gi: 62.43, giSD: 6.1,
    gl: 28.37, glSD: 5.3,
    category: "medium",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126. Listed separately from 'Wheat chapatti' — this is the recipe entry; wheat chapatti above is the grain entry. Values differ slightly.",
  },
  "pesarattu": {
    gi: 60.69, giSD: 5.7,
    gl: 33.70, glSD: 9.5,
    category: "medium",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126. Green gram (moong) crepe.",
  },
  "vada_sambar": {
    gi: 36.89, giSD: 5.7,
    gl: 18.44, glSD: 7.7,
    category: "low",
    foodType: "recipe",
    notes: "Annexure III Table B, DGI_2024 Page 126. Listed as 'Vadasambar'. Urad dal fritter with sambar.",
  },

} as const;


/**
 * Glycemic carbohydrate content (g per 100g dry matter) of common Indian foods.
 * These are NOT GI values — they represent the digestible/available carbohydrate
 * fraction as measured by in vitro enzyme digestion (simulating GI digestion).
 *
 * Source: ANNEXURE III Table A, DGI_2024, Page 125.
 * Method: Modified Anthrone method after simulating human GI digestion with enzymes.
 * Note: Items marked * were analysed as composite foods.
 */
export const ICMR_GLYCEMIC_CARB_CONTENT: Record<string, {
  glycemicCarbsPer100gDryMatter: number,
  sd: number,
  notes: string | null,
}> = {
  "rice":                        { glycemicCarbsPer100gDryMatter: 79.22, sd: 0.67, notes: "DGI_2024 Annexure III Table A Page 125" },
  "barley":                      { glycemicCarbsPer100gDryMatter: 64.99, sd: 0.21, notes: "DGI_2024 Annexure III Table A Page 125" },
  "wheat":                       { glycemicCarbsPer100gDryMatter: 63.26, sd: 0.23, notes: "DGI_2024 Annexure III Table A Page 125" },
  "chana_dhal":                  { glycemicCarbsPer100gDryMatter: 56.22, sd: 0.62, notes: "DGI_2024 Annexure III Table A Page 125" },
  "masoor_dhal":                 { glycemicCarbsPer100gDryMatter: 52.52, sd: 0.83, notes: "DGI_2024 Annexure III Table A Page 125" },
  "bengal_gram":                 { glycemicCarbsPer100gDryMatter: 52.33, sd: 1.29, notes: "DGI_2024 Annexure III Table A Page 125" },
  "red_gram_dhal":               { glycemicCarbsPer100gDryMatter: 51.90, sd: 1.03, notes: "DGI_2024 Annexure III Table A Page 125" },
  "green_gram_dhal":             { glycemicCarbsPer100gDryMatter: 51.24, sd: 1.72, notes: "DGI_2024 Annexure III Table A Page 125" },
  "wheat_chana_60_40":           { glycemicCarbsPer100gDryMatter: 49.94, sd: 1.27, notes: "DGI_2024 Annexure III Table A Page 125. Composite: wheat 60%, chana 40%. Marked * (composite food)." },
  "wheat_chana_barley_40_30_30": { glycemicCarbsPer100gDryMatter: 46.89, sd: 0.22, notes: "DGI_2024 Annexure III Table A Page 125. Composite: wheat 40%, chana 30%, barley 30%. Marked *." },
  "mixed_dhal_composite":        { glycemicCarbsPer100gDryMatter: 40.09, sd: 1.56, notes: "DGI_2024 Annexure III Table A Page 125. Marked * (composite food)." },
  // Indian recipes (from Table A — glycemic carbs, not GI)
  "vegetable_biryani_tableA":    { glycemicCarbsPer100gDryMatter: 71.84, sd: 3.1,  notes: "DGI_2024 Annexure III Table A Page 125. Marked * (Indian recipe)." },
  "tomato_rice_tableA":          { glycemicCarbsPer100gDryMatter: 71.35, sd: 0.2,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "curd_rice_tableA":            { glycemicCarbsPer100gDryMatter: 70.96, sd: 0.7,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "onion_ravadosa_tableA":       { glycemicCarbsPer100gDryMatter: 70.95, sd: 0.5,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "plain_dosa_tableA":           { glycemicCarbsPer100gDryMatter: 70.75, sd: 0.3,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "mysore_bonda_tableA":         { glycemicCarbsPer100gDryMatter: 70.38, sd: 0.1,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "lemon_rice_tableA":           { glycemicCarbsPer100gDryMatter: 70.36, sd: 0.1,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "open_dosa_tableA":            { glycemicCarbsPer100gDryMatter: 70.33, sd: 5.7,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "mla_dosa_tableA":             { glycemicCarbsPer100gDryMatter: 70.13, sd: 0.5,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "onion_dosa_tableA":           { glycemicCarbsPer100gDryMatter: 69.96, sd: 0.3,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "set_dosa_tableA":             { glycemicCarbsPer100gDryMatter: 69.93, sd: 0.2,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "vegetable_dosa_tableA":       { glycemicCarbsPer100gDryMatter: 69.56, sd: 2.9,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "paneer_dosa_tableA":          { glycemicCarbsPer100gDryMatter: 68.69, sd: 0.6,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "open_veg_paneer_dosa_tableA": { glycemicCarbsPer100gDryMatter: 66.34, sd: 0.9,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "mla_upmapesarattu_tableA":    { glycemicCarbsPer100gDryMatter: 66.26, sd: 2.7,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "chapati_tableA":              { glycemicCarbsPer100gDryMatter: 66.12, sd: 2.2,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "pesarattu_tableA":            { glycemicCarbsPer100gDryMatter: 65.75, sd: 0.1,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "rawa_paneer_dosa_tableA":     { glycemicCarbsPer100gDryMatter: 65.17, sd: 3.1,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "parota_tableA":               { glycemicCarbsPer100gDryMatter: 63.50, sd: 1.3,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "tomato_bhath_tableA":         { glycemicCarbsPer100gDryMatter: 61.49, sd: 2.0,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "idli_sambar_tableA":          { glycemicCarbsPer100gDryMatter: 58.98, sd: 0.0,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "bisibelebhath_tableA":        { glycemicCarbsPer100gDryMatter: 56.99, sd: 0.2,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
  "vada_sambar_tableA":          { glycemicCarbsPer100gDryMatter: 49.63, sd: 1.5,  notes: "DGI_2024 Annexure III Table A Page 125. Marked *." },
} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 6 — CLINICAL CONDITION DIETARY RULES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Condition-specific dietary rules extracted ONLY from DGI_2024 and NIN_2011.
 * No training-knowledge additions. If a condition is not covered, the field
 * is marked NOT_IN_SOURCE.
 *
 * Sources per condition are noted in each sub-object's sourceGuideline field.
 */
export const CLINICAL_DIETARY_RULES = {

  // ─── 6a. Type 2 Diabetes / Pre-Diabetes ────────────────────────────────────
  diabetes_type_2: {
    avoidFoods: [
      "Sugar-sweetened carbonated beverages",
      "Non-carbonated sweetened beverages",
      "Health drinks and energy drinks",
      "Foods containing highly refined ingredients (biscuits, cakes, chips, white bread)",
      "Deep-fried snacks",
      "Fresh fruit juices (prefer whole fruits)",
      "High GI / high GL foods (promote rapid glucose absorption and insulin spikes)",
      "Ultra-processed foods (UPFs)",
      "Sweets, candies",
    ],
    limitFoods: [
      "Refined cereals (maida, white rice in large portions)",
      "High-sugar foods (>5% energy from added sugar)",
      "Cooking oils (limit to 27–30g/day at 2000 kcal; reduce further if overweight)",
      "Fatty cuts of meat (choose lean/skinless poultry instead)",
    ],
    includeFoods: [
      "Whole grains (minimally processed rice, whole wheat roti, millets / nutricereals, oats, barley, bamboo rice)",
      "Legumes (beans and lentils) in cereal:pulse ratio of 3:1 or 5:1",
      "Pulses, nuts, chia seeds, flax seeds — improve satiety and blood glucose control",
      "Fresh vegetables — low calorie, high fibre, high micronutrients",
      "Whole fruits (not juices) — prefer low-GI fruits",
      "Green leafy vegetables — fenugreek shows anti-diabetic activity",
      "Cinnamon, fenugreek, garlic, pepper, cloves — named as having anti-diabetic or antioxidant activity",
      "Lean meat, skinless poultry, fish — lower in saturated fat vs fatty cuts",
      "Tender coconut water, buttermilk, fresh lemon juice — as beverage alternatives",
    ],
    quantitativeLimits: [
      "Added sugar: <5% of total daily energy (i.e., <25–30g at 2000 kcal) — DGI_2024 Table 1.2a, 1.6 footnotes",
      "Weight-reducing energy deficit: 500–750 kcal/day below TDEE to preserve muscle mass — DGI_2024 Page 65",
      "Maximum energy deficit for muscle preservation: 40% of daily energy needs — DGI_2024 Page 65",
      "Weight-reducing diet floor: not less than 1000 kcal/day — DGI_2024 Page 64",
      "Safe weight loss rate: 0.5 kg per week — DGI_2024 Page 64",
      "Protein during weight loss: 15% of energy (higher than baseline 10–15%) to preserve muscle — DGI_2024 Page 65",
      "High GI foods (GI > 70): regular consumption causes sustained high insulin; avoid — DGI_2024 Page 65–66",
    ],
    preparationRules: [
      "Prefer grilling, baking, steaming, sautéing with minimal oil instead of frying",
      "Use whole grains — at least 50% of cereals as whole grain — DGI_2024 sample menus",
      "Include at least 3:1 or 5:1 cereal-to-pulse ratio to lower overall GI of meal — DGI_2024 Page 65",
    ],
    sourceGuideline: "Guideline 9 (Obesity/overweight), DGI_2024 Pages 62–68; Guideline 1, DGI_2024 Pages 4–7; Annexure III (GI table) DGI_2024 Pages 125–126",
  },

  // ─── 6b. Hypertension / High Blood Pressure ────────────────────────────────
  hypertension: {
    avoidFoods: [
      "Snack foods (chips, namkeens, savouries)",
      "Packaged soups, sauces, ketchup",
      "Salted butter, processed cheese",
      "Canned foods",
      "Papads (especially salted)",
      "Salted dry fish",
      "Salted nuts / dry fruits",
      "Preserved meats and vegetables",
      "Ready-to-eat foods (high sodium)",
      "Baking soda (sodium bicarbonate) in excess",
      "Monosodium glutamate (MSG)",
    ],
    limitFoods: [
      "Added salt — restrict cooking and table salt",
      "Processed and preserved foods (all contain high sodium)",
      "Refined carbohydrates (raise insulin, worsen metabolic syndrome)",
    ],
    includeFoods: [
      "Fresh vegetables (400g/day) — rich in potassium which helps excrete sodium",
      "Fruits (100g/day) — potassium-rich, lower Na:K ratio",
      "Beans, lentils (legumes) — good sources of potassium",
      "Banana — named as potassium-rich in DGI_2024",
      "Dry fruits (potassium source)",
      "Coconut water (potassium source)",
      "Nuts and flesh foods (additional potassium sources)",
      "Iodized salt (use in place of non-iodized, same quantity limit)",
    ],
    quantitativeLimits: [
      "Maximum salt: 5g (1 teaspoon) per day — DGI_2024 Guideline 11 Page 76",
      "Equivalent sodium: 2300mg/day (WHO/ICMR) — DGI_2024 Page 73–74",
      "Potassium target: 3800mg/day (to balance sodium) — DGI_2024 Page 73–74",
      "Vegetable intake for potassium target: 400g/day — DGI_2024 Page 73–74",
      "Fruit intake for potassium target: 100g/day — DGI_2024 Page 73–74",
      "Low-risk hypertension population: <3g salt/day — DGI_2024 Page 74",
      "NIN_2011: >8g/day considered a risk factor for hypertension — NIN_2011 Page 2480",
    ],
    preparationRules: [
      "Develop a taste for low-salt food from early age — DGI_2024 Page 76",
      "Use iodized salt within the 5g limit",
      "Cook without adding extra table salt where possible",
    ],
    sourceGuideline: "Guideline 11, DGI_2024, Pages 73–76; NIN_2011 Guideline 10 Pages 2455–2480",
  },

  // ─── 6c. Anaemia / Iron Deficiency ─────────────────────────────────────────
  anaemia: {
    avoidFoods: [
      "Tea before meals, during meals, or immediately after meals (tannins bind iron — DGI_2024 Page 18)",
      "Tea while taking IFA supplements (DGI_2024 Page 18)",
    ],
    limitFoods: [
      "Milk as a meal (poor iron source; does not block iron but displaces iron-rich foods — DGI_2024 Page 14)",
    ],
    includeFoods: [
      "Guava (vitamin C — enhances iron absorption from plant foods)",
      "Pineapple (vitamin C)",
      "Citrus fruits: lemon, orange (vitamin C)",
      "Green leafy vegetables (GLVs) — contain iron",
      "Pulses — contain iron",
      "Dry fruits — contain iron (DGI_2024 Page 18)",
      "Beans (iron source, DGI_2024 Page 14)",
      "Meat, fish, poultry (haem iron — highest bioavailability)",
      "Eggs (iron source, DGI_2024 Page 14)",
      "Fermented foods (fermentation improves iron bioavailability)",
      "Sprouted grains (sprouting reduces phytates, improves iron absorption)",
      "Folic acid-rich foods: green leafy vegetables, legumes, nuts, liver (DGI_2024 Page 18)",
    ],
    quantitativeLimits: [
      "IFA supplement during pregnancy: 60mg elemental iron + 0.5mg folic acid daily from 12th week through 6 months postpartum — DGI_2024 Page 18",
      "IFA supplement first trimester: 0.5mg (500µg) folic acid only during first 12 weeks — DGI_2024 Page 20",
      "NIN_2011 pregnancy iron supplement (CONFLICT): 100mg elemental iron + 0.5mg folic acid for 100 days from 16th week — NIN_2011 Page 1125. DGI_2024 value used per conflict policy.",
      "Commonly consumed plant-based diets provide ~18mg iron/day vs RDA of 35mg/day for pregnant women — NIN_2011 Page 1125",
      "Iron RDA (adult woman): 21mg/day — NIN_2011 Annexure 3 Page 88",
      "Iron RDA (pregnant woman): 35mg/day — NIN_2011 Annexure 3 Page 88",
    ],
    preparationRules: [
      "Pair plant iron sources with vitamin C-rich foods at the same meal",
      "Use fermentation (idli, dosa, dhokla) and sprouting to improve iron bioavailability",
      "Do not drink tea within 1 meal period of iron-rich foods or IFA tablets",
    ],
    sourceGuideline: "Guideline 2 (Pregnancy/Lactation), DGI_2024 Pages 14–20; Table 1.5 Page 9; NIN_2011 Page 1125 and Annexure 3 Page 88",
  },

  // ─── 6d. Obesity / Overweight / Abdominal Obesity ──────────────────────────
  obesity: {
    avoidFoods: [
      "Highly refined grain products (biscuits, cakes, white bread, maida-based snacks)",
      "Ultra-processed foods (UPFs)",
      "High sugar / high fat / high salt (HFSS) foods",
      "Sugar-sweetened carbonated beverages, energy drinks, health drinks",
      "Fresh fruit juices (prefer whole fruits for fibre)",
      "Deep-fried snacks",
      "Anti-obesity drugs (document advises against rapid approaches) — DGI_2024 Page 64",
    ],
    limitFoods: [
      "Cooking oils — limit to 20–30g/day for sedentary adults at 2000 kcal — DGI_2024 Page 54",
      "Fatty cuts of meat",
      "Refined cereals (replace with whole grains)",
      "Foods made with partially hydrogenated fats (vanaspati)",
      "Sugar: restrict to <5% of energy/day — DGI_2024 Page 11",
    ],
    includeFoods: [
      "Whole grains (millets/nutricereals, whole wheat, minimally processed rice, oats, barley)",
      "Legumes (beans, lentils) — high fibre, high satiety",
      "Pulses, nuts, chia seeds, flax seeds — satiety, blood glucose stability",
      "Colourful vegetables (low calorie, high micronutrients, high fibre)",
      "Whole fruits (not juices)",
      "Lean meat, skinless poultry, fish",
      "Plain yogurt, nuts, cut vegetables as snacks",
      "Salads and sprouts from whole grains and vegetables",
      "Tender coconut water, buttermilk, fresh lemon juice (instead of sweetened beverages)",
    ],
    quantitativeLimits: [
      "BMI normal range (Indians): 18.5–23 kg/m² — DGI_2024 Page 62–63",
      "Overweight (Indians): BMI 23–27.5 kg/m² — DGI_2024 Page 63",
      "Obese (Indians): BMI >27.5 kg/m² — DGI_2024 Page 63",
      "Abdominal obesity: waist >90cm in men, >80cm in women (associated with chronic disease risk) — DGI_2024 Page 63",
      "Weight loss energy deficit: 500–750 kcal/day — DGI_2024 Page 65",
      "Maximum energy deficit: 40% of daily energy needs — DGI_2024 Page 65",
      "Minimum weight-reduction diet: 1000 kcal/day — DGI_2024 Page 64",
      "Safe weight loss rate: 0.5 kg per week — DGI_2024 Page 64",
      "Protein during weight loss diets: 15% of energy (higher end) to preserve muscle — DGI_2024 Page 65",
      "Visible fat (sedentary women): 20g/day; (sedentary men): 30g/day — DGI_2024 Page 54",
      "Visible fat (moderate men): up to 40g/day; (heavy men): up to 50g/day — DGI_2024 Page 54",
      "Visible fat (moderate women): up to 30g/day; (heavy women): up to 40g/day — DGI_2024 Page 54",
    ],
    preparationRules: [
      "Use grilling, baking, steaming, sautéing — avoid deep frying",
      "Practice portion control",
      "Read food labels for calories, saturated fat, added sugar, sodium",
      "Use at least 50% of cereals as whole grain in all meal preparations",
    ],
    sourceGuideline: "Guideline 9, DGI_2024 Pages 62–68; Guideline 7, DGI_2024 Pages 51–56",
  },

  // ─── 6e. High Cholesterol / Dyslipidaemia / High LDL ──────────────────────
  high_cholesterol: {
    avoidFoods: [
      "Partially hydrogenated vegetable oils (vanaspati) — contain trans fatty acids",
      "Trans fatty acids (TFAs) — 'harmful and should be avoided' — DGI_2024 Page 51",
      "Ready-to-eat fast foods, bakery foods, processed foods (may contain trans fats and saturated fats)",
      "Repeated use of cooking oils for frying (generates oxidized toxic compounds, raises CVD risk)",
      "Already used frying oil mixed with fresh oil for reuse — DGI_2024 Page 55",
    ],
    limitFoods: [
      "Ghee and butter (high saturated fat — 'limit to just 1–2 teaspoons/day or avoid if possible') — DGI_2024 Page 54",
      "Coconut oil and palm oil (high saturated fat)",
      "Fatty cuts of red meat, full-fat dairy",
      "High n-6 PUFA oils (moderate their use) — DGI_2024 Page 56",
      "Total visible fat: 27–30g/day at 2000 kcal, 20–50g range by activity — DGI_2024 Page 54",
    ],
    includeFoods: [
      "Foods rich in alpha-linolenic acid (ALA / n-3 PUFA): nuts and seeds, soyabeans, grains/millets, green leafy vegetables, fenugreek seeds — DGI_2024 Page 56",
      "Marine fish: salmon, mackerel, trout, tuna (~200g/week) — good sources of LC n-3 PUFAs — DGI_2024 Page 56",
      "Walnuts (2g foods to furnish 100mg n-3 PUFA) — DGI_2024 Table 7.1 Page 53",
      "Flaxseed / linseed (0.5g to furnish 100mg n-3 PUFA) — DGI_2024 Table 7.1 Page 53",
      "Tocotrienols from palm oil, lignans from sesame oil, oryzanol from rice bran oil — reduce blood cholesterol — DGI_2024 Page 53",
      "Physical activity — improves HDL and decreases LDL — DGI_2024 Page 53",
      "Dietary fibre: pulses, whole grains, vegetables — reduces cholesterol absorption — DGI_2024 Page 50",
    ],
    quantitativeLimits: [
      "n-6 PUFA minimum: 3% of energy/day = 6.6g for a 2000 kcal diet — DGI_2024 Page 54",
      "n-3 PUFA minimum: 0.6%–1.2% of energy/day = approx. 2.2g for a 2000 kcal diet — DGI_2024 Page 54",
      "Total fat: ≤30% of energy — DGI_2024 Pages 7, 11",
      "Added fat threshold (HFSS): <15% of energy from added fat — DGI_2024 Page 4760",
      "Marine fish recommended quantity: ~200g/week — DGI_2024 Page 56",
      "Ghee/butter limit: 1–2 teaspoons/day — DGI_2024 Page 54",
    ],
    preparationRules: [
      "Use sautéing, steaming, grilling, boiling instead of deep frying — DGI_2024 Page 51",
      "Do not reuse cooking oils used for frying — DGI_2024 Page 55",
      "Do not mix used oil with fresh oil — DGI_2024 Page 55",
      "Filter used frying oil and use only for curry preparation (not frying again) — DGI_2024 Page 55",
      "Consume oils from single-seed sources rather than blends (easier to verify fatty acid composition)",
    ],
    sourceGuideline: "Guideline 7 (Fats), DGI_2024 Pages 51–56; Guideline 1, DGI_2024 Page 4",
  },

  // ─── 6f. Kidney Disease / Renal Dysfunction ────────────────────────────────
  kidney_disease: {
    avoidFoods: [
      "High-protein supplement powders — DGI_2024 Page 59",
      "Very high protein diets (especially as supplements) — DGI_2024 Page 59",
    ],
    limitFoods: [
      "Protein intake (specific limit not stated in these documents; high protein warned against for those with existing renal disease)",
      "High-sodium foods (kidney disease impairs sodium balance — DGI_2024 Page 73–74 general sodium section)",
    ],
    includeFoods: [
      "Balanced diet with fruits and vegetables (helps buffer acid load from protein oxidation) — DGI_2024 Page 59",
      "High-quality protein foods in moderation (rather than supplements)",
    ],
    quantitativeLimits: [
      "Protein > 1.6g/kg/day does not add muscle building benefit and poses extra kidney burden — DGI_2024 Page 59 (Guideline 8)",
      "NOTE: DGI_2024 states 'kidney damage or worsening renal function with high protein intake may occur in those who already have some renal disease; therefore high protein diets should be taken with care in such persons' — DGI_2024 Page 59. No specific g/kg limit for CKD patients is given.",
    ],
    preparationRules: [
      "NOT_IN_SOURCE: No specific preparation rules for kidney disease given in either document.",
    ],
    sourceGuideline: "Guideline 8 (Protein), DGI_2024 Page 59. Only a cautionary warning is given; detailed CKD dietary protocols are not in scope of these documents.",
  },

  // ─── 6g. PCOS / Polycystic Ovary Syndrome ──────────────────────────────────
  pcos: {
    avoidFoods: [],
    limitFoods: [],
    includeFoods: [],
    quantitativeLimits: [],
    preparationRules: [],
    sourceGuideline: "NOT_IN_SOURCE: PCOS is briefly mentioned in DGI_2024 Page 2329 as a metabolic disorder associated with overweight/obesity in children and adolescents ('resistance, diabetes, PCODs etc.') but no dietary guidelines are provided for PCOS specifically. NIN_2011 does not mention PCOS. Apply obesity and insulin-resistance guidelines (6a, 6d) as the closest applicable rules.",
  },

  // ─── 6h. Hypothyroidism / Thyroid Conditions ───────────────────────────────
  hypothyroidism: {
    avoidFoods: [],
    limitFoods: [],
    includeFoods: [
      "Iodized salt — recommended universally for iodine adequacy — DGI_2024 (mentioned throughout)",
    ],
    quantitativeLimits: [],
    preparationRules: [],
    sourceGuideline: "NOT_IN_SOURCE: Hypothyroidism is not addressed as a dietary condition in DGI_2024. NIN_2011 Pages 448–449 mentions iodine deficiency causing goitre and neonatal hypothyroidism, and recommends iodized salt for IDD-endemic areas — but provides no dietary management rules for existing hypothyroidism. Only iodized salt recommendation applies.",
  },

  // ─── 6i. Children Under 2 Years ────────────────────────────────────────────
  children_under_2: {
    avoidFoods: [
      "Added sugar — completely avoided for all children <2 years — DGI_2024 Table 1.6 footnote Page 11, Table 1.2a, Annexure V",
      "Sugar-sweetened beverages — DGI_2024 Page 27",
      "Fresh fruit juices — DGI_2024 Page 27 (prefer pureed whole fruit)",
      "Foods high in fat, salt, sugar (HFSS): biscuits, chips — DGI_2024 Page 28",
      "Salt — avoid in complementary food preparations — DGI_2024 Page 26",
      "Honey, glucose, water or dilute milk as breastfeed replacement — DGI_2024 Page 27",
      "Bulky foods for children below 5 years (foods should be nutrient-dense, not bulky) — DGI_2024 Page 38",
    ],
    limitFoods: [
      "Salt: limit use in complementary food (DGI_2024 Page 26 — 'salt need not be added')",
    ],
    includeFoods: [
      "Exclusive breastfeeding for the first 6 months — DGI_2024 Page 26",
      "Complementary foods from 6 months onward alongside continued breastfeeding up to at least 2 years",
      "Cereals/millets as base of complementary food (rice, dal gruel as first foods from 6 months)",
      "Pulses (lentils, chickpea, kidney beans, cowpea, black gram) from 6 months — DGI_2024 Page 27",
      "Flesh foods and whole eggs from 8 months onward — DGI_2024 Page 27",
      "Green leafy vegetables — cooked and mashed — DGI_2024 Page 27",
      "Non-leafy vegetables and fruits (thoroughly cooked and mashed)",
      "Oil/ghee, nuts, oilseeds — to increase energy density — DGI_2024 Page 27",
      "Well-cooked and mashed lobia / kidney beans / chickpea from ~8 months — DGI_2024 Pages 28, 33",
      "Minimum 5 food groups daily: cereals/millets; pulses/egg/meat; nuts and oilseeds; breast milk/dairy; vegetables/GLVs and fruits — DGI_2024 Page 28",
    ],
    quantitativeLimits: [
      "Total energy 6–12 months: 650–720 kcal/day (total, including breast milk) — DGI_2024 Page 26",
      "Total protein 6–12 months: 9–10.5g/day — DGI_2024 Page 26",
      "Breast milk provides: ~500 kcal and 5g protein/day from 6 months onward — DGI_2024 Page 26",
      "Complementary food must supply: ~150–220 kcal/day at 6–8 months; ~385 kcal/day at 9–12 months — DGI_2024 Page 22",
      "Meal frequency (breastfed, 6–8 months): at least 2 complementary feeds per day — DGI_2024 Page 28",
      "Meal frequency (breastfed, 9–24 months): at least 3 complementary feeds per day — DGI_2024 Page 28",
      "Meal frequency (non-breastfed, 6–24 months): at least 4 feeds per day plus milk — DGI_2024 Page 28",
      "Added sugar: zero — DGI_2024",
    ],
    preparationRules: [
      "Start with thin-but-not-watery porridge (dal gruel) from 6 months, gradually thicken to slurry/mashed consistency",
      "Introduce one new food at a time for 4–5 consecutive days (to detect intolerance/allergy)",
      "Food consistency: semisolid (spreads on plate/thali, not flows like liquid) — DGI_2024 Page 27",
      "At ~1 year: introduce family diet",
      "Thoroughly cook and mash all vegetables, fruits, meats for infants",
      "Do not add salt or sugar to complementary foods — DGI_2024 Page 26",
    ],
    sourceGuideline: "Guideline 3 (Complementary Feeding) and Guideline 4 (Infant Feeding), DGI_2024 Pages 22–35; Annexure V Page 129",
  },

  // ─── 6j. Pregnant Women ────────────────────────────────────────────────────
  pregnant_women: {
    avoidFoods: [
      "Highly processed and HFSS foods (high fat, sugar, salt) — DGI_2024 Page 14",
      "Alcohol and tobacco in any form — DGI_2024 POINTS TO REGISTER Page 20",
      "Unprescribed medicines — DGI_2024 Page 20",
    ],
    limitFoods: [
      "Visible fat — restrict (use oilseeds, nuts, beans and fish to meet EFA needs instead) — DGI_2024 Page 54",
      "Trans fatty acids — avoid — DGI_2024 Page 54",
      "Added sugar — <5% of energy — DGI_2024",
    ],
    includeFoods: [
      "Wide variety of pulses, nuts, fish, milk, eggs — protein, minerals, vitamins, EAA — DGI_2024 Page 20",
      "Cereals and millets (45% of total energy) — DGI_2024 Page 14",
      "Pulses (cereal:pulse ratio 3:1) — DGI_2024 Page 14",
      "Green leafy vegetables (150g/day in pregnant women's diet table) — DGI_2024 Table 1.6 Page 10",
      "Fruits (150g/day) — DGI_2024 Table 1.6 Page 10",
      "Milk / curd (400ml/day) — calcium and protein — DGI_2024 Table 1.6 Page 10",
      "Beans, dry fruits, eggs, flesh foods (iron sources) — DGI_2024 Page 14",
      "Vitamin C fruits (guava, pineapple, citrus) with iron-rich meals",
      "Fatty fish (LCn-3PUFA: DHA/EPA for fetal brain development) — DGI_2024 Page 14",
      "Green leafy vegetables, walnuts, flaxseeds (ALA / plant n-3 PUFA) — DGI_2024 Page 14",
      "Folate-rich foods: GLVs, legumes, nuts, liver — DGI_2024 Page 18",
      "Iodized salt — DGI_2024 Page 14",
      "Vitamin A–rich foods — DGI_2024 Page 14",
      "Vitamin B12 and vitamin C foods — DGI_2024 Page 14",
    ],
    quantitativeLimits: [
      "Additional calories: +350 kcal/day from 2nd to 3rd trimester above baseline sedentary woman — DGI_2024 Page 14",
      "Additional protein: +8g/day during 2nd trimester — DGI_2024 Page 14",
      "Additional protein: +18g/day during 3rd trimester — DGI_2024 Page 14",
      "NIN_2011 (CONFLICT): +350 kcal, +23g protein flat for pregnancy — DGI_2024 trimester split used",
      "Iron-Folic Acid supplement: 60mg elemental iron + 0.5mg folic acid from week 12 through 6 months postpartum — DGI_2024 Page 18",
      "Folic acid only (first 12 weeks): 500µg (0.5mg) per day — DGI_2024 Page 20",
      "Calcium supplement: recommended (dosage not stated explicitly as a number; 1200mg RDA from NIN_2011 Page 88)",
      "Minimum age at first pregnancy: 21 years — DGI_2024 Page 20",
      "BMI before pregnancy should be 18.5–23 — DGI_2024 Page 19",
      "Weight gain target during pregnancy: not stated as a single number; 'not more than 5–9 kg' mentioned in the pregnancy section — DGI_2024 Page 17",
      "Salt intake should not be restricted even to prevent pregnancy-induced hypertension — NIN_2011 Page 1041",
    ],
    preparationRules: [
      "Ensure diverse, varied, frequent feeding",
      "Cook with iodized salt",
      "Avoid HFSS foods and processed foods",
    ],
    sourceGuideline: "Guideline 2, DGI_2024 Pages 13–20; Table 1.6 Page 10; NIN_2011 Annexure 3 Page 88",
  },

  // ─── 6k. Lactating Women ────────────────────────────────────────────────────
  lactating_women: {
    avoidFoods: [
      "Highly processed and HFSS foods — DGI_2024 Page 14",
      "Alcohol and tobacco — DGI_2024 Page 20",
    ],
    limitFoods: [
      "Visible fat — restrict (encourage oilseeds, nuts, beans, fish for EFA instead) — DGI_2024 Page 54",
    ],
    includeFoods: [
      "All food groups as in pregnancy — continued diverse diet",
      "GLVs (150g/day) — DGI_2024 Table 1.6 Page 10",
      "Fruits (150g/day) — DGI_2024 Table 1.6 Page 10",
      "Milk / curd (400ml/day) — DGI_2024 Table 1.6 Page 10",
      "Oilseeds, nuts, beans and fish (for EFA — DHA/EPA and ALA) — DGI_2024 Page 54",
      "Iron and folic acid supplement (continued from pregnancy) — DGI_2024 Page 20",
    ],
    quantitativeLimits: [
      "Additional calories (0–6 months): +600 kcal/day above own baseline — DGI_2024 Page 14",
      "Additional protein (0–6 months): +13.6g/day — DGI_2024 Page 14",
      "Additional calories (7–12 months): +520 kcal/day above own baseline — DGI_2024 Page 14",
      "Additional protein (7–12 months): +10.6g/day — DGI_2024 Page 14",
      "NIN_2011 (CONFLICT on additional protein 0–6mo): +19g — DGI_2024 value (13.6g) used",
      "NIN_2011 (CONFLICT on additional protein 7–12mo): +13g — DGI_2024 value (10.6g) used",
      "IFA tablet: 1 per day for anaemia prevention — DGI_2024 Page 20",
      "Calcium supplement: continue from pregnancy — DGI_2024 Page 20",
    ],
    preparationRules: [
      "NOT_IN_SOURCE: No specific preparation rules beyond maintaining the same practices as pregnancy.",
    ],
    sourceGuideline: "Guideline 2, DGI_2024 Pages 13–20; Table 1.6 Page 10",
  },

  // ─── 6l. Elderly (60+ years) ───────────────────────────────────────────────
  elderly_60_plus: {
    avoidFoods: [
      "Highly ultra-processed and HFSS foods — DGI_2024 Page 101",
    ],
    limitFoods: [
      "Salt: moderate, with less salt than younger adults — DGI_2024 Page 101",
      "Spices: moderate amounts — DGI_2024 Page 101",
    ],
    includeFoods: [
      "Proteins (good quality): pulses, legumes, milk, fish, minced meat or egg — DGI_2024 Page 101",
      "Calcium-rich foods: milk, curd (400ml/day per Table 16.1/16.2)",
      "Micronutrient-rich foods: vegetables, fruits, beans, nuts, eggs, fish — DGI_2024 Page 101",
      "At least one-third of cereals as whole grains — DGI_2024 Page 101",
      "200–400ml low-fat milk or milk products daily — DGI_2024 Page 101",
      "A fistful of nuts and oilseeds (30g in Tables 16.1/16.2) — DGI_2024 Page 101",
      "400–500g of vegetables including leafy vegetables and fruits — DGI_2024 Page 101",
      "Water: 2 litres/day (to avoid dehydration and constipation) — DGI_2024 Page 101",
    ],
    quantitativeLimits: [
      "Calories (elderly man, >60 yrs, body wt ~65 kg): ~1710 kcal/day — DGI_2024 Table 16.1 Page 101",
      "Calories (elderly woman, >60 yrs, body wt ~55 kg): ~1500 kcal/day — DGI_2024 Table 16.2 Page 102",
      "Protein (elderly man): ~62g/day (crude protein) — DGI_2024 Table 16.1 Page 101",
      "Protein (elderly woman): ~56g/day (crude protein) — DGI_2024 Table 16.2 Page 102",
      "Calcium (both): ~844mg/day (from suggested balanced diet) — DGI_2024 Tables 16.1 & 16.2",
      "Iron: ~22.1mg/day — DGI_2024 Tables 16.1 & 16.2",
      "Zinc: ~10.2mg/day — DGI_2024 Tables 16.1 & 16.2",
      "Magnesium: ~653mg/day — DGI_2024 Tables 16.1 & 16.2",
      "Vitamin C: ~220mg/day — DGI_2024 Tables 16.1 & 16.2",
      "Total folates: ~445µg/day — DGI_2024 Tables 16.1 & 16.2",
      "Vitamin B12: ~1.5µg/day — DGI_2024 Tables 16.1 & 16.2",
      "Cereals (man): 180g/day; (woman): 140g/day — Tables 16.1 & 16.2",
      "Pulses (man): 80g/day; (woman): 70g/day — Tables 16.1 & 16.2",
      "GLV (both): 100g/day — Tables 16.1 & 16.2",
      "Other vegetables (both): 200g/day; Roots & tubers: 100g/day (excluding potatoes) — Tables 16.1 & 16.2",
      "Fruits (both): 150g/day — Tables 16.1 & 16.2",
      "Fats & oils (man): 20g/day; (woman): 15g/day — Tables 16.1 & 16.2",
      "Oilseeds & nuts (both): 30g/day — Tables 16.1 & 16.2",
    ],
    preparationRules: [
      "Prepare well-cooked, soft food preparations — easier to chew and digest — DGI_2024 Page 101",
      "Use less salt — DGI_2024 Page 101",
      "Use moderate amounts of spices — DGI_2024 Page 101",
    ],
    sourceGuideline: "Guideline 16, DGI_2024 Pages 100–102; Tables 16.1 & 16.2 Pages 101–102",
  },

  // ─── 6m. Adolescents (13–18 years) ─────────────────────────────────────────
  adolescents_13_to_18: {
    avoidFoods: [
      "Foods high in fat, salt, sugar (HFSS) and ultra-processed foods — DGI_2024 Page 45",
      "Indiscriminate dieting (under-eating for weight control) — DGI_2024 Page 45",
      "Overeating — DGI_2024 Page 45",
    ],
    limitFoods: [
      "Salt — adopt taste for low-salt from early age — DGI_2024 general",
      "Added sugar — <5% of energy — DGI_2024",
    ],
    includeFoods: [
      "Pulses, nuts, oilseeds — protein, iron, micronutrients — DGI_2024 Page 45",
      "Vegetables and seasonal fruits — DGI_2024 Page 45",
      "Eggs and flesh foods — DGI_2024 Page 45",
      "Adequate milk or curd or yogurt — for calcium — DGI_2024 Page 45",
      "Calcium-rich foods: foxtail millet, finger millet (ragi), sesame — DGI_2024 Page 38",
      "Iron-rich foods for girls (high physiological stress from menstruation): GLVs, pulses, dry fruits, eggs, flesh foods",
      "Fibre-rich foods: whole grains, millets, pulses, nuts, vegetables — DGI_2024 Page 45",
      "Physical activity and sports — DGI_2024 Page 45",
    ],
    quantitativeLimits: [
      "Calcium RDA for adolescents: 850–1050mg/day — DGI_2024 Page 38 (from NIN_2011 Annexure 3: 800mg/day for 10–17 yrs)",
      "Higher calcium than RDA desirable to achieve optimal peak bone mass — DGI_2024 Page 38",
      "Iron RDA (Boys 13–15 yrs): 32mg/day — NIN_2011 Annexure 3 Page 88",
      "Iron RDA (Girls 13–15 yrs): 27mg/day — NIN_2011 Annexure 3 Page 88",
      "Iron RDA (Boys 16–17 yrs): 28mg/day — NIN_2011 Annexure 3 Page 88",
      "Iron RDA (Girls 16–17 yrs): 26mg/day — NIN_2011 Annexure 3 Page 88",
      "Energy (Boys 13–15 yrs): ~2860 kcal/day; Protein: ~95g/day — DGI_2024 Table 1.6 Page 10",
      "Energy (Girls 13–15 yrs): ~2410 kcal/day; Protein: ~81g/day — DGI_2024 Table 1.6 Page 10",
      "Energy (Boys 16–18 yrs): ~3300 kcal/day; Protein: ~107g/day — DGI_2024 Table 1.6 Page 10",
      "Energy (Girls 16–18 yrs): ~2490 kcal/day; Protein: ~85g/day — DGI_2024 Table 1.6 Page 10",
      "Annual peak height gain in adolescence: 9–10 cm; weight gain: 8–10 kg/year — DGI_2024 Page 37",
    ],
    preparationRules: [
      "NOT_IN_SOURCE: No specific preparation rules for adolescents beyond general Guideline 1 principles.",
    ],
    sourceGuideline: "Guideline 5 (Children and Adolescents), DGI_2024 Pages 37–45; NIN_2011 Annexure 3 Page 88",
  },

} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 7 — PHYSICAL ACTIVITY LEVEL MULTIPLIERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Physical Activity Level (PAL) / activity multiplier values.
 *
 * SOURCE NOTE: Neither DGI_2024 nor NIN_2011 publishes a standalone table of
 * PAL multiplier numbers (e.g., 1.4, 1.75, 2.0) in the way international
 * nutrition textbooks do. Instead, both documents define energy requirements
 * by deriving absolute kcal values for each activity level, with calorie
 * differences implicitly encoding PAL.
 *
 * Derived PAL values below are CALCULATED from data in the documents:
 *   PAL = Kcal(activity level) ÷ Kcal(sedentary)
 *   Using adult man: sedentary 2320 kcal, moderate 2730 kcal, heavy 3490 kcal
 *   (NIN_2011 Annexure 3, Page 88 — these are the only three activity levels
 *   explicitly labelled sedentary/moderate/heavy with calorie values)
 *
 * DGI_2024 Table 1.6 gives only sedentary and moderate rows for adults (with
 * different reference body weights) and does not publish PAL multipliers.
 *
 * DGI_2024 also describes visible fat limits by activity level (Page 54)
 * confirming three activity bands for adults.
 *
 * PAL values below are DERIVED (not directly stated) — flagged accordingly.
 */
export const ICMR_ACTIVITY_MULTIPLIERS = {

  // Derived from NIN_2011 Annexure 3 adult man data (60 kg reference body weight)
  sedentary: {
    palValue: 1.0,  // baseline — all other levels are relative to this
    absoluteKcalAdultMan60kg: 2320,    // NIN_2011 Annexure 3 Page 88
    absoluteKcalAdultWoman55kg: 1900,  // NIN_2011 Annexure 3 Page 88
    visibleFatLimitMen_g: 25,          // NIN_2011 Annexure 3 Page 88
    visibleFatLimitWomen_g: 20,        // NIN_2011 Annexure 3 Page 88
    dgi2024KcalAdultMan65kg: 2080,     // DGI_2024 Table 1.6 Page 10
    dgi2024KcalAdultWoman55kg: 1660,   // DGI_2024 Table 1.6 Page 10
    notes: "PAL value 1.0 is baseline. Absolute kcal values from NIN_2011 and DGI_2024 differ due to different reference body weights (60 kg vs 65 kg for men).",
  },

  moderateWork: {
    palDerived: 1.18,
    // Derived: 2730 ÷ 2320 = 1.18 (NIN_2011 man at 60 kg)
    // NOTE: Standard WHO PAL for moderate work is ~1.75; the NIN_2011 ratio
    // of 1.18 may reflect that NIN_2011 'moderate' describes a different
    // activity band or uses BMR-adjusted calculation. Neither document states
    // PAL as a decimal multiplier — this is a derived approximation only.
    absoluteKcalAdultMan60kg: 2730,    // NIN_2011 Annexure 3 Page 88
    absoluteKcalAdultWoman55kg: 2230,  // NIN_2011 Annexure 3 Page 88
    visibleFatLimitMen_g: 30,          // NIN_2011 Annexure 3 Page 88
    visibleFatLimitWomen_g: 25,        // NIN_2011 Annexure 3 Page 88
    dgi2024KcalAdultMan65kg: 2680,     // DGI_2024 Table 1.6 Page 10
    dgi2024KcalAdultWoman55kg: 2125,   // DGI_2024 Table 1.6 Page 10
    notes: "Derived PAL = 2730 ÷ 2320 = 1.18 from NIN_2011 data. This ratio is NOT a stated PAL value. Visible fat limits from NIN_2011 Annexure 3; extended limits from DGI_2024 Page 54 (men up to 40g, women up to 30g for moderate activity).",
  },

  moderateWork_DGI2024_visibleFat: {
    // DGI_2024 Page 54 gives distinct visible fat allowances by activity
    visibleFatLimitMen_g: 40,
    visibleFatLimitWomen_g: 30,
    notes: "DGI_2024 Guideline 7 Page 54: 'Adult men with moderate physical activity may consume visible fat up to 40g.' Women: up to 30g. These are DGI_2024 values — higher than NIN_2011 values for the same activity level.",
  },

  heavyWork: {
    palDerived: 1.50,
    // Derived: 3490 ÷ 2320 = 1.50 (NIN_2011 man at 60 kg)
    absoluteKcalAdultMan60kg: 3490,    // NIN_2011 Annexure 3 Page 88
    absoluteKcalAdultWoman55kg: 2850,  // NIN_2011 Annexure 3 Page 88
    visibleFatLimitMen_g_nin2011: 40,  // NIN_2011 Annexure 3 Page 88
    visibleFatLimitWomen_g_nin2011: 30,// NIN_2011 Annexure 3 Page 88
    visibleFatLimitMen_g_dgi2024: 50,  // DGI_2024 Page 54
    visibleFatLimitWomen_g_dgi2024: 40,// DGI_2024 Page 54
    notes: "DGI_2024 Table 1.6 does not list a heavy-work row. Values from NIN_2011 Annexure 3. DGI_2024 Page 54 gives fat allowances for heavy activity.",
  },

  visibleFatFor2000KcalDiet: {
    recommended_g: 27,
    max_g: 30,
    notes: "'Not more than 27–30g visible fat/cooking oil is required for a 2000 kcal diet/day.' — DGI_2024 Guideline 7 Page 54",
  },

  calculationMethod: "Both documents give absolute kcal by age/gender/activity group — they do not publish a BMR × PAL formula. To calculate TDEE: use the absolute values from ICMR_CALORIE_TABLE (Part 1) for the appropriate age/gender/activity combination. For body weights differing from reference weights, scale proportionally using the Table 1.6 or Annexure V values for the nearest body weight bracket.",

  palNotStatedDirectly: true,
  // Confirmed: neither DGI_2024 nor NIN_2011 lists PAL as a decimal multiplier
  // (e.g., 1.4 for sedentary, 1.75 for moderate) anywhere in the extracted text.

  source: "NIN_2011 Annexure 3 Page 88 (absolute kcal by activity); DGI_2024 Table 1.6 Page 10–11 (kcal by activity); DGI_2024 Guideline 7 Page 54 (visible fat by activity)",

} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 8 — DAILY FOOD GROUP SERVINGS (MY PLATE / BALANCED DIET)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Recommended daily food group quantities for a 2000 kcal diet.
 *
 * PRIMARY SOURCE: Table 1.2a (vegetarian) and Table 1.2b (non-vegetarian),
 * DGI_2024, Page 7.
 * SECONDARY SOURCE: Annexure V, DGI_2024, Page 129 (body-weight specific;
 * the 55 kg woman moderate row closely matches 2000 kcal).
 *
 * All weights are RAW food weight in grams unless otherwise noted.
 * Milk/curd is in ml.
 */
export const ICMR_DAILY_FOOD_GROUPS_2000KCAL = {

  vegetarian: {
    // ── Raw food weights ──
    cerealsMilletsG: 250,        // Table 1.2a, DGI_2024 Page 7
    pulsesLegumesG: 85,          // Table 1.2a — "Pulses 85g"
    milkCurdMl: 300,             // Table 1.2a — "Milk/curd (ml) 300"
    vegetablesAndGLVG: 400,      // Table 1.2a — "Vegetables + GLV 400g"
    fruitsG: 100,                // Table 1.2a — "Fruits 100g"
    nutsSeedsG: 35,              // Table 1.2a — "Nuts & seeds 35g"
    fatsOilsG: 27,               // Table 1.2a — "Fats & oils 27g"
    sugarMaxGPerDay: 25,         // "restricted to 25–30 grams per day" Table 1.2a footnote
    totalRawFoodWeightG: 1200,   // Table 1.2a total row

    // ── Nutrient output ──
    totalEnergyKcal: 2000,       // target (approximate)
    totalProteinG: 72,           // ~15% energy from protein — Table 1.2a
    totalFatG: 66,               // ~30% energy from fat — Table 1.2a
    totalCarbsG: 275,            // ~55% energy from carbs — Table 1.2a

    // ── % energy by food group ──
    cerealEnergyPercent: 42,     // Table 1.2a
    pulseEnergyPercent: 14,
    milkCurdEnergyPercent: 11,
    vegetablesAndGLVEnergyPercent: 9,
    fruitsEnergyPercent: 3,
    nutsSeedsEnergyPercent: 9,
    fatsOilsEnergyPercent: 12,

    // ── Energy by food group (kcal) ──
    cerealEnergyKcal: 843,       // Table 1.2a approximate values
    pulseEnergyKcal: 274,
    milkCurdEnergyKcal: 216,
    vegetablesGLVEnergyKcal: 174,
    fruitsEnergyKcal: 56,
    nutsSeedsEnergyKcal: 181,
    fatsOilsEnergyKcal: 243,

    notes: [
      "Quantities are for raw food weight",
      "20%–30% of cereals (raw weight) should be millets for adults (DGI_2024 Table 1.6 footnote)",
      "Vegetables (400g) excludes potato; may be consumed cooked or as salad",
      "Prefer fresh fruits — avoid juices",
      "Sugar: restrict to 25–30g/day; to adjust total calories, reduce cereals if sugar is taken",
      "30g of pulses may be substituted with meat/fish/eggs for non-vegetarians (Table 1.6 footnote)",
    ],
    source: "Table 1.2a, DGI_2024, Page 7",
  },

  nonVegetarian: {
    // ── Raw food weights ──
    cerealsMilletsG: 260,        // Table 1.2b — slightly more cereal than vegetarian
    pulsesLegumeG: 55,           // Table 1.2b — reduced vs vegetarian (meat replaces some pulses)
    chickenMeatEggsG: 70,        // Table 1.2b — "Chicken/meat/eggs 70g"
    milkCurdMl: 300,             // Table 1.2b
    vegetablesAndGLVG: 400,      // Table 1.2b
    fruitsG: 100,                // Table 1.2b
    nutsSeedsG: 30,              // Table 1.2b — slightly less than vegetarian
    fatsOilsG: 27,               // Table 1.2b
    totalRawFoodWeightG: 1242,   // Table 1.2b total row

    pulseReductionForMeatG: 30,
    // 30g pulses may be substituted with meat/eggs per Table 1.6 and 1.2b footnotes
    // (85g – 55g = 30g reduction when meat is added)

    // ── Nutrient output ──
    totalEnergyKcal: 2000,
    totalProteinG: 79,           // 16% energy from protein — Table 1.2b (~79g)
    totalFatG: 67,               // 30% energy from fat — Table 1.2b

    // ── % energy by food group ──
    cerealEnergyPercent: 45,     // Table 1.2b
    pulseEnergyPercent: 9,
    chickenMeatEggsEnergyPercent: 5,
    milkCurdEnergyPercent: 11,
    vegetablesAndGLVEnergyPercent: 8,
    fruitsEnergyPercent: 3,
    nutsSeedsEnergyPercent: 11,
    fatsOilsEnergyPercent: 12,

    notes: [
      "Non-vegetarian plate has 260g cereals vs 250g vegetarian (more carbs to offset lower pulse energy)",
      "Pulses reduced to 55g from 85g; 30g replaced by 70g chicken/meat/eggs",
      "Substitution: 30g pulses = 70–80g meat/fish/egg approximately (DGI_2024 Page 59)",
      "Same vegetable, fruit and fat quantities as vegetarian plate",
      "Slightly fewer nuts (30g vs 35g)",
    ],
    source: "Table 1.2b, DGI_2024, Page 7",
  },

  source: "Tables 1.2a and 1.2b (My Plate for the Day), DGI_2024, Page 7",

} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 9 — PROTEIN RULES FOR SPECIFIC GOALS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Protein-related quantitative rules extracted from DGI_2024 Guideline 8.
 * Source: Guideline 8, DGI_2024, Pages 57–60.
 * Cross-reference: NIN_2011 Annexure 3 Page 88 for absolute g/day values.
 */
export const ICMR_PROTEIN_RULES = {

  // ─ EAR and RDA (from Guideline 8, DGI_2024 Page 57) ──────────────────────
  earGPerKgPerDay: 0.66,
  // "The estimated average requirement (EAR) for protein intake is
  //  0.66g of protein per kg/day for healthy men and women." — DGI_2024 Page 57

  rdaGPerKgPerDay: 0.83,
  // "The recommended dietary allowance (RDA) for protein intake is
  //  0.83g protein/kg/day for healthy men and women." — DGI_2024 Page 57

  ear65kgPersonG: 43,
  // "EAR of 43g protein/day … for a person weighing 65kg" — DGI_2024 Page 57

  rda65kgPersonG: 54,
  // "RDA of 54g/day for a person weighing 65kg" — DGI_2024 Page 57

  normalAdultGPerKgPerDay: 0.83,
  // Using RDA as the normal adult target (same as rdaGPerKgPerDay above)

  // ─ Resistance training / muscle building ──────────────────────────────────
  resistanceTrainingMaxBenefitGPerKgPerDay: 1.6,
  // "protein intake levels greater than ~1.6g/kg/day do not contribute any
  //  further to RET-induced gains in muscle mass." — DGI_2024 Page 59

  proteinSupplementsBuildsMoreMuscle: false,
  // "Taking protein supplements on top of normal meal (balanced diet) intake is
  //  not going to build more muscle." — DGI_2024 Page 59
  // "research findings indicate that dietary protein supplementation is
  //  associated with only a small increase in muscle strength and size during
  //  prolonged resistance exercise training (RET) in healthy adults" — DGI_2024 Page 59

  // ─ Weight loss / muscle preservation ─────────────────────────────────────
  weightLossProteinPercentEnergy: 15,
  // "consuming higher amounts of protein (15% energy from protein) may be
  //  important during typical energy-deficient weight loss diets
  //  (i.e., 500–750 Kcal/day deficit) to preserve muscle mass." — DGI_2024 Page 65

  maxEnergyDeficitPercentForMusclePreservation: 40,
  // "the protective effect of higher-protein diets on muscle mass is compromised
  //  if the energy deficit is more than 40% of daily energy needs" — DGI_2024 Page 65

  // ─ Kidney disease warning ─────────────────────────────────────────────────
  kidneyDiseaseWarning: "Kidney damage, or worsening renal function with high protein intake, may occur in those who already have some renal disease; therefore high protein diets should be taken with care in such persons. — DGI_2024, Guideline 8, Page 59",

  // ─ Protein energy ratio ───────────────────────────────────────────────────
  proteinEnergyRatioPercentMin: 10,
  proteinEnergyRatioPercentMax: 15,
  // "The protein energy (P:E) ratio should be ideally 10% to 15%; that is,
  //  10% to 15% energy should be from proteins in our daily diet." — DGI_2024 Page 57

  // ─ Cereal:pulse combination for complete protein ──────────────────────────
  cerealPulseRatioForCompleteProtein: ["3:1"],
  // "appropriate combination of cereals with pulses in the ratio of 3:1
  //  (raw food weight) can meet the requirements of all EAA including other
  //  amino acids." — DGI_2024 Page 57–58

  cerealPulseRatioAlternate: ["5:1"],
  // "plan balanced meals … include legumes like beans and lentils in the
  //  recommended cereal pulse ratio (3:1 or 5:1)" — DGI_2024 Page 65

  milkAdditionBenefit: "Addition of 250ml milk in our daily diet can further enhance the intake of EAA and meet the requirements of all the EAA. — DGI_2024 Page 58",

  // ─ Meat substitution rule ────────────────────────────────────────────────
  meatSubstitutionRule: {
    pulsesToReplaceG: 30,
    meatEquivalentG: 80,
    description: "Substituting 30g of recommended level of pulses with 80g meat per day would improve quality of protein to fulfil the needs of a normal person. — DGI_2024 Page 59. Also: for non-vegetarians, 30g of pulses may be substituted with meat or eggs (Table 1.6 footnote, DGI_2024 Page 11).",
  },

  // ─ Non-vegetarian protein quantity ────────────────────────────────────────
  fleshFoodsRecommendedWeeklyG_min: 700,
  fleshFoodsRecommendedWeeklyG_max: 900,
  // "Non-vegetarians can easily source their high-quality protein from
  //  recommended level (700g to 900g/week of fish, poultry or lean meat)
  //  of flesh food or egg consumption." — DGI_2024 Page 58

  // ─ Protein quality note ──────────────────────────────────────────────────
  proteinQualityNote: "Animal source proteins (meat, poultry, fish, egg, milk) contain all twenty amino acids including all nine EAA and are of higher biological value. Plant proteins are not of the same quality due to lower content of some EAA. However, a combination of cereals + pulses in 3:1 ratio (or with dairy) supplies all EAA and is of sufficient quality. Most vegetarian foods have protein digestibility of 70%–85%; a balanced vegan diet for a moderately active man provides >80g crude protein/day, equivalent to ~60g of quality protein meeting all EAA requirements. — DGI_2024 Pages 57–60",

  // ─ Limiting amino acids in plant foods (Table 8.1, DGI_2024 Page 57) ─────
  limitingAminoAcidsInPlantFoods: [
    {
      foodGroup: "Grains (cereals, millets)",
      limitingEAA: ["Lysine", "Threonine", "Tryptophan"],
      complementWith: "Pulses, chickpea and beans (rich in lysine, threonine and tryptophan)",
    },
    {
      foodGroup: "Pulses",
      limitingEAA: ["Methionine"],
      complementWith: "Cereals, millets, nuts and seeds (rich in methionine)",
    },
    {
      foodGroup: "Nuts/seeds",
      limitingEAA: ["Lysine"],
      complementWith: "Pulses, chickpea, beans (kidney beans, cowpeas)",
    },
  ],
  // Source: Table 8.1, DGI_2024 Page 57

  source: "Guideline 8, DGI_2024 Pages 57–60; NIN_2011 Annexure 3 Page 88",

} as const;


// ═══════════════════════════════════════════════════════════════════════
// EXTRACTION NOTES — PART 2 (Sections 5–9)
// ═══════════════════════════════════════════════════════════════════════

export const EXTRACTION_NOTES_PART2 = {

  conflictsBetweenDocuments: [
    "SECTION 6c / Iron supplement during pregnancy: DGI_2024 recommends 60mg elemental iron + 0.5mg folic acid from week 12. NIN_2011 recommends 100mg elemental iron + 0.5mg folic acid for 100 days from week 16. DGI_2024 value used.",
    "SECTION 6k / Lactation additional protein 0–6 months: DGI_2024 +13.6g; NIN_2011 +19g. DGI_2024 used.",
    "SECTION 6k / Lactation additional protein 7–12 months: DGI_2024 +10.6g; NIN_2011 +13g. DGI_2024 used.",
    "SECTION 8 / Sugar upper limit: DGI_2024 Table 1.2a footnote states '25–30g/day'; DGI_2024 Guideline summary (Page 4) states '20–25g/day'. Both preserved with different field names.",
    "SECTION 7 / NIN_2011 sedentary adult man: 2320 kcal at 60 kg; DGI_2024 Table 1.6 gives 2080 kcal at 65 kg. Different reference body weights — not strictly conflicting values.",
    "SECTION 8 / Sugar limit in Table 1.2a footnote ('25–30g') vs Table 1.6 footnote ('less than 5% of energy') — 5% of 2000 kcal = 100 kcal from sugar = 25g. All three are consistent; 30g is the stated upper ceiling.",
  ],

  valuesNotFound: [
    "SECTION 5 / GI/GL values for individual spices, vegetables, fruits, dairy, meat — Annexure III covers only cereals, pulses and South Indian breakfast recipes.",
    "SECTION 5 / GI/GL for common Indian dishes not from South India (e.g., poha, upma, paratha, rajma, chole) — not in Annexure III.",
    "SECTION 5 / GI/GL for rice varieties (basmati, sona masoori, parboiled) separately — only 'Rice' as a category.",
    "SECTION 6g / PCOS dietary guidelines — not covered in either document.",
    "SECTION 6h / Hypothyroidism dietary guidelines — not covered beyond general iodized salt recommendation.",
    "SECTION 7 / Explicit PAL decimal multipliers (e.g., 1.4 sedentary, 1.75 moderate, 2.0 heavy) — neither document states these; only absolute kcal values are given.",
    "SECTION 7 / BMR formula — neither document gives a BMR calculation formula (e.g., Harris-Benedict, Mifflin).",
    "SECTION 9 / Protein target for athletes specifically — document gives the 1.6g/kg/day ceiling and notes that supplements provide only small additional gains; no specific sports-nutrition protocol is given.",
  ],

  ambiguousValues: [
    "SECTION 5 / GI table note: 'The GI and GL are only indicative. They may differ depending on the ratios of different ingredients and preparation methods.' — DGI_2024 Page 126. All GI/GL values should be treated as indicative, not precise.",
    "SECTION 5 / Two separate GI values for 'chapati': Table B lists 'Wheat chapatti' at GI 65.66 and 'Chapati' (as a recipe) at GI 62.43. These are stored as separate entries.",
    "SECTION 7 / Derived PAL values are calculated from document data, not stated in the documents. They should not be used as authoritative ICMR PAL values.",
    "SECTION 6j / Pregnancy weight gain: DGI_2024 Page 17 appears to state 'not more than 5–9 kg' but the surrounding text was unclear in the extraction. Verify against original PDF.",
    "SECTION 8 / 'Vegetables + GLV 400g' in Table 1.2a — the document does not sub-divide this into GLV vs other vegetables in the My Plate table. Table 1.6 gives GLV 100g and 'Vegetables' 200g as separate columns (totalling 300g, not 400g including roots). The 400g in Table 1.2a includes roots and tubers as well as GLVs.",
  ],

  tablesPartiallyExtracted: [
    "SECTION 5 / Annexure III is complete — all items from both Table A (glycemic carbs) and Table B (GI/GL) have been extracted. The table itself covers only 9 raw foods and 30 South Indian recipes; other Indian foods have no GI values in this document.",
    "SECTION 6 / Clinical conditions section is limited by what DGI_2024 and NIN_2011 explicitly state. Many quantitative clinical guidelines (e.g., CKD protein limits, diabetic kcal targets, DASH diet specifics) are not in these documents.",
  ],

} as const;
