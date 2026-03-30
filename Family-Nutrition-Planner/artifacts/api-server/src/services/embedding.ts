import { GoogleGenAI } from "@google/genai";
import { pool } from "@workspace/db";

const integrationApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const integrationBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const directApiKey = process.env.GEMINI_API_KEY;

function getGenAI(): GoogleGenAI {
  if (directApiKey) {
    return new GoogleGenAI({ apiKey: directApiKey, httpOptions: { apiVersion: "v1" } });
  }
  if (integrationApiKey && integrationBaseUrl) {
    return new GoogleGenAI({
      apiKey: integrationApiKey,
      httpOptions: { apiVersion: "", baseUrl: integrationBaseUrl },
    });
  }
  throw new Error(
    "Gemini AI not configured for embeddings. Set GEMINI_API_KEY or configure the Gemini integration.",
  );
}

let _genAI: GoogleGenAI | null = null;
function genAI(): GoogleGenAI {
  if (!_genAI) _genAI = getGenAI();
  return _genAI;
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

  const response = await genAI().models.embedContent({
    model: "text-embedding-004",
    contents: cleaned,
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("Embedding response returned no values");
  }
  return values;
}

export async function generateEmbeddingsBatch(
  texts: string[],
): Promise<number[][]> {
  const batchSize = 20;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await Promise.all(
      batch.map((text) => generateEmbedding(text)),
    );
    results.push(...embeddings);

    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }

    console.log(
      `Embedded ${Math.min(i + batchSize, texts.length)} of ${texts.length} texts`,
    );
  }

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
