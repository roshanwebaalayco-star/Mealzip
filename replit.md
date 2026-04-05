# ParivarSehat AI / NutriNext — Family Nutrition Planner

## Overview

ParivarSehat AI / NutriNext is an India-centric AI-powered family meal planning web application designed to create nutritious, personalized meal plans. It leverages ICMR-NIN 2024 dietary guidelines, accommodates regional cuisine preferences, integrates multi-faith fasting calendars, respects budget constraints, and supports individual health goals. The project aims to provide comprehensive nutrition solutions, enhance family well-being, and promote healthy eating habits across India.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application uses a monorepo structure with `pnpm` workspaces for the backend (`api-server`), frontend (`nutrinext`), and a UI prototyping sandbox (`mockup-sandbox`).

**Technical Stack:**
- **Backend**: Node.js 24, TypeScript 5.9, Express 5, Drizzle ORM, PostgreSQL, pino logging.
- **Frontend**: React 18, Vite, Wouter for routing, TanStack React Query, shadcn/ui and Tailwind CSS v4, Framer Motion.

**Core Architectural Decisions:**

*   **Monorepo Structure**: Facilitates co-located development and shared codebases.
*   **API-driven Design**: Clear separation of concerns via a RESTful API.
*   **Dual Database Strategy**:
    *   **`localDb`**: Replit PostgreSQL for static data (recipes, ICMR knowledge chunks).
    *   **`db`**: Supabase PostgreSQL for dynamic user-specific data (profiles, meal plans, chat history).
*   **AI Meal Generation Engine**: A multi-step pipeline incorporating calorie calculations, dietary conflict resolution, medication-food interaction guardrails, and Gemini 2.5 Flash for meal plan generation. It includes a "Family Harmony Score" to optimize meal satisfaction.
*   **SSE Streaming AI Chat**: Real-time AI responses using Gemini 2.5 Flash, featuring a mega-prompt system, RAG search (BM25 on Replit's modelfarm), and context assembly.
*   **Robust Recipe Search**: Utilizes PostgreSQL's GIN index with weighted `ts_rank` for efficient full-text searching across name, Hindi name, and ingredients.
*   **ICMR Knowledge Base**: ICMR guidelines are chunked and stored for RAG to ensure scientifically grounded nutrition advice.
*   **Apple-tier Glass Design System**: UI/UX prioritizes a clean, modern aesthetic with `shadcn/ui` and Tailwind CSS.
*   **Authentication**: JWT-based with `jsonwebtoken` and `bcryptjs`. Protected routes validate JWT. A demo mode is available.
*   **Navigation**: Exactly 5 items: Profile, Meal Plan, Grocery, AI Chat, Clinical Insights. Clinical Insights route is `/insights`.
*   **Meal Generation Pipeline**: Strict 8-section pipeline for prompt assembly, including identity, absolute prohibitions, meal structure rules, budget constraints, regional requirements, per-member clinical constraints, zero-waste pantry mandates, and "one base, many plates" output format.
*   **AI Chat System**: Guided by 6 rules including "Zero Sycophancy", "Context-First", "Zero-Guilt Cheat Meal Adjustment", "ICMR-Grounded Only", "Genetic Shield", and "Medical Safeguard".
*   **Conflict Engine**: Contains detailed clinical dietary rules for various conditions (e.g., diabetes, hypertension, anaemia, obesity, high cholesterol, hypothyroid, PCOS, kidney issues, pregnancy) and allergy ingredient mapping (e.g., peanuts, dairy, gluten, tree nuts, shellfish, soy, sesame).
*   **Religious/Cultural Rules Mapping**: Includes rules for `no_beef`, `no_pork`, `sattvic_no_onion_garlic`, and `jain_rules`.
*   **Clinical Safety Modules**: Integrated modules for Type 1 Diabetes, Pregnancy (5 stages), and CKD Staging (6 stages) to enhance meal plan safety and personalization.

**Canonical Field Values (Document-Compliant):**
*   **Activity Level**: `sedentary`, `lightly_active`, `moderately_active`, `very_active` (4 options)
*   **Primary Goal**: `maintain`, `weight_loss`, `weight_gain`, `build_muscle`, `manage_condition`, `senior_nutrition` (auto-set: `early_childhood_nutrition` for age<5, `healthy_growth` for age 5-12)
*   **Goal Pace**: `none`, `slow_0.25kg`, `moderate_0.5kg`
*   **Tiffin**: `no`, `yes_school`, `yes_office`
*   **Spice Tolerance**: `mild`, `medium`, `spicy`
*   **Religious Rules**: `none`, `jain_rules`, `no_beef`, `no_pork`, `sattvic_no_onion_garlic`
*   **Appliance IDs**: `gas_stove`, `induction`, `pressure_cooker`, `mixer_grinder`, `microwave`, `oven_otg`, `air_fryer`, `tawa`, `idli_maker`, `rice_cooker`

## External Dependencies

**AI Services:**
*   **Google Gemini 2.5 Flash**: Primary for AI chat, meal plan generation, nutrition analysis.
*   **Voyage AI (voyage-3)**: For generating embeddings for recipe vector search.
*   **Sarvam AI**: For Speech-to-Text in Indian languages.
*   **YOLOv11**: External HTTP endpoint for food detection.

**Databases:**
*   **Replit PostgreSQL**: For static application data (`recipes`, `knowledge_chunks`, `icmr_nin_rda`).
*   **Supabase PostgreSQL**: For all dynamic user-specific data (`users`, `families`, `meal_plans`, `chat_messages`, `grocery_lists`).

**Key npm Packages:**
*   `express`, `drizzle-orm`, `drizzle-zod`, `zod`, `orval`
*   `@tanstack/react-query`, `wouter`, `framer-motion`, `shadcn/ui`, `tailwindcss`
*   `jsonwebtoken`, `bcryptjs`, `pino`, `pino-http`
*   `esbuild`, `vite`, `date-fns`, `recharts`