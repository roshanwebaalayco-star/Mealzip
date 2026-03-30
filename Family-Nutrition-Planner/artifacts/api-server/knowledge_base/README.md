# Knowledge Base

Place the following files in this directory for RAG-powered meal plan generation:

## Required Files

### `icmr_nin_guidelines.pdf`
ICMR-NIN 2024 Dietary Guidelines for Indians PDF. This document contains the official nutritional recommendations, food group guidelines, and dietary advice from the Indian Council of Medical Research - National Institute of Nutrition.

### `icmr_nin_rda.pdf`
ICMR-NIN 2024 Recommended Dietary Allowances (RDA) document. Contains specific calorie, protein, iron, calcium, and other nutrient targets by age, gender, and activity level for the Indian population.

### `meal_patterns.txt`
Clinical meal pattern definitions per health goal (weight loss, weight gain, diabetes management, anaemia correction, etc.) and per Indian regional zone. Each section defines the exact meal structure, portion sizes, and food group distribution. Sections should be separated by double newlines.

### `*.csv` (any CSV files)
Any CSV files placed in this directory are auto-discovered and ingested. Rows are grouped into chunks of 15 with the header row prepended for context. Useful for nutrient composition tables, food exchange lists, or supplementary nutrition data.

## How It Works

On server startup, the ingestion service reads these files, splits them into overlapping text chunks, generates vector embeddings using Gemini's text-embedding-004 model, and stores them in the `knowledge_chunks` PostgreSQL table with pgvector.

When generating meal plans or answering chat questions, the system retrieves the most relevant chunks via cosine similarity search and injects them as verified context into the Gemini prompt.

## Re-ingestion

To force re-ingestion after updating files, either:
- Set `FORCE_REINGEST=true` environment variable and restart the server
- Call `POST /api/admin/reingest` (admin-only endpoint)
