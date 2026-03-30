# RAG Specification Compliance Audit

**Date**: 2026-03-30
**Spec**: "Production-grade RAG system" (10-step specification)
**Codebase**: Family-Nutrition-Planner monorepo

---

## Overall Score: ~90% Implemented

The 3-layer RAG architecture is fully wired — all three layers are active. Ingestion is still catching up due to Voyage AI free tier rate limits.

---

## STEP-BY-STEP AUDIT

### STEP 1 — Install Required Packages
**Status: DONE (with adaptations)**

| Item | Spec | Actual | Match |
|------|------|--------|-------|
| `@google/generative-ai` | Install | Installed as `@google/genai` (newer SDK) | ADAPTED |
| `pdf-parse` | Install | Installed | YES |
| `csv-parse` | Install | Installed | YES |
| `natural` | Install | NOT installed | NO (unused — chunking done differently) |
| pgvector extension | `CREATE EXTENSION vector` | Enabled | YES |
| `recipes.embedding` | `vector(768)` | `vector(1024)` — changed for Voyage AI voyage-3 model | ADAPTED |
| `knowledge_chunks` table | Create with vector(768) | Created with `vector(1024)` | ADAPTED |
| IVFFlat index on `knowledge_chunks` | Create | EXISTS (`knowledge_chunks_embedding_idx`) | YES |
| IVFFlat index on `recipes` | Create | EXISTS (`recipes_embedding_idx`) | YES |

**Notes**: Vector dimension changed from 768 to 1024 because the embedding provider was changed from Gemini `text-embedding-004` (768 dims) to Voyage AI `voyage-3` (1024 dims). This is a valid adaptation — the actual `VOYAGE_API_KEY` is set and working while `GEMINI_API_KEY` is invalid.

---

### STEP 2 — Embedding Service
**Status: DONE (enhanced)**

| Item | Spec | Actual | Match |
|------|------|--------|-------|
| File location | `server/services/embedding.ts` | `artifacts/api-server/src/services/embedding.ts` | ADAPTED (monorepo) |
| `generateEmbedding()` | Gemini `text-embedding-004` | Voyage AI `voyage-3` primary, Gemini fallback | ENHANCED |
| `generateEmbeddingsBatch()` | Batch of 20 parallel | Sequential with 21s delay (Voyage 3 RPM limit) | ADAPTED |
| `findSimilarChunks()` | Query both tables | YES — overloaded for `knowledge_chunks` and `recipes` | YES |
| `isEmbeddingConfigured()` | Not in spec | Added — checks VOYAGE/GEMINI/Integration keys | ENHANCED |
| SQL fallback | Not in spec | Added — falls back to SQL random when <10% embedded | ENHANCED |
| Rate limit handling | 1s batch pause | 21s delay + 429 retry with 25s wait (Voyage free tier) | ADAPTED |

**Notes**: Major enhancement is the multi-provider support (Voyage primary, Gemini fallback) and the SQL fallback for low embedding coverage. The batch delay was critical — the spec's 1s pause would cause 429 errors on Voyage's 3 RPM free tier.

---

### STEP 3 — Document Ingestion Service
**Status: DONE (enhanced)**

| Item | Spec | Actual | Match |
|------|------|--------|-------|
| File location | `server/services/ingestion.ts` | `artifacts/api-server/src/services/ingestion.ts` | ADAPTED |
| `chunkText()` | 800 words, 150 overlap | YES — also added `chunkTextSectionAware()` for ICMR docs | ENHANCED |
| `ingestPDF()` | PDF parsing + chunking | YES — incremental, skips already-ingested chunks | ENHANCED |
| `ingestMealPatterns()` | Text file splitting | YES — via `ingestTextFile()` | YES |
| `embedRecipes()` | Embed 500 at a time | Moved to separate `embeddingQueue.ts` — gradual 1-at-a-time | ENHANCED |
| `ingestKnowledgeBase()` | Main entry point | YES — runs on server start | YES |
| `forceReingestKnowledgeBase()` | Delete + re-ingest | YES | YES |
| `ingestCSV()` | Not in spec | Added — for additional CSV knowledge files | ENHANCED |
| Incremental ingestion | Not in spec (count>0 skip) | YES — checks per source/chunk_index, resumes where left off | ENHANCED |

**Notes**: The spec's `count > 0` skip-all approach was removed in favor of per-chunk incremental ingestion. This is critical for the Voyage free tier where ingestion takes ~15 minutes.

---

### STEP 4 — RAG Retrieval Service
**Status: DONE (enhanced)**

| Item | Spec | Actual | Match |
|------|------|--------|-------|
| File location | `server/services/retrieval.ts` | `artifacts/api-server/src/services/retrieval.ts` | ADAPTED |
| `FamilyContext` interface | Basic member fields | Enhanced with `memberSummaries`, `cuisinePreferences`, `isFasting`, `budget` | ENHANCED |
| `RetrievedContext` interface | 5 fields | YES — `icmrGuidelines`, `mealPatterns`, `nutritionRules`, `relevantRecipes`, `contextSummary` + `sources`, `chunkCount`, `recipeCount` | ENHANCED |
| ICMR query | Condition-based | YES — builds condition-specific ICMR query | YES |
| Meal pattern query | Goal-based | YES — zone + diet + fasting + diabetes awareness | ENHANCED |
| RDA query | Separate RDA retrieval | YES — separate `rdaQuery` for nutrition rules | YES |
| Recipe query | Family profile-based | YES — zone + diet + conditions + budget filtering | YES |
| Parallel retrieval | `Promise.all` | YES — 4 parallel queries with 8s timeout each | YES |
| `formatRecipesForPrompt()` | Basic recipe formatting | YES — similarity score included | YES |
| Similarity thresholds | Not in spec | Added — 0.3 for chunks, 0.25 for recipes | ENHANCED |
| Deduplication | Not in spec | Added — `deduplicateChunks()` | ENHANCED |
| Timeout protection | Not in spec | Added — 8s timeout per query with fallback to empty | ENHANCED |

---

### STEP 5 — RAG-Powered Meal Plan Prompt
**Status: DONE (significantly enhanced)**

| Item | Spec | Actual | Match |
|------|------|--------|-------|
| Section A — ICMR guidelines | Inject retrieved chunks | YES — `retrievedContext.icmrGuidelines` injected | YES |
| Section B — Meal patterns | Inject retrieved patterns | YES — `retrievedContext.mealPatterns` injected | YES |
| Section C — Available recipes | Inject recipe list | YES — `retrievedContext.relevantRecipes` injected | YES |
| Member profiles | Basic profile injection | YES — detailed with weight/height/conditions | YES |
| "Use ONLY this data" instruction | Hard instruction | YES — present in prompt | YES |
| JSON output format | Specify structure | YES — enforced via Zod schema + retry | ENHANCED |
| Master prompt architecture | Not in spec | Added — 3-section (static/weekly/clinical) | ENHANCED |
| Clinical guardrails | Not in spec | Added — cereal:pulse ratio, HFSS avoidance, 400g vegs | ENHANCED |
| Post-generation validation | Not in spec | Added — clinical validator + "Validation Sieve" | ENHANCED |
| Seasonal produce injection | Not in spec | Added | ENHANCED |
| Pantry inventory | Not in spec | Added | ENHANCED |
| Flavor fatigue avoidance | Not in spec | Added | ENHANCED |

---

### STEP 6 — Meal Plan Generation Route
**Status: DONE (enhanced)**

| Item | Spec | Actual | Match |
|------|------|--------|-------|
| `POST /api/meal-plans/generate` | Create/update | EXISTS | YES |
| Retrieve family + members | From DB | YES | YES |
| Build `familyContext` | For RAG | YES | YES |
| Call `retrieveContextForFamily` | Before Gemini | YES — `retrieveContextForMealPlan()` | YES |
| Build RAG prompt | Using retrieved context | YES | YES |
| Google Search grounding | `tools: [{googleSearch: {}}]` | ENABLED in API call config | YES |
| Retry logic (3 attempts) | Exponential backoff | YES — `callGeminiWithJsonRetry` | YES |
| JSON extraction | Extract from response | YES — via Zod schema validation | ENHANCED |
| Save to DB with RAG metadata | `ragContextUsed` field | YES — saves chunksRetrieved + sourcesUsed | YES |
| `responseMimeType: 'application/json'` | Structured output | YES | YES |
| `temperature: 0.3` | Low temperature | Not confirmed — may use default | PARTIAL |

---

### STEP 7 — Wire Up Ingestion on Server Start
**Status: DONE (improved)**

| Item | Spec | Actual | Match |
|------|------|--------|-------|
| Import `ingestKnowledgeBase` | In index.ts | YES | YES |
| Call on server start | Before routes | YES — called after server starts listening | YES |
| Error handling | Catch + warn | YES — non-fatal with warning | YES |
| Admin reingest route | `POST /api/admin/reingest` | YES — `POST /api/admin/reingest` exists | YES |
| Admin email check | `requireAuth` + email check | YES — `requireAdmin()` function | YES |
| Embedding queue start | Not in spec | Added — `startEmbeddingQueue()` runs independently | ENHANCED |
| Decoupled queue from ingestion | Not in spec | YES — queue starts immediately, ingestion runs in parallel | ENHANCED |

---

### STEP 8 — Chat RAG
**Status: DONE**

| Item | Spec | Actual | Match |
|------|------|--------|-------|
| Vector retrieval for recipes | `findSimilarChunks` | YES — 8 recipes via `retrieveContextForChat()` | YES |
| Vector retrieval for guidelines | `findSimilarChunks` | YES — 4 knowledge chunks | YES |
| Inject into system prompt | Recipe + guideline context | YES — appended to `fullSystemInstruction` | YES |
| "Use only above context" | Instruction | YES — "cite these when relevant" / "Use these specific recipes" | YES |
| Similarity threshold | Not in spec | Added — 0.35 for chunks, 0.3 for recipes | ENHANCED |

---

### STEP 9 — Schema Columns
**Status: DONE**

| Item | Spec | Actual | Match |
|------|------|--------|-------|
| `meal_plans.icmr_compliance` | JSONB column | EXISTS | YES |
| `meal_plans.rag_context_used` | JSONB column | EXISTS | YES |
| Drizzle schema updated | Include new columns | YES — in `lib/db/src/schema/meal_plans.ts` | YES |

---

### STEP 10 — Verification Checklist
**Status: PARTIAL**

| Check | Spec | Actual | Pass |
|-------|------|--------|------|
| Server starts without errors | Yes | YES | PASS |
| GET /healthz returns DB connected | Yes | YES — returns `"database": "connected"` | PASS |
| `knowledge_chunks` count > 0 | Yes | 8 chunks (growing — ingestion in progress) | PASS |
| Recipes with embeddings > 0 | Yes | 23 recipes embedded | PASS |
| Admin test-retrieval works | POST with query | 403 for demo user (admin-only), times out via proxy | PARTIAL |
| Meal plan for diabetic member | Generate + check `icmrCompliance` | Not tested end-to-end (requires valid family setup) | UNTESTED |
| Chat returns DB recipes | Not invented ones | RAG context injected; actual validation blocked by proxy timeout | PARTIAL |
| Server logs show RAG messages | "Starting RAG retrieval..." | YES — logs show retrieval info | PASS |
| No TypeScript errors | Compilation | YES — builds cleanly | PASS |

---

## GAPS SUMMARY

### NOT Implemented (from spec)
1. **`natural` package** — Not installed. The spec mentions it for tokenization, but chunking is done via word splitting instead.
2. **Batch embedding parallelism** — Spec calls for batches of 20 in parallel. Implementation uses sequential 1-at-a-time due to Voyage AI 3 RPM rate limit. Valid adaptation but slower.

### Partially Implemented
1. **Knowledge base ingestion completeness** — Only 8/~100+ expected chunks ingested so far (ICMR guidelines partially done). Ingestion is actively running but slow at 3 RPM.
2. **Admin test-retrieval** — Exists but times out through Replit proxy. Works theoretically with direct access.

### Enhanced Beyond Spec
1. **Voyage AI support** — Spec only mentions Gemini embeddings. Implementation adds Voyage AI as primary provider with automatic fallback.
2. **Incremental ingestion** — Spec uses all-or-nothing. Implementation resumes from where it left off.
3. **Embedding queue** — Background gradual embedding instead of blocking batch.
4. **SQL fallback** — When <10% of recipes are embedded, falls back to SQL random results instead of failing.
5. **Clinical validation** — Post-generation clinical validator and "Validation Sieve" not in spec.
6. **3-section prompt architecture** — Static/Weekly/Clinical separation not in spec.
7. **Timeout protection** — 8s per-query timeout with graceful fallback.
8. **Section-aware chunking** — ICMR documents use heading-aware chunking instead of naive word splitting.

---

## Priority Fixes Needed

| Priority | Issue | Impact |
|----------|-------|--------|
| MEDIUM | Knowledge base ingestion still in progress (~8/100+ chunks) | RAG quality limited until complete |
| LOW | `natural` package not installed | Not actually needed — chunking works fine without it |
