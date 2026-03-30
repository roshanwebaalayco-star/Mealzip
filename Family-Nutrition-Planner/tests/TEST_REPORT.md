# ParivarSehat AI / NutriNext — Test Report

**Date**: 2026-03-30
**Total Tests**: 87
**Passed**: 87
**Skipped**: 0
**Failed**: 0
**Duration**: ~3.6s

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

### 2. Database Schema + CRUD (Unit) — 12/12 PASSED
| Test | Status |
|------|--------|
| Connects successfully | PASS |
| pgvector extension is enabled | PASS |
| All 16 required tables exist | PASS |
| Recipes table has embedding column | PASS |
| Knowledge_chunks table has embedding column | PASS |
| Recipes table has data (12,771 recipes) | PASS |
| Knowledge_chunks table exists and is queryable | PASS |
| icmr_nin_rda table has data | PASS |
| Can insert and retrieve a test family | PASS |
| Can insert and retrieve a family member | PASS |
| Foreign key constraint enforced | PASS |
| Embedding vector dimension check (1024) | PASS |

### 3. Embedding Queue (Unit) — 3/3 PASSED
| Test | Status |
|------|--------|
| Queue status is available via healthz | PASS |
| Recipes count is available | PASS |
| Embedded recipes count is a valid number | PASS |

### 4. API Endpoints + Security (Integration) — 24/24 PASSED
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
| 7 auth security checks (401 without auth) | PASS |
| SQL injection in search returns 200 or 400 | PASS |
| XSS in recipe search is sanitised | PASS |

### 5. AI Features (Integration) — 11/11 PASSED
| Test | Status |
|------|--------|
| healthz reports knowledge chunk count field | PASS |
| healthz reports embedding queue info | PASS |
| embedded recipes count is zero when AI unavailable | PASS |
| POST /api/meal-plans/generate requires auth | PASS |
| GET /api/gemini/conversations requires auth | PASS |
| POST /api/gemini/conversations requires auth | PASS |
| GET /api/gemini/conversations with auth returns array | PASS |
| embedding queue is running or has embedded data | PASS |
| embedded recipes count increases over time | PASS |
| POST /api/meal-plans/generate rejects invalid familyId | PASS |
| recipes include calorie and protein fields | PASS |

### 6. RAG Pipeline (Integration) — 26/26 PASSED
| Test | Status |
|------|--------|
| Embedding provider is configured | PASS |
| Embedding queue is running or has completed | PASS |
| At least some recipes have been embedded | PASS |
| Recipe embedding dimension matches 1024 | PASS |
| GET /api/recipes returns recipes (basic search) | PASS |
| GET /api/recipes?search=dal returns relevant results | PASS |
| GET /api/recipes?diet=vegetarian returns only vegetarian | PASS |
| Low coverage fallback: SQL returns results when <10% embedded | PASS |
| knowledge_chunks table exists | PASS |
| Knowledge base ingestion status is reported | PASS |
| POST /api/gemini/conversations creates conversation | PASS |
| GET /api/gemini/conversations returns array | PASS |
| Admin retrieval requires auth (401/403) | PASS |
| Admin retrieval requires admin role | PASS |
| Meal plan generation requires auth | PASS |
| Meal plan generation rejects invalid familyId | PASS |
| Retrieval returns empty when no knowledge chunks | PASS |
| SQL fallback returns recipes with 0.5 similarity | PASS |
| Queue processes recipes without excessive failures | PASS |
| Queue has zero or few failures | PASS |
| Embedded count matches queue processed count | PASS |
| Recipes have required fields for embedding | PASS |
| Knowledge base source files exist on disk | PASS |
| healthz reports all RAG metrics correctly | PASS |
| RAG pipeline summary | PASS |
| Embedded recipe vectors are valid | PASS |

---

## RAG Pipeline Status

| Metric | Value |
|--------|-------|
| Embedding Provider | Voyage AI (voyage-3, 1024 dims) |
| Recipe Embeddings | 17/12,771 (0.13%) |
| Knowledge Chunks | 0 (ingestion rate-limited) |
| Vector Search Active | NO — SQL fallback (<10% threshold) |
| Queue Running | Yes (3 RPM, ~21s/recipe) |
| Queue Failures | 0 |

### Known Issues
1. **Knowledge base is empty** — `generateEmbeddingsBatch` had 100ms inter-call delay for Voyage AI (3 RPM free tier). Fixed to 21s. Ingestion will complete on next restart (~15 min for 43 chunks).
2. **Recipe vector search uses SQL fallback** — Only 0.13% of recipes are embedded. Vector search activates when coverage reaches 10% (~1,277 recipes). At 3/minute, this will take ~7 hours.
3. **Admin test-retrieval endpoint** — Times out via Replit proxy (504) due to Voyage API call latency. Works when called directly with longer timeout.

### Recommendations
- Add payment method to Voyage AI dashboard to increase rate limits (still get 200M free tokens)
- Consider batching multiple texts per Voyage API call (voyage-3 supports array input)
- Knowledge base ingestion should use incremental approach (embed a few chunks per server restart)

---

## Test Files
- `tests/unit/icmrNin.test.ts` — 11 tests
- `tests/unit/database.test.ts` — 12 tests
- `tests/unit/embeddingQueue.test.ts` — 3 tests
- `tests/integration/api.test.ts` — 24 tests
- `tests/integration/aiFeatures.test.ts` — 11 tests
- `tests/integration/rag.test.ts` — 26 tests
