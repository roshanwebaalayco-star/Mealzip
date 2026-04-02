/**
 * ICMR-NIN Nutritional Constants — Part 1 of 4 (Sections 1–4)
 * Sources:
 *   (1) Dietary Guidelines for Indians 2024, ICMR-NIN  [DGI_2024]
 *   (2) Dietary Guidelines for Indians — A Manual, NIN 2011  [NIN_2011]
 * Extraction date: 2026-04-02
 *
 * IMPORTANT: All values sourced directly from the above documents.
 * Do not modify without re-verifying against the source PDFs.
 * Values marked NOT_IN_SOURCE were not found in either document.
 *
 * CONFLICT POLICY: Where documents differ, DGI_2024 value is used and
 * the conflict is noted in EXTRACTION_NOTES at the bottom of each part.
 */

// ═══════════════════════════════════════════════════════════════════════
// SECTION 1 — AGE-GROUP DAILY CALORIE AND PROTEIN REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Daily calorie and protein requirements by age, gender and activity level.
 *
 * PRIMARY SOURCE: Table 1.6, "Suggested food groups for a balanced diet to
 * meet the daily nutrient requirements for people with specific body weights",
 * DGI_2024, Page 10–11.
 *
 * SECONDARY SOURCE: Annexure 3, "Recommended Dietary Allowances for Indians
 * (Macronutrients and Minerals)", NIN_2011, Page 88–89.
 *
 * NOTES ON TABLE 1.6 (DGI_2024):
 *   - Calorie and protein values are labelled "~" (approximate) in the source.
 *   - Table 1.6 gives a single combined calorie/protein row per group
 *     (sedentary only for most children and special groups).
 *   - NIN_2011 gives adult men/women in three activity levels and is used to
 *     fill heavy-work rows which DGI_2024 does not tabulate separately.
 *   - Infant 0–6 months: DGI_2024 states "Exclusive breastfeeding" with no
 *     calorie figure in Table 1.6; NIN_2011 gives 92 kcal/kg/day, used below.
 *   - Infant 7–12 months: DGI_2024 gives food quantities only, no total kcal
 *     in Table 1.6; NIN_2011 gives 80 kcal/kg/day, used below.
 *   - Children 1–3 yrs through Girls 16–18 yrs: DGI_2024 Table 1.6 values
 *     used; activity level recorded as "any" (table does not sub-divide).
 *   - Elderly >60 yrs: DGI_2024 Table 1.6 gives separate Man/Woman rows
 *     but no activity sub-division; recorded as "sedentary".
 *   - Protein column in DGI_2024 Table 1.6 is labelled "Crude protein (g)
 *     obtained from these food groups".
 */
export const ICMR_CALORIE_TABLE = [

  // ─── INFANTS ───────────────────────────────────────────────────────────────

  {
    label: "Infant — 0 to 6 months (exclusive breastfeeding)",
    ageMin: 0,
    ageMax: 0,           // 0–6 months; ageMax uses 0 to denote <1 yr, sub-group A
    gender: "both" as const,
    activityLevel: "any" as const,
    referenceBodyWeightKg: 5.4,   // NIN_2011 Annexure 3, Page 88
    dailyCaloriesKcal: 92,        // per kg/day — NIN_2011; DGI_2024 states
                                  // "exclusive breastfeeding" with no kcal figure.
                                  // Multiply by body weight for absolute kcal.
    dailyProteinG: 1.16,          // per kg/day — NIN_2011 Annexure 3; DGI_2024
                                  // does not give a figure for this sub-group.
    source: "NIN_2011" as const,
    notes: "Values are PER KG/DAY, not absolute. DGI_2024 Table 1.6 specifies exclusive breastfeeding only — no absolute kcal given. NIN_2011 Annexure 3 Page 88 provides per-kg figures.",
  },

  {
    label: "Infant — 7 to 12 months",
    ageMin: 0,
    ageMax: 1,           // <1 yr, sub-group B
    gender: "both" as const,
    activityLevel: "any" as const,
    referenceBodyWeightKg: 8.5,   // DGI_2024 Table 1.6, Page 10
    dailyCaloriesKcal: 80,        // per kg/day — NIN_2011 Annexure 3 Page 88;
                                  // DGI_2024 Table 1.6 gives food quantities
                                  // but no total kcal for this group.
    dailyProteinG: 1.69,          // per kg/day — NIN_2011 Annexure 3 Page 88
    source: "NIN_2011" as const,
    notes: "Values are PER KG/DAY. DGI_2024 Table 1.6 body weight (8.5 kg) used; calorie and protein rates from NIN_2011 Annexure 3. Complementary food should supply ~230 kcal/day (DGI_2024 Page 22).",
  },

  // ─── CHILDREN ──────────────────────────────────────────────────────────────

  {
    label: "Children — 1 to 3 years",
    ageMin: 1,
    ageMax: 3,
    gender: "both" as const,
    activityLevel: "any" as const,
    referenceBodyWeightKg: 12.9,
    dailyCaloriesKcal: 1110,
    dailyProteinG: 38,
    source: "BOTH" as const,
    notes: "DGI_2024 Table 1.6 Page 10: ~1110 kcal, 38g protein (body wt 12.9 kg). NIN_2011 Annexure 3: 1060 kcal, 16.7g protein (body wt 12.9 kg). CONFLICT: DGI_2024 value used. See EXTRACTION_NOTES.",
  },

  {
    label: "Children — 4 to 6 years",
    ageMin: 4,
    ageMax: 6,
    gender: "both" as const,
    activityLevel: "any" as const,
    referenceBodyWeightKg: 18.3,
    dailyCaloriesKcal: 1370,
    dailyProteinG: 46,
    source: "BOTH" as const,
    notes: "DGI_2024 Table 1.6 Page 10: ~1370 kcal, 46g protein (body wt 18.3 kg). NIN_2011 Annexure 3: 1350 kcal, 20.1g protein (body wt 18 kg). CONFLICT on protein: DGI_2024 value used. See EXTRACTION_NOTES.",
  },

  {
    label: "Children — 7 to 9 years",
    ageMin: 7,
    ageMax: 9,
    gender: "both" as const,
    activityLevel: "any" as const,
    referenceBodyWeightKg: 25.3,
    dailyCaloriesKcal: 1710,
    dailyProteinG: 59,
    source: "BOTH" as const,
    notes: "DGI_2024 Table 1.6 Page 10: ~1710 kcal, 59g protein (body wt 25.3 kg). NIN_2011 Annexure 3: 1690 kcal, 29.5g protein (body wt 25.1 kg). CONFLICT on protein: DGI_2024 value used. See EXTRACTION_NOTES.",
  },

  // ─── BOYS 10–18 ────────────────────────────────────────────────────────────

  {
    label: "Boys — 10 to 12 years",
    ageMin: 10,
    ageMax: 12,
    gender: "male" as const,
    activityLevel: "any" as const,
    referenceBodyWeightKg: 34.9,
    dailyCaloriesKcal: 2230,
    dailyProteinG: 76,
    source: "BOTH" as const,
    notes: "DGI_2024 Table 1.6 Page 10: ~2230 kcal, 76g protein (body wt 34.9 kg). NIN_2011 Annexure 3: 2190 kcal, 39.9g protein (body wt 34.3 kg). CONFLICT on protein: DGI_2024 value used. See EXTRACTION_NOTES.",
  },

  {
    label: "Boys — 13 to 15 years",
    ageMin: 13,
    ageMax: 15,
    gender: "male" as const,
    activityLevel: "any" as const,
    referenceBodyWeightKg: 50.5,
    dailyCaloriesKcal: 2860,
    dailyProteinG: 95,
    source: "BOTH" as const,
    notes: "DGI_2024 Table 1.6 Page 10: ~2860 kcal, 95g protein (body wt 50.5 kg). NIN_2011 Annexure 3: 2750 kcal, 54.3g protein (body wt 47.6 kg). CONFLICT on protein: DGI_2024 value used. See EXTRACTION_NOTES.",
  },

  {
    label: "Boys — 16 to 18 years",
    ageMin: 16,
    ageMax: 18,
    gender: "male" as const,
    activityLevel: "any" as const,
    referenceBodyWeightKg: 64.4,
    dailyCaloriesKcal: 3300,
    dailyProteinG: 107,
    source: "BOTH" as const,
    notes: "DGI_2024 Table 1.6 Page 10: ~3300 kcal, 107g protein (body wt 64.4 kg). NIN_2011 Annexure 3: Boys 16–17 yrs: 3020 kcal, 61.5g protein (body wt 55.4 kg). CONFLICT: DGI_2024 value used.",
  },

  // ─── GIRLS 10–18 ───────────────────────────────────────────────────────────

  {
    label: "Girls — 10 to 12 years",
    ageMin: 10,
    ageMax: 12,
    gender: "female" as const,
    activityLevel: "any" as const,
    referenceBodyWeightKg: 36.4,
    dailyCaloriesKcal: 2060,
    dailyProteinG: 70,
    source: "BOTH" as const,
    notes: "DGI_2024 Table 1.6 Page 10: ~2060 kcal, 70g protein (body wt 36.4 kg). NIN_2011 Annexure 3: 2010 kcal, 40.4g protein (body wt 35.0 kg). CONFLICT on protein: DGI_2024 value used.",
  },

  {
    label: "Girls — 13 to 15 years",
    ageMin: 13,
    ageMax: 15,
    gender: "female" as const,
    activityLevel: "any" as const,
    referenceBodyWeightKg: 49.8,
    dailyCaloriesKcal: 2410,
    dailyProteinG: 81,
    source: "BOTH" as const,
    notes: "DGI_2024 Table 1.6 Page 10: ~2410 kcal, 81g protein (body wt 49.8 kg). NIN_2011 Annexure 3: 2330 kcal, 51.9g protein (body wt 46.6 kg). CONFLICT on protein: DGI_2024 value used.",
  },

  {
    label: "Girls — 16 to 18 years",
    ageMin: 16,
    ageMax: 18,
    gender: "female" as const,
    activityLevel: "any" as const,
    referenceBodyWeightKg: 55.7,
    dailyCaloriesKcal: 2490,
    dailyProteinG: 85,
    source: "BOTH" as const,
    notes: "DGI_2024 Table 1.6 Page 10: ~2490 kcal, 85g protein (body wt 55.7 kg). NIN_2011 Annexure 3: Girls 16–17 yrs: 2440 kcal, 55.5g protein (body wt 52.1 kg). CONFLICT: DGI_2024 used.",
  },

  // ─── ADULT MEN ─────────────────────────────────────────────────────────────
  // DGI_2024 Table 1.6 gives sedentary and moderate rows for adult men (65 kg).
  // NIN_2011 Annexure 3 gives three activity levels for men (60 kg reference).
  // Heavy work row: NIN_2011 value used (DGI_2024 does not list it separately).

  {
    label: "Adult Man — Sedentary",
    ageMin: 18,
    ageMax: 59,
    gender: "male" as const,
    activityLevel: "sedentary" as const,
    referenceBodyWeightKg: 65,    // DGI_2024 Table 1.6 Page 10
    dailyCaloriesKcal: 2080,
    dailyProteinG: 72,
    source: "DGI_2024" as const,
    notes: "DGI_2024 Table 1.6 Page 10. NIN_2011 gives 2320 kcal (60 kg ref wt). CONFLICT: DGI_2024 used.",
  },

  {
    label: "Adult Man — Moderate",
    ageMin: 18,
    ageMax: 59,
    gender: "male" as const,
    activityLevel: "moderate" as const,
    referenceBodyWeightKg: 65,    // DGI_2024 Table 1.6 Page 10
    dailyCaloriesKcal: 2680,
    dailyProteinG: 90,
    source: "DGI_2024" as const,
    notes: "DGI_2024 Table 1.6 Page 10. NIN_2011 gives 2730 kcal, 60g protein (60 kg). CONFLICT: DGI_2024 used.",
  },

  {
    label: "Adult Man — Heavy",
    ageMin: 18,
    ageMax: 59,
    gender: "male" as const,
    activityLevel: "heavy" as const,
    referenceBodyWeightKg: 60,    // NIN_2011 reference body weight
    dailyCaloriesKcal: 3490,
    dailyProteinG: 60,            // NIN_2011 does not differentiate protein by
                                  // activity level for men — same 60g across all.
    source: "NIN_2011" as const,
    notes: "DGI_2024 Table 1.6 does not list a heavy-work row for adult men. Values from NIN_2011 Annexure 3 Page 88. Protein (60g) is the NIN_2011 value for men regardless of activity level.",
  },

  // ─── ADULT WOMEN ───────────────────────────────────────────────────────────

  {
    label: "Adult Woman — Sedentary",
    ageMin: 18,
    ageMax: 59,
    gender: "female" as const,
    activityLevel: "sedentary" as const,
    referenceBodyWeightKg: 55,    // DGI_2024 Table 1.6 Page 10
    dailyCaloriesKcal: 1660,
    dailyProteinG: 57,
    source: "DGI_2024" as const,
    notes: "DGI_2024 Table 1.6 Page 10. NIN_2011 gives 1900 kcal (55 kg). CONFLICT: DGI_2024 used.",
  },

  {
    label: "Adult Woman — Moderate",
    ageMin: 18,
    ageMax: 59,
    gender: "female" as const,
    activityLevel: "moderate" as const,
    referenceBodyWeightKg: 55,    // DGI_2024 Table 1.6 Page 10
    dailyCaloriesKcal: 2125,
    dailyProteinG: 72,
    source: "DGI_2024" as const,
    notes: "DGI_2024 Table 1.6 Page 10. NIN_2011 gives 2230 kcal, 55g protein (55 kg). CONFLICT: DGI_2024 used.",
  },

  {
    label: "Adult Woman — Heavy",
    ageMin: 18,
    ageMax: 59,
    gender: "female" as const,
    activityLevel: "heavy" as const,
    referenceBodyWeightKg: 55,    // NIN_2011 reference body weight
    dailyCaloriesKcal: 2850,
    dailyProteinG: 55,            // NIN_2011 protein is same across activity levels.
    source: "NIN_2011" as const,
    notes: "DGI_2024 Table 1.6 does not list a heavy-work row for adult women. Values from NIN_2011 Annexure 3 Page 88.",
  },

  // ─── PREGNANT WOMEN ────────────────────────────────────────────────────────
  // DGI_2024 Table 1.6 gives a single "Pregnant women" row with no trimester split
  // for the food-group table; additional kcal/protein by trimester stated separately
  // in the Guideline 2 narrative (Page 14). See Section 14 for trimester breakdown.

  {
    label: "Pregnant Woman — 2nd & 3rd Trimester (balanced diet total)",
    ageMin: 18,
    ageMax: 45,
    gender: "female" as const,
    activityLevel: "sedentary" as const,
    referenceBodyWeightKg: 65,    // 55 kg pre-pregnancy + 10 kg gain
    dailyCaloriesKcal: 2020,
    dailyProteinG: 72,
    source: "DGI_2024" as const,
    notes: "DGI_2024 Table 1.6 Page 10. Body weight shown as '55+10'. Represents total diet for sedentary pregnant woman during 2nd–3rd trimester. NIN_2011 Annexure 3 shows +350 kcal, +23g protein above baseline; DGI_2024 total used here.",
  },

  // ─── LACTATING WOMEN ───────────────────────────────────────────────────────

  {
    label: "Lactating Woman — 0 to 6 months postpartum (balanced diet total)",
    ageMin: 18,
    ageMax: 45,
    gender: "female" as const,
    activityLevel: "any" as const,
    referenceBodyWeightKg: null,  // not specified separately in Table 1.6 row
    dailyCaloriesKcal: 2245,
    dailyProteinG: 77,
    source: "DGI_2024" as const,
    notes: "DGI_2024 Table 1.6 Page 10. Represents total balanced diet. Narrative (Page 14) states an ADDITIONAL 600 kcal and 13.6g protein are required above the woman's own baseline during 0–6 months lactation. NIN_2011: +600 kcal, +19g protein. CONFLICT on additional protein: DGI_2024 (13.6g) used in Section 14.",
  },

  {
    label: "Lactating Woman — 7 to 12 months postpartum (balanced diet total)",
    ageMin: 18,
    ageMax: 45,
    gender: "female" as const,
    activityLevel: "any" as const,
    referenceBodyWeightKg: null,  // not specified separately in Table 1.6 row
    dailyCaloriesKcal: 2200,
    dailyProteinG: 78,
    source: "DGI_2024" as const,
    notes: "DGI_2024 Table 1.6 Page 10. Narrative (Page 14) states an ADDITIONAL 520 kcal and 10.6g protein are required above baseline. NIN_2011: +520 kcal, +13g protein. CONFLICT on additional protein: DGI_2024 (10.6g) used in Section 14.",
  },

  // ─── ELDERLY ───────────────────────────────────────────────────────────────

  {
    label: "Elderly Man — >60 years",
    ageMin: 60,
    ageMax: 120,
    gender: "male" as const,
    activityLevel: "sedentary" as const,
    referenceBodyWeightKg: null,  // not stated in DGI_2024 Table 1.6 for elderly
    dailyCaloriesKcal: 1740,
    dailyProteinG: 62,
    source: "DGI_2024" as const,
    notes: "DGI_2024 Table 1.6 Page 10. Activity sub-division not given; sedentary is the conservative assumption. NIN_2011 does not give a separate elderly row.",
  },

  {
    label: "Elderly Woman — >60 years",
    ageMin: 60,
    ageMax: 120,
    gender: "female" as const,
    activityLevel: "sedentary" as const,
    referenceBodyWeightKg: null,
    dailyCaloriesKcal: 1530,
    dailyProteinG: 56,
    source: "DGI_2024" as const,
    notes: "DGI_2024 Table 1.6 Page 10. Activity sub-division not given. NIN_2011 does not give a separate elderly row.",
  },

] as const;

// ═══════════════════════════════════════════════════════════════════════
// SECTION 2 — MACRONUTRIENT DISTRIBUTION TARGETS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Recommended macronutrient distribution as % of total daily energy.
 *
 * Sources:
 *   - DGI_2024, Page 7 (Table 1.2a/1.2b footnotes & narrative):
 *       "50%–55% of total calories from carbohydrates, 10%–15% from proteins
 *        and 20%–30% from fats"
 *   - DGI_2024, Page 7: "45% calories from cereals and millets… up to 15%
 *        calories from pulses, beans and meat"
 *   - DGI_2024, Table 1.2a footnote, Page 7:
 *       "Sugar should be less than 5% of the total energy per day."
 *   - DGI_2024, Table 1.6 footnote, Page 11:
 *       "Sugar should be less than 5% of the total energy per day."
 *       "No added sugar for children <2 years old."
 *       "20% to 30% of Cereals (weight in raw) should be from millets for adults."
 *       "20% of cereals (raw weight) should be from millets for children up to 10 years."
 *   - DGI_2024, Page 11: "around 30% energy from total fats and ~15% from protein"
 *   - DGI_2024, Page 14 (Guideline 2 narrative):
 *       "fibre (around 25g/1000 Kcal) like whole grain cereals, pulses and vegetables"
 *   - DGI_2024, Page 58 (Guideline 8 narrative):
 *       "P:E ratio should be ideally 10% to 15%; that is, 10% to 15% energy
 *        should be from proteins"
 *   - DGI_2024, Page 4 (Guideline overview):
 *       "cereals and millets…limited to 45% of total energy; pulses around
 *        14% to 15%; total fat…less than or equal to 30%"
 *   - NIN_2011: consistent with DGI_2024 on fat (≤30%) and carbs; no conflict.
 */
export const ICMR_MACRO_TARGETS = {

  // ─ Carbohydrates ───────────────────────────────────────────────────────────
  carbsPercentMin: 50,    // DGI_2024 Page 7: "50%–55% of total calories"
  carbsPercentMax: 55,    // DGI_2024 Page 7

  // Cereal+millets contribution to total energy (subset of carbs target)
  cerealMilletsPercentOfEnergy: 45,
  // "45% calories (energy) from cereals and millets" — DGI_2024 Page 7

  // Pulses+beans+meat contribution to total energy
  pulsesMeatPercentOfEnergyMax: 15,
  // "up to 15% calories from pulses, beans and meat" — DGI_2024 Page 7

  // ─ Proteins ────────────────────────────────────────────────────────────────
  proteinPercentMin: 10,  // DGI_2024 Pages 7 & 58: "10%–15% from proteins"
  proteinPercentMax: 15,  // DGI_2024 Pages 7 & 58

  // EAR and RDA for protein (absolute g/kg/day) — from Guideline 8, DGI_2024 Page 57
  proteinEAR_gPerKgPerDay: 0.66,
  proteinRDA_gPerKgPerDay: 0.83,
  // "EAR of 43g protein/day or RDA of 54g/day for a person weighing 65kg" — DGI_2024 Page 57

  // ─ Fats ────────────────────────────────────────────────────────────────────
  fatPercentMin: 20,      // DGI_2024 Page 7: "20%–30% from fats"
  fatPercentMax: 30,      // DGI_2024 Pages 7 & 11

  saturatedFatPercentMax: null,
  // NOT_IN_SOURCE: DGI_2024 does not give an explicit SF % target in these
  // tables. Guideline 7 (Page 4600 area) states "Use of SF is considered high
  // when more than 10g/day" but does not express this as % energy in a rule.

  addedFatEnergyThresholdPercentMax: 15,
  // "Threshold for fat has been calculated at ~15% energy from added fat"
  // — DGI_2024 Page 4760 (HFSS classification section)

  // ─ Fibre ───────────────────────────────────────────────────────────────────
  fibreGPer1000KcalAdult: 25,
  // "fibre (around 25g/1000 Kcal)" — DGI_2024 Page 14 (Guideline 2 narrative)
  // Same figure repeated in Table 2.1 footnote. NIN_2011 Page 1039 consistent.
  fibreGPerDayAt2000Kcal: 50,    // derived: 25g × 2 = 50g at 2000 kcal/day

  // ─ Sugar ───────────────────────────────────────────────────────────────────
  maxAddedSugarPercentEnergy: 5,
  // "Sugar should be less than 5% of the total energy per day"
  // — DGI_2024 Table 1.6 footnote Page 11, Table 1.2a footnote Page 7,
  //   repeated in every sample menu plan.

  maxAddedSugarGPerDayAdult_lower: 20,
  maxAddedSugarGPerDayAdult_upper: 25,
  // "Avoiding sugar or restricting to 20g to 25g per day (adults)"
  // — DGI_2024 Page 4 (Guideline summaries)

  maxAddedSugarGPerDayAlternate_lower: 25,
  maxAddedSugarGPerDayAlternate_upper: 30,
  // "One may consume sugar, but it must be restricted to 25–30 grams per day"
  // — DGI_2024 Table 1.2a footnote Page 7 and sample menus.
  // NOTE: Two slightly different upper limits appear in DGI_2024 (25g vs 30g).
  //       Both are stated in the same document. See EXTRACTION_NOTES.

  noAddedSugarUnderAgeYears: 2,
  // "No added sugar for children <2 years old" — DGI_2024 Table 1.6 footnote Page 11
  // Consistent with NIN_2011 Page 1664: "sugar-sweetened beverages should be avoided"
  // and Page 1677: "recommended to avoid sugar and reduce salt intake".

  addedSugarHFSSThresholdPer100gSolid: 3,
  // "Added sugar: <3g (<5% energy)" per 100g cooked food — DGI_2024 Page 4808
  // (HFSS classification table)

  // ─ Cereal:Pulse ratio ──────────────────────────────────────────────────────
  cerealPulseRatioOptions: ["3:1"],
  // "appropriate combination of cereals with pulses in the ratio of 3:1 (raw food weight)"
  // — DGI_2024 Guideline 8 Page 57-58. Also mentioned in Guideline 2 Page 14.
  // NIN_2011 does not specify a numeric ratio but endorses the combination.

  // ─ Millets ─────────────────────────────────────────────────────────────────
  milletPercentOfCerealsAdult_min: 20,
  milletPercentOfCerealsAdult_max: 30,
  // "20% to 30% of Cereals (weight in raw) should be from millets for adults"
  // — DGI_2024 Table 1.6 footnote Page 11

  milletPercentOfCerealsChildren: 20,
  // "20% of cereals (raw weight) should be from millets for children up to 10 years"
  // — DGI_2024 Table 1.6 footnote Page 11

  // ─ Food group energy targets (from Table 1.2a, 2000 kcal vegetarian) ──────
  cerealEnergyPercent_veg: 42,      // DGI_2024 Table 1.2a Page 7
  pulseEnergyPercent_veg: 14,       // DGI_2024 Table 1.2a Page 7
  milkCurdEnergyPercent_veg: 11,    // DGI_2024 Table 1.2a Page 7
  vegetablesFruitEnergyPercent_veg: 12,  // 9% veg + 3% fruit — DGI_2024 Table 1.2a
  nutsSeedsEnergyPercent_veg: 9,    // DGI_2024 Table 1.2a Page 7
  fatsOilsEnergyPercent_veg: 12,    // DGI_2024 Table 1.2a Page 7

  source: "DGI_2024 Pages 7, 11, 14, 57–58; NIN_2011 Pages 88–89, 1039",

} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 3 — SALT AND SODIUM LIMITS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Quantitative salt and sodium rules.
 * Source: Guideline 11, DGI_2024, Pages 73–76.
 * Cross-reference: NIN_2011, Pages 2455–2476 (Guideline 10: "Restrict salt
 * intake to minimum"); NIN_2011 Page 1041 (pregnancy exception).
 */
export const ICMR_SODIUM_RULES = {

  // ─ Intake limits ───────────────────────────────────────────────────────────
  maxSaltGPerDay: 5,
  // "Restrict the intake of added salt (sodium chloride) to a maximum of 5g per day"
  // — DGI_2024 POINTS TO REGISTER, Page 76.
  // "The current Indian as well as WHO recommendation for sodium intake is
  //  2300mg per day, which translates to around 5000mg or 5g (1 teaspoon) of
  //  common salt per day." — DGI_2024 Page 73–74.
  // Consistent with NIN_2011 Page 2466.

  equivalentSodiumMgPerDay: 2000,
  // "equivalent to 2g of sodium" (i.e., 2000 mg) — DGI_2024 Page 73.
  // NOTE: DGI_2024 also states "2300mg per day" on same page — the 2300mg
  // figure is the WHO/ICMR recommendation; 2000mg is the arithmetic conversion
  // of 5g NaCl (NaCl is 40% sodium = 2g). See EXTRACTION_NOTES.

  equivalentSodiumMgPerDayWHO: 2300,
  // "The current Indian as well as WHO recommendation for sodium intake is
  //  2300mg per day" — DGI_2024 Page 73–74.

  // ─ Indian population intake data ───────────────────────────────────────────
  indianAverageConsumptionGMin: 3,
  indianAverageConsumptionGMax: 10,
  // "consumption of salt ranges from 3g to 10g/day in different states"
  // — DGI_2024 Guideline 11 rationale panel, Page 73.

  percentPopulationAbove5gPerDay: 45,
  // "about 45% of population consuming more than 5g/day"
  // — DGI_2024 Guideline 11 rationale panel, Page 73.

  // ─ Potassium targets ───────────────────────────────────────────────────────
  potassiumTargetMgPerDay: 3800,
  // "the potassium requirement would be around 3800mg per day"
  // — DGI_2024 Page 73–74.

  vegetableIntakeForPotassiumGPerDay: 400,
  // "consuming recommended level of vegetables (400g)… will lower the Na:K ratio"
  // — DGI_2024 Page 73–74.

  fruitIntakeForPotassiumGPerDay: 100,
  // "and fruits (100g) per day" — DGI_2024 Page 73–74.

  habitudinalDietSodiumMgFromFoodSources: 400,
  // "Habitual diets provide about 300–400mg of sodium per day [from food alone]"
  // — DGI_2024 Guideline 11 Page 73. Upper bound used.

  // ─ Clinical conditions ─────────────────────────────────────────────────────
  hypertensionSaltLimitGPerDay: 5,
  // DGI_2024 does not specify a lower limit specifically for hypertension patients.
  // The 5g/day maximum applies to all adults. The document states:
  // "Prevalence of hypertension is low in populations consuming less than 3g/day"
  // — DGI_2024 Page 74. No separate clinical cutoff stated.
  hypertensionLowRiskSaltGPerDay: 3,
  // "Prevalence of hypertension is low in populations consuming less than 3g
  //  salt per day" — DGI_2024 Page 74.

  pregnancySaltRestrictionNote: "Salt intake should not be restricted even to prevent pregnancy-induced hypertension",
  // — NIN_2011 Page 1041. DGI_2024 does not make this statement explicitly.

  // ─ High-sodium foods to avoid ──────────────────────────────────────────────
  highSodiumFoodsToAvoid: [
    "Snack foods",
    "Savouries",
    "Soups (packaged/processed)",
    "Sauces",
    "Ketchup",
    "Salted butter",
    "Cheese",
    "Canned foods",
    "Papads",
    "Salted dry fish",
    "Salted nuts / dry fruits",
    "Preserved meats / vegetables",
    "Ready-to-eat foods",
    "Baking soda (sodium bicarbonate)",
    "Baking powder (sodium carbonate + sodium bicarbonate)",
    "Monosodium glutamate (MSG)",
  ],
  // — DGI_2024 Guideline 11, Page 75: "Processed foods such as snack foods,
  //   savouries, soups, sauces, ketchup, salted butter, cheese, canned foods,
  //   papads, and salted dry fish, salted nuts/dry fruits contribute to higher
  //   intake of salt. Preserved meats/vegetables and ready-to-eat foods contain
  //   a lot of salt and sodium. Additives like baking soda (sodium bicarbonate),
  //   baking powder (mixture of sodium carbonate and sodium bicarbonate) and
  //   monosodium glutamate are other sources of sodium in processed foods."

  iodizedSaltRecommended: true,
  // "Use iodized salt" — DGI_2024 POINTS TO REGISTER Page 76, multiple menus.

  notes: "Salt composition: 40% sodium, 60% chloride (NaCl). Habitual diet contributes only 300–400mg Na/day from food; the remainder comes from cooking salt or processing. Sodium:potassium (Na:K) ratio is the key determinant of blood pressure outcomes, not sodium alone. Sources: Guideline 11, DGI_2024 Pages 73–76; NIN_2011 Guideline 10 Pages 2455–2476.",

  source: "Guideline 11, DGI_2024, Pages 73–76; NIN_2011 Pages 2455–2476",

} as const;


// ═══════════════════════════════════════════════════════════════════════
// SECTION 4 — IRON, ANAEMIA AND ABSORPTION RULES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Iron-related quantitative and qualitative rules.
 * Sources:
 *   - DGI_2024, Guideline 2 (Pages 14, 18–20): pregnancy/lactation iron rules
 *   - DGI_2024, Table 1.5 (Page 9): iron per 100g in food groups
 *   - NIN_2011, Annexure 3 (Page 88): iron RDA by group
 *   - NIN_2011, Pages 2455–2476: general mineral notes
 */
export const ICMR_IRON_RULES = {

  // ─ Typical dietary iron from plant foods ───────────────────────────────────
  plantFoodIronMgPerDay_typical: null,
  // NOT_IN_SOURCE: Neither document states a single typical figure for plant-diet
  // iron delivery. They note that bioavailability is poor from plant foods.

  // ─ RDA by group (from NIN_2011 Annexure 3, Page 88) ───────────────────────
  rdaByGroup: [
    { label: "Adult Man — Moderate",   ironMgPerDay: 17,  source: "NIN_2011 Annexure 3 Page 88" },
    { label: "Adult Woman",            ironMgPerDay: 21,  source: "NIN_2011 Annexure 3 Page 88" },
    { label: "Pregnant Woman",         ironMgPerDay: 35,  source: "NIN_2011 Annexure 3 Page 88" },
    { label: "Lactating 0–6 months",   ironMgPerDay: 21,  source: "NIN_2011 Annexure 3 Page 88" },
    { label: "Boys 10–12 yrs",         ironMgPerDay: 21,  source: "NIN_2011 Annexure 3 Page 88" },
    { label: "Girls 10–12 yrs",        ironMgPerDay: 27,  source: "NIN_2011 Annexure 3 Page 88" },
    { label: "Boys 13–15 yrs",         ironMgPerDay: 32,  source: "NIN_2011 Annexure 3 Page 88" },
    { label: "Girls 13–15 yrs",        ironMgPerDay: 27,  source: "NIN_2011 Annexure 3 Page 88" },
    { label: "Boys 16–17 yrs",         ironMgPerDay: 28,  source: "NIN_2011 Annexure 3 Page 88" },
    { label: "Girls 16–17 yrs",        ironMgPerDay: 26,  source: "NIN_2011 Annexure 3 Page 88" },
    { label: "Infants 0–6 months",     ironMgPerDay: 46,  source: "NIN_2011 Annexure 3 Page 88 — µg/kg/day (micrograms)" },
    // NOTE: NIN_2011 states "46 µg/kg/day" for infants 0–6 months — this is
    // MICROGRAMS per kg per day, not mg/day. See EXTRACTION_NOTES.
  ],
  // DGI_2024 does not publish a standalone RDA table for iron mg/day in its
  // main tables. NIN_2011 Annexure 3 is the source above.

  // ─ Iron content in food groups (Table 1.5, DGI_2024, Page 9) ──────────────
  ironInFoodGroupsPer100gRaw: {
    cereals:       2.73,   // mg — Table 1.5, DGI_2024 Page 9
    millets:       3.20,   // mg — Table 1.5, DGI_2024 Page 9
    pulses:        6.25,   // mg — Table 1.5, DGI_2024 Page 9
    GLVs:          8.07,   // mg — Table 1.5, DGI_2024 Page 9
    rootsTubers:   0.61,   // mg — Table 1.5, DGI_2024 Page 9
    vegetables:    0.95,   // mg — Table 1.5, DGI_2024 Page 9
    nuts:          6.58,   // mg — Table 1.5, DGI_2024 Page 9
    fruits:        0.59,   // mg — Table 1.5, DGI_2024 Page 9
    meatPoultry:   1.49,   // mg — Table 1.5, DGI_2024 Page 9
    fishSeaFoods:  2.16,   // mg — Table 1.5, DGI_2024 Page 9
    milk:          0.18,   // mg — Table 1.5, DGI_2024 Page 9
    egg:           1.43,   // mg — Table 1.5, DGI_2024 Page 9
    drySpices:    11.73,   // mg — Table 1.5, DGI_2024 Page 9
    milkProducts:  1.86,   // mg — Table 1.5, DGI_2024 Page 9
    dryFish:      12.08,   // mg — Table 1.5, DGI_2024 Page 9
    cookingOil:    0,      // mg — Table 1.5, DGI_2024 Page 9
    tableSugar:    0,      // mg — Table 1.5, DGI_2024 Page 9
  },

  // ─ Iron enhancers ──────────────────────────────────────────────────────────
  ironEnhancers: [
    {
      food: "Guava",
      mechanism: "Rich source of vitamin C which improves iron absorption from plant foods",
      notes: "Consume with meals. DGI_2024 Guideline 2 Page 14 & 18.",
    },
    {
      food: "Pineapple",
      mechanism: "Rich source of vitamin C which improves iron absorption from plant foods",
      notes: "DGI_2024 Page 18.",
    },
    {
      food: "Citrus fruits (lemon, orange)",
      mechanism: "Rich source of vitamin C which improves iron absorption from plant foods",
      notes: "DGI_2024 Page 18.",
    },
    {
      food: "Fermented foods (fermented grains/dals)",
      mechanism: "Fermentation improves bioavailability of iron from plant foods",
      notes: "DGI_2024 Page 14: 'Bioavailability of iron can be improved by using fermented and sprouted grains and foods rich in vitamin C.'",
    },
    {
      food: "Sprouted grains / seeds",
      mechanism: "Sprouting reduces phytates, improving iron bioavailability",
      notes: "DGI_2024 Page 14.",
    },
    {
      food: "Animal source foods (meat, fish, poultry, eggs)",
      mechanism: "Haem iron has higher bioavailability than non-haem iron; also enhances absorption of non-haem iron",
      notes: "DGI_2024 Page 18: 'Iron bio-availability is poor from plant foods but is good from flesh foods such as meat, fish and poultry products.'",
    },
  ],

  // ─ Iron inhibitors ─────────────────────────────────────────────────────────
  ironInhibitors: [
    {
      food: "Tea",
      mechanism: "Tannins in tea bind dietary iron and make it unavailable (forms insoluble iron-tannin complex)",
      minimumGapHours: null,
      // DGI_2024 Page 18 states: "Tea should be avoided before, during or soon
      // after a meal or while taking IFA supplements." No exact hour gap given.
      practicalRule: "Avoid tea before meals, during meals, and immediately after meals. Do not take tea with IFA supplements.",
      notes: "DGI_2024 Page 18. Gap duration not quantified in hours; 'soon after' is the stated limit.",
    },
    {
      food: "Milk",
      mechanism: "Good source of calcium but poor source of iron; calcium competes with iron absorption",
      minimumGapHours: null,
      practicalRule: "Milk is recommended for calcium but do not rely on it for iron. Acknowledged as poor iron source in DGI_2024 Page 14.",
      notes: "DGI_2024 Page 14: 'Milk is the best source of biologically available calcium but is a poor source of iron.' No timing gap specified.",
    },
  ],

  // ─ Iron-rich plant foods (as listed in documents) ──────────────────────────
  ironRichPlantFoods: [
    "Green leafy vegetables (GLVs)",
    "Pulses",
    "Dry fruits",
    "Beans",
  ],
  // DGI_2024 Page 18: "Plant food items such as green leafy vegetables, pulses
  // and dry fruits contain iron."
  // DGI_2024 Page 14: "beans, dry fruits, eggs and flesh foods are good sources of iron."

  // ─ Iron-rich animal foods ──────────────────────────────────────────────────
  ironRichAnimalFoods: [
    "Meat",
    "Fish",
    "Poultry products",
    "Eggs",
  ],
  // DGI_2024 Page 18: "iron bio-availability…is good from flesh foods such as
  // meat, fish and poultry products."
  // DGI_2024 Page 14: "beans, dry fruits, eggs and flesh foods are good sources of iron."

  // ─ Supplement recommendations ──────────────────────────────────────────────
  supplementRecommendations: [
    {
      context: "Pregnancy (from 12th week through first 6 months of lactation)",
      elementalIronMg: 60,
      folicAcidMg: 0.5,
      durationDays: null,
      // "Iron, folic acid supplementation comprising 60mg elemental iron, 0.5mg
      //  folic acid is recommended from the 12th week of pregnancy onwards up to
      //  the first six months of lactation." — DGI_2024 Page 18.
      startWeekOfPregnancy: 12,
      source: "DGI_2024 Guideline 2, Page 18",
    },
    {
      context: "First trimester (weeks 1–12) — folic acid only",
      elementalIronMg: null,
      folicAcidMg: 0.5,
      // "Folic acid supplement (500µg or 0.5mg) is advised during the first
      //  trimester (first 12 weeks of pregnancy)." — DGI_2024 POINTS TO REGISTER Page 20.
      durationDays: null,
      source: "DGI_2024 Page 20",
    },
    {
      context: "Lactation (for anaemia prevention) — daily",
      elementalIronMg: null,
      // "Daily recommended dosage of iron for prevention of anemia is one IFA tablet"
      // — DGI_2024 Page 20. Iron content per IFA tablet not stated as a number
      //   separate from the 60mg figure above; one IFA tablet = 60mg elemental iron.
      folicAcidMg: 0.5,
      durationDays: null,
      source: "DGI_2024 Page 20",
    },
    {
      context: "General prevention of anaemia (all groups)",
      elementalIronMg: null,
      folicAcidMg: null,
      durationDays: null,
      // NIN_2011 and DGI_2024 do not give a standalone non-pregnancy
      // supplement dose for the general population beyond the diet guidance.
      source: "NOT_IN_SOURCE: No general population iron supplement dose given",
    },
  ],

  // ─ Key iron facts (qualitative) ────────────────────────────────────────────
  keyFacts: [
    "Iron is essential for synthesis of haemoglobin and prevention of anaemia.",
    "Iron is needed for brain development of fetus.",
    "Iron deficiency during pregnancy increases maternal mortality and may decrease birth weight.",
    "In children, iron deficiency increases susceptibility to infections and impairs learning ability.",
    "Iron bioavailability from plant foods is poor compared to animal foods (haem iron).",
    "Folic acid taken in the pre-pregnancy and first 28 days of pregnancy reduces risk of anaemia.",
    "Folic acid is essential for haemoglobin synthesis.",
    "Anaemia prevalence: 40.6% in children, 23.5% in adolescent girls, 28.4% in adult women (NNMB, cited in DGI_2024 Table II Page 5).",
  ],

  source: "DGI_2024 Guideline 2 Pages 14–20, Table 1.5 Page 9; NIN_2011 Annexure 3 Page 88",

} as const;


// ═══════════════════════════════════════════════════════════════════════
// EXTRACTION NOTES — PART 1 (Sections 1–4)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Conflicts, ambiguities, and gaps found during extraction of Sections 1–4.
 */
export const EXTRACTION_NOTES_PART1 = {

  conflictsBetweenDocuments: [
    "SECTION 1 — Children 1–3 yrs protein: DGI_2024 Table 1.6 gives 38g; NIN_2011 Annexure 3 gives 16.7g. DGI_2024 value used. Large discrepancy likely because DGI_2024 reports crude protein from a full diverse diet whereas NIN_2011 reports net protein requirement.",
    "SECTION 1 — Children 4–6 yrs protein: DGI_2024 gives 46g; NIN_2011 gives 20.1g. Same methodological difference as above. DGI_2024 used.",
    "SECTION 1 — Children 7–9 yrs protein: DGI_2024 gives 59g; NIN_2011 gives 29.5g. DGI_2024 used.",
    "SECTION 1 — Boys/Girls 10–12 yrs protein: DGI_2024 gives 76g (boys), 70g (girls); NIN_2011 gives 39.9g, 40.4g. DGI_2024 used.",
    "SECTION 1 — Adult Man sedentary calories: DGI_2024 gives ~2080 kcal (65 kg); NIN_2011 gives 2320 kcal (60 kg). Different reference body weights. DGI_2024 used.",
    "SECTION 1 — Adult Man moderate calories: DGI_2024 gives ~2680 kcal; NIN_2011 gives 2730 kcal. DGI_2024 used.",
    "SECTION 1 — Adult Woman sedentary calories: DGI_2024 gives ~1660 kcal; NIN_2011 gives 1900 kcal. DGI_2024 used.",
    "SECTION 1 — Pregnant woman additional protein: DGI_2024 Guideline 2 narrative states +8g (2nd trimester), +18g (3rd trimester); NIN_2011 states +23g flat. DGI_2024 values used in Section 14.",
    "SECTION 1 — Lactating 0–6 months additional protein: DGI_2024 narrative gives 13.6g additional; NIN_2011 gives +19g. DGI_2024 value used.",
    "SECTION 1 — Lactating 7–12 months additional protein: DGI_2024 gives 10.6g additional; NIN_2011 gives +13g. DGI_2024 value used.",
    "SECTION 3 — Sodium mg/day: DGI_2024 states '2300mg per day' (WHO/ICMR recommendation) AND '2000mg' (arithmetic conversion of 5g NaCl). Both figures appear on Pages 73–74. Both are recorded; 2000mg is the NaCl arithmetic result, 2300mg is the stated recommendation.",
    "SECTION 3 — Added sugar upper limit: DGI_2024 states '20g to 25g per day' in one place (Page 4) and '25–30 grams per day' in Table 1.2a footnote and sample menus. Both ranges recorded. The lower range (20–25g) appears in the Guideline summary bullets; the higher range (25–30g) appears in the My Plate footnotes.",
  ],

  valuesNotFound: [
    "SECTION 1 — PAL (Physical Activity Level) multiplier values (e.g., 1.4, 1.75, 2.0) — not found as explicit numbers in either document (captured in Section 7).",
    "SECTION 1 — Infant 0–6 months absolute daily calorie figure — DGI_2024 Table 1.6 states 'Exclusive breastfeeding' only. Per-kg figure from NIN_2011 used.",
    "SECTION 1 — Infant 7–12 months total daily calorie figure in absolute terms — DGI_2024 Table 1.6 gives food quantities only. NIN_2011 per-kg figure used.",
    "SECTION 2 — Saturated fat % of total energy limit — not stated as a clear % in either document's main recommendation tables. A '10g/day' threshold for high SF appears in DGI_2024 HFSS section but is not expressed as % energy.",
    "SECTION 4 — Tea inhibition gap in hours — DGI_2024 states 'before, during, or soon after a meal' without specifying hours.",
    "SECTION 4 — Infant iron RDA in mg/day — NIN_2011 gives 46 µg/kg/day (micrograms) for 0–6 months; absolute mg/day value requires body weight multiplication.",
    "SECTION 4 — General population iron supplement dose for non-pregnant, non-lactating adults — not provided in either document.",
  ],

  ambiguousValues: [
    "SECTION 1 — 'Children' rows in DGI_2024 Table 1.6 (1–9 yrs) are labelled 'both' gender; from 10 yrs onwards Boys and Girls are separate.",
    "SECTION 1 — DGI_2024 Table 1.6 footnote states '1 to 3 yrs means 1+ to 3 yrs 11 months; 4 to 5 yrs means 4+ to 5 year 11 months' — this wording appears inconsistent (says 4–5 but the row header says 4–6); source text used verbatim.",
    "SECTION 1 — Elderly row in Table 1.6: body weight not stated for elderly group. Recorded as null.",
    "SECTION 1 — Protein figures in DGI_2024 Table 1.6 are 'crude protein obtained from these food groups' — not net protein requirement. NIN_2011 gives net protein (requirement), explaining the large discrepancy. Users should use Section 2 g/kg/day EAR/RDA figures for requirement calculations.",
    "SECTION 2 — Cereal energy contribution: DGI_2024 states '45% calories from cereals and millets' in the narrative (Page 7) and Table 1.2a shows 42% in the actual computed table. Both are preserved; narrative value (45%) is the guideline target; 42% is the computed value for the specific food plan.",
    "SECTION 3 — '45% of population consuming more than 5g/day' — this figure appears in DGI_2024 without a named study reference; it is stated in the rationale panel.",
  ],

  tablesPartiallyExtracted: [
    "SECTION 1 — NIN_2011 RDA table does not have a 'sedentary' and 'heavy' row for all age groups — only adult men and women are split by activity level.",
    "SECTION 4 — Iron inhibitor list is short in both documents; only tea and milk are named. Other known inhibitors (phytates, calcium supplements) are not separately listed as food-specific rules in these documents.",
  ],

} as const;
