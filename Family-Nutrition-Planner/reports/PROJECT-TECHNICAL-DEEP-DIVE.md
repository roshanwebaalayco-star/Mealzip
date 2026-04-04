# ParivarSehat AI / NutriNext — Complete Technical Deep Dive

**Version:** 1.0
**Date:** April 4, 2026
**Purpose:** Comprehensive reference document for presentation/slide content generation

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Tech Stack](#3-tech-stack)
4. [Database Architecture](#4-database-architecture) (19 tables)
5. [Frontend Pages & Features](#5-frontend-pages--features)
6. [API Endpoints](#6-api-endpoints)
7. [The "One Base, Many Plates" Algorithm](#7-the-one-base-many-plates-algorithm)
8. [Deterministic Clinical Safety Engine](#8-deterministic-clinical-safety-engine)
9. [Clinical Modules](#9-clinical-modules)
10. [Medication Guardrails](#10-medication-guardrails)
11. [AI Chat System](#11-ai-chat-system)
12. [Voice & Multilingual Support](#12-voice--multilingual-support)
13. [Budget Engine](#13-budget-engine)
14. [Festival & Fasting Calendar](#14-festival--fasting-calendar)
15. [Food Scanner & Pantry Vision](#15-food-scanner--pantry-vision)
16. [Grocery & Market Intelligence](#16-grocery--market-intelligence)
17. [Harmony Score System](#17-harmony-score-system)
18. [System Architecture Diagram](#18-system-architecture-diagram)
19. [Key Metrics & Numbers](#19-key-metrics--numbers)

---

## 1. PROJECT OVERVIEW

### What Is ParivarSehat AI?

ParivarSehat AI (branded as NutriNext) is an India-centric, AI-powered family meal planning application. It addresses a fundamental challenge in Indian households: **how to cook one meal that safely serves every family member** — from a diabetic grandfather on Metformin, to a pregnant daughter-in-law with anaemia, to an underweight child, to a Jain grandmother who can't eat root vegetables.

### The Core Innovation: "One Base, Many Plates" (OBMP)

Instead of generating separate meals for each person (impractical in Indian joint-family kitchens), the system generates a **single base dish** (e.g., Dal Palak) and computes **per-member plate modifications** — ingredient additions, removals, portion adjustments, and cooking-step interventions — all determined by a **deterministic clinical constraint engine** before the AI ever sees the prompt.

### The Problem It Solves

1. **Clinical safety in family cooking** — Families with mixed health conditions (diabetes + kidney disease + pregnancy) need medically precise nutrition guidance, not generic "eat healthy" advice
2. **Indian cultural complexity** — Jain root-vegetable bans, Ekadashi fasting, Ramadan sehri/iftar, sattvic no-onion-garlic rules — all must coexist with clinical needs
3. **Budget-constrained nutrition** — Delivering ICMR-NIN-compliant nutrition within ₹5,000–15,000/month budgets across Tier-1 to Tier-3 Indian cities
4. **Medication-food interaction safety** — 10+ drug-nutrient interaction rules (Warfarin + Vitamin K, Levothyroxine + soy, Iron + calcium) enforced deterministically

### Target Audience

- Indian families (2–8 members) with mixed dietary needs
- Households managing chronic conditions (diabetes, hypertension, CKD, PCOS, anaemia)
- Pregnant/lactating women needing trimester-specific nutrition
- Budget-conscious families in Tier-1 to Tier-3 Indian cities

---

## 2. ARCHITECTURE OVERVIEW

### Monorepo Structure

The project uses a **pnpm workspaces monorepo** with the following package layout:

```
Family-Nutrition-Planner/
├── artifacts/
│   ├── api-server/          # Express.js backend (API + engine)
│   ├── nutrinext/           # React + Vite frontend
│   └── mockup-sandbox/      # Component preview server
├── lib/
│   ├── db/                  # Drizzle ORM schemas + dual-pool DB client
│   ├── api-spec/            # OpenAPI specification + Orval codegen
│   ├── api-client-react/    # Generated TanStack Query hooks
│   └── integrations-gemini-ai/  # Gemini AI client wrapper
├── scripts/                 # Seeding scripts (12,771 recipes)
└── knowledge_base/          # ICMR-NIN guidelines, meal patterns (RAG sources)
```

### How Frontend ↔ Backend ↔ Database Connect

1. **Frontend (React on port 5000)** makes REST API calls to the backend. In development, Vite proxies `/api/*` requests to the Express server on port 8080.
2. **Backend (Express on port 8080)** handles all business logic. It runs the deterministic clinical engine in-memory, then calls Gemini 2.5 Flash for recipe creativity.
3. **Database (Dual-Pool PostgreSQL):**
   - **Local PostgreSQL (Replit DB):** Stores 12,771 cleaned Indian recipes, 22 ICMR-NIN RDA rows, and 168 RAG knowledge chunks. Optimized for fast full-text search with GIN indexes and `ts_rank`.
   - **Supabase (Remote):** Stores all user data — families, members, meal plans, health logs, grocery lists, leftover tracking. Handles authentication and persistent state.
4. **Authentication:** JWT-based. Tokens stored in `localStorage`, attached as `Bearer` tokens via a custom `apiFetch` wrapper. The backend validates JWTs on every protected route.
5. **API Client Generation:** The project uses **Orval** to auto-generate TanStack React Query hooks from an `openapi.yaml` specification, ensuring type-safe frontend-backend contracts.

---

## 3. TECH STACK

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| Vite | 7.3 | Build tool and dev server |
| TypeScript | 5.x | Type safety |
| TanStack React Query | Latest | Server state management, caching |
| Wouter | Latest | Lightweight client-side routing |
| Tailwind CSS | Latest | Utility-first styling ("Liquid Glass 2025+" design) |
| Framer Motion | Latest | Animations and transitions |
| Radix UI | Latest | Accessible UI primitives (Dialog, Select, Toast, etc.) |
| Recharts | Latest | Data visualization (nutrition charts, health graphs) |
| Zustand | Latest | Client-side state management |
| Lucide React | Latest | Icon library |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 24.x | Runtime |
| Express | 5.0 | HTTP framework |
| TypeScript | 5.x | Type safety |
| Drizzle ORM | Latest | Type-safe SQL queries with dual-pool support |
| Zod | Latest | Runtime schema validation (API inputs + AI outputs) |
| Pino | Latest | Structured JSON logging |
| JWT (jsonwebtoken) | Latest | Authentication tokens |
| esbuild | Latest | Fast TypeScript bundling for production |

### AI & ML Services

| Service | Model/Version | Purpose |
|---|---|---|
| Google Gemini | 2.5 Flash | Meal plan generation, recipe creativity, chat, food scanning |
| Voyage AI | voyage-3 | 1024-dimensional recipe embeddings for semantic search |
| Sarvam AI | Latest | Indian-language voice transcription (Hindi, Tamil, Telugu, etc.) |
| Google text-embedding-004 | Latest | Knowledge base embeddings for RAG retrieval |

### Database & Infrastructure

| Technology | Purpose |
|---|---|
| PostgreSQL (Replit) | Local DB for recipes, ICMR-NIN data, RAG knowledge chunks |
| PostgreSQL (Supabase) | Remote DB for user data, meal plans, health logs |
| pgvector extension | Vector similarity search for RAG and recipe embeddings |
| pnpm workspaces | Monorepo package management |

---

## 4. DATABASE ARCHITECTURE

### Dual-Pool Design

The system uses two separate PostgreSQL databases accessed through a unified Drizzle ORM layer:

- **Pool 1 (Local/Replit):** Static reference data. Fast queries, no network latency. Contains recipes (12,771), ICMR-NIN RDA tables (22 rows), and RAG knowledge chunks (168 sections).
- **Pool 2 (Supabase/Remote):** Dynamic user data. Scalable, backed up, multi-tenant. Contains families, members, meal plans, health logs, grocery lists.

### Complete Schema (19 Tables)

#### Core Identity & Family Structure

| Table | Key Columns | Purpose |
|---|---|---|
| `users` | id, email, passwordHash, name, primaryLanguage, isVerified | User authentication and profile |
| `families` | id, userId (FK), name, stateRegion, householdDietaryBaseline, mealsPerDay, cookingSkillLevel, appliances (JSONB), pincode | Household-level preferences |
| `family_members` | id, familyId (FK), name, age, gender, heightCm, weightKg, activityLevel, primaryGoal, dailyCalorieTarget, dietaryType, spiceTolerance, healthConditions (JSONB), allergies (JSONB), fastingConfig (JSONB) | Individual nutrition profiles |

#### Planning & Context

| Table | Key Columns | Purpose |
|---|---|---|
| `weekly_contexts` | id, familyId (FK), weekStartDate, eatingOutFrequency, weekdayCookingTime, weekendCookingTime, weeklyPerishableBudgetOverride, specialRequest, pantrySnapshot (JSONB) | Weekly situational input |
| `member_weekly_contexts` | id, weeklyContextId (FK), familyMemberId (FK), currentGoalOverride, currentWeightKg, feelingThisWeek, activeMedications (JSONB), fastingDaysThisWeek (JSONB), ekadashiThisWeek, festivalFastThisWeek | Per-member weekly overrides (medications, fasting, illness) |
| `meal_plans` | id, familyId (FK), weeklyContextId (FK), harmonyScore, generationStatus, days (JSONB), nutritionalSummary (JSONB), harmonyScoreBreakdown (JSONB) | Generated 7-day meal schedules |

#### Inventory & Budgeting

| Table | Key Columns | Purpose |
|---|---|---|
| `grocery_lists` | id, familyId (FK), mealPlanId (FK), listType, weekStartDate, totalEstimatedCost, status, items (JSONB) | Auto-generated grocery lists (3 types: staples, perishables, buffer) |
| `pantry_items` | id, familyId (FK), name, quantity, unit, expiryDate, isAvailable, costPerUnit | Current kitchen/fridge inventory |
| `monthly_budgets` | id, familyId (FK), monthYear, totalMonthlyBudget, staplesBudget, perishablesBudget, bufferBudget, dailyPerishableLimit | Financial tracking per family |
| `leftover_items` | id, familyId (FK), ingredientName, quantityEstimate, loggedAt, expiresAt, usedUp | Cooked-food reuse tracking with 48-hour TTL |

#### Logging & Feedback

| Table | Key Columns | Purpose |
|---|---|---|
| `nutrition_logs` | id, familyId (FK), memberId (FK), logDate, mealType, foodDescription, calories, proteinG, carbsG, fatG, source (manual/scan) | Actual food intake tracking |
| `health_logs` | id, familyId (FK), memberId (FK), logDate, weightKg, bmi, bloodSugar, bloodPressureSystolic, bloodPressureDiastolic, symptoms (Text Array) | Biometric and symptom tracking |
| `meal_feedback` | id, familyId (FK), mealPlanId (FK), dayIndex, mealType, rating, liked (Boolean), skipReason | User ratings of generated meals |

#### Knowledge & Reference (RAG)

| Table | Key Columns | Purpose |
|---|---|---|
| `recipes` | id, name, cuisine, category, diet, ingredients, instructions, calories, protein, prepTimeMin, tags (Array), searchVector (tsvector), embedding (vector-1024) | 12,771 cleaned Indian recipes with full-text search and vector embeddings |
| `icmr_nin_rda` | id, ageGroup, gender, activityLevel, calories, proteinG, fatG, carbsG, ironMg, calciumMg | Official Indian nutritional guidelines (22 rows) |
| `knowledge_chunks` | id, source, chunkIndex, content, embedding (vector-1024), metadata (JSONB) | 168 vectorized chunks from ICMR-NIN guidelines for RAG retrieval |
| `food_gi_nutrition` | id, foodName, giValue, glValue, servingSize, calories, carbsG, fiberG, proteinG | Glycemic Index/Glycemic Load lookup for Indian foods |

#### AI & Communication

| Table | Key Columns | Purpose |
|---|---|---|
| `chat_messages` | id, sessionId, familyId, role, text, createdAt | Persistent chat history for clinical AI conversations |
| `ai_chat_logs` | id, familyId, userId, model, inputTokens, outputTokens, latencyMs, createdAt | AI API call analytics and cost tracking |

### Key Relationships

```
users (1) ──→ (N) families
families (1) ──→ (N) family_members
families (1) ──→ (N) weekly_contexts
weekly_contexts (1) ──→ (N) member_weekly_contexts
weekly_contexts (1) ──→ (1) meal_plans
meal_plans (1) ──→ (N) grocery_lists
family_members (1) ──→ (N) nutrition_logs
family_members (1) ──→ (N) health_logs
```

---

## 5. FRONTEND PAGES & FEATURES

### Page Map

| Route | Page | Features |
|---|---|---|
| `/` | **Dashboard** | Family overview, Harmony Score display, "Kal Kya Banayein?" quick AI chat widget with voice input and quick-action chips, member health badges, AI nutritional insights |
| `/login` | **Login** | Email/password authentication |
| `/register` | **Register** | New user registration with language preference |
| `/family-setup` | **Family Setup** | Multi-modal onboarding: manual form (multi-step), AI chat-based profile building, voice-guided setup. Captures age, gender, activity level, health conditions, dietary type, allergies, spice tolerance, medications |
| `/meal-plan` | **Meal Plan** | 7-day weekly planner (Breakfast, Lunch, Dinner, Snacks). "One Base, Many Plates" visualization showing per-member modifications. Thali Score badges. Prep reminders ("Soak Rajma tonight"). Like/Dislike feedback. Leftover logging |
| `/meal-plan/context` | **Weekly Context** | Weekly check-in: cooking time, eating-out frequency, budget overrides, special requests, per-member medication/fasting updates |
| `/chat` | **AI Chat** | Full-screen clinical nutrition chat. Multilingual support. Action cards (add to grocery, swap meal). Streaming responses via SSE |
| `/recipes` | **Recipe Explorer** | Search and filter 12,771 recipes by cuisine, diet, category, calories, cook time. Full-text search with ranking |
| `/recipes/:id` | **Recipe Detail** | Full recipe view with ingredients, instructions, nutrition breakdown, member-specific modifications |
| `/grocery` | **Grocery** | AI-generated grocery list from meal plan. Mandi price integration with arbitrage alerts. Budget tracking. Pantry subtraction |
| `/pantry` | **Pantry** | Current kitchen inventory management |
| `/pantry-scan` | **Pantry Scan** | AI-powered fridge/pantry photo analysis to detect existing ingredients |
| `/scanner` | **Food Scanner** | Camera-based food detection with nutrition estimation |
| `/health` | **Health Log** | Nutrient intake visualization (actual vs ICMR target). Nutritional Debt Ledger (chronic deficiency tracking). Symptom checker. Weight/BMI, blood sugar, BP graphing |
| `/profile` | **Profile** | User account settings |

### Design System

- **"Liquid Glass 2025+"** design language using Tailwind CSS
- Framer Motion animations throughout
- Radix UI accessible primitives (Dialog, Select, Toast, Tooltip, Sheet, Collapsible)
- Mobile-first responsive layout (bottom nav bar for mobile, sidebar for desktop)
- Custom components: HarmonyScore (circular progress), ThaliScoreBadge, MealGenPopup (animated generation overlay), VoiceAssistantModal, MemberEditSheet

---

## 6. API ENDPOINTS

### Authentication (4 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create new user account |
| POST | `/auth/login` | Authenticate and receive JWT |
| GET | `/auth/me` | Get current user profile |
| POST | `/auth/logout` | End session |

### Family & Member Management (10 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/families` | List user's families |
| POST | `/families` | Create new family |
| GET | `/families/:id` | Get family details with members |
| PUT | `/families/:id` | Update family settings |
| DELETE | `/families/:id` | Remove family |
| GET | `/families/:familyId/members` | List family members |
| POST | `/families/:familyId/members` | Add member (applies Responsible AI calorie rules) |
| PUT | `/families/:familyId/members/:memberId` | Update member profile |
| DELETE | `/families/:familyId/members/:memberId` | Remove member |
| POST | `/families/profile-chat` | Conversational AI profile building |

### Recipes (2 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/recipes` | Search/filter recipes (text search, cuisine, diet, category, calories, cook time) |
| GET | `/recipes/:id` | Full recipe details |

### Meal Plans & Generation (6 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/meal-plans` | List meal plans for a family |
| POST | `/meal-plans/generate` | Generate new 7-day AI meal plan |
| POST | `/meal-gen/generate` | Start complex multi-stage meal generation (returns polling URL) |
| GET | `/meal-gen/:id/status` | Poll generation progress |
| GET | `/meal-gen/:id/conflicts` | Retrieve identified clinical/dietary conflicts |
| POST | `/meal-gen/:id/skip-meal` | Handle skips and rebalance plan |

### Meal Feedback (2 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/meal-plans/:mealPlanId/feedback` | Get all feedback for a plan |
| POST | `/meal-plans/:mealPlanId/feedback` | Log meal feedback (like, dislike, skip, ate out) |

### Nutrition & Food Analysis (4 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/nutrition/analyze` | Analyze nutritional balance against ICMR-NIN targets |
| GET | `/nutrition/lookup` | Search nutritional data for a food item |
| POST | `/nutrition/food-scan` | AI image analysis to detect food items and estimate nutrition |
| GET | `/nutrition/food-gi` | Glycemic Index / Glycemic Load lookup for Indian foods |

### Health & Wellness (6 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/health-logs` | Retrieve health log history |
| POST | `/health-logs` | Log health metrics (weight, blood sugar, BP, symptoms) |
| GET | `/nutrition-logs` | Retrieve food consumption history |
| POST | `/nutrition-logs` | Log a meal (manual or from scanner) |
| GET | `/nutrition-summary/:memberId` | Today's nutritional progress vs ICMR-NIN RDA |
| POST | `/symptom-check` | AI symptom analysis with dietary suggestions |

### Fasting Calendar (1 endpoint)

| Method | Path | Description |
|---|---|---|
| GET | `/fasting-calendar` | Monthly Indian festival/fasting calendar |

### AI Chat — Clinical (4 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/chat/history` | Load chat history for a session |
| GET | `/chat/sessions` | List chat sessions for a family |
| POST | `/chat` | Main streaming chat (SSE) with clinical context injection |
| GET | `/chat/health` | Chat service health check |

### AI Chat — General / Gemini (6 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/gemini/conversations` | List chat sessions |
| POST | `/gemini/conversations` | Start new session |
| GET | `/gemini/conversations/:id` | Get conversation with history |
| DELETE | `/gemini/conversations/:id` | Delete session |
| POST | `/gemini/conversations/:id/messages` | Send message, get streaming SSE response |
| POST | `/gemini/hfss-classify` | Classify food for HFSS (High Fat, Sugar, Salt) status |

### Voice Services (3 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/voice/transcribe` | Transcribe audio (Base64) to text via Sarvam AI |
| POST | `/voice/parse-profile` | Extract structured family profile from voice transcript |
| POST | `/voice/chat-turn` | Conversational voice turn with state management |

### Grocery & Pantry (4 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/grocery-lists` | List generated grocery lists |
| POST | `/grocery-lists/generate` | Create smart Kirana list from meal plan (subtracts pantry) |
| GET | `/grocery/cheaper-alternative` | Find budget-friendly recipe swaps |
| POST | `/pantry/scan-image` | AI pantry/fridge image detection |

### Market & Mandi (3 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/market/prices` | Real-time Mandi prices with arbitrage opportunities |
| POST | `/market/trigger-surge` | Simulate price surges (demo) |
| POST | `/market/prep-alerts` | Scan upcoming meals for prep warnings |

### Leftover Tracking (4 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/leftovers` | Log a single leftover item |
| POST | `/leftovers/batch` | Log multiple leftovers |
| GET | `/leftovers` | List active (non-expired, unused) leftovers |
| PATCH | `/leftovers/:id` | Mark leftover as used |

### System & Administration (6 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/healthz` | System status (DB connection, knowledge chunks, embedding status) |
| POST | `/admin/reingest` | Force re-ingest RAG knowledge base |
| GET | `/admin/embedding-status` | Check background embedding queue progress |
| POST | `/admin/restart-embedding-queue` | Restart embedding worker |
| POST | `/admin/test-retrieval` | Test RAG vector search directly |
| POST | `/admin/seed-test-families` | Populate DB with clinical test cases |

### Demo Mode (4 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/demo/login` | Auto-login with seeded demo family |
| GET | `/demo/families` | Pre-populated demo family data |
| POST | `/demo/generate` | Demo meal plan generation (skips auth) |
| GET | `/demo/status` | Demo generation status check |

### Health Check Endpoints (8 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/health/status` | Comprehensive system status |
| GET | `/health/db` | Database connectivity check |
| GET | `/health/supabase` | Supabase connection check |
| GET | `/health/embeddings` | Embedding service status |
| GET | `/health/gemini` | Gemini API availability |
| GET | `/health/recipes` | Recipe database stats |
| GET | `/health/knowledge` | Knowledge chunk stats |
| GET | `/healthz` | Quick liveness probe |

**Total: 78 API endpoints** (excluding demo: 74)

---

## 7. THE "ONE BASE, MANY PLATES" ALGORITHM

### End-to-End Pipeline

The OBMP algorithm is a 6-stage pipeline that ensures clinical safety is determined by code (not AI), while recipe creativity is determined by AI (within code-defined guardrails).

#### Stage 1: Input Collection

User provides family ID and week start date. The system loads:
- Family profile (household preferences, region, budget)
- All member profiles (age, weight, health conditions, allergies, dietary type)
- Weekly context (cooking time, eating-out frequency, medications, fasting days)
- Pantry snapshot (existing ingredients to use up)

#### Stage 2: Calorie Calibration

`calorie-calculator.ts` computes precise ICMR-NIN daily targets for each member:
- Uses Mifflin-St Jeor equation with Indian-specific activity multipliers
- Applies age-based adjustments (toddlers, school-age, teens, seniors)
- Adds pregnancy calorie additions (T1: +0, T2: +350, T3: +350, Lactating: +520–600 kcal)
- Computes macro splits: protein (g), carbs (g), fat (g), iron (mg), calcium (mg)

#### Stage 3: Conflict Detection & Resolution

`conflict-engine.ts` runs a 6-level priority conflict detection:

| Level | Type | Example |
|---|---|---|
| L1 | Allergy (Critical) | Peanut allergy → ban all peanut-containing ingredients |
| L2 | Religious | Jain → no root vegetables (onion, garlic, potato) |
| L3 | Medication | Warfarin → Vitamin K consistency mandate |
| L4 | Clinical | Diabetes + high-calorie child → opposing macro needs |
| L5 | Goal | Weight loss vs. weight gain in same family |
| L6 | Preference | Spice tolerance differences |

Each conflict gets a `resolution_type`: modify base dish, add side dish, use pull-before technique, or escalate to parallel dishes.

**Clinical detector calls** (per member):
- `detectT1DConflicts()` — insulin timing, carb floors, fasting conflicts
- `detectPregnancyConflicts()` — trimester-specific rules, co-condition detection
- `detectCKDConflicts()` — stage-specific limits, cross-member protein conflicts

**Medication guardrail generation** (`medicationRules.ts`):
- Parses user medication input (including Indian brand names: Eltroxin, Glycomet, Ecosprin)
- Generates per-drug constraint bundles with forbidden ingredients, timing rules, and positive requirements
- Creates weekly monitor directives (e.g., Warfarin Vitamin K consistency)

#### Stage 4: OBMP Modifier Computation

`one-many-plates.ts` computes plate-level modifications for each family member:

**Output per member:**
- `modifications[]` — Clinical-precision instructions (e.g., "Reduce rice to 100–150g for GI <55")
- `pull_before_step` — Cooking intervention (e.g., "Pull Dadi's portion BEFORE onion/garlic tempering")
- `pull_before_urgency` — Critical/recommended/optional
- `additives[]` — Items to ADD to this member's plate (e.g., "Extra ghee for underweight child")
- `withheld[]` — Items to REMOVE from this plate (e.g., "No salt for hypertension")
- `macro_targets` — Per-meal calorie/protein/carb/fat/sodium targets
- `clinical_flags[]` — Safety warnings (e.g., "CRITICAL: Sabudana is HIGH GI (~70)")
- `harmony_deduction_points` — How much this member's complexity costs the family harmony score

**Escalation logic:** When modifications can't resolve a conflict (e.g., veg vs. non-veg), the system escalates to parallel dishes and honestly reports the escalation.

#### Stage 5: Prompt Chain → Gemini API Call

`prompt-chain.ts` assembles all deterministic constraints into a structured prompt and calls Gemini 2.5 Flash:

**Three sequential Gemini calls:**
1. **Staples List** — Monthly bulk grocery (dry goods only)
2. **Weekly Meal Plan** — The core 7-day, 21-meal plan with OBMP modifiers
3. **Buffer List** — Seasonal fruits and dry fruits

**Prompt structure:**
- Family context section (profiles, dietary baselines)
- Constraint instruction section (all resolved conflicts, medication guardrails)
- OBMP modifier injection section ("These modifications were computed deterministically. Do NOT change or omit them.")
- Budget constraints (regional price context, weekly limits)
- Pantry "must-use" items
- Festival/fasting context for the week

**Key design principle:** The prompt explicitly tells Gemini: "Clinical safety is hardcoded. You handle recipe creativity ONLY within these constraints."

#### Stage 6: Response Processing & Scoring

- **JSON Repair:** `repairTruncatedJSON()` handles common AI response issues (unclosed braces, markdown formatting)
- **Schema Validation:** Zod validates the complete response structure
- **Harmony Scoring:** `harmonyScore.ts` calculates a 1–100 score with itemized deductions and additions
- **Persistence:** Final plan saved to `meal_plans` table; three `grocery_lists` auto-populated

---

## 8. DETERMINISTIC CLINICAL SAFETY ENGINE

### Philosophy: "Clinical Safety Is Code, Not AI"

The engine contains **5,206 lines** of pure deterministic TypeScript logic. This code runs BEFORE Gemini sees any prompt. The AI cannot override, modify, or omit these rules. The modifiers are injected into the prompt as non-negotiable instructions.

### Engine File Inventory

| File | Lines | Purpose |
|---|---|---|
| `conflict-engine.ts` | 1,013 | 6-level conflict detection and resolution. Integrates all clinical detectors. Produces the ConstraintPacket |
| `one-many-plates.ts` | 903 | OBMP algorithm. Computes plate modifiers, pull-before events, escalation logic, and per-member macro targets |
| `medicationRules.ts` | 693 | 10 drug-nutrient interaction rulesets with Indian brand name matching and timing rules |
| `pregnancy.ts` | 556 | 5-stage pregnancy/lactation rules with ICMR-NIN 2020 calorie additions and co-condition detection |
| `ckdStaging.ts` | 549 | 6-stage CKD management with dialysis protein reversal and cross-member protein conflict detection |
| `type1Diabetes.ts` | 435 | 8 insulin types with per-insulin timing, carb floors, hypo-rescue protocols, fasting conflict detection |
| `calorie-calculator.ts` | 368 | ICMR-NIN calorie/macro computation with pregnancy additions and age-based adjustments |
| `harmonyScore.ts` | 354 | 100-point harmony scoring with 4-tier labeling and itemized deduction/addition breakdown |
| `budget-engine.ts` | 335 | Regional budget splitting for 40+ Indian cities with adequacy validation |
| **Total** | **5,206** | **72% of the entire engine codebase is deterministic** |

### Supporting Files

| File | Lines | Purpose |
|---|---|---|
| `meal-generation-service.ts` | 864 | Orchestrator connecting DB, engine, and LLM. Handles polling and async generation |
| `prompt-chain.ts` | 670 | Gemini prompt construction with clinical injection and JSON repair |
| `types.ts` | 483 | Shared TypeScript interfaces (ConstraintPacket, HealthCondition, etc.) |
| **Total Engine Codebase** | **7,223** | |

### The ConstraintPacket

The output of the conflict engine is a structured JSON object containing:

- `effectiveProfiles[]` — per-member computed calorie/macro targets
- `conflicts[]` — all detected conflicts with priority level (1–6) and resolution type
- `resolutions[]` — how each conflict was resolved
- `medicationGuardrailBundles[]` — per-drug constraint bundles with directives
- `medicationWarnings[]` — clinical instruction strings (T1D, pregnancy, CKD)
- `harmonyScore` — overall family score with `deductions[]` and `additions[]`
- `budgetSplit` — staples/perishables/buffer allocation
- `memberPlates[]` — per-member OBMP modifiers

---

## 9. CLINICAL MODULES

### 9.1 Type 1 Diabetes Module (435 lines)

**File:** `src/engine/clinical/type1Diabetes.ts`

**Key features:**

| Feature | Details |
|---|---|
| T1D vs T2D distinction | Separate condition type (`diabetes_type_1`). Carb FLOORS (minimum) instead of carb ceilings (maximum) |
| Insulin timing rules | 8 insulin types: NovoRapid, Humalog, Apidra, Actrapid (rapid-acting), Lantus, Tresiba, Levemir (long-acting), Mixtard (mixed). Per-insulin onset, peak, duration, and must-eat-within timing |
| Carb floor enforcement | Minimum 30g carbs per meal (rapid-acting) to 45g (mixed). Prevents hypoglycemia from low-carb meals |
| Bedtime snack mandate | 15–20g slow carbs before bed to prevent overnight hypoglycemia |
| Exercise carb loading | 15g fast-acting carbs per 30 minutes of activity |
| Fasting conflict detection | T1D + fasting = "critical" severity. Modified fast protocol: 15g carbs every 2 hours. Requires endocrinologist approval |
| Mandatory grocery items | Glucose tablets (Glucon-D), glucose biscuits (Parle-G), fruit juice tetra packs injected into weekly grocery list. Cost added to perishables budget |
| Forbidden practices | Low-carb diets FORBIDDEN for T1D (dangerous). No meal-skipping allowed |

### 9.2 Pregnancy Module (556 lines)

**File:** `src/engine/clinical/pregnancy.ts`

**5 stages with distinct rules:**

| Stage | Calorie Addition | Protein Target | Key Rules |
|---|---|---|---|
| `pregnancy_t1` (Trimester 1) | +0 kcal | 60g/day | Neural tube folate window (600 mcg/day). Nausea management: small frequent meals, ginger remedies |
| `pregnancy_t2` (Trimester 2) | +350 kcal | 68g/day | Iron 27mg/day. DHA 200–300mg/day. Forbidden: raw papaya, raw eggs, excess caffeine |
| `pregnancy_t3` (Trimester 3) | +350 kcal | 75g/day | Iron increased to 30mg/day. Calcium 1000mg/day with 2-hour iron separation |
| `lactating_0_6m` | +600 kcal | 75g/day | Galactagogue additions: saunf (fennel), flaxseeds (alsi) for DHA via breast milk |
| `lactating_7_12m` | +520 kcal | 68g/day | Gradual calorie reduction. Continued iron/calcium support |

**Co-condition detection:**
- Pregnancy + Anaemia: Iron-rich foods at EVERY meal. Vitamin C pairing mandatory. Specific foods: rajma, palak, chana at lunch AND dinner
- Pregnancy + Diabetes (gestational): Strict GI control while maintaining pregnancy calorie additions
- Iron-calcium timing separation: Mandatory 2+ hour gap. "Bedtime snack: warm milk (calcium) — 4 hours after last iron-rich meal"

**Grocery additions:** Folate-rich foods (palak, chana dal, orange), lemon for iron absorption, ragi (calcium + iron), walnuts (5/day for DHA)

### 9.3 CKD Staging Module (549 lines)

**File:** `src/engine/clinical/ckdStaging.ts`

**6 stages with progressive restrictions:**

| Stage | Protein | Potassium | Phosphorus | Sodium | Fluid |
|---|---|---|---|---|---|
| Stage 1–2 | 0.8–1.0 g/kg | 4000 mg | 1200 mg | 2300 mg | No limit |
| Stage 3a | 0.6–0.8 g/kg | 3000 mg | 1000 mg | 2000 mg | No limit |
| Stage 3b | 0.6–0.75 g/kg | 2500 mg | 900 mg | 2000 mg | No limit |
| Stage 4 | 0.6–0.7 g/kg | 2000 mg | 800 mg | 1500 mg | 1500 ml |
| Stage 5 | 0.5–0.6 g/kg | 1500 mg | 800 mg | 1500 mg | 1000 ml |
| Stage 5 Dialysis | **1.0–1.2 g/kg** | 2000 mg | 800 mg | 2000 mg | 1000 ml |

**Critical safety rule — Dialysis Protein Reversal:**
Stage 5 dialysis patients need MORE protein (1.0–1.2 g/kg), not less. Dialysis removes protein from the body. This is the rule that most nutrition apps get wrong.

**Additional features:**
- Leaching technique mandate (Stage 3b+): "Peel, cut thin, soak in warm water 2+ hours, boil in fresh water, discard water"
- High-potassium forbidden foods (Indian-specific): rajma, banana, potato, sweet potato, tomato, palak, coconut water, dates, raisins
- Low-potassium safe foods: apple, papaya, lauki, tinda, parwal, cabbage, cauliflower (leached)
- Cross-member protein conflict detection: Detects bodybuilder HIGH protein vs CKD LOW protein in same family
- Backward compatibility: `kidney_issues` alias maps to Stage 3a rules

---

## 10. MEDICATION GUARDRAILS

### 10 Drug-Nutrient Interaction Rulesets

The medication rules engine (`medicationRules.ts`, 693 lines) handles pharmacologically accurate food-drug interactions. It parses user medication input including Indian brand names and generates deterministic constraint bundles.

| Drug | Indian Brands | Key Constraints |
|---|---|---|
| **Warfarin** | Warf, Acitrom | Vitamin K CONSISTENCY mandate (2–3 servings/week, NOT elimination). Weekly monitor: `keep_consistent` rule. Cranberry/grapefruit avoidance |
| **Levothyroxine** | Eltroxin, Thyronorm | 30–60 min fasting before breakfast. No soy, dairy, coffee at breakfast. Day-wide soy ban. Goitrogen weekly cap of 2 meals |
| **Iron Supplement** | Autrin, Livogen | No dairy/tea within 2 hours. Vitamin C pairing REQUIRED ("converts Fe³⁺ to Fe²⁺, increasing absorption by up to 3x"). Cross-slot conflict with calcium supplement |
| **Metformin** | Glycomet, Glucophage | Must have solid food (not just tea). Timing parsed from user input. No fasting meals |
| **Amlodipine** | Amlong, Stamlo | Grapefruit ZERO tolerance (CYP3A4 inhibition explanation). Salt restriction reinforced |
| **Atorvastatin** | Atorva, Lipitor | Grapefruit avoidance. Evening dosing preferred |
| **Calcium Supplement** | Shelcal, CCM | 2-hour separation from iron. Take with Vitamin D. Best with meals |
| **Insulin** (8 types) | NovoRapid, Lantus, Tresiba, Mixtard | Per-insulin carb floors and timing. Detailed in T1D module |
| **Aspirin** | Ecosprin | Take with food. Avoid on empty stomach |
| **Omeprazole** | Omez, Pantop | Take 30 min before meals. May reduce iron/B12 absorption long-term |

### How Medication Rules Flow Into the System

1. User enters medications in weekly context (free text or brand names)
2. `medicationRules.ts` parses input, matches against rule database (including Indian brand aliases)
3. Generates `MedicationGuardrailBundle` per drug with: `drugName`, `directives[]`, `forbiddenIngredients[]`, `timing`, `positiveRequirements[]`
4. Bundles are merged with clinical module warnings (T1D, pregnancy, CKD instruction strings)
5. Combined directives injected into Gemini prompt as "ABSOLUTE — Gemini MUST NEVER violate these"
6. The prompt says: "These are deterministic pharmacology rules, not suggestions. Implement each one exactly."

---

## 11. AI CHAT SYSTEM

### Architecture

The chat system uses a **RAG-augmented, clinically-governed AI** powered by Gemini 2.5 Flash.

### The Mega Prompt

The system prompt (`megaPrompt.ts`) defines the AI's persona and boundaries:

- **Persona:** "ParivarSehat" — an elite Indian household nutritionist
- **Zero Sycophancy Rule:** Strictly forbidden from using phrases like "I'm sorry," "I apologize," or "Great question." Must be direct and clinical
- **Genetic Shield:** Silently adjusts meal suggestions for children if parents have chronic conditions (e.g., if father has diabetes, child gets lower-GI meals preemptively)
- **Medical Safeguard:** Flags drug-food interactions before suggesting any meal
- **Action Protocol:** Uses `---ACTION---` delimiter for triggering frontend events

### Context Assembly

Before every AI call, `assembleContext.ts` builds a comprehensive state payload:

1. **Family Profile** — All member names, ages, health conditions, dietary types
2. **Today's Meal Plan** — Current scheduled meals for reference
3. **Recent Food Logs** — Last 7 days of consumption (calories, macros)
4. **Medication Rules** — Active medications, dosages, and timing constraints
5. **RAG Evidence** — Top-K relevant snippets from ICMR-NIN guidelines

### RAG (Retrieval-Augmented Generation) System

`ragSearch.ts` grounds all health advice in official Indian nutritional guidelines:

**Source Material:**
- `icmr_nin_guidelines.txt` — 43 sections of clinical guidelines
- `icmr_nin_rda.txt` — 37 sections of recommended dietary allowances
- `meal_patterns.txt` — 91 sections of Indian meal patterns

**Retrieval Modes:**
1. **Vector Search** — Uses `text-embedding-004` with cosine similarity for semantic matching
2. **Keyword Search (BM25)** — TF-IDF-based fallback if embedding API is unavailable

**Smart Filtering:** Only "health-related" queries (detected via keywords like "protein", "diabetes", "ghee", "pregnancy") trigger RAG search. Casual queries skip retrieval to save tokens.

### Streaming & Action Parsing

- **Protocol:** Server-Sent Events (SSE) for real-time streaming
- **Buffering:** Text is buffered to detect `---ACTION---` delimiter. Text before delimiter streams as conversation. Text after is parsed as JSON action payload.
- **Action Types:**
  - `cheat_meal_detected` — Triggers macro impact calculation
  - `medication_conflict_warning` — Drug-food interaction alert
  - `leftover_suggestion` — Recipes using leftover ingredients
  - `meal_plan_query` — Handle meal swap requests

### Chat History

- Messages persisted to database with `familyId`, `sessionId`, `role`, `text`
- Sessions are family-scoped (each family has its own conversation threads)
- History loaded as context for continuity across sessions

---

## 12. VOICE & MULTILINGUAL SUPPORT

### Voice Transcription

- **Service:** Sarvam AI — specialized for Indian language voice recognition
- **Supported Languages:** Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, and more
- **Input:** Base64-encoded audio via `/voice/transcribe`
- **Use Cases:**
  - Voice-guided family profile setup (speak family details instead of typing)
  - Voice chat turns with state management
  - Quick meal queries ("Aaj raat ko kya banayein?")

### Profile Extraction from Voice

`/voice/parse-profile` takes a transcribed voice note and extracts structured data:
- Member names, ages, health conditions
- Dietary preferences and restrictions
- Medication information
- Budget and location

### Multilingual Chat

- Chat interface supports language switching (language code sent with each message)
- AI responds in the user's selected language
- Markdown rendering in all supported scripts
- Language preference stored per user (`primaryLanguage` field)

---

## 13. BUDGET ENGINE

### File: `budget-engine.ts` (335 lines)

### Regional Price Baselines

The engine maintains baselines for **40+ Indian cities/states** with per-region cost-of-living adjustments:

| City | Monthly Baseline (Family of 4) |
|---|---|
| Delhi | ₹14,850 |
| Mumbai | ₹16,200 |
| Bokaro | ₹9,800 |
| Indore | ₹10,200 |
| Chennai | ₹12,500 |
| Kolkata | ₹11,300 |

### Budget Split Formula

Every family budget is split into three categories:

| Category | Percentage | Contents |
|---|---|---|
| Staples | 40% | Rice, atta, dal, oil, spices (monthly purchase) |
| Perishables | 50% | Vegetables, fruits, dairy, eggs, meat (weekly purchase) |
| Buffer | 10% | Seasonal fruits, dry fruits, emergency items |

### Budget Features

- **Adequacy Validation:** Warns if budget <65% of regional baseline ("Budget is critically low. Meals will be nutritionally compromised"). Second warning at <80%
- **Eating-Out Adjustment:** 1–2 times/week: 0.88x multiplier. Frequently: 0.72x multiplier
- **Rolling Daily Limit:** `calculateRollingDailyLimit()` adjusts mid-week based on actual spending
- **Family Size Scaling:** Baseline scales linearly per member: `(baseline / 4) × familySize`
- **T1D Medical Override:** Glucose tablets, biscuits, juice packs bypass budget as medical essentials

---

## 14. FESTIVAL & FASTING CALENDAR

### File: `festival-fasting.ts` (170 lines)

### Multi-Faith Coverage

| Faith | Fasting Events Covered |
|---|---|
| Hindu | Ekadashi (bi-monthly), Navratri (Chaitra + Sharad), Shivratri, Sawan Somvar, Karva Chauth |
| Muslim | Ramadan 2026 (all 29 days with sehri/iftar timing), Eid |
| Jain | Paryushana, Mahavir Jayanti |
| Sikh | Gurpurab |

### Data Structure per Entry

Each calendar entry contains:
- `day` — Date
- `name` / `nameHindi` — Festival name in English and Hindi
- `fastingType` — full / partial / none
- `recommendedFoods[]` — Approved fasting foods (e.g., "Sabudana Khichdi, Kuttu Roti, Singhara Atta, Sendha Namak")
- `traditions[]` — Cultural context for the AI

### Clinical + Fasting Integration

- **Diabetic + Sabudana:** "Sabudana is HIGH GI (~70). Limit diabetic member's portion to max 100g. Consider kuttu roti as lower-GI substitute."
- **T1D + Fasting:** Critical severity conflict. Modified fast protocol with minimum 15g carbs every 2 hours
- **Split Handling:** Fasting members get fasting-approved ingredients; non-fasting children get "regular child-appropriate dinner"
- **Ramadan:** All 29 days mapped. Sehri meals are pre-dawn (high-sustenance), iftar meals break fast (dates + hydration first)

---

## 15. FOOD SCANNER & PANTRY VISION

### Food Scanning

- **Endpoint:** `POST /nutrition/food-scan`
- **Technology:** Gemini 2.5 Flash vision capabilities
- **Flow:** User captures food photo → AI detects individual food items → Estimates per-item calories, protein, carbs, fat → Returns structured nutrition breakdown
- **Indian Food Awareness:** Recognizes Indian dishes (roti, dal, sabzi, rice, papad, pickle, raita) and estimates portions typical of Indian servings

### Pantry Vision

- **Endpoint:** `POST /pantry/scan-image`
- **Flow:** User photographs fridge/pantry shelf → AI identifies visible ingredients → Returns structured list of detected items with estimated quantities
- **Integration:** Detected pantry items feed into the meal generation pipeline as "must-use" ingredients, and grocery list generation subtracts them automatically

---

## 16. GROCERY & MARKET INTELLIGENCE

### Smart Kirana List Generation

- **Auto-generation:** After a meal plan is created, three grocery lists are automatically generated:
  1. Monthly Staples (rice, atta, dal, oil, spices)
  2. Weekly Perishables (vegetables, fruits, dairy, eggs)
  3. Buffer Items (seasonal fruits, dry fruits)
- **Pantry Subtraction:** Items already in the pantry are automatically removed from the list
- **T1D Medical Items:** Glucose tablets, glucose biscuits, juice packs added for Type 1 Diabetic members (cost added to perishables budget)

### Mandi Price Integration

- **Real-time Prices:** Fetches current wholesale prices from local mandis (e.g., Bokaro Chas Mandi)
- **Arbitrage Alerts:** Detects price surges and suggests alternatives (e.g., "Paneer prices +55%, swapping for Soya Granules this week")
- **Budget Impact:** Price data feeds into the budget engine for more accurate cost estimates

### Leftover Intelligence

- **Database-Persisted:** Leftover items stored in `leftover_items` table with 48-hour TTL
- **Creative Reuse Chains:** `enrichPlanWithDbLeftoverChains()` creates 3-step ingredient reuse sequences (dinner → next lunch → next breakfast)
- **Harmony Score Bonus:** Using leftovers earns bonus points in the Harmony Score (zero-waste reward)

### Prep Reminders

- **Advance Preparation:** `/market/prep-alerts` scans upcoming meals and generates warnings:
  - "Soak rajma overnight for tomorrow's dinner"
  - "Marinate chicken 4 hours before cooking"
  - "Defrost paneer for lunch preparation"

---

## 17. HARMONY SCORE SYSTEM

### File: `harmonyScore.ts` (354 lines)

### What It Measures

The Harmony Score (0–100) quantifies how well a meal plan serves ALL family members from a single kitchen. It's designed to be **honest** — complex families with many conflicts get lower scores, not artificially inflated ones.

### Scoring Tiers

| Score Range | Tier | Meaning |
|---|---|---|
| 90–100 | Excellent | Minimal modifications needed. Family can share most meals with minor plate adjustments |
| 75–89 | Good | Some parallel cooking needed. Most meals are shared with moderate modifications |
| 60–74 | Moderate | Significant modifications required. Several meals need separate preparation |
| <60 | Challenging | Major dietary conflicts. Many meals require parallel cooking. System is honest about limitations |

### Deduction Examples

| Conflict Type | Points Deducted |
|---|---|
| Kidney-vs-Muscle (opposing protein needs) | -5 |
| Jain-vs-NonVeg (fundamental dietary split) | -5 |
| Diabetic-vs-High-Calorie (opposing macro goals) | -2 |
| Parallel dishes required | -3 per escalation |
| Medication timing creates separate eating schedule | -2 |

### Addition Examples

| Achievement | Points Added |
|---|---|
| Pantry/leftover items successfully used (zero waste) | +2 to +5 |
| T1D member correctly handled with carb floors | +3 |
| CKD member correctly handled (per-stage limits) | +3 |
| Dialysis protein reversal correctly applied | +5 |
| Pregnant member calorie additions applied | +3 |

### Output Format

The Harmony Score card includes:
- Overall score (0–100)
- Tier label (Excellent/Good/Moderate/Challenging)
- Itemized `deductions[]` — each with category, points, and reason
- Itemized `additions[]` — each with category, points, and reason
- Visual breakdown for the frontend

---

## 18. SYSTEM ARCHITECTURE DIAGRAM

```
┌──────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19 + Vite)                    │
│                                                                      │
│  Dashboard │ Family Setup │ Meal Plan │ Chat │ Grocery │ Health Log  │
│  Recipe Explorer │ Pantry Scan │ Food Scanner │ Voice Assistant       │
│                                                                      │
│  [TanStack Query] ←→ [Orval-generated API client] ←→ [apiFetch]    │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ REST API (JWT Auth)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Express 5 + Node.js 24)                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    66 API ENDPOINTS                          │    │
│  │  Auth │ Families │ Recipes │ Meal Plans │ Nutrition │ Health │    │
│  │  Chat │ Voice │ Grocery │ Market │ Leftovers │ Admin         │    │
│  └────────────────────────────┬────────────────────────────────┘    │
│                               │                                      │
│  ┌────────────────────────────▼────────────────────────────────┐    │
│  │           DETERMINISTIC CLINICAL ENGINE (5,206 lines)        │    │
│  │                                                              │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │    │
│  │  │  Conflict    │  │ One Base,    │  │  Calorie        │    │    │
│  │  │  Engine      │  │ Many Plates  │  │  Calculator     │    │    │
│  │  │  (1,013 ln)  │  │  (903 ln)    │  │  (368 ln)       │    │    │
│  │  └──────┬───────┘  └──────────────┘  └─────────────────┘    │    │
│  │         │                                                    │    │
│  │  ┌──────▼───────────────────────────────────────────────┐   │    │
│  │  │           CLINICAL MODULES (1,540 lines)              │   │    │
│  │  │  Type 1 Diabetes │ Pregnancy │ CKD Staging            │   │    │
│  │  │  (435 ln)        │ (556 ln)  │ (549 ln)               │   │    │
│  │  └──────────────────────────────────────────────────────┘   │    │
│  │                                                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │    │
│  │  │ Medication   │  │ Harmony      │  │  Budget          │   │    │
│  │  │ Rules        │  │ Score        │  │  Engine          │   │    │
│  │  │ (693 ln)     │  │ (354 ln)     │  │  (335 ln)        │   │    │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘   │    │
│  └─────────────────────────────┬───────────────────────────────┘    │
│                                │                                     │
│  ┌─────────────────────────────▼───────────────────────────────┐    │
│  │              PROMPT CHAIN (671 lines)                        │    │
│  │  Context Assembly → Constraint Injection → Gemini Call       │    │
│  │  → JSON Repair → Schema Validation → DB Persist              │    │
│  └─────────────────────────────┬───────────────────────────────┘    │
│                                │                                     │
└────────────────────────────────┼─────────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────────┐
              ▼                  ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  Gemini 2.5 Flash │  │ Voyage AI        │  │ Sarvam AI            │
│  (Google)         │  │ (Embeddings)     │  │ (Voice Transcription)│
│                   │  │                  │  │                      │
│  - Meal plans     │  │  - Recipe embeds │  │  - Hindi, Tamil,     │
│  - Chat responses │  │    (1024-dim)    │  │    Telugu, Bengali,   │
│  - Food scanning  │  │  - RAG retrieval │  │    Marathi + more     │
│  - HFSS classify  │  │                  │  │  - Profile extraction │
└──────────────────┘  └──────────────────┘  └──────────────────────┘
              │                  │
              ▼                  ▼
┌────────────────────────────────────────────────────────────────────┐
│                    DUAL-POOL POSTGRESQL                             │
│                                                                    │
│  ┌─────────────────────────┐  ┌──────────────────────────────────┐│
│  │  LOCAL DB (Replit)       │  │  REMOTE DB (Supabase)            ││
│  │                         │  │                                  ││
│  │  12,771 Recipes         │  │  Users, Families, Members        ││
│  │  22 ICMR-NIN RDA rows   │  │  Meal Plans, Grocery Lists       ││
│  │  168 RAG Knowledge      │  │  Health Logs, Nutrition Logs     ││
│  │  Chunks                 │  │  Leftovers, Monthly Budgets      ││
│  │                         │  │  Meal Feedback, Pantry Items     ││
│  │  [GIN + tsvector index] │  │  [Composite indexes]             ││
│  │  [pgvector embeddings]  │  │                                  ││
│  └─────────────────────────┘  └──────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

### Data Flow for Meal Generation

```
User Request
    │
    ▼
Load Family + Members + Weekly Context + Pantry
    │
    ▼
Calorie Calibration (ICMR-NIN targets per member)
    │
    ▼
Conflict Engine (L1-L6 detection + resolution)
    │
    ├──→ T1D Detector (per member)
    ├──→ Pregnancy Detector (per member)
    ├──→ CKD Detector (per member + cross-family)
    ├──→ Medication Guardrails (per drug)
    │
    ▼
OBMP Modifier Computation (per-member plate cards)
    │
    ▼
Harmony Score Calculation
    │
    ▼
ConstraintPacket Assembly
    │
    ▼
Prompt Chain Construction
    │
    ▼
Gemini 2.5 Flash (3 sequential calls: Staples → Meals → Buffer)
    │
    ▼
JSON Repair + Zod Validation
    │
    ▼
DB Persist (meal_plans + 3 grocery_lists)
    │
    ▼
Return to User (with Harmony Score + per-member plate cards)
```

---

## 19. KEY METRICS & NUMBERS

### Codebase Scale

| Metric | Value |
|---|---|
| Total engine codebase | 7,223 lines |
| Deterministic clinical logic | 5,206 lines (72% of engine) |
| Clinical modules (T1D + Pregnancy + CKD) | 1,540 lines |
| Prompt chain + service orchestration | 1,534 lines |
| Type definitions | 483 lines |
| API endpoints | 78 (74 excluding demo) |
| Frontend pages | 15 |

### Data Scale

| Metric | Value |
|---|---|
| Indian recipes in database | 12,771 |
| ICMR-NIN RDA reference rows | 22 |
| RAG knowledge chunks | 168 (from 3 source documents) |
| Database tables | 19 |
| Indian cities with budget baselines | 40+ |
| Festival/fasting calendar entries | 29 Ramadan days + Hindu/Jain/Sikh events |

### Clinical Coverage

| Metric | Value |
|---|---|
| Health conditions supported | 22 types (including T1D, T2D, 5 pregnancy stages, 6 CKD stages, hypertension, PCOS, anaemia, etc.) |
| Drug-nutrient interaction rules | 10 drugs (with Indian brand name matching) |
| Insulin types with per-insulin timing | 8 (NovoRapid, Humalog, Apidra, Actrapid, Lantus, Tresiba, Levemir, Mixtard) |
| Allergen maps | 8+ (dairy, peanuts, tree nuts, soy, gluten, eggs, shellfish, sesame) |
| Conflict priority levels | 6 (Allergy → Religious → Medication → Clinical → Goal → Preference) |

### Test Coverage

| Test File | Test Cases |
|---|---|
| `calorieCalculator.test.ts` | 22 |
| `budgetEngine.test.ts` | 17 |
| `conflictEngine.test.ts` | 15 |
| `harmonyScore.test.ts` | 15 |
| `medicationRules.test.ts` | 17 |
| `test-one-many-plates.ts` | 6 scenarios |
| `icmrNin.test.ts` | 11 |
| `integration.test.ts` | 16 |
| **Total** | **119** |

### Performance Estimates

| Stage | Estimated Latency |
|---|---|
| Profile building + conflict detection | <200ms |
| Clinical detector loop (T1D/Pregnancy/CKD) | <50ms |
| OBMP modifier computation | <300ms |
| Budget + harmony score | <100ms |
| Gemini API calls (3 sequential) | 15–25s |
| JSON parsing + DB write | <500ms |
| **Total end-to-end** | **16–27s** |

### Stress Test Readiness Score

| Phase | Weight | Score |
|---|---|---|
| Architecture Verification | 25% | 88% |
| Edge Case Gauntlet | 30% | 81% |
| Clinical Safety Audit | 30% | 87% |
| Performance & Scale | 15% | 77% |
| **Overall** | | **83.9%** |

---

## APPENDIX: WHAT MAKES THIS SYSTEM UNIQUE

1. **Deterministic-first architecture:** Clinical safety is 5,206 lines of hardcoded rules. AI handles creativity within code-defined guardrails. No hallucination can override a medication rule.

2. **India-specific depth:** Jain root-vegetable bans, sattvic no-onion/garlic, 40+ city budget baselines, multi-faith fasting calendar, Indian brand name drug matching (Glycomet, Eltroxin, Ecosprin), ICMR-NIN 2020 guidelines, regional ingredient awareness (sendha namak, kuttu atta, sabudana, ragi).

3. **The "One Base, Many Plates" concept:** Practical for Indian joint-family kitchens where cooking 4 separate meals isn't feasible. Pull-before events ("pull Dadi's portion before adding garlic") are a real-world cooking technique, not an academic abstraction.

4. **Clinical module depth:** The CKD dialysis protein reversal rule (Stage 5 dialysis needs MORE protein, not less) is a test that most nutrition apps fail. The T1D module handles 8 insulin types with per-insulin carb floors. The pregnancy module covers 5 distinct stages with ICMR-NIN calorie additions.

5. **Honest scoring:** The Harmony Score doesn't inflate results. A family with a vegan bodybuilder + CKD patient + diabetic + Jain grandmother gets a "Challenging" score (<60), not an artificially high number. Transparency builds trust.
