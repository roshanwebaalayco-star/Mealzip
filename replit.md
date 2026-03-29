# ParivarSehat AI / NutriNext — Family Nutrition Planner

## Overview

India-centric AI-powered family meal planning web application built as a hackathon project. The app helps Indian families plan nutritious meals based on ICMR-NIN 2024 dietary guidelines, incorporating regional cuisine preferences, multi-faith fasting calendars, budget constraints, and individual health goals for each family member.

Key differentiators:
- **58,000+ recipe dataset** sourced from CSV, filtered to ~12,771 complete entries seeded into PostgreSQL
- **ICMR-NIN 2024 nutrition science** with RDA reference data (22 records covering all age/gender/activity groups)
- **Harmony Score** (0–100) for family meal optimization, computed by Gemini AI
- **YOLOv11 food scanner** (`DEMO_MODE=true` in dev returns mock data; production requires `YOLOV11_INFERENCE_URL`)
- **Sarvam AI multilingual voice** support (Hindi, Bhojpuri, Bengali, Tamil, etc.)
- **Multi-faith fasting calendar** covering Hindu, Islamic (Ramadan), Jain, and Sikh fasts
- **Liquid Glass 2025+** design system with Framer Motion animations

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure (pnpm workspaces)

The project uses a pnpm workspace monorepo under `Family-Nutrition-Planner/`. All packages communicate through workspace references (`workspace:*`).

```
Family-Nutrition-Planner/
├── artifacts/
│   ├── api-server/       # Express 5 API backend (port from $PORT, default 8080)
│   └── nutrinext/        # React + Vite frontend (preview at /)
│   └── mockup-sandbox/   # UI prototyping sandbox with infinite canvas
├── lib/
│   ├── api-spec/         # OpenAPI YAML spec + Orval codegen config
│   ├── api-client-react/ # Generated TanStack Query hooks (from Orval)
│   ├── api-zod/          # Generated Zod schemas (from Orval)
│   ├── db/               # Drizzle ORM schema + PostgreSQL client
│   └── integrations-gemini-ai/ # Gemini AI client with batch utilities
├── scripts/
│   ├── seed-recipes.ts   # Seeds 12,771 recipes from CSV (--force to re-seed)
│   └── seed-icmr-nin.ts  # Seeds ICMR-NIN RDA reference data (22 records)
└── attached_assets/      # CSV recipe data + PDFs
```

### Backend Architecture

- **Runtime**: Node.js 24 / TypeScript 5.9 / ES Modules
- **Framework**: Express 5 with pino + pino-http for structured JSON logging
- **ORM**: Drizzle ORM with PostgreSQL (`drizzle-orm/node-postgres`)
- **Build**: esbuild bundles the server into `dist/index.mjs`
- **Auth**: JWT-based (jsonwebtoken + bcryptjs); `authenticateToken` middleware attaches `req.user`; tokens stored in localStorage on the client with key `parivarsehat_token`

**API Route Modules** (all under `/api`):
- `/auth` — register/login, returns JWT
- `/families` — family profiles + members + **`POST /families/profile-chat`** (stateless chat: `{messages, language}` → `{reply, extractedData, isComplete}`) for text-chat profile curation
- `/recipes` — recipe search/listing against the seeded DB
- `/meal-plans` — AI-generated weekly meal plans
- `/meal-feedback` — thumbs up/down per meal for Week 2 regeneration
- `/nutrition` — nutrition lookup, food scan (YOLOv11/demo), **`POST /nutrition/pantry-vision`** (Gemini Vision: returns `{name, nameHindi, quantity, unit, weightGrams, confidence}` per detected item)
- `/nutrition-summary/:memberId` — per-member nutrition vs. ICMR-NIN targets
- `/voice` — Sarvam AI STT transcription (`POST /api/voice/transcribe`)
- `/grocery` — AI-generated grocery lists with cost estimates + `healthRationale` per item (ICMR-NIN citation)
- `/gemini` — Gemini conversation endpoints with SSE streaming
- `/demo` — seeds a demo "Sharma Family" profile
- `/health` — health log entries + symptom advisor
- `/healthz` — health check endpoint

**Shared library files** in `artifacts/api-server/src/lib/`:
- `festival-fasting.ts` — single source of truth for multi-faith fasting calendar (2026 dates)
- `icmr-nin.ts` — ICMR-NIN 2024 RDA targets per age/gender/activity (in-memory fallback)
- `diet-tag.ts` — helpers: `parseDietTag`, `resolveDietPreference` (strips `diet_type:` prefix)
- `logger.ts` — pino logger (pretty in dev, JSON in production)
- `appliance-filter.ts` — keyword-based appliance detection from recipe text + filterByAppliances() for hard filtering
- `seasonal-ingredients.ts` — 5-region × 12-month Indian seasonal produce calendar (vegetables, fruits, grains)
- `meal-plan-validator.ts` — post-generation validation sieve with over-generation + candidate selection: Gemini returns 3 candidates per breakfast/lunch/dinner slot; `validateMealPlan()` evaluates candidates in order and selects first with no hard violations; hard checks cover diabetic high-GI, hypertension sodium, Jain-forbidden, allergy cross-checks; all-fail slots get safe fallback from SAFE_FALLBACKS map (meal_type × diet_preference)
- `thali-scorer.ts` — 5-bucket thali completeness scorer (carb/protein/fat/fiber/vegetable); keyword-matching against meal name + ingredients; returns score(0-5), present[], missing[], suggestions[]

### Frontend Architecture

- **Framework**: React 18 + Vite
- **Routing**: Wouter (lightweight client-side router)
- **State/Data**: TanStack React Query with auto-generated hooks from `@workspace/api-client-react`
- **UI**: shadcn/ui (Radix UI primitives) + Tailwind CSS v4 + tw-animate-css
- **Animations**: Framer Motion
- **Fonts**: DM Sans (body) + Outfit (display)
- **Language toggle**: English ↔ Hindi via `LanguageContext`
- **Auth**: `useAuth` hook reads/writes JWT to localStorage; `setAuthTokenGetter` injects Bearer token into all API calls
- **App state**: `AppStateContext` tracks active family (defaults to first family returned by API)

**Key pages**: Dashboard, FamilySetup (multi-step wizard with 3 paths: voice / text-chat / manual form), MealPlan (weekly calendar view with Tonight's Prep reminders, ThaliScoreBadge, leftover logging, skip/ate-out), WeeklyContext (`/meal-plan/context` — full page for weekly preferences/budget/fasting before plan generation, navigated from MealPlan), RecipeExplorer (clickable cards → navigates to `/recipes/:id`), RecipeDetail (`/recipes/:id` — full recipe page with hero image, nutrition, ingredients, cooking steps), Chat (AI with SSE streaming + voice), Scanner (food detection with Gemini Vision pantry scan + quantity estimation), Grocery (ICMR health rationale per item), Nutrition (charts via Recharts), HealthLog, Login, Register

**Key client-side utilities**:
- `prep-reminders.ts` — `PREP_REQUIREMENTS` static map: ingredient keyword → prep type (soak/ferment/sprout/marinate) → duration → clinical benefit (EN/HI). `getPrepsForMeals()` scans tomorrow's meals and returns matched reminders. Covers rajma, chana, moong, urad dal, dosa/idli, chicken, mutton, paneer, dhokla, toor dal, kidney bean.

### API Client Code Generation (Orval)

- OpenAPI spec lives in `lib/api-spec/openapi.yaml`
- Orval generates two outputs from the spec:
  1. `lib/api-client-react/src/generated/` — TanStack Query hooks
  2. `lib/api-zod/src/generated/` — Zod validation schemas
- A custom fetch wrapper (`custom-fetch.ts`) handles base URL injection, auth token attachment, and response parsing
- Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### Database Schema (Drizzle + PostgreSQL)

Key tables:
- `families` — family profiles (`monthlyBudget` as integer in rupees, `state`, `primaryLanguage`, `appliances text[]` — kitchen appliances owned, defaults to `['tawa','pressure_cooker','kadai']`)
- `family_members` — per-member profiles including new fields: `goalPace`, `tiffinType`, `religiousRules`, `ingredientDislikes[]`, `nonVegDays[]`, `nonVegTypes[]`, `icmrCaloricTarget`
- `recipes` — 12,771 seeded Indian recipes with nutrition data, cuisine, course, diet tags
- `icmr_nin_rda` — 22 RDA reference records by age group/gender/activity
- `meal_plans` — AI-generated weekly plans (stored as JSON), linked to family
- `meal_feedback` — thumbs up/down per meal slot
- `grocery_lists` — AI-generated grocery lists with cost breakdown
- `health_logs` — per-member health metrics (weight, BMI, blood sugar, BP, symptoms)
- `conversations` / `messages` — Gemini AI chat history

Database config requires `DATABASE_URL` env var. Schema push: `pnpm --filter @workspace/db run push`.

### Mockup Sandbox

A separate Vite app (`artifacts/mockup-sandbox`) for UI prototyping. Uses a custom Vite plugin (`mockupPreviewPlugin.ts`) that auto-discovers `.tsx` files under `src/components/mockups/` and generates a module map for live preview rendering on an infinite canvas.

## External Dependencies

### AI Services
- **Google Gemini 2.5 Flash** (`@google/genai`) — meal plan generation, nutrition analysis, voice profile parsing, symptom advisor, Harmony Score computation, food image identification (fallback for scanner)
  - Configured via `AI_INTEGRATIONS_GEMINI_BASE_URL` + `AI_INTEGRATIONS_GEMINI_API_KEY` (Replit AI Integrations proxy)
  - Batch processing utility with p-limit (concurrency) + p-retry (rate limit backoff)
  - SSE streaming for chat responses

- **Sarvam AI** — Speech-to-Text for Indian languages (Hindi, Bhojpuri, Bengali, Tamil, Telugu, etc.)
  - Endpoint: `POST /api/voice/transcribe`
  - Audio recorded in browser as WebM, sent as base64

- **YOLOv11** — Food detection inference (external HTTP endpoint)
  - `YOLOV11_INFERENCE_URL` env var required for production
  - `DEMO_MODE=true` (or missing URL) returns mock scan data
  - `CONFIDENCE_THRESHOLD=0.65`

### Database
- **PostgreSQL** — primary data store
  - Connection via `DATABASE_URL` env var
  - Drizzle ORM with `drizzle-kit` for schema management
  - `pg` (node-postgres) as the driver

### UI Polish (Task #3)
- **WeeklyContextModal** uses `flex flex-col` layout with `shrink-0` header/footer and `overflow-y-auto flex-1 min-h-0` content area — ensures the Generate button is always visible regardless of content height
- **RecipeDetailModal** already uses correct flex layout with `max-h-[92vh] flex flex-col` and scrollable content
- **Micro-text readability**: All `text-[8px]` bumped to `text-[10px]`, `text-[9px]` to `text-[11px]`, `text-[10px]` to `text-xs` (12px) across all pages and components
- **Affected files**: MealPlan, Grocery, Scanner, PantryScan, Nutrition, Chat, RecipeExplorer, HealthLog, Pantry, Login, ThaliScoreBadge, WeeklyContextModal, RecipeDetailModal, VoiceAssistantModal

### Key npm Packages
| Package | Purpose |
|---|---|
| `express` v5 | HTTP server |
| `drizzle-orm` + `drizzle-zod` | ORM + schema→Zod bridge |
| `zod` v4 | Runtime validation |
| `orval` | OpenAPI → TypeScript/React Query codegen |
| `@tanstack/react-query` | Server state management |
| `wouter` | Client-side routing |
| `framer-motion` | Animations |
| `recharts` | Nutrition charts |
| `jsonwebtoken` + `bcryptjs` | Auth |
| `pino` + `pino-http` | Structured logging |
| `p-limit` + `p-retry` | Gemini batch concurrency + retry |
| `csv-parse` | Recipe CSV seeding |
| `esbuild` | API server bundling |
| `vite` | Frontend bundling |
| `tailwindcss` v4 | Styling |

### Required Environment Variables
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Replit Gemini proxy base URL |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Replit Gemini proxy API key |
| `JWT_SECRET` | JWT signing secret |
| `PORT` | Server port (required for both api-server and nutrinext) |
| `BASE_PATH` | Vite base path (required for mockup-sandbox) |
| `YOLOV11_INFERENCE_URL` | YOLOv11 food detection endpoint (optional; enables real scanner) |