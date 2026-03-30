# ParivarSehat AI / NutriNext — Test Report

**Date**: 2026-03-30
**Total Tests**: 61
**Passed**: 58
**Skipped**: 3 (AI-dependent — Gemini API key unavailable)
**Failed**: 0
**Duration**: ~5.2s

---

## Test Suite Summary

### 1. ICMR-NIN Nutrient Targets (Unit) — 11/11 PASSED
| Test | Status |
|------|--------|
| Adult male sedentary gets ~2000-2400 kcal | PASS |
| Adult female sedentary gets ~1600-2000 kcal | PASS |
| Very active male gets more calories than sedentary | PASS |
| Woman has higher iron requirement than man | PASS |
| Child age 8 has lower calories than adult | PASS |
| Returns protein, carbs, fat, iron, calcium | PASS |
| Macros add up to approximately 100% of calories | PASS |
| Diabetes condition reduces carbs and increases fiber | PASS |
| Obesity condition reduces calories | PASS |
| Senior male gets appropriate calories (1800-2200) | PASS |
| Toddler gets appropriate low calories | PASS |

### 2. Database Connection & Schema (Unit) — 12/12 PASSED
| Test | Status |
|------|--------|
| Connects successfully | PASS |
| pgvector extension is enabled | PASS |
| All 16 required tables exist | PASS |
| Recipes table has embedding column | PASS |
| knowledge_chunks table has embedding column | PASS |
| Recipes table has 12,700+ records | PASS |
| knowledge_chunks table exists and is queryable | PASS |
| icmr_nin_rda table has data | PASS |
| Can insert and retrieve a test family | PASS |
| Can insert and retrieve a family member | PASS |
| Foreign key constraint enforced | PASS |
| Embedding vector dimension check | PASS |

### 3. Embedding Queue Status (Unit) — 3/3 PASSED
| Test | Status |
|------|--------|
| Queue status available via healthz | PASS |
| Recipes count is available (>12,000) | PASS |
| Embedded recipes count is a valid number | PASS |

### 4. API Endpoints & Security (Integration) — 24/24 PASSED
| Test | Status |
|------|--------|
| GET /api/healthz returns ok | PASS |
| healthz includes recipe count | PASS |
| healthz includes knowledge chunks | PASS |
| healthz includes embedding queue status | PASS |
| GET /api/auth/me returns 401 when not logged in | PASS |
| POST /api/auth/login with invalid creds returns error | PASS |
| POST /api/demo/quick-login returns a token | PASS |
| POST /api/families without auth returns 401 | PASS |
| GET /api/families without auth returns 401 | PASS |
| GET /api/families with auth returns 200 | PASS |
| GET /api/recipes returns results | PASS |
| GET /api/recipes filters by diet | PASS |
| GET /api/recipes search works | PASS |
| GET /api/recipes/:id returns a recipe | PASS |
| GET /api/recipes/:id 404 for non-existent | PASS |
| 7 auth-protected routes return 401 without auth | PASS |
| SQL injection in search — tables intact | PASS |
| XSS in recipe search is sanitised | PASS |

### 5. AI-Dependent Features (Integration) — 8/11 (8 PASSED, 3 SKIPPED)
| Test | Status | Note |
|------|--------|------|
| healthz reports knowledge chunk count field | PASS | |
| healthz reports embedding queue info | PASS | |
| embedded recipes count is zero when AI unavailable | PASS | |
| POST /api/meal-plans/generate requires auth | PASS | |
| GET /api/conversations requires auth | PASS | |
| POST /api/conversations requires auth | PASS | |
| POST /api/meal-plans/generate rejects invalid familyId | PASS | |
| recipes include calorie and protein fields | PASS | |
| knowledge chunks should be ingested when AI available | SKIPPED | Gemini API key unavailable |
| GET /api/conversations with auth returns array | SKIPPED | Gemini API key unavailable |
| embedded recipes count should be positive when AI available | SKIPPED | Gemini API key unavailable |

---

## E2E UI Testing

Visual verification via screenshot confirms:
- Login page renders correctly with email/password fields
- "Try with Demo Family (60 seconds)" button visible
- Sidebar navigation visible (Home, Meals, Grocery, Health, Profile, Recipes, AI Chat)
- "Sign up free" link present
- "Powered by Gemini AI & ICMR-NIN 2024" branding shown

Automated Playwright E2E blocked by Replit proxy 504 errors (known environment limitation).

---

## Known Limitations

1. **Gemini API key invalid/revoked** — AI features (meal plan generation, chat, RAG, embeddings) are non-functional. Knowledge chunks = 0, embedded recipes = 0. 3 tests properly skipped via `it.skipIf()`.
2. **Replit proxy 504** — External URL returns 504; localhost works fine. Playwright E2E tests blocked by this.

## Database Schema Verified (16 tables)
`users`, `families`, `family_members`, `recipes`, `meal_plans`, `meal_feedback`, `nutrition_logs`, `grocery_lists`, `health_logs`, `conversations`, `messages`, `knowledge_chunks`, `icmr_nin_rda`, `leftover_items`, `pantry_items`, `food_gi_nutrition`

## Test Files
- `tests/unit/icmrNin.test.ts` — ICMR-NIN nutrient target calculations
- `tests/unit/database.test.ts` — Database connection, schema, CRUD
- `tests/unit/embeddingQueue.test.ts` — Embedding queue health reporting
- `tests/integration/api.test.ts` — API endpoints, auth, security
- `tests/integration/aiFeatures.test.ts` — AI-dependent features (proper skip when unavailable)

## Run Command
```bash
cd Family-Nutrition-Planner && npx vitest run tests/
```
