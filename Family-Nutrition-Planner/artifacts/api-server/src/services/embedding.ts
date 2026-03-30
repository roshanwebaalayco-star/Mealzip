import { pool } from "@workspace/db";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";

export function isEmbeddingConfigured(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

function getVoyageKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error(
      "Voyage AI not configured for embeddings. Set VOYAGE_API_KEY.",
    );
  }
  return key;
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

async function voyageFetch(input: string[]): Promise<number[][]> {
  const MAX_RETRIES = 5;
  let delay = 20000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getVoyageKey()}`,
      },
      body: JSON.stringify({ model: VOYAGE_MODEL, input }),
    });

    if (response.status === 429) {
      console.warn(`Voyage AI rate limit hit (attempt ${attempt}/${MAX_RETRIES}). Waiting ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 1.5, 120000);
      continue;
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Voyage AI embedding error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }

  throw new Error(`Voyage AI rate limit exceeded after ${MAX_RETRIES} retries`);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 8000);
  const results = await voyageFetch([cleaned]);
  const values = results[0];
  if (!values || values.length === 0) {
    throw new Error("Voyage AI returned no embedding values");
  }
  return values;
}

export async function generateEmbeddingsBatch(
  texts: string[],
): Promise<number[][]> {
  const VOYAGE_BATCH_SIZE = 128;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += VOYAGE_BATCH_SIZE) {
    const batch = texts
      .slice(i, i + VOYAGE_BATCH_SIZE)
      .map((t) => t.replace(/\s+/g, " ").trim().slice(0, 8000));

    const batchResults = await voyageFetch(batch);
    results.push(...batchResults);

    console.log(
      `Embedded ${Math.min(i + VOYAGE_BATCH_SIZE, texts.length)} of ${texts.length} texts (voyage-3)`,
    );

    if (i + VOYAGE_BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
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
