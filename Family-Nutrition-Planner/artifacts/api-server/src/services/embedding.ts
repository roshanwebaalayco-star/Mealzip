import { pool } from "@workspace/db";
import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

function getGenAI(): GoogleGenAI {
  const directKey = process.env.GEMINI_API_KEY;
  const integrationKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const integrationBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

  if (directKey) {
    return new GoogleGenAI({ apiKey: directKey });
  }
  if (integrationKey && integrationBase) {
    return new GoogleGenAI({
      apiKey: integrationKey,
      httpOptions: { apiVersion: "", baseUrl: integrationBase },
    });
  }
  throw new Error(
    "Gemini AI not configured for embeddings. Set GEMINI_API_KEY or configure the Gemini integration.",
  );
}

export function isEmbeddingConfigured(): boolean {
  return !!(process.env.GEMINI_API_KEY || (process.env.AI_INTEGRATIONS_GEMINI_API_KEY && process.env.AI_INTEGRATIONS_GEMINI_BASE_URL));
}

export interface ChunkResult {
  id: number;
  source: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface RecipeResult {
  id: number;
  name: string;
  cuisine: string;
  course: string;
  diet: string;
  ingredients: string;
  instructions: string;
  prepTimeMin: number | null;
  servings: number | null;
  similarity: number;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 8000);

  const genAI = getGenAI();

  try {
    const result = await genAI.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: [{ role: "user", parts: [{ text: cleaned }] }],
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });
    const values = result.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      throw new Error("Gemini embedding returned no embedding values");
    }
    return values;
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 429) {
      await new Promise((r) => setTimeout(r, 10000));
      const retryResult = await genAI.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: [{ role: "user", parts: [{ text: cleaned }] }],
        config: { outputDimensionality: EMBEDDING_DIMENSIONS },
      });
      const values = retryResult.embeddings?.[0]?.values;
      if (!values || values.length === 0) {
        throw new Error("Gemini embedding returned no embedding values on retry");
      }
      return values;
    }
    throw err;
  }
}

export async function generateEmbeddingsBatch(
  texts: string[],
): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    const cleaned = texts[i].replace(/\s+/g, " ").trim().slice(0, 8000);
    const embedding = await generateEmbedding(cleaned);
    results.push(embedding);

    if (i % 50 === 0 && i > 0) {
      console.log(
        `Embedded ${i} of ${texts.length} texts (${EMBEDDING_MODEL})`,
      );
    }

    if (i < texts.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`Embedded all ${texts.length} texts (${EMBEDDING_MODEL})`);
  return results;
}

export async function findSimilarChunks(
  query: string,
  tableName: "knowledge_chunks",
  limit?: number,
  filter?: { source?: string },
): Promise<ChunkResult[]>;
export async function findSimilarChunks(
  query: string,
  tableName: "recipes",
  limit?: number,
  filter?: { zone?: string; diet?: string },
): Promise<RecipeResult[]>;
export async function findSimilarChunks(
  query: string,
  tableName: "knowledge_chunks" | "recipes",
  limit: number = 8,
  filter?: {
    source?: string;
    zone?: string;
    diet?: string;
  },
): Promise<ChunkResult[] | RecipeResult[]> {
  if (tableName === "recipes") {
    const coverageResult = await pool.query<{ total: string; embedded: string }>(
      `SELECT COUNT(*) as total, COUNT(embedding) as embedded FROM recipes`,
    );

    const coverage = coverageResult.rows[0];
    const totalRecipes = parseInt(coverage.total);
    const embeddedRecipes = parseInt(coverage.embedded);
    const coveragePercent = totalRecipes > 0 ? (embeddedRecipes / totalRecipes) * 100 : 0;

    if (coveragePercent < 10) {
      console.log(
        `Vector search skipped: only ${coveragePercent.toFixed(1)}% of recipes embedded (${embeddedRecipes}/${totalRecipes}). Using SQL filter fallback.`,
      );

      const sqlParams: (string | number | null)[] = [
        filter?.zone || null,
        filter?.diet || null,
        limit,
      ];

      const sqlResult = await pool.query<RecipeResult>(
        `SELECT id, name, cuisine, course, diet,
          ingredients, instructions,
          "prep_time_min" as "prepTimeMin", servings,
          0.5 as similarity
        FROM recipes
        WHERE ($1::text IS NULL OR zone = $1)
          AND ($2::text IS NULL OR diet = $2)
        ORDER BY RANDOM()
        LIMIT $3`,
        sqlParams,
      );

      return sqlResult.rows;
    }
  }

  const queryEmbedding = await generateEmbedding(query);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  if (tableName === "knowledge_chunks") {
    let whereClause = "";
    const params: (string | number)[] = [embeddingStr, limit];

    if (filter?.source) {
      params.push(filter.source);
      whereClause = `WHERE source = $${params.length}`;
    }

    const result = await pool.query<ChunkResult>(
      `SELECT id, source, content, metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM knowledge_chunks
      ${whereClause}
      ORDER BY embedding <=> $1::vector
      LIMIT $2`,
      params,
    );

    return result.rows;
  }

  if (tableName === "recipes") {
    let whereClause = "WHERE embedding IS NOT NULL";
    const params: (string | number)[] = [embeddingStr, limit];

    if (filter?.zone) {
      params.push(filter.zone);
      whereClause += ` AND zone = $${params.length}`;
    }
    if (filter?.diet) {
      params.push(filter.diet);
      whereClause += ` AND diet = $${params.length}`;
    }

    const result = await pool.query<RecipeResult>(
      `SELECT id, name, cuisine, course, diet,
        ingredients, instructions,
        "prep_time_min" as "prepTimeMin", servings,
        1 - (embedding <=> $1::vector) as similarity
      FROM recipes
      ${whereClause}
      ORDER BY embedding <=> $1::vector
      LIMIT $2`,
      params,
    );

    return result.rows;
  }

  return [];
}
