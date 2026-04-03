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

## External Dependencies

**AI Services:**
*   **Google Gemini 2.5 Flash**: Used for AI chat, meal plan generation, nutrition analysis, and voice parsing. Primarily integrated via Replit's modelfarm.
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