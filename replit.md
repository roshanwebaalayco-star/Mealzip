# ParivarSehat AI / NutriNext — Family Nutrition Planner

## Overview

ParivarSehat AI / NutriNext is an India-centric AI-powered family meal planning web application designed to help Indian families create nutritious meal plans. It leverages ICMR-NIN 2024 dietary guidelines, regional cuisine preferences, multi-faith fasting calendars, budget constraints, and individual health goals. The project aims to provide a comprehensive and personalized nutrition planning solution with a strong focus on local relevance and advanced AI capabilities. Key features include a vast recipe dataset, AI-driven meal optimization, a food scanner, multilingual voice support, and an Apple-tier Glass Design System for a superior user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure

The project is organized as a pnpm workspace monorepo, facilitating modular development and shared library management. It includes distinct packages for the API backend, React frontend, UI prototyping sandbox, and various shared libraries for API specifications, database interactions, and AI integrations.

### Backend Architecture

The backend is built with Node.js 24, TypeScript 5.9, and Express 5. It uses Drizzle ORM with PostgreSQL as the primary database. Key architectural features include JWT-based authentication, structured JSON logging with pino, and esbuild for server bundling. The API exposes modules for authentication, family management (including AI-driven profile curation), recipe search, AI-generated meal plans, nutrition analysis (including YOLOv11 food scanning and Gemini Vision pantry analysis), multilingual voice support via Sarvam AI, grocery list generation with ICMR health rationale, health logging, and Gemini AI conversation endpoints. Shared libraries manage festival fasting calendars, ICMR-NIN RDA targets, diet tag resolution, appliance filtering, seasonal ingredient calendars, and a sophisticated meal plan validator that uses Gemini AI for candidate selection and clinical post-generation validation. RAG services are implemented for embedding generation, ingestion of knowledge bases (including ICMR-NIN PDFs), and context retrieval for meal planning and chat interactions.

#### AI Chat with SSE Streaming (`POST /api/chat`)
The chat route (`routes/chat/index.ts`) provides SSE-streaming AI responses via Gemini 2.5 Flash with:
- **Mega-prompt system** (`lib/megaPrompt.ts`): ParivarSehat persona with ICMR-grounded nutrition guidance
- **RAG search** (`lib/ragSearch.ts`): Retrieves relevant ICMR knowledge chunks from `localDb`. Two modes: (1) Vector mode uses Gemini `text-embedding-004` embeddings + cosine similarity when a direct `GEMINI_API_KEY` is available, (2) BM25 mode uses proper BM25 ranking (TF-IDF with document-length normalization, k1=1.2, b=0.75) on Replit modelfarm since `embedContent` is not supported. Vector mode falls back to BM25 on failure
- **Context assembly** (`lib/assembleContext.ts`): Injects family profile, meal plans, nutrition logs, medications, and RAG evidence into every Gemini call
- **Action extraction**: Parses `---ACTION---` delimiter in responses for structured UI actions (meal plan generation, recipe search, etc.)
- **IDOR protection**: Validates `familyId` ownership against JWT `userId` before context assembly
- **Chat history** (`lib/chatHistory.ts`): Persists messages to `chat_messages` table per session UUID. Endpoints: `GET /api/chat/history`, `GET /api/chat/sessions`
- SSE event contract: `delta` (streaming text), `action` (parsed action payload), `done` (stream complete), `error` (error message)

### Frontend Architecture

The frontend is a React 18 application built with Vite, utilizing Wouter for routing and TanStack React Query for state management. UI components are developed using shadcn/ui, Tailwind CSS v4, and tw-animate-css, adhering to an Apple-tier Glass Design System. It features DM Sans and Outfit fonts, Framer Motion for animations, and a `LanguageContext` for English ↔ Hindi toggling. Core functionalities include a dashboard, multi-step family setup wizard (supporting voice, text-chat, and manual input), weekly meal plan view with preparation reminders and ThaliScoreBadge, recipe explorer, detailed recipe pages, AI chat with SSE streaming, food scanner, grocery lists, nutrition charts, and health logs. Client-side utilities manage prep reminders for various ingredients.

#### AI Chat Frontend (`pages/Chat.tsx`)
- **`useChat` hook** (`hooks/useChat.ts`): SSE streaming client using `apiFetch`, passes `familyId` from `activeFamily`, handles `delta`/`action`/`done`/`error` events, supports action cards in UI. Session management via UUID in `sessionStorage`; loads history on mount from `GET /api/chat/history`; "New Chat" (+) button clears session and starts fresh thread
- **`useVoice` hook** (`hooks/useVoice.ts`): Browser-native Web Speech API for STT (speech recognition) and TTS (speech synthesis) with barge-in support
- **`MarkdownMessage`** (`components/MarkdownMessage.tsx`): Zero-dependency custom markdown renderer for assistant messages. Handles bold, italic, code, fenced code blocks, headings, ordered/unordered lists, horizontal rules. Strips raw HTML tags for XSS prevention. User messages render as plain text
- **Chat page**: Full ParivarSehat AI chat UI with language selector (8 Indian languages), voice toggle, streaming response display, action card rendering, history skeleton loading, and "Previous messages" divider

### API Client Code Generation

OpenAPI specifications (`lib/api-spec/openapi.yaml`) are used with Orval to automatically generate TanStack Query hooks for React and Zod validation schemas, ensuring type safety and consistency between frontend and backend.

### Database Schema (NutriNext Blueprint v2)

PostgreSQL serves as the primary data store, managed by Drizzle ORM. Two DB pools: `localDb` (recipes, ICMR — local PG) and `db` (user data — Supabase via DATABASE_URL).

**User-data tables (8 total):**
- `families`: `stateRegion`, `languagePreference`, `householdDietaryBaseline`, `mealsPerDay` (text), `cookingSkillLevel`, `appliances` (JSONB), `pincode`
- `family_members`: `dietaryType`, `dailyCalorieTarget`, `tiffinNeeded` (text: "no"/"school"/"office"), `religiousCulturalRules` (JSONB `{primary}`), `occasionalNonvegConfig` (JSONB `{days, types}`), `fastingConfig` (JSONB `{baselineDays, ekadashi}`), `spiceTolerance`, `festivalFastingAlerts`, `displayOrder`
- `monthly_budgets`, `weekly_contexts`, `member_weekly_contexts` (NEW)
- `meal_plans`: restructured with `weeklyContextId`, `generationStatus`, JSONB columns
- `grocery_lists`: restructured with `listType`, `monthYear`, `weekStartDate`, `status`
- `ai_chat_logs` (replaces `conversations` + `messages`)
- `chat_messages`: Per-session chat history persistence (familyId, sessionId UUID, role, text, createdAt). Indexed on (family_id, session_id)

**Removed fields:** `role`, `dietaryRestrictions`, `tiffinType`, `religiousRules`, `fastingBaseline`, `calorieTarget`, `icmrCaloricTarget`, `mealsAreShared`, `sharedTypical*`, `individualTypical*`

**Key invariants:** All PKs remain `serial`, all FKs remain `integer`.

### Profile Setup Field Taxonomy (v2)

**Family-level fields:**
- `dietaryType`: `strictly_veg | veg_with_eggs | non_veg | mixed` (household dietary baseline)
- `cookingSkill`: `beginner | intermediate | experienced` (default: `intermediate`)
- `mealsPerDay`: `2 | 3 | 4` (2=two meals, 3=three meals, 4=three+snacks; default: `3`)

**Per-member fields:**
- `activityLevel`: `sedentary | lightly_active | moderately_active | very_active` (default: `moderately_active`)
- `dietaryType`: `strictly_vegetarian | jain_vegetarian | eggetarian | non_vegetarian | occasional_nonveg`
- `healthGoal`: includes `senior_nutrition` for 60+; auto-assigned goals for children (<5, 5–12); weight_loss blocked for 13–17
- `spiceTolerance`: `mild | medium | spicy`
- Non-veg day/type checkboxes shown for both `non_vegetarian` and `occasional_nonveg`

**Calorie computation (profile-rules.ts):**
- Activity multipliers support both old and new taxonomy: `light`/`lightly_active`=1.375, `moderate`/`moderately_active`=1.55, etc.

## External Dependencies

### AI Services
- **Google Gemini 2.5 Flash**: Utilized for meal plan generation, nutrition analysis, voice profile parsing, symptom advising, Harmony Score computation, and food image identification. Chat/generation uses Replit Gemini AI integration (no separate key needed). The client (`lib/integrations-gemini-ai/src/client.ts`) prioritizes the Replit integration (`AI_INTEGRATIONS_GEMINI_*` env vars) over a direct `GEMINI_API_KEY`. When using the Replit integration (modelfarm mode), Google Search grounding (`tools: [{ googleSearch: {} }]`) is automatically disabled since it's unsupported by the integration.
- **Voyage AI (voyage-3)**: Embedding provider for recipe and knowledge base vector search. Uses `VOYAGE_API_KEY`. Outputs 1024-dimensional vectors. Falls back to Gemini embeddings if `GEMINI_API_KEY` is set.
- **Sarvam AI**: Provides Speech-to-Text capabilities for Indian languages.
- **YOLOv11**: An external HTTP endpoint for food detection inference, with a demo mode for development.

### Database
- **PostgreSQL**: The core relational database for data storage.

### Key npm Packages
- **`express`**: HTTP server.
- **`drizzle-orm` + `drizzle-zod`**: ORM and schema-to-Zod bridge.
- **`zod`**: Runtime validation.
- **`orval`**: OpenAPI code generation.
- **`@tanstack/react-query`**: Server state management.
- **`wouter`**: Client-side routing.
- **`framer-motion`**: Animations.
- **`recharts`**: Charting library.
- **`jsonwebtoken` + `bcryptjs`**: Authentication.
- **`pino` + `pino-http`**: Structured logging.
- **`p-limit` + `p-retry`**: Concurrency and retry mechanisms.
- **`csv-parse`**: CSV processing.
- **`esbuild`**: API server bundling.
- **`vite`**: Frontend bundling.
- **`tailwindcss`**: Styling.

## Deployment

**Target**: Replit Autoscale.

**Build**: `bash build.sh` at workspace root. Has a fast path (skips compilation if pre-built `dist/` exists) and a slow path (full compile: frontend via Vite, API server via esbuild, copy frontend into `api-server/dist/public/`).

**Run**: `node start.mjs` at workspace root. Respects the `PORT` env var from the deployment system (defaults to 3000 if unset). Sets `NODE_ENV=production` and `DEMO_MODE=true` by default.

**Static serving**: In production, `app.ts` serves `dist/public/` via `express.static` with 1-day cache and a `*` catch-all for SPA routing. In development, non-API requests are proxied to the Vite dev server.

**Health check**: `GET /healthz` returns `{"status":"ok"}`.

**Knowledge base**: The ingestion service reads from `process.cwd()/knowledge_base/`. Files are at both workspace root and `artifacts/api-server/knowledge_base/`.

**Database**: Schema uses `vector(1024)` columns (Voyage AI voyage-3 embeddings). Both local PostgreSQL and Supabase have schemas pushed via Drizzle.