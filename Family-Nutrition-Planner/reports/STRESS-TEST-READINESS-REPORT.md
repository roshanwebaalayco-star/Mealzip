# COMPREHENSIVE STRESS TEST READINESS REPORT
## ParivarSehat AI / NutriNext — "One Base, Many Plates" Claim

**Date:** April 4, 2026  
**Scope:** Full audit of codebase against the 4-Phase, 16-Test stress test document  
**Methodology:** Static code analysis of all engine files, schema files, test suites, and supporting modules  

---

## EXECUTIVE SUMMARY

| Category | Weight | Tests | Likely Result | Score |
|---|---|---|---|---|
| Phase 1: Architecture Verification | 25% | 1.1–1.3 | **2.5 / 3** (Partial on 1.3) | ~21% |
| Phase 2: Edge Case Gauntlet | 30% | 2.1–2.5 | **3.5 / 5** | ~21% |
| Phase 3: Clinical Safety Audit | 30% | 3.1–3.3 | **1 / 3** (CRITICAL GAPS) | ~10% |
| Phase 4: Performance & Scale | 15% | 4.1–4.3 | **2 / 3** | ~10% |
| **OVERALL** | | | | **~62%** |

**Verdict: 50–69% — Proof of Concept, Not Ready for Real Users (without fixes)**

The deterministic engine is real and substantial (~3,500 lines of clinical logic), but three critical safety gaps — no Type 1 diabetes distinction, no pregnancy handling, and no CKD staging — prevent a passing grade on the mandatory Clinical Safety Audit (Phase 3). Fixing these specific gaps would likely raise the score to 75–80%.

---

## PHASE 1: ARCHITECTURE VERIFICATION (25%)

### Test 1.1: Code Walkthrough — PASS ✅

**Evidence of Real Code:**

| Engine File | Lines of Code | Purpose |
|---|---|---|
| `one-many-plates.ts` | 904 | OBMP algorithm, plate modifiers, pull-before events, escalation |
| `conflict-engine.ts` | 899 | 6-level conflict detection and resolution |
| `medicationRules.ts` | 693 | 10 drug-nutrient interaction rulesets |
| `calorie-calculator.ts` | 357 | ICMR-NIN calorie/macro computation |
| `budget-engine.ts` | 335 | Regional budget splitting, validation |
| `harmonyScore.ts` | 355 | 100-point harmony scoring with tier system |
| **Total** | **3,543** | |

**Test Suite:**

| Test File | Test Cases |
|---|---|
| `calorieCalculator.test.ts` | 30 |
| `budgetEngine.test.ts` | 34 |
| `conflictEngine.test.ts` | 20 |
| `medicationRules.test.ts` | 21 |
| `harmonyScore.test.ts` | 19 |
| **Total** | **124** |

**Assessment:** The code is real — not vaporware. There is a proper deterministic engine separate from AI prompts. The test count of 124 exceeds the 50-test threshold mentioned in the stress test. The logic uses hardcoded clinical rules (a rule engine), not a constraint solver, which is appropriate for the domain.

**No Red Flags:**
- ✅ Code exists and is inspectable
- ✅ Deterministic engine exists separate from Gemini prompts
- ✅ 124 test cases across 5 test files (exceeds 50 threshold)

---

### Test 1.2: Constraint Packet Inspection — PASS ✅

**For the test family (Diabetic Papa, Jain Dadi, Anemic Kid, PCOS Mom):**

| Check | Status | Evidence |
|---|---|---|
| Grapefruit-Amlodipine interaction | ✅ CAUGHT | `medicationRules.ts` line 226–275: Amlodipine rule has explicit grapefruit zero-tolerance with CYP3A4 explanation |
| Diabetes vs. Kid high-calorie conflict | ✅ CAUGHT | `conflict-engine.ts` line 450–469: Explicit diabetes-vs-high-calorie conflict with resolution ("Low-GI base + calorie-dense sides on kid's plate") |
| Dadi lactose + calcium paradox | ⚠️ PARTIAL | Dairy allergy blocks dairy ingredients (line 282–310). Calcium supplement rule exists (line 315–345) with iron-calcium separation. However, no explicit "non-dairy calcium alternatives" recommendation for lactose-intolerant members on calcium supplements |
| Budget split for Delhi | ✅ CORRECT | `budget-engine.ts` line 8: Delhi baseline ₹14,850. Split: 40% Staples / 50% Perishables / 10% Buffer. Sum = 100% |
| Hard vs. soft conflict distinction | ✅ EXISTS | 6 priority levels: L1 Allergy (Critical) → L2 Religious → L3 Medication → L4 Clinical → L5 Goal → L6 Preference |

**ConstraintPacket JSON structure includes:**
- `effectiveProfiles[]` — per-member computed targets
- `conflicts[]` with `priority_level` (1–6)
- `resolutions[]` with `resolution_type`
- `medicationGuardrailBundles[]` — per-drug constraints
- `harmonyScore` with `deductions[]` and `additions[]`
- `budgetSplit` — staples/perishables/buffer

---

### Test 1.3: OBMP Algorithm Output — PARTIAL ⚠️

**What exists:**

The `oneManyPlates()` function produces the exact JSON structure requested:
```
{
  slot, base_dish_is_valid, parallel_dishes_needed,
  escalation_reason, escalation_solution,
  member_plates: [{
    member_name, modifications[], pull_before_step,
    pull_before_reason, pull_before_urgency,
    additives[], withheld[], modified[],
    macro_targets: { calories, protein_g, carbs_g, fat_g, sodium_mg_max },
    estimated_macros: { calories, proteinG, carbsG, fatG, sodiumMg },
    clinical_flags[], warning_flags[],
    harmony_deduction_points, harmony_deduction_reason
  }],
  pull_events[], harmony_deductions[],
  total_harmony_deduction, total_harmony_addition
}
```

**Modifier precision examples (clinical, not generic):**
- Diabetes: "Reduce rice to 100-150g (60% of standard portion). Prefer brown rice or substitute with jowar roti"
- Hypertension: "Use HALF the salt. Add lemon juice to compensate for flavour"
- Kidney: "Rajma portion restricted to max 50g, or substitute with moong dal"
- Anaemia: "Squeeze of lemon on plate (Vitamin C enhances iron absorption)"

**Jain onion/garlic handling:**
- ✅ CAUGHT: `one-many-plates.ts` line 355–368 explicitly detects `containsOnionGarlic` and generates "Pull portion BEFORE onion and garlic tempering step"

**Iron + Calcium absorption conflict for Kid:**
- ✅ CAUGHT: `medicationRules.ts` line 94–110: Iron supplement has explicit forbidden list including "milk, paneer, curd, calcium supplement" with 2-hour gap rule and Vitamin C positive requirement

**Determinism — important distinction:**
- ✅ The clinical safety layer (constraint generation, plate modifiers, pull-before events, medication timing, macro targets) IS fully deterministic. Same family inputs always produce the same ConstraintPacket, same modifier instructions, and same safety guardrails.
- ⚠️ The recipe/culinary selection layer is intentionally non-deterministic — Gemini chooses recipes within the deterministic constraints. This is by design: clinical safety is hardcoded, culinary creativity is AI-driven.
- The `buildModifierInjectionSection()` function explicitly tells Gemini: "These modifications were computed deterministically by the clinical engine. Do NOT change, omit, or add clinical modifications of your own."

**Verdict:** Architecture and safety modifiers are solid. The non-determinism exists only in recipe variety, not in clinical safety rules — which is an acceptable design choice.

---

## PHASE 2: EDGE CASE GAUNTLET (30%)

### Test 2.1: The Impossible Family — PASS ✅

**Conflict detection capabilities:**

| Conflict | Handled? | Evidence |
|---|---|---|
| Vegan vs. Keto (opposing macros) | ✅ | Goal conflict detection (line 508–533) flags weight-gain vs. weight-loss and high-calorie-spread members |
| CKD low-protein vs. bodybuilder high-protein | ✅ | `conflict-engine.ts` line 472–491: Explicit kidney-vs-muscle conflict with protein-restricted base dish |
| Nut allergy + soy allergy | ✅ | Both `peanuts` and `soy` allergen maps exist (line 33, 59) with comprehensive ingredient lists |
| Escalation to parallel dishes | ✅ | `one-many-plates.ts` line 252–271: When veg/non-veg conflict is unresolvable, sets `parallelDishesNeeded = 2` |

**Harmony score honesty:**
- System deducts 5 points for kidney-vs-muscle conflict
- Deducts 5 points for Jain-vs-NonVeg conflict
- Deducts 2 points for diabetic-vs-high-calorie conflict
- For this extreme family, expected score would be ~40–55 (in the "Challenging" tier, <60)
- Tier labels: ≥90 Excellent, ≥75 Good, ≥60 Moderate, <60 Challenging

**CKD protein limit enforcement:**
- `CONDITION_DIETARY_RULES.kidney_issues` (line 170–181): "Protein limit 0.6–0.8g/kg body weight/day"
- `one-many-plates.ts` line 447–463: Kidney member gets per-meal sodium cap of 400mg, high-potassium food warnings, and phosphorus restrictions

**Gap:** CKD staging is not differentiated (Stage 3 vs. Stage 4 vs. Stage 5 treated identically as "kidney_issues"). The protein limit is generic (0.6–0.8g/kg) rather than stage-specific.

---

### Test 2.2: The Medication Minefield — PASS ✅

**Drug-nutrient interaction coverage:**

| Drug | Rules Exist? | Key Constraints |
|---|---|---|
| Warfarin | ✅ | Vitamin K CONSISTENCY mandate (2–3 servings/week, not elimination). Weekly monitor with `keep_consistent` rule |
| Levothyroxine | ✅ | 30–60 min fasting before breakfast. No soy, dairy, coffee at breakfast. Day-wide soy ban. Goitrogen weekly cap of 2 meals |
| Iron supplement | ✅ | No dairy/tea within 2 hours. Vitamin C pairing required. Cross-slot conflict with calcium supplement (2hr gap) |
| Metformin | ✅ | Must have solid food (not just tea). Timing parsed from user input |

**Dadi's Levothyroxine timing:**
- ✅ EXPLICIT: "Take tablet on empty stomach with plain water at wake-up. Wait 30–60 minutes before eating ANY food."
- Scheduling note: "If the family's normal breakfast is 7:30 AM, this member eats at 8:00–8:30 AM."

**Kid's iron + Vitamin C pairing:**
- ✅ EXPLICIT: Positive requirement: "Vitamin C source — lemon juice, amla, raw tomato, orange"
- Clinical reason included: "Vitamin C converts Fe³⁺ to Fe²⁺, increasing absorption by up to 3x"

**Papa's Vitamin K avoidance (Warfarin):**
- ✅ NUANCED: Does NOT eliminate spinach — requires CONSISTENCY (2–3 servings/week). Clinically accurate approach.

**Medication timing in deterministic engine (not left to Gemini):**
- ✅ All timing rules are in `medicationRules.ts` and injected into the modifier section before Gemini sees the prompt

---

### Test 2.3: The Festival Override — PASS ✅

**Festival/Fasting infrastructure:**
- `festival-fasting.ts`: 170 lines covering Hindu (Ekadashi, Navratri, Shivratri, Sawan), Muslim (Ramadan 2026 with all 29 days), Jain, Sikh, and regional fasts
- Each entry has: `day`, `name`, `nameHindi`, `fastingType` (full/partial/none), `recommendedFoods[]`, `traditions[]`

**Navratri handling:**
- ✅ Chaitra Navratri entry exists (March 29) with fasting foods: "Sabudana Khichdi, Kuttu Roti, Singhara Atta, Fruits, Sendha Namak"
- `one-many-plates.ts` line 666–676: Fasting members get "only fasting-approved ingredients" while non-fasting children get "regular child-appropriate dinner"

**Diabetic + festival food (Modak/Sabudana):**
- ✅ `one-many-plates.ts` line 413–417: "Sabudana is HIGH GI (~70). Limit diabetic member's portion to max 100g. Consider kuttu roti as lower-GI substitute."
- Warning flag generated: "CRITICAL: Sabudana is HIGH GI (~70)"

**Harmony score adjustment for festivals:**
- ⚠️ PARTIAL: Fasting members trigger modifications and deductions, but there's no explicit "festival complexity" deduction in the harmony score. The system deducts for plate restrictions caused by fasting but doesn't label it as festival-specific.

---

### Test 2.4: The Budget Breaker — PARTIAL ⚠️

**Budget Engine capabilities:**

| Feature | Status | Evidence |
|---|---|---|
| Regional price baselines | ✅ | 40+ Indian cities/states. Indore: ₹10,200 baseline for family of 4 |
| Budget split (40/50/10) | ✅ | Staples 40%, Perishables 50%, Buffer 10% |
| Budget adequacy validation | ✅ | Warns if budget <65% of regional baseline. Warns if <80% |
| Eating-out frequency adjustment | ✅ | 1–2 times: 0.88x, frequently: 0.72x multiplier |
| Rolling budget recalculation | ✅ | `calculateRollingDailyLimit()` adjusts mid-week |

**For ₹5,000/month, family of 5, Indore:**
- Scaled baseline: (₹10,200 / 4) × 5 = ₹12,750
- Minimum viable (65%): ₹8,288
- ₹5,000 < ₹8,288 → System would flag: "Budget is critically low. Meals will be nutritionally compromised."

**Gap:**
- ⚠️ The budget engine calculates splits and validates adequacy, but does NOT generate actual price-verified grocery lists with per-item costs. It tells Gemini the budget constraints, but actual price verification of individual ingredients (eggs ₹X/dozen, dal ₹Y/kg) is left to the AI model.
- No local market price database for Tier-2 cities

---

### Test 2.5: The Leftover Loop — PASS ✅

**Leftover tracking infrastructure:**

| Component | Status | Evidence |
|---|---|---|
| Database table (`leftover_items`) | ✅ | Columns: `family_id`, `ingredient_name`, `quantity_estimate`, `logged_at`, `expires_at`, `used_up`. Indexed on `(family_id, expires_at)` |
| TTL / Expiry | ✅ | `expires_at` timestamp column. Default 48-hour window |
| Creative reuse chains | ✅ | `enrichPlanWithDbLeftoverChains()` creates 3-step sequence (dinner → next lunch → next breakfast) using ingredient-matching recipes |
| Harmony score bonus | ✅ | Zero-waste pantry items contribute bonus points to harmony score (visible in `harmonyScore.ts` zero_waste additions) |
| API endpoint | ✅ | `/api/leftovers` route for logging leftover items |

**Assessment:** Leftover intelligence is real and persisted in the database, not stateless.

---

## PHASE 3: CLINICAL SAFETY AUDIT (30%) — CRITICAL

### Test 3.1: Diabetes Hypoglycemia Risk — FAIL ❌

**Critical finding: NO Type 1 diabetes distinction exists.**

| Check | Status | Evidence |
|---|---|---|
| Type 1 vs. Type 2 distinction | ❌ MISSING | Searched entire engine codebase for "type_1", "type 1", "Type 1", "diabetes_type_1" — zero results. Only `diabetes_type_2` exists in `CONDITION_DIETARY_RULES` |
| Insulin-dependent logic | ❌ MISSING | No rules for insulin (Lantus, NovoRapid). Only Metformin rules exist |
| Hypoglycemia warning (<30g carbs) | ❌ MISSING | No minimum carb threshold enforcement for insulin users |
| Post-workout carb adjustment | ❌ MISSING | No exercise/activity-based carb modulation |

**Risk:** A Type 1 diabetic on insulin who receives a low-carb recommendation could experience dangerous hypoglycemia. The system currently applies Type 2 rules (low-GI, reduce carbs) to all diabetics, which is **clinically dangerous for Type 1**.

**Required fix:** Add `diabetes_type_1` condition with:
- Minimum carb floor (40–60g complex carbs per meal)
- Insulin timing rules (NovoRapid 15 min before meal)
- Post-workout carb boost logic
- Explicit warning if carbs drop below safe threshold

---

### Test 3.2: CKD Violation Check — PARTIAL ⚠️

**What exists:**

| Check | Status | Evidence |
|---|---|---|
| Protein restriction | ✅ | "Protein limit 0.6–0.8g/kg body weight/day" |
| High-potassium food awareness | ✅ | `HIGH_POTASSIUM_FOODS` list: rajma, banana, potato, sweet potato, tomato, spinach, palak, orange, coconut water, dates, raisins |
| High-phosphorus food awareness | ✅ | `HIGH_PHOSPHORUS_FOODS` list: rajma, paneer, cheese, cola, processed meat |
| Sodium control | ✅ | Per-meal cap of 400mg sodium for kidney members |
| Rajma-specific warning | ✅ | Explicit "KIDNEY CRITICAL: Rajma is HIGH in potassium and phosphorus" |

**Gaps:**

| Gap | Severity | Detail |
|---|---|---|
| No CKD staging | HIGH | Stage 3 (protein <50g) vs Stage 4 (protein <40g) vs Stage 5/dialysis (different rules entirely) — all treated as generic "kidney_issues" |
| No quantitative daily tracking | MEDIUM | Protein limit stated but not computed as a running daily total across meals. Each meal is evaluated independently |
| Dal phosphorus awareness | MEDIUM | General dals (moong, toor, masoor) are missing from `HIGH_PHOSPHORUS_FOODS` list despite having 200–300mg phosphorus/100g |
| Potassium/Phosphorus mg limits not enforced | HIGH | No daily mg caps (e.g., <2,000mg K, <800mg P). Only food avoidance lists, not quantitative tracking |

**Verdict:** The system would likely pass a casual audit but could fail a rigorous per-meal nutritional audit because it uses food avoidance lists rather than quantitative nutrient tracking.

---

### Test 3.3: Pregnancy + Anemia Interaction — FAIL ❌

**Critical finding: NO pregnancy handling exists.**

| Check | Status | Evidence |
|---|---|---|
| Pregnancy condition | ❌ MISSING | Searched entire engine for "pregnancy", "pregnant", "trimester" — zero results |
| Iron-calcium timing separation | ✅ EXISTS (generic) | `medicationRules.ts` iron-calcium cross-slot conflict exists. But not pregnancy-specific |
| Folate requirements | ❌ MISSING | No folate tracking (600 mcg/day for pregnancy) |
| Trimester-specific calorie adjustment | ❌ MISSING | No trimester awareness |
| Pregnancy-safe food rules | ❌ MISSING | No rules for avoiding raw papaya, excess pineapple, raw eggs, etc. |

**Risk:** A pregnant woman with anemia would receive standard adult meal plans without pregnancy-specific nutritional adjustments (increased iron, folate, calcium, protein targets). No iron-calcium timing separation would be applied unless she separately reports an "iron supplement" medication.

**Required fix:** Add `pregnancy` condition with trimester parameter, covering:
- Trimester-specific calorie adjustments (+300–450 kcal in 2nd/3rd)
- Iron target: 27mg/day (with Vitamin C pairing)
- Folate target: 600 mcg/day
- Calcium target: 1,000mg/day (timed 2+ hours from iron)
- Forbidden foods: raw papaya, excess pineapple, raw/undercooked eggs, unpasteurized dairy
- Protein target: 75g/day

---

## PHASE 4: PERFORMANCE & SCALE (15%)

### Test 4.1: API Latency — LIKELY PASS ✅

**Architecture supports acceptable latency:**
- Deterministic engine (Stages 2–4) runs in-memory with no external calls — estimated <500ms
- Gemini calls are the bottleneck. The system uses Gemini 2.5 Flash with `thinkingBudget: 0` for speed
- The prompt chain assembles a single mega-prompt rather than sequential conversational calls

**Estimated latency breakdown:**
| Stage | Estimated Time |
|---|---|
| Profile building + conflict detection | <200ms |
| OBMP modifier computation | <300ms |
| Budget + harmony score | <100ms |
| Gemini API call (single mega-prompt) | 10–20s |
| JSON parsing + DB write | <500ms |
| **Total estimated** | **12–22s** |

**Gap:** Gemini calls are NOT parallelized (single mega-prompt approach). This is actually reasonable for a single-call architecture but means there's no parallelization to optimize further.

**Verdict:** Likely p50 <20s, p95 <30s if Gemini latency is stable. Passes the target.

---

### Test 4.2: Cost Analysis — PARTIAL ⚠️

**Token optimization:**
- ✅ Single mega-prompt instead of 3 sequential calls reduces API costs
- ✅ `thinkingBudget: 0` reduces output tokens
- ✅ Using Gemini 2.5 Flash (cheaper than Pro/Ultra)

**Cost estimate (approximate):**
| Component | Estimate |
|---|---|
| Input tokens (mega-prompt ~8K tokens) | ~₹0.50 |
| Output tokens (~4K tokens for 7-day plan) | ~₹2.00 |
| Database writes (~15–20 rows per plan) | ~₹0.10 |
| **Total per plan** | **~₹2.60** |
| Monthly per family (4 plans) | ~₹10.40 |
| At ₹299/month subscription | ~96.5% gross margin |

**Gap:** No explicit caching strategy documented. Regenerating plans for similar profiles wastes tokens. A cache layer for identical constraint packets would reduce costs.

---

### Test 4.3: Database Schema — PASS ✅

**Schema quality:**

| Table | Status | Notes |
|---|---|---|
| `family_members` | ✅ | JSONB for health_conditions, allergies, fasting_config. Proper foreign keys |
| `meal_plans` | ✅ | JSONB for days, nutritional_summary, harmony_score_breakdown |
| `grocery_lists` | ✅ | JSONB items, total_estimated_cost, status tracking |
| `leftover_items` | ✅ | Indexed on `(family_id, expires_at)`. TTL via `expires_at` |
| `health_logs` | ✅ | Per-member daily logging with blood_sugar, blood_pressure, symptoms |
| `weekly_contexts` | ✅ | Per-family weekly input (fasting, medications, overrides) |

**Indexing:**
- ✅ `leftover_items`: Composite index on `(family_id, expires_at)` for efficient expiry queries
- ✅ Recipes table: GIN index with `ts_rank` for full-text search

**Gaps:**
- ⚠️ No explicit data retention policy (no auto-deletion of old plans)
- ⚠️ No documented backup strategy (relies on Supabase's default backups)
- ⚠️ JSONB for meal plan days means querying individual meals requires JSON path queries (works at moderate scale, struggles at very high scale)

---

## SUMMARY SCORECARD

| Test ID | Test Name | Status | Score |
|---|---|---|---|
| **1.1** | Code Walkthrough | ✅ PASS | 100% |
| **1.2** | Constraint Packet | ✅ PASS | 90% |
| **1.3** | OBMP Output | ⚠️ PARTIAL | 75% |
| **2.1** | Impossible Family | ✅ PASS | 85% |
| **2.2** | Medication Minefield | ✅ PASS | 90% |
| **2.3** | Festival Override | ✅ PASS | 85% |
| **2.4** | Budget Breaker | ⚠️ PARTIAL | 60% |
| **2.5** | Leftover Loop | ✅ PASS | 85% |
| **3.1** | Diabetes Hypoglycemia | ❌ FAIL | 0% |
| **3.2** | CKD Violation | ⚠️ PARTIAL | 55% |
| **3.3** | Pregnancy + Anemia | ❌ FAIL | 0% |
| **4.1** | API Latency | ✅ PASS | 80% |
| **4.2** | Cost Analysis | ⚠️ PARTIAL | 70% |
| **4.3** | Database Schema | ✅ PASS | 80% |

---

## WEIGHTED FINAL SCORE

| Phase | Weight | Phase Score | Weighted |
|---|---|---|---|
| Architecture (1.1–1.3) | 25% | 88% (2.65/3) | 22.1% |
| Edge Cases (2.1–2.5) | 30% | 81% (4.05/5) | 24.3% |
| Clinical Safety (3.1–3.3) | 30% | 18% (0.55/3) | 5.5% |
| Performance (4.1–4.3) | 15% | 77% (2.3/3) | 11.5% |
| **TOTAL** | | | **63.4%** |

---

## CRITICAL GAPS — MUST FIX BEFORE SHIPPING

### Gap 1: Type 1 Diabetes (SAFETY RISK)
- **Severity:** CRITICAL
- **Effort:** 2–3 days
- **What's needed:** New condition `diabetes_type_1` with insulin-specific rules, minimum carb floors, NovoRapid/Lantus timing, post-workout adjustments, hypoglycemia warnings

### Gap 2: Pregnancy Handling (SAFETY RISK)
- **Severity:** CRITICAL
- **Effort:** 3–4 days
- **What's needed:** New condition `pregnancy` with trimester parameter, elevated nutrient targets (iron 27mg, folate 600mcg, calcium 1000mg, protein 75g), iron-calcium timing enforcement, forbidden foods list

### Gap 3: CKD Staging (SAFETY RISK)
- **Severity:** HIGH
- **Effort:** 2 days
- **What's needed:** Replace generic `kidney_issues` with `ckd_stage_3`, `ckd_stage_4`, `ckd_stage_5_dialysis`. Stage-specific protein, potassium, phosphorus, and sodium limits. Add quantitative daily nutrient tracking.

### Gap 4: Deterministic Recipe Selection
- **Severity:** MEDIUM
- **Effort:** 5–7 days
- **What's needed:** Pre-filter recipe database deterministically before sending to Gemini. Ensure same constraint packet always yields same recipe set (with Gemini only formatting, not selecting).

### Gap 5: Day-Level Nutrient Enforcement
- **Severity:** MEDIUM
- **Effort:** 3–4 days
- **What's needed:** The OBMP engine already computes per-meal macro targets and estimates (calories, protein, carbs, fat, sodium, iron). What's missing is a post-generation longitudinal audit that sums daily totals across all three meals and validates them against member-specific daily limits (e.g., CKD patient's total daily protein <40g, not just per-meal estimates). Currently each meal is evaluated independently without cross-meal aggregation.

---

## WHAT'S GENUINELY STRONG

1. **Medication rules** — 10 drugs with pharmacologically accurate constraints (Warfarin consistency mandate, Amlodipine CYP3A4 explanation, iron-calcium cross-slot conflict). This is above-average for a nutrition app.

2. **Conflict engine architecture** — 6-priority-level system with deterministic resolution before AI sees the prompt. The "modify section injection" approach (clinical safety is hardcoded, creativity is AI-generated) is a sound design pattern.

3. **Indian-context specificity** — Jain root vegetable rules, sattvic no-onion/garlic rules, regional budget baselines for 40+ Indian cities, multi-faith fasting calendar (Hindu, Muslim, Jain, Sikh), Indian ingredient awareness (sendha namak, kuttu atta, sabudana).

4. **Harmony score transparency** — The scoring system is honest. It doesn't inflate scores for complex families. A "Challenging" label (<60) with itemized deductions is more trustworthy than an artificially high score.

5. **Pull-before events** — The cooking instruction model (pull Dadi's portion before onion/garlic tempering) is a practical, real-world mechanism that most nutrition apps don't even attempt.

---

## RECOMMENDATION

**Do not ship to real users until the three critical safety gaps (Type 1 diabetes, pregnancy, CKD staging) are addressed.** The architecture is solid and the design choices are sound — the gaps are in coverage, not in approach. Estimated effort to reach a passing grade: **7–10 days of focused engineering**.

After fixing these gaps, re-run the stress test. The expected score would be 75–82%, which places the system in the "Core logic works, needs polish on edge cases" tier — ready for a supervised beta launch with clinical review.
