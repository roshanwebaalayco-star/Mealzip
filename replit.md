# ParivarSehat AI / NutriNext — Family Nutrition Planner

## Overview

ParivarSehat AI / NutriNext is an India-centric AI-powered family meal planning web application. Its core purpose is to assist Indian families in creating nutritious meal plans tailored to their specific needs. Key capabilities include leveraging ICMR-NIN 2024 dietary guidelines, accommodating regional cuisine preferences, integrating multi-faith fasting calendars, respecting budget constraints, and supporting individual health goals. The project aims to provide comprehensive and personalized nutrition solutions, enhancing family well-being and promoting healthy eating habits across India.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application adopts a monorepo structure using `pnpm` workspaces, segregating the backend (`api-server`), frontend (`nutrinext`), and a UI prototyping sandbox (`mockup-sandbox`).

**Technical Stack:**
- **Backend**: Node.js 24, TypeScript 5.9, Express 5, Drizzle ORM, PostgreSQL, pino logging.
- **Frontend**: React 18, Vite, Wouter for routing, TanStack React Query for data fetching, shadcn/ui and Tailwind CSS v4 for UI, Framer Motion for animations.

**Core Architectural Decisions:**

*   **Monorepo Structure**: Facilitates co-located development and shared codebases for API, frontend, and libraries.
*   **API-driven Design**: A clear separation of concerns between frontend and backend, communicating via a RESTful API.
*   **Dual Database Strategy**:
    *   **`localDb`**: Utilizes Replit PostgreSQL for static data like recipes and ICMR knowledge chunks, enabling efficient RAG.
    *   **`db`**: Connects to Supabase PostgreSQL for all dynamic user-specific data, including profiles, meal plans, chat history, and logs.
*   **AI Meal Generation Engine**: A multi-step pipeline for personalized meal planning, incorporating calorie calculations, dietary conflict resolution, medication-food interaction guardrails, and Gemini 2.5 Flash for meal plan generation. It calculates a "Family Harmony Score" to optimize meal satisfaction.
*   **SSE Streaming AI Chat**: Implements Server-Sent Events for real-time AI responses using Gemini 2.5 Flash, featuring a mega-prompt system, RAG search (prioritizing BM25 on Replit's modelfarm), and context assembly from user data.
*   **Robust Recipe Search**: Utilizes PostgreSQL's GIN index with weighted `ts_rank` for efficient and relevant full-text recipe searching across name, Hindi name, and ingredients.
*   **ICMR Knowledge Base**: On API server startup, relevant ICMR guidelines are chunked and stored in `knowledge_chunks` for RAG, ensuring nutrition advice is scientifically grounded.
*   **Apple-tier Glass Design System**: The UI/UX prioritizes a clean, modern aesthetic with `shadcn/ui` and Tailwind CSS, focusing on intuitive user experience.

## Key Files and Structure

### Backend Engine (`Family-Nutrition-Planner/artifacts/api-server/src/engine/`)

| File | Lines | Purpose |
|------|-------|---------|
| `meal-generation-service.ts` | 1,162 | Main meal plan generation orchestrator. Routes, family ownership verification, calorie calculation, conflict engine invocation, prompt chain invocation, polling endpoint, SSE status updates. |
| `conflict-engine.ts` | 1,013 | Deterministic constraint packet builder. Resolves dietary conflicts across family members, detects allergy/condition/religious/medication clashes, calculates Family Harmony Score, builds per-member effective profiles with resolved constraints. |
| `prompt-chain.ts` | 841 | Gemini prompt assembly with Sections A-H. Builds absolute prohibitions, meal structure rules, regional cuisine requirements, budget constraints, zero-waste pantry mandates, one-base-many-plates output format. Calls Gemini 2.5 Flash and parses structured JSON response. |
| `calorie-calculator.ts` | — | ICMR-NIN 2024 calorie target calculation, auto-assignment rules, macro guidance, fasting preload instructions, medication interaction resolution. |
| `budget-engine.ts` | — | Monthly budget breakdown (staples/perishables/buffer), per-slot cost limits, cooking time constraint strings. |
| `one-many-plates.ts` | — | Member modifier map builder for the "one base dish, many plates" paradigm. Per-member plate modifications injected into Gemini prompt. |
| `lib/harmonyScore.ts` | — | Harmony Score card builder, plain-text formatter, final result assembler. |
| `lib/medicationRules.ts` | — | Medication guardrail resolution for drug-food interactions. |
| `clinical/type1Diabetes.ts` | 436 | Type 1 Diabetes clinical rules: 8 insulin timing rules, per-meal carb floors, fasting conflict detection, mandatory hypo-rescue grocery items. |
| `clinical/pregnancy.ts` | 557 | Pregnancy clinical rules: 5 stages (3 trimesters + 2 lactation), ICMR-NIN calorie additions, forbidden foods, iron-calcium separation, nausea management. |
| `clinical/ckdStaging.ts` | 550 | CKD Staging clinical rules: 6 stages with per-stage protein/potassium/phosphorus/sodium/fluid limits, dialysis protein reversal, leaching techniques. |

### Backend AI Chat (`Family-Nutrition-Planner/artifacts/api-server/src/lib/`)

| File | Lines | Purpose |
|------|-------|---------|
| `megaPrompt.ts` | 148 | Hardcoded clinical system prompt for Gemini AI chat. 6 rules: Zero Sycophancy (forbidden phrases), Context-First, Zero-Guilt Cheat Meal Adjustment (with `---ACTION---` delimiter), ICMR-Grounded Responses Only, Genetic Shield (silent low-GI/low-sodium for children of diabetic/hypertensive parents), Medical Safeguard (drug-food interactions). |

### Frontend Pages (`Family-Nutrition-Planner/artifacts/nutrinext/src/pages/`)

| File | Lines | Purpose |
|------|-------|---------|
| `Profile.tsx` | 807 | Family profiles page with two sections: (1) Family Settings (state/region searchable dropdown with 28 states + 8 UTs, language toggle, household dietary baseline, meals per day, cooking skill, kitchen appliances multi-select with auto-save), (2) Per-member editing cards (name, age, gender with Male/Female/Other, weight, height, activity level, dietary type, health goal, goal pace, tiffin type, religious/cultural rules, spice tolerance, festival fasting alerts, ingredient dislikes with /5 counter, fasting days, food allergies, health conditions, daily calorie target display in "X,XXX kcal" format). |
| `MealPlan.tsx` | 1,723 | Meal plan display page. Shows 7-day meal grid with breakfast/lunch/dinner slots, member plates, day navigation, recipe viewer trigger. "Generate AI Plan" and "New Plan" buttons navigate to full-page `/meal-plan/generate` (no popup). |
| `MealGenPage.tsx` | 715 | Full-page meal generation form at `/meal-plan/generate`. Monthly budget input with slider, week start date picker, per-member context overrides (weight targets, fasting days, non-veg days/types), pantry snapshot, cooking time preference. Polls generation status and shows step-by-step progress log. Navigates back to `/meal-plan` on completion. |
| `Grocery.tsx` | 1,216 | Grocery list management with 3 tabs: Weekly Perishables (generated from meal plan, with category grouping, cheaper alternative swaps, check-off), Monthly Staples (20 common Indian pantry items), Pantry (user-managed inventory per family). Pincode capture with 6-digit validation and MapPin badge. Budget status, savings tips, seasonal suggestions. Table/list view toggle. |
| `HealthLog.tsx` | 995 | Clinical Insights page. Nutrition summary cards (calories, protein, carbs, fat, fiber, iron, calcium, vitamin C with actual vs target). BMI tracking with category labels (Underweight/Normal/Overweight/Obese). Blood sugar tracking (Low/Normal/Pre-diabetic/High). Blood pressure tracking (Low/Normal/Elevated/High). Symptom logging with AI analysis (urgency: routine/soon/urgent). Recharts line/bar charts for trends. |
| `RecipeExplorer.tsx` | — | Recipe search and browse page (standalone, not in main nav). |
| `RecipeDetail.tsx` | — | Individual recipe detail view. |

### Frontend Components (`Family-Nutrition-Planner/artifacts/nutrinext/src/components/`)

| File | Lines | Purpose |
|------|-------|---------|
| `RecipeViewer.tsx` | 499 | Recipe carousel modal. Shows breakfast/lunch/dinner slides with enriched steps (member modifications at CRITICAL/RECOMMENDED/INFO urgency), member plates (with fasting replacements and tiffin instructions), priority flags (allergy_compliant, low_sodium, medication_window_respected, zero_waste_item_used, etc.), pantry items used, prep/cook time, estimated cost. |
| `MemberEditSheet.tsx` | 365 | Bottom sheet for editing individual family member profiles. Includes religious/cultural rules dropdown with corrected values (`jain_rules`, `sattvic_no_onion_garlic`), dietary type, health conditions, allergies, fasting config. |
| `Layout.tsx` | 223 | App layout with sidebar navigation (desktop) and bottom nav pill (mobile). Exactly 5 nav items: Profile, Meal Plan, Grocery, AI Chat, Clinical Insights. No Recipes nav item. |

## Authentication

- **Method**: JWT-based authentication with `jsonwebtoken` and `bcryptjs` for password hashing.
- **Token storage**: `localStorage.getItem("auth_token")`
- **Protected routes**: Server-side middleware validates JWT on all `/api/*` routes except auth endpoints.
- **Demo mode**: `demo@parivarsehat.ai` / `DemoJudge2025!` or instant via `GET /api/demo/instant`.
- **Logout**: Clears ALL localStorage keys (`auth_token`, `active_family`, `demo_family_cache`, `demo_meal_plan_cache`) and ALL sessionStorage state.

## Navigation (Final Spec)

Exactly 5 items in both desktop sidebar and mobile bottom nav:
1. **Profile** — `/profile`
2. **Meal Plan** — `/meal-plan`
3. **Grocery** — `/grocery`
4. **AI Chat** — `/chat`
5. **Clinical Insights** — `/health`

No "Recipes" or "Home" nav items. Logo click navigates to dashboard.

## Meal Generation Pipeline (Sections A-H)

The meal plan generation follows a strict pipeline:

1. **Calorie Calculation**: ICMR-NIN 2024 RDA-based daily calorie targets per member, adjusted for age, gender, activity level, pregnancy, health conditions.
2. **Conflict Engine** (`runConflictEngine()`): Builds deterministic constraint packet with:
   - Per-member effective profiles (resolved dietary type, health conditions, allergies, medications, fasting days)
   - Detected conflicts with priority levels (1-6) and resolutions
   - Family Harmony Score (0-100) with deductions/additions
   - Medication guardrail bundles (drug-food interaction rules)
   - Effective daily budget and budget breakdown (breakfast/lunch/dinner/snack weights and limits)
   - Pantry zero-waste items
   - Non-veg days by member
3. **Prompt Chain** (`runPromptChain()`): Assembles Gemini prompt with 8 sections:
   - **Section A — Identity**: "You are a clinical Indian nutritionist... You do not have artistic freedom."
   - **Section B — Absolute Prohibitions**: Dynamically built from allergen blocks (7 allergy types with Hindi/Indian ingredient names), dietary type blocks (vegetarian/vegan/Jain/eggetarian), religious blocks (no_beef, no_pork, sattvic_no_onion_garlic, jain_rules), health condition blocks (diabetes, obesity, hypertension, kidney, hypothyroid, PCOS, anaemia), universal meal prohibitions (samosa, pakora, maggi, pizza, kachori, cold drinks, etc.)
   - **Section C — Meal Structure Rules**: Mandatory composition per slot (breakfast = complex carb + protein, lunch = dal + sabzi + roti, dinner = dal + sabzi + lighter than lunch). No fried snacks as primary meals. No repeat main dishes on consecutive days. Whole grains default.
   - **Section D — Budget Constraint**: Weekly/daily/per-slot cost limits with hard limits. Staples pre-purchased and excluded from daily limits.
   - **Section E — Regional Requirement**: 17+ state-specific cuisine hints (Kerala coconut oil + appam, Punjab makki di roti + sarson da saag, etc.)
   - **Section F — Per-member Clinical Constraints**: Resolved conflicts, fasting schedules, non-veg day mapping.
   - **Section G — Zero-waste Pantry Mandate**: Pantry items marked "MUST USE" must appear in meals, prioritized in first 3 days.
   - **Section H — One Base, Many Plates + Output Format**: One base dish per meal slot, per-member plate modifications, fasting replacements, tiffin instructions, priority flags. Exact JSON output schema.
4. **Gemini 2.5 Flash Call**: Temperature 0.3, topP 0.8, thinkingBudget 0, maxOutputTokens 8192.
5. **Response Parsing**: JSON extraction with markdown fence removal, safe parse with truncation repair.

## AI Chat System (megaPrompt.ts — 6 Rules)

| Rule | Name | Description |
|------|------|-------------|
| 1 | Zero Sycophancy | Forbidden phrases: "I'm sorry", "Great question", "Certainly!", "Of course!", "Absolutely!", etc. Clinical reason in one sentence if cannot answer. |
| 2 | Context-First | 4-step check before every response: identify member → cross-reference conditions → cross-reference medications → cross-reference today's meals. |
| 3 | Zero-Guilt Cheat Meal Adjustment | On unplanned food events: no judgment language, calculate macro impact, state which specific meal tomorrow adjusts and how. Appends `---ACTION---` JSON delimiter. |
| 4 | ICMR-Grounded Only | Health education answers based exclusively on injected ICMR EVIDENCE block. No fabricated statistics. Explicit "guidelines do not cover this" fallback. |
| 5 | Genetic Shield (Silent) | If parent has T2D → children's meals default to low-GI. If parent has hypertension → children's meals capped at 1,000mg sodium/day. Never mentioned to user. |
| 6 | Medical Safeguard | Drug-food interaction checking for active medications. |

## Conflict Engine — Condition Dietary Rules

The conflict engine (`conflict-engine.ts`, 1,013 lines) contains clinical dietary rules for:

| Condition | Forbidden | Limited | Mandatory Nutrients | Special Instructions |
|-----------|-----------|---------|---------------------|---------------------|
| `diabetes_type_2` | White/refined sugar, maida, packaged juice | White rice, potato, honey, jaggery, mithai, fried foods | Fibre, complex carbs, lean protein | LOW-GI MANDATE: brown rice/jowar/bajra, whole wheat, dal at every meal |
| `hypertension` | High-sodium pickles, papads, processed snacks, readymade masalas | Salt, cheese, canned foods, salty snacks, baking soda | Potassium, magnesium, calcium | SODIUM LIMIT: ≤1500mg/day, DASH-diet principles |
| `anaemia` | — | Tea/coffee at mealtimes, calcium near iron meals | Iron, vitamin C, folate, B12 | IRON ABSORPTION BOOST: pair iron with vitamin C, schedule tea 1h after iron meals |
| `obesity` | Deep fried foods, mithai, packaged snacks, cold drinks | Ghee, butter, oil, rice, sugar, maida, full-fat dairy | Fibre, lean protein, water-rich vegetables | CALORIE DENSITY: steam/grill/pressure-cook, minimal oil, large salad before meals |
| `high_cholesterol` | Vanaspati, dalda, margarine, trans fats, hydrogenated oil | Ghee (≤1 tsp/day), butter, full-fat dairy, egg yolks (max 3/week) | Soluble fibre, omega-3, plant sterols | Include oats, rajma, flaxseeds for soluble fibre, mustard/olive oil |
| `hypothyroid` | — | Raw cruciferous vegetables, excess soy, excess millet | Iodine, selenium, zinc | Cook cruciferous, iodised salt mandatory, Brazil nuts/pumpkin seeds |
| `pcos` | White/refined sugar, maida | White rice, potato, sweet fruits, full-fat dairy, fried/packaged foods | Fibre, omega-3, magnesium, antioxidants | ANTI-INFLAMMATORY: low-GI, flaxseeds, turmeric, spearmint 2 cups/day |
| `kidney_issues` | Per CKD stage (6 stages) | Per CKD stage protein/potassium/phosphorus/sodium/fluid limits | Per stage | CKD staging with dialysis protein reversal, leaching techniques |
| `diabetes_type_1` | Per clinical module (8 insulin timing rules) | Per-meal carb floors | Balanced carbs per meal | Fasting conflict detection, hypo-rescue grocery items |
| `pregnancy_t1`–`lactation_2` | Per trimester forbidden foods | Per trimester limits | Iron, calcium, folate, DHA (separated timing) | ICMR-NIN calorie additions, nausea management, iron-calcium separation |

## Allergy Ingredient Mapping (7 Types)

| Allergy | Indian-Specific Ingredients Blocked |
|---------|-------------------------------------|
| `peanuts` | peanuts, groundnuts, mungfali, moongphali, peanut oil, groundnut oil, peanut chutney, sattu (if peanut-based), chikki, peanut butter |
| `dairy` | milk, doodh, paneer, curd, dahi, ghee, butter, cream, malai, khoya, mawa, cheese, lassi, raita, rabri, kheer, shrikhand, condensed milk, buttermilk, chaas |
| `gluten` | wheat, atta, maida, suji, semolina, roti, chapati, paratha, naan, bread, pasta, noodles, seviyan, daliya, sooji halwa, wheat bran |
| `tree_nuts` | almonds, badam, cashews, kaju, walnuts, akhrot, pistachios, pista, hazelnuts, pine nuts, chestnut, mixed dry fruits |
| `shellfish` | prawns, jhinga, shrimp, crab, lobster, crayfish, scallops, oysters, mussels, kolambi |
| `soy` | soya chunks, nutrela, soya milk, tofu, soy sauce, soya flour, edamame, tempeh, miso, soy protein |
| `sesame` | til, sesame seeds, tahini, til chutney, til ladoo, gingelly oil, til gajak, til oil |

## Religious/Cultural Rules Mapping

| Rule Value | Ingredients Blocked |
|------------|---------------------|
| `no_beef` | beef, veal, beef broth, ox tail, beef tallow |
| `no_pork` | pork, bacon, ham, lard, pork rinds, prosciutto |
| `sattvic_no_onion_garlic` | onion, pyaz, kanda, garlic, lehsun, leek, spring onion, chives, shallots |
| `jain_rules` | onion, pyaz, kanda, garlic, lehsun, potato, aloo, carrot, gajar, radish, mooli, beetroot, turnip, shalgam, spring onion, leek, shallots, celeriac, parsnip, sweet potato, shakarkand, yam, suran, taro, arbi, eggplant, brinjal, baingan |

## Profile Page — Family-Level Settings

The family settings section (collapsible) in Profile.tsx includes:

- **State / Region**: Searchable dropdown with 28 Indian states + 8 UTs (Andhra Pradesh, Arunachal Pradesh, Assam, Bihar, Chhattisgarh, Goa, Gujarat, Haryana, Himachal Pradesh, Jharkhand, Karnataka, Kerala, Madhya Pradesh, Maharashtra, Manipur, Meghalaya, Mizoram, Nagaland, Odisha, Punjab, Rajasthan, Sikkim, Tamil Nadu, Telangana, Tripura, Uttar Pradesh, Uttarakhand, West Bengal + Delhi, Chandigarh, Puducherry, Ladakh, J&K, Andaman & Nicobar, Dadra & Nagar Haveli, Lakshadweep). Auto-saves on selection via `useUpdateFamily` hook.
- **Language**: Hindi / English toggle.
- **Household Dietary Baseline**: Dropdown (strictly_vegetarian, eggetarian, non_vegetarian, vegan, jain_vegetarian).
- **Meals Per Day**: Dropdown (2 Meals, 3 Meals, 3 Meals + Snacks).
- **Cooking Skill Level**: Dropdown (Beginner, Intermediate, Experienced).
- **Kitchen Appliances**: Multi-select checkboxes (Gas Stove, Pressure Cooker, Mixer/Grinder, Microwave, OTG/Oven, Air Fryer, Induction, Rice Cooker, Wet Grinder, Tandoor, Idli Steamer). Default fallback to `gas_stove`. Saves immediately on checkbox toggle.

## Profile Page — Per-Member Fields

Each family member card in Profile.tsx shows:

- Name, Age, Gender (Male / Female / Other)
- Weight (kg), Height (cm)
- Activity Level (sedentary / lightly_active / moderately_active / very_active / extra_active)
- Dietary Type (strictly_vegetarian / eggetarian / non_vegetarian / occasional_non_veg / vegan / jain_vegetarian)
- Health Goal (no_specific_goal / weight_loss / weight_gain / muscle_gain / maintain_health / manage_condition / improve_energy / better_sleep)
- Advanced Profile (collapsible):
  - Goal Pace (none / aggressive / moderate / gradual)
  - Tiffin Type (no / school / office)
  - Religious / Cultural Rules (none / no_beef / no_pork / sattvic_no_onion_garlic / jain_rules)
  - Spice Tolerance (low / medium / high / very_high)
  - Festival Fasting Alerts (checkbox)
  - Ingredient Dislikes (text input with add/remove, counter showing X/5)
  - Fasting Days (checkboxes: Monday, Thursday, Ekadashi, Purnima, Saturday, Custom)
  - Non-Veg Days (for occasional_non_veg: Mon-Sun checkboxes)
  - Non-Veg Types (chicken, fish, eggs, mutton, any)
  - Food Allergies (multi-select: none, peanuts, dairy, gluten, tree_nuts, shellfish, soy, sesame)
  - Health Conditions (multi-select: none, diabetes_type_2, diabetes_type_1, hypertension, high_cholesterol, obesity, hypothyroid, anaemia, pcos, kidney_issues, pregnancy_t1-t3, lactation_1-2, ckd_stage_1-5d)
- Daily Calorie Target (read-only, format: "X,XXX kcal")

## Clinical Safety Modules (April 2026)

Three clinical extension modules were integrated into the deterministic constraint engine:

- **Type 1 Diabetes** (`src/engine/clinical/type1Diabetes.ts`, 436 lines): 8 insulin type timing rules, per-meal carb floors, fasting conflict detection, mandatory hypo-rescue grocery items.
- **Pregnancy** (`src/engine/clinical/pregnancy.ts`, 557 lines): 5 stages (3 trimesters + 2 lactation), ICMR-NIN calorie additions, forbidden foods, iron-calcium separation, pregnancy + anaemia combined protocol, nausea management.
- **CKD Staging** (`src/engine/clinical/ckdStaging.ts`, 550 lines): 6 CKD stages with per-stage protein/potassium/phosphorus/sodium/fluid limits, dialysis protein reversal rule, leaching technique instructions, cross-member protein conflict detection.

Integration points: `conflict-engine.ts` (imports, CONDITION_DIETARY_RULES entries, detector calls in `runConflictEngine`), `types.ts` (HealthCondition union expanded), `calorie-calculator.ts` (pregnancy calorie addition), `prompt-chain.ts` (T1D mandatory grocery injection). Stress test score: 63.4% → 83.9%.

## Validation Pass (April 2026)

An 8-section validation and bug-fix pass was completed covering:
- **Navigation**: Reduced to 5 spec-compliant items (Profile | Meals | Grocery | AI Chat | Clinical Insights). Removed Home and Recipes nav entries. Logo clickable to Dashboard on both desktop and mobile.
- **Clinical Insights**: Renamed from "Health", added 3-card summary layout (Nutritional Debt Ledger, Nutritional Shadow Warning, Medication Guardrail) with empty-state fallbacks when no data is available.
- **Profile-Gated Routes**: Grocery, Recipes, and Clinical Insights routes redirect to `/family-setup` if user has no active family profile.
- **Date Safety**: `safeFormatDate` wrapper in MealPlan.tsx prevents "Invalid time value" crashes.
- **Mobile**: Bottom nav pill shows all 5 items directly (no "More" overflow menu).

## QA Fix Pass (April 2026)

Comprehensive 6-block QA fix pass covering security, functional, high-priority, medium-priority, and AI chat quality fixes:

- **Security (BLOCK 1)**: `assertFamilyOwnership` middleware for IDOR protection on all family-scoped routes (meal-plans, grocery, health, gemini, leftovers, meal-feedback).
- **Critical Functional (BLOCK 2)**: T1D/T2D split, CKD stages, pregnancy stages in FamilySetup, max conditions 2→4, medications field (500 char with food-drug interaction note), password complexity (uppercase+number), email trim, `ai_chat_logs` table pushed to Replit PostgreSQL.
- **High Priority (BLOCK 3)**: Member limit 5→8, numeric bounds on age/height/weight (UI+backend), gender field with ICMR iron RDA notes, real-time calorie estimate, BP/blood sugar validation with bounds, allergy/dislike cross-check warning, feedbackCount≥3 regen gate removed (replaced with confirmation dialog), recipe search dedup (DISTINCT ON name), budget validation (positive, max 500000), demo health log seeding (8 weeks weight/BP/blood sugar for Rajesh & Sunita).
- **Medium Priority (BLOCK 4)**: Demo token 2h→8h, calorie target display, market region dynamic label (5 regions mapped), localStorage form draft auto-save in FamilySetup, harmony score tier labels (Harmonious/Manageable/Challenging/Complex).
- **AI Chat Quality (BLOCK 5)**: Anti-asterisk + no-generic-opener rules in Gemini SYSTEM_PROMPT, enhanced Hindi/regional language script enforcement (Devanagari for Hindi, Tamil script for Tamil, etc.), 150-word response limit default, family member name usage requirement, out-of-scope deflection rule.

## Bug Fix Pass (April 2026)

Comprehensive bug-fix and quality pass:

- **Dashboard Chat Fix**: "Kal Kya Banayein" quick chat widget was completely broken — sent wrong payload (`{ title }`) to `POST /api/gemini/conversations` (expects `{ familyId, sessionType }`) → always 400. Refactored to use working `/api/chat` SSE endpoint with proper delta event parsing.
- **Recipe Search `.rows` Fix**: `localDb.execute(sql...)` returns `QueryResult` with `.rows` property, not a plain array. Added safe extraction handling.
- **Recipe Search Ranking**: Text-search results now properly use `ts_rank` ordering via subquery approach (was computed but never applied to the actual SQL query).
- **Demo Health Logs Seed**: Re-running demo now correctly seeds health logs for existing families (was only seeding on first creation).
- **Voyage AI 429 Backoff**: Embedding queue now backs off 2 minutes on rate-limit (429) responses instead of failing immediately.
- **FamilySetup TypeScript**: Fixed `healthGoal` property access using `Record<string,unknown>` cast to match API client types.
- **UI QA Fixes**: Jain dietary warning, T1D alert, BMI badge display, Register inline error, age>120 validation block.

## 9-Section Audit Execution (April 2026 — Latest)

A word-for-word execution of the 9-section audit document was completed. Every section was verified and fixed to match the audit spec exactly.

### SECTION 1 — AUTHENTICATION (Verified)
- JWT-based auth with bcryptjs password hashing confirmed.
- Signup creates `families` row and returns JWT token.
- Server-side middleware validates JWT on all protected `/api/*` routes.
- Demo login via `GET /api/demo/instant` or credentials `demo@parivarsehat.ai` / `DemoJudge2025!`.
- Logout clears ALL localStorage keys: `auth_token`, `active_family`, `demo_family_cache`, `demo_meal_plan_cache`, plus all sessionStorage.

### SECTION 2 — PROFILE SETUP AND EDITING (Fixed + Verified)
Changes made in this session:
- **Added Family-Level Settings section** to `Profile.tsx` (807 lines): Collapsible "Family Settings" panel at the top of the profile page with state/region searchable dropdown (28 states + 8 UTs), language toggle (Hindi/English), household dietary baseline, meals per day (2/3/3+snacks), cooking skill level (beginner/intermediate/experienced), kitchen appliances multi-select (11 Indian appliance options with immediate auto-save on checkbox toggle, default fallback to `gas_stove`).
- **Added `useUpdateFamily` hook** for auto-saving family-level settings via PATCH API.
- **Added gender "Other" option** to the member editing form alongside Male and Female.
- **Fixed religious rules values**: Changed `"jain"` → `"jain_rules"` and `"sattvic"` → `"sattvic_no_onion_garlic"` in both `Profile.tsx` and `MemberEditSheet.tsx` to match the backend conflict engine's `RELIGIOUS_FORBIDDEN_MAP` keys.
- **Fixed religiousCulturalRules field name**: Changed from `{ primary: value }` to `{ type: value }` in both Profile.tsx save handler and MemberEditSheet.tsx to match backend expectations.
- **Added backward compatibility**: `memberToEdit()` function reads both `type` and `primary` fields from `religiousCulturalRules` JSONB, and normalizes old `"jain"` / `"sattvic"` values to their correct counterparts.
- **Fixed calorie display format**: Daily calorie target now shows as `"X,XXX kcal"` (comma-formatted with unit) per audit spec.
- **Verified activity level values**: sedentary, lightly_active, moderately_active, very_active, extra_active — all match ICMR calculations.
- **Verified spice tolerance labels**: low ("Mild"), medium ("Medium"), high ("Spicy"), very_high ("Very Spicy") — all present.

### SECTION 3 — MEAL GENERATION (3A through 3F) (Verified)
- **3A: Monthly Budget Setup**: Budget input with slider on `/meal-plan/generate` page. Default weekly budget auto-calculated from monthly.
- **3B: Weekly Context Form**: Full-page form at `/meal-plan/generate` (715 lines) with per-member overrides (weight targets, fasting days, non-veg days/types), pantry snapshot, cooking time, week start date.
- **3C: Constraint Packet**: `conflict-engine.ts` (1,013 lines) builds complete constraint packet before Gemini is called. Includes effective profiles, resolved conflicts, harmony score, medication guardrails, budget breakdown, pantry items, non-veg day mapping.
- **3D: Gemini Prompt (Sections A-H)**: `prompt-chain.ts` (841 lines) assembles all 8 sections:
  - Section A — Identity: "You are a clinical Indian nutritionist... You do not have artistic freedom. You follow constraints exactly."
  - Section B — Absolute Prohibitions: `buildAbsoluteProhibitions()` dynamically builds from allergen blocks (7 types), dietary type blocks, religious blocks (`jain_rules`, `sattvic_no_onion_garlic`, `no_beef`, `no_pork`), health condition blocks, universal meal prohibitions (samosa, pakora, bhajia, kachori, maggi, pizza, burger, mithai, puri as primary meals).
  - Section C — Meal Structure Rules: `buildMealStructureRules()` — breakfast must have complex carb + protein, lunch must have dal + sabzi + roti, dinner must be lighter than lunch, no fried snacks as primary meals, no repeat main dishes on consecutive days, whole grains default.
  - Section D — Budget Constraint: Weekly/daily/per-slot cost limits with ₹ amounts, staples excluded.
  - Section E — Regional Requirement: `buildRegionalRequirement()` with 17+ state cuisine hints (Kerala, Tamil Nadu, Karnataka, Andhra Pradesh, Telangana, Maharashtra, Gujarat, Rajasthan, Punjab, UP, Bihar, Jharkhand, West Bengal, Odisha, MP, Delhi, Goa, Assam).
  - Section F — Per-member Constraints: `buildConstraintInstructionSection()` with resolved conflicts, calorie targets, macro guidance.
  - Section G — Zero-waste Pantry: "MUST USE THIS WEEK" mandate, prioritize in first 3 days.
  - Section H — One Base Many Plates + Output: `buildModifierInjectionSection()` with per-member plate modifications, fasting replacements, tiffin instructions, priority flags, exact JSON output schema.
- **3E: Waiting Screen**: Polling endpoint (`GET /api/meal-plans/:id/status`) with step-by-step generation log display, max 90 retries (3 minutes), timeout/connection-lost toast on failure.
- **3F: After Generation**: Navigates back to `/meal-plan` showing 7-day grid with breakfast/lunch/dinner slots.
- **MealGenPopup Fully Removed**: All references to `genPopupOpen`, `MealGenPopup`, and the popup component itself removed from `MealPlan.tsx`. "Generate AI Plan" and "New Plan" buttons now use `setLocation("/meal-plan/generate")` for full-page navigation.

### SECTION 4 — RECIPE VIEWER (Verified)
- `RecipeViewer.tsx` (499 lines): Carousel with breakfast/lunch/dinner slots, each showing:
  - Dish name, image (via image_search_query), prep/cook time, estimated cost in ₹
  - Enriched steps with member modifications (CRITICAL/RECOMMENDED/INFO urgency badges)
  - Member plates with per-member modifications, fasting replacements, tiffin instructions
  - Priority flags (allergy_compliant, low_sodium, medication_window_respected, zero_waste_item_used, diabetic_friendly, high_protein_plate, fasting_replacement, tiffin_packed)
  - Pantry items used indicator
  - Recipe source badge (stored/database/gemini_generated)

### SECTION 5 — GROCERY LIST (Verified)
- `Grocery.tsx` (1,216 lines): 3 tabs:
  - **Weekly Perishables**: Generated from meal plan, grouped by category (Vegetables, Fruits, Grains, Pulses, Dairy, Spices, Oil, Other) with color-coded badges, cheaper alternative swaps (AI-powered), check-off functionality, budget status, savings tips, seasonal suggestions. Table/list view toggle.
  - **Monthly Staples**: 20 common Indian pantry items (Rice, Atta, Dal, Mustard Oil, Onion, Tomato, Garlic, Ginger, Turmeric, Cumin, Coriander, Chilli, Salt, Sugar, Milk, Ghee, Potato, Sooji, Poha, Tea).
  - **Pantry**: User-managed inventory per family with localStorage persistence.
- **Pincode**: First-time capture banner with 6-digit validation, localStorage persistence per family, MapPin badge display after save.

### SECTION 6 — AI CHAT (Verified)
- `megaPrompt.ts` (148 lines) confirmed with all 6 rules:
  - Rule 1 — Zero Sycophancy: 10 forbidden phrases listed explicitly.
  - Rule 2 — Context-First: 4-step cross-reference before every response.
  - Rule 3 — Zero-Guilt Cheat Meal Adjustment: No judgment, calculate macro impact, state adjustment, `---ACTION---` JSON delimiter.
  - Rule 4 — ICMR-Grounded Only: Exclusive use of injected ICMR EVIDENCE block. Explicit "guidelines do not cover this" fallback.
  - Rule 5 — Genetic Shield (Silent): Parent T2D → children low-GI. Parent hypertension → children ≤1,000mg sodium/day. Never mentioned.
  - Rule 6 — Medical Safeguard: Drug-food interaction checking.

### SECTION 7 — CLINICAL INSIGHTS (Verified)
- `HealthLog.tsx` (995 lines):
  - Nutrition summary cards: calories, protein, carbs, fat, fiber, iron, calcium, vitamin C (actual vs target with progress indicators)
  - BMI tracking with 4 categories: Underweight (<18.5), Normal (18.5-25), Overweight (25-30), Obese (>30)
  - Blood sugar tracking: Low (<70), Normal (70-100), Pre-diabetic (100-125), High (>125)
  - Blood pressure tracking: Low (<90/60), Normal (≤120/80), Elevated, High (≥140/90)
  - Symptom logging: 10 common symptoms in English + Hindi, AI analysis with nutritional insight, dietary suggestions, recommended/avoid foods, urgency level (routine/soon/urgent)
  - Recharts line and bar charts for trend visualization
  - Health log entry form for weight, blood sugar, blood pressure
  - 3-card clinical summary: Nutritional Debt Ledger, Nutritional Shadow Warning, Medication Guardrail

### SECTION 8 — NAVIGATION (Verified)
- `Layout.tsx` (223 lines): Exactly 5 nav items — Profile, Meal Plan, Grocery, AI Chat, Clinical Insights.
- No "Recipes" nav item anywhere in the sidebar or mobile bottom nav.
- Protected routes redirect to login/family-setup if no auth or no active family.
- Active state highlighting on current page.
- Mobile bottom nav shows all 5 items directly (no overflow menu).

### SECTION 9 — FINAL VERIFICATION (5 Scenarios Passed)
All 5 audit scenarios verified via e2e tests:
1. **Samosa Prohibition**: No "samosa" or "pakora" appears as a primary meal item in any generated meal plan.
2. **Navigation Completeness**: Sidebar contains exactly Profile, Meal Plan, Grocery, AI Chat, Clinical Insights. "Recipes" does NOT appear.
3. **Religious Rules Consistency**: Profile dropdown uses `jain_rules` (not "jain") and `sattvic_no_onion_garlic` (not "sattvic"). Both Profile.tsx and MemberEditSheet.tsx aligned.
4. **Budget Display**: Meal generation page shows weekly budget slider with default value of ₹1,250 (derived from monthly budget).
5. **Full-Page Meal Gen**: `/meal-plan/generate` is a full-page form (not popup), with back arrow to `/meal-plan` and "Generate Weekly Meal Plan" submit button.

## External Dependencies

**AI Services:**
*   **Google Gemini 2.5 Flash**: Used for AI chat, meal plan generation, nutrition analysis, and voice parsing. Uses direct Google API key (`GEMINI_API_KEY`) as primary, with Replit integration as fallback. Client configured with `thinkingBudget: 0` for structured JSON output to avoid double-quote corruption and improve speed. JSON truncation repair built into `safeParseJSON`.
*   **Voyage AI (voyage-3)**: Employed for generating embeddings for recipe vector search.
*   **Sarvam AI**: Utilized for Speech-to-Text functionality in Indian languages.
*   **YOLOv11**: An external HTTP endpoint for food detection in the food scanner feature.

**Databases:**
*   **Replit PostgreSQL**: The primary database for static application data like `recipes`, `knowledge_chunks`, and `icmr_nin_rda`.
*   **Supabase PostgreSQL**: The main database for all user-specific data, including `users`, `families`, `meal_plans`, `chat_messages`, `grocery_lists`, and various logs.

**Key npm Packages:**
*   `express`: HTTP server framework.
*   `drizzle-orm`, `drizzle-zod`: ORM for database interactions and schema validation.
*   `zod`: Data validation library.
*   `orval`: OpenAPI code generator for API clients.
*   `@tanstack/react-query`: Data fetching and state management for React.
*   `wouter`: Lightweight React router.
*   `framer-motion`: Animation library.
*   `shadcn/ui`, `tailwindcss`: UI component library and CSS framework.
*   `jsonwebtoken`, `bcryptjs`: Libraries for secure authentication.
*   `pino`, `pino-http`: Logging utilities.
*   `esbuild`: JavaScript bundler for the API.
*   `vite`: Next-generation frontend tooling.
*   `date-fns`: Utility library for date manipulation.
*   `recharts`: Charting library.
