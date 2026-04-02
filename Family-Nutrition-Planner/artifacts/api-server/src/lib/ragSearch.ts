/**
 * FILE: server/lib/ragSearch.ts
 * PURPOSE: Retrieves the top-K most relevant ICMR-NIN knowledge chunks
 *          for a given user query using cosine similarity.
 *
 * INTEGRATION NOTES:
 *  - Uses `knowledgeChunksTable` from @workspace/db schema
 *  - knowledge_chunks table columns: id, source, chunkIndex, content, embedding (vector), metadata (jsonb)
 *  - For tables >5,000 rows, replace the JS cosine loop with a pgvector
 *    SQL query using the <=> operator for server-side scoring.
 *  - Embedding API: uses Gemini text-embedding-004 via direct API call
 *
 * DEPENDENCIES: Only uses your existing db instance. No new packages.
 */

import { localDb, knowledgeChunksTable } from "@workspace/db";

const MAX_CHUNK_ROWS = 1_000;
const EMBED_TIMEOUT_MS = 5_000;

export interface RagChunk {
  content: string;
  topic: string;
  source: string;
  score: number;
}

interface KnowledgeChunkRow {
  id: number;
  content: string;
  embedding: number[] | string;
  source: string;
  metadata: Record<string, unknown> | null;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot  += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

async function embedQuery(queryText: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (!apiKey) throw new Error("No Gemini API key set in environment for embeddings");

  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);

  const url = baseUrl
    ? `${baseUrl}/models/text-embedding-004:embedContent`
    : `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (baseUrl) {
    headers["x-goog-api-key"] = apiKey;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: queryText }] },
        taskType: "RETRIEVAL_QUERY",
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "(unreadable body)");
    throw new Error(`Embedding API failed (HTTP ${response.status}): ${errText}`);
  }

  const data = await response.json();

  if (!data?.embedding?.values || !Array.isArray(data.embedding.values)) {
    throw new Error(
      `Embedding API returned unexpected shape. Body: ${JSON.stringify(data).slice(0, 300)}`
    );
  }

  return data.embedding.values as number[];
}

const HEALTH_KEYWORDS: string[] = [
  "eat", "eating", "drink", "drinking", "cook", "cooking",
  "avoid", "restrict", "substitute", "replace",
  "food", "meal", "diet", "nutrition", "breakfast", "lunch", "dinner", "snack",
  "ghee", "dal", "roti", "sabzi", "khana", "chawal", "atta", "maida",
  "paneer", "curd", "dahi", "oil", "rice", "chapati",
  "protein", "fat", "carb", "carbohydrate", "sugar", "sodium", "salt",
  "vitamin", "mineral", "calcium", "iron", "fibre", "fiber",
  "calorie", "caloric", "kcal",
  "diabetes", "diabetic", "blood pressure", "hypertension",
  "cholesterol", "thyroid", "anemia", "anaemia", "obesity",
  "swasth", "sehat", "peena", "meetha", "namak", "cheeni", "motapa",
  "medicine", "tablet", "supplement", "medication", "drug", "metformin",
  "glycemic", "insulin", "hemoglobin", "absorption", "deficiency",
];

function isHealthRelatedQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return HEALTH_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function runRagSearch(
  userMessage: string,
  topK: number = 4,
  minScore: number = 0.75
): Promise<RagChunk[]> {
  if (!isHealthRelatedQuery(userMessage)) {
    return [];
  }

  let queryVector: number[];
  try {
    queryVector = await embedQuery(userMessage);
  } catch (err) {
    console.error("[RAG] Embedding failed, skipping RAG injection:", err);
    return [];
  }

  let rows: KnowledgeChunkRow[];
  try {
    rows = (await localDb
      .select()
      .from(knowledgeChunksTable)
      .limit(MAX_CHUNK_ROWS)) as KnowledgeChunkRow[];
  } catch (err) {
    console.error("[RAG] DB fetch failed:", err);
    return [];
  }

  if (!rows || rows.length === 0) {
    console.warn("[RAG] knowledge_chunks table is empty. No ICMR data injected.");
    return [];
  }

  const scored = rows
    .map((row): RagChunk | null => {
      let embedding: number[];

      if (typeof row.embedding === "string") {
        try {
          embedding = JSON.parse(row.embedding);
        } catch {
          return null;
        }
      } else if (Array.isArray(row.embedding)) {
        embedding = row.embedding;
      } else {
        return null;
      }

      if (embedding.length === 0) return null;

      const topic = (row.metadata as any)?.topic ?? row.source ?? "general";

      return {
        content: row.content,
        topic,
        source:  row.source ?? "ICMR-NIN",
        score:   cosineSimilarity(queryVector, embedding),
      };
    })
    .filter((item): item is RagChunk => item !== null && item.score >= minScore);

  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, topK);

  if (results.length === 0) {
    console.info("[RAG] No chunks met minScore =", minScore);
  } else {
    console.info(
      `[RAG] Injecting ${results.length} chunk(s). Top score: ${results[0].score.toFixed(3)}`
    );
  }

  return results;
}

export function formatRagChunksForPrompt(chunks: RagChunk[]): string {
  if (chunks.length === 0) return "";

  const lines = chunks.map(
    (chunk, i) =>
      `[ICMR Evidence ${i + 1}] ` +
      `(Topic: ${chunk.topic} | Source: ${chunk.source} | ` +
      `Relevance: ${(chunk.score * 100).toFixed(1)}%)\n${chunk.content}`
  );

  return `### ICMR EVIDENCE\n${lines.join("\n\n")}`;
}
