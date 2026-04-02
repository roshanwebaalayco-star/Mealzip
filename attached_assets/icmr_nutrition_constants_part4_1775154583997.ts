/**
 * ICMR-NIN Nutritional Constants — Part 4 of 4 (Sections 13–14)
 * Sources:
 *   (1) Dietary Guidelines for Indians 2024, ICMR-NIN  [DGI_2024]
 *   (2) Dietary Guidelines for Indians — A Manual, NIN 2011  [NIN_2011]
 * Extraction date: 2026-04-02
 *
 * ═══════════════════════════════════════════════════════════════════════
 * CRITICAL NOTE ON SECTION 13 SCOPE
 * ═══════════════════════════════════════════════════════════════════════
 * DGI_2024 and NIN_2011 do NOT reproduce individual food composition
 * tables (e.g., rice 343 kcal, toor dal 335 kcal, spinach 26 kcal).
 * Both documents explicitly cite EXTERNAL sources for per-food values:
 *   - Indian Food Composition Tables 2017 (IFCT 2017), ICMR-NIN
 *   - Nutritive Values of Indian Foods (NVIF), NIN
 *   - Nutrient Requirements for Indians 2020 (NRI 2020), ICMR-NIN
 *
 * What IS available in these two documents:
 *   A. Food GROUP averages (Tables 1.3, 1.4, 1.5 — DGI_2024 Page 8–9)
 *      → Already extracted in Part 1 as part of context
 *   B. NIN_2011 Annexure 6  — Low-calorie vegetables & fruits (kcal/100g)
 *   C. NIN_2011 Annexure 7  — High-calorie vegetables & fruits (kcal/100g)
 *   D. NIN_2011 Annexure 8  — Cooked preparations (kcal per serving)
 *   E. NIN_2011 Annexure 9  — ALA / omega-3 content (g/100g)
 *   F. NIN_2011 Annexure 10 — GI of common foods (external source cited)
 *   G. NIN_2011 Annexure 1  — Nuts, salads, fruits (kcal per portion)
 *   H. NIN_2011 Annexure 15 — Nutrient-rich foods (qualitative ranges)
 *   I. NIN_2011 Annexure 2  — Portion sizes with Energy/Protein/Carb/Fat
 *   J. DGI_2024 Table 7.1   — Foods to furnish 100mg n-3 PUFA (grams)
 *   K. DGI_2024 Figures 4.5/4.6 — Complementary feeding recipes
 *      (energy, protein, iron, zinc per serving)
 *
 * The full per-food nutrition database the prompt requests must be sourced
 * from IFCT 2017 or NVIF directly. These Part 4 constants contain all
 * values that ARE in the two documents.
 */

// ═══════════════════════════════════════════════════════════════════════
// SECTION 13A — FOOD GROUP MACRONUTRIENT AVERAGES (per 100g raw)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Average macronutrient values per food group (per 100g raw weight).
 * Source: Table 1.3, DGI_2024, Page 8.
 * Source cited by DGI_2024: Indian Food Composition Tables 2017 &
 * Nutritive Values of Indian Foods.
 * See Annexure IV (DGI_2024 Pages 127–128) for the full list of
 * individual foods whose averages are used in each group.
 */
export const ICMR_FOOD_GROUP_MACROS_PER_100G: Record<string, {
  proteinG: number | null,
  fatG: number | null,
  carbsG: number | null,
  energyKcal: number | null,
  fibreG: number | null,
  source: string,
}> = {
  "cereals":        { proteinG: 9.3,  fatG: 1.2,  carbsG: 72, energyKcal: 343, fibreG: 6,  source: "Table 1.3, DGI_2024, Page 8" },
  "millets":        { proteinG: 9.9,  fatG: 2.7,  carbsG: 65, energyKcal: 330, fibreG: 7,  source: "Table 1.3, DGI_2024, Page 8" },
  "pulses":         { proteinG: 22.8, fatG: 3.0,  carbsG: 49, energyKcal: 323, fibreG: 12, source: "Table 1.3, DGI_2024, Page 8" },
  "GLVs":           { proteinG: 3.8,  fatG: 0.7,  carbsG: 5,  energyKcal: 45,  fibreG: 2,  source: "Table 1.3, DGI_2024, Page 8" },
  "roots_tubers":   { proteinG: 1.5,  fatG: 0.2,  carbsG: 12, energyKcal: 59,  fibreG: 2,  source: "Table 1.3, DGI_2024, Page 8" },
  "vegetables":     { proteinG: 1.8,  fatG: 0.4,  carbsG: 5,  energyKcal: 35,  fibreG: 2,  source: "Table 1.3, DGI_2024, Page 8" },
  "nuts":           { proteinG: 17.5, fatG: 41.3, carbsG: 18, energyKcal: 516, fibreG: 9,  source: "Table 1.3, DGI_2024, Page 8" },
  "fruits":         { proteinG: 1.0,  fatG: 0.6,  carbsG: 11, energyKcal: 59,  fibreG: 2,  source: "Table 1.3, DGI_2024, Page 8" },
  "meat_poultry":   { proteinG: 20.8, fatG: 6.8,  carbsG: 0,  energyKcal: 250, fibreG: 0,  source: "Table 1.3, DGI_2024, Page 8" },
  "fish_seafoods":  { proteinG: 18.4, fatG: 3.1,  carbsG: 2,  energyKcal: 110, fibreG: 0,  source: "Table 1.3, DGI_2024, Page 8" },
  "milk":           { proteinG: 3.1,  fatG: 4.2,  carbsG: 5,  energyKcal: 72,  fibreG: 0,  source: "Table 1.3, DGI_2024, Page 8" },
  "egg":            { proteinG: 13.3, fatG: 10.0, carbsG: 1,  energyKcal: 147, fibreG: 0,  source: "Table 1.3, DGI_2024, Page 8" },
  "dry_spices":     { proteinG: 8.5,  fatG: 10.0, carbsG: 31, energyKcal: 240, fibreG: 17, source: "Table 1.3, DGI_2024, Page 8" },
  "milk_products":  { proteinG: 21.6, fatG: 18.6, carbsG: 16, energyKcal: 337, fibreG: 0,  source: "Table 1.3, DGI_2024, Page 8" },
  "dry_fish":       { proteinG: 55.5, fatG: 5.0,  carbsG: 1,  energyKcal: 271, fibreG: 0,  source: "Table 1.3, DGI_2024, Page 8" },
  "cooking_oil":    { proteinG: 0,    fatG: 100.0,carbsG: 0,  energyKcal: 900, fibreG: 0,  source: "Table 1.3, DGI_2024, Page 8" },
  "table_sugar":    { proteinG: 0,    fatG: 0,    carbsG: 100,energyKcal: 400, fibreG: 0,  source: "Table 1.3, DGI_2024, Page 8" },
} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 13B — FOOD GROUP VITAMIN AVERAGES (per 100g raw)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Average vitamin values per food group (per 100g raw weight).
 * Source: Table 1.4, DGI_2024, Page 9.
 * All values in µg unless noted. Vitamin C in mg.
 * # = Values for unfortified milk and oil.
 * * = Value given only for varieties of fish (prawns and crabs not included).
 */
export const ICMR_FOOD_GROUP_VITAMINS_PER_100G: Record<string, {
  thiamineB1_mcg: number | null,
  riboflavinB2_mcg: number | null,
  niacinB3_mcg: number | null,
  pyridoxineB6_mcg: number | null,
  totalFolateB9_mcg: number | null,
  vitaminC_mg: number | null,
  vitaminA_retinol_mcg: number | null,
  vitaminD2_ergo_mcg: number | null,
  vitaminD3_chole_mcg: number | null,
  notes: string | null,
  source: string,
}> = {
  "cereals":       { thiamineB1_mcg: 238.46, riboflavinB2_mcg: 84.6,  niacinB3_mcg: 2138.5, pyridoxineB6_mcg: 162.31, totalFolateB9_mcg: 15.86,  vitaminC_mg: 0,   vitaminA_retinol_mcg: 2.01,   vitaminD2_ergo_mcg: 6.88, vitaminD3_chole_mcg: 0,    notes: null, source: "Table 1.4, DGI_2024, Page 9" },
  "millets":       { thiamineB1_mcg: 355.56, riboflavinB2_mcg: 155.6, niacinB3_mcg: 2177.8, pyridoxineB6_mcg: 113.33, totalFolateB9_mcg: 24.17,  vitaminC_mg: 0,   vitaminA_retinol_mcg: 1.02,   vitaminD2_ergo_mcg: 6.10, vitaminD3_chole_mcg: 0,    notes: null, source: "Table 1.4, DGI_2024, Page 9" },
  "pulses":        { thiamineB1_mcg: 400.00, riboflavinB2_mcg: 158.8, niacinB3_mcg: 2123.5, pyridoxineB6_mcg: 215.53, totalFolateB9_mcg: 157.06, vitaminC_mg: 0,   vitaminA_retinol_mcg: 8.32,   vitaminD2_ergo_mcg: 8.69, vitaminD3_chole_mcg: 0,    notes: null, source: "Table 1.4, DGI_2024, Page 9" },
  "GLVs":          { thiamineB1_mcg: 60.00,  riboflavinB2_mcg: 127.7, niacinB3_mcg: 624.6,  pyridoxineB6_mcg: 97.49,  totalFolateB9_mcg: 31.60,  vitaminC_mg: 45.6,vitaminA_retinol_mcg: 397.90, vitaminD2_ergo_mcg: 3.40, vitaminD3_chole_mcg: 0,    notes: null, source: "Table 1.4, DGI_2024, Page 9" },
  "roots_tubers":  { thiamineB1_mcg: 31.58,  riboflavinB2_mcg: 10.5,  niacinB3_mcg: 405.3,  pyridoxineB6_mcg: 97.47,  totalFolateB9_mcg: 21.48,  vitaminC_mg: 12.1,vitaminA_retinol_mcg: 39.85,  vitaminD2_ergo_mcg: 0.55, vitaminD3_chole_mcg: 0,    notes: null, source: "Table 1.4, DGI_2024, Page 9" },
  "vegetables":    { thiamineB1_mcg: 41.30,  riboflavinB2_mcg: 43.5,  niacinB3_mcg: 365.2,  pyridoxineB6_mcg: 97.48,  totalFolateB9_mcg: 28.53,  vitaminC_mg: 23.6,vitaminA_retinol_mcg: 18.40,  vitaminD2_ergo_mcg: 2.38, vitaminD3_chole_mcg: 0,    notes: null, source: "Table 1.4, DGI_2024, Page 9" },
  "nuts":          { thiamineB1_mcg: 390.00, riboflavinB2_mcg: 140.0, niacinB3_mcg: 3210.0, pyridoxineB6_mcg: 311.40, totalFolateB9_mcg: 47.58,  vitaminC_mg: 0.4, vitaminA_retinol_mcg: 1.26,   vitaminD2_ergo_mcg: 9.06, vitaminD3_chole_mcg: 0,    notes: null, source: "Table 1.4, DGI_2024, Page 9" },
  "fruits":        { thiamineB1_mcg: 34.78,  riboflavinB2_mcg: 21.7,  niacinB3_mcg: 369.6,  pyridoxineB6_mcg: 65.04,  totalFolateB9_mcg: 11.41,  vitaminC_mg: 36.7,vitaminA_retinol_mcg: 35.48,  vitaminD2_ergo_mcg: 3.62, vitaminD3_chole_mcg: 0,    notes: null, source: "Table 1.4, DGI_2024, Page 9" },
  "meat_poultry":  { thiamineB1_mcg: 81.82,  riboflavinB2_mcg: 109.1, niacinB3_mcg: 2772.7, pyridoxineB6_mcg: 220.00, totalFolateB9_mcg: 5.59,   vitaminC_mg: 0,   vitaminA_retinol_mcg: 1.93,   vitaminD2_ergo_mcg: 0,    vitaminD3_chole_mcg: 1.13, notes: null, source: "Table 1.4, DGI_2024, Page 9" },
  "fish_seafoods": { thiamineB1_mcg: 11.59,  riboflavinB2_mcg: 8.7,   niacinB3_mcg: 811.6,  pyridoxineB6_mcg: 0,      totalFolateB9_mcg: 0,      vitaminC_mg: 2.5, vitaminA_retinol_mcg: 438.98, vitaminD2_ergo_mcg: 1.99, vitaminD3_chole_mcg: 1.09, notes: "* D3 value for fish varieties only (prawns and crabs not included)", source: "Table 1.4, DGI_2024, Page 9" },
  "milk":          { thiamineB1_mcg: 80.00,  riboflavinB2_mcg: 80.0,  niacinB3_mcg: 140.0,  pyridoxineB6_mcg: 16.00,  totalFolateB9_mcg: 3.12,   vitaminC_mg: 3.3, vitaminA_retinol_mcg: 17.20,  vitaminD2_ergo_mcg: 0.57, vitaminD3_chole_mcg: 0,    notes: "# Values for unfortified milk", source: "Table 1.4, DGI_2024, Page 9" },
  "egg":           { thiamineB1_mcg: 100.00, riboflavinB2_mcg: 100.0, niacinB3_mcg: 66.7,   pyridoxineB6_mcg: 103.33, totalFolateB9_mcg: 41.60,  vitaminC_mg: 0,   vitaminA_retinol_mcg: 126.34, vitaminD2_ergo_mcg: 0,    vitaminD3_chole_mcg: 2.68, notes: null, source: "Table 1.4, DGI_2024, Page 9" },
  "dry_spices":    { thiamineB1_mcg: 216.67, riboflavinB2_mcg: 112.5, niacinB3_mcg: 1066.7, pyridoxineB6_mcg: 213.75, totalFolateB9_mcg: 28.34,  vitaminC_mg: 4.9, vitaminA_retinol_mcg: 38.06,  vitaminD2_ergo_mcg: 19.43,vitaminD3_chole_mcg: 0,    notes: null, source: "Table 1.4, DGI_2024, Page 9" },
  "milk_products": { thiamineB1_mcg: 125.00, riboflavinB2_mcg: 387.5, niacinB3_mcg: 275.0,  pyridoxineB6_mcg: 7.50,   totalFolateB9_mcg: 11.79,  vitaminC_mg: 1.5, vitaminA_retinol_mcg: 76.50,  vitaminD2_ergo_mcg: 0.02, vitaminD3_chole_mcg: 0,    notes: null, source: "Table 1.4, DGI_2024, Page 9" },
  "dry_fish":      { thiamineB1_mcg: 5.88,   riboflavinB2_mcg: 0,     niacinB3_mcg: 164.7,  pyridoxineB6_mcg: 0,      totalFolateB9_mcg: 0,      vitaminC_mg: 0,   vitaminA_retinol_mcg: 0.87,   vitaminD2_ergo_mcg: 0.29, vitaminD3_chole_mcg: 0,    notes: null, source: "Table 1.4, DGI_2024, Page 9" },
  "cooking_oil":   { thiamineB1_mcg: 0,      riboflavinB2_mcg: 0,     niacinB3_mcg: 0,      pyridoxineB6_mcg: 0,      totalFolateB9_mcg: 0,      vitaminC_mg: 0,   vitaminA_retinol_mcg: 0,      vitaminD2_ergo_mcg: 0,    vitaminD3_chole_mcg: 0,    notes: "# Values for unfortified oil", source: "Table 1.4, DGI_2024, Page 9" },
  "table_sugar":   { thiamineB1_mcg: 0,      riboflavinB2_mcg: 0,     niacinB3_mcg: 0,      pyridoxineB6_mcg: 0,      totalFolateB9_mcg: 0,      vitaminC_mg: 0,   vitaminA_retinol_mcg: 0,      vitaminD2_ergo_mcg: 0,    vitaminD3_chole_mcg: 0,    notes: null, source: "Table 1.4, DGI_2024, Page 9" },
} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 13C — FOOD GROUP MINERAL AVERAGES (per 100g raw)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Average mineral values per food group (per 100g raw weight).
 * Source: Table 1.5, DGI_2024, Page 9.
 * All values in mg.
 */
export const ICMR_FOOD_GROUP_MINERALS_PER_100G: Record<string, {
  calciumMg: number | null,
  magnesiumMg: number | null,
  ironMg: number | null,
  zincMg: number | null,
  source: string,
}> = {
  "cereals":       { calciumMg: 18.1,   magnesiumMg: 69.1,  ironMg: 2.73,  zincMg: 1.71,  source: "Table 1.5, DGI_2024, Page 9" },
  "millets":       { calciumMg: 60.4,   magnesiumMg: 73.9,  ironMg: 3.20,  zincMg: 2.122, source: "Table 1.5, DGI_2024, Page 9" },
  "pulses":        { calciumMg: 102.2,  magnesiumMg: 133.3, ironMg: 6.25,  zincMg: 2.45,  source: "Table 1.5, DGI_2024, Page 9" },
  "GLVs":          { calciumMg: 279.3,  magnesiumMg: 35.7,  ironMg: 8.07,  zincMg: 0.31,  source: "Table 1.5, DGI_2024, Page 9" },
  "roots_tubers":  { calciumMg: 28.5,   magnesiumMg: 19.4,  ironMg: 0.61,  zincMg: 0.20,  source: "Table 1.5, DGI_2024, Page 9" },
  "vegetables":    { calciumMg: 38.1,   magnesiumMg: 21.3,  ironMg: 0.95,  zincMg: 0.22,  source: "Table 1.5, DGI_2024, Page 9" },
  "nuts":          { calciumMg: 211.6,  magnesiumMg: 185.6, ironMg: 6.58,  zincMg: 2.63,  source: "Table 1.5, DGI_2024, Page 9" },
  "fruits":        { calciumMg: 28.2,   magnesiumMg: 10.3,  ironMg: 0.59,  zincMg: 0.10,  source: "Table 1.5, DGI_2024, Page 9" },
  "meat_poultry":  { calciumMg: 18.7,   magnesiumMg: 11.7,  ironMg: 1.49,  zincMg: 1.82,  source: "Table 1.5, DGI_2024, Page 9" },
  "fish_seafoods": { calciumMg: 323.1,  magnesiumMg: 4.4,   ironMg: 2.16,  zincMg: 0.20,  source: "Table 1.5, DGI_2024, Page 9" },
  "milk":          { calciumMg: 127.6,  magnesiumMg: 0.0,   ironMg: 0.18,  zincMg: 0.12,  source: "Table 1.5, DGI_2024, Page 9" },
  "egg":           { calciumMg: 64.9,   magnesiumMg: 12.0,  ironMg: 1.43,  zincMg: 0.90,  source: "Table 1.5, DGI_2024, Page 9" },
  "dry_spices":    { calciumMg: 367.2,  magnesiumMg: 160.1, ironMg: 11.73, zincMg: 1.81,  source: "Table 1.5, DGI_2024, Page 9" },
  "milk_products": { calciumMg: 755.0,  magnesiumMg: 7.3,   ironMg: 1.86,  zincMg: 0.28,  source: "Table 1.5, DGI_2024, Page 9" },
  "dry_fish":      { calciumMg: 1962.6, magnesiumMg: 1.8,   ironMg: 12.08, zincMg: 0.04,  source: "Table 1.5, DGI_2024, Page 9" },
  "cooking_oil":   { calciumMg: 0,      magnesiumMg: 0,     ironMg: 0,     zincMg: 0,     source: "Table 1.5, DGI_2024, Page 9" },
  "table_sugar":   { calciumMg: 0,      magnesiumMg: 0,     ironMg: 0,     zincMg: 0,     source: "Table 1.5, DGI_2024, Page 9" },
} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 13D — LOW-CALORIE VEGETABLES AND FRUITS (≤20 kcal/100g)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Low-calorie vegetables and fruits (≤20 kcal per 100g).
 * Source: NIN_2011, Annexure 6, Page 104.
 * Original source cited: Nutritive Value of Indian Foods, 1989.
 * Values are per 100g edible portion.
 */
export const ICMR_LOW_CALORIE_VEGETABLES_FRUITS: Record<string, {
  energyKcal: number,
  category: "GLV" | "root_tuber" | "other_vegetable" | "fruit",
  source: string,
}> = {
  // Green Leafy Vegetables
  "amaranth_stem":       { energyKcal: 19, category: "GLV", source: "NIN_2011 Annexure 6 Page 104" },
  "ambat_chukka":        { energyKcal: 15, category: "GLV", source: "NIN_2011 Annexure 6 Page 104" },
  "celery_stalk":        { energyKcal: 18, category: "GLV", source: "NIN_2011 Annexure 6 Page 104" },
  "spinach_stalk":       { energyKcal: 20, category: "GLV", source: "NIN_2011 Annexure 6 Page 104" },
  // Roots and Tubers
  "radish_table":        { energyKcal: 16, category: "root_tuber", source: "NIN_2011 Annexure 6 Page 104" },
  "radish_white":        { energyKcal: 17, category: "root_tuber", source: "NIN_2011 Annexure 6 Page 104" },
  // Other Vegetables
  "ash_gourd":           { energyKcal: 10, category: "other_vegetable", source: "NIN_2011 Annexure 6 Page 104" },
  "bottle_gourd":        { energyKcal: 12, category: "other_vegetable", source: "NIN_2011 Annexure 6 Page 104" },
  "cluster_beans":       { energyKcal: 16, category: "other_vegetable", source: "NIN_2011 Annexure 6 Page 104" },
  "colocasia_stem":      { energyKcal: 18, category: "other_vegetable", source: "NIN_2011 Annexure 6 Page 104" },
  "cucumber":            { energyKcal: 13, category: "other_vegetable", source: "NIN_2011 Annexure 6 Page 104" },
  "ghosala":             { energyKcal: 18, category: "other_vegetable", source: "NIN_2011 Annexure 6 Page 104" },
  "kovai":               { energyKcal: 18, category: "other_vegetable", source: "NIN_2011 Annexure 6 Page 104" },
  "parwal":              { energyKcal: 20, category: "other_vegetable", source: "NIN_2011 Annexure 6 Page 104" },
  "ridge_gourd":         { energyKcal: 17, category: "other_vegetable", source: "NIN_2011 Annexure 6 Page 104" },
  "snake_gourd":         { energyKcal: 18, category: "other_vegetable", source: "NIN_2011 Annexure 6 Page 104" },
  "vegetable_marrow":    { energyKcal: 17, category: "other_vegetable", source: "NIN_2011 Annexure 6 Page 104" },
  // Fruits
  "bilimbi":             { energyKcal: 19, category: "fruit", source: "NIN_2011 Annexure 6 Page 104" },
  "jamb_safed":          { energyKcal: 19, category: "fruit", source: "NIN_2011 Annexure 6 Page 104" },
  "musk_melon":          { energyKcal: 17, category: "fruit", source: "NIN_2011 Annexure 6 Page 104" },
  "water_melon":         { energyKcal: 16, category: "fruit", source: "NIN_2011 Annexure 6 Page 104" },
  "orange_juice":        { energyKcal: 9,  category: "fruit", source: "NIN_2011 Annexure 6 Page 104. Note: juice, not whole fruit." },
  "tomato_ripe":         { energyKcal: 20, category: "fruit", source: "NIN_2011 Annexure 6 Page 104. Listed under fruits in source." },
} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 13E — HIGH-CALORIE VEGETABLES AND FRUITS (>100 kcal/100g)
// ═══════════════════════════════════════════════════════════════════════

/**
 * High-calorie vegetables and fruits (>100 kcal per 100g).
 * Source: NIN_2011, Annexure 7, Page 105.
 * Original source cited: Nutritive Value of Indian Foods, 1989.
 */
export const ICMR_HIGH_CALORIE_VEGETABLES_FRUITS: Record<string, {
  energyKcal: number,
  category: "GLV" | "root_tuber" | "other_vegetable" | "fruit",
  source: string,
}> = {
  // Leafy Vegetables
  "chekkur_manis":              { energyKcal: 103, category: "GLV",            source: "NIN_2011 Annexure 7 Page 105" },
  "colocasia_leaves_dried":     { energyKcal: 277, category: "GLV",            source: "NIN_2011 Annexure 7 Page 105" },
  "curry_leaves":               { energyKcal: 108, category: "GLV",            source: "NIN_2011 Annexure 7 Page 105" },
  "fetid_cassia_dried":         { energyKcal: 292, category: "GLV",            source: "NIN_2011 Annexure 7 Page 105. Also called Chakunda." },
  "rape_leaves_dried":          { energyKcal: 297, category: "GLV",            source: "NIN_2011 Annexure 7 Page 105" },
  "tamarind_leaves":            { energyKcal: 115, category: "GLV",            source: "NIN_2011 Annexure 7 Page 105" },
  // Roots & Tubers
  "arrowroot_flour":            { energyKcal: 334, category: "root_tuber",     source: "NIN_2011 Annexure 7 Page 105" },
  "parsnip":                    { energyKcal: 101, category: "root_tuber",     source: "NIN_2011 Annexure 7 Page 105" },
  "sweet_potato":               { energyKcal: 120, category: "root_tuber",     source: "NIN_2011 Annexure 7 Page 105" },
  "tapioca":                    { energyKcal: 157, category: "root_tuber",     source: "NIN_2011 Annexure 7 Page 105" },
  "yam_ordinary":               { energyKcal: 111, category: "root_tuber",     source: "NIN_2011 Annexure 7 Page 105" },
  "yam_wild":                   { energyKcal: 110, category: "root_tuber",     source: "NIN_2011 Annexure 7 Page 105" },
  // Other Vegetables
  "beans_scarlet_runner":       { energyKcal: 158, category: "other_vegetable",source: "NIN_2011 Annexure 7 Page 105" },
  "jackfruit_seeds":            { energyKcal: 133, category: "other_vegetable",source: "NIN_2011 Annexure 7 Page 105" },
  "karonda_dry":                { energyKcal: 364, category: "other_vegetable",source: "NIN_2011 Annexure 7 Page 105" },
  "lotus_stem_dry":             { energyKcal: 234, category: "other_vegetable",source: "NIN_2011 Annexure 7 Page 105" },
  "sundakai_dry":               { energyKcal: 269, category: "other_vegetable",source: "NIN_2011 Annexure 7 Page 105" },
  "water_chestnut_fresh":       { energyKcal: 115, category: "other_vegetable",source: "NIN_2011 Annexure 7 Page 105" },
  "water_chestnut_dry":         { energyKcal: 330, category: "other_vegetable",source: "NIN_2011 Annexure 7 Page 105" },
  // Fruits
  "apricot_dry":                { energyKcal: 306, category: "fruit",          source: "NIN_2011 Annexure 7 Page 105" },
  "avocado_pear":               { energyKcal: 215, category: "fruit",          source: "NIN_2011 Annexure 7 Page 105" },
  "banana":                     { energyKcal: 116, category: "fruit",          source: "NIN_2011 Annexure 7 Page 105" },
  "bael_fruit":                 { energyKcal: 116, category: "fruit",          source: "NIN_2011 Annexure 7 Page 105" },
  "currants_red":               { energyKcal: 316, category: "fruit",          source: "NIN_2011 Annexure 7 Page 105" },
  "dates_dried":                { energyKcal: 317, category: "fruit",          source: "NIN_2011 Annexure 7 Page 105" },
  "dates_fresh":                { energyKcal: 144, category: "fruit",          source: "NIN_2011 Annexure 7 Page 105" },
  "mahua_ripe":                 { energyKcal: 111, category: "fruit",          source: "NIN_2011 Annexure 7 Page 105" },
  "raisins":                    { energyKcal: 308, category: "fruit",          source: "NIN_2011 Annexure 7 Page 105" },
  "seetaphal_custard_apple":    { energyKcal: 104, category: "fruit",          source: "NIN_2011 Annexure 7 Page 105" },
  "wood_apple":                 { energyKcal: 134, category: "fruit",          source: "NIN_2011 Annexure 7 Page 105" },
} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 13F — COOKED PREPARATION CALORIC VALUES (per serving)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Approximate caloric value of cooked Indian preparations.
 * Source: NIN_2011, Annexure 8, Pages 106–108.
 * Values are per ONE SERVING as specified.
 * NOTE: Only energy (kcal) is given — no protein/fat/carb breakdown.
 */
export const ICMR_COOKED_PREPARATION_CALORIES: Record<string, {
  servingDescription: string,
  energyKcal: number,
  category: "cereal" | "pulse" | "vegetable" | "non_vegetarian" | "snack" | "chutney" | "sweet_dessert" | "beverage",
  source: string,
}> = {
  // 1. Cereal
  "rice_cooked":              { servingDescription: "1 cup",                   energyKcal: 170, category: "cereal",         source: "NIN_2011 Annexure 8 Page 106" },
  "phulka_roti":              { servingDescription: "1 piece",                 energyKcal: 80,  category: "cereal",         source: "NIN_2011 Annexure 8 Page 106" },
  "paratha":                  { servingDescription: "1 piece",                 energyKcal: 150, category: "cereal",         source: "NIN_2011 Annexure 8 Page 106" },
  "puri":                     { servingDescription: "1 piece",                 energyKcal: 80,  category: "cereal",         source: "NIN_2011 Annexure 8 Page 106" },
  "bread":                    { servingDescription: "2 slices",                energyKcal: 170, category: "cereal",         source: "NIN_2011 Annexure 8 Page 106" },
  "poha":                     { servingDescription: "1 cup",                   energyKcal: 270, category: "cereal",         source: "NIN_2011 Annexure 8 Page 106" },
  "upma":                     { servingDescription: "1 cup",                   energyKcal: 270, category: "cereal",         source: "NIN_2011 Annexure 8 Page 106" },
  "idli":                     { servingDescription: "2 pieces",                energyKcal: 150, category: "cereal",         source: "NIN_2011 Annexure 8 Page 106" },
  "dosa":                     { servingDescription: "1 piece",                 energyKcal: 125, category: "cereal",         source: "NIN_2011 Annexure 8 Page 106" },
  "khichdi":                  { servingDescription: "1 cup",                   energyKcal: 200, category: "cereal",         source: "NIN_2011 Annexure 8 Page 106" },
  "wheat_porridge":           { servingDescription: "1 cup",                   energyKcal: 220, category: "cereal",         source: "NIN_2011 Annexure 8 Page 106" },
  "semolina_porridge":        { servingDescription: "1 cup",                   energyKcal: 220, category: "cereal",         source: "NIN_2011 Annexure 8 Page 106" },
  "cereal_flakes_with_milk":  { servingDescription: "1 cup (corn/wheat/rice)", energyKcal: 220, category: "cereal",         source: "NIN_2011 Annexure 8 Page 106" },
  // 2. Pulse
  "plain_dhal":               { servingDescription: "½ cup",                   energyKcal: 100, category: "pulse",          source: "NIN_2011 Annexure 8 Page 106" },
  "sambar":                   { servingDescription: "1 cup",                   energyKcal: 110, category: "pulse",          source: "NIN_2011 Annexure 8 Page 106" },
  // 3. Vegetable
  "vegetable_curry_with_gravy":{ servingDescription: "1 cup",                  energyKcal: 170, category: "vegetable",      source: "NIN_2011 Annexure 8 Page 106" },
  "vegetable_dry":            { servingDescription: "1 cup",                   energyKcal: 150, category: "vegetable",      source: "NIN_2011 Annexure 8 Page 106" },
  // 4. Non-Vegetarian
  "boiled_egg":               { servingDescription: "1 egg",                   energyKcal: 90,  category: "non_vegetarian", source: "NIN_2011 Annexure 8 Page 106" },
  "omelette":                 { servingDescription: "1 omelette",              energyKcal: 160, category: "non_vegetarian", source: "NIN_2011 Annexure 8 Page 106" },
  "fried_egg":                { servingDescription: "1 egg",                   energyKcal: 160, category: "non_vegetarian", source: "NIN_2011 Annexure 8 Page 106" },
  "mutton_curry":             { servingDescription: "¾ cup",                   energyKcal: 260, category: "non_vegetarian", source: "NIN_2011 Annexure 8 Page 106" },
  "chicken_curry":            { servingDescription: "¾ cup",                   energyKcal: 240, category: "non_vegetarian", source: "NIN_2011 Annexure 8 Page 106" },
  "fish_fried":               { servingDescription: "2 big pieces",            energyKcal: 190, category: "non_vegetarian", source: "NIN_2011 Annexure 8 Page 106" },
  "fish_cutlet":              { servingDescription: "2 pieces",                energyKcal: 190, category: "non_vegetarian", source: "NIN_2011 Annexure 8 Page 107" },
  "prawn_curry":              { servingDescription: "¾ cup",                   energyKcal: 220, category: "non_vegetarian", source: "NIN_2011 Annexure 8 Page 107" },
  "keema_kofta_curry":        { servingDescription: "¾ cup (6 small koftas)",  energyKcal: 240, category: "non_vegetarian", source: "NIN_2011 Annexure 8 Page 107" },
  // 5. Savoury Snacks
  "bajji_or_pakora":          { servingDescription: "8 pieces",                energyKcal: 280, category: "snack",          source: "NIN_2011 Annexure 8 Page 107" },
  "besan_ka_pura":            { servingDescription: "1 piece",                 energyKcal: 220, category: "snack",          source: "NIN_2011 Annexure 8 Page 107" },
  "chat_dahi_pakori":         { servingDescription: "5 pieces",                energyKcal: 220, category: "snack",          source: "NIN_2011 Annexure 8 Page 107" },
  "cheese_balls":             { servingDescription: "2 pieces",                energyKcal: 250, category: "snack",          source: "NIN_2011 Annexure 8 Page 107" },
  "dahi_vada":                { servingDescription: "2 pieces",                energyKcal: 180, category: "snack",          source: "NIN_2011 Annexure 8 Page 107" },
  "vada":                     { servingDescription: "2 pieces",                energyKcal: 140, category: "snack",          source: "NIN_2011 Annexure 8 Page 107" },
  "masala_vada":              { servingDescription: "2 pieces",                energyKcal: 150, category: "snack",          source: "NIN_2011 Annexure 8 Page 107" },
  "masala_dosa":              { servingDescription: "1 piece",                 energyKcal: 200, category: "snack",          source: "NIN_2011 Annexure 8 Page 107" },
  "pea_kachori":              { servingDescription: "2 pieces",                energyKcal: 380, category: "snack",          source: "NIN_2011 Annexure 8 Page 107" },
  "potato_bonda":             { servingDescription: "2 pieces",                energyKcal: 200, category: "snack",          source: "NIN_2011 Annexure 8 Page 107" },
  "sago_vada":                { servingDescription: "2 pieces",                energyKcal: 210, category: "snack",          source: "NIN_2011 Annexure 8 Page 107" },
  "samosa":                   { servingDescription: "1 piece",                 energyKcal: 200, category: "snack",          source: "NIN_2011 Annexure 8 Page 107" },
  "sandwiches_with_butter":   { servingDescription: "2 sandwiches (2 tbsp butter)", energyKcal: 200, category: "snack",    source: "NIN_2011 Annexure 8 Page 107" },
  "vegetable_puff":           { servingDescription: "1 piece",                 energyKcal: 200, category: "snack",          source: "NIN_2011 Annexure 8 Page 107" },
  "pizza_cheese_tomato":      { servingDescription: "1 slice",                 energyKcal: 200, category: "snack",          source: "NIN_2011 Annexure 8 Page 107" },
  // 6. Chutneys
  "chutney_coconut_groundnut_til":{ servingDescription: "2 tbsp",              energyKcal: 120, category: "chutney",        source: "NIN_2011 Annexure 8 Page 107" },
  "chutney_tomato":           { servingDescription: "1 tbsp",                  energyKcal: 10,  category: "chutney",        source: "NIN_2011 Annexure 8 Page 107" },
  "chutney_tamarind_jaggery": { servingDescription: "1 tbsp",                  energyKcal: 60,  category: "chutney",        source: "NIN_2011 Annexure 8 Page 107" },
  // 7. Sweets and Desserts
  "besan_barfi":              { servingDescription: "2 small pieces",          energyKcal: 400, category: "sweet_dessert",  source: "NIN_2011 Annexure 8 Page 107" },
  "chikki":                   { servingDescription: "2 pieces",                energyKcal: 290, category: "sweet_dessert",  source: "NIN_2011 Annexure 8 Page 107" },
  "fruit_cake":               { servingDescription: "1 piece",                 energyKcal: 270, category: "sweet_dessert",  source: "NIN_2011 Annexure 8 Page 107" },
  "rice_puttu":               { servingDescription: "½ cup",                   energyKcal: 280, category: "sweet_dessert",  source: "NIN_2011 Annexure 8 Page 107" },
  "sandesh":                  { servingDescription: "2 pieces",                energyKcal: 140, category: "sweet_dessert",  source: "NIN_2011 Annexure 8 Page 107" },
  "double_ka_meetha":         { servingDescription: "½ cup",                   energyKcal: 280, category: "sweet_dessert",  source: "NIN_2011 Annexure 8 Page 107" },
  "halwa_kesari":             { servingDescription: "½ cup",                   energyKcal: 320, category: "sweet_dessert",  source: "NIN_2011 Annexure 8 Page 107" },
  "jelly_jam":                { servingDescription: "1 tbsp",                  energyKcal: 20,  category: "sweet_dessert",  source: "NIN_2011 Annexure 8 Page 107" },
  "custard_caramel":          { servingDescription: "½ cup",                   energyKcal: 160, category: "sweet_dessert",  source: "NIN_2011 Annexure 8 Page 107" },
  "shrikhand":                { servingDescription: "½ cup",                   energyKcal: 380, category: "sweet_dessert",  source: "NIN_2011 Annexure 8 Page 107" },
  "milk_chocolate":           { servingDescription: "25g",                     energyKcal: 140, category: "sweet_dessert",  source: "NIN_2011 Annexure 8 Page 107" },
  "ice_cream":                { servingDescription: "½ cup",                   energyKcal: 200, category: "sweet_dessert",  source: "NIN_2011 Annexure 8 Page 107" },
  // 8. Beverages
  "tea_toned_milk_sugar":     { servingDescription: "1 cup (2 tsp sugar + 50ml toned milk)", energyKcal: 75,  category: "beverage", source: "NIN_2011 Annexure 8 Page 108" },
  "coffee_with_milk_sugar":   { servingDescription: "1 cup (2 tsp sugar + 100ml milk)",      energyKcal: 110, category: "beverage", source: "NIN_2011 Annexure 8 Page 108" },
  "cows_milk_with_sugar":     { servingDescription: "1 cup (2 tsp sugar)",                   energyKcal: 180, category: "beverage", source: "NIN_2011 Annexure 8 Page 108" },
  "buffalos_milk_with_sugar": { servingDescription: "1 cup (2 tsp sugar)",                   energyKcal: 320, category: "beverage", source: "NIN_2011 Annexure 8 Page 108" },
  "lassi_with_sugar":         { servingDescription: "1 cup / glass (200ml, 2 tsp sugar)",    energyKcal: 110, category: "beverage", source: "NIN_2011 Annexure 8 Page 108" },
  "squash":                   { servingDescription: "1 cup / glass",                         energyKcal: 75,  category: "beverage", source: "NIN_2011 Annexure 8 Page 108" },
  "syrups_sharbats":          { servingDescription: "1 cup / glass",                         energyKcal: 200, category: "beverage", source: "NIN_2011 Annexure 8 Page 108" },
  "cold_drinks_carbonated":   { servingDescription: "1 bottle (200ml)",                      energyKcal: 150, category: "beverage", source: "NIN_2011 Annexure 8 Page 108" },
  "fresh_lime_juice":         { servingDescription: "1 glass",                               energyKcal: 60,  category: "beverage", source: "NIN_2011 Annexure 8 Page 108" },
} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 13G — NUTS, SALADS AND FRUITS (per portion)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Caloric value of nuts, salad vegetables and fresh fruits per portion.
 * Source: NIN_2011, Annexure 1, Page 85.
 * Portion sizes are as specified (not per 100g).
 */
export const ICMR_NUTS_SALADS_FRUITS_PER_PORTION: Record<string, {
  portionDescription: string,
  energyKcal: number,
  category: "nut" | "fruit" | "salad_vegetable",
  source: string,
}> = {
  // Nuts
  "almonds":         { portionDescription: "10 pieces",    energyKcal: 85,  category: "nut",              source: "NIN_2011 Annexure 1 Page 85" },
  "cashewnuts":      { portionDescription: "10 pieces",    energyKcal: 95,  category: "nut",              source: "NIN_2011 Annexure 1 Page 85" },
  "coconut_fresh":   { portionDescription: "100g",         energyKcal: 444, category: "nut",              source: "NIN_2011 Annexure 1 Page 85" },
  "coconut_dry":     { portionDescription: "100g",         energyKcal: 662, category: "nut",              source: "NIN_2011 Annexure 1 Page 85" },
  "peanuts":         { portionDescription: "50 pieces",    energyKcal: 90,  category: "nut",              source: "NIN_2011 Annexure 1 Page 85" },
  // Fresh Fruits
  "apple":           { portionDescription: "1 medium",     energyKcal: 65,  category: "fruit",            source: "NIN_2011 Annexure 1 Page 85" },
  "banana":          { portionDescription: "1 medium",     energyKcal: 90,  category: "fruit",            source: "NIN_2011 Annexure 1 Page 85" },
  "grapes":          { portionDescription: "30 pieces",    energyKcal: 70,  category: "fruit",            source: "NIN_2011 Annexure 1 Page 85" },
  "guava":           { portionDescription: "1 medium",     energyKcal: 50,  category: "fruit",            source: "NIN_2011 Annexure 1 Page 85" },
  "jackfruit":       { portionDescription: "4 pieces",     energyKcal: 90,  category: "fruit",            source: "NIN_2011 Annexure 1 Page 85" },
  "mango":           { portionDescription: "1 medium",     energyKcal: 180, category: "fruit",            source: "NIN_2011 Annexure 1 Page 85" },
  "mosambi_orange":  { portionDescription: "1 medium",     energyKcal: 40,  category: "fruit",            source: "NIN_2011 Annexure 1 Page 85" },
  "papaya":          { portionDescription: "1 piece",      energyKcal: 80,  category: "fruit",            source: "NIN_2011 Annexure 1 Page 85" },
  "pineapple":       { portionDescription: "1 piece",      energyKcal: 50,  category: "fruit",            source: "NIN_2011 Annexure 1 Page 85" },
  "sapota":          { portionDescription: "1 medium",     energyKcal: 80,  category: "fruit",            source: "NIN_2011 Annexure 1 Page 85" },
  "custard_apple":   { portionDescription: "1 medium",     energyKcal: 130, category: "fruit",            source: "NIN_2011 Annexure 1 Page 85" },
  "watermelon_slice":{ portionDescription: "1 slice",      energyKcal: 15,  category: "fruit",            source: "NIN_2011 Annexure 1 Page 85" },
  // Salad Vegetables
  "beetroot":        { portionDescription: "1 medium",     energyKcal: 30,  category: "salad_vegetable",  source: "NIN_2011 Annexure 1 Page 85" },
  "carrot":          { portionDescription: "1 medium",     energyKcal: 70,  category: "salad_vegetable",  source: "NIN_2011 Annexure 1 Page 85" },
  "cucumber_salad":  { portionDescription: "1 medium",     energyKcal: 12,  category: "salad_vegetable",  source: "NIN_2011 Annexure 1 Page 85" },
  "onion":           { portionDescription: "1 medium",     energyKcal: 25,  category: "salad_vegetable",  source: "NIN_2011 Annexure 1 Page 85" },
  "radish_salad":    { portionDescription: "1 medium",     energyKcal: 10,  category: "salad_vegetable",  source: "NIN_2011 Annexure 1 Page 85" },
  "tomato":          { portionDescription: "1 medium",     energyKcal: 10,  category: "salad_vegetable",  source: "NIN_2011 Annexure 1 Page 85" },
} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 13H — ALPHA-LINOLENIC ACID (ALA / OMEGA-3) CONTENT
// ═══════════════════════════════════════════════════════════════════════

/**
 * Alpha-Linolenic Acid (ALA / n-3 / omega-3) content of foods (g per 100g).
 * Source: NIN_2011, Annexure 9, Pages 109–110.
 *
 * DGI_2024 Table 7.1 (Page 53) provides a DIFFERENT format:
 * grams of each food needed to furnish 100mg n-3 PUFA.
 * Both are included below.
 */
export const ICMR_ALA_CONTENT_PER_100G = {

  // From NIN_2011 Annexure 9 Pages 109–110
  nin2011Values: {
    "wheat_and_bajra_pearl_millet": { alaG: 0.14,  source: "NIN_2011 Annexure 9 Page 109" },
    "blackgram_rajmah_cowpea":      { alaG: 0.50,  source: "NIN_2011 Annexure 9 Page 109. Listed as 'Blackgram (kala chana), kidney beans (rajmah) & cowpea (lobia)'." },
    "other_pulses":                 { alaG: 0.16,  source: "NIN_2011 Annexure 9 Page 109" },
    "green_leafy_vegetables":       { alaG: 0.16,  source: "NIN_2011 Annexure 9 Page 109" },
    "other_vegetables":             { alaG: 0.025, source: "NIN_2011 Annexure 9 Page 109" },
    "fruits":                       { alaG: 0.025, source: "NIN_2011 Annexure 9 Page 109" },
    "fenugreek_seed_methi":         { alaG: 2.0,   source: "NIN_2011 Annexure 9 Page 109" },
    "mustard_sarson":               { alaG: 10.0,  source: "NIN_2011 Annexure 9 Page 109" },
    "flaxseed_alsi_linseed":        { alaG: 20.0,  source: "NIN_2011 Annexure 9 Page 110" },
    "perilla_seeds_bhanjira":       { alaG: 33.0,  source: "NIN_2011 Annexure 9 Page 110" },
  },

  // From DGI_2024 Table 7.1 (Page 53) — grams of food needed for 100mg n-3 PUFA
  // (This is an INVERSE relationship: lower grams = richer ALA source)
  dgi2024_grams_per_100mg_n3: {
    "wheat_bajra":          { gramsNeeded: 70,   source: "DGI_2024 Table 7.1, Page 53" },
    "oats":                 { gramsNeeded: 70,   source: "DGI_2024 Table 7.1, Page 53" },
    "wheat_grain":          { gramsNeeded: 1.4,  source: "DGI_2024 Table 7.1, Page 53. NOTE: likely a typo in source — 1.4g wheat for 100mg ALA implies ~7g ALA/100g wheat, which is extremely high. Verify against original." },
    "blackgram_rajmah_cowpea": { gramsNeeded: 20, source: "DGI_2024 Table 7.1, Page 53" },
    "soyabean":             { gramsNeeded: 7,    source: "DGI_2024 Table 7.1, Page 53" },
    "other_pulses":         { gramsNeeded: 60,   source: "DGI_2024 Table 7.1, Page 53" },
    "green_leafy_veg":      { gramsNeeded: 60,   source: "DGI_2024 Table 7.1, Page 53" },
    "purslane":             { gramsNeeded: 25,   source: "DGI_2024 Table 7.1, Page 53" },
    "radish_seed_sprouted": { gramsNeeded: 14,   source: "DGI_2024 Table 7.1, Page 53" },
    "spirulina_dried":      { gramsNeeded: 12,   source: "DGI_2024 Table 7.1, Page 53" },
    "fenugreek_seed":       { gramsNeeded: 5,    source: "DGI_2024 Table 7.1, Page 53" },
    "mustard_seed":         { gramsNeeded: 2,    source: "DGI_2024 Table 7.1, Page 53" },
    "walnuts":              { gramsNeeded: 2,    source: "DGI_2024 Table 7.1, Page 53" },
    "almonds":              { gramsNeeded: 25,   source: "DGI_2024 Table 7.1, Page 53" },
    "flaxseed_linseed":     { gramsNeeded: 0.5,  source: "DGI_2024 Table 7.1, Page 53" },
    "perilla_seed":         { gramsNeeded: 0.5,  source: "DGI_2024 Table 7.1, Page 53" },
    "mustard_rapeseed_oil": { gramsNeeded: 0.7,  source: "DGI_2024 Table 7.1, Page 53" },
    "soyabean_oil":         { gramsNeeded: 1.5,  source: "DGI_2024 Table 7.1, Page 53" },
    "canola_oil":           { gramsNeeded: 0.5,  source: "DGI_2024 Table 7.1, Page 53" },
    "flaxseed_oil":         { gramsNeeded: 0.2,  source: "DGI_2024 Table 7.1, Page 53" },
    // Animal sources (LC n-3 PUFAs: DHA + EPA, not ALA)
    "low_medium_fat_fish":  { gramsNeeded_lc_n3: "20–50g", source: "DGI_2024 Table 7.1, Page 53. LC n-3 (DHA+EPA), not ALA." },
    "oily_fish_over5pct_fat":{ gramsNeeded_lc_n3: "10g",   source: "DGI_2024 Table 7.1, Page 53. LC n-3." },
    "chicken":              { gramsNeeded_lc_n3: "100g",   source: "DGI_2024 Table 7.1, Page 53. LC n-3." },
    "lean_meats":           { gramsNeeded_lc_n3: "150g",   source: "DGI_2024 Table 7.1, Page 53. LC n-3." },
    "standard_egg":         { gramsNeeded_lc_n3: "2–3 eggs", source: "DGI_2024 Table 7.1, Page 53. LC n-3." },
    "dha_enriched_flaxseed_egg": { gramsNeeded_lc_n3: "1 egg", source: "DGI_2024 Table 7.1, Page 53. LC n-3." },
    "dha_enriched_marine_egg":   { gramsNeeded_lc_n3: "1/3 egg", source: "DGI_2024 Table 7.1, Page 53. LC n-3." },
  },

} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 13I — GI OF COMMON FOODS (NIN_2011 Annexure 10)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Glycemic Index of common foods.
 * Source: NIN_2011 Annexure 10, Page 111.
 * External source cited: "Diabetes care, Vol: 31, Number 12, December 2008"
 * Values are mean ± SD.
 *
 * NOTE: These values are from an external publication cited by NIN_2011.
 * They are NOT ICMR-generated values. The DGI_2024 Annexure III values
 * (in Part 2) are the preferred ICMR-NIN source for GI. These are
 * supplementary international reference values only.
 *
 * GI Classification (WHO/FAO): LOW <55 | MEDIUM 55–70 | HIGH >70
 */
export const ICMR_NIN2011_GI_REFERENCE: Record<string, {
  gi: number,
  giSD: number,
  category: "low" | "medium" | "high",
  foodType: "cereal" | "pulse" | "vegetable" | "fruit" | "dairy" | "other",
  source: string,
}> = {
  "white_wheat_bread":     { gi: 75, giSD: 2, category: "high",   foodType: "cereal",    source: "NIN_2011 Annexure 10 Page 111 (external: Diabetes Care 2008)" },
  "whole_wheat_bread":     { gi: 74, giSD: 2, category: "high",   foodType: "cereal",    source: "NIN_2011 Annexure 10 Page 111" },
  "wheat_roti":            { gi: 62, giSD: 3, category: "medium", foodType: "cereal",    source: "NIN_2011 Annexure 10 Page 111" },
  "chapathi":              { gi: 52, giSD: 4, category: "low",    foodType: "cereal",    source: "NIN_2011 Annexure 10 Page 111. Note: different value from DGI_2024 Annexure III (62.43). External source." },
  "white_boiled_rice":     { gi: 73, giSD: 4, category: "high",   foodType: "cereal",    source: "NIN_2011 Annexure 10 Page 111" },
  "brown_boiled_rice":     { gi: 68, giSD: 4, category: "medium", foodType: "cereal",    source: "NIN_2011 Annexure 10 Page 111" },
  "barley":                { gi: 28, giSD: 2, category: "low",    foodType: "cereal",    source: "NIN_2011 Annexure 10 Page 111" },
  "instant_oat_porridge":  { gi: 79, giSD: 3, category: "high",   foodType: "cereal",    source: "NIN_2011 Annexure 10 Page 111" },
  "rice_porridge_congee":  { gi: 78, giSD: 9, category: "high",   foodType: "cereal",    source: "NIN_2011 Annexure 10 Page 111" },
  "millet_porridge":       { gi: 67, giSD: 5, category: "medium", foodType: "cereal",    source: "NIN_2011 Annexure 10 Page 111" },
  "sweet_corn":            { gi: 52, giSD: 5, category: "low",    foodType: "cereal",    source: "NIN_2011 Annexure 10 Page 111" },
  "cornflakes":            { gi: 81, giSD: 6, category: "high",   foodType: "cereal",    source: "NIN_2011 Annexure 10 Page 111" },
  "apple_raw":             { gi: 36, giSD: 2, category: "low",    foodType: "fruit",     source: "NIN_2011 Annexure 10 Page 111" },
  "orange":                { gi: 43, giSD: 3, category: "low",    foodType: "fruit",     source: "NIN_2011 Annexure 10 Page 111" },
  "banana_nin":            { gi: 51, giSD: 3, category: "low",    foodType: "fruit",     source: "NIN_2011 Annexure 10 Page 111" },
  "pineapple":             { gi: 59, giSD: 8, category: "medium", foodType: "fruit",     source: "NIN_2011 Annexure 10 Page 111" },
  "mango_raw":             { gi: 51, giSD: 5, category: "low",    foodType: "fruit",     source: "NIN_2011 Annexure 10 Page 111" },
  "watermelon_raw":        { gi: 76, giSD: 4, category: "high",   foodType: "fruit",     source: "NIN_2011 Annexure 10 Page 111" },
  "potato_boiled":         { gi: 78, giSD: 4, category: "high",   foodType: "vegetable", source: "NIN_2011 Annexure 10 Page 111" },
  "french_fries_potato":   { gi: 63, giSD: 5, category: "medium", foodType: "vegetable", source: "NIN_2011 Annexure 10 Page 111" },
  "carrots_boiled":        { gi: 39, giSD: 4, category: "low",    foodType: "vegetable", source: "NIN_2011 Annexure 10 Page 111" },
  "milk_full_fat":         { gi: 39, giSD: 3, category: "low",    foodType: "dairy",     source: "NIN_2011 Annexure 10 Page 111" },
  "milk_skim":             { gi: 37, giSD: 4, category: "low",    foodType: "dairy",     source: "NIN_2011 Annexure 10 Page 111" },
  "ice_cream":             { gi: 51, giSD: 3, category: "low",    foodType: "dairy",     source: "NIN_2011 Annexure 10 Page 111" },
  "chickpeas":             { gi: 28, giSD: 9, category: "low",    foodType: "pulse",     source: "NIN_2011 Annexure 10 Page 111" },
  "soya_beans":            { gi: 16, giSD: 1, category: "low",    foodType: "pulse",     source: "NIN_2011 Annexure 10 Page 111" },
  "lentils":               { gi: 32, giSD: 5, category: "low",    foodType: "pulse",     source: "NIN_2011 Annexure 10 Page 111" },
  "chocolate":             { gi: 40, giSD: 3, category: "low",    foodType: "other",     source: "NIN_2011 Annexure 10 Page 111" },
  "popcorn":               { gi: 65, giSD: 5, category: "medium", foodType: "other",     source: "NIN_2011 Annexure 10 Page 111" },
  "soft_drinks_soda":      { gi: 59, giSD: 3, category: "medium", foodType: "other",     source: "NIN_2011 Annexure 10 Page 111" },
  "honey":                 { gi: 61, giSD: 3, category: "medium", foodType: "other",     source: "NIN_2011 Annexure 10 Page 111" },
  "glucose":               { gi: 103,giSD: 3, category: "high",   foodType: "other",     source: "NIN_2011 Annexure 10 Page 111. Reference standard (glucose = ~100)." },
} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 13J — COMPLEMENTARY FEEDING RECIPE NUTRITION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Nutritional composition of complementary food recipes for infants.
 * Source: DGI_2024 Figures 4.5 and 4.6, Pages 33–35.
 * Original data source: Indian Food Composition Tables 2017;
 * Nutritive Values of Indian Foods; Nutrient Requirements for Indians 2020.
 *
 * NOTE: Values are per SERVING (as stated in figure captions), not per 100g.
 * Ingredient weights are raw weights. All recipes use a base of:
 *   rice rawa 15g + lentil/dal rawa 15g (for grain-based recipes) OR
 *   as specified for individual foods.
 * NOTE: The spinach puree energy value (1080 kcal) in the source is almost
 *   certainly a typo for 108 kcal — see EXTRACTION_NOTES_PART4.
 */
export const ICMR_COMPLEMENTARY_FEEDING_RECIPES: Record<string, {
  ageGroup: string,
  servingWeightG: number | null,
  energyKcal: number,
  proteinG: number,
  ironMg: number,
  zincMg: number | null,
  ingredients: string,
  notes: string | null,
  source: string,
}> = {
  // Figure 4.5 — 6–8 months
  "carrot_puree_6_8mo":       { ageGroup: "6–8 months", servingWeightG: 55, energyKcal: 110, proteinG: 4.85, ironMg: 1.01, zincMg: 0.71, ingredients: "Rice rawa 15g + lentil/dal rawa 15g + carrot puree 25g", notes: null, source: "DGI_2024 Figure 4.5 Page 33" },
  "pumpkin_puree_6_8mo":      { ageGroup: "6–8 months", servingWeightG: 55, energyKcal: 108, proteinG: 4.89, ironMg: 0.95, zincMg: 0.67, ingredients: "Rice rawa 15g + lentil/dal rawa 15g + pumpkin puree 25g", notes: null, source: "DGI_2024 Figure 4.5 Page 33" },
  "spinach_puree_6_8mo":      { ageGroup: "6–8 months", servingWeightG: 55, energyKcal: 108, proteinG: 5.22, ironMg: 1.60, zincMg: 0.76, ingredients: "Rice rawa 15g + lentil/dal rawa 15g + spinach puree 25g", notes: "SOURCE TYPO: printed as '1080 kcal' — almost certainly 108 kcal (consistent with other recipes). Recorded as 108. See EXTRACTION_NOTES_PART4.", source: "DGI_2024 Figure 4.5 Page 33" },
  "potato_puree_6_8mo":       { ageGroup: "6–8 months", servingWeightG: 55, energyKcal: 117, proteinG: 5.02, ironMg: 1.00, zincMg: 0.74, ingredients: "Rice rawa 15g + lentil/dal rawa 15g + potato puree 25g", notes: null, source: "DGI_2024 Figure 4.5 Page 33" },
  "apple_puree_6_8mo":        { ageGroup: "6–8 months", servingWeightG: 55, energyKcal: 118, proteinG: 4.75, ironMg: 0.93, zincMg: 0.67, ingredients: "Rice rawa 15g + lentil/dal rawa 15g + apple puree 25g", notes: null, source: "DGI_2024 Figure 4.5 Page 33" },
  "grated_boiled_egg_6_8mo":  { ageGroup: "6–8 months", servingWeightG: 45, energyKcal: 122, proteinG: 6.67, ironMg: 1.32, zincMg: 0.95, ingredients: "Rice rawa 15g + lentil/dal rawa 15g + grated boiled egg 15g", notes: null, source: "DGI_2024 Figure 4.5 Page 33" },
  "mashed_fish_6_8mo":        { ageGroup: "6–8 months", servingWeightG: 55, energyKcal: 133, proteinG: 9.43, ironMg: 0.94, zincMg: 0.78, ingredients: "Rice rawa 15g + lentil/dal rawa 15g + cooked & mashed fish 25g", notes: null, source: "DGI_2024 Figure 4.5 Page 33" },
  // Figure 4.5 — 9 to <12 months
  "grated_mixed_veg_9_12mo":  { ageGroup: "9–12 months", servingWeightG: 60, energyKcal: 114, proteinG: 4.98, ironMg: 1.02, zincMg: 0.73, ingredients: "Rice rawa medium 15g + lentil/dal rawa 15g + carrot 10g + potato 10g + pumpkin 10g", notes: null, source: "DGI_2024 Figure 4.5 Page 34" },
  "egg_pudding_9_12mo":       { ageGroup: "9–12 months", servingWeightG: 130, energyKcal: 126, proteinG: 9.25, ironMg: 1.66, zincMg: 1.28, ingredients: "Egg 50g + milk 80ml", notes: null, source: "DGI_2024 Figure 4.5 Page 34" },
  "eggnog_9_12mo":            { ageGroup: "9–12 months", servingWeightG: 140, energyKcal: 133, proteinG: 9.58, ironMg: 1.68, zincMg: 1.34, ingredients: "Egg 50g + milk 90ml", notes: null, source: "DGI_2024 Figure 4.5 Page 34" },
  // Figure 4.5 — Above 12 months
  "plain_dalia_boiled_egg_12mo_plus": { ageGroup: ">12 months", servingWeightG: 30, energyKcal: 102, proteinG: 4.68, ironMg: 0.86, zincMg: 0.64, ingredients: "Rice rawa large 15g + lentil/dal rawa 15g", notes: "Plain dalia component only (boiled egg separate entry below)", source: "DGI_2024 Figure 4.5 Page 34" },
  "egg_boiled_12mo_plus":     { ageGroup: ">12 months", servingWeightG: 25, energyKcal: 46,  proteinG: 3.61, ironMg: 0.43, zincMg: 0.31, ingredients: "Boiled egg, raw weight 25g", notes: null, source: "DGI_2024 Figure 4.5 Page 34" },
  "plain_khichdi_boiled_egg": { ageGroup: ">12 months", servingWeightG: 45, energyKcal: 152, proteinG: 8.02, ironMg: 1.28, zincMg: 0.93, ingredients: "Plain dalia + boiled egg combined", notes: null, source: "DGI_2024 Figure 4.5 Page 34" },
  "vegetable_khichdi_12mo_plus":{ ageGroup: ">12 months", servingWeightG: 70, energyKcal: 150, proteinG: 7.24, ironMg: 1.18, zincMg: 0.93, ingredients: "Rice raw milled 20g + green gram dal 20g + carrot 10g + tomato 10g + green peas 10g", notes: null, source: "DGI_2024 Figure 4.5 Page 34" },
  // Figure 4.6 — Healthy snacks for infants
  "cowpea_snack":             { ageGroup: "6 months – >12 months", servingWeightG: null, energyKcal: 32,  proteinG: 2.15, ironMg: 0.51, zincMg: 0.36, ingredients: "Cowpea (puree for <12mo, boiled for ≥12mo)", notes: null, source: "DGI_2024 Figure 4.6 Page 35" },
  "green_peas_snack":         { ageGroup: "6 months – >12 months", servingWeightG: null, energyKcal: 8,   proteinG: 0.75, ironMg: 0.16, zincMg: 0.11, ingredients: "Green peas (puree for <12mo, boiled for ≥12mo)", notes: null, source: "DGI_2024 Figure 4.6 Page 35" },
  "papaya_ripe_snack":        { ageGroup: "6 months – >12 months", servingWeightG: null, energyKcal: 6,   proteinG: 0.10, ironMg: 0.05, zincMg: null,  ingredients: "Papaya ripe", notes: null, source: "DGI_2024 Figure 4.6 Page 35" },
  "banana_ripe_snack":        { ageGroup: "6 months – >12 months", servingWeightG: null, energyKcal: 27,  proteinG: 0.33, ironMg: 0.08, zincMg: 0.03, ingredients: "Banana ripe", notes: null, source: "DGI_2024 Figure 4.6 Page 35" },
  "curd_snack":               { ageGroup: "6 months – >12 months", servingWeightG: null, energyKcal: 15,  proteinG: 0.78, ironMg: 0.05, zincMg: null,  ingredients: "Curd", notes: null, source: "DGI_2024 Figure 4.6 Page 35" },
  "egg_boiled_snack":         { ageGroup: "6 months – >12 months", servingWeightG: null, energyKcal: 34,  proteinG: 3.32, ironMg: 0.77, zincMg: 0.52, ingredients: "Egg boiled", notes: null, source: "DGI_2024 Figure 4.6 Page 35" },
  "pomfret_fish_mashed":      { ageGroup: "6 months – >12 months", servingWeightG: null, energyKcal: 30,  proteinG: 4.75, ironMg: 0.08, zincMg: 0.14, ingredients: "Pomfret fish boneless, boiled and mashed", notes: null, source: "DGI_2024 Figure 4.6 Page 35" },
  "murrel_fish_mashed":       { ageGroup: "6 months – >12 months", servingWeightG: null, energyKcal: 21,  proteinG: 4.76, ironMg: 0.06, zincMg: 0.17, ingredients: "Murrel fish boneless, boiled and mashed", notes: null, source: "DGI_2024 Figure 4.6 Page 35" },
} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 13K — PORTION SIZE NUTRITION (NIN_2011 STANDARD PORTIONS)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Nutrient values per standard portion (30g or 100g as specified).
 * Source: NIN_2011 Annexure 14 (Portion Size of Foods), Page 117.
 * Used to calculate balanced diet portions in NIN_2011 Annexure 2 meal plans.
 */
export const ICMR_STANDARD_PORTION_NUTRITION: Record<string, {
  gramsPerPortion: number,
  energyKcal: number,
  proteinG: number | null,
  carbsG: number | null,
  fatG: number | null,
  source: string,
}> = {
  "cereals_millets":    { gramsPerPortion: 30,    energyKcal: 100, proteinG: 3.0, carbsG: 20, fatG: 0.8, source: "NIN_2011 Annexure 14 Page 117" },
  "pulses":             { gramsPerPortion: 30,    energyKcal: 100, proteinG: 6.0, carbsG: 15, fatG: 0.7, source: "NIN_2011 Annexure 14 Page 117" },
  "egg":                { gramsPerPortion: 50,    energyKcal: 85,  proteinG: 7.0, carbsG: null,fatG: 7.0, source: "NIN_2011 Annexure 14 Page 117" },
  "meat_chicken_fish":  { gramsPerPortion: 50,    energyKcal: 100, proteinG: 9.0, carbsG: null,fatG: 7.0, source: "NIN_2011 Annexure 14 Page 117" },
  "milk_ml":            { gramsPerPortion: 100,   energyKcal: 70,  proteinG: 3.0, carbsG: 5,   fatG: 3.0, source: "NIN_2011 Annexure 14 Page 117. Per 100ml toned milk." },
  "roots_tubers":       { gramsPerPortion: 100,   energyKcal: 80,  proteinG: 1.3, carbsG: 18,  fatG: null,source: "NIN_2011 Annexure 14 Page 117" },
  "green_leafy_veg":    { gramsPerPortion: 100,   energyKcal: 46,  proteinG: 3.6, carbsG: null,fatG: 0.4, source: "NIN_2011 Annexure 14 Page 117" },
  "other_vegetables":   { gramsPerPortion: 100,   energyKcal: 28,  proteinG: 1.7, carbsG: null,fatG: 0.2, source: "NIN_2011 Annexure 14 Page 117" },
  "fruits":             { gramsPerPortion: 100,   energyKcal: 40,  proteinG: null,carbsG: 10,  fatG: null,source: "NIN_2011 Annexure 14 Page 117" },
  "sugar":              { gramsPerPortion: 5,     energyKcal: 20,  proteinG: null,carbsG: 5,   fatG: null,source: "NIN_2011 Annexure 14 Page 117" },
  "fat_oils_visible":   { gramsPerPortion: 5,     energyKcal: 45,  proteinG: null,carbsG: null,fatG: 5.0, source: "NIN_2011 Annexure 14 Page 117" },
} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 14 — SPECIAL POPULATION ADDITIONAL REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Additional calorie and nutrient requirements above baseline for special
 * physiological states.
 *
 * Sources:
 *   - DGI_2024 Guideline 2 Pages 14–20 (pregnancy, lactation)
 *   - DGI_2024 Table 1.6 Page 10 (food group totals by group)
 *   - DGI_2024 Tables 16.1 & 16.2 Pages 101–102 (elderly)
 *   - DGI_2024 Pages 37–45 (children and adolescents)
 *   - NIN_2011 Annexure 3 Page 88 (RDA table — conflicts noted)
 */
export const ICMR_ADDITIONAL_REQUIREMENTS = {

  pregnancy: {
    additionalCaloriesFirstTrimesterKcal: null,
    // NOT_IN_SOURCE: DGI_2024 Guideline 2 Page 14 states additional 350 kcal
    // is from the SECOND to third trimester. No additional calorie figure is
    // stated for first trimester. NIN_2011 Annexure 3 states "+350 kcal" flat
    // for pregnant women without trimester split.

    additionalCaloriesSecondTrimesterKcal: 350,
    // "The daily diet of a pregnant woman of normal weight for height should
    //  contain an additional 350 calories of energy from second to third
    //  trimester." — DGI_2024 Page 14.
    // CONFIRMED: DGI_2024 Page 19 also states "An additional 350 Kcal must
    //  be added (calorie requirement of sedentary women) to the nutrient-rich
    //  balanced diet."

    additionalCaloriesThirdTrimesterKcal: 350,
    // Same 350 kcal applies for third trimester — DGI_2024 Page 14.

    additionalCaloriesUndernourishedKcal: 450,
    // "for undernourished pregnant women, an additional 100 Kcal per day
    //  (total 350+100 = 450 Kcal/day) is recommended" — DGI_2024 Page 19.

    additionalProteinFirstTrimesterG: null,
    // NOT_IN_SOURCE: DGI_2024 does not state a separate first-trimester
    // protein addition. NIN_2011 states +0.5g protein during first trimester.
    additionalProteinFirstTrimesterG_NIN2011: 0.5,
    // NIN_2011 Page 1004: "0.5 g of protein during first trimester"

    additionalProteinSecondTrimesterG: 8,
    // "An additional 8g of protein is required during second trimester" —
    // DGI_2024 Page 14.

    additionalProteinThirdTrimesterG: 18,
    // "and 18g during the third trimester of pregnancy." — DGI_2024 Page 14.

    additionalProteinFlat_NIN2011G: 23,
    // NIN_2011 Annexure 3 Page 88: "+23g protein" flat for pregnancy.
    // CONFLICT: DGI_2024 trimester-split values (8g/18g) are used as primary.

    expectedWeightGainKg: { min: 5, max: 9 },
    // "women who are obese (BMI >27.5) should aim to gain not more than 5–9 kg"
    // — DGI_2024 Page 17 (context suggests this is for obese women; total
    // weight gain for normal-weight women is not explicitly stated as a number).
    // Flag: verify in original PDF — extraction from multi-column layout.

    keyMicronutrientsToIncrease: [
      "Iron (60mg elemental from week 12 via IFA tablet)",
      "Folic acid (0.5mg/day throughout; especially critical first 28 days)",
      "Calcium (1200mg/day RDA — NIN_2011 Annexure 3 Page 88)",
      "Vitamin D (sunlight exposure; food sources — DGI_2024 Page 14)",
      "LCn-3 PUFA (DHA/EPA) for fetal brain development",
      "Iodine (via iodized salt)",
      "Vitamin A",
      "Vitamin B12",
      "Vitamin C",
      "Zinc",
    ],

    supplementsRecommended: [
      "Iron-Folic Acid (IFA) tablet: 60mg elemental iron + 0.5mg folic acid — from week 12 through 6 months postpartum (DGI_2024 Page 18)",
      "Folic acid 500µg (0.5mg) — first 12 weeks only (DGI_2024 Page 20)",
      "Calcium supplement — from 12th week, continued during lactation (DGI_2024 Page 20)",
      "Iodized salt — throughout (DGI_2024 Page 14)",
    ],

    source: "DGI_2024 Guideline 2 Pages 14–20; NIN_2011 Annexure 3 Page 88",
  },

  lactation: {
    additionalCalories_0to6moKcal: 600,
    // "During the first six months of lactation, an additional 600 calories
    //  of energy … are required in the daily diet." — DGI_2024 Page 14.
    // NIN_2011 Annexure 3 Page 88: consistent (+600 kcal for 0–6 months).

    additionalCalories_7to12moKcal: 520,
    // "In the next six months, additional requirements are 520 calories of
    //  energy" — DGI_2024 Page 14.
    // NIN_2011 Annexure 3 Page 88: consistent (+520 kcal for 6–12 months).

    additionalProtein_0to6moG: 13.6,
    // "and 13.6g of proteins are required in the daily diet" — DGI_2024 Page 14.
    // NIN_2011 Annexure 3: +19g. CONFLICT: DGI_2024 value used.

    additionalProtein_7to12moG: 10.6,
    // "additional requirements are … 10.6g of protein" — DGI_2024 Page 14.
    // NIN_2011 Annexure 3: +13g. CONFLICT: DGI_2024 value used.

    additionalProtein_0to6mo_NIN2011G: 19,
    additionalProtein_7to12mo_NIN2011G: 13,
    // NIN_2011 values retained for reference.

    keyMicronutrientsToIncrease: [
      "Iron (continue IFA tablet — 1 per day for anaemia prevention)",
      "Calcium (continue supplement from pregnancy)",
      "LCn-3 PUFA (DHA/EPA) — from oilseeds, nuts, beans, fish",
      "Vitamin B12 (from dairy, eggs, flesh foods)",
      "Folic acid",
    ],

    breastMilkCaloriesSupplied_0to6moKcal: 500,
    // "breast milk provides about 500 Kcal and 5g protein per day"
    // — DGI_2024 Page 26.

    breastMilkProteinSupplied_0to6moG: 5,
    // DGI_2024 Page 26: consistent.

    source: "DGI_2024 Guideline 2 Pages 13–14; NIN_2011 Annexure 3 Page 88",
  },

  adolescents: {
    calciumRdaMgPerDay_NIN2011: 800,
    // NIN_2011 Annexure 3 Page 88: 800mg/day for boys and girls 10–17 years.

    calciumRdaRangeMgPerDay_DGI2024: { min: 850, max: 1050 },
    // "recommended dietary allowances for calcium are about 850–1050mg/day"
    // — DGI_2024 Page 38.
    // Higher than NIN_2011 value. DGI_2024 recommends even higher intake:
    // "it is desirable to give higher quantities of calcium for adolescents
    //  to achieve optimal peak bone mass."

    ironRdaMgPerDay_girls_13_15: 27,
    ironRdaMgPerDay_boys_13_15: 32,
    ironRdaMgPerDay_girls_16_17: 26,
    ironRdaMgPerDay_boys_16_17: 28,
    // Source: NIN_2011 Annexure 3 Page 88.
    // DGI_2024 does not give explicit iron RDA mg figures for adolescents.

    annualPeakHeightGainCm: { min: 9, max: 10 },
    annualPeakWeightGainKg: { min: 8, max: 10 },
    // "annual peak rates for height and weight are 9–10 cm and 8–10 kg"
    // — DGI_2024 Page 37.

    girlsGrowthSpurtAge_years: "10–12 years",
    boysGrowthSpurtAge_years: "12–14 years (2 years later than girls)",
    // DGI_2024 Page 37: "Adolescent growth spurt starts at about 10–12
    //  years in girls and two years later in boys."

    keyNutrients: [
      "Calcium (bone density — peak bone mass achieved in adolescence)",
      "Iron (especially for girls — menstruation increases losses)",
      "Protein (muscle and growth)",
      "Zinc (growth and immunity)",
      "Folate (B9)",
      "Vitamin D (calcium absorption, bone)",
      "Energy (highest kcal/kg needs of any age group)",
    ],

    notes: "Nutritional care of adolescent girls is of particular importance for their own health and in preparation for motherhood. Adolescent girls are at greater physiological stress than boys due to menstruation. — DGI_2024 Page 37.",

    source: "DGI_2024 Pages 37–45 (Guideline 5); NIN_2011 Annexure 3 Page 88",
  },

  elderly: {
    calciumNeedMgPerDay: 844,
    // From DGI_2024 Tables 16.1 & 16.2 — the suggested balanced diet for
    // elderly provides ~844mg calcium/day.

    vitaminDNeed: "Adequate sunlight exposure (about 30 minutes preferably between 11am–2pm) to maintain vitamin D status, which helps in calcium absorption. Sunlight exposure stated for all ages including elderly. — DGI_2024 Page 42",

    proteinGuidance: "Elderly population advised to consume foods rich in protein. Inclusion of pulses, legumes, milk, fish, minced meat or egg increases protein quality. Protein intake from the suggested balanced diet: ~62g/day for men, ~56g/day for women. — DGI_2024 Tables 16.1 & 16.2 Page 101–102",

    calorieReductionFromAdult: "Elderly require fewer calories than adults: ~1740 kcal/day (men) and ~1530 kcal/day (women) vs ~2080 kcal/day sedentary adult man and ~1660 kcal/day sedentary adult woman. Elderly require less energy but more micronutrient-rich foods. — DGI_2024 Tables 16.1 & 16.2 vs Table 1.6 Page 10.",

    waterIntakeLitresPerDay: 2,
    // "Adequate water (two litres/day) should be consumed to avoid dehydration
    //  and constipation." — DGI_2024 Page 101.

    keyNutrients: [
      "Calcium (~844mg/day from balanced diet)",
      "Protein (good quality — 62g/day men, 56g/day women)",
      "Vitamin B12 (~1.5µg/day from balanced diet)",
      "Total folates (~445µg/day from balanced diet)",
      "Vitamin C (~220mg/day from balanced diet)",
      "Iron (~22.1mg/day from balanced diet)",
      "Zinc (~10.2mg/day from balanced diet)",
      "Magnesium (~653mg/day from balanced diet)",
      "Water (2 litres/day — dehydration common in elderly)",
      "Fibre (constipation prevention)",
    ],

    notes: "Elderly need fewer calories but more micronutrients per calorie. Must not eat highly ultra-processed or HFSS foods. Regular physical activity and yoga recommended. Soft, well-cooked food preparations with less salt and moderate spices. — DGI_2024 Page 101.",

    source: "Guideline 16, DGI_2024 Pages 100–102; Tables 16.1 & 16.2",
  },

  source: "DGI_2024 Guideline 2 Pages 14–20; Guideline 5 Pages 37–45; Guideline 16 Pages 100–102; Tables 1.6, 16.1, 16.2; NIN_2011 Annexure 3 Page 88",

} as const;


// ═══════════════════════════════════════════════════════════════════════
// MASTER EXTRACTION NOTES (All Parts Combined)
// ═══════════════════════════════════════════════════════════════════════

export const EXTRACTION_NOTES_PART4 = {

  conflictsBetweenDocuments: [
    "SECTION 13I / GI of chapati: DGI_2024 Annexure III = 62.43; NIN_2011 Annexure 10 (external source) = 52. Different populations and study methods. DGI_2024 value preferred for Indian preparations.",
    "SECTION 14 / Pregnancy additional protein first trimester: DGI_2024 does not state a value; NIN_2011 states +0.5g. NIN_2011 value retained as the only available figure.",
    "SECTION 14 / Pregnancy additional protein (flat): NIN_2011 +23g flat vs DGI_2024 +8g (2nd trimester) / +18g (3rd trimester). DGI_2024 trimester-split used as primary.",
    "SECTION 14 / Lactation additional protein 0–6 months: DGI_2024 13.6g vs NIN_2011 19g. DGI_2024 used.",
    "SECTION 14 / Lactation additional protein 7–12 months: DGI_2024 10.6g vs NIN_2011 13g. DGI_2024 used.",
    "SECTION 14 / Adolescent calcium RDA: NIN_2011 = 800mg/day; DGI_2024 = 850–1050mg/day range. DGI_2024 range used as primary (more recent).",
    "SECTION 13H / ALA in wheat: DGI_2024 Table 7.1 states 1.4g wheat to furnish 100mg n-3 PUFA — this implies ~7.1g ALA per 100g wheat, which is implausibly high (standard literature: ~0.07g/100g). Likely a printing error in the source document. Flagged as suspicious — verify against original PDF.",
  ],

  valuesNotFound: [
    "SECTION 13 / Per-food individual nutrition values (rice, wheat, toor dal, moong dal, spinach, etc. with full macros and micros per 100g) — NOT reproduced in either DGI_2024 or NIN_2011. Both cite IFCT 2017 and NVIF as the source; these must be obtained from those separate publications.",
    "SECTION 13 / Jaggery nutritional values — not in either document.",
    "SECTION 13 / Honey nutritional values beyond GI — not stated per 100g.",
    "SECTION 13 / Paneer nutritional values per 100g — not stated beyond group averages.",
    "SECTION 13 / Individual oil fatty acid composition (per 100g numbers for mustard oil, groundnut oil, coconut oil, ghee) — DGI_2024 Figure 7.2 shows a bar chart of SFA/MUFA/PUFA composition but numbers are not extractable from text.",
    "SECTION 14 / Exact pregnancy weight gain recommendation for normal-weight women — only 5–9kg stated for obese women (BMI >27.5). Normal-weight total gain not given as a single number.",
    "SECTION 14 / Vitamin D daily requirement in IU or µg for elderly — document recommends sunlight exposure rather than a quantitative daily intake target.",
    "SECTION 14 / Zinc RDA for pregnant and lactating women as an absolute mg number — not stated in DGI_2024 (only qualitative mention).",
    "SECTION 14 / B12 RDA for adolescents as a standalone number — NIN_2011 gives 0.2–1.0µg/day for 10–12 years; not separately for 13–18 years.",
  ],

  ambiguousValues: [
    "SECTION 13J / Spinach puree energy value printed as '1080 kcal' in DGI_2024 Figure 4.5 Page 33. This is almost certainly a typo for 108 kcal given: (a) all other 6–8 month recipes are 108–133 kcal, (b) the ingredient quantity is 55g total, (c) the protein (5.22g) and iron (1.60mg) values are consistent with a ~108 kcal recipe. Recorded as 108 kcal with note.",
    "SECTION 14 / Pregnancy weight gain 5–9 kg: text extracted from DGI_2024 Page 17 which was in a multi-column layout. The '5–9 kg' figure may apply specifically to obese women (BMI >27.5) rather than all pregnant women. Verify in original PDF.",
    "SECTION 13H / DGI_2024 Table 7.1 'wheat grain: 1.4g to furnish 100mg n-3 PUFA' — if taken at face value, implies 7.14g ALA per 100g wheat. Standard IFCT 2017 value is ~0.07g/100g. The '1.4' may be a misprint of '14' (i.e., 14g wheat = 100mg ALA = ~0.7g/100g, still high) or another error. Flagged.",
    "SECTION 14 / Adolescent calcium: DGI_2024 states '850–1050mg/day' as the RDA range and simultaneously recommends 'higher quantities than RDA' for peak bone mass — no upper target given.",
  ],

  tablesPartiallyExtracted: [
    "SECTION 13 / DGI_2024 Tables 1.3, 1.4, 1.5: COMPLETE — all food groups extracted. However, these are GROUP AVERAGES, not individual food values.",
    "SECTION 13 / NIN_2011 Annexure 6 (low calorie): COMPLETE — 22 items extracted.",
    "SECTION 13 / NIN_2011 Annexure 7 (high calorie): COMPLETE — 29 items extracted.",
    "SECTION 13 / NIN_2011 Annexure 8 (cooked preparations): COMPLETE — all categories and items extracted.",
    "SECTION 13 / NIN_2011 Annexure 9 (ALA): COMPLETE — all items extracted.",
    "SECTION 13 / NIN_2011 Annexure 10 (GI reference): COMPLETE — all 32 items extracted.",
    "SECTION 13 / NIN_2011 Annexure 1 (nuts/fruits): COMPLETE — all items extracted.",
    "SECTION 13 / DGI_2024 Figure 4.5 and 4.6 (complementary feeding): COMPLETE — all recipes with nutrition values extracted.",
    "SECTION 13 / DGI_2024 Figure 7.2 (fatty acid composition bar chart): NOT EXTRACTABLE — the chart is a visual figure; numeric values per oil are not given in text form in the document.",
    "SECTION 13 / WHO height/weight tables (DGI_2024 Tables 5.1–5.4): NOT EXTRACTED — these are WHO standard tables (not ICMR data) with 100+ rows. Referenced in Part 3 EXTRACTION_NOTES_PART3.",
  ],

} as const;


// ═══════════════════════════════════════════════════════════════════════
// MASTER REFERENCE: WHAT TO SOURCE FROM EXTERNAL PUBLICATIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Items requested in the original prompt that are NOT in DGI_2024 or
 * NIN_2011 — they must be sourced from the external publications cited
 * by these documents.
 */
export const NOT_IN_SOURCE_ITEMS = {

  requiresIFCT2017: [
    "Per-100g values for individual raw ingredients: rice (milled, parboiled, brown, flakes, puffed), wheat (whole, atta, maida, semolina, vermicelli), jowar, bajra, ragi, maize, oats, barley",
    "Per-100g values for individual pulses: toor/arhar dal, moong dal whole and split, chana dal, masoor dal, urad dal whole and split, rajma, chana (Bengal gram), soya bean, cowpea, horse gram",
    "Per-100g values for individual GLVs: spinach (raw and cooked), fenugreek/methi, amaranth, drumstick leaves, coriander, mint, curry leaves",
    "Per-100g values for individual vegetables: tomato, onion, brinjal, bhindi, capsicum, cauliflower, cabbage, bottle gourd (beyond the low-calorie kcal-only data in NIN_2011 Annexure 6)",
    "Per-100g values for individual roots/tubers: potato, sweet potato, carrot, beetroot beyond Annexure data",
    "Per-100g values for fruits: banana, mango, guava, orange, apple, papaya, watermelon, amla (beyond per-portion data in NIN_2011 Annexure 1)",
    "Per-100g values for dairy: milk (cow, buffalo, toned), curd, paneer, ghee, butter with full macro/micro breakdown",
    "Per-100g values for meat/fish/eggs with full macro/micro breakdown",
    "Per-100g values for cooking oils (mustard, sunflower, groundnut, coconut, rice bran, sesame, safflower) — document shows fatty acid proportions only as chart",
    "Per-100g values for nuts: almonds, cashews, walnuts, flaxseeds, sesame/til, chia — beyond kcal-per-portion data",
    "Sodium and potassium content per 100g for individual foods",
    "Vitamin B12 per 100g for individual animal foods",
    "Cooked vs raw nutritional values for individual preparations",
  ],

  primarySourceToConsult: "Indian Food Composition Tables 2017 (IFCT 2017), ICMR-National Institute of Nutrition, Hyderabad. Available at: https://www.ifct2017.com",
  alternativeSource: "Nutritive Value of Indian Foods (NVIF), National Institute of Nutrition. Older edition but widely referenced.",
  supplementarySource: "Nutrient Requirements for Indians 2020 (Updated 2023), ICMR-NIN — for RDA and EAR values beyond what is in NIN_2011 Annexure 3.",

} as const;
