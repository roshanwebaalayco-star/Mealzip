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

**Feature Specifications:**

*   **Authentication**: JWT-based authentication with bcryptjs for password hashing.
*   **User & Family Management**: CRUD operations for users, families, and family members, including detailed health profiles.
*   **Meal Planning**: AI-driven 7-day meal plan generation, display, and management, integrating fasting calendars and budget tracking.
*   **Recipe Explorer**: Search and display of over 12,700 Indian recipes with detailed nutritional information.
*   **Grocery List Management**: Generation and management of grocery lists based on meal plans.
*   **Health & Nutrition Logging**: Functionality for tracking health metrics and nutrition intake.
*   **Multi-Lingual Voice Support**: Integration of browser-native Web Speech API for Speech-to-Text and Text-to-Speech in 8 Indian languages.
*   **Food Scanner**: Planned integration for food image scanning using YOLOv11 and Gemini Vision.

## Clinical Safety Modules (April 2026)

Three clinical extension modules were integrated into the deterministic constraint engine, closing all three critical safety gaps identified in the stress test readiness audit:

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

## Bug Fix Pass (April 2026 - Latest)

Comprehensive bug-fix and quality pass:

- **Dashboard Chat Fix**: "Kal Kya Banayein" quick chat widget was completely broken — sent wrong payload (`{ title }`) to `POST /api/gemini/conversations` (expects `{ familyId, sessionType }`) → always 400. Refactored to use working `/api/chat` SSE endpoint with proper delta event parsing.
- **Recipe Search `.rows` Fix**: `localDb.execute(sql...)` returns `QueryResult` with `.rows` property, not a plain array. Added safe extraction handling.
- **Recipe Search Ranking**: Text-search results now properly use `ts_rank` ordering via subquery approach (was computed but never applied to the actual SQL query).
- **Demo Health Logs Seed**: Re-running demo now correctly seeds health logs for existing families (was only seeding on first creation).
- **Voyage AI 429 Backoff**: Embedding queue now backs off 2 minutes on rate-limit (429) responses instead of failing immediately.
- **FamilySetup TypeScript**: Fixed `healthGoal` property access using `Record<string,unknown>` cast to match API client types.
- **UI QA Fixes**: Jain dietary warning, T1D alert, BMI badge display, Register inline error, age>120 validation block.

## 9-Section Audit Fix Pass (April 2026)

Comprehensive audit-driven fix pass:

- **Meal Generation Prompt Hardening (Section 3D)**: Rewrote Gemini prompt in `prompt-chain.ts` with clinical identity preamble, ABSOLUTE PROHIBITIONS section (samosa, pakora, kachori, bhajia, maggi, maida, mithai, street food as primary meals), MEAL STRUCTURE RULES (every breakfast needs complex carb + protein, every lunch needs dal + sabzi + roti, dinner lighter than lunch), REGIONAL REQUIREMENT section (18 state-specific cuisine hints), and budget/constraint sections with separator formatting. Added `buildAbsoluteProhibitions()`, `buildMealStructureRules()`, `buildRegionalRequirement()` helper functions.
- **Profile Page Completeness (Section 2)**: Added Spice Tolerance dropdown and Festival Fasting Alerts checkbox to Profile.tsx advanced section.
- **Auth Hardening (Section 1)**: Logout now clears all localStorage state including `demo_family_cache`, `demo_meal_plan_cache`, and `active_family`.
- **Grocery Budget Status Fix**: Made `monthlyBudgetsTable` query graceful with try-catch fallback — prevents 500 error when table doesn't exist yet.
- **Navigation**: Recipes link added to both desktop sidebar and mobile bottom nav (6 items: Profile, Meals, Recipes, Grocery, AI Chat, Clinical Insights).

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