# ParivarSehat AI Engine — Test Report

**Date**: 2026-04-03
**Framework**: Vitest 3.2.4
**Total Tests**: 114 passed / 114 total
**Test Files**: 6 passed / 6 total
**Duration**: ~2.89s

---

## Summary

| File | Tests | Status |
|------|-------|--------|
| tests/unit/calorieCalculator.test.ts | 30 | PASS |
| tests/unit/budgetEngine.test.ts | 17 | PASS |
| tests/unit/medicationRules.test.ts | 21 | PASS |
| tests/unit/harmonyScore.test.ts | 19 | PASS |
| tests/unit/conflictEngine.test.ts | 20 | PASS |
| tests/integration/fullPipeline.test.ts | 7 | PASS |

---

## Module Coverage

### 1. Calorie Calculator (`calorie-calculator.ts`) — 30 tests
- `applyAutoAssignmentRules`: Age-based goal overrides for infants (<5), school-age (5-12), teens (13-17), seniors (60+)
- `calculateDailyCalorieTarget`: ICMR paediatric tables for children, Mifflin-St Jeor for adults
- Weight loss deficit calculations (slow: -275, moderate: -550), 1200 kcal floor
- Build muscle surplus (+300), senior nutrition (-10%)
- `buildFastingPreloadInstructions`: Fasting day preload generation
- Boundary conditions at age 13, 17, 18, 59, 60

### 2. Budget Engine (`budget-engine.ts`) — 17 tests
- `calculateBudgetSplit`: 40:50:10 staples:perishables:buffer split
- Meal weight distributions for 2_meals, 3_meals, 3_meals_snacks
- Eating out frequency adjustments (none, 1_to_2_times, frequently)
- Regional price suggestions (Bokaro = 7260, Delhi > Jharkhand)
- `validateBudgetAdequacy`: Inadequate budget detection and adjustment
- `calculateRollingDailyLimit`: Mid-week budget recalculation

### 3. Medication Rules (`lib/medicationRules.ts`) — 21 tests
- `parseMedicationTiming`: Slot resolution (breakfast/lunch/dinner/night/empty_stomach)
- `matchMedicationRule`: Drug matching for Metformin, Iron, Levothyroxine, Warfarin, Amlodipine (+ Indian brands)
- `buildGuardrailStrings`: Prompt directive generation with solid food requirements, forbidden ingredients, weekly monitors
- `resolveAllMedicationGuardrails`: Full member processing with multi-drug support
- Unknown drug graceful degradation (returns bundle with drug_id "unknown")

### 4. Harmony Score (`lib/harmonyScore.ts`) — 19 tests
- `getScoreTier`: 4-tier system (Excellent >=90, Good >=75, Moderate >=60, Challenging <60)
- `HARMONY_SCORE_TIERS`: Tier metadata (emoji, color, min score)
- `buildHarmonyScoreCard`: Score card assembly with deductions, additions, conflict cards, medication bonus

### 5. Conflict Engine (`conflict-engine.ts`) — 20 tests
- Effective profile building: weight override, fasting merge, medication attachment, age flags
- Level 1 (Allergy): Peanut allergy detection, dairy allergy in veg family
- Level 2 (Religious): Jain dietary rules reflection
- Level 4 (Clinical): Diabetes/hypertension health condition propagation, medication bundle generation
- Pantry zero-waste: Perishable filtering, non-perishable exclusion
- Harmony score: Range validation, base = 100, pantry additions

### 6. Full Pipeline Integration — 7 tests
- End-to-end constraint packet assembly without AI
- Budget + conflict engine integration
- ConstraintPacket schema validation (all required keys present)
- Medication bundle non-empty directive validation
- Non-veg day map correctness for strictly-veg family
- Single-member family edge case
- Empty member weekly contexts edge case

---

## Adaptations from Test Document

The following adaptations were made to align the test document with the actual source code:

1. **Framework**: Test document specified Jest; actual project uses Vitest (ESM-native, already installed)
2. **`runConflictEngine` signature**: Takes `{ family, members, memberWeeklyContexts, weeklyContext, budget }` object (not positional args)
3. **`calculateDailyCalorieTarget` params**: Uses camelCase (`heightCm`, `weightKg`, `activityLevel`, `goalPace`), not snake_case
4. **`buildGuardrailStrings`**: Requires 4th parameter `userNotes: string` (passed as `""`)
5. **Unknown drugs**: Actual code returns 1 bundle with `drug_id: "unknown"` (test doc expected 0 bundles)
6. **Harmony tiers**: Actual code has 4 tiers (Excellent/Good/Moderate/Challenging), not 5 (no "Critical" tier)
7. **Skipped files**: `regionMapper.test.ts` and `recipeSelector.test.ts` skipped — no source files exist
8. **Source exports added**: `MEDICATION_RULES` (exported from medicationRules.ts), `getScoreTier` and `HARMONY_SCORE_TIERS` (exported from harmonyScore.ts)

---

## Scripts

```bash
pnpm --filter @workspace/api-server run test:engine          # All engine tests
pnpm --filter @workspace/api-server run test:engine:unit      # Unit tests only
pnpm --filter @workspace/api-server run test:engine:integration  # Integration tests only
```
