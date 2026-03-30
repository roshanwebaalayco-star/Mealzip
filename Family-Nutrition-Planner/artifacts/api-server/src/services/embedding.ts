import { pool } from "@workspace/db";
import { GoogleGenAI } from "@google/genai";

const EMBEDDING_DIMENSIONS = 1024;

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";

function getVoyageApiKey(): string | undefined {
  return process.env.VOYAGE_API_KEY;
}

function getGenAI(): GoogleGenAI | null {
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
  return null;
}

export function isEmbeddingConfigured(): boolean {
  return !!(
    process.env.VOYAGE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    (process.env.AI_INTEGRATIONS_GEMINI_API_KEY && process.env.AI_INTEGRATIONS_GEMINI_BASE_URL)
  );
}

function getEmbeddingProvider(): "voyage" | "gemini" {
  if (getVoyageApiKey()) return "voyage";
  return "gemini";
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

async function generateEmbeddingVoyage(text: string): Promise<number[]> {
  const apiKey = getVoyageApiKey();
  if (!apiKey) throw new Error("VOYAGE_API_KEY not set");

  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: [text],
      output_dimension: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 25000));
      const retryResponse = await fetch(VOYAGE_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: VOYAGE_MODEL,
          input: [text],
          output_dimension: EMBEDDING_DIMENSIONS,
        }),
      });
      if (!retryResponse.ok) {
        throw new Error(`Voyage embedding retry failed: ${retryResponse.status} ${await retryResponse.text()}`);
      }
      const retryData = await retryResponse.json();
      return retryData.data[0].embedding;
    }
    throw new Error(`Voyage embedding failed: ${response.status} ${errBody}`);
  }

  const data = await response.json();
  if (!data.data?.[0]?.embedding) {
    throw new Error("Voyage embedding returned no embedding values");
  }
  return data.data[0].embedding;
}

async function generateEmbeddingGemini(text: string): Promise<number[]> {
  const genAI = getGenAI();
  if (!genAI) throw new Error("Gemini AI not configured for embeddings. Set GEMINI_API_KEY or configure the Gemini integration.");

  try {
    const result = await genAI.models.embedContent({
      model: "gemini-embedding-001",
      contents: [{ role: "user", parts: [{ text }] }],
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
        model: "gemini-embedding-001",
        contents: [{ role: "user", parts: [{ text }] }],
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

export async function generateEmbedding(text: string): Promise<number[]> {
  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 8000);
  const provider = getEmbeddingProvider();

  if (provider === "voyage") {
    return generateEmbeddingVoyage(cleaned);
  }
  return generateEmbeddingGemini(cleaned);
}

export async function generateEmbeddingsBatch(
  texts: string[],
): Promise<number[][]> {
  const provider = getEmbeddingProvider();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    const cleaned = texts[i].replace(/\s+/g, " ").trim().slice(0, 8000);
    const embedding = await generateEmbedding(cleaned);
    results.push(embedding);

    if (i % 50 === 0 && i > 0) {
      console.log(
        `Embedded ${i} of ${texts.length} texts (${provider === "voyage" ? VOYAGE_MODEL : "gemini-embedding-001"})`,
      );
    }

    if (i < texts.length - 1) {
      await new Promise((r) => setTimeout(r, provider === "voyage" ? 100 : 200));
    }
  }

  console.log(`Embedded all ${texts.length} texts (${provider === "voyage" ? VOYAGE_MODEL : "gemini-embedding-001"})`);
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
