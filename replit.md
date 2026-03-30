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

### Frontend Architecture

The frontend is a React 18 application built with Vite, utilizing Wouter for routing and TanStack React Query for state management. UI components are developed using shadcn/ui, Tailwind CSS v4, and tw-animate-css, adhering to an Apple-tier Glass Design System. It features DM Sans and Outfit fonts, Framer Motion for animations, and a `LanguageContext` for English ↔ Hindi toggling. Core functionalities include a dashboard, multi-step family setup wizard (supporting voice, text-chat, and manual input), weekly meal plan view with preparation reminders and ThaliScoreBadge, recipe explorer, detailed recipe pages, AI chat with SSE streaming, food scanner, grocery lists, nutrition charts, and health logs. Client-side utilities manage prep reminders for various ingredients.

### API Client Code Generation

OpenAPI specifications (`lib/api-spec/openapi.yaml`) are used with Orval to automatically generate TanStack Query hooks for React and Zod validation schemas, ensuring type safety and consistency between frontend and backend.

### Database Schema

PostgreSQL serves as the primary data store, managed by Drizzle ORM. Key tables include `families`, `family_members` (with detailed profiles like caloric targets, dislikes, and religious rules), `recipes` (with nutrition data and embeddings for semantic search), `icmr_nin_rda`, `knowledge_chunks` (for RAG with embeddings), `meal_plans` (storing AI-generated plans and RAG audit trails), `meal_feedback`, `grocery_lists`, `health_logs`, and `conversations`/`messages` for chat history.

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