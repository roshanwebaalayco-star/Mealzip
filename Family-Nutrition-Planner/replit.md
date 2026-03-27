# ParivarSehat AI / NutriNext — Family Nutrition Planner

## Overview

India-centric AI-powered family meal planning app built for a hackathon. Key differentiators:
- **58,711-recipe dataset** (source CSV) de-duplicated and filtered to 12,771 complete entries seeded into PostgreSQL — the full 58K dataset is the project's data foundation; 12,771 is the production-ready cleaned subset
- **ICMR-NIN 2024** nutrition science with reference RDA table (22 records covering all age/gender/activity groups)
- **YOLOv11 food scanner** (CONFIDENCE_THRESHOLD=0.65; DEMO_MODE=true in dev returns mock scan data; production requires `YOLOV11_INFERENCE_URL`)
- **Sarvam AI multilingual voice** support (Hindi/Bhojpuri/Bengali/Tamil) — mic button in dashboard chat and family voice profile
- **Harmony Score** (0-100) for family meal optimization, computed by Gemini
- **Liquid Glass 2025+** design system
- **Multi-faith fasting calendar** — Hindu (Ekadashi/Navratri/Shivratri), Islamic (full Ramadan month), Jain (Paryushana), Sikh (Vaisakhi)

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24 / TypeScript 5.9
- **API**: Express 5 + Drizzle ORM + PostgreSQL
- **Validation**: Zod v4 + drizzle-zod + OpenAPI codegen (Orval)
- **Frontend**: React + Vite + TanStack React Query + Framer Motion + Wouter
- **AI**: Gemini 2.5 Flash (meal plan generation, nutrition analysis, voice profile parsing, symptom advisor)
- **Voice**: Sarvam AI (STT) — `POST /api/voice/transcribe`
- **Scanner**: YOLOv11 inference (food detection) — `POST /api/nutrition/food-scan`
- **Build**: esbuild (api-server bundle), Vite (frontend)

## Structure

```text
├── artifacts/
│   ├── api-server/         # Express API (port from $PORT, default 8080)
│   │   └── src/lib/
│   │       ├── festival-fasting.ts  # Single source of truth: multi-faith fasting calendar (2026)
│   │       ├── icmr-nin.ts          # ICMR-NIN 2024 RDA targets per age/gender/activity (uses vitaminC camelCase)
│   │       └── diet-tag.ts          # Shared helpers: parseDietTag, resolveDietPreference (strips diet_type: prefix)
│   └── nutrinext/          # React frontend (preview at /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen
│   ├── api-client-react/   # Generated TanStack Query hooks
│   ├── api-zod/            # Generated Zod schemas (only export from ./generated/api)
│   ├── db/                 # Drizzle schema + DB client
│   └── integrations-gemini-ai/  # Gemini AI client + batch utilities
├── scripts/
│   ├── seed-recipes.ts     # Seeds 12,771 recipes from CSV (--force to re-seed)
│   └── seed-icmr-nin.ts    # Seeds ICMR-NIN RDA reference data
└── attached_assets/        # CSV data + PDFs (COMBINED_RECIPES_*.csv)
```

## Database Tables

- `families` — family profiles (monthlyBudget as integer in rupees)
- `family_members` — member profiles (weightKg, heightCm as real)
- `meal_plans` — generated meal plans (harmonyScore as real, totalBudgetEstimate as integer)
- `recipes` — 12,771 seeded recipes (calories/protein/carbs/fat/fiber/iron/calcium as real; zone, course, isForeign, totalTimeMin columns); GIN full-text index on name+nameHindi+ingredients
- `icmr_nin_rda` — ICMR-NIN 2024 RDA reference (22 records)
- `conversations` + `messages` — Gemini chat history
- `meal_feedback` — per-meal like/dislike/rating for feedback-driven regeneration
- `health_logs` + `nutrition_logs` — daily health tracking
- `grocery_lists` — weekly grocery lists with cheaper swap alternatives

## Key API Endpoints

### Families & Members
- `GET/POST /api/families` — family CRUD
- `GET/POST/PUT/DELETE /api/families/:id/members` — member CRUD
- `POST /api/voice/parse-profile` — Sarvam voice → family profile JSON

### Meal Plans
- `GET /api/meal-plans?familyId=N` — list plans (newest first)
- `POST /api/meal-plans/generate` — generate AI meal plan (DB-first + Gemini)
- `POST /api/meal-plans/:id/regenerate` — regenerate with feedback constraints (DB re-search + Gemini)
- `GET /api/meal-plans/:id` — get specific plan
- `PUT /api/meal-plans/:id` — update plan
- `DELETE /api/meal-plans/:id` — delete plan
- `POST /api/meal-plans/:id/feedback` — submit meal feedback

### Recipes & Nutrition
- `GET /api/recipes` — list recipes (search, filter by diet/cuisine/category/maxCookTime/maxCalories)
- `GET /api/nutrition/lookup?q=<food>&grams=<n>` — nutrition lookup (recipe_db → icmr_nin → generic_estimate)
- `POST /api/nutrition/food-scan` — YOLOv11 food image scanning with confidence filtering
- `GET /api/fasting-calendar?year=N&month=N` — multi-faith fasting calendar

### Grocery
- `POST /api/grocery/generate` — generate weekly grocery list with Gemini
- `GET /api/grocery/cheaper-alternative?item=<name>&budget=<INR>&diet=<type>` — DB-backed cheaper ingredient alternative lookup

### Health & Voice
- `GET/POST /api/health-logs` — daily health logging
- `GET/POST /api/nutrition-logs` — daily nutrition logging
- `POST /api/voice/transcribe` — Sarvam STT (voice → text)
- `POST /api/symptom-check` — Gemini symptom advisory (with disclaimer)

### Demo & Utility
- `GET /api/demo/sharma-family` — demo family data
- `POST /api/demo/seed` — seed demo family
- `GET /api/healthz` — health check

## Frontend Pages

1. **Dashboard** (`/`) — Harmony Score, family overview, Kal Kya Banayein voice chat, AI insights
2. **Meal Plan** (`/meal-plan`) — 7-day grid (breakfast/lunch/dinner/snack) with ICMR-NIN color indicators, per-member variations, 3-step leftover chains
3. **Recipe Explorer** (`/recipes`) — searchable + filterable 12,771-recipe database
4. **Family Setup** (`/family-setup`) — add/edit family, members, health conditions, fasting prefs
5. **Chat** (`/chat`) — Gemini AI assistant for nutrition questions
6. **Scanner** (`/scanner`) — food image scanner + manual entry fallback + pantry mode
7. **Grocery** (`/grocery`) — weekly grocery list with cheaper swap alternatives
8. **Health** (`/health`) — daily health + nutrition logging with ICMR-NIN targets
9. **Nutrition** (`/nutrition`) — ICMR-NIN RDA reference view + Harmony Score breakdown

## TypeScript Project References

All packages use `composite: true`. Build order:
1. `lib/db` → `lib/api-zod` → `lib/integrations-gemini-ai`
2. `lib/api-client-react` (depends on TanStack React Query)
3. `artifacts/api-server` (depends on db, api-zod, integrations-gemini-ai)
4. `artifacts/nutrinext` (depends on api-client-react)

## Authentication

JWT-based auth system added (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`).
- JWT tokens stored in `localStorage` with key `parivarsehat_token`
- `setAuthTokenGetter()` is called in `main.tsx` to auto-attach bearer token to all API requests
- Frontend pages: `/login`, `/register` with language selector
- Layout sidebar shows user name/email with logout button when logged in
- Families have an optional `userId` foreign key for future per-user scoping

## Dev Server Architecture

In development, the Express API server (port 8080 / external port 80) acts as a unified entry point:
- Requests to `/api/*` → handled directly by Express
- All other requests → proxied to the Vite dev server (port 24170 / external 3000)

This means the Replit preview (which uses external port 80) correctly serves the React frontend while API calls work natively. The Vite dev server also has its own `/api` proxy (→ port 8080) for direct access via port 24170/3000.

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection (Replit-managed)
- `AI_INTEGRATIONS_GEMINI_BASE_URL` — Gemini AI endpoint (auto-set by Replit AI Integration)
- `AI_INTEGRATIONS_GEMINI_API_KEY` — Gemini AI key (auto-set by Replit AI Integration, dummy value)
- `JWT_SECRET` — JWT signing secret (auto-generated, stored in shared env)
- `SARVAM_API_KEY` — Sarvam AI voice (set as secret; voice/transcribe returns 503 if missing)
- `YOLOV11_INFERENCE_URL` — YOLOv11 service URL (optional; 503 if missing in production)
- `DEMO_MODE=true` — **development only** — enables mock scanner data when YOLO URL missing
- `PORT` — set by Replit per artifact

## Fasting Auto-Detection

The meal plan generator auto-detects fasting weeks without user input:
1. **Festival calendar** (`src/lib/festival-fasting.ts`) — checks all 7 days of target week against the shared 2026 multi-faith calendar (Hindu Ekadashi/Navratri/Shivratri, Islamic Ramadan all 29 days, Jain Paryushana, Sikh Vaisakhi)
2. **Member weekly fasting** — checks if any member has `fasting:<day>` in dietaryRestrictions matching any day in the target week
3. **Override** — explicit `preferences.isFasting` always wins over auto-detection
4. **Fasting filter** — uses `course === "fasting"` with ingredient-based fallback (sabudana/kuttu/singhara) when fewer than 20 recipes found

## Leftover Chain

For each dinner meal, a 3-step leftover chain is built:
1. **DB lookup**: Find related recipes from recipe DB matching dinner's key ingredient via `ilike`
2. **Step 1 (Lunch next day)**: DB recipe using leftover dinner base → source: `recipe_db`
3. **Step 2 (Breakfast day after)**: DB recipe with same ingredient → source: `recipe_db`
4. **Step 3 (Snack)**: AI-generated description → source: `ai_generated`
5. `nutritionSummary.leftoverChainSource: "recipe_db_primary_ai_fallback"` in API response

## Security

- Family member UPDATE/DELETE routes are scoped by both `memberId` AND `familyId` (prevents cross-family member manipulation)

## Seeding

```bash
# From project root:
pnpm --filter @workspace/scripts run seed-recipes            # Skip if already seeded
pnpm --filter @workspace/scripts run seed-recipes -- --force # Force re-seed (TRUNCATE)
pnpm --filter @workspace/scripts run seed-icmr              # ICMR-NIN RDA data
```

Recipe seed stats: 12,771 total; 11,717 with real totalTimeMin (4–2925 min); 3,761 foreign; 9,010 Indian.

## Design System

Liquid Glass 2025+ (`artifacts/nutrinext/src/index.css`):
- `glass-panel`, `glass-card`, `glass-sidebar` — frosted glass surfaces
- `btn-liquid` — liquid button with hover effects
- `nav-active` — active navigation state
- Framer Motion stagger animations (use string names like `"easeOut" as const` in Variants)

## Recent Feature Additions (Tasks #6–#9)

### Family Member Form (Task #6)
- Expanded health conditions to 10 options: Diabetes, Hypertension, Obesity, Anemia, Thyroid, High Cholesterol, PCOD, Growing Child, Elderly (60+), None — with mutual exclusion for "None"
- Expanded fasting days to 8 options: Monday–Saturday + Ekadashi + Ramadan + Friday + None — with mutual exclusion for "None"
- Added Food Allergies text input (comma-separated, sent as `allergies[]` to API)
- Inline validation for required Name and Age fields (red error text, no toast)
- Stable React keys via `_id` counter (prevents component reuse on member removal)
- Added Spouse role option

### Pantry Screen (Task #7)
- New "My Pantry" tab in the Grocery page (tabbed UI: Grocery List | My Pantry)
- 20 quick-add common Indian pantry staples (chips UI)
- Text input for custom items (Enter key + Add button)
- Items stored in `localStorage` keyed by `pantry_${familyId}` — persists across sessions
- Grocery list generation automatically passes `pantryIngredients` + `updateMode: "subtract"` when pantry is non-empty
- Generate button shows pantry item count, success toast includes exclusion note

### Meal Plan Card UX (Task #8)
- Today's day card highlighted with a primary-colored ring and dot indicator
- Breakfast name preview shown on collapsed day cards
- Carbs badge added alongside calories and protein badges
- "Expand All" / "Collapse All" button to open all 7 day cards at once
- Clicking any card when Expand All is active collapses all and shows only that card

### Grocery Sharing & Language Toggle (Task #9)
- Share button in grocery list header: uses Web Share API (mobile/WhatsApp-native) with clipboard fallback
- Shared text is formatted with categories, item names, quantities, and prices
- Language toggle button (English ↔ हिंदी) in grocery list header — switches all item names to Hindi when available
- Language toggle uses the existing app-wide LanguageContext (`toggleLang`)

## Known Limitations

- **Fasting calendar is 2026-centric**: Festival/fasting dates are hardcoded for 2026 (Gregorian). For other years, the API falls back to 2026 data and sets `isFallbackYear: true` in the response; the UI shows an amber note when this happens. A dynamic Indian calendar calculation engine would be needed for multi-year correctness.
- **External service dependencies**: `SARVAM_API_KEY` is required for voice transcription; without it, POST /api/voice/transcribe returns 503. `YOLOV11_INFERENCE_URL` is required for live food scanning; without it, the scanner requires `DEMO_MODE=true` for demo data. In production builds, both keys must be configured.
- **Recipe dataset**: Source CSV is 58,711 rows; 12,771 complete-nutrition entries are seeded into PostgreSQL. The remaining rows lack calorie/nutrition fields and are filtered out during ingestion. The integration test suite validates that ≥1,000 seeded recipes exist.
- **Gemini AI dependency**: Meal plan generation, symptom advice, grocery generation, and voice profile parsing all require a valid Gemini API key via the Replit AI integration. In demo mode (`DEMO_MODE=true`), a hardcoded 7-day plan is returned without Gemini calls.

## Testing

Integration tests: `pnpm --filter @workspace/api-server run test`
Covers: nutrition lookup, food scan (demo mode), recipe search, fasting auto-detection endpoint, seed pipeline count (16 tests).
