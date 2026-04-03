# ParivarSehat AI / NutriNext — Family Nutrition Planner

## Overview

ParivarSehat AI / NutriNext is an India-centric AI-powered family meal planning web application designed to help Indian families create nutritious meal plans. It leverages ICMR-NIN 2024 dietary guidelines, regional cuisine preferences, multi-faith fasting calendars, budget constraints, and individual health goals. Key features include a 12,700+ recipe dataset, AI-driven meal optimization via Gemini 2.5 Flash, a food scanner, multilingual voice support (8 Indian languages), ICMR-grounded AI chat with SSE streaming, and an Apple-tier Glass Design System.

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Monorepo Structure (pnpm workspace)

```
Family-Nutrition-Planner/
├── artifacts/
│   ├── api-server/          # Express 5 API backend (port 8080)
│   ├── nutrinext/           # React 18 + Vite frontend (port 5000)
│   └── mockup-sandbox/      # UI prototyping sandbox (port 8081)
├── lib/
│   ├── api-client-react/    # Auto-generated TanStack Query hooks (Orval)
│   ├── api-spec/            # OpenAPI spec (openapi.yaml)
│   ├── api-zod/             # Auto-generated Zod schemas (Orval)
│   ├── db/                  # Drizzle ORM schemas, migrations, DB connections
│   ├── integrations/        # Third-party service wrappers
│   └── integrations-gemini-ai/  # Gemini AI client (modelfarm + direct key)
├── scripts/                 # Build & post-merge scripts
├── pnpm-workspace.yaml      # Workspace config with catalogs
├── start.mjs                # Production entry point
└── .replit                  # Replit deployment config
```

### Workflows (Development)

| Workflow | Command | Port | Purpose |
|----------|---------|------|---------|
| `Start application` | `DEMO_MODE=true PORT=5000 API_PORT=8080 pnpm --filter @workspace/nutrinext run dev` | 5000 | Main frontend (webview port) |
| `API Server` | `pnpm --filter @workspace/api-server run dev` | 8080 | Backend API |
| `Component Preview Server` | `pnpm --filter @workspace/mockup-sandbox run dev` | 8081 | Mockup sandbox |

The "Start application" workflow is the primary one users see in the webview. The API Server workflow must also be running for the app to function.

### Port Architecture & Proxy Setup

- **Port 5000**: Vite dev server (frontend). This is what users see in the Replit webview.
- **Port 8080**: Express API server (backend). The Vite config proxies `/api` requests from port 5000 to port 8080.
- **Port 8081**: Mockup sandbox (not user-facing).

The Vite proxy is configured in `artifacts/nutrinext/vite.config.ts`:
```
proxy: { "/api": { target: "http://localhost:${API_PORT ?? 5000}", changeOrigin: true } }
```
When `API_PORT=8080` is set (as in the Start application workflow), the frontend proxies all `/api/*` calls to the backend on port 8080.

---

## Backend Architecture

Built with Node.js 24, TypeScript 5.9, Express 5, Drizzle ORM, PostgreSQL, pino logging, esbuild bundling.

### ParivarSehat AI Meal Generation Engine

Located at `artifacts/api-server/src/engine/`. A multi-step pipeline that:
1. Loads family/weekly context from Supabase
2. Runs ICMR-NIN calorie calculations per member
3. Detects & resolves dietary conflicts (6 priority levels)
4. Applies medication-food interaction guardrails (9 drug classes)
5. Calls Gemini 2.5 Flash 3× (staples → 7-day meal plan → buffer list)
6. Computes Family Harmony Score and stores results

Key files:
- `src/engine/types.ts` — All shared types
- `src/engine/calorie-calculator.ts` — ICMR-NIN calorie targets, auto-assignment rules
- `src/engine/budget-engine.ts` — Budget splits, regional pricing
- `src/engine/conflict-engine.ts` — 6-level conflict detection & resolution
- `src/engine/prompt-chain.ts` — 3-step Gemini generation (staples, meals, buffer)
- `src/engine/lib/harmonyScore.ts` — Harmony Score card builder, final result assembler
- `src/engine/lib/medicationRules.ts` — 9 drug-class medication interaction rules
- `src/engine/meal-generation-service.ts` — Express router (4 routes)
- `db/index.ts` + `db/schema.ts` — Bridge layer re-exporting @workspace/db with short aliases

Routes mounted at `/api/meal-gen/` (behind auth middleware, separate from legacy `/api/meal-plans/`):
- `POST /generate` — Starts async generation, returns 202 with meal_plan_id
- `GET /:id/status` — Poll for generation progress + final result
- `GET /:id/conflicts` — Harmony Score breakdown card
- `POST /:id/skip-meal` — Mark meal skipped with nutritional bandaid

### Two Database Pools (CRITICAL)

The app uses **two separate PostgreSQL connections**:

1. **`localDb`** — Local Replit PostgreSQL (via `DATABASE_URL`)
   - Stores: `recipes` (12,771 rows), `knowledge_chunks` (171 ICMR sections), `icmr_nin_rda` (22 rows), `food_gi_nutrition`
   - Used for: Recipe search, RAG knowledge retrieval

2. **`db`** — Supabase PostgreSQL (via `SUPABASE_DATABASE_URL`)
   - Stores: `users`, `families`, `family_members`, `meal_plans`, `grocery_lists`, `health_logs`, `nutrition_logs`, `chat_messages`, `monthly_budgets`, `weekly_contexts`, `member_weekly_contexts`, `ai_chat_logs`, `leftover_items`, `meal_feedback`
   - Used for: All user data, auth, meal plans, chat history

### API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/auth/register`, `POST /api/auth/login` | JWT auth (bcryptjs + jsonwebtoken) |
| `GET /api/demo/instant` | Creates demo Sharma family + returns JWT token. No DEMO_MODE env required |
| `GET/POST /api/families`, `GET /api/families/:id/members` | Family & member CRUD |
| `GET /api/meal-plans?familyId=`, `POST /api/meal-plans/generate` | Meal plan CRUD + AI generation |
| `POST /api/meal-gen/generate` (engine) | ParivarSehat AI pipeline: async 7-day plan generation (returns 202 + poll) |
| `GET /api/meal-gen/:id/status` (engine) | Poll generation progress (log entries + final result on completion) |
| `GET /api/meal-gen/:id/conflicts` (engine) | Harmony Score card + conflict transparency panel |
| `POST /api/meal-gen/:id/skip-meal` (engine) | Mark meal skipped; returns nutritional bandaid + carry-forward |
| `GET /api/recipes?q=&cuisine=&diet=&limit=&page=` | Full-text recipe search with weighted ts_rank |
| `GET /api/recipes/:id` | Single recipe detail |
| `POST /api/chat` | SSE-streaming AI chat (Gemini 2.5 Flash) |
| `GET /api/chat/history?sessionId=&familyId=` | Chat message history for a session |
| `GET /api/chat/sessions?familyId=` | List all chat sessions for a family |
| `GET /api/grocery-lists?familyId=` | Grocery list retrieval |
| `GET /api/health-logs?familyId=` | Health log retrieval |
| `GET /api/nutrition-logs?familyId=` | Nutrition log retrieval |
| `GET /healthz` | Health check — returns `{"status":"ok"}` |

### AI Chat with SSE Streaming (`POST /api/chat`)

The chat route (`routes/chat/index.ts`) provides SSE-streaming AI responses via Gemini 2.5 Flash with:

- **Mega-prompt system** (`lib/megaPrompt.ts`): ParivarSehat persona with ICMR-grounded nutrition guidance
- **RAG search** (`lib/ragSearch.ts`): Retrieves relevant ICMR knowledge chunks from `localDb`. Two modes:
  1. **Vector mode** (direct `GEMINI_API_KEY`): Uses `text-embedding-004` embeddings + cosine similarity
  2. **BM25 mode** (Replit modelfarm): Uses proper BM25 ranking with TF-IDF, document-length normalization (k1=1.2, b=0.75). This is the active mode on Replit since modelfarm does NOT support the `embedContent` endpoint
  - Vector mode falls back to BM25 on failure
- **Context assembly** (`lib/assembleContext.ts`): Injects family profile, member health conditions, meal plans, nutrition logs, medications, and RAG evidence into every Gemini call
- **Action extraction**: Parses `---ACTION---` delimiter in responses for structured UI actions
- **IDOR protection**: Validates `familyId` ownership against JWT `userId`
- **Chat history** (`lib/chatHistory.ts`): Persists messages to `chat_messages` table per session UUID
- **SSE event contract**: `delta` (streaming text), `action` (parsed action payload), `done` (stream complete), `error` (error message)

### Recipe Search Implementation

Full-text search using PostgreSQL GIN index with weighted ranking:
- **WHERE clause**: Searches across `name`, `nameHindi`, and `ingredients` using `to_tsvector('simple', ...)` with prefix matching (`:*`)
- **ORDER BY**: Uses `ts_rank` with `setweight` — name matches (weight A) rank highest, Hindi name (weight B) second, ingredient matches (weight C) lowest
- When no search query, orders alphabetically by name

### Knowledge Base & Ingestion

On API server startup, `services/ingestion.ts` reads text files from `knowledge_base/` directory:
- `icmr_nin_guidelines.txt` — 43 sections of ICMR dietary guidelines
- `icmr_nin_rda.txt` — 37 sections of Recommended Dietary Allowances
- `meal_patterns.txt` — 91 sections of Indian meal patterns

These are chunked and stored in `knowledge_chunks` table in `localDb`. The BM25 search queries these chunks at chat time.

### Gemini AI Integration

The client (`lib/integrations-gemini-ai/src/client.ts`) prioritizes the Replit integration:
- **Replit modelfarm** (active): Uses `AI_INTEGRATIONS_GEMINI_BASE_URL` + `AI_INTEGRATIONS_GEMINI_API_KEY`. Google Search grounding is automatically disabled (unsupported by modelfarm). Embedding (`embedContent`) is also unsupported — RAG uses BM25 fallback.
- **Direct API key** (fallback): Uses `GEMINI_API_KEY` if set. Supports all features including embeddings.

Import pattern: `import { ai } from "@workspace/integrations-gemini-ai"`

---

## Frontend Architecture

React 18 + Vite + Wouter routing + TanStack React Query + shadcn/ui + Tailwind CSS v4 + Framer Motion.

### Pages

| Page | File | Purpose |
|------|------|---------|
| Login | `Login.tsx` | Email/password login + "Try with Demo Family" button |
| Register | `Register.tsx` | New account signup |
| Dashboard | `Dashboard.tsx` | Family overview, quick stats |
| Meal Plan | `MealPlan.tsx` | 7-day weekly meal grid, fasting calendar, budget tracker, harmony score |
| Recipes | `RecipeExplorer.tsx` | Search & browse 12,700+ Indian recipes |
| Recipe Detail | `RecipeDetail.tsx` | Full recipe with nutrition info |
| AI Chat | `Chat.tsx` | SSE streaming chat with ParivarSehat AI |
| Grocery | `Grocery.tsx` | Grocery list management |
| Health Log | `HealthLog.tsx` | Health tracking & logging |
| Profile | `Profile.tsx` | Family & member profile management |
| Family Setup | `FamilySetup.tsx` | Multi-step wizard (voice, text-chat, manual) |
| Scanner | `Scanner.tsx` | Food image scanning (YOLOv11 + Gemini Vision) |
| Pantry | `Pantry.tsx` | Pantry management |

### Key Hooks

- **`useChat.ts`**: SSE streaming client, session management via UUID in `sessionStorage`, loads history on mount, "New Chat" (+) clears session
- **`useVoice.ts`**: Browser-native Web Speech API for STT + TTS with barge-in support
- **`use-app-state.ts`**: Global state — active family, auth token, family members
- **`use-auth.ts`**: JWT token management, login/logout

### Chat History (Current Behavior)

- Session ID stored in browser `sessionStorage` (lost on tab close)
- Messages saved to `chat_messages` table per session
- On page load, fetches history for current session from `GET /api/chat/history`
- "+" button creates new session (clears `sessionStorage` key)
- **Known limitation**: No UI to browse past chat sessions. The backend `GET /api/chat/sessions` endpoint exists but is not surfaced in the frontend.

### MarkdownMessage Component

Zero-dependency custom markdown renderer (`components/MarkdownMessage.tsx`) for assistant messages. Handles bold, italic, code, fenced code blocks, headings, ordered/unordered lists, horizontal rules. Strips raw HTML tags for XSS prevention.

---

## Database Schema

### Key Invariants (CRITICAL — DO NOT CHANGE)

- All primary keys are `serial` (auto-incrementing integers)
- All foreign keys are `integer`
- NEVER change PK types to UUID — this breaks existing data

### User-Data Tables (Supabase — `db`)

| Table | Key Columns |
|-------|-------------|
| `users` | id (serial PK), email, passwordHash |
| `families` | id (serial PK), userId, name, stateRegion, languagePreference, householdDietaryBaseline, mealsPerDay, cookingSkillLevel, appliances (JSONB), pincode, monthlyBudget |
| `family_members` | id (serial PK), familyId (FK), name, age, gender, dietaryType, dailyCalorieTarget, healthConditions (JSONB), medications (JSONB), tiffinNeeded, spiceTolerance, activityLevel, healthGoal, displayOrder |
| `meal_plans` | id (serial PK), familyId (FK), weeklyContextId (FK nullable), generationStatus, days (JSONB), harmonyScore, harmonyScoreBreakdown (JSONB), nutritionalSummary (JSONB) |
| `grocery_lists` | id (serial PK), familyId (FK), mealPlanId (FK nullable), listType, monthYear, weekStartDate, totalEstimatedCost (numeric), items (JSONB), status, updatedAt |
| `weekly_contexts` | id (serial PK), familyId (FK), weekStartDate (date), budgetInr, notes |
| `member_weekly_contexts` | id (serial PK), weeklyContextId (FK), memberId (FK), caloricTarget, portionScale |
| `chat_messages` | id (serial PK), familyId, sessionId (UUID text), role, text, createdAt |
| `monthly_budgets` | id (serial PK), familyId (FK), month, year, amount |
| `health_logs` | id (serial PK), familyId (FK), memberId (FK), ... |
| `nutrition_logs` | id (serial PK), familyId (FK), ... |
| `meal_feedback` | id (serial PK), mealPlanId (FK), ... |
| `leftover_items` | id (serial PK), familyId (FK), ... |
| `ai_chat_logs` | id (serial PK), familyId (FK), ... |

### Local-Data Tables (Local PG — `localDb`)

| Table | Key Columns |
|-------|-------------|
| `recipes` | id (serial PK), name, nameHindi, ingredients, instructions, cuisine, diet, category, calories, protein, carbs, fat, fiber, iron, calcium, vitaminC, costPerServing, totalTimeMin, servings |
| `knowledge_chunks` | id (serial PK), content, embedding (vector 1024), source, metadata (JSONB) |
| `icmr_nin_rda` | id (serial PK), ... RDA target data |
| `food_gi_nutrition` | id (serial PK), ... glycemic index data |

### Migrations

All in `lib/db/migrations/`:

| Migration | Purpose |
|-----------|---------|
| `0001_add_member_profile_fields.sql` | Added member profile fields |
| `0002_fix_primary_goal_check.sql` | Fixed primary goal constraint |
| `0003_dietary_baseline.sql` | Added dietary baseline fields |
| `0004_rag_foundation.sql` | Added knowledge_chunks, embeddings |
| `0005_voyage_1024.sql` | Changed embedding dimension to 1024 |
| `0006_weekly_contexts_tables.sql` | Created `weekly_contexts` + `member_weekly_contexts` tables |
| `0007_fix_grocery_lists_schema.sql` | Fixed grocery_lists drift: dropped week_of/budget_status/accepted_swaps, added list_type/month_year/week_start_date/status/updated_at, changed total_estimated_cost to numeric |

### Meal Plan Data Shape (IMPORTANT)

The API returns meal plans where the `days` field is a **nested JSONB object**, NOT a flat array:

```json
{
  "id": 1,
  "familyId": 3,
  "generationStatus": "completed",
  "days": {
    "days": [
      { "day": "Monday", "meals": { "breakfast": {...}, "lunch": {...}, "dinner": {...}, "snack": {...} } },
      ...
    ],
    "harmonyScore": 85,
    "totalBudgetEstimate": 2500
  },
  "weekStartDate": null,
  "createdAt": "2026-03-27T11:24:36.578Z"
}
```

The frontend (`MealPlan.tsx`) handles this with: `const rawPlanField = (currentPlan as any).days ?? (currentPlan as any).plan;` then `planData?.days` to get the array.

**`weekStartDate` is NOT a column on `meal_plans` table** — it's on `weekly_contexts`. The frontend safely handles this with `safeFormatDate()` falling back to `createdAt`.

---

## Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | Replit PostgreSQL | Local DB connection (recipes, knowledge chunks) |
| `SUPABASE_DATABASE_URL` | Secret | Supabase DB connection (user data) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase admin operations |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Replit Integration | Gemini AI via modelfarm (auto-set) |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Replit Integration | Modelfarm endpoint (auto-set) |
| `GEMINI_API_KEY` | Secret (optional) | Direct Gemini API key (enables embeddings) |
| `DEMO_MODE` | Development env | Set to "true" in dev; enables demo features |
| `PORT` | Workflow | Frontend Vite port (5000 in dev) |
| `API_PORT` | Workflow | API server port (8080 in dev) |
| `JWT_SECRET` | Secret | JWT signing key |

---

## Demo Mode & Testing

### Demo Login Flow

1. User clicks "Try with Demo Family (60 seconds)" on login page
2. Frontend calls `GET /api/demo/instant`
3. Backend creates/finds the "Sharma Family (Demo)" with 3 members:
   - **Rajesh Sharma** (45M, diabetes + hypertension, sedentary)
   - **Sunita Sharma** (42F, obesity, moderate activity)
   - **Arjun Sharma** (16M, healthy teenager, very active)
4. Returns JWT token; frontend stores it and redirects to meal plan page
5. Demo includes a pre-generated 7-day meal plan with status `completed`

### Testing via curl

```bash
# Get demo token
TOKEN=$(curl -s http://localhost:8080/api/demo/instant | node -e "process.stdin.setEncoding('utf8'); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).token))")

# Test endpoints
curl -s http://localhost:8080/api/families -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:8080/api/meal-plans?familyId=3" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:8080/api/recipes?q=paneer&limit=5" -H "Authorization: Bearer $TOKEN"

# Test AI Chat (SSE streaming)
curl -s -N http://localhost:8080/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What foods help with diabetes?","familyId":3,"sessionId":"test-1"}'
```

---

## Deployment

**Target**: Replit Autoscale.

**Build command** (from `.replit`):
```bash
cd Family-Nutrition-Planner && pnpm install --frozen-lockfile && \
  pnpm --filter @workspace/api-server build && \
  pnpm --filter @workspace/nutrinext build && \
  cp -r artifacts/nutrinext/dist/public artifacts/api-server/dist/public
```

**Run command**: `cd Family-Nutrition-Planner/artifacts/api-server && node ../../start.mjs`

**Production behavior**: `start.mjs` sets `NODE_ENV=production` and `DEMO_MODE=true`, respects the `PORT` env var from deployment (defaults to 3000). In production, `app.ts` serves `dist/public/` via `express.static` with 1-day cache and a `*` catch-all for SPA routing.

**Health check**: `GET /healthz` returns `{"status":"ok"}`.

---

## Bugs Fixed in This Session (Reference for Debugging)

### 1. Grocery Lists Schema Drift (Migration 0007)

**Problem**: Supabase `grocery_lists` table had old columns (`week_of`, `budget_status`, `accepted_swaps`, integer `total_estimated_cost`) that didn't match the Drizzle schema (`list_type`, `month_year`, `week_start_date`, `status`, `updated_at`, numeric `total_estimated_cost`).
**Fix**: Created migration `0007_fix_grocery_lists_schema.sql` to ALTER TABLE — dropped old columns, added new ones, changed cost type to numeric.
**Impact**: `GET /api/grocery-lists` was returning 500 errors; now returns clean results.

### 2. RAG Embeddings Fail on Modelfarm

**Problem**: `text-embedding-004:embedContent` endpoint is NOT supported by Replit modelfarm. RAG search returned no ICMR knowledge chunks.
**Fix**: Implemented proper BM25 ranking in `ragSearch.ts` with TF-IDF, corpus-level document frequency, and document-length normalization (k1=1.2, b=0.75). Modelfarm mode automatically uses BM25; vector mode is used when a direct `GEMINI_API_KEY` is available. Vector mode falls back to BM25 on failure.
**Verification**: Server logs show `[RAG] BM25 mode: Injecting 4 chunk(s). Top score: 5.973` and AI responses include ICMR-grounded nutrition advice.

### 3. Recipe Search Returning Irrelevant Results

**Problem**: Recipe search for "dal" returned random recipes alphabetically because `ts_rank` only ranked on `name` column, but the WHERE clause searched `name + nameHindi + ingredients`. Matches in Hindi name or ingredients got rank ~0.
**Fix**: Updated `ts_rank` to use `setweight` across all three fields: name (weight A), nameHindi (weight B), ingredients (weight C). Now name matches rank highest.
**Verification**: "paneer tikka" returns exact tikka recipes first; "dal" returns dal recipes first.

### 4. MealPlan.tsx Data Shape Mismatch

**Problem**: Frontend accessed `currentPlan.plan` but API returns `.days`. The `days` field is a nested object `{ days: [...], harmonyScore, totalBudgetEstimate }`, not a flat array.
**Fix**: Changed all 4 occurrences to use `(currentPlan as any).days ?? (currentPlan as any).plan`. `getDayData()` handles both array and nested formats.

### 5. "Invalid time value" App Crash

**Problem**: `MealPlan.tsx` called `format(new Date(currentPlan.weekStartDate))` but `weekStartDate` doesn't exist on the `meal_plans` table (it's on `weekly_contexts`). `new Date(undefined)` creates Invalid Date, and `date-fns format()` throws "Invalid time value", crashing the ErrorBoundary and showing "Something went wrong".
**Fix**: Added `safeFormatDate()` utility that validates dates with `isValid()` before formatting, falls back to `createdAt`, and shows "This Week" if all else fails. Applied to all unsafe date formatting in MealPlan.tsx (meal plan header and fasting calendar).

### 6. Demo Seed Meal Plan Status

**Problem**: Demo seed created meal plans with `generationStatus='pending'` which caused the frontend to show "generate plan" UI instead of the actual plan.
**Fix**: Updated existing records to `generationStatus='completed'` in Supabase. Demo seed code already creates with correct status.

---

## Known Limitations & Gotchas

1. **Test agent 502 errors**: The Playwright test agent frequently gets 502 when connecting to port 5000. This is a known Replit environment issue, not an app bug. The app works fine via direct curl and screenshots.

2. **Chat history has no session picker UI**: The backend has `GET /api/chat/sessions` to list past sessions, but the frontend only shows the current session's history. Closing the browser tab loses the session ID.

3. **TS6305 errors from `tsc --noEmit`**: Pre-existing TypeScript errors from unbuilt monorepo workspace `dist/` references. Runtime works fine via esbuild. These are not real bugs.

4. **Embedding queue on startup**: The API server starts a background embedding queue on boot (`Starting background embedding queue: 12311 recipes to embed`). This runs at ~3/minute via Voyage AI and takes a very long time. It's non-blocking and doesn't affect functionality.

5. **Vite `allowedHosts: true`**: Required because the Replit preview pane proxies requests through an iframe from a different origin.

6. **`DEMO_MODE=true`** is set in development environment but is NOT required for the demo endpoint to work. `GET /api/demo/instant` works regardless.

---

## External Dependencies

### AI Services
- **Google Gemini 2.5 Flash**: Chat, meal plan generation, nutrition analysis, voice parsing. Uses Replit Gemini AI integration (modelfarm).
- **Voyage AI (voyage-3)**: Embedding provider for recipe vector search. Uses `VOYAGE_API_KEY`. 1024-dimensional vectors.
- **Sarvam AI**: Speech-to-Text for Indian languages.
- **YOLOv11**: External HTTP endpoint for food detection (demo mode available).

### Key npm Packages
- `express` (HTTP server), `drizzle-orm` + `drizzle-zod` (ORM), `zod` (validation)
- `orval` (OpenAPI codegen), `@tanstack/react-query` (state), `wouter` (routing)
- `framer-motion` (animations), `recharts` (charts), `date-fns` (date formatting)
- `jsonwebtoken` + `bcryptjs` (auth), `pino` + `pino-http` (logging)
- `esbuild` (API bundling), `vite` (frontend bundling), `tailwindcss` v4 (styling)
